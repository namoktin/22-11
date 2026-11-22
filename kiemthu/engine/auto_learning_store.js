/**
 * =========================================================================================
 * 📚 AUTO-LEARNING 2.0 — STAGED, VERSIONED, AUDITED KNOWLEDGE LIFECYCLE (PHASE 4)
 * =========================================================================================
 * Quy trình bắt buộc (KHÔNG BAO GIỜ tự biến câu trả lời LLM thành sự thật chính thức!):
 *   Visitor Question -> AI Answer -> Feedback / Knowledge Gap Detection
 *   -> Create Proposal (pending_proposals) -> Prompt-Injection & Contradiction Check
 *   -> Confidence & Provenance Tagging -> Admin Approval / Rejection
 *   -> Version Snapshot -> Promote to Approved Production KB (approved_knowledge)
 *   -> Rollback-ready & Atomic Disk Persistence!
 * =========================================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nlp = require('./nlp_processor');
const validator = require('./answer_validator');
const { LocalSemanticIndex } = require('./local_semantic_index');

const STORE_FILE = path.join(__dirname, '..', 'data', 'auto_learned_knowledge.json');
const MAX_PENDING = 1000;
const MAX_APPROVED = 3000;
const MAX_HISTORY = 30;
const MAX_FEEDBACK = 2000;

const BLOCKED_INTENTS = new Set([
  'OUT_OF_SCOPE',
  'PROMPT_INJECTION',
  'EMERGENCY_SUPPORT',
  'CLARIFICATION',
  'AMBIGUOUS_QUERY',
  'GREETING',
  'THANK_YOU',
  'GOODBYE'
]);

function atomicWriteJsonSync(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const serialized = JSON.stringify(data, null, 2);
  JSON.parse(serialized); // Verify valid JSON before touching live file
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmp, serialized, 'utf8');
  fs.renameSync(tmp, filePath);
}

class AutoLearningStoreV2 {
  constructor(customPath = null) {
    this.storeFile = customPath || STORE_FILE;
    this.state = {
      schemaVersion: 2,
      kbVersion: 1,
      approved: [],     // CHỈ dữ liệu đã phê duyệt chính thức mới được phục vụ!
      pending: [],      // Hàng đợi chờ kiểm duyệt (staging)
      rejected: [],     // Lịch sử từ chối để tránh lặp đề xuất sai
      feedback: [],     // Phản hồi thực tế của du khách
      versions: []      // Snapshot lịch sử phiên bản để rollback an toàn
    };
    this.approvedIndex = new LocalSemanticIndex();
    this.pendingIndex = new LocalSemanticIndex();
    this.stats = {
      proposalsCreated: 0,
      proposalsBlockedInjection: 0,
      proposalsBlockedContradiction: 0,
      approvedSemanticHits: 0
    };
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (!fs.existsSync(this.storeFile)) return;
      const raw = JSON.parse(fs.readFileSync(this.storeFile, 'utf8'));

      // Migration an toàn từ định dạng V1 (Array phẳng) -> V2 (Tách Staging / Production)
      if (Array.isArray(raw)) {
        this.state.pending = raw.map(item => ({
          ...item,
          status: 'pending',
          provenance: {
            sourceType: 'MIGRATED_FROM_V1',
            createdAt: item.learnedAt || new Date().toISOString(),
            sources: ['LEGACY_V1_UNREVIEWED']
          },
          confidenceScore: 0.72
        }));
        this.saveToDisk();
      } else if (raw && typeof raw === 'object') {
        this.state = {
          schemaVersion: 2,
          kbVersion: raw.kbVersion || 1,
          approved: Array.isArray(raw.approved) ? raw.approved : [],
          pending: Array.isArray(raw.pending) ? raw.pending : [],
          rejected: Array.isArray(raw.rejected) ? raw.rejected : [],
          feedback: Array.isArray(raw.feedback) ? raw.feedback : [],
          versions: Array.isArray(raw.versions) ? raw.versions : []
        };
      }
      this.rebuildIndexes();
    } catch (e) {
      console.warn('[AutoLearning 2.0] Lỗi nạp file lưu trữ:', e.message);
    }
  }

  saveToDisk() {
    try {
      atomicWriteJsonSync(this.storeFile, this.state);
    } catch (e) {
      console.warn('[AutoLearning 2.0] Lỗi ghi atomic:', e.message);
    }
  }

  rebuildIndexes() {
    this.approvedIndex = new LocalSemanticIndex();
    for (const r of this.state.approved) {
      this.approvedIndex.addDocument({
        id: r.id,
        source: 'APPROVED_AUTO_LEARNED',
        question: r.question,
        aliases: r.aliases || [],
        answer: r.answer,
        lang: r.language || 'vi',
        stationCode: r.stationCode || null,
        intent: r.intent || 'HISTORICAL_FACT',
        priorityBoost: 0.05
      });
    }
    this.approvedIndex.rebuildIdf();

    this.pendingIndex = new LocalSemanticIndex();
    for (const p of this.state.pending) {
      this.pendingIndex.addDocument({
        id: p.id,
        source: 'PENDING_PROPOSAL',
        question: p.question,
        aliases: p.aliases || [],
        answer: p.answer,
        lang: p.language || 'vi',
        stationCode: p.stationCode || null,
        intent: p.intent || 'HISTORICAL_FACT'
      });
    }
    this.pendingIndex.rebuildIdf();
  }

  /**
   * CHỈ tra cứu trong tập APPROVED (dữ liệu chính thức đã được duyệt)!
   * Tuyệt đối KHÔNG phục vụ dữ liệu pending/chưa duyệt!
   */
  findSemanticLearnedMatch(question, { language = 'vi', stationCode = null, minScore = 0.62 } = {}) {
    if (!question || this.state.approved.length === 0) return null;
    const hits = this.approvedIndex.search(question, {
      lang: language,
      stationCode,
      topK: 1,
      minScore
    });
    if (hits.length > 0) {
      const best = hits[0];
      const rec = this.state.approved.find(r => r.id === best.doc.id);
      if (rec) {
        rec.hitCount = (rec.hitCount || 0) + 1;
        rec.lastHitAt = new Date().toISOString();
      }
      this.stats.approvedSemanticHits++;
      return {
        record: rec || best.doc,
        score: Number(best.score.toFixed(3))
      };
    }
    return null;
  }

  /**
   * Kiểm tra xung đột & mâu thuẫn với bộ quy tắc sử học RealAnswerValidator + tri thức đã duyệt
   */
  checkContradictionAndSafety(question, answer) {
    // 1. Chống Prompt Injection xâm nhập vào kho tri thức!
    if (nlp.detectPromptInjection(question) || nlp.detectPromptInjection(answer)) {
      this.stats.proposalsBlockedInjection++;
      return { safe: false, reason: 'PROMPT_INJECTION_DETECTED' };
    }

    // 2. Kiểm tra mâu thuẫn dữ kiện trọng yếu bằng RealAnswerValidator
    for (const rule of (validator.contradictionRules || [])) {
      if (rule.check(answer, question)) {
        this.stats.proposalsBlockedContradiction++;
        return {
          safe: false,
          reason: `HISTORICAL_CONTRADICTION:${rule.id}`,
          evidence: rule.evidenceFact
        };
      }
    }

    return { safe: true };
  }

  /**
   * Đề xuất tri thức mới vào HÀNG ĐỢI CHỜ DUYỆT (pending_proposals) — KHÔNG tự động xuất bản!
   */
  propose({
    question,
    answer,
    intent,
    language = 'vi',
    stationCode = null,
    responseType = '',
    sources = [],
    confidenceScore = 0.80,
    extraFacts = [],
    groundingStatus = 'GROUNDED'
  }) {
    if (!question || !answer) return { accepted: false, reason: 'EMPTY_INPUT' };
    const cleanQ = String(question).trim();
    const cleanA = String(answer).trim();

    if (cleanQ.length < 6 || cleanA.length < 30 || cleanA.length > 750) {
      return { accepted: false, reason: 'LENGTH_OUT_OF_RANGE' };
    }
    if (BLOCKED_INTENTS.has(intent)) {
      return { accepted: false, reason: 'BLOCKED_INTENT' };
    }
    if (/ngoài phạm vi|chưa nghe rõ|could not hear|outside the scope|lỗi máy chủ|chưa có đủ tư liệu/i.test(cleanA)) {
      return { accepted: false, reason: 'REFUSAL_OR_GAP_RESPONSE' };
    }
    if (groundingStatus === 'UNGROUNDED') {
      return { accepted: false, reason: 'UNGROUNDED_LLM_OUTPUT' };
    }

    // Kiểm tra bảo mật & mâu thuẫn lịch sử
    const safety = this.checkContradictionAndSafety(cleanQ, cleanA);
    if (!safety.safe) {
      return { accepted: false, reason: safety.reason };
    }

    // Chống trùng lặp với tập đã duyệt hoặc đang chờ duyệt
    const dupApproved = this.approvedIndex.search(cleanQ, { lang: language, stationCode, topK: 1, minScore: 0.88 });
    if (dupApproved.length > 0) {
      return { accepted: false, reason: 'DUPLICATE_IN_APPROVED', matchedId: dupApproved[0].doc.id };
    }
    const dupPending = this.pendingIndex.search(cleanQ, { lang: language, stationCode, topK: 1, minScore: 0.88 });
    if (dupPending.length > 0) {
      const target = this.state.pending.find(p => p.id === dupPending[0].doc.id);
      if (target) {
        target.frequency = (target.frequency || 1) + 1;
        target.aliases = target.aliases || [];
        if (!target.aliases.includes(cleanQ) && target.question.toLowerCase() !== cleanQ.toLowerCase()) {
          target.aliases.push(cleanQ);
        }
        this.saveToDisk();
      }
      return { accepted: false, reason: 'MERGED_INTO_PENDING', matchedId: dupPending[0].doc.id };
    }

    // Phát hiện mâu thuẫn tiềm ẩn với bản ghi đã duyệt cùng chủ đề nhưng câu trả lời khác biệt mạnh
    const similarApproved = this.approvedIndex.search(cleanQ, { lang: language, stationCode, topK: 1, minScore: 0.65 });
    const potentialConflictWith = similarApproved.length > 0 ? similarApproved[0].doc.id : null;

    const id = 'PROP_' + crypto.createHash('md5').update(`${language}:${stationCode || ''}:${cleanQ.toLowerCase()}`).digest('hex').slice(0, 10);
    const proposal = {
      id,
      status: 'pending',
      question: cleanQ,
      aliases: [],
      answer: cleanA,
      intent: intent || 'HISTORICAL_FACT',
      language,
      stationCode: /đang đứng|vị trí hiện tại|standing|gian trưng bày/i.test(cleanA) ? (stationCode || null) : null,
      confidenceScore: Number(confidenceScore || 0.80),
      groundingStatus,
      potentialConflictWith,
      frequency: 1,
      extraFacts: (extraFacts || []).slice(0, 3),
      provenance: {
        sourceType: responseType || 'LLM_GROUNDED_SYNTHESIS',
        sources: Array.isArray(sources) ? sources.slice(0, 5) : [],
        createdAt: new Date().toISOString()
      }
    };

    this.state.pending.push(proposal);
    if (this.state.pending.length > MAX_PENDING) {
      this.state.pending = this.state.pending.slice(-MAX_PENDING);
    }
    this.stats.proposalsCreated++;
    this.rebuildIndexes();
    this.saveToDisk();

    return { accepted: true, proposalId: id, status: 'pending', potentialConflictWith };
  }

  /**
   * Giữ tương thích ngược tên hàm `learn()` -> chuyển hướng an toàn vào `propose()` (Staging, KHÔNG tự xuất bản!)
   */
  learn(params) {
    return this.propose(params);
  }

  /**
   * Phê duyệt đề xuất (chỉ Admin mới được gọi!) -> tạo snapshot phiên bản & đưa vào Approved Production KB
   */
  approveProposal(proposalId, { approvedBy = 'admin', editedAnswer = null, note = '' } = {}) {
    const idx = this.state.pending.findIndex(p => p.id === proposalId);
    if (idx === -1) return { success: false, error: 'Proposal not found in pending queue' };

    const prop = this.state.pending[idx];
    const finalAnswer = editedAnswer ? String(editedAnswer).trim() : prop.answer;

    // Kiểm tra lại mâu thuẫn & injection lần cuối trước khi lên Production!
    const safety = this.checkContradictionAndSafety(prop.question, finalAnswer);
    if (!safety.safe) {
      return { success: false, error: `Approval blocked by safety validator: ${safety.reason}` };
    }

    // Lưu snapshot phiên bản trước để hỗ trợ Rollback bất cứ lúc nào!
    this.createVersionSnapshot(`Before approving ${proposalId} by ${approvedBy}`);

    this.state.pending.splice(idx, 1);
    this.state.kbVersion = (this.state.kbVersion || 1) + 1;

    const approvedRecord = {
      id: prop.id.replace(/^PROP_/, 'APPR_'),
      proposalId: prop.id,
      version: this.state.kbVersion,
      status: 'approved',
      question: prop.question,
      aliases: prop.aliases || [],
      answer: finalAnswer,
      intent: prop.intent,
      language: prop.language,
      stationCode: prop.stationCode,
      confidenceScore: Math.max(0.92, prop.confidenceScore || 0.92),
      extraFacts: prop.extraFacts || [],
      provenance: {
        ...prop.provenance,
        approvedBy,
        approvedAt: new Date().toISOString(),
        approvalNote: note
      },
      hitCount: 0
    };

    this.state.approved.push(approvedRecord);
    if (this.state.approved.length > MAX_APPROVED) {
      this.state.approved = this.state.approved.slice(-MAX_APPROVED);
    }

    this.rebuildIndexes();
    this.saveToDisk();
    return { success: true, kbVersion: this.state.kbVersion, record: approvedRecord };
  }

  rejectProposal(proposalId, { rejectedBy = 'admin', reason = 'rejected_by_curator' } = {}) {
    const idx = this.state.pending.findIndex(p => p.id === proposalId);
    if (idx === -1) return { success: false, error: 'Proposal not found' };

    const [prop] = this.state.pending.splice(idx, 1);
    this.state.rejected.push({
      id: prop.id,
      question: prop.question,
      rejectedBy,
      reason,
      rejectedAt: new Date().toISOString()
    });
    if (this.state.rejected.length > 500) this.state.rejected = this.state.rejected.slice(-500);
    this.rebuildIndexes();
    this.saveToDisk();
    return { success: true, rejectedId: prop.id };
  }

  createVersionSnapshot(label = '') {
    this.state.versions.push({
      kbVersion: this.state.kbVersion,
      createdAt: new Date().toISOString(),
      label,
      approvedCount: this.state.approved.length,
      approvedSnapshot: JSON.parse(JSON.stringify(this.state.approved))
    });
    if (this.state.versions.length > MAX_HISTORY) {
      this.state.versions = this.state.versions.slice(-MAX_HISTORY);
    }
  }

  rollbackToVersion(targetVersion = null) {
    if (!this.state.versions.length) {
      return { success: false, error: 'No version snapshots available for rollback' };
    }
    const snapIdx = targetVersion !== null
      ? this.state.versions.findIndex(v => v.kbVersion === Number(targetVersion))
      : this.state.versions.length - 1;
    if (snapIdx === -1) {
      return { success: false, error: `Version ${targetVersion} not found` };
    }
    const snap = this.state.versions[snapIdx];
    this.state.approved = JSON.parse(JSON.stringify(snap.approvedSnapshot));
    this.state.kbVersion = snap.kbVersion;
    this.state.versions = this.state.versions.slice(0, snapIdx);
    this.rebuildIndexes();
    this.saveToDisk();
    return {
      success: true,
      restoredVersion: this.state.kbVersion,
      approvedCount: this.state.approved.length
    };
  }

  recordFeedback({ question, reply, rating, comment = '', deviceId = 'GUEST', language = 'vi' }) {
    if (!question) return { success: false, error: 'Missing question' };
    const cleanRating = rating === 'up' || rating === 'down' || Number(rating) >= 1 ? rating : 'neutral';
    const entry = {
      id: 'FB_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      question: String(question).slice(0, 500),
      reply: String(reply || '').slice(0, 700),
      rating: cleanRating,
      comment: String(comment || '').slice(0, 300),
      deviceId: String(deviceId || 'GUEST').slice(0, 64),
      language,
      createdAt: new Date().toISOString()
    };
    this.state.feedback.push(entry);
    if (this.state.feedback.length > MAX_FEEDBACK) {
      this.state.feedback = this.state.feedback.slice(-MAX_FEEDBACK);
    }
    this.saveToDisk();
    return { success: true, feedback: entry };
  }

  // Giữ thuộc tính records tương thích ngược với /health
  get records() {
    return this.state.approved;
  }

  getSummary() {
    return {
      schema_version: 2,
      kb_version: this.state.kbVersion,
      total_approved: this.state.approved.length,
      total_pending_review: this.state.pending.length,
      total_rejected: this.state.rejected.length,
      total_feedback: this.state.feedback.length,
      available_rollback_versions: this.state.versions.map(v => ({
        kbVersion: v.kbVersion,
        approvedCount: v.approvedCount,
        createdAt: v.createdAt,
        label: v.label
      })),
      stats: { ...this.stats },
      pending_proposals: this.state.pending.slice(-15).reverse().map(p => ({
        id: p.id,
        question: p.question,
        answer: p.answer,
        language: p.language,
        confidenceScore: p.confidenceScore,
        potentialConflictWith: p.potentialConflictWith,
        frequency: p.frequency || 1,
        provenance: p.provenance
      })),
      approved_records: this.state.approved.slice(-15).reverse().map(r => ({
        id: r.id,
        version: r.version,
        question: r.question,
        language: r.language,
        hitCount: r.hitCount || 0,
        approvedBy: r.provenance?.approvedBy || 'admin',
        approvedAt: r.provenance?.approvedAt || null
      }))
    };
  }
}

module.exports = {
  AutoLearningStoreV2,
  autoLearningStore: new AutoLearningStoreV2()
};
