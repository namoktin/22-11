/**
 * 2Guide Statistical Language Detector & Teencode Normalizer v7.0
 *
 * - Nhận diện ngôn ngữ đa tầng (VI có dấu / VI không dấu / EN / FR) bằng thống kê hình thái & từ chức năng,
 *   không phụ thuộc vào danh sách từ bảo tàng cố định.
 * - Mở rộng viết tắt / teencode tiếng Việt phổ biến (vs -> vệ sinh, bn -> bao nhiêu, ko -> không, j -> gì...).
 */

const VI_DIACRITIC_REGEX = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;

const EN_FUNCTION_WORDS = new Set([
  'is', 'are', 'was', 'were', 'am', 'be', 'been', 'being',
  'the', 'a', 'an', 'this', 'that', 'these', 'those',
  'in', 'on', 'at', 'to', 'for', 'of', 'from', 'with', 'by', 'about', 'near', 'nearby', 'inside', 'outside',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'our', 'their', 'me', 'him', 'her', 'us',
  'what', 'where', 'when', 'who', 'whom', 'which', 'why', 'how',
  'can', 'could', 'would', 'should', 'will', 'shall', 'may', 'might', 'must',
  'do', 'does', 'did', 'have', 'has', 'had', 'there', 'here', 'please', 'help', 'just',
  'good', 'best', 'nearest', 'closest', 'much', 'many', 'any', 'some', 'all', 'previous', 'instructions',
  'buy', 'accept', 'fly', 'lost', 'won', 'write', 'tell', 'show', 'give', 'take', 'get', 'go',
  'ticket', 'tickets', 'price', 'open', 'close', 'prison', 'museum', 'tour', 'guide', 'audio',
  'restaurant', 'vegan', 'food', 'taxi', 'airport', 'sim', 'card', 'credit', 'dollar', 'dollars',
  'drone', 'hospital', 'emergency', 'passport', 'police', 'haunted', 'night', 'capital', 'city',
  'france', 'world', 'cup', 'cat', 'cats', 'haiku', 'ignore', 'system', 'prompt', 'local', 'counter'
]);

const FR_FUNCTION_WORDS = new Set([
  'quel', 'quelle', 'quels', 'quelles', 'ou', 'quand', 'comment', 'pourquoi', 'combien',
  'est', 'sont', 'avec', 'pour', 'dans', 'sur', 'les', 'des', 'une', 'vous', 'nous', 'puis',
  'prix', 'billet', 'billets', 'ouvert', 'ferme', 'musee', 'bonjour', 'merci', 'excusez',
  'horaires', 'ouverture', 'toilettes', 'parlez', 'racontez', 'trouvent', 'visite', 'nocturne',
  'reserver', 'prendre', 'photos', 'histoire', 'banian', 'cour', 'pilotes', 'americains',
  'appelaient', 'lieu', 'pourriez', 'expliquer', 'plait', 'evasion', 'egouts'
]);

const VI_UNACCENTED_MARKERS = new Set([
  'khong', 'ko', 'duoc', 'dc', 'dk', 'nha', 'dau', 'bao', 'nhieu', 'bn', 'may', 'gio',
  'cho', 'toi', 'minh', 'ban', 'cua', 'nay', 'kia', 'gi', 'cai', 'di', 've', 'anh', 'em',
  'chi', 'ong', 'ba', 'con', 'be', 'chau', 'qua', 'roi', 'vay', 'nhe', 'nhi', 'nha',
  'co', 'bi', 'biet', 'hieu', 'hiu', 'giup', 'muon', 'hoi', 'lam', 'dung', 'ngay', 'nam',
  'tai', 'sao', 'vi', 'the', 'nao', 'nguoi', 'trong', 'ngoai', 'gan', 'day', 'phut', 'tieng',
  'xe', 've', 'sinh', 'gui', 'do', 'chup', 'quay', 'phim', 'an', 'uong', 'quan', 'pho',
  'hoa', 'lo', 'cay', 'bang', 'may', 'chem', 'cong', 'ngam', 'xa', 'lim', 'tu', 'nhan',
  'tiep', 'huong', 'het', 'tron', 'oi', 'mat', 'lac', 'dau', 'bung', 'met', 'chan', 'nong',
  'nguyen', 'thi', 'minh', 'khai', 'trai', 'nu', 'tung', 'xay', 'tuong', 'cao', 'met',
  'caxo', 'caso', 'xien', 'nhiu', 'dzay', 'hk', 'lich', 'su', 'tich', 'tham', 'quan',
  'nghi', 'trua', 'xuyen', 'tour', 'dem', 'chua', 'benh', 'danh', 'dap', 'da', 'man',
  'hoang', 'van', 'thu', 'thai', 'hoc', 'duc', 'canh', 'thap', 'phong', 'giam', 'mua', 'ban'
]);

