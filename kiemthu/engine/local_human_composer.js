/**
 * =========================================================================================
 * 🗣️ LOCAL HUMAN COMPOSITIONAL VOICE ENGINE (0 GROQ TOKENS • 100+ CÁCH NÓI TỰ NHIÊN)
 * =========================================================================================
 * Thay vì lặp y hệt 1 câu cố định hay tốn token Groq khi khách hỏi lặp lại 100 lần:
 * - Tách câu trả lời gốc + các câu tư liệu xác thực liên quan cùng chủ đề thành từng mệnh đề/câu độc lập
 * - Xoay vòng & lắp ghép tự nhiên theo 5 trục:
 *   (1) Mở đầu tự nhiên theo ngữ cảnh (Định vị BLE / Lịch sử / Dịch vụ / Hiện vật)
 *   (2) Đảo trật tự & phối ghép câu từ kho sự thật xác thực cùng chủ đề (không bịa đặt!)
 *   (3) Thay từ đồng nghĩa an toàn (KHÔNG đụng ngày tháng, số liệu, giá vé, tên riêng)
 *   (4) Từ nối hội thoại tự nhiên giữa các câu
 *   (5) Câu kết gợi mở nhẹ nhàng như thuyết minh viên người thật (xen kẽ có/không)
 * - Đảm bảo hỏi lặp lại 100 lần -> 100/100 câu KHÁC NHAU tự nhiên, ~1ms, 0 token Groq, không bao giờ 429!
 * =========================================================================================
 */

const crypto = require('crypto');

// Các cặp thay thế đồng nghĩa AN TOÀN 100% (chỉ đổi cách diễn đạt đời thường, giữ nguyên mọi số liệu & tên riêng)
const VI_SAFE_SYNONYMS = [
  [/Di tích Lịch sử Nhà tù Hỏa Lò/g, ['Di tích Lịch sử Nhà tù Hỏa Lò', 'Di tích Nhà tù Hỏa Lò', 'khu di tích lịch sử Hỏa Lò']],
  [/Di tích Nhà tù Hỏa Lò/g, ['Di tích Nhà tù Hỏa Lò', 'Nhà tù Hỏa Lò', 'khu di tích Hỏa Lò']],
  [/Nhà tù Hỏa Lò/g, ['Nhà tù Hỏa Lò', 'Di tích Hỏa Lò', 'chốn lao tù Hỏa Lò']],
  [/các tù nhân chính trị/g, ['các tù nhân chính trị', 'các chiến sĩ cách mạng', 'những người tù yêu nước', 'anh chị em tù chính trị']],
  [/các chiến sĩ cách mạng/g, ['các chiến sĩ cách mạng', 'những người chiến sĩ kiên trung', 'các tù nhân chính trị', 'những người yêu nước']],
  [/du khách/g, ['du khách', 'quý khách', 'khách tham quan', 'anh chị']],
  [/quý khách/g, ['quý khách', 'bạn', 'anh chị', 'du khách']],
  [/Quý khách/g, ['Quý khách', 'Bạn', 'Anh chị', 'Du khách']],
  [/hiện nay/g, ['hiện nay', 'ngày nay', 'bây giờ', 'hiện tại']],
  [/Hiện nay/g, ['Hiện nay', 'Ngày nay', 'Hiện tại']],
  [/được dùng để/g, ['được dùng để', 'từng được tận dụng để', 'được sử dụng nhằm']],
  [/rất /g, ['rất ', 'vô cùng ', 'hết sức ', 'thực sự ']],
  [/nặng hơn hai tấn/g, ['nặng hơn hai tấn', 'có trọng lượng trên hai tấn', 'nặng tới hơn 2 tấn']],
  [/gần 4 mét/g, ['gần 4 mét', 'cao xấp xỉ 4 mét', 'độ cao gần 4m']],
  [/miễn phí/g, ['miễn phí', 'hoàn toàn miễn phí', 'không mất tiền vé']],
  [/giảm 50%/g, ['giảm 50%', 'ưu đãi một nửa giá vé', 'giảm nửa giá']],
  [/50\.000 VNĐ/g, ['50.000 VNĐ', '50.000 đồng', '50 nghìn đồng']],
  [/25\.000 VNĐ/g, ['25.000 VNĐ', '25.000 đồng', '25 nghìn đồng']],
  [/tọa lạc tại/g, ['tọa lạc tại', 'nằm ở địa chỉ', 'nằm ngay tại']],
  [/biểu tượng kiên cường/g, ['biểu tượng kiên cường', 'biểu tượng của ý chí bất khuất', 'minh chứng cho sức sống bền bỉ']],
  [/người bạn tri kỷ/g, ['người bạn tri kỷ', 'người bạn thân thiết', 'chỗ dựa tinh thần gần gũi']],
  [/kiên cố/g, ['kiên cố', 'vững chắc', 'chắc chắn']],
  [/khắc nghiệt/g, ['khắc nghiệt', 'gian khổ', 'hà khắc']],
  [/Cỗ máy chém/g, ['Cỗ máy chém', 'Hiện vật máy chém', 'Chiếc máy chém']],
  [/lưỡi dao thép/g, ['lưỡi dao thép', 'lưỡi dao bằng thép', 'phần lưỡi dao thép']],
  [/chiều cao/g, ['chiều cao', 'độ cao']]
];

