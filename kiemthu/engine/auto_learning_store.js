/**
 * =========================================================================================
 * 📚 AUTO-LEARNING PERSISTENT LOCAL KNOWLEDGE STORE (PHƯƠNG PHÁP 2)
 * =========================================================================================
 * Cơ chế Tự Học vào Data Local:
 * 1. Khi khách hỏi 1 câu hỏi MỚI hoàn toàn chưa có trong kho tĩnh -> Groq RAG trả lời xác thực 1 lần
 *    -> Hệ thống kiểm định chất lượng rồi TỰ ĐỘNG LƯU BỀN VỮNG vào data/auto_learned_knowledge.json
 *    (và tự động nạp vào LocalSemanticIndex ngay trong RAM!).
 * 2. Từ lần thứ 2 trở đi (kể cả ngày hôm sau, sau khi restart server, hoặc 100 người khác hỏi câu
 *    khác chữ nhưng CÙNG Ý NGHĨA) -> LocalSemanticIndex tìm thấy trong ~2ms -> trả lời + lắp ghép
 *    tự nhiên bằng local_human_composer.js với 0 TOKEN GROQ!
 * 3. Sẵn sàng mở rộng sang MongoDB (nếu cấu hình MONGODB_URI & cài driver `mongodb`).
 * =========================================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { LocalSemanticIndex } = require('./local_semantic_index');

const LEARNED_FILE = path.join(__dirname, '..', 'data', 'auto_learned_knowledge.json');
const MAX_LEARNED_RECORDS = 3000;

const BLOCKED_LEARN_INTENTS = new Set([
  'OUT_OF_SCOPE',
  'PROMPT_INJECTION',
  'EMERGENCY_SUPPORT',
  'CLARIFICATION',
  'AMBIGUOUS_QUERY',
  'GREETING',
  'THANK_YOU',
  'GOODBYE'
]);

class AutoLearningStore {
  constructor() {
    this.records = [];
    this.semanticIndex = new LocalSemanticIndex();
    this.mongoCollection = null;
    this.stats = {
      loadedFromDisk: 0,
      learnedThisSession: 0,
      semanticCacheHits: 0
    };
    this.loadFromDisk();
    this.initOptionalMongo();
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(LEARNED_FILE)) {
        const raw = fs.readFileSync(LEARNED_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.records = parsed;
          this.stats.loadedFromDisk = parsed.length;
          this.rebuildIndex();
          console.log(`[AutoLearning] Đã nạp ${this.records.length} tri thức tự học bền vững từ auto_learned_knowledge.json.`);
        }
      }
    } catch (e) {
      console.warn('[AutoLearning] Lỗi nạp auto_learned_knowledge.json:', e.message);
      this.records = [];
    }
  }

  async initOptionalMongo() {
    const uri = process.env.MONGODB_URI;
    if (!uri) return;
    try {
      const { MongoClient } = require('mongodb');
      const client = new MongoClient(uri);
      await client.connect();
      const dbName = process.env.MONGODB_DB || 'hoalo_ai_guide';
      this.mongoCollection = client.db(dbName).collection('auto_learned_knowledge');
      const remoteDocs = await this.mongoCollection.find({}).limit(MAX_LEARNED_RECORDS).toArray();
      if (remoteDocs.length > this.records.length) {
        this.records = remoteDocs.map(({ _id, ...rest }) => rest);
        this.rebuildIndex();
        console.log(`[AutoLearning MongoDB] Đã đồng bộ ${this.records.length} tri thức từ MongoDB.`);
      }
    } catch (e) {
      console.warn('[AutoLearning] MongoDB chưa kích hoạt (dùng JSON Local):', e.message);
    }
  }

  rebuildIndex() {
    this.semanticIndex = new LocalSemanticIndex();
    for (const r of this.records) {
      this.semanticIndex.addDocument({
        id: r.id,
        source: 'AUTO_LEARNED_LOCAL',
        question: r.question,
        aliases: r.aliases || [],
        answer: r.answer,
        lang: r.language || 'vi',
        stationCode: r.stationCode || null,
        intent: r.intent || 'HISTORICAL_FACT',
        priorityBoost: 0.04
      });
    }
    this.semanticIndex.rebuildIdf();
  }

  saveToDisk() {
    try {
      const dir = path.dirname(LEARNED_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(LEARNED_FILE, JSON.stringify(this.records, null, 2), 'utf8');
    } catch (e) {
      console.warn('[AutoLearning] Lỗi lưu auto_learned_knowledge.json:', e.message);
    }
  }

  /**
   * Tra cứu tri thức đã tự học theo Ý NGHĨA NGỮ NGHĨA (~1-2ms, 0 Groq!)
   */
  findSemanticLearnedMatch(question, { language = 'vi', stationCode = null, minScore = 0.56 } = {}) {
    if (!question || this.records.length === 0) return null;
    const hits = this.semanticIndex.search(question, {
      lang: language,
      stationCode,
      topK: 1,
      minScore
    });
    if (hits.length > 0) {
      const best = hits[0];
      const rec = this.records.find(r => r.id === best.doc.id);
      if (rec) {
        rec.hitCount = (rec.hitCount || 1) + 1;
        rec.lastHitAt = new Date().toISOString();
      }
      this.stats.semanticCacheHits++;
      return {
        record: rec || best.doc,
        score: Number(best.score.toFixed(3))
      };
    }
    return null;
  }

  /**
   * Kiểm định chất lượng & Tự động học 1 tri thức mới xác thực từ Groq RAG vào Data Local
   */
  learn({ question, answer, intent, language = 'vi', stationCode = null, responseType = '', extraFacts = [] }) {
    if (!question || !answer) return false;
    const cleanQ = question.trim();
    const cleanA = answer.trim();

    // 1. Cổng kiểm định chất lượng (KHÔNG bao giờ học câu lỗi, câu ngoài lề, câu ngắn, câu bịa!)
    if (cleanQ.length < 5 || cleanA.length < 30 || cleanA.length > 700) return false;
    if (BLOCKED_LEARN_INTENTS.has(intent)) return false;
    if (/ngoài phạm vi|chưa nghe rõ|could not hear|outside the scope|lỗi máy chủ/i.test(cleanA)) return false;

    // 2. Nếu đã có bản ghi rất gần nghĩa (>= 0.88) -> gộp thành alias thay vì lưu trùng!
    const existing = this.semanticIndex.search(cleanQ, { lang: language, stationCode, topK: 1, minScore: 0.88 });
    if (existing.length > 0) {
      const target = this.records.find(r => r.id === existing[0].doc.id);
      if (target) {
        target.aliases = target.aliases || [];
        if (!target.aliases.includes(cleanQ) && target.question.toLowerCase() !== cleanQ.toLowerCase()) {
          target.aliases.push(cleanQ);
          if (target.aliases.length > 15) target.aliases = target.aliases.slice(-15);
          this.rebuildIndex();
          this.saveToDisk();
        }
      }
      return false;
    }

    const id = 'LEARN_' + crypto.createHash('md5').update(`${language}:${stationCode || ''}:${cleanQ.toLowerCase()}`).digest('hex').slice(0, 10);
    const newRec = {
      id,
      question: cleanQ,
      aliases: [],
      answer: cleanA,
      intent: intent || 'HISTORICAL_FACT',
      language,
      stationCode: /đang đứng|vị trí hiện tại|standing|gian trưng bày/i.test(cleanA) ? (stationCode || null) : null,
      responseType,
      extraFacts: (extraFacts || []).slice(0, 3),
      learnedAt: new Date().toISOString(),
      hitCount: 1
    };

    this.records.push(newRec);
    if (this.records.length > MAX_LEARNED_RECORDS) {
      this.records = this.records.slice(-MAX_LEARNED_RECORDS);
    }

    this.semanticIndex.addDocument({
      id: newRec.id,
      source: 'AUTO_LEARNED_LOCAL',
      question: newRec.question,
      aliases: newRec.aliases,
      answer: newRec.answer,
      lang: newRec.language,
      stationCode: newRec.stationCode,
      intent: newRec.intent,
      priorityBoost: 0.04
    });
    this.stats.learnedThisSession++;
    this.saveToDisk();

    if (this.mongoCollection) {
      this.mongoCollection.updateOne({ id: newRec.id }, { $set: newRec }, { upsert: true }).catch(() => {});
    }

    console.log(`🧠 [Auto-Learned Local] Đã tự học & lưu bền vững [${language.toUpperCase()}]: "${cleanQ.slice(0, 55)}" (Tổng: ${this.records.length} tri thức)`);
    return true;
  }

  getSummary() {
    return {
      total_learned: this.records.length,
      learned_this_session: this.stats.learnedThisSession,
      semantic_cache_hits: this.stats.semanticCacheHits,
      storage: this.mongoCollection ? 'MongoDB + Local JSON' : 'Local JSON (auto_learned_knowledge.json)',
      recent_learned: this.records.slice(-10).reverse().map(r => ({
        id: r.id,
        question: r.question,
        language: r.language,
        hitCount: r.hitCount || 1,
        learnedAt: r.learnedAt
      }))
    };
  }
}

module.exports = {
  autoLearningStore: new AutoLearningStore()
};
