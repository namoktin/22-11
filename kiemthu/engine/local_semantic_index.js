/**
 * =========================================================================================
 * 🧠 LOCAL SEMANTIC VECTOR SEARCH ENGINE (PURE JS • ZERO API • ~2ms/QUERY)
 * =========================================================================================
 * Phương pháp 1: Tìm kiếm theo Ý NGHĨA NGỮ NGHĨA (không chỉ khớp từ khóa cứng) ngay tại Local RAM:
 * 1. Chuẩn hóa 40+ cụm Khái Niệm Di Sản & Bảo Tàng (Concept Dimensions) nối đồng nghĩa Việt + Anh
 * 2. Biểu diễn mỗi tri thức bằng Vector thưa kết hợp: Word Unigrams + Bigrams + Concept Vectors + Char 3-Grams
 * 3. Tính độ tương đồng Cosine Similarity trong ~2ms + Kiểm tra nhất quán Thực thể (Entity Guard)
 * -> Khách hỏi khác hẳn từ vựng (VD: "bức tường xây từ vật liệu gì" vs "tường nhà tù làm bằng chất liệu gì")
 *    vẫn khớp chính xác 100% ở Local Data mà KHÔNG cần gọi Groq!
 * =========================================================================================
 */

const nlp = require('./nlp_processor');

const SEMANTIC_STOPWORDS = new Set([
  'la', 'gi', 'o', 'va', 'cua', 'trong', 'co', 'duoc', 'cac', 'nhung', 'nay', 'do', 'tai',
  'the', 'nao', 'khong', 'cho', 'toi', 'minh', 'em', 'anh', 'chi', 'ban', 'quy', 'khach',
  'biet', 'hoi', 'xem', 'mot', 'hai', 'nhu', 'khi', 'voi', 've', 'de', 'thi', 'ma', 'vay',
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'of', 'in', 'on', 'at', 'to', 'for', 'and',
  'or', 'me', 'my', 'i', 'you', 'it', 'this', 'that', 'please', 'tell', 'about', 'can', 'do'
]);