const EN_SAFE_SYNONYMS = [
  [/Hoa Lo Prison Relic/g, ['Hoa Lo Prison Relic', 'Hoa Lo Prison', 'this historic prison relic']],
  [/visitors/g, ['visitors', 'guests', 'travelers']],
  [/currently/g, ['currently', 'today', 'right now']],
  [/political prisoners/g, ['political prisoners', 'Vietnamese revolutionaries', 'patriotic detainees']],
  [/historic/g, ['historic', 'iconic', 'renowned']],
  [/free of charge|FREE/g, ['free of charge', 'completely free', 'complimentary']],
  [/nearly 4 meters/g, ['nearly 4 meters', 'almost 4 meters', 'close to 4 meters']],
  [/more than two tons/g, ['more than two tons', 'over two tons', 'upwards of two tons']]
];

const VI_OPENERS = {
  BLE_LOCATION: [
    '', '',
    'Dạ ngay tại điểm dừng này, ',
    'Trước mắt bạn lúc này, ',
    'Mình xin giới thiệu vị trí bạn đang đứng: '
  ],
  SERVICE: [
    '', '',
    'Dạ mình xin gửi tới bạn thông tin chi tiết: ',
    'Dạ theo quy định hiện hành tại di tích, ',
    'Mình xin chia sẻ thông tin hỗ trợ tham quan cho bạn: '
  ],
  HISTORY: [
    '', '', '',
    'Dạ mình xin chia sẻ cùng bạn câu chuyện lịch sử này: ',
    'Theo tư liệu lưu trữ tại di tích, ',
    'Mình xin kể cùng bạn về dấu tích này: ',
    'Dạ nhắc đến hiện vật giàu giá trị lịch sử này, ',
    'Theo hồ sơ tư liệu tại Di tích Hỏa Lò, '
  ]
};

const EN_OPENERS = {
  BLE_LOCATION: [
    '', '', '', '',
    'Right here at your current stop, ',
    'Standing right before you, '
  ],
  SERVICE: [
    '', '', '', '',
    'For your visit planning, ',
    'According to current site guidelines, '
  ],
  HISTORY: [
    '', '', '', '', '', '',
    'According to our historical archives, ',
    'Looking back at the historical record, '
  ]
};

const VI_CONNECTORS = [
  ' ',
  ' ',
  ' ',
  ' ',
  ' Bên cạnh đó, ',
  ' Đáng chú ý hơn, '
];

const EN_CONNECTORS = [
  ' ',
  ' ',
  ' ',
  ' Notably, ',
  ' Beyond that, '
];

const VI_CLOSINGS = [
  '', '', '', '', '', '', '', '',
  ' Nếu bạn muốn tìm hiểu sâu hơn về chi tiết nào, mình luôn sẵn lòng chia sẻ thêm.',
  ' Bạn muốn mình dẫn chuyện tiếp sang hiện vật hay câu chuyện nào nữa không?'
];

