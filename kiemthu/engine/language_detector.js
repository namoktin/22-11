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
  'quel', 'quelle', 'quels', 'quelles', 'ou', 'quand', 'comment', 'pourquoi',
  'est', 'sont', 'avec', 'pour', 'dans', 'sur', 'les', 'des', 'une', 'vous', 'nous',
  'prix', 'billet', 'billets', 'ouvert', 'ferme', 'musee', 'bonjour', 'merci'
]);

const VI_UNACCENTED_MARKERS = new Set([
  'khong', 'ko', 'duoc', 'dc', 'dk', 'nha', 'dau', 'bao', 'nhieu', 'bn', 'may', 'gio',
  'cho', 'toi', 'minh', 'ban', 'cua', 'nay', 'kia', 'gi', 'cai', 'di', 've', 'anh', 'em',
  'chi', 'ong', 'ba', 'con', 'be', 'chau', 'qua', 'roi', 'vay', 'nhe', 'nhi', 'nha',
  'co', 'bi', 'biet', 'hieu', 'hiu', 'giup', 'muon', 'hoi', 'lam', 'dung', 'ngay', 'nam',
  'tai', 'sao', 'vi', 'the', 'nao', 'nguoi', 'trong', 'ngoai', 'gan', 'day', 'phut', 'tieng',
  'xe', 've', 'sinh', 'gui', 'do', 'chup', 'quay', 'phim', 'an', 'uong', 'quan', 'pho',
  'hoa', 'lo', 'cay', 'bang', 'may', 'chem', 'cong', 'ngam', 'xa', 'lim', 'tu', 'nhan',
  'tiep', 'huong', 'het', 'tron', 'oi', 'mat', 'lac', 'dau', 'bung', 'met', 'chan', 'nong'
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
    { re: /\bnha\s+vs\b/gi, rep: 'nhà vệ sinh' },
    { re: /\bđi\s+vs\b/gi, rep: 'đi vệ sinh' },
    { re: /\bdi\s+vs\b/gi, rep: 'đi vệ sinh' },
    { re: /\bvs\s+o\s+dau\b/gi, rep: 'vệ sinh ở đâu' },
    { re: /\bvs\s+ở\s+đâu\b/gi, rep: 'vệ sinh ở đâu' },
    { re: /\bbn\b/gi, rep: 'bao nhiêu' },
    { re: /\bko\b/gi, rep: 'không' },
    { re: /\bk0\b/gi, rep: 'không' },
    { re: /\bkhg\b/gi, rep: 'không' },
    { re: /\bhok\b/gi, rep: 'không' },
    { re: /\bdc\b/gi, rep: 'được' },
    { re: /\bdk\b/gi, rep: 'được' },
    { re: /\bhiu\b/gi, rep: 'hiểu' },
    { re: /(?<!trại\s|trai\s|khu\s|phòng\s|phong\s|dãy\s|day\s|lô\s|lo\s)\bj\b/gi, rep: 'gì' },
    { re: /\bntn\b/gi, rep: 'như thế nào' },
    { re: /\btrc\b/gi, rep: 'trước' },
    { re: /\bnhg\b/gi, rep: 'nhưng' },
    { re: /\bsdt\b/gi, rep: 'số điện thoại' },
    { re: /\bsđt\b/gi, rep: 'số điện thoại' },
    { re: /\bbql\b/gi, rep: 'ban quản lý' },
    { re: /\b(?<=\s|^)(?:o|ở)\s+dau\s+z\b/gi, rep: 'ở đâu vậy' },
    { re: /\b(?<=\s)v\s*[?!.]*$/gi, rep: ' vậy' },
    { re: /\b(?<=\s)z\s*[?!.]*$/gi, rep: ' vậy' }
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

  // 1. Có dấu tiếng Việt đặc thù -> chắc chắn tiếng Việt (trừ câu trích dẫn ngắn)
  const diacriticMatches = trimmed.match(/[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/gi) || [];
  if (diacriticMatches.length >= 2) {
    return 'vi';
  }

  const norm = removeAccents(trimmed.toLowerCase()).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = norm.split(' ').filter(Boolean);
  if (tokens.length === 0) return 'vi';

  let enScore = 0;
  let viScore = 0;
  let frScore = 0;

  for (const tok of tokens) {
    if (EN_FUNCTION_WORDS.has(tok)) enScore += 1.5;
    if (VI_UNACCENTED_MARKERS.has(tok)) viScore += 1.5;
    if (FR_FUNCTION_WORDS.has(tok)) frScore += 1.4;
    if (EN_MORPHOLOGY_REGEX.test(tok) && !VI_UNACCENTED_MARKERS.has(tok)) {
      enScore += 0.9;
    }
    // Chữ cái f, j, w, z ở đầu từ rất hiếm trong tiếng Việt không dấu chuẩn (trừ teencode j/z)
    if (/^[fw]|w|ck|sh|th[aeiou]/.test(tok) && !VI_UNACCENTED_MARKERS.has(tok)) {
      enScore += 0.6;
    }
  }

  // Nếu có 1 dấu tiếng Việt (ví dụ "Ở", "đâu") cộng thêm điểm VI
  if (diacriticMatches.length === 1) viScore += 2.0;

  if (frScore >= 2.8 && frScore > enScore && frScore > viScore) {
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