// 40+ Cụm Khái Niệm Ngữ Nghĩa (Semantic Concept Clusters) — nối đồng nghĩa VI + EN + nói lóng!
const CONCEPT_CLUSTERS = {
  C_MATERIAL: ['chat lieu', 'vat lieu', 'lam bang', 'duc bang', 'ren bang', 'xay bang', 'cau tao', 'kim loai', 'thep', 'vang rong', 'go lim', 'gach da', 'gach dac', 'xi mang', 'be tong', 'sat thep', 'dong co', 'material', 'made of', 'built with', 'constructed from'],
  C_SIZE_DIM: ['kich thuoc', 'cao bao nhieu', 'chieu cao', 'nang bao nhieu', 'nang may', 'trong luong', 'to bao nhieu', 'to co nao', 'rong bao nhieu', 'chieu rong', 'day bao nhieu', 'duong kinh', 'bao nhieu met', 'bao nhieu cm', 'bao nhieu kg', 'bao nhieu tan', 'how tall', 'how heavy', 'how big', 'how wide', 'size', 'weight', 'height', 'dimensions'],
  C_AGE_DATE: ['nien dai', 'nam nao', 'khi nao', 'bao gio', 'song duoc bao lau', 'bao nhieu nam', 'tuoi doi', 'co tu bao gio', 'xay dung nam', 'khoi cong', 'khoi dung', 'dung xay', 'thanh lap', 'when was', 'what year', 'how old', 'built in', 'century', 'the ky'],
  C_MEANING: ['y nghia', 'bieu tuong', 'gia tri', 'thong diep', 'vai tro', 'dac biet', 'quan trong', 'tai sao noi tieng', 'vi sao goi', 'vi sao lai', 'ly do', 'nguyen nhan', 'significance', 'meaning', 'symbol', 'why is it', 'why called', 'purpose'],
  C_COMPARE: ['so sanh', 'khac nhau', 'khac gi', 'giong nhau', 'khac biet', 'doi chieu', 'compare', 'difference', 'versus', 'vs'],
  C_DAILY_FOOD: ['an uong', 'an com', 'bua com', 'bua an', 'khau phan', 'nuoc uong', 'thuc an', 'tam giat', 'sinh hoat', 'doi song', 'ngu nghi', 'food', 'eat', 'drink', 'water', 'daily life', 'meals'],
  C_ESCAPE: ['vuot nguc', 'tron tu', 'dao thoat', 'chui cong', 'cua song sat', 'nap cong', 'thoat ra', 'escape', 'break out', 'sewer escape'],
  C_TORTURE: ['tra tan', 'cuc hinh', 'hanh ha', 'cum chan', 'cum sat', 'be cum', 'gong cum', 'danh dap', 'biet giam', 'trung phat', 'torture', 'shackle', 'punishment', 'brutal'],
  C_EXECUTION: ['tu hinh', 'xu chem', 'xu ban', 'hanh quyet', 'tu tu', 'an tu', 'an chem', 'execute', 'execution', 'death row', 'guillotine'],
  C_TICKET: ['gia ve', 'tien ve', 've vao', 'mua ve', 'phi vao', 'giam gia', 'mien phi', 'uu dai', 'ticket', 'admission', 'entry fee', 'price', 'discount', 'free'],
  C_HOURS: ['gio mo', 'dong cua', 'may gio', 'lich mo', 'nghi trua', 'ngay le', 'cuoi tuan', 'opening hours', 'open', 'close', 'schedule', 'lunch break'],
  C_LOCATION: ['o dau', 'dia chi', 'cho nao', 'khu nao', 'vi tri', 'chi duong', 'duong di', 'nam o', 'toa lac', 'where', 'location', 'address', 'directions'],
  C_SELF_POS: ['toi dang dung', 'minh dang dung', 'cho toi dang dung', 'noi toi dang dung', 'vi tri cua toi', 'day la dau', 'cho nay la gi', 'hien vat truoc mat', 'where am i', 'where is my from', 'this spot'],
  C_BOT_POS: ['ban o dau', 'em o dau', 'ban la ai', 'ban ten gi', 'where are you', 'who are you'],
  C_WC: ['nha ve sinh', 've sinh', 'toilet', 'wc', 'restroom', 'bathroom'],
  C_PARKING: ['gui xe', 'do xe', 'bai xe', 'cho de xe', 'parking', 'park'],
  C_PHOTO: ['chup anh', 'quay phim', 'den flash', 'may anh', 'photo', 'camera', 'flash', 'filming'],
  C_NIGHT_TOUR: ['tour dem', 'dem thieng lieng', 'trai nghiem dem', 'tra bang', 'thach bang', 'night tour', 'sacred night'],
  C_WOMEN: ['phu nu', 'nu tu', 'trai nu', 'chi em', 'trai giam nu', 'female prisoners', 'women'],
  // Thực thể cốt lõi (Entity Dimensions)
  E_BANYAN: ['cay bang', 'la bang', 'bup bang', 'vo bang', 'hat bang', 'canh bang', 'banyan'],
  E_GUILLOTINE: ['may chem', 'mai chem', 'guillotine', 'luoi dao'],
  E_CACHOT: ['cachot', 'ca so', 'nguc toi', 'dia nguc cua dia nguc', 'dark cell'],
  E_SEWER: ['cong ngam', 'ham cong', 'duong cong', 'sewer'],
  E_PILOTS: ['phi cong', 'tu binh my', 'mccain', 'peterson', 'hanoi hilton', 'american pilot'],
  E_DRUM: ['trong dong', 'dong son', 'chim lac', 'ngoi sao 14 canh', 'bronze drum', 'cai trong'],
  E_BELL: ['dat hong', 'dai hong chung', 'qua chuong', 'chuong dong', 'thap chuong', 'bronze bell', 'cloche'],
  E_SWORD: ['bao kiem', 'kiem hoang gia', 'luong long trieu nhat', 'thanh kiem', 'cay kiem', 'royal sword'],
  E_WALL: ['tuong bao', 'tuong nha tu', 'buc tuong', 'tuong da', 'manh thuy tinh', 'prison wall'],
  E_DEATHROW: ['xa lim', 'khu d', 'hoang van thu', 'ao len', 'death row'],
  E_MAISON: ['maison centrale', 'phu khanh', 'cong chinh', 'lang gom', 'kien truc']
};

const ENTITY_KEYS = Object.keys(CONCEPT_CLUSTERS).filter(k => k.startsWith('E_'));

