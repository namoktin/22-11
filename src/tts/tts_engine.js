/**
 * =========================================================================================
 * 🎙️ MULTILINGUAL SPEECH NORMALIZER & PLUGGABLE TTS ENGINE (ELEVENLABS + GOOGLE FALLBACK)
 * =========================================================================================
 * - Chuẩn hóa văn bản sang dạng ĐỌC TỰ NHIÊN trên cả 6 ngôn ngữ (VI / EN / FR / JA / KO / ZH):
 *   + Bảo toàn dấu ngắt câu CJK (。、，！？) để giọng Nhật/Trung/Hàn nghỉ nhịp tự nhiên.
 *   + Đọc chuẩn tiền tệ (VNĐ/VND), ngày tháng (17/6/1930), khung giờ (8:00-17:00), đơn vị (kg/m/m²/%).
 *   + Chuyển mũi tên lộ trình (➡️) sang từ nối bản ngữ đúng ngôn ngữ đang nói.
 * - Hỗ trợ cắm-là-chạy ElevenLabs API v1 (ưu tiên `eleven_flash_v2_5` độ trễ ~75ms hoặc `eleven_multilingual_v2`):
 *   + Hỗ trợ định dạng gốc `pcm_16000` (0ms giải mã FFmpeg, truyền thẳng ESP32 WAV 16kHz Mono!).
 *   + Tự động chuyển sang `mp3_44100_128` + FFmpeg RAM decode nếu gói ElevenLabs Free/Starter không mở PCM.
 *   + Tự động hạ cấp mượt sang Google TTS Keep-Alive khi chưa cấu hình API key hoặc khi chạm quota/lỗi mạng.
 * =========================================================================================
 */

const https = require('https');
const crypto = require('crypto');

const ELEVENLABS_HOST = 'api.elevenlabs.io';

// Cấu hình mặc định tối ưu cho hướng dẫn viên bảo tàng đa ngôn ngữ
const DEFAULT_ELEVENLABS_MODEL = 'eleven_flash_v2_5';
// Giọng Rachel / Sarah / Charlie / Alice (giọng premade đa ngôn ngữ chuẩn của ElevenLabs; có thể ghi đè qua ENV theo từng ngôn ngữ)
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah — trầm ấm, rõ chữ, đa ngôn ngữ tốt

const MONTH_NAMES = {
  en: ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  fr: ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
};

const SPOKEN_CONNECTORS = {
  vi: { arrow: ', tiếp theo tới ', perPerson: ' một người', perTicket: ' một vé', perTurn: ' một lượt', plus: ' cộng ', and: ' và ', percent: ' phần trăm', to: ' đến ' },
  en: { arrow: ', then ', perPerson: ' per person', perTicket: ' per ticket', perTurn: ' per visit', plus: ' plus ', and: ' and ', percent: ' percent', to: ' to ' },
  fr: { arrow: ', puis ', perPerson: ' par personne', perTicket: ' par billet', perTurn: ' par visite', plus: ' plus ', and: ' et ', percent: ' pour cent', to: ' à ' },
  ja: { arrow: '、続いて', perPerson: '（1名様あたり）', perTicket: '（1枚あたり）', perTurn: '（1回あたり）', plus: 'プラス', and: 'と', percent: 'パーセント', to: 'から' },
  ko: { arrow: ', 이어서 ', perPerson: ' 1인당', perTicket: ' 1매당', perTurn: ' 1회당', plus: ' 플러스 ', and: ' 및 ', percent: ' 퍼센트', to: '에서 ' },
  zh: { arrow: '，接着前往', perPerson: '每人', perTicket: '每张票', perTurn: '每次', plus: '加', and: '和', percent: '百分之', to: '至' }
};

function normalizeLang(lang) {
  const code = String(lang || 'vi').toLowerCase().trim().split(/[-_]/)[0];
  return SPOKEN_CONNECTORS[code] ? code : 'vi';
}

