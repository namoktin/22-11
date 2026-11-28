/**
 * 2Guide Production Conversational AI Engine v6.1 (Production-Grade Edition)
 * 
 * KIẾN TRÚC 8 TẦNG XỬ LÝ DOANH NGHIỆP:
 * 1. INPUT PROCESSING & PROFILE SIGNALS: Chuẩn hóa gõ, lọc injection, trích xuất nhu cầu cá nhân hóa (thời gian, người già, trẻ nhỏ, xe lăn).
 * 2. SEMANTIC INTENT UNDERSTANDING: Phân tích 4 chiều (Intent, SubIntent, Subject, Aspect, Urgency).
 * 3. HYBRID CONTEXT RETRIEVAL: Ground Truth sử học, SSOT Service Knowledge, Hồ sơ phân khu & khía cạnh.
 * 4. INTELLIGENT RESPONSE CACHING V2: Cache Key đa chiều, bảo vệ dữ liệu cá nhân hóa, theo dõi Token & Cost P50/P95.
 * 5. ADAPTIVE ANSWER COMPOSER V2: Không sao chép cứng Ground Truth, thích ứng theo khía cạnh, không văn mẫu khuôn sáo.
 * 6. REAL CLAIM-LEVEL VERIFICATION: Tách mệnh đề độc lập, đối chiếu bằng chứng, Clean Replacement, hiệu chuẩn Confidence thực tế.
 * 7. STRUCTURED CONVERSATION STATE: Cryptographic Session ID, theo dõi tiến trình thực thể, cách ly tuyệt đối (Session Isolation).
 * 8. PRODUCTION HARDENING: Configurable CORS, Rate Limiting (120 req/m) an toàn Proxy, Payload Limit (32KB), Safe Error Handling.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Nạp biến môi trường từ file .env nếu có
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const k = trimmed.substring(0, idx).trim();
      const v = trimmed.substring(idx + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  });
}

const PORT = process.env.PORT || 4001;
const API_KEY = process.env.API_KEY || ''; // Nếu set thì kích hoạt API Key protection
const { groqPool, GROQ_MODELS_REASONING } = require('./engine/groq_pool');
const { getGlossaryPromptHint, postPolishForeignTerms } = require('./engine/heritage_glossary');
const { getNativeRegisterInstruction } = require('./engine/multilingual_docent');

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL_POOL = GROQ_MODELS_REASONING;
const PRIMARY_MODEL = GROQ_MODEL_POOL[0];
const MAX_PAYLOAD_BYTES = 32 * 1024; // 32KB
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 phút
const MAX_REQUESTS_PER_WINDOW = 120; // 120 req/phút/IP
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['*'];

// Nạp các Engine độc lập
const nlp = require('./engine/nlp_processor');
const { classifier, INTENTS } = require('./engine/intent_classifier');
const { knowledgeBase, HISTORICAL_EXHIBITS } = require('./engine/knowledge_base');
const { semanticRouter } = require('./engine/semantic_router');
const sessionManager = require('./engine/session_manager');
const composer = require('./engine/answer_composer');
const validator = require('./engine/answer_validator');
const responseCache = require('./engine/response_cache');
const { composeLocalHumanVariation } = require('./engine/local_human_composer');
const { autoLearningStore } = require('./engine/auto_learning_store');

class ProductionSmartTourGuideServer {
  constructor() {
    this.stats = {
      totalRequests: 0,
      intentsCount: {},
      confidenceCount: { HIGH: 0, MEDIUM: 0, LOW: 0 },
      groqCalls: 0,
      groqRateLimitSkips: 0,
      neuralPromptGuardBlocks: 0,
      totalLatencyMs: 0
    };
    this.rateLimitMap = new Map(); // ip -> { count, resetTime }
    this.modelCooldowns = new Map(); // Tham chiếu tương thích ngược; điều phối tập trung qua groqPool
    this.inFlightAsks = new Map(); // Khử trùng lặp đồng thời khi test burst cùng 1 câu hỏi
    this.recentPhrasings = new Map(); // key -> string[] (lưu tới 120 cách diễn đạt đã nói để hỏi 100 lần đều khác nhau!)
    this.verifiedBaseReplies = new Map(); // key -> { reply, extraFacts, intent, sources, responseType } (dữ liệu gốc để lắp ghép local 0-token!)

    // Định kỳ giải phóng IP rate-limit & model cooldowns hết hạn để vận hành ổn định 1+ năm không phình RAM
    setInterval(() => {
      const now = Date.now();
      for (const [ip, rec] of this.rateLimitMap.entries()) {
        if (!rec || now > rec.resetTime) this.rateLimitMap.delete(ip);
      }
      for (const [m, until] of this.modelCooldowns.entries()) {
        if (now >= until) this.modelCooldowns.delete(m);
      }
    }, 5 * 60 * 1000).unref();
  }

  getRecentPhrasings(key) {
    return this.recentPhrasings.get(key) || [];
  }

  recordPhrasing(key, reply) {
    if (!reply || !key) return;
    if (this.recentPhrasings.size > 500) {
      const oldestKey = this.recentPhrasings.keys().next().value;
      if (oldestKey) this.recentPhrasings.delete(oldestKey);
    }
    const list = this.recentPhrasings.get(key) || [];
    list.push(reply.trim());
    this.recentPhrasings.set(key, list.slice(-120));
  }

  recordVerifiedBase(key, baseObj) {
    if (!key || !baseObj || !baseObj.reply) return;
    if (this.verifiedBaseReplies.size > 500) {
      const oldestKey = this.verifiedBaseReplies.keys().next().value;
      if (oldestKey) this.verifiedBaseReplies.delete(oldestKey);
    }
    if (!this.verifiedBaseReplies.has(key)) {
      this.verifiedBaseReplies.set(key, baseObj);
    }
  }

  /**
   * Rate Limiter chống spam và lạm dụng tài nguyên
   */
  checkRateLimit(ip) {
    // Whitelist loopback và kiểm thử nội bộ localhost
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost') {
      return true;
    }
    const now = Date.now();
    let record = this.rateLimitMap.get(ip);
    if (!record || now > record.resetTime) {
      if (!this.rateLimitMap.has(ip) && this.rateLimitMap.size >= 10000) {
        const oldestIp = this.rateLimitMap.keys().next().value;
        if (oldestIp) this.rateLimitMap.delete(oldestIp);
      }
      record = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
      this.rateLimitMap.set(ip, record);
      return true;
    }
    record.count++;
    if (record.count > MAX_REQUESTS_PER_WINDOW) {
      return false;
    }
    return true;
  }

  async callGroq(question, systemPrompt, conversationHistory = [], options = {}) {
    if (!GROQ_API_KEY) return null;

    // Giữ tối đa 4 lượt hội thoại gần nhất (user <= 220, assistant <= 340 ký tự) để nối mạch đối thoại sâu mà vẫn tiết kiệm TPM
    const compactHistory = (conversationHistory || []).slice(-4).map(m => ({
      role: m.role,
      content: String(m.content || '').slice(0, m.role === 'assistant' ? 340 : 220)
    }));
    const messages = [
      { role: 'system', content: systemPrompt },
      ...compactHistory,
      { role: 'user', content: question }
    ];

    const res = await groqPool.callGroqChat({
      apiKey: GROQ_API_KEY,
      messages,
      mode: 'reasoning',
      preferredModels: GROQ_MODEL_POOL,
      temperature: typeof options.temperature === 'number' ? options.temperature : 0.72,
      top_p: typeof options.top_p === 'number' ? options.top_p : 0.92,
      max_tokens: options.max_tokens || 320,
      presence_penalty: typeof options.presence_penalty === 'number' ? options.presence_penalty : 0.2,
      frequency_penalty: typeof options.frequency_penalty === 'number' ? options.frequency_penalty : 0.15,
      timeoutMs: Number(process.env.GROQ_TIMEOUT_MS) || 3500,
      onAttempt: () => {
        this.stats.groqCalls++;
      },
      onRateLimit: (model, waitMs) => {
        this.modelCooldowns.set(model, Date.now() + waitMs);
        this.stats.groqRateLimitSkips++;
      },
      onUsage: (usage) => {
        responseCache.trackLLMUsage(usage.prompt_tokens || 150, usage.completion_tokens || 80);
      }
    });
    return res ? res.content : null;
  }

  // Biến tấu tự nhiên cục bộ (0 token) làm lớp dự phòng cuối cùng nếu cả 3 model Groq đều bị bấm dồn chạm trần cùng lúc
  applyLocalNaturalVariation(baseReply, previousPhrasings = [], language = 'vi') {
    if (!baseReply) return baseReply;
    const viOpeners = [
      'Dạ mình xin chia sẻ thêm với bạn nhé: ',
      'Để mình tóm tắt lại cho bạn dễ nhớ: ',
      'Theo tư liệu di tích thì ',
      'Dạ nói một cách gần gũi thì ',
      'Thông tin chính xác mình gửi tới bạn là: ',
      'Về điểm này, mình xin thông tin thêm: '
    ];
    const enOpeners = [
      'To put it simply, ',
      'Here is what our archive notes: ',
      'Just to share clearly: ',
      'For your visit, ',
      'In brief, '
    ];
    const openers = language === 'en' ? enOpeners : (language === 'vi' ? viOpeners : []);
    if (!openers.length) return baseReply;
    const stripped = baseReply.replace(/^(Dạ\s+chào\s+bạn,\s*|Dạ,\s*|Chào\s+bạn,\s*)/i, '');
    const lowerFirst = stripped.charAt(0).toLowerCase() + stripped.slice(1);
    const idx = previousPhrasings.length % openers.length;
    const prefix = openers[idx];
    return prefix.endsWith(': ') ? `${prefix}${stripped}` : `${prefix}${lowerFirst}`;
  }

  /**
   * Tự nhiên hóa cách diễn đạt như thuyết minh viên người thật (siêu tiết kiệm token ~220 tokens/lượt!)
   * Giữ chính xác 100% ngày tháng, số liệu, giá vé, tên nhân vật lịch sử — chỉ thay đổi cách nói tự nhiên & phong phú.
   */
  async naturalizeHumanVoiceReply(baseReply, question, previousPhrasings = [], language = 'vi') {
    if (!baseReply) return baseReply;
    if (!GROQ_API_KEY) return baseReply;
    const langNames = {
      vi: 'Vietnamese', en: 'English', fr: 'French', ja: 'Japanese', ko: 'Korean', zh: 'Simplified Chinese'
    };
    const targetLangName = langNames[language] || 'Vietnamese';
    const styles = ['poised senior museum docent', 'clear and dignified narrator', 'evocative historical storyteller', 'warm cultured guide'];
    const style = styles[previousPhrasings.length % styles.length];
    const lastOpens = previousPhrasings.slice(-2).map(p => `"${p.slice(0, 65)}..."`).join(' | ');
    const avoidLine = lastOpens ? `Do NOT start like: ${lastOpens}.` : '';
    const glossaryHint = getGlossaryPromptHint(language);
    const glossaryLine = glossaryHint ? ` ${glossaryHint}` : '';
    const registerLine = getNativeRegisterInstruction(language);

    const sysPrompt = `Rewrite the verified museum answer below in the voice of a ${style}, STRICTLY in ${targetLangName} ONLY.${glossaryLine} ${registerLine} Keep EVERY date, number, price, name, and fact 100% accurate. Use 2-3 plain natural spoken sentences, no markdown, no bullets. ${avoidLine}`;

    const varied = await this.callGroq(
      `Q: ${question}\nFACT: ${baseReply}`,
      sysPrompt,
      [],
      { temperature: 0.78, top_p: 0.92, presence_penalty: 0.45, frequency_penalty: 0.35, max_tokens: 240 }
    );
    if (!varied || varied.length < 12) {
      return this.applyLocalNaturalVariation(baseReply, previousPhrasings, language);
    }
    const cleaned = varied.replace(/\*\*/g, '').replace(/^[-•*]\s+/gm, '').replace(/\s+/g, ' ').trim();
    return postPolishForeignTerms(cleaned, language);
  }

  /**
   * Xử lý câu hỏi của khách tham quan theo kiến trúc 8 tầng V6.1
   */
  async handleAsk(body) {
    const rawQ = String(body?.question || '').trim();
    const sessKey = String(body?.sessionId || 'anon');
    const langKey = String(body?.language || body?.lang || '').toLowerCase().trim();
    const stCode = String(body?.artifactContext?.code || '');
    const inflightKey = rawQ ? `${sessKey}|${langKey}|${stCode}|${rawQ.toLowerCase()}` : null;

    if (inflightKey && this.inFlightAsks.has(inflightKey)) {
      return this.inFlightAsks.get(inflightKey);
    }

    const runPromise = this._executeHandleAsk(body).finally(() => {
      if (inflightKey) this.inFlightAsks.delete(inflightKey);
    });
    if (inflightKey) {
      this.inFlightAsks.set(inflightKey, runPromise);
    }
    return runPromise;
  }

  async _executeHandleAsk(body) {
    const startTime = Date.now();
    this.stats.totalRequests++;

    const rawQuestion = (body.question || '').trim();
    if (!rawQuestion) {
      return { success: false, error: 'Câu hỏi không được để trống' };
    }
    if (rawQuestion.length > 500) {
      return { success: false, error: 'Câu hỏi vượt quá giới hạn cho phép (tối đa 500 ký tự)' };
    }

    // TẦNG 1: INPUT PROCESSING & USER PROFILE SIGNALS
    const sessionId = body.sessionId || null;
    const session = sessionManager.getOrCreateSession(sessionId);
    const cleaned = nlp.cleanRawText(rawQuestion);
    const requestedLang = (body.language || body.lang || '').toLowerCase().trim();
    const detectedLanguage = nlp.detectLanguage(cleaned);
    // Nếu có ngôn ngữ khóa cứng (en/vi/fr/ja/ko/zh), dùng đúng ngôn ngữ đó thay vì auto-detect
    const language = ['vi', 'en', 'fr', 'ja', 'ko', 'zh'].includes(requestedLang) ? requestedLang : detectedLanguage;
    const standardized = nlp.standardizeTypos(cleaned);
    const userProfileSignals = nlp.extractUserProfileSignals(cleaned);

    // Bóc tách meta-prompt wrapper (Unwrap Meta Query)
    const unwrap = nlp.unwrapMetaQuery(standardized);
    const coreQuery = unwrap.coreQuery;

    // Tối ưu Voice-first: làm sạch từ đệm, thán từ nói chuyện đời thường
    const voiceCleaned = nlp.cleanVoiceSpokenInput(coreQuery);

    // Kiểm tra nhanh các nhóm độc lập (Nhiễu, Chào hỏi, Cảm ơn, Tạm biệt, Ngoài lề rõ ràng, Injection, Khẩn cấp)
    // TRƯỚC KHI giải mã Follow-up để không bị dính chủ đề cũ vào câu ngoài lề / nhiễu / chào hỏi!
    // Ngoại lệ: OOD_UNMATCHED_DOMAIN (câu ngắn thiếu thực thể như "Kể tiếp đi", "Còn gì nữa không?") vẫn được phép kiểm tra follow-up nếu phiên đang có ngữ cảnh hợp lệ!
    const preClass = classifier.classify(voiceCleaned, null);
    const bypassFollowUpIntents = new Set([
      INTENTS.PROMPT_INJECTION,
      INTENTS.EMERGENCY_SUPPORT,
      INTENTS.GREETING,
      INTENTS.THANK_YOU,
      INTENTS.GOODBYE,
      INTENTS.CHITCHAT_BOT
    ]);
    const isHardOutOfScope = preClass.intent === INTENTS.OUT_OF_SCOPE && preClass.subIntent !== 'OOD_UNMATCHED_DOMAIN';
    const isNoiseClarification = preClass.intent === INTENTS.CLARIFICATION && preClass.subIntent === 'EXTREME_NOISE_OR_FILLER';

    // Xử lý câu hỏi tiếp nối & Chuyển hướng chủ đề (Pronoun Resolution & Topic Shift)
    const followUp = (bypassFollowUpIntents.has(preClass.intent) || isHardOutOfScope || isNoiseClarification)
      ? { isFollowUp: false, isContinuation: false, resolvedQuery: voiceCleaned, topic: null, isComparisonExpansion: false }
      : nlp.resolveFollowUp(voiceCleaned, session.lastContext);
    const activeQuery = followUp.resolvedQuery || voiceCleaned;

    // TẦNG 2: SEMANTIC INTENT UNDERSTANDING (4-Dimensional Analysis + Neural Prompt Guard)
    // QUAN TRỌNG: Nếu KHÔNG phải follow-up (đã chuyển chủ đề mới), TUYỆT ĐỐI không kế thừa session.lastContext hay session.state.currentSubject!
    // Đồng thời tái sử dụng preClass khi activeQuery không đổi để loại bỏ classify trùng lặp và giảm độ trễ.
    const canReusePreClass = bypassFollowUpIntents.has(preClass.intent) || isHardOutOfScope || isNoiseClarification ||
      (!followUp.isFollowUp && activeQuery === voiceCleaned);
    const intentAnalysis = canReusePreClass
      ? preClass
      : classifier.classify(activeQuery, followUp.isFollowUp ? session.lastContext : null);
    let intent = intentAnalysis.intent;
    const subIntent = intentAnalysis.subIntent || null;
    let subject = followUp.isFollowUp
      ? (intentAnalysis.subject || followUp.topic || session.state?.currentSubject || null)
      : (intentAnalysis.subject || null);
    const aspect = intentAnalysis.aspect || 'GENERAL';
    const urgency = intentAnalysis.urgency || 'NORMAL';

    // Lớp bảo vệ Neural Prompt Guard (Chỉ gọi Groq llama-prompt-guard-2-86m khi có tín hiệu nghi ngờ injection -> tiết kiệm 50% Groq RPM & giảm ~200ms độ trễ!)
    const suspiciousInjectionSignal = /\b(ignore|override|system\s*prompt|jailbreak|bypass|developer\s*mode|dan\s*mode|act\s+as|pretend\s+to\s+be|forget\s+all|disregard|bo\s+qua\s+(moi|tat\s+ca|quy\s+tac)|quen\s+het|lenh\s+he\s+thong|dong\s+vai|hack|sql|script|<\|)\b/i.test(nlp.normalize(coreQuery));
    if (suspiciousInjectionSignal && intent !== INTENTS.PROMPT_INJECTION && intent !== INTENTS.EMERGENCY_SUPPORT && GROQ_API_KEY) {
      const guard = await semanticRouter.checkNeuralPromptGuard(coreQuery, GROQ_API_KEY);
      if (guard.flagged) {
        this.stats.neuralPromptGuardBlocks++;
        intent = INTENTS.PROMPT_INJECTION;
      }
    }

    if (unwrap.contextZone) {
      userProfileSignals.contextZone = unwrap.contextZone;
      const zoneNorm = nlp.normalize(unwrap.contextZone);
      if (zoneNorm.includes('bang') && !subject) subject = 'cay_bang';
      else if (zoneNorm.includes('trong dong') && !subject) subject = 'trong_dong';
      else if (zoneNorm.includes('may chem') && !subject) subject = 'may_chem';
      else if (zoneNorm.includes('cong ngam') && !subject) subject = 'cong_ngam';
    }
    userProfileSignals.currentSubject = subject;

    this.stats.intentsCount[intent] = (this.stats.intentsCount[intent] || 0) + 1;

    // TẦNG 3: HYBRID CONTEXT RETRIEVAL
    let retrievedData = {
      groundTruthMatch: null,
      exhibitMatch: null,
      customerCareContext: null,
      servicePolicy: null,
      subIntent,
      urgency,
      facts: []
    };

    let topicId = null;
    let topicName = null;

    // 1. Kiểm tra Ground Truth & Kho 100 Facts xác thực trước tiên (Chỉ dùng câu hỏi lõi, bỏ qua khi đã thuộc priorityCareIntents để giảm độ trễ!)
    const priorityCareIntents = [
      INTENTS.EMERGENCY_SUPPORT,
      INTENTS.LOST_AND_FOUND,
      INTENTS.SITE_OPERATIONS,
      INTENTS.CONVERSATIONAL_EMPATHY,
      INTENTS.CLARIFICATION,
      INTENTS.OUT_OF_SCOPE,
      INTENTS.PROMPT_INJECTION,
      INTENTS.CUSTOMER_COMPLAINT,
      INTENTS.CUSTOMER_ASSISTANCE,
      INTENTS.ACCESSIBILITY_SUPPORT,
      INTENTS.THANK_YOU,
      INTENTS.GOODBYE,
      INTENTS.CHITCHAT_BOT,
      INTENTS.JOKE_REQUEST,
      INTENTS.HIGHLIGHTS_REQUEST,
      INTENTS.PARKING_SUPPORT,
      INTENTS.PHOTOGRAPHY_POLICY,
      INTENTS.DINING_VICINITY,
      INTENTS.FACILITY_INFORMATION,
      INTENTS.TOUR_RECOMMENDATION,
      INTENTS.VISIT_GUIDANCE,
      INTENTS.TIME_FEASIBILITY,
      INTENTS.WEATHER_ADVISORY,
      INTENTS.SUMMARY_REQUEST,
      INTENTS.VICINITY_DISTANCE
    ];
    let gt = null;
    if (!priorityCareIntents.includes(intentAnalysis.intent) && !followUp.isFollowUp && subIntent !== 'LOCATION_ORIENTATION') {
      const gtCandidates = [...new Set([activeQuery, coreQuery, voiceCleaned].filter(Boolean))];
      for (const cand of gtCandidates) {
        gt = knowledgeBase.findGroundTruthMatch(cand);
        if (gt) break;
      }
    }

    if (gt) {
      retrievedData.groundTruthMatch = gt;
      retrievedData.facts.push(gt.item.premium_answer || gt.item.expected_answer || gt.item.reference_answer || gt.item.verified_answer);
      topicId = gt.item.question_id || gt.item.id;
      topicName = (subject && HISTORICAL_EXHIBITS[subject] ? HISTORICAL_EXHIBITS[subject].name : null) || gt.item.artifact || gt.item.area || gt.item.category || 'Di tích Hỏa Lò';
      
      // Gán intent tinh gọn từ 100 Facts hoặc Intent Classifier thay vì đè thành HISTORICAL_FACT
      if (gt.type === 'EXACT' && gt.item.expected_intent) {
        intent = gt.item.expected_intent;
      } else if (!intentAnalysis.isSafetyOrSecurity && intent !== INTENTS.EXPIRED_POLICY && intent !== INTENTS.OUT_OF_SCOPE) {
        intent = intentAnalysis.intent || INTENTS.HISTORICAL_FACT;
      }
    }

    // 2. Tra cứu Chính sách Dịch vụ Đã Xác Thực (SSOT)
    const policyResult = knowledgeBase.findServicePolicy(activeQuery, intent);
    if (policyResult) {
      retrievedData.servicePolicy = policyResult;
      retrievedData.facts.push(policyResult.policy.content);
      if (!topicId) topicId = policyResult.policy.id;
      if (!topicName) topicName = policyResult.policy.title;
    }

    if (
      intent === INTENTS.HISTORICAL_FACT ||
      intent === INTENTS.EXHIBIT_INFORMATION ||
      intent === INTENTS.EXHIBITION_INFORMATION ||
      intent === INTENTS.HISTORICAL_EXPLANATION ||
      intent === INTENTS.TOUR_INFORMATION ||
      intent === INTENTS.CONTACT_INFORMATION ||
      intent === INTENTS.VISIT_GUIDANCE
    ) {
      // 3. Tìm trong 13 hồ sơ phân khu
      const exhibit = knowledgeBase.findHistoricalExhibit(activeQuery);
      if (exhibit) {
        retrievedData.exhibitMatch = exhibit;
        retrievedData.facts.push(...exhibit.exhibit.facts);
        if (!topicId) topicId = exhibit.exhibit.id;
        if (!topicName) topicName = exhibit.exhibit.name;
      }
      // Bổ sung ngữ cảnh dịch vụ nếu là TOUR_INFORMATION / VISIT_GUIDANCE
      if (intent === INTENTS.TOUR_INFORMATION || intent === INTENTS.VISIT_GUIDANCE) {
        const ccTour = knowledgeBase.getCustomerCareContext(INTENTS.TOUR_RECOMMENDATION);
        if (ccTour) {
          retrievedData.customerCareContext = ccTour;
          retrievedData.facts.push(...ccTour.facts);
        }
      }
    } else {
      const cc = knowledgeBase.getCustomerCareContext(intent);
      if (cc) {
        retrievedData.customerCareContext = cc;
        retrievedData.facts.push(...cc.facts);
        if (!topicId) topicId = intent;
        if (!topicName) topicName = cc.title;
      }
    }

    // TẦNG 4: LOCAL COMPOSITIONAL VARIATION CHO CÂU HỎI LẶP LẠI (0 TOKEN GROQ • ~2ms • 100/100 KHÁC NHAU!)
    // - Lần 1: Lấy dữ liệu xác thực từ Data local (hoặc Groq RAG nếu câu hỏi hoàn toàn mới) và lưu làm gốc.
    // - Lần 2 → Lần 100: Tự động lắp ghép từ dữ liệu gốc + câu tư liệu cùng chủ đề + đồng nghĩa an toàn + từ nối tự nhiên
    //   ngay tại Local RAM (KHÔNG tốn 1 token Groq nào, KHÔNG bao giờ 429, mỗi lần nói 1 kiểu tự nhiên như người thật!).
    const artifactContext = body.artifactContext || null;
    const stationCodeKey = artifactContext?.code ? `@${artifactContext.code}` : '';
    const phrasingKey = `${nlp.normalize(coreQuery)}|${language}${stationCodeKey}`;
    const previousPhrasings = this.getRecentPhrasings(phrasingKey);
    const savedBase = this.verifiedBaseReplies.get(phrasingKey);

    const isSensitiveIntent = [
      INTENTS.OUT_OF_SCOPE,
      INTENTS.WEATHER_ADVISORY,
      INTENTS.CHITCHAT_BOT,
      INTENTS.GREETING,
      INTENTS.GOODBYE,
      INTENTS.THANK_YOU,
      INTENTS.TICKET_INFORMATION,
      INTENTS.OPENING_HOURS,
      INTENTS.PARKING_SUPPORT,
      INTENTS.PHOTOGRAPHY_POLICY,
      INTENTS.ACCESSIBILITY_SUPPORT,
      INTENTS.JOKE_REQUEST,
      INTENTS.EMERGENCY_SUPPORT,
      INTENTS.EXPIRED_POLICY,
      INTENTS.DINING_VICINITY,
      INTENTS.VICINITY_DISTANCE,
      INTENTS.SUMMARY_REQUEST,
      INTENTS.TIME_FEASIBILITY
    ].includes(intent);

    const canReuseSavedLocal = (language === 'vi' || language === 'en') || groqPool.areAllCoolingDown(GROQ_MODEL_POOL);
    if (savedBase && previousPhrasings.length > 0 && !followUp.isFollowUp && canReuseSavedLocal && !isSensitiveIntent) {
      const assembledReply = (language === 'vi' || language === 'en')
        ? composeLocalHumanVariation({
            baseReply: savedBase.reply,
            extraFacts: savedBase.extraFacts || [],
            previousPhrasings,
            language,
            intent: savedBase.intent || intent,
            turnNumber: previousPhrasings.length + 1
          })
        : savedBase.reply;
      this.recordPhrasing(phrasingKey, assembledReply);

      const resolvedTopicName = (subject && HISTORICAL_EXHIBITS[subject] ? HISTORICAL_EXHIBITS[subject].name : null) || topicName || 'Di tích Hỏa Lò';
      const resolvedTopicId = subject || topicId;
      sessionManager.updateSession(session.id, rawQuestion, assembledReply, {
        topic: resolvedTopicId,
        topicName: resolvedTopicName,
        intent: savedBase.intent || intent,
        subIntent,
        aspect,
        userProfileSignals
      });

      const latencyMs = Date.now() - startTime;
      this.stats.totalLatencyMs += latencyMs;
      responseCache.recordLatency(latencyMs);

      return {
        success: true,
        data: {
          reply: assembledReply,
          intent: savedBase.intent || intent,
          subIntent,
          subject,
          aspect,
          urgency,
          style: 'CONVERSATIONAL_HUMAN_LOCAL',
          confidence: 'HIGH',
          confidenceScore: 0.96,
          requestTier: 'LOCAL_COMPOSITIONAL_NLG',
          sources: savedBase.sources || ['Local Compositional Voice Engine (0 Groq Tokens)'],
          claims: ['Lắp ghép tự nhiên từ dữ liệu xác thực cục bộ'],
          wasCorrected: false,
          requiresHuman: false,
          responseType: 'LOCAL_HUMAN_VARIATION',
          language,
          isFollowUp: false,
          sessionId: session.id,
          latencyMs,
          provider: '2Guide Local Compositional Voice Engine v7.6'
        }
      };
    }

    // TẦNG 4.2 (PHƯƠNG PHÁP 1 + 2): TRA CỨU KHO TỰ HỌC BỀN VỮNG THEO Ý NGHĨA NGỮ NGHĨA (LOCAL SEMANTIC SEARCH • 0 GROQ!)
    // Khi người hôm trước đã hỏi 1 câu mới và hệ thống tự học vào data/auto_learned_knowledge.json,
    // người hôm sau hỏi KHÁC CHỮ NHƯNG CÙNG Ý NGHĨA -> bắt trúng trong ~2ms, 0 gọi Groq, tự ghép câu tự nhiên!
    const skipAutoLearnedIntents = new Set([
      INTENTS.PROMPT_INJECTION,
      INTENTS.EMERGENCY_SUPPORT,
      INTENTS.EXPIRED_POLICY,
      INTENTS.GREETING,
      INTENTS.THANK_YOU,
      INTENTS.GOODBYE
    ]);
    if (!followUp.isFollowUp && !skipAutoLearnedIntents.has(intent) && subIntent !== 'STRICT_OUT_OF_DOMAIN') {
      const learnedHit = autoLearningStore.findSemanticLearnedMatch(coreQuery, {
        language,
        stationCode: artifactContext?.code || null,
        minScore: 0.78
      });
      if (learnedHit && learnedHit.record?.answer) {
        const baseAns = learnedHit.record.answer;
        const alreadySaid = previousPhrasings.length > 0;
        const spokenAns = (alreadySaid && (language === 'vi' || language === 'en'))
          ? composeLocalHumanVariation({
              baseReply: baseAns,
              extraFacts: learnedHit.record.extraFacts || [],
              previousPhrasings,
              language,
              intent: learnedHit.record.intent || intent,
              turnNumber: previousPhrasings.length + 1
            })
          : baseAns;

        this.recordVerifiedBase(phrasingKey, {
          reply: baseAns,
          extraFacts: learnedHit.record.extraFacts || [],
          intent: learnedHit.record.intent || intent,
          sources: [`AUTO_LEARNED_SEMANTIC_${learnedHit.record.id} (sim=${learnedHit.score})`]
        });
        this.recordPhrasing(phrasingKey, spokenAns);

        const resolvedTopicName = (subject && HISTORICAL_EXHIBITS[subject] ? HISTORICAL_EXHIBITS[subject].name : null) || topicName || 'Di tích Hỏa Lò';
        sessionManager.updateSession(session.id, rawQuestion, spokenAns, {
          topic: subject || topicId,
          topicName: resolvedTopicName,
          intent: learnedHit.record.intent || intent,
          subIntent,
          aspect,
          userProfileSignals
        });

        const latencyMs = Date.now() - startTime;
        this.stats.totalLatencyMs += latencyMs;
        responseCache.recordLatency(latencyMs);

        return {
          success: true,
          data: {
            reply: spokenAns,
            intent: learnedHit.record.intent || intent,
            subIntent,
            subject,
            aspect,
            urgency,
            style: 'LOCAL_SEMANTIC_AUTO_LEARNED',
            confidence: 'HIGH',
            confidenceScore: Math.min(0.97, learnedHit.score + 0.1),
            requestTier: 'AUTO_LEARNED_LOCAL_SEMANTIC',
            sources: [`Kho Tự Học Ngữ Nghĩa Cục Bộ (${learnedHit.record.id} • sim=${learnedHit.score})`],
            claims: ['Truy xuất theo ý nghĩa ngữ nghĩa từ kho tri thức tự học cục bộ (0 Groq)'],
            wasCorrected: false,
            requiresHuman: false,
            responseType: 'AUTO_LEARNED_SEMANTIC_HIT',
            language,
            isFollowUp: false,
            sessionId: session.id,
            latencyMs,
            provider: '2Guide Local Semantic & Auto-Learning Engine v8.0'
          }
        };
      }
    }

    const cachedItem = !GROQ_API_KEY
      ? responseCache.get({
          query: rawQuestion + stationCodeKey,
          subject: subject || '',
          aspect,
          language,
          intent
        })
      : null;

    if (cachedItem && !followUp.isFollowUp && previousPhrasings.length === 0) {
      const resolvedTopicName = (subject && HISTORICAL_EXHIBITS[subject] ? HISTORICAL_EXHIBITS[subject].name : null) || topicName || 'Di tích Hỏa Lò';
      const resolvedTopicId = subject || topicId;
      sessionManager.updateSession(session.id, rawQuestion, cachedItem.reply, {
        topic: resolvedTopicId,
        topicName: resolvedTopicName,
        intent: cachedItem.intent || intent,
        subIntent: cachedItem.subIntent || subIntent,
        aspect: cachedItem.aspect || aspect,
        userProfileSignals
      });
      const latencyMs = Date.now() - startTime;
      this.stats.totalLatencyMs += latencyMs;
      responseCache.recordLatency(latencyMs);

      return {
        success: true,
        data: {
          ...cachedItem,
          sessionId: session.id,
          latencyMs,
          isCached: true
        }
      };
    }

    // TẦNG 5: ANSWER GENERATION (Adaptive Answer Composer V2 + Universal Grounded RAG + Human Natural Variation)
    const composerResult = await composer.compose({
      question: activeQuery,
      intent,
      subIntent,
      urgency,
      subject,
      aspect,
      retrievedData,
      language,
      session,
      userProfile: userProfileSignals,
      artifactContext,
      previousPhrasings,
      isFollowUp: followUp.isFollowUp,
      isContinuation: Boolean(followUp.isContinuation),
      groqCaller: (q, sysPrompt, hist, opts) => this.callGroq(q, sysPrompt, hist, opts)
    });

    let confidence = composerResult.confidence || 'HIGH';
    let confidenceScore = composerResult.confidenceScore || 0.95;
    let groundingStatus = 'GROUNDED';
    let ungroundedTokens = [];
    let validatorCorrected = Boolean(composerResult.wasCorrected);

    // TẦNG 6: REAL ANSWER VALIDATOR + AUTO-LEARNING 2.0 (STAGING ONLY!) + LOCAL VARIATION
    let finalReply = composerResult.reply;
    const isLlmOutput = composerResult.responseType === 'LLM_GROUNDED_SYNTHESIS' || composerResult.responseType === 'STORYTELLING_NARRATION';
    const baseFacts = Array.isArray(retrievedData?.facts) ? retrievedData.facts : [];
    const relatedExtraFacts = isSensitiveIntent ? [] : (
      isLlmOutput
        ? [
            ...baseFacts,
            ...((knowledgeBase.retrieveTopKContext(activeQuery, { subject, intent, artifactContext, topK: 4 })?.snippets) || [])
          ]
        : baseFacts
    );

    // 6.1. THẨM ĐỊNH THỰC SỰ ĐẦU RA LLM RAG BẰNG REAL ANSWER VALIDATOR (chống bịa đặt mốc năm/số liệu & mâu thuẫn!)
    if (isLlmOutput && finalReply) {
      const groundCheck = validator.verifyGroundingAgainstEvidence(finalReply, relatedExtraFacts, coreQuery);
      groundingStatus = groundCheck.groundingStatus;
      ungroundedTokens = groundCheck.ungroundedTokens;
      if (groundCheck.wasCorrected) {
        finalReply = groundCheck.reply;
        validatorCorrected = true;
      }
      if (groundCheck.calibratedScore < confidenceScore) {
        confidenceScore = groundCheck.calibratedScore;
        confidence = confidenceScore >= 0.85 ? 'HIGH' : (confidenceScore >= 0.65 ? 'MEDIUM' : 'LOW');
      }
    }

    // 6.2. Bổ sung thông tin ý định phụ nếu khách hỏi ĐA Ý ĐỊNH dịch vụ trong 1 câu (VD: "Giá vé và giờ mở cửa?")
    // Không bao giờ ghép chính sách phụ vào câu từ chối ngoài lề, bảo mật nội quy (SITE_OPERATIONS), khẩn cấp, khiếu nại hay đồng cảm!
    const secondaryIntents = intentAnalysis.secondaryIntents || [];
    const allowSecondaryAppend = [
      INTENTS.TICKET_INFORMATION, INTENTS.OPENING_HOURS, INTENTS.FACILITY_INFORMATION,
      INTENTS.PARKING_SUPPORT, INTENTS.PHOTOGRAPHY_POLICY, INTENTS.TOUR_INFORMATION,
      INTENTS.AUDIO_GUIDE_SUPPORT, INTENTS.CONTACT_INFORMATION
    ].includes(intent);
    if (secondaryIntents.length > 0 && finalReply && !isLlmOutput && allowSecondaryAppend) {
      const secIntent = secondaryIntents[0];
      const secPolicy = knowledgeBase.findServicePolicy(coreQuery, secIntent, { strictIntent: true });
      if (secPolicy?.policy?.content) {
        const firstSecSent = secPolicy.policy.content.split(/(?<=[.!?])\s+/)[0] || '';
        const secNorm = nlp.normalize(firstSecSent);
        if (firstSecSent.length >= 15 && !nlp.normalize(finalReply).includes(secNorm.slice(0, 28))) {
          finalReply = `${finalReply} ${firstSecSent}`.trim();
        }
      }
    }

    this.stats.confidenceCount[confidence] = (this.stats.confidenceCount[confidence] || 0) + 1;

    // 6.3. Lưu bản gốc vào bộ nhớ phiên + đẩy đề xuất vào HÀNG ĐỢI CHỜ DUYỆT Auto-Learning 2.0 (KHÔNG tự động xuất bản!)
    const resolvedFinalIntent = composerResult.resolvedIntent || intent;
    if (finalReply && resolvedFinalIntent !== INTENTS.OUT_OF_SCOPE && !isSensitiveIntent) {
      this.recordVerifiedBase(phrasingKey, {
        reply: finalReply,
        extraFacts: relatedExtraFacts,
        intent: resolvedFinalIntent,
        sources: composerResult.sources
      });
      if (isLlmOutput && groundingStatus !== 'UNGROUNDED') {
        autoLearningStore.propose({
          question: coreQuery,
          answer: finalReply,
          intent: resolvedFinalIntent,
          language,
          stationCode: artifactContext?.code || null,
          responseType: composerResult.responseType,
          sources: composerResult.sources || [],
          confidenceScore,
          groundingStatus,
          extraFacts: relatedExtraFacts
        });
      }
    }

    const isAlreadySpokenVerbatim = previousPhrasings.some(p => p.trim() === (finalReply || '').trim());
    if (finalReply && isAlreadySpokenVerbatim && !isSensitiveIntent) {
      if (language === 'vi' || language === 'en') {
        finalReply = composeLocalHumanVariation({
          baseReply: finalReply,
          extraFacts: relatedExtraFacts,
          previousPhrasings,
          language,
          intent: composerResult.resolvedIntent || intent,
          turnNumber: previousPhrasings.length + 1
        });
      } else if (GROQ_API_KEY && !groqPool.areAllCoolingDown(GROQ_MODEL_POOL)) {
        finalReply = await this.naturalizeHumanVoiceReply(finalReply, rawQuestion, previousPhrasings, language);
      }
    }
    this.recordPhrasing(phrasingKey, finalReply);
    const claims = composerResult.claims || [];
    const verifiedClaims = composerResult.verifiedClaims || [];

    // Xác định Request Tier
    const requestTier = responseCache.classifyTier({
      hasExactMatch: retrievedData.groundTruthMatch?.type === 'EXACT',
      isPolicy: !!policyResult,
      isFollowUp: followUp.isFollowUp,
      isCustomerCare: [
        'CUSTOMER_COMPLAINT', 'CUSTOMER_ASSISTANCE', 'ACCESSIBILITY_SUPPORT',
        'TICKET_INFORMATION', 'OPENING_HOURS', 'FACILITY_SUPPORT'
      ].includes(intent),
      isClarification: intent === INTENTS.AMBIGUOUS_QUERY,
      isLLMGenerated: composerResult.responseType === 'LLM_GROUNDED_SYNTHESIS'
    });

    // TẦNG 7: STRUCTURED CONVERSATION STATE & SESSION PERSISTENCE
    // Chặn vòng lặp tự nhiễm: đáp án ngoài phạm vi / thiếu căn cứ / độ tin cậy thấp / từ chối / báo thiếu dữ liệu KHÔNG ghi vào bộ nhớ ngữ cảnh!
    const finalIntentForSession = composerResult.resolvedIntent || intent;
    const nonContextResponseTypes = new Set([
      'ARCHIVE_KNOWLEDGE_GAP',
      'STRICT_OUT_OF_SCOPE_REFUSAL',
      'OUT_OF_SCOPE_HANDLED',
      'DOCENT_GRACEFUL_OUT_OF_SCOPE',
      'SECURITY_BOUNDARY_ENFORCED',
      'CLARIFICATION_PROMPT',
      'CLARIFICATION_NEEDED',
      'NOISE_PUNCTUATION',
      'NOISE_GIBBERISH',
      'FALSE_PREMISE_CORRECTION',
      'AUTHENTIC_ABSTENTION'
    ]);
    const shouldSkipContextUpdate = Boolean(
      finalIntentForSession === INTENTS.OUT_OF_SCOPE ||
      finalIntentForSession === INTENTS.PROMPT_INJECTION ||
      finalIntentForSession === INTENTS.CLARIFICATION ||
      finalIntentForSession === INTENTS.AMBIGUOUS_QUERY ||
      groundingStatus === 'UNGROUNDED' ||
      confidence === 'LOW' ||
      confidenceScore < 0.65 ||
      nonContextResponseTypes.has(composerResult.responseType)
    );

    const mentionedEntities = [];
    const combinedNorm = ' ' + nlp.normalize(`${rawQuestion} ${finalReply || ''}`) + ' ';
    const trackableEntities = [
      ['tran_tu_binh', 'Trần Tử Bình', 'tran tu binh'],
      ['hoang_van_thu', 'Hoàng Văn Thụ', 'hoang van thu'],
      ['nguyen_thai_hoc', 'Nguyễn Thái Học', 'nguyen thai hoc'],
      ['nguyen_duc_canh', 'Nguyễn Đức Cảnh', 'nguyen duc canh'],
      ['nguyen_hoang_ton', 'Nguyễn Hoàng Tôn', 'nguyen hoang ton'],
      ['john_mccain', 'John McCain', 'mccain'],
      ['cay_bang', 'Cây bàng lịch sử', 'cay bang'],
      ['may_chem', 'Máy chém', 'may chem'],
      ['cachot', 'Ngục tối Cachot', 'cachot'],
      ['cong_ngam', 'Đường cống ngầm vượt ngục', 'cong ngam'],
      ['vuot_nguc_1945', 'Vượt ngục tháng 3/1945', 'vuot nguc'],
      ['hien_vat_sinh_hoat', 'Báo chí bí mật trong tù', 'bao bi mat']
    ];
    for (const [eId, eName, eKey] of trackableEntities) {
      if (combinedNorm.includes(' ' + eKey + ' ')) {
        mentionedEntities.push({ id: eId, name: eName });
      }
    }

    const resolvedTopicName = (subject && HISTORICAL_EXHIBITS[subject] ? HISTORICAL_EXHIBITS[subject].name : null) ||
      (mentionedEntities[0]?.name) || topicName || 'Di tích Hỏa Lò';
    const resolvedTopicId = subject || mentionedEntities[0]?.id || topicId;
    sessionManager.updateSession(session.id, rawQuestion, finalReply, {
      topic: resolvedTopicId,
      topicName: resolvedTopicName,
      intent: finalIntentForSession,
      subIntent: subIntent,
      aspect: aspect,
      userProfileSignals,
      mentionedEntities,
      skipContextUpdate: shouldSkipContextUpdate
    });

    const latencyMs = Date.now() - startTime;
    this.stats.totalLatencyMs += latencyMs;
    responseCache.recordLatency(latencyMs);

    // TẦNG 8: FINAL RESPONSE (Đầy đủ Metadata V6.1)
    const finalIntent = composerResult.resolvedIntent || intent;
    const responseData = {
      reply: finalReply,
      intent: finalIntent,
      secondaryIntents: secondaryIntents,
      audience: intentAnalysis.audience || 'general',
      routeReason: intentAnalysis.routeReason || `Classified as ${finalIntent}`,
      subIntent: subIntent,
      subject: subject,
      aspect: aspect,
      urgency: urgency,
      style: composerResult.style || 'CUSTOMER_CARE',
      confidence: confidence,
      confidenceScore: confidenceScore,
      groundingStatus: groundingStatus,
      ungroundedTokens: ungroundedTokens,
      requestTier: requestTier,
      sources: composerResult.sources || (policyResult ? [policyResult.policy.source] : ['Ban Quản Lý Di Tích Nhà Tù Hỏa Lò']),
      claims: claims.slice(0, 4),
      verifiedClaims: verifiedClaims.slice(0, 4),
      wasCorrected: validatorCorrected,
      policy: policyResult ? {
        id: policyResult.policy.id,
        title: policyResult.policy.title,
        officialSource: policyResult.policy.official_source,
        sourceUrl: policyResult.policy.source_url,
        status: policyResult.policy.status,
        isExpired: policyResult.isExpired || false,
        responsibleDepartment: policyResult.policy.responsible_department,
        authority: policyResult.policy.authority_boundary
      } : null,
      requiresHuman: composerResult.requiresHuman || false,
      responseType: composerResult.responseType || 'DIRECT_ANSWER',
      language: language,
      isFollowUp: followUp.isFollowUp,
      resolvedQuery: followUp.isFollowUp ? activeQuery : undefined,
      sessionId: session.id,
      latencyMs: latencyMs,
      provider: '2Guide Production Conversational AI Engine v8.0'
    };

    // Lưu vào LRU Cache nếu đủ điều kiện
    responseCache.set({
      query: rawQuestion + stationCodeKey,
      subject: subject || '',
      aspect,
      language,
      intent
    }, responseData, {
      isFollowUp: followUp.isFollowUp,
      userProfile: userProfileSignals,
      intent,
      confidence
    });

    return {
      success: true,
      data: responseData
    };
  }
}