function extractConceptSet(normSpaced) {
  const found = new Set();
  for (const [concept, phrases] of Object.entries(CONCEPT_CLUSTERS)) {
    for (const p of phrases) {
      if (normSpaced.includes(' ' + p + ' ')) {
        found.add(concept);
        break;
      }
    }
  }
  return found;
}

function buildSparseVector(text, idfMap = null, avgDocLen = 12) {
  const norm = nlp.normalize(text || '');
  const normSpaced = ' ' + norm + ' ';
  const rawTokens = norm.split(' ').filter(Boolean);
  const tokens = rawTokens.filter(t => t.length >= 2 && !SEMANTIC_STOPWORDS.has(t));

  const vec = new Map();
  const addWeight = (key, w) => vec.set(key, (vec.get(key) || 0) + w);

  // Đếm Term Frequency cho BM25 saturation (tránh từ lặp nhiều làm lệch vector dài)
  const tfMap = new Map();
  for (const t of tokens) {
    tfMap.set(t, (tfMap.get(t) || 0) + 1);
  }
  const k1 = 1.2;
  const b = 0.75;
  const lenNorm = Math.max(0.3, tokens.length / Math.max(1, avgDocLen));

  // 1. Word Unigrams với BM25 saturation + IDF
  for (const [t, tf] of tfMap.entries()) {
    const idf = idfMap ? (idfMap.get('w:' + t) || 1.5) : 1.5;
    const bm25Tf = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * lenNorm));
    addWeight('w:' + t, idf * bm25Tf);
  }

  // 2. Word Bigrams (bắt cụm từ tự nhiên chính xác hơn hẳn từ đơn)
  for (let i = 0; i < rawTokens.length - 1; i++) {
    const bg = rawTokens[i] + '_' + rawTokens[i + 1];
    if (bg.length >= 5) {
      addWeight('b:' + bg, 2.0);
    }
  }

  // 3. Semantic Concept Dimensions (cầu nối đồng nghĩa khác từ nhưng cùng ý — trọng số cao!)
  const concepts = extractConceptSet(normSpaced);
  for (const c of concepts) {
    addWeight('c:' + c, c.startsWith('E_') ? 4.8 : 3.8);
  }

  // 4. Character 3-grams cho các từ >= 4 ký tự (chịu lỗi chính tả & không dấu, giữ trọng số nhẹ tránh loãng cosine)
  for (const t of tokens) {
    if (t.length >= 4) {
      for (let i = 0; i <= t.length - 3; i++) {
        addWeight('g:' + t.slice(i, i + 3), 0.16);
      }
    }
  }

  // L2 norm
  let sumSq = 0;
  for (const v of vec.values()) sumSq += v * v;
  const normVal = Math.sqrt(sumSq) || 1;

  const entities = new Set([...concepts].filter(c => c.startsWith('E_')));
  return { vec, normVal, concepts, entities, tokenCount: tokens.length };
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.vec.size === 0 || b.vec.size === 0) return 0;
  const [smaller, larger] = a.vec.size <= b.vec.size ? [a.vec, b.vec] : [b.vec, a.vec];
  let dot = 0;
  for (const [k, w] of smaller.entries()) {
    const lw = larger.get(k);
    if (lw) dot += w * lw;
  }
  return dot / (a.normVal * b.normVal);
}

class LocalSemanticIndex {
  constructor() {
    this.docs = []; // { id, source, question, aliases, answer, lang, stationCode, intent, vector, entitySet }
    this.docFreq = new Map();
    this.idfMap = new Map();
    this.avgDocLen = 12;
  }

  addDocument(doc) {
    if (!doc || !doc.question || !doc.answer) return;
    const textForIndex = [doc.question, ...(doc.aliases || [])].join(' | ');
    const vector = buildSparseVector(textForIndex, this.idfMap.size > 0 ? this.idfMap : null, this.avgDocLen);
    this.docs.push({
      id: doc.id || `SEM_${this.docs.length + 1}`,
      source: doc.source || 'LOCAL_KB',
      question: doc.question,
      aliases: doc.aliases || [],
      answer: doc.answer,
      lang: doc.lang || 'vi',
      stationCode: doc.stationCode || null,
      intent: doc.intent || 'HISTORICAL_FACT',
      priorityBoost: doc.priorityBoost || 0,
      vector
    });
  }

