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
  vi: {
    promptHint: 'Viết đúng chính tả có dấu tiếng Việt: Nhà tù Hỏa Lò, Hà Nội, Yên Bái, Nguyễn Thái Học, Hoàng Văn Thụ, Đông Sơn, Đạt Hồng, Bảo kiếm Hoàng gia.',
    replacements: [
      [/\bHoa\s+Lo\b/g, 'Hỏa Lò'],
      [/\bHa\s+Noi\b/g, 'Hà Nội'],
      [/\bYen\s+Bai\b/g, 'Yên Bái'],
      [/\bNguyen\s+Thai\s+Hoc\b/g, 'Nguyễn Thái Học'],
      [/\bHoang\s+Van\s+Thu\b/g, 'Hoàng Văn Thụ'],
      [/\bDong\s+Son\b/g, 'Đông Sơn'],
      [/\bCon\s+Dao\b/g, 'Côn Đảo']
    ]
  },
  en: {
    promptHint: 'Canonical terms: Hoa Lo Prison, Maison Centrale, Yen Bai, Nguyen Thai Hoc, Hoang Van Thu, Cachot dark cells, Guillotine, Ancient Banyan Tree, Dong Son Bronze Drum, Dat Hong Great Bronze Bell, Nguyen Dynasty Royal Sword, Twin Dragons Facing the Sun motif, Sacred Night.',
    replacements: [
      [/Nhà tù Hỏa Lò/gi, 'Hoa Lo Prison'],
      [/Di tích (?:Lịch sử )?Nhà tù Hỏa Lò/gi, 'Hoa Lo Prison Historical Relic'],
      [/Hỏa Lò/gi, 'Hoa Lo'],
      [/Nguyễn\s+Thái\s+H[oọ]c/gi, 'Nguyen Thai Hoc'],
      [/Hoàng\s+Văn\s+Th[uụ]/gi, 'Hoang Van Thu'],
      [/Nguyễn\s+Thị\s+Minh\s+Khai/gi, 'Nguyen Thi Minh Khai'],
      [/Yên\s+Bái/gi, 'Yen Bai'],
      [/Trống đồng Đông Sơn/gi, 'Dong Son Bronze Drum'],
      [/Đông Sơn/gi, 'Dong Son'],
      [/Đạt Hồng/gi, 'Dat Hong'],
      [/Đại Hồng Chung/gi, 'Great Bronze Bell'],
      [/Bảo kiếm Hoàng gia/gi, 'Royal Sword'],
      [/Lưỡng Long Triều Nhật/gi, 'Twin Dragons Facing the Sun'],
      [/Đêm Thiêng Liêng/gi, 'Sacred Night'],
      [/Hồ Gươm/gi, 'Hoan Kiem Lake'],
      [/Hà Nội/gi, 'Hanoi']
    ]
  },
  fr: {
    promptHint: 'Termes officiels : Prison de Hoa Lo, Maison Centrale, Yen Bai, Nguyen Thai Hoc, Hoang Van Thu, Cachots, Guillotine, Badamier historique, Tambour de bronze de Dong Son, Grande Cloche de bronze Dat Hong, Épée royale de la dynastie Nguyen, motif des Deux Dragons face au Soleil, Nuit Sacrée.',
    replacements: [
      [/\bmachines?\s+à\s+couper(?:\s+(?:les?\s+)?têtes?)?\b/gi, 'guillotine'],
      [/\bmachine\s+à\s+décapiter\b/gi, 'guillotine'],
      [/Nhà tù Hỏa Lò/gi, 'Prison de Hoa Lo'],
      [/Hỏa Lò/gi, 'Hoa Lo'],
      [/Nguyễn\s+Thái\s+H[oọ]c/gi, 'Nguyen Thai Hoc'],
      [/Hoàng\s+Văn\s+Th[uụ]/gi, 'Hoang Van Thu'],
      [/Yên\s+Bái/gi, 'Yen Bai'],
      [/Trống đồng Đông Sơn/gi, 'Tambour de bronze de Dong Son'],
      [/Đông Sơn/gi, 'Dong Son'],
      [/Đạt Hồng/gi, 'Dat Hong'],
      [/Lưỡng Long Triều Nhật/gi, 'Deux Dragons face au Soleil'],
      [/Đêm Thiêng Liêng/gi, 'Nuit Sacrée'],
      [/Hà Nội/gi, 'Hanoï']
    ]
  },
  ja: {
    promptHint: '公式用語: ホアロー収容所 (Hoa Lo), メゾン・サントラル (Maison Centrale), イエンバイ (Yen Bai), グエン・タイ・ホック (Nguyen Thai Hoc), ホアン・ヴァン・トゥー (Hoang Van Thu), カショ独房 (Cachot), ギロチン, 歴史的なモモタマナの木, ドンソン銅鼓, ダットホン大洪鐘, グエン朝王室の宝剣, 双龍朝日文様, 聖なる夜.',
    replacements: [
      [/ノイ[・\s]?タイ[・\s]?ホク/g, 'グエン・タイ・ホック'],
      [/トゥンマイ射撃場/g, 'トゥオンマイ射撃場'],
      [/Nhà tù Hỏa Lò/gi, 'ホアロー収容所'],
      [/Hỏa Lò/gi, 'ホアロー'],
      [/Nguyễn\s+Thái\s+H[oọ]c/gi, 'グエン・タイ・ホック'],
      [/Hoàng\s+Văn\s+Th[uụ]/gi, 'ホアン・ヴァン・トゥー'],
      [/Yên\s+Bái/gi, 'イエンバイ'],
      [/Đông Sơn/gi, 'ドンソン'],
      [/Đạt Hồng/gi, 'ダットホン'],
      [/Bảo Kiếm/gi, '王室の宝剣'],
      [/Lưỡng Long Triều Nhật/gi, '双龍朝日'],
      [/Hà Nội/gi, 'ハノイ']
    ]
  },
  ko: {
    promptHint: '공식 용어: 호아로 수용소 (Hoa Lo), 메종 상트랄 (Maison Centrale), 옌바이 (Yen Bai), 응우옌 타이 혹 (Nguyen Thai Hoc), 호앙 반 투 (Hoang Van Thu), 카쇼 독방 (Cachot), 단두대 (Guillotine), 역사적인 방나무, 동선 청동북, 닷홍 대홍종, 응우옌 왕조 황실 보검 (Bảo kiếm Hoàng gia = Royal/Imperial Sword, NEVER Hoang Van Thu), 쌍룡조일(두 마리 용이 태양을 향하는 문양), 성스러운 밤.',
    replacements: [
      [/전투\s*기계|전쟁\s*기계/g, '단두대'],
      [/호앙\s*반\s*투의\s*보검/g, '응우옌 왕조 황실 보검'],
      [/호앙\s*반\s*투의\s*궁전/g, '황궁 유물'],
      [/일본의\s*이중\s*용(?:\s*왕조)?\s*양식/g, '쌍룡조일(두 마리 용이 태양을 향하는) 문양'],
      [/Nguyễn\s*왕조/gi, '응우옌 왕조'],
      [/Nhà tù Hỏa Lò/gi, '호아로 수용소'],
      [/Hỏa Lò/gi, '호아로'],
      [/Nguyễn\s+Thái\s+H[oọ]c/gi, '응우옌 타이 혹'],
      [/Hoàng\s+Văn\s+Th[uụ]/gi, '호앙 반 투'],
      [/Yên\s+Bái/gi, '옌바이'],
      [/Đông Sơn/gi, '동선'],
      [/Đạt Hồng/gi, '닷홍'],
      [/Lưỡng Long Triều Nhật/gi, '쌍룡조일'],
      [/Hà Nội/gi, '하노이']
    ]
  },
  zh: {
    promptHint: '标准译名: 火炉监狱 (Hoa Lo), 中央监狱 (Maison Centrale), 安沛 (Yen Bai), 阮太学 (Nguyen Thai Hoc), 黄文树 (Hoang Van Thu), 卡绍暗牢 (Cachot), 断头台, 古榄仁树, 东山铜鼓, 达鸿大洪钟, 阮朝皇室宝剑, 双龙朝日纹饰, 神圣之夜.',
    replacements: [
      [/延边/g, '安沛'],
      [/Nhà tù Hỏa Lò/gi, '火炉监狱'],
      [/Hỏa Lò/gi, '火炉'],
      [/Nguyễn\s+Thái\s+H[oọ]c/gi, '阮太学'],
      [/Hoàng\s+Văn\s+Th[uụ]/gi, '黄文树'],
      [/Yên\s+Bái/gi, '安沛'],
      [/Đông Sơn/gi, '东山'],
      [/Đạt Hồng/gi, '达鸿'],
      [/Lưỡng Long Triều Nhật/gi, '双龙朝日'],
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
 * Hậu xử lý nhẹ làm sạch danh từ lịch sử cho đầu ra 6 ngôn ngữ (VI/EN/FR/JA/KO/ZH).
 * - Với ngoại ngữ: gỡ chú thích tiếng Việt thừa trong ngoặc đơn và sửa lỗi dịch máy danh từ riêng.
 * - Với tiếng Việt: khôi phục dấu chuẩn cho danh từ riêng nếu LLM vô tình viết không dấu ("Hoa Lo" -> "Hỏa Lò").
 */
function postPolishForeignTerms(text, lang) {
  if (!text || typeof text !== 'string') return text;
  const code = String(lang || 'vi').toLowerCase().trim();
  const entry = GLOSSARY_BY_LANG[code];
  if (!entry) return text;

  let out = text;

  // 1. Gỡ chú thích tiếng Việt có dấu bị chèn thừa trong ngoặc đơn (chỉ áp dụng cho ngoại ngữ!)
  if (code !== 'vi') {
    out = out.replace(VI_PARENTHETICAL_RE, '');
  }

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