// Cụm phụ âm / hậu tố đặc trưng tiếng Anh không tồn tại trong tiếng Việt
const EN_MORPHOLOGY_REGEX = /\b(?:wh[a-z]+|sh[a-z]+|fl[a-z]+|dr[a-z]+|cr[a-z]+|br[a-z]+|pr[a-z]+|pl[a-z]+|cl[a-z]+|gl[a-z]+|str[a-z]+|[a-z]+(?:tion|sion|ment|ness|able|ible|est|ing|ed|ly|ous|ive))\b/i;

function removeAccents(str) {
  if (!str) return '';
  return str
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Mở rộng teencode & viết tắt tiếng Việt phổ biến có ranh giới từ an toàn
 */
function expandVietnameseAbbreviations(text) {
  if (!text || typeof text !== 'string') return '';
  let out = text;

  // Chỉ mở rộng trên câu không phải tiếng Anh thuần
  if (detectLanguage(text) === 'en') {
    return out;
  }

  const rules = [
    { re: /(?<=^|[\s,.:;!?])nha\s+vs(?=[\s,.:;!?]|$)/gi, rep: 'nhà vệ sinh' },
    { re: /(?<=^|[\s,.:;!?])đi\s+vs(?=[\s,.:;!?]|$)/gi, rep: 'đi vệ sinh' },
    { re: /(?<=^|[\s,.:;!?])di\s+vs(?=[\s,.:;!?]|$)/gi, rep: 'đi vệ sinh' },
    { re: /(?<=^|[\s,.:;!?])vs\s+o\s+dau(?=[\s,.:;!?]|$)/gi, rep: 'vệ sinh ở đâu' },
    { re: /(?<=^|[\s,.:;!?])vs\s+ở\s+đâu(?=[\s,.:;!?]|$)/gi, rep: 'vệ sinh ở đâu' },
    { re: /(?<=^|[\s,.:;!?])(?:nha\s+)?wc(?=[\s,.:;!?]|$)/gi, rep: 'nhà vệ sinh' },
    { re: /(?<=^|[\s,.:;!?])(sv|hssv)(?=[\s,.:;!?]|$)/gi, rep: 'sinh viên' },
    { re: /(?<=^|[\s,.:;!?])(bbn|bnhiêu|bnhieu|bnh)(?=[\s,.:;!?]|$)/gi, rep: 'bao nhiêu' },
    { re: /(?<=^|[\s,.:;!?])bn(?=[\s,.:;!?]|$)/gi, rep: 'bao nhiêu' },
    { re: /(?<=^|[\s,.:;!?])(ko|k0|khg|hok|hk)(?=[\s,.:;!?]|$)/gi, rep: 'không' },
    { re: /(?<=^|[\s,.:;!?])k(?=[\s,.:;!?]|$)/gi, rep: 'không' },
    { re: /(?<=^|[\s,.:;!?])ng(?=[\s,.:;!?]|$)/gi, rep: 'người' },
    { re: /(?<=^|[\s,.:;!?])b\s+ơi(?=[\s,.:;!?]|$)/gi, rep: 'bạn ơi' },
    { re: /(?<=^|[\s,.:;!?])nhiu(?=[\s,.:;!?]|$)/gi, rep: 'nhiêu' },
    { re: /(?<=^|[\s,.:;!?])xien(?=[\s,.:;!?]|$)/gi, rep: 'tiền' },
    { re: /(?<=^|[\s,.:;!?])dzay(?=[\s,.:;!?]|$)/gi, rep: 'vậy' },
    { re: /(?<=^|[\s,.:;!?])dc(?=[\s,.:;!?]|$)/gi, rep: 'được' },
    { re: /(?<=^|[\s,.:;!?])dk(?=[\s,.:;!?]|$)/gi, rep: 'được' },
    { re: /(?<=^|[\s,.:;!?])hiu(?=[\s,.:;!?]|$)/gi, rep: 'hiểu' },
    { re: /(?<!trại\s|trai\s|khu\s|phòng\s|phong\s|dãy\s|day\s|lô\s|lo\s)(?<=^|[\s,.:;!?])j(?=[\s,.:;!?]|$)/gi, rep: 'gì' },
    { re: /(?<=^|[\s,.:;!?])ntn(?=[\s,.:;!?]|$)/gi, rep: 'như thế nào' },
    { re: /(?<=^|[\s,.:;!?])trc(?=[\s,.:;!?]|$)/gi, rep: 'trước' },
    { re: /(?<=^|[\s,.:;!?])nhg(?=[\s,.:;!?]|$)/gi, rep: 'nhưng' },
    { re: /(?<=^|[\s,.:;!?])sdt(?=[\s,.:;!?]|$)/gi, rep: 'số điện thoại' },
    { re: /(?<=^|[\s,.:;!?])sđt(?=[\s,.:;!?]|$)/gi, rep: 'số điện thoại' },
    { re: /(?<=^|[\s,.:;!?])bql(?=[\s,.:;!?]|$)/gi, rep: 'ban quản lý' },
    { re: /(?<=^|[\s,.:;!?])(?:o|ở)\s+dau\s+z(?=[\s,.:;!?]|$)/gi, rep: 'ở đâu vậy' },
    { re: /(?<=\s)v\s*[?!.]*$/gi, rep: ' vậy' },
    { re: /(?<=\s)z\s*[?!.]*$/gi, rep: ' vậy' }
  ];

  for (const r of rules) {
    out = out.replace(r.re, r.rep);
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Nhận diện ngôn ngữ dựa trên dấu tiếng Việt + phân bố từ chức năng + hình thái âm tiết
 */
function detectLanguage(text) {
  if (!text || typeof text !== 'string') return 'vi';
  const trimmed = text.trim();
  if (!trimmed) return 'vi';

  // 0. Nhận diện nhanh theo bảng mã chữ viết Unicode (JA / KO / ZH) trước Latin
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(trimmed)) return 'ja';
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(trimmed)) return 'ko';
  if (/[\u4E00-\u9FFF]/.test(trimmed)) return 'zh';

  // 1. Phân biệt dấu tiếng Việt đặc thù vs dấu tiếng Pháp (tránh é/è/à/ô của tiếng Pháp bị nhầm sang VI!)
  const viUniqueDiacritics = trimmed.match(/[ăắằẳẵặơớờởỡợưứừửữựđạảãấầẩẫậẻẽếềểễệỉĩịọỏõốồổỗộụủũỳýỷỹỵ]/gi) || [];
  const sharedDiacritics = trimmed.match(/[àáèéêìíòóôùúçœæîïëû]/gi) || [];

  const norm = removeAccents(trimmed.toLowerCase()).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = norm.split(' ').filter(Boolean);
  if (tokens.length === 0) return 'vi';

  let enScore = 0;
  let viScore = 0;
  let frScore = 0;

  for (const tok of tokens) {
    if (EN_FUNCTION_WORDS.has(tok)) enScore += 1.5;
    if (VI_UNACCENTED_MARKERS.has(tok)) viScore += 1.5;
    if (FR_FUNCTION_WORDS.has(tok)) frScore += 1.8;
    if (EN_MORPHOLOGY_REGEX.test(tok) && !VI_UNACCENTED_MARKERS.has(tok) && !FR_FUNCTION_WORDS.has(tok)) {
      enScore += 0.9;
    }
    if (/^[fw]|w|ck|sh|th[aeiou]/.test(tok) && !VI_UNACCENTED_MARKERS.has(tok)) {
      enScore += 0.6;
    }
  }

  // Dấu đặc trưng chỉ tiếng Việt có (ă, ơ, ư, đ, dấu hỏi/ngã/nặng...)
  if (viUniqueDiacritics.length >= 1) {
    viScore += viUniqueDiacritics.length * 3.0;
  }
  // Dấu tiếng Pháp đặc trưng (ç, œ, æ, ’) hoặc dấu shared kèm từ chức năng Pháp
  if (/[çœæ]/i.test(trimmed) || /(?:l['’]|d['’]|qu['’]|s['’]|m['’])/i.test(trimmed)) {
    frScore += 3.0;
  }
  if (viUniqueDiacritics.length === 0 && sharedDiacritics.length > 0 && frScore >= 1.8) {
    frScore += 2.0;
  } else if (sharedDiacritics.length >= 2 && frScore < 1.8) {
    viScore += 3.0;
  } else if (sharedDiacritics.length === 1 && frScore < 1.8) {
    viScore += 2.0;
  }

  if (frScore >= 2.5 && frScore > enScore && frScore > viScore) {
    return 'fr';
  }
  if (enScore >= 2.0 && enScore > viScore) {
    return 'en';
  }
  return 'vi';
}

module.exports = {
  detectLanguage,
  expandVietnameseAbbreviations,
  VI_DIACRITIC_REGEX
};