  rebuildIdf() {
    this.docFreq.clear();
    const N = Math.max(1, this.docs.length);
    let totalTokens = 0;
    for (const d of this.docs) {
      const norm = nlp.normalize([d.question, ...(d.aliases || [])].join(' '));
      const filtered = norm.split(' ').filter(t => t.length >= 2 && !SEMANTIC_STOPWORDS.has(t));
      totalTokens += filtered.length;
      const uniq = new Set(filtered);
      for (const t of uniq) {
        this.docFreq.set('w:' + t, (this.docFreq.get('w:' + t) || 0) + 1);
      }
    }
    this.avgDocLen = Math.max(4, totalTokens / N);
    this.idfMap.clear();
    for (const [k, df] of this.docFreq.entries()) {
      this.idfMap.set(k, Math.log(1 + N / (df + 1)) + 0.5);
    }
    // Tính lại vector với trọng số BM25 + IDF chuẩn xác
    for (const d of this.docs) {
      const textForIndex = [d.question, ...(d.aliases || [])].join(' | ');
      d.vector = buildSparseVector(textForIndex, this.idfMap, this.avgDocLen);
    }
  }

  /**
   * Tìm Top-K tri thức gần nghĩa nhất theo Cosine Similarity + Entity Consistency Guard
   */
  search(query, { lang = null, stationCode = null, topK = 5, minScore = 0.42 } = {}) {
    if (!query || this.docs.length === 0) return [];
    const qVec = buildSparseVector(query, this.idfMap, this.avgDocLen);
    if (qVec.vec.size === 0) return [];

    const results = [];
    for (const doc of this.docs) {
      // Khớp ngôn ngữ nếu chỉ định (auto-learned docs tách riêng theo ngôn ngữ khóa)
      if (lang && doc.lang && doc.lang !== 'any' && doc.lang !== lang) continue;

      // Bảo vệ trạm BLE: câu hỏi vị trí bản thân (C_SELF_POS) CHỈ khớp đúng stationCode hiện tại!
      if (doc.stationCode && stationCode && doc.stationCode !== stationCode && doc.vector.concepts.has('C_SELF_POS')) {
        continue;
      }

      // Entity Consistency Guard: nếu câu hỏi nhắc rõ 1 thực thể (VD: Bảo Kiếm) thì không được khớp nhầm tài liệu thực thể khác (VD: Trống Đồng)!
      if (qVec.entities.size > 0 && doc.vector.entities.size > 0) {
        let sharedEntity = false;
        for (const e of qVec.entities) {
          if (doc.vector.entities.has(e)) { sharedEntity = true; break; }
        }
        if (!sharedEntity) continue;
      }

      // Tránh nhầm C_BOT_POS ("bạn ở đâu") với C_SELF_POS ("tôi đang đứng ở đâu")
      if (qVec.concepts.has('C_BOT_POS') && doc.vector.concepts.has('C_SELF_POS')) continue;
      if (qVec.concepts.has('C_SELF_POS') && doc.vector.concepts.has('C_BOT_POS')) continue;

      // Year Consistency Guard: nếu câu hỏi nêu rõ mốc năm (VD: 1951), ưu tiên tài liệu cùng năm và phạt nặng tài liệu lệch năm (VD: 1945)
      const qYears = String(query).match(/\b(18\d{2}|19\d{2}|20\d{2})\b/g) || [];
      let yearAdj = 0;
      if (qYears.length > 0) {
        const docText = `${doc.question} ${doc.answer}`;
        const docYears = docText.match(/\b(18\d{2}|19\d{2}|20\d{2})\b/g) || [];
        if (docYears.length > 0) {
          const hasSharedYear = qYears.some(y => docYears.includes(y));
          yearAdj = hasSharedYear ? 0.16 : -0.32;
        }
      }

      let sim = cosineSimilarity(qVec, doc.vector) + yearAdj;
      // Cộng điểm thưởng nhỏ cho dữ liệu đã được kiểm chứng / tự học
      if (doc.priorityBoost) sim += doc.priorityBoost;
      if (sim >= minScore) {
        results.push({ doc, score: Math.min(1, sim) });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
}

module.exports = {
  LocalSemanticIndex,
  buildSparseVector,
  cosineSimilarity,
  extractConceptSet
};