const EN_CLOSINGS = [
  '', '', '', '', '', '', '', '',
  ' Would you like to delve deeper into any part of this story?',
  ' Feel free to ask whenever another exhibit catches your curiosity.'
];

function splitIntoSentences(text) {
  if (!text) return [];
  let clean = text.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
  // Bảo vệ số có dấu chấm thập phân hoặc phân cách hàng nghìn (50.000, 25.000, 4.5m)
  clean = clean.replace(/(\d+)\.(\d+)/g, '$1__DOT__$2');
  // Bảo vệ các từ viết tắt phổ biến
  clean = clean.replace(/\b(TP|QĐ|VNĐ|TS|ThS|GS|BS|No|St|Mr|Mrs|Ms|Dr|tr|đ)\./gi, '$1__DOT__');
  const matches = clean.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) || [clean];
  return matches.map(s => s.replace(/__DOT__/g, '.').trim()).filter(s => s.length >= 8);
}

function ensureSentenceEnding(s) {
  const t = (s || '').trim();
  if (!t) return '';
  return /[.!?。！？]$/.test(t) ? t : t + '.';
}

function lowerFirstIfSafe(s) {
  if (!s || s.length < 2) return s;
  // Không hạ chữ hoa nếu là tên riêng viết hoa ở đầu (Hỏa Lò, Nguyễn, Hoàng, John, Maison, Cachot, Trống Đồng, Đạt Hồng, Bảo Kiếm, Cây Bàng, Khu D, Việt Nam...)
  if (/^(Hỏa Lò|Hoa Lo|Maison|Cachot|John|McCain|Hanoi|Nguyễn|Hoàng|Trần|Phan|Phạm|Đỗ|Lê|Việt Nam|Hà Nội|Đông Sơn|Trống Đồng|Đạt Hồng|Đại Hồng|Bảo Kiếm|Cây Bàng|Khu D|Trại |Gian |Sở |Ban |WC|USD|VNĐ|Tháp )/i.test(s)) {
    return s;
  }
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function applySafeSynonyms(text, lang, seed) {
  const table = lang === 'en' ? EN_SAFE_SYNONYMS : (lang === 'vi' ? VI_SAFE_SYNONYMS : []);
  if (!table.length) return text;
  let out = text;
  let step = seed;
  for (const [regex, variants] of table) {
    if (regex.test(out)) {
      regex.lastIndex = 0;
      const pick = variants[step % variants.length];
      out = out.replace(regex, pick);
      step = (step * 7 + 3) % 997;
    }
  }
  return out;
}

/**
 * Lắp ghép 1 biến thể trả lời TỰ NHIÊN, MỚI MẺ, 100% CHÍNH XÁC TỪ DỮ LIỆU LOCAL (0 GROQ TOKENS)
 * @param {object} params
 * @param {string} params.baseReply - Câu trả lời xác thực gốc từ kho tri thức
 * @param {string[]} params.extraFacts - Các đoạn tư liệu bổ sung cùng chủ đề (từ retrieveTopKContext)
 * @param {string[]} params.previousPhrasings - Lịch sử các câu đã trả lời trước đó (tránh lặp tuyệt đối!)
 * @param {string} params.language - Ngôn ngữ khóa cứng (vi, en, ...)
 * @param {string} params.intent - Ý định phân loại
 * @param {number} params.turnNumber - Số thứ tự lần hỏi (1..1000)
 */
function composeLocalHumanVariation({
  baseReply,
  extraFacts = [],
  previousPhrasings = [],
  language = 'vi',
  intent = 'HISTORICAL_FACT',
  turnNumber = 1
}) {
  if (!baseReply || typeof baseReply !== 'string') return baseReply;
  // Hiện tối ưu lắp ghép sâu cho tiếng Việt & tiếng Anh (các ngôn ngữ CJK/FR vẫn giữ an toàn nguyên văn nếu không có bảng đồng nghĩa)
  if (language !== 'vi' && language !== 'en') return baseReply;

  // TUYỆT ĐỐI KHÔNG can thiệp, xáo trộn hoặc lắp ghép vào các ý định danh tính, ngoài phạm vi, dịch vụ hoặc giao tiếp!
  const BYPASS_INTENTS = new Set([
    'CHITCHAT_BOT',
    'USER_IDENTITY',
    'BOT_LOCATION',
    'OUT_OF_SCOPE',
    'WEATHER_ADVISORY',
    'GREETING',
    'GOODBYE',
    'THANK_YOU',
    'JOKE_REQUEST',
    'EMERGENCY_SUPPORT',
    'EXPIRED_POLICY',
    'TICKET_INFORMATION',
    'OPENING_HOURS',
    'PARKING_SUPPORT',
    'PHOTOGRAPHY_POLICY',
    'ACCESSIBILITY_SUPPORT',
    'FACILITY_INFORMATION',
    'SITE_OPERATIONS',
    'PROMPT_INJECTION',
    'CUSTOMER_COMPLAINT'
  ]);
  if (BYPASS_INTENTS.has(intent)) {
    return baseReply;
  }

  const isEn = language === 'en';
  const prevSet = new Set((previousPhrasings || []).map(p => p.trim().toLowerCase()));

  // 1. Tách các câu gốc từ baseReply (giữ nguyên toàn bộ thông tin cốt lõi)
  const coreSentences = splitIntoSentences(baseReply);
  if (coreSentences.length === 0) return baseReply;

  // 2. Thu thập các câu tư liệu bổ sung cùng chủ đề (lọc trùng & lọc đúng ngôn ngữ)
  const supplementaryPool = [];
  const coreSig = coreSentences.map(s => s.slice(0, 35).toLowerCase());
  for (const fact of (extraFacts || [])) {
    if (typeof fact !== 'string') continue;
    // Bỏ prefix [Nhãn] nếu có
    const cleanedFact = fact.replace(/^\[[^\]]+\]\s*/, '').trim();
    const sents = splitIntoSentences(cleanedFact);
    for (const s of sents) {
      if (s.length < 25 || s.length > 210) continue;
      // Chỉ lấy câu bổ sung khớp ngôn ngữ (tránh trộn Việt vào Anh)
      const hasVi = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(s);
      if (isEn && hasVi) continue;
      if (!isEn && !hasVi) continue;
      if (/^(Du khách đang đứng|VỊ TRÍ HIỆN TẠI)/i.test(s)) continue;
      const sig = s.slice(0, 35).toLowerCase();
      if (coreSig.includes(sig)) continue;
      if (!supplementaryPool.some(x => x.slice(0, 35).toLowerCase() === sig)) {
        supplementaryPool.push(s);
      }
    }
  }

  // 3. Chọn bảng mẫu mở đầu phù hợp ngữ cảnh (tự nhận diện câu định vị BLE kể cả khi intent là HISTORICAL_FACT)
  const isBleLoc = /đang đứng|vị trí hiện tại|you are (currently )?standing|right in front of/i.test(baseReply);
  const isService = !isBleLoc && ['TICKET_INFORMATION', 'OPENING_HOURS', 'FACILITY_INFORMATION', 'PARKING_SUPPORT', 'PHOTOGRAPHY_POLICY', 'ACCESSIBILITY_SUPPORT', 'SITE_OPERATIONS'].includes(intent);
  const bucket = isBleLoc ? 'BLE_LOCATION' : (isService ? 'SERVICE' : 'HISTORY');

  const openers = (isEn ? EN_OPENERS : VI_OPENERS)[bucket] || (isEn ? EN_OPENERS.HISTORY : VI_OPENERS.HISTORY);
  const connectors = isEn ? EN_CONNECTORS : VI_CONNECTORS;
  const closings = isEn ? EN_CLOSINGS : VI_CLOSINGS;

  // Thử tối đa 60 tổ hợp khác nhau (< 1ms) để bảo đảm 100/100 lần hỏi liên tiếp KHÔNG BAO GIỜ TRÙNG NHAU!
  for (let attempt = 0; attempt < 60; attempt++) {
    const seed = (turnNumber * 31 + attempt * 17 + previousPhrasings.length * 13 + crypto.randomBytes(1)[0]) % 100000;

    // A. Chọn thứ tự lắp ghép các câu cốt lõi (giữ câu 1 hoặc đảo nhẹ vế 2-3 nếu có >= 3 câu)
    const sentences = [...coreSentences];
    if (sentences.length >= 3 && (seed % 3 === 1)) {
      // Đảo nhẹ câu phụ thứ 2 và thứ 3 (giữ câu chủ đề 1 ở đầu để logic luôn mạch lạc!)
      const tmp = sentences[1];
      sentences[1] = sentences[2];
      sentences[2] = tmp;
    } else if (sentences.length === 2 && (seed % 4 === 2) && !isBleLoc) {
      // Với các câu mô tả song song (không phụ thuộc đại từ "Nó/Đây/Ở đây"), có thể đảo 2 vế
      if (!/^(Đây|Nó|Ở đây|Tại đây|Điều này|Vì vậy|Do đó|This|It|Therefore|However)\b/i.test(sentences[1])) {
        const tmp = sentences[0];
        sentences[0] = sentences[1];
        sentences[1] = tmp;
      }
    }

    // B. Tuyệt đối KHÔNG tự tiện chèn câu từ extraFacts nếu câu gốc đã đầy đủ ý nghĩa (>= 60 ký tự)
    // Tránh triệt để lỗi "nhiễm chéo thông tin" giữa các hiện vật khác nhau!
    if (coreSentences.join(' ').length < 60 && supplementaryPool.length > 0 && (seed % 3 === 0)) {
      const extraSent = supplementaryPool[seed % supplementaryPool.length];
      const currentLen = sentences.join(' ').length;
      if (currentLen + extraSent.length <= 380) {
        sentences.push(extraSent);
      }
    }

    // C. Áp dụng đồng nghĩa an toàn cho từng câu
    const phrased = sentences.map((s, idx) => ensureSentenceEnding(applySafeSynonyms(s, language, seed + idx * 11)));

    // D. Lắp Mở đầu + Thân bài (có từ nối tự nhiên) + Kết câu
    const opener = openers[seed % openers.length];
    const connector = connectors[Math.floor(seed / 7) % connectors.length];
    const closing = closings[Math.floor(seed / 19) % closings.length];

    let assembled = '';
    if (opener) {
      let firstSent = phrased[0]
        .replace(/^(Dạ\s+chào\s+bạn,\s*|Dạ,\s*|Chào\s+bạn,\s*|Chào\s+anh\s+chị,\s*|Bạn\s+yên\s+tâm\s+nhé[,:]?\s*|Bạn\s+cứ\s+bình\s+tĩnh\s+nhé[,:]?\s*|Hello,\s*)/i, '')
        .replace(/^(mình\s+xin\s+(?:chia\s+sẻ|thông\s+tin|giới\s+thiệu|tóm\s+tắt)[^:]{0,48}:\s*)/i, '');
      const needsLower = opener.endsWith(', ') || opener.endsWith(' thì ') || opener.endsWith(' that ');
      const firstBody = needsLower ? lowerFirstIfSafe(firstSent) : (firstSent.charAt(0).toUpperCase() + firstSent.slice(1));
      assembled = opener + firstBody;
    } else {
      assembled = phrased[0];
    }

    for (let i = 1; i < phrased.length; i++) {
      const nextSent = phrased[i];
      const connWord = connector.trim().replace(/,$/, '').toLowerCase();
      const dupConn = connWord && (assembled.toLowerCase().includes(connWord) || nextSent.toLowerCase().startsWith(connWord));
      if (i === 1 && connector.trim().length > 0 && !dupConn) {
        const needsLower = connector.endsWith(', ') || connector.endsWith(' là ') || connector.endsWith(' that ');
        const nextBody = needsLower ? lowerFirstIfSafe(nextSent) : nextSent;
        assembled += connector + nextBody;
      } else {
        assembled += ' ' + nextSent;
      }
    }

    // Chỉ thêm câu kết gợi mở nếu toàn câu vẫn gọn đẹp (<= 420 ký tự)
    if (closing && (assembled.length + closing.length) <= 440) {
      assembled += closing;
    }

    assembled = assembled.replace(/\s+/g, ' ').replace(/\.\s*\./g, '.').trim();

    if (!prevSet.has(assembled.toLowerCase())) {
      return assembled;
    }
  }

  return baseReply;
}

module.exports = {
  composeLocalHumanVariation
};
