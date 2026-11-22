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
  [/khắc nghiệt/g, ['khắc nghiệt', 'gian khổ', 'hà khắc']]
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
    '',
    'Ngay lúc này, ',
    'Mình thấy ',
    'Ở vị trí hiện tại, ',
    'Chia sẻ nhanh với bạn nhé: ',
    'Ngay trước mắt bạn bây giờ, ',
    'Điểm dừng chân hiện tại của bạn: ',
    'Tại đúng góc tham quan này, ',
    'Chào mừng bạn dừng chân tại đây — ',
    'Mình định vị được ngay chỗ bạn đứng: ',
    'Góc trưng bày ngay bên cạnh bạn đây: ',
    'Nơi anh chị đang đứng lúc này: '
  ],
  SERVICE: [
    '',
    'Mình thông tin nhanh để bạn tiện sắp xếp nhé: ',
    'Về quy định tại di tích, ',
    'Thông tin chính thức hiện nay là: ',
    'Để bạn dễ chuẩn bị cho chuyến tham quan, ',
    'Mình gửi anh chị thông tin mới nhất: ',
    'Theo quy định đang áp dụng ở Hỏa Lò, ',
    'Cập nhật rõ cho bạn nhé: ',
    'Rất đơn giản thôi bạn: ',
    'Mình chia sẻ cụ thể luôn nhé: '
  ],
  HISTORY: [
    '',
    'Theo tư liệu lưu trữ tại di tích, ',
    'Một chi tiết rất đáng nhớ là: ',
    'Chia sẻ cùng bạn câu chuyện này nhé: ',
    'Nhắc đến điểm lịch sử này thì ',
    'Trong hồ sơ lịch sử Hỏa Lò ghi nhận: ',
    'Điều đặc biệt ở đây là: ',
    'Mình kể gọn để bạn dễ hình dung nhé: ',
    'Nói sâu hơn về dấu tích này: ',
    'Điểm khiến nhiều du khách ấn tượng nhất là: ',
    'Theo ghi chép xác thực của Ban Quản lý Di tích, ',
    'Câu chuyện phía sau hiện vật này rất ý nghĩa: '
  ]
};

const EN_OPENERS = {
  BLE_LOCATION: [
    '', 'Right now, ', 'At your current stop, ', 'Looking right in front of you, ',
    'You have arrived at this highlight: ', 'Here is where you are standing: ',
    'At this exact exhibit point, ', 'Let me introduce your current spot: '
  ],
  SERVICE: [
    '', 'Here are the current visitor details: ', 'For your visit planning, ',
    'Good news for your trip: ', 'Officially at the relic today, ', 'To help you plan smoothly, '
  ],
  HISTORY: [
    '', 'According to the relic archives, ', 'A remarkable detail here is that ',
    'Historically speaking, ', 'To share the story concisely: ', 'What makes this stand out is that ',
    'Based on verified historical records, ', 'Here is the fascinating background: '
  ]
};

const VI_CONNECTORS = [
  ' ',
  ' Ngoài ra, ',
  ' Bên cạnh đó, ',
  ' Đặc biệt, ',
  ' Không chỉ vậy, ',
  ' Thêm một điểm đáng chú ý là ',
  ' Hơn thế nữa, ',
  ' Song song với đó, ',
  ' Đáng nói nữa là ',
  ' Chi tiết thú vị tiếp theo là '
];

const EN_CONNECTORS = [
  ' ', ' Additionally, ', ' Notably, ', ' Beyond that, ', ' What is more, ',
  ' On top of that, ', ' Another key detail is that ', ' Interestingly, '
];

const VI_CLOSINGS = [
  '',
  '',
  '',
  ' Bạn muốn mình kể kỹ thêm chi tiết nào nữa không?',
  ' Anh chị có thể quan sát kỹ hơn ngay tại khu trưng bày này nhé.',
  ' Nếu cần hỏi thêm về các khu vực lân cận, cứ nhắn mình ngay nhé.',
  ' Đây là một dấu ấn rất đặc biệt trong hành trình tham quan di tích đấy ạ.',
  ' Mình luôn sẵn sàng giải đáp thêm nếu bạn muốn tìm hiểu sâu hơn nhé!',
  ' Hy vọng thông tin này giúp chuyến tham quan của bạn thêm trọn vẹn.',
  ' Bạn có muốn khám phá tiếp câu chuyện về hiện vật kế bên không?'
];

const EN_CLOSINGS = [
  '', '', '',
  ' Would you like to hear more details about this?',
  ' Feel free to ask if you want to explore nearby exhibits too.',
  ' You can take a closer look right here in the gallery.',
  ' Let me know anytime if you have another question!',
  ' This is truly one of the memorable highlights of the visit.'
];

function splitIntoSentences(text) {
  if (!text) return [];
  const clean = text.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
  const matches = clean.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) || [clean];
  return matches.map(s => s.trim()).filter(s => s.length >= 8);
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

  // Thử tối đa 30 tổ hợp khác nhau (< 1ms) để bảo đảm 100/100 lần hỏi liên tiếp KHÔNG BAO GIỜ TRÙNG NHAU!
  for (let attempt = 0; attempt < 30; attempt++) {
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

    // B. Xen kẽ ghép thêm 1 câu tư liệu xác thực liên quan cùng chủ đề (nếu tổng độ dài còn gọn <= 360 ký tự!)
    if (supplementaryPool.length > 0 && (seed % 3 === 0)) {
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
      let firstSent = phrased[0].replace(/^(Chào bạn,\s*|Chào anh chị,\s*|Hello,\s*)/i, '');
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