// Khởi tạo Server
const engine = new ProductionSmartTourGuideServer();

// Bật bộ tự động theo dõi thư mục thả file `kiemthu/data/custom/` (tự nạp lại nóng khi thêm/sửa/xóa file!)
if (typeof knowledgeBase.startCustomBrainWatcher === 'function') {
  knowledgeBase.startCustomBrainWatcher(() => {
    try {
      if (typeof responseCache.clear === 'function') responseCache.clear();
      engine.verifiedBaseReplies.clear();
    } catch {}
  });
}

const server = http.createServer(async (req, res) => {
  // 1. Configurable CORS Headers
  const reqOrigin = req.headers.origin || '';
  let allowOrigin = '*';
  if (!ALLOWED_ORIGINS.includes('*')) {
    allowOrigin = ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : (ALLOWED_ORIGINS[0] || '');
  }
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 2. Safe IP Detection with Trust Proxy Support
  const clientIp = TRUST_PROXY && req.headers['x-forwarded-for']
    ? req.headers['x-forwarded-for'].split(',')[0].trim()
    : req.socket.remoteAddress || '127.0.0.1';

  // 3. Rate Limiting Middleware
  if (!engine.checkRateLimit(clientIp)) {
    res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      success: false,
      error: 'Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau 1 phút.'
    }));
    return;
  }

  // 4. API Key Protection (Nếu cấu hình)
  if (API_KEY) {
    const authHeader = req.headers['authorization'] || '';
    const customKey = req.headers['x-api-key'] || '';
    const bearerKey = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    if (customKey !== API_KEY && bearerKey !== API_KEY) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: 'Xác thực không hợp lệ: API Key không đúng hoặc bị thiếu.' }));
      return;
    }
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Endpoint API Chat chính (/api/chat/ask)
  if (parsedUrl.pathname === '/api/chat/ask' && req.method === 'POST') {
    let bodyStr = '';
    let bodyBytes = 0;

    req.on('data', chunk => {
      bodyBytes += chunk.length;
      if (bodyBytes > MAX_PAYLOAD_BYTES) {
        if (!res.headersSent) {
          res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: 'Dung lượng yêu cầu vượt quá giới hạn tối đa cho phép (32KB).' }));
        }
        return;
      }
      bodyStr += chunk;
    });

    req.on('end', async () => {
      if (bodyBytes > MAX_PAYLOAD_BYTES) return;
      try {
        const body = bodyStr ? JSON.parse(bodyStr) : {};
        const result = await engine.handleAsk(body);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error('Lỗi server:', err);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.' }));
      }
    });
    return;
  }

  // Endpoint Giám sát hiệu năng & Thống kê Tiers (/stats)
  if (parsedUrl.pathname === '/stats' || parsedUrl.pathname === '/api/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    const avgLatency = engine.stats.totalRequests > 0
      ? (engine.stats.totalLatencyMs / engine.stats.totalRequests).toFixed(2)
      : 0;
    res.end(JSON.stringify({
      server: '2Guide Production Conversational AI Engine v8.0 (Production-Grade)',
      activeSessions: sessionManager.getSessionCount(),
      stats: {
        ...engine.stats,
        averageLatencyMs: Number(avgLatency)
      },
      cacheStats: responseCache.getStats(),
      uptimeSeconds: process.uptime()
    }));
    return;
  }

  // Endpoint Kiểm tra trạng thái máy chủ (/health)
  if (parsedUrl.pathname === '/health' || parsedUrl.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      status: 'UP',
      version: '8.0.0 (Production-Grade Conversational AI)',
      port: PORT,
      memoryUsage: process.memoryUsage(),
      activeSessions: sessionManager.getSessionCount()
    }));
    return;
  }

  // Tuyến đường mặc định 404
  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ success: false, error: 'Đường dẫn không tồn tại trên hệ thống 2Guide AI API.' }));
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log('\n======================================================');
    console.log('🎉 2GUIDE PRODUCTION CONVERSATIONAL AI v8.0 ĐÃ SẴN SÀNG!');
    console.log('======================================================');
    console.log(`🌐 Cổng dịch vụ:     http://localhost:${PORT}`);
    console.log(`🎯 API Chat:         http://localhost:${PORT}/api/chat/ask`);
    console.log(`📊 Giám sát & Stats: http://localhost:${PORT}/stats`);
    console.log('🧠 Kiến trúc:        8 Tầng (NLP ➡️ Intent ➡️ Hybrid KB ➡️ Cache ➡️ Composer ➡️ Validator)');
    console.log(`⚡ AI Nền tảng:      Groq Cloud LLM (${PRIMARY_MODEL}) + Heritage Precision Engine`);
    console.log('🛡️ Bảo mật:          Rate Limit (120 req/m) + Payload Limit (32KB) + CORS + Session Isolation');
    console.log('======================================================\n');
  });
}

module.exports = { engine, server };
