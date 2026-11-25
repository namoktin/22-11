/**
 * =========================================================================================
 * 🌐 CANONICAL 6-LANGUAGE HERITAGE GLOSSARY & FOREIGN TERM POLISHER (V1.0)
 * =========================================================================================
 * Chuẩn hóa danh từ riêng, địa danh, nhân vật và hiện vật Di tích Nhà tù Hỏa Lò + 4 trạm BLE
 * trên cả 6 ngôn ngữ: VI / EN / FR / JA / KO / ZH.
 * - Ngăn lỗi dịch máy / LLM bịa sai tên riêng ("Nguyễn 왕조", "전투기계", "延边", "machine à couper")
 * - Loại bỏ chú thích thừa tiếng Việt có dấu trong ngoặc đơn ở đầu ra ngoại ngữ.
 */

const GLOSSARY_BY_LANG = {
  en: {
    promptHint: 'Canonical terms: Hoa Lo Prison, Maison Centrale, Yen Bai, Nguyen Thai Hoc, Hoang Van Thu, Cachot dark cells, Guillotine, Ancient Banyan Tree, Dong Son Bronze Drum, Dat Hong Great Bronze Bell, Nguyen Dynasty Royal Sword, Sacred Night.',
    replacements: [
      [/Nhà tù Hỏa Lò/gi, 'Hoa Lo Prison'],
      [/Di tích (?:Lịch sử )?Nhà tù Hỏa Lò/gi, 'Hoa Lo Prison Historical Relic'],
      [/Hỏa Lò/gi, 'Hoa Lo'],
      [/Nguyễn Thái Học/gi, 'Nguyen Thai Hoc'],
      [/Hoàng Văn Thụ/gi, 'Hoang Van Thu'],
      [/Nguyễn Thị Minh Khai/gi, 'Nguyen Thi Minh Khai'],
      [/Yên Bái/gi, 'Yen Bai'],
      [/Trống đồng Đông Sơn/gi, 'Dong Son Bronze Drum'],
      [/Đông Sơn/gi, 'Dong Son'],
      [/Đạt Hồng/gi, 'Dat Hong'],
      [/Đại Hồng Chung/gi, 'Great Bronze Bell'],
      [/Bảo kiếm Hoàng gia/gi, 'Royal Sword'],
      [/Đêm Thiêng Liêng/gi, 'Sacred Night'],
      [/Hồ Gươm/gi, 'Hoan Kiem Lake'],
      [/Hà Nội/gi, 'Hanoi']
    ]
  },
  fr: {
    promptHint: 'Termes officiels : Prison de Hoa Lo, Maison Centrale, Yen Bai, Nguyen Thai Hoc, Hoang Van Thu, Cachots, Guillotine, Badamier historique, Tambour de bronze de Dong Son, Grande Cloche de bronze Dat Hong, Épée royale de la dynastie Nguyen, Nuit Sacrée.',
    replacements: [
      [/\bmachines?\s+à\s+couper(?:\s+(?:les?\s+)?têtes?)?\b/gi, 'guillotine'],
      [/\bmachine\s+à\s+décapiter\b/gi, 'guillotine'],
      [/Nhà tù Hỏa Lò/gi, 'Prison de Hoa Lo'],
      [/Hỏa Lò/gi, 'Hoa Lo'],
      [/Nguyễn Thái Học/gi, 'Nguyen Thai Hoc'],
      [/Hoàng Văn Thụ/gi, 'Hoang Van Thu'],
      [/Yên Bái/gi, 'Yen Bai'],
      [/Trống đồng Đông Sơn/gi, 'Tambour de bronze de Dong Son'],
      [/Đông Sơn/gi, 'Dong Son'],
      [/Đạt Hồng/gi, 'Dat Hong'],
      [/Đêm Thiêng Liêng/gi, 'Nuit Sacrée'],
      [/Hà Nội/gi, 'Hanoï']
    ]
  },
  ja: {
    promptHint: '公式用語: ホアロー収容所 (Hoa Lo), メゾン・サントラル (Maison Centrale), イエンバイ (Yen Bai), グエン・タイ・ホック, ホアン・ヴァン・トゥー, カショ独房 (Cachot), ギロチン, 歴史的なモモタマナの木, ドンソン銅鼓, ダットホン大洪鐘, グエン朝王室の宝剣, 聖なる夜.',
    replacements: [
      [/Nhà tù Hỏa Lò/gi, 'ホアロー収容所'],
      [/Hỏa Lò/gi, 'ホアロー'],
      [/Nguyễn Thái Học/gi, 'グエン・タイ・ホック'],
      [/Hoàng Văn Thụ/gi, 'ホアン・ヴァン・トゥー'],
      [/Yên Bái/gi, 'イエンバイ'],
      [/Đông Sơn/gi, 'ドンソン'],
      [/Đạt Hồng/gi, 'ダットホン'],
      [/Bảo Kiếm/gi, '王室の宝剣'],
      [/Hà Nội/gi, 'ハノイ']
    ]
  },
  ko: {
    promptHint: '공식 용어: 호아로 수용소 (Hoa Lo), 메종 상트랄 (Maison Centrale), 옌바이 (Yen Bai), 응우옌 타이 혹, 호앙 반 투, 카쇼 독방 (Cachot), 단두대 (Guillotine), 역사적인 방나무, 동선 청동북, 닷홍 대홍종, 응우옌 왕조 황실 보검, 성스러운 밤.',
    replacements: [
      [/전투\s*기계|전쟁\s*기계/g, '단두대'],
      [/Nguyễn\s*왕조/gi, '응우옌 왕조'],
      [/Nhà tù Hỏa Lò/gi, '호아로 수용소'],
      [/Hỏa Lò/gi, '호아로'],
      [/Nguyễn Thái Học/gi, '응우옌 타이 혹'],
      [/Hoàng Văn Thụ/gi, '호앙 반 투'],
      [/Yên Bái/gi, '옌바이'],
      [/Đông Sơn/gi, '동선'],
      [/Đạt Hồng/gi, '닷홍'],
      [/Hà Nội/gi, '하노이']
    ]
  },
  zh: {
    promptHint: '标准译名: 火炉监狱 (Hoa Lo), 中央监狱 (Maison Centrale), 安沛 (Yen Bai), 阮太学, 黄文树, 卡绍暗牢 (Cachot), 断头台, 古榄仁树, 东山铜鼓, 达鸿大洪钟, 阮朝皇室宝剑, 神圣之夜.',
    replacements: [
      [/延边/g, '安沛'],
      [/Nhà tù Hỏa Lò/gi, '火炉监狱'],
      [/Hỏa Lò/gi, '火炉'],
      [/Nguyễn Thái Học/gi, '阮太学'],
      [/Hoàng Văn Thụ/gi, '黄文树'],
      [/Yên Bái/gi, '安沛'],
      [/Đông Sơn/gi, '东山'],
      [/Đạt Hồng/gi, '达鸿'],
      [/Hà Nội/gi, '河内']
    ]
  }
};