function formatSpokenDate(dayStr, monthStr, yearStr, lang) {
  const d = parseInt(dayStr, 10);
  const m = parseInt(monthStr, 10);
  const y = parseInt(yearStr, 10);
  if (isNaN(d) || isNaN(m) || isNaN(y) || m < 1 || m > 12 || d < 1 || d > 31) {
    return `${dayStr}/${monthStr}/${yearStr}`;
  }
  switch (lang) {
    case 'vi': return `ngày ${d} tháng ${m} năm ${y}`;
    case 'en': return `${MONTH_NAMES.en[m]} ${d}, ${y}`;
    case 'fr': return `${d === 1 ? '1er' : d} ${MONTH_NAMES.fr[m]} ${y}`;
    case 'ja': return `${y}年${m}月${d}日`;
    case 'ko': return `${y}년 ${m}월 ${d}일`;
    case 'zh': return `${y}年${m}月${d}日`;
    default: return `${dayStr}/${monthStr}/${yearStr}`;
  }
}

function formatSpokenTimeRange(h1, m1, h2, m2, lang) {
  const hh1 = parseInt(h1, 10);
  const mm1 = parseInt(m1, 10);
  const hh2 = parseInt(h2, 10);
  const mm2 = parseInt(m2, 10);
  const t1Vi = mm1 ? `${hh1} giờ ${mm1}` : `${hh1} giờ`;
  const t2Vi = mm2 ? `${hh2} giờ ${mm2}` : `${hh2} giờ`;
  switch (lang) {
    case 'vi': return `${t1Vi} đến ${t2Vi}`;
    case 'en': {
      const fmt12 = (h, m) => {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 === 0 ? 12 : h % 12;
        return m ? `${h12}:${String(m).padStart(2, '0')} ${ampm}` : `${h12} ${ampm}`;
      };
      return `${fmt12(hh1, mm1)} to ${fmt12(hh2, mm2)}`;
    }
    case 'fr': {
      const f = (h, m) => m ? `${h} heures ${m}` : `${h} heures`;
      return `${f(hh1, mm1)} à ${f(hh2, mm2)}`;
    }
    case 'ja': {
      const f = (h, m) => m ? `${h}時${m}分` : `${h}時`;
      return `${f(hh1, mm1)}から${f(hh2, mm2)}`;
    }
    case 'ko': {
      const f = (h, m) => m ? `${h}시 ${m}분` : `${h}시`;
      return `${f(hh1, mm1)}부터 ${f(hh2, mm2)}까지`;
    }
    case 'zh': {
      const f = (h, m) => m ? `${h}点${m}分` : `${h}点`;
      return `${f(hh1, mm1)}至${f(hh2, mm2)}`;
    }
    default: return `${h1}:${m1} - ${h2}:${m2}`;
  }
}

function formatSpokenCurrency(numRaw, lang) {
  const cleanNum = String(numRaw).replace(/[.,\s]/g, '');
  const val = parseInt(cleanNum, 10);
  if (isNaN(val)) return numRaw;
  switch (lang) {
    case 'vi': return `${val.toLocaleString('de-DE')} đồng`;
    case 'en': return `${val.toLocaleString('en-US')} Vietnamese dong`;
    case 'fr': return `${val.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')} dongs vietnamiens`;
    case 'ja': return `${val.toLocaleString('en-US')}ベトナムドン`;
    case 'ko': return `${val.toLocaleString('en-US')} 베트남 동`;
    case 'zh': return `${val.toLocaleString('en-US')}越南盾`;
    default: return `${numRaw} VND`;
  }
}

/**
 * Chuẩn hóa văn bản trả lời thành dạng phát âm tự nhiên theo ĐÚNG ngôn ngữ (VI/EN/FR/JA/KO/ZH).
 * Bảo toàn dấu câu Latin lẫn CJK (。、，！？；：) để giọng đọc có nhịp ngắt hơi tự nhiên!
 */