// Dấu thanh & chữ cái đặc thù tiếng Việt để phát hiện chú thích tiếng Việt thừa trong ngoặc đơn ở văn bản ngoại ngữ
const VI_PARENTHETICAL_RE = /\s*[（(][^()（）]{2,48}[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ][^()（）]{0,48}[)）]/gi;

/**
 * Lấy dòng gợi ý thuật ngữ chuẩn gọn nhẹ (~45-60 tokens) để nhúng vào System Prompt RAG / Translation
 */
function getGlossaryPromptHint(lang) {
  const code = String(lang || 'vi').toLowerCase().trim();
  const entry = GLOSSARY_BY_LANG[code];
  return entry ? entry.promptHint : '';
}

/**
 * Hậu xử lý nhẹ làm sạch danh từ lịch sử cho đầu ra ngoại ngữ (EN/FR/JA/KO/ZH).
 * Không chạm vào tiếng Việt ('vi').
 */
function postPolishForeignTerms(text, lang) {
  if (!text || typeof text !== 'string') return text;
  const code = String(lang || 'vi').toLowerCase().trim();
  const entry = GLOSSARY_BY_LANG[code];
  if (!entry) return text;

  let out = text;

  // 1. Gỡ chú thích tiếng Việt có dấu bị chèn thừa trong ngoặc đơn (VD: "호아로 수용소 (Nhà tù Hỏa Lò)")
  out = out.replace(VI_PARENTHETICAL_RE, '');

  // 2. Thay thế các lỗi dịch máy / danh từ riêng chưa chuẩn hóa
  for (const [pattern, replacement] of entry.replacements) {
    out = out.replace(pattern, replacement);
  }

  // 3. Làm gọn khoảng trắng thừa quanh dấu câu
  out = out
    .replace(/\s+([,.;!?。！？])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return out;
}

module.exports = {
  GLOSSARY_BY_LANG,
  getGlossaryPromptHint,
  postPolishForeignTerms
};