function sanitizeTextForSpeech(text, lang = 'vi') {
  if (!text) return '';
  const code = normalizeLang(lang);
  const conn = SPOKEN_CONNECTORS[code];
  let s = String(text);

  // 1. Chuyển mũi tên lộ trình sang từ nối bản ngữ
  s = s.replace(/\s*(?:➡️|→|➡)\s*/g, conn.arrow);

  // 2. Loại bỏ Markdown links & format kỹ thuật
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  s = s.replace(/[*_#`~]/g, ' ');
  s = s.replace(/(?:^|\s)\d+\)\s+/g, code === 'ja' || code === 'zh' ? '、' : ', ');

  // 3. Số quyết định hành chính (21/2021/QĐ-UBND) -> đọc mượt
  s = s.replace(/\b(\d+)\/(\d{4})\/QĐ-UBND\b/gi, (_, num, yr) => {
    if (code === 'vi') return `${num} năm ${yr} của Ủy ban nhân dân`;
    if (code === 'en') return `${num} of ${yr}`;
    if (code === 'fr') return `${num} de ${yr}`;
    if (code === 'ja') return `${yr}年第${num}号`;
    if (code === 'ko') return `${yr}년 제${num}호`;
    return `${yr}年第${num}号`;
  });

  // 4. Ngày tháng dạng dd/mm/yyyy (17/6/1930, 24/12/1951...)
  s = s.replace(/(?:ngày\s+)?\b(\d{1,2})\/(\d{1,2})\/(18\d{2}|19\d{2}|20\d{2})\b/gi, (_, d, m, y) => formatSpokenDate(d, m, y, code));

  // 5. Khung giờ dạng 8:00–17:00 hoặc 8:00 - 17:00
  s = s.replace(/\b(\d{1,2}):(\d{2})\s*(?:[-–—~]|đến|to|à)\s*(\d{1,2}):(\d{2})\b/gi, (_, h1, m1, h2, m2) => formatSpokenTimeRange(h1, m1, h2, m2, code));

  // 6. Tiền tệ VNĐ / VND (50.000 VNĐ, 25,000 VND, 399.000 - 499.000 VNĐ) — hỗ trợ cả dấu câu Latin lẫn CJK (。、，！？)!
  s = s.replace(/(?<!\d)(\d{1,3}(?:[.,]\d{3})+)\s*[-–—]\s*(\d{1,3}(?:[.,]\d{3})+)\s*(?:VNĐ|VND|đồng)(?=[\s.,?!;:)/。、，！？；：]|$)/gi, (_, a, b) => {
    const cleanA = parseInt(a.replace(/[.,]/g, ''), 10);
    const aStr = code === 'vi' ? cleanA.toLocaleString('de-DE') : cleanA.toLocaleString('en-US');
    return `${aStr}${conn.to}${formatSpokenCurrency(b, code)}`;
  });
  s = s.replace(/(?<!\d)(\d{1,3}(?:[.,]\d{3})+)\s*(?:VNĐ|VND)(?=[\s.,?!;:)/。、，！？；：]|$)/gi, (_, n) => formatSpokenCurrency(n, code));

  // 7. Đơn vị đo phổ biến trong thuyết minh di tích (kg, m², m, km)
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)\s*kg(?=[\s.,?!;:)/。、，！？；：]|$)/gi, (_, a, b) => {
    if (code === 'vi') return `${a} đến ${b} ki-lô-gam`;
    if (code === 'en') return `${a} to ${b} kilograms`;
    if (code === 'fr') return `${a} à ${b} kilogrammes`;
    if (code === 'ja') return `${a}から${b}キログラム`;
    if (code === 'ko') return `${a}에서 ${b}킬로그램`;
    return `${a}至${b}公斤`;
  });
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*kg(?=[\s.,?!;:)/。、，！？；：]|$)/gi, (_, a) => {
    if (code === 'vi') return `${a} ki-lô-gam`;
    if (code === 'en') return `${a} kilograms`;
    if (code === 'fr') return `${a} kilogrammes`;
    if (code === 'ja') return `${a}キログラム`;
    if (code === 'ko') return `${a}킬로그램`;
    return `${a}公斤`;
  });
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*(?:m2|m²)(?=[\s.,?!;:)/。、，！？；：]|$)/gi, (_, a) => {
    if (code === 'vi') return `${a} mét vuông`;
    if (code === 'en') return `${a} square meters`;
    if (code === 'fr') return `${a} mètres carrés`;
    if (code === 'ja') return `${a}平方メートル`;
    if (code === 'ko') return `${a}제곱미터`;
    return `${a}平方米`;
  });
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*m(?=[\s.,?!;:)/。、，！？；：]|$)/g, (_, a) => {
    if (code === 'vi') return `${a} mét`;
    if (code === 'en') return `${a} meters`;
    if (code === 'fr') return `${a} mètres`;
    if (code === 'ja') return `${a}メートル`;
    if (code === 'ko') return `${a}미터`;
    return `${a}米`;
  });

  // 8. Ký hiệu phân suất & toán tử theo đúng ngôn ngữ (Unicode + CJK-safe boundary!)
  s = s.replace(/\/(?:người lớn|người)(?=[\s.,?!;:)/。、，！？；：]|$)/gi, conn.perPerson);
  s = s.replace(/\/(?:vé|lượt)(?=[\s.,?!;:)/。、，！？；：]|$)/gi, conn.perTicket);
  s = s.replace(/\/(?:adult|person)(?=[\s.,?!;:)/。、，！？；：]|$)/gi, conn.perPerson);
  s = s.replace(/\/ticket(?=[\s.,?!;:)/。、，！？；：]|$)/gi, conn.perTicket);
  s = s.replace(/\/personne(?=[\s.,?!;:)/。、，！？；：]|$)/gi, conn.perPerson);
  s = s.replace(/\+/g, conn.plus);
  s = s.replace(/&/g, conn.and);
  if (code === 'zh') {
    s = s.replace(/(\d+(?:\.\d+)?)%/g, '百分之$1');
  } else {
    s = s.replace(/%/g, conn.percent);
  }

  // 9. Khoảng năm (1964–1973, 1896–1954) -> từ nối bản ngữ để không đọc cụt
  s = s.replace(/\b(18\d{2}|19\d{2}|20\d{2})\s*[–—-]\s*(18\d{2}|19\d{2}|20\d{2})\b/g, `$1${conn.to}$2`);

  // 10. Bỏ ngoặc kép thừa nhưng GIỮ NGUYÊN dấu câu chuẩn cả Latin và CJK (。、，！？；：・)
  s = s.replace(/[“”«»"'`「」『』]/g, ' ');
  s = s.replace(/[^\p{L}\p{N}\s.,?!:;\-–—。、，！？；：・]/gu, ' ');

  // 11. Gọn dấu câu & khoảng trắng
  s = s.replace(/\s*,\s*,+/g, ',').replace(/^\s*[,、，]\s*/, '').replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Xác định độ dài chunk tối ưu theo ngôn ngữ & nhà cung cấp TTS:
 * - ElevenLabs đọc nguyên cụm dài cực mượt (nên chunk lớn hơn -> ít request hơn, ngữ điệu tự nhiên hơn!)
 * - Google TTS giới hạn cứng ~185 ký tự và CJK nên ngắt ngắn hơn để phát tiếng đầu nhanh (~250-400ms).
 */
function getChunkProfile(lang = 'vi', useElevenLabs = false) {
  const code = normalizeLang(lang);
  if (useElevenLabs) {
    if (code === 'ja' || code === 'zh') return { firstMax: 70, maxChunk: 240 };
    if (code === 'ko') return { firstMax: 95, maxChunk: 280 };
    return { firstMax: 135, maxChunk: 380 };
  }
  if (code === 'ja' || code === 'zh') return { firstMax: 34, maxChunk: 76 };
  if (code === 'ko') return { firstMax: 48, maxChunk: 108 };
  return { firstMax: 68, maxChunk: 148 };
}

function splitLongSegmentSafely(segment, maxLen = 148) {
  const parts = [];
  let remaining = (segment || '').trim();
  while (remaining.length > maxLen) {
    const windowStr = remaining.slice(0, maxLen);
    let cutIdx = -1;
    for (let i = windowStr.length - 1; i >= Math.floor(maxLen * 0.45); i--) {
      if (/[,;:—–、，；：]/.test(windowStr[i])) {
        cutIdx = i + 1;
        break;
      }
    }
    if (cutIdx === -1) {
      const lastSpace = windowStr.lastIndexOf(' ');
      cutIdx = lastSpace >= Math.floor(maxLen * 0.4) ? lastSpace : maxLen;
    }
    const piece = remaining.slice(0, cutIdx).trim();
    if (piece) parts.push(piece);
    remaining = remaining.slice(cutIdx).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

function splitIntoAudioChunks(fullText, maxChunkChars = null, lang = 'vi', options = {}) {
  if (!fullText) return [''];
  const code = normalizeLang(lang);
  const conn = SPOKEN_CONNECTORS[code];
  const profile = getChunkProfile(code, Boolean(options.useElevenLabs));
  const effectiveMax = maxChunkChars || profile.maxChunk;
  const effectiveFirst = Math.min(profile.firstMax, effectiveMax);

  let clean = String(fullText)
    .replace(/\s*(?:➡️|→|➡)\s*/g, conn.arrow)
    .replace(/[\n\r]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Bảo vệ số thập phân / hàng nghìn và chữ viết tắt
  clean = clean.replace(/(\d+)\.(\d+)/g, '$1__DOT__$2');
  clean = clean.replace(/\b(TP|QĐ|VNĐ|TS|ThS|GS|BS|No|St|Mr|Mrs|Ms|Dr|M|Mme|Mlle|tr|đ)\./gi, '$1__DOT__');

  const rawSentences = clean.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) || [clean];
  const sentences = rawSentences.map(s => s.replace(/__DOT__/g, '.').trim()).filter(Boolean);
  if (sentences.length === 0) return [clean.replace(/__DOT__/g, '.')];

  const chunks = [];
  const s0 = sentences[0];
  let firstParts;
  if (s0.length > effectiveFirst) {
    const minCut = Math.max(10, Math.floor(effectiveFirst * 0.28));
    const commaIdx = s0.slice(minCut, effectiveFirst).search(/[,;:—–、，；：]/);
    if (commaIdx !== -1) {
      const cut = minCut + commaIdx + 1;
      firstParts = [s0.slice(0, cut).trim(), ...splitLongSegmentSafely(s0.slice(cut).trim(), effectiveMax)];
    } else {
      firstParts = splitLongSegmentSafely(s0, effectiveFirst);
    }
  } else {
    firstParts = [s0];
  }
  chunks.push(firstParts[0]);

  const tailSegments = [...firstParts.slice(1), ...sentences.slice(1)];
  const joiner = (code === 'ja' || code === 'zh') ? '' : ' ';
  let currentBuf = '';
  for (const seg of tailSegments) {
    if (seg.length > effectiveMax) {
      if (currentBuf) {
        chunks.push(currentBuf.trim());
        currentBuf = '';
      }
      chunks.push(...splitLongSegmentSafely(seg, effectiveMax));
    } else if (!currentBuf) {
      currentBuf = seg;
    } else if ((currentBuf.length + joiner.length + seg.length) <= effectiveMax) {
      currentBuf += joiner + seg;
    } else {
      chunks.push(currentBuf.trim());
      currentBuf = seg;
    }
  }
  if (currentBuf) chunks.push(currentBuf.trim());

  return chunks.filter(c => c && c.length > 0);
}

/**
 * =========================================================================================
 * 🔊 PLUGGABLE TTS ENGINE (ELEVENLABS PRIMARY + GOOGLE TTS KEEP-ALIVE FALLBACK)
 * =========================================================================================
 */
class PluggableTtsEngine {
  constructor({
    httpsAgent = null,
    decodeMp3ToPcm = null,
    trimPcmSilence = null,
    logEvent = null,
    env = process.env
  } = {}) {
    this.httpsAgent = httpsAgent || new https.Agent({ keepAlive: true, maxSockets: 24, keepAliveMsecs: 15000 });
    this.decodeMp3ToPcm = decodeMp3ToPcm;
    this.trimPcmSilence = trimPcmSilence || ((b) => b);
    this.logEvent = logEvent || (() => {});
    this.pcmCache = new Map();
    this.maxPcmCache = 800;

    // Trạng thái tự phục hồi cho ElevenLabs (cooldown khi chạm hạn mức hoặc lỗi xác thực, và tự nhận biết hỗ trợ pcm_16000)
    this.elevenLabsCooldownUntil = 0;
    this.elevenLabsSupportsPcm16k = true;
    this.lastError = null;
    this.stats = {
      cacheHits: 0,
      elevenLabsOk: 0,
      elevenLabsErrors: 0,
      googleOk: 0,
      googleErrors: 0
    };

    this.reloadConfig(env);
  }

  reloadConfig(env = process.env) {
    this.providerPref = String(env.TTS_PROVIDER || 'auto').toLowerCase().trim(); // 'auto' | 'elevenlabs' | 'google'
    this.elevenLabsApiKey = String(env.ELEVENLABS_API_KEY || '').trim();
    this.elevenLabsModel = String(env.ELEVENLABS_MODEL_ID || DEFAULT_ELEVENLABS_MODEL).trim();
    this.elevenLabsTimeoutMs = Number(env.ELEVENLABS_TIMEOUT_MS) || 6500;
    this.elevenLabsStability = env.ELEVENLABS_STABILITY !== undefined ? Number(env.ELEVENLABS_STABILITY) : 0.52;
    this.elevenLabsSimilarity = env.ELEVENLABS_SIMILARITY !== undefined ? Number(env.ELEVENLABS_SIMILARITY) : 0.78;
    this.elevenLabsStyle = env.ELEVENLABS_STYLE !== undefined ? Number(env.ELEVENLABS_STYLE) : 0.15;
    this.elevenLabsSpeed = env.ELEVENLABS_SPEED !== undefined ? Number(env.ELEVENLABS_SPEED) : 1.0;

    const defaultVoice = String(env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID).trim();
    this.voiceMap = {
      vi: String(env.ELEVENLABS_VOICE_VI || defaultVoice).trim(),
      en: String(env.ELEVENLABS_VOICE_EN || defaultVoice).trim(),
      fr: String(env.ELEVENLABS_VOICE_FR || defaultVoice).trim(),
      ja: String(env.ELEVENLABS_VOICE_JA || defaultVoice).trim(),
      ko: String(env.ELEVENLABS_VOICE_KO || defaultVoice).trim(),
      zh: String(env.ELEVENLABS_VOICE_ZH || defaultVoice).trim()
    };
  }

  isElevenLabsActive() {
    if (this.providerPref === 'google') return false;
    return Boolean(this.elevenLabsApiKey) && Date.now() >= this.elevenLabsCooldownUntil;
  }

  getVoiceIdForLang(lang = 'vi') {
    const code = normalizeLang(lang);
    return this.voiceMap[code] || this.voiceMap.vi || DEFAULT_VOICE_ID;
  }

  getStatus() {
    const configured = Boolean(this.elevenLabsApiKey);
    const active = this.isElevenLabsActive();
    return {
      active_provider: active ? 'elevenlabs' : 'google_tts_fallback',
      provider_preference: this.providerPref,
      elevenlabs_configured: configured,
      elevenlabs_model: this.elevenLabsModel,
      elevenlabs_pcm16k_direct: this.elevenLabsSupportsPcm16k,
      elevenlabs_cooldown_sec: Math.max(0, Math.ceil((this.elevenLabsCooldownUntil - Date.now()) / 1000)),
      voices_configured: configured ? Object.fromEntries(Object.entries(this.voiceMap).map(([k, v]) => [k, v ? `${v.slice(0, 6)}...` : null])) : null,
      cache_entries: this.pcmCache.size,
      stats: { ...this.stats },
      last_error: this.lastError
    };
  }

  clearCache() {
    this.pcmCache.clear();
  }

  /**
   * Gọi ElevenLabs REST TTS v1 qua HTTPS Keep-Alive:
   * POST /v1/text-to-speech/{voice_id}?output_format=pcm_16000|mp3_44100_128&optimize_streaming_latency=2
   */
  callElevenLabsRaw(text, lang = 'vi', outputFormat = 'pcm_16000') {
    return new Promise((resolve, reject) => {
      const code = normalizeLang(lang);
      const voiceId = this.getVoiceIdForLang(code);
      const payload = {
        text,
        model_id: this.elevenLabsModel,
        voice_settings: {
          stability: this.elevenLabsStability,
          similarity_boost: this.elevenLabsSimilarity,
          style: this.elevenLabsStyle,
          use_speaker_boost: true,
          speed: this.elevenLabsSpeed
        }
      };
      // `language_code` được hỗ trợ chính thức trên eleven_flash_v2_5 và eleven_turbo_v2_5 (giúp phát âm cực chuẩn 6 ngôn ngữ!)
      if (/flash_v2_5|turbo_v2_5/i.test(this.elevenLabsModel)) {
        payload.language_code = code;
      }

      const bodyStr = JSON.stringify(payload);
      const reqPath = `/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}&optimize_streaming_latency=2`;

      const req = https.request({
        hostname: ELEVENLABS_HOST,
        port: 443,
        path: reqPath,
        method: 'POST',
        agent: this.httpsAgent,
        timeout: this.elevenLabsTimeoutMs,
        headers: {
          'xi-api-key': this.elevenLabsApiKey,
          'Content-Type': 'application/json',
          'Accept': outputFormat.startsWith('pcm_') ? 'audio/pcm' : 'audio/mpeg',
          'Content-Length': Buffer.byteLength(bodyStr),
          'Connection': 'keep-alive'
        }
      }, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          if (res.statusCode === 200 && buf.length > 100) {
            return resolve({ buffer: buf, outputFormat, voiceId });
          }
          const errText = buf.toString('utf8').slice(0, 260);
          const err = new Error(`ElevenLabs HTTP ${res.statusCode}: ${errText}`);
          err.statusCode = res.statusCode;
          err.body = errText;
          reject(err);
        });
        res.on('error', reject);
      });

      req.on('timeout', () => req.destroy(new Error('ElevenLabs TTS timeout')));
      req.on('error', reject);
      req.write(bodyStr);
      req.end();
    });
  }

  async synthesizeElevenLabsPcm(cleanText, lang = 'vi') {
    const firstFormat = this.elevenLabsSupportsPcm16k ? 'pcm_16000' : 'mp3_44100_128';
    try {
      const res = await this.callElevenLabsRaw(cleanText, lang, firstFormat);
      if (res.outputFormat === 'pcm_16000') {
        return this.trimPcmSilence(res.buffer);
      }
      if (!this.decodeMp3ToPcm) {
        throw new Error('decodeMp3ToPcm callback not configured');
      }
      return await this.decodeMp3ToPcm(res.buffer);
    } catch (err) {
      // Nếu gói ElevenLabs Free/Starter không hỗ trợ pcm_16000 (403 output_format_not_allowed) -> tự động hạ sang mp3_44100_128 ngay!
      if (firstFormat === 'pcm_16000' && (err.statusCode === 403 || err.statusCode === 400) && /output_format|pcm|tier|subscription/i.test(err.body || err.message)) {
        this.elevenLabsSupportsPcm16k = false;
        const retryRes = await this.callElevenLabsRaw(cleanText, lang, 'mp3_44100_128');
        if (!this.decodeMp3ToPcm) throw new Error('decodeMp3ToPcm callback not configured');
        return await this.decodeMp3ToPcm(retryRes.buffer);
      }
      // Lỗi quota / rate limit / key hết hạn -> tạm nghỉ ElevenLabs để không làm chậm trải nghiệm khách, rơi êm sang Google TTS
      if (err.statusCode === 401 || err.statusCode === 402 || err.statusCode === 429) {
        const cooldownMs = err.statusCode === 429 ? 45 * 1000 : 10 * 60 * 1000;
        this.elevenLabsCooldownUntil = Date.now() + cooldownMs;
      }
      throw err;
    }
  }

  fetchGoogleTtsMp3(cleanText, ttsCode, timeoutMs = 3500) {
    return new Promise((resolve, reject) => {
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${encodeURIComponent(ttsCode)}&client=tw-ob`;
      const req = https.get(ttsUrl, {
        agent: this.httpsAgent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Connection': 'keep-alive'
        },
        timeout: timeoutMs
      }, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Google TTS HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      });
      req.on('timeout', () => req.destroy(new Error('Google TTS timeout')));
      req.on('error', reject);
    });
  }

  async synthesizeToPcm(text, lang = 'vi', supportedLangs = null) {
    const code = normalizeLang(lang);
    const ttsCode = supportedLangs?.[code]?.ttsCode || (code === 'zh' ? 'zh-CN' : code);
    const useEL = this.isElevenLabsActive();
    const sanitized = sanitizeTextForSpeech(text, code);
    const maxSlice = useEL ? 500 : 185;
    const cleanText = sanitized.slice(0, maxSlice).trim();
    if (!cleanText) return Buffer.alloc(0);

    const providerTag = useEL ? `el:${this.elevenLabsModel}:${this.getVoiceIdForLang(code)}` : `gg:${ttsCode}`;
    const cacheKey = crypto.createHash('md5').update(`${providerTag}:${cleanText.toLowerCase()}`).digest('hex');

    if (this.pcmCache.has(cacheKey)) {
      const hit = this.pcmCache.get(cacheKey);
      this.pcmCache.delete(cacheKey);
      this.pcmCache.set(cacheKey, hit);
      this.stats.cacheHits++;
      return hit;
    }

    const storeCache = (buf) => {
      if (this.pcmCache.size >= this.maxPcmCache) {
        const oldest = this.pcmCache.keys().next().value;
        if (oldest) this.pcmCache.delete(oldest);
      }
      this.pcmCache.set(cacheKey, buf);
    };

    // 1. Ưu tiên ElevenLabs khi đã cấu hình API Key & không trong cooldown
    if (useEL) {
      try {
        const elPcm = await this.synthesizeElevenLabsPcm(cleanText, code);
        if (elPcm && elPcm.length > 100) {
          this.stats.elevenLabsOk++;
          this.lastError = null;
          storeCache(elPcm);
          return elPcm;
        }
      } catch (err) {
        this.stats.elevenLabsErrors++;
        this.lastError = err.message;
        this.logEvent('WARN', 'ElevenLabsTTS', 'Fallback sang Google TTS do lỗi ElevenLabs', { error: err.message, lang: code });
      }
    }

    // 2. Dự phòng Google TTS Keep-Alive (0 đồng, tự động cắt an toàn <= 185 ký tự)
    const ggText = sanitized.slice(0, 185).trim();
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const mp3Buffer = await this.fetchGoogleTtsMp3(ggText, ttsCode, 3500);
        if (!this.decodeMp3ToPcm) throw new Error('decodeMp3ToPcm callback not configured');
        const cleanPcm = await this.decodeMp3ToPcm(mp3Buffer);
        if (cleanPcm && cleanPcm.length > 100) {
          this.stats.googleOk++;
          storeCache(cleanPcm);
          return cleanPcm;
        }
      } catch (err) {
        if (attempt === 2) {
          this.stats.googleErrors++;
          this.lastError = err.message;
          this.logEvent('WARN', 'FastTTS', 'TTS synthesis failed after retry', { error: err.message, lang: ttsCode });
        }
      }
    }
    return Buffer.alloc(0);
  }
}

module.exports = {
  PluggableTtsEngine,
  sanitizeTextForSpeech,
  splitIntoAudioChunks,
  getChunkProfile,
  formatSpokenDate,
  formatSpokenTimeRange,
  formatSpokenCurrency,
  DEFAULT_ELEVENLABS_MODEL,
  DEFAULT_VOICE_ID
};
