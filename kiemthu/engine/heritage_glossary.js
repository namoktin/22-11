/**
 * =========================================================================================
 * 🌐 CANONICAL 6-LANGUAGE HERITAGE GLOSSARY & FOREIGN TERM POLISHER (V2.0)
 * =========================================================================================
 * Chuẩn hóa danh từ riêng, địa danh, nhân vật và hiện vật Di tích Nhà tù Hỏa Lò + 4 trạm BLE
 * trên cả 6 ngôn ngữ: VI / EN / FR / JA / KO / ZH.
 * - Ngăn lỗi dịch máy / LLM bịa sai tên riêng ("Stove Prison", "Nguyễn 왕조", "전투기계",
 *   "延边", "machine à couper", "ストーブ刑務所", "난로 수용소", "bang tree")
 * - Loại bỏ chú thích thừa tiếng Việt có dấu trong ngoặc đơn ở đầu ra ngoại ngữ.
 * =========================================================================================
 */

const GLOSSARY_BY_LANG = {
  vi: {
    promptHint: 'Viết đúng chính tả có dấu tiếng Việt: Nhà tù Hỏa Lò, Hà Nội, Yên Bái, Nguyễn Thái Học, Hoàng Văn Thụ, Trường Chinh, Trần Tử Bình, Nguyễn Đức Cảnh, Phụ Khánh, Đông Sơn, Đạt Hồng, Bảo kiếm Hoàng gia.',
    replacements: [
      [/\bHoa\s+Lo\b/g, 'Hỏa Lò'],
      [/\bHa\s+Noi\b/g, 'Hà Nội'],
      [/\bYen\s+Bai\b/g, 'Yên Bái'],
      [/\bNguyen\s+Thai\s+Hoc\b/g, 'Nguyễn Thái Học'],
      [/\bHoang\s+Van\s+Thu\b/g, 'Hoàng Văn Thụ'],
      [/\bTruong\s+Chinh\b/g, 'Trường Chinh'],
      [/\bTran\s+Tu\s+Binh\b/g, 'Trần Tử Bình'],
      [/\bNguyen\s+Duc\s+Canh\b/g, 'Nguyễn Đức Cảnh'],
      [/\bPhu\s+Khanh\b/g, 'Phụ Khánh'],
      [/\bDong\s+Son\b/g, 'Đông Sơn'],
      [/\bCon\s+Dao\b/g, 'Côn Đảo']
    ]
  },
  en: {
    promptHint: 'Canonical terms: Hoa Lo Prison, Maison Centrale, Phu Khanh village, Yen Bai, Nguyen Thai Hoc, Hoang Van Thu, Truong Chinh, Tran Tu Binh, Nguyen Duc Canh, Cachot dark cells, Guillotine, Ancient Banyan Tree (Terminalia catappa / Banyan), Hanoi Hilton, Dong Son Bronze Drum, Dat Hong Great Bronze Bell, Nguyen Dynasty Royal Sword, Twin Dragons Facing the Sun motif, Sacred Night.',
    replacements: [
      [/\b(?:stove|oven|furnace)\s+prison\b/gi, 'Hoa Lo Prison'],
      [/\bcutting\s+machine\b/gi, 'guillotine'],
      [/\bbang\s+tree\b/gi, 'historic banyan tree'],
      [/Nhà tù Hỏa Lò/gi, 'Hoa Lo Prison'],
      [/Di tích (?:Lịch sử )?Nhà tù Hỏa Lò/gi, 'Hoa Lo Prison Historical Relic'],
      [/Hỏa Lò/gi, 'Hoa Lo'],
      [/Nguyễn\s+Thái\s+H[oọ]c/gi, 'Nguyen Thai Hoc'],
      [/Hoàng\s+Văn\s+Th[uụ]/gi, 'Hoang Van Thu'],
      [/Nguyễn\s+Thị\s+Minh\s+Khai/gi, 'Nguyen Thi Minh Khai'],
      [/Trường\s+Chinh/gi, 'Truong Chinh'],
      [/Trần\s+Tử\s+Bình/gi, 'Tran Tu Binh'],
      [/Nguyễn\s+Đức\s+Cảnh/gi, 'Nguyen Duc Canh'],
      [/Nguyễn\s+Hoàng\s+Tôn/gi, 'Nguyen Hoang Ton'],
      [/Phụ\s+Khánh/gi, 'Phu Khanh'],
      [/Thợ\s+Nhuộm/gi, 'Tho Nhuom'],
      [/Quán\s+Sứ/gi, 'Quan Su'],
      [/Trúc\s+Bạch/gi, 'Truc Bach'],
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
    promptHint: 'Termes officiels : Prison de Hoa Lo, Maison Centrale, village de Phu Khanh, Yen Bai, Nguyen Thai Hoc, Hoang Van Thu, Truong Chinh, Tran Tu Binh, Cachots, Guillotine, Badamier historique, Hanoi Hilton, Tambour de bronze de Dong Son, Grande Cloche de bronze Dat Hong, Épée royale de la dynastie Nguyen, Deux Dragons face au Soleil, Nuit Sacrée.',
    replacements: [
      [/\bmachines?\s+à\s+couper(?:\s+(?:les?\s+)?têtes?)?\b/gi, 'guillotine'],
      [/\bmachine\s+à\s+décapiter\b/gi, 'guillotine'],
      [/\bprison\s+du\s+fourneau\b/gi, 'Prison de Hoa Lo'],
      [/\bprison\s+du\s+poêle\b/gi, 'Prison de Hoa Lo'],
      [/Nhà tù Hỏa Lò/gi, 'Prison de Hoa Lo'],
      [/Hỏa Lò/gi, 'Hoa Lo'],
      [/Nguyễn\s+Thái\s+H[oọ]c/gi, 'Nguyen Thai Hoc'],
      [/Hoàng\s+Văn\s+Th[uụ]/gi, 'Hoang Van Thu'],
      [/Trường\s+Chinh/gi, 'Truong Chinh'],
      [/Trần\s+Tử\s+Bình/gi, 'Tran Tu Binh'],
      [/Nguyễn\s+Đức\s+Cảnh/gi, 'Nguyen Duc Canh'],
      [/Phụ\s+Khánh/gi, 'Phu Khanh'],
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
    promptHint: '公式用語: ホアロー収容所 (Hoa Lo), メゾン・サントラル (Maison Centrale), フーカイン村, イエンバイ (Yen Bai), グエン・タイ・ホック, ホアン・ヴァン・トゥー, チュオン・チン, チャン・トゥー・ビン, カショ独房 (Cachot), ギロチン, 歴史的なモモタマナの木, ハノイ・ヒルトン, ドンソン銅鼓, ダットホン大洪鐘, グエン朝王室の宝剣, 双龍朝日文様, 聖なる夜.',
    replacements: [
      [/ストーブ刑務所|かまど刑務所|炉刑務所/g, 'ホアロー収容所'],
      [/切断機/g, 'ギロチン'],
      [/ノイ[・\s]?タイ[・\s]?ホク/g, 'グエン・タイ・ホック'],
      [/トゥンマイ射撃場/g, 'トゥオンマイ射撃場'],
      [/Nhà tù Hỏa Lò/gi, 'ホアロー収容所'],
      [/Hỏa Lò/gi, 'ホアロー'],
      [/Nguyễn\s+Thái\s+H[oọ]c/gi, 'グエン・タイ・ホック'],
      [/Hoàng\s+Văn\s+Th[uụ]/gi, 'ホアン・ヴァン・トゥー'],
      [/Trường\s+Chinh/gi, 'チュオン・チン'],
      [/Trần\s+Tử\s+Bình/gi, 'チャン・トゥー・ビン'],
      [/Nguyễn\s+Đức\s+Cảnh/gi, 'グエン・ドゥック・カイン'],
      [/Phụ\s+Khánh/gi, 'フーカイン'],
      [/Yên\s+Bái/gi, 'イエンバイ'],
      [/Đông Sơn/gi, 'ドンソン'],
      [/Đạt Hồng/gi, 'ダットホン'],
      [/Bảo Kiếm/gi, '王室の宝剣'],
      [/Lưỡng Long Triều Nhật/gi, '双龍朝日'],
      [/Hà Nội/gi, 'ハノイ']
    ]
  },
  ko: {
    promptHint: '공식 용어: 호아로 수용소 (Hoa Lo), 메종 상트랄 (Maison Centrale), 푸카인 마을, 옌바이 (Yen Bai), 응우옌 타이 혹, 호앙 반 투, 쯔엉 찐, 쩐 뜨 빈, 카쇼 독방 (Cachot), 단두대 (Guillotine), 역사적인 반얀나무(방나무), 하노이 힐튼, 동선 청동북, 닷홍 대홍종, 응우옌 왕조 황실 보검 (NEVER Hoang Van Thu), 쌍룡조일 문양, 성스러운 밤.',
    replacements: [
      [/난로\s*(?:감옥|수용소)|화덕\s*(?:감옥|수용소)|화롯불\s*(?:감옥|수용소)/g, '호아로 수용소'],
      [/전투\s*기계|전쟁\s*기계|절단기/g, '단두대'],
      [/호앙\s*반\s*투의\s*보검/g, '응우옌 왕조 황실 보검'],
      [/호앙\s*반\s*투의\s*궁전/g, '황궁 유물'],
      [/일본의\s*이중\s*용(?:\s*왕조)?\s*양식/g, '쌍룡조일(두 마리 용이 태양을 향하는) 문양'],
      [/Nguyễn\s*왕조/gi, '응우옌 왕조'],
      [/Nhà tù Hỏa Lò/gi, '호아로 수용소'],
      [/Hỏa Lò/gi, '호아로'],
      [/Nguyễn\s+Thái\s+H[oọ]c/gi, '응우옌 타이 혹'],
      [/Hoàng\s+Văn\s+Th[uụ]/gi, '호앙 반 투'],
      [/Trường\s+Chinh/gi, '쯔엉 찐'],
      [/Trần\s+Tử\s+Bình/gi, '쩐 뜨 빈'],
      [/Nguyễn\s+Đức\s+Cảnh/gi, '응우옌 득 까인'],
      [/Phụ\s+Khánh/gi, '푸카인'],
      [/Yên\s+Bái/gi, '옌바이'],
      [/Đông Sơn/gi, '동선'],
      [/Đạt Hồng/gi, '닷홍'],
      [/Lưỡng Long Triều Nhật/gi, '쌍룡조일'],
      [/Hà Nội/gi, '하노이']
    ]
  },
  zh: {
    promptHint: '标准译名: 火炉监狱 (Hoa Lo), 中央监狱 (Maison Centrale), 富庆村, 安沛 (Yen Bai), 阮太学, 黄文树, 长征, 陈子平, 阮德景, 卡绍暗牢 (Cachot), 断头台, 古榄仁树, 河内希尔顿, 东山铜鼓, 达鸿大洪钟, 阮朝皇室宝剑, 双龙朝日纹饰, 神圣之夜.',
    replacements: [
      [/延边/g, '安沛'],
      [/阮泰霍|阮太霍|阮泰学/g, '阮太学'],
      [/黄文图|黄文舒/g, '黄文树'],
      [/炉子监狱|烤炉监狱/g, '火炉监狱'],
      [/切割机/g, '断头台'],
      [/Nhà tù Hỏa Lò/gi, '火炉监狱'],
      [/Hỏa Lò/gi, '火炉'],
      [/Nguyễn\s+Thái\s+H[oọ]c/gi, '阮太学'],
      [/Hoàng\s+Văn\s+Th[uụ]/gi, '黄文树'],
      [/Trường\s+Chinh/gi, '长征'],
      [/Trần\s+Tử\s+Bình/gi, '陈子平'],
      [/Nguyễn\s+Đức\s+Cảnh/gi, '阮德景'],
      [/Phụ\s+Khánh/gi, '富庆'],
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

// Rò rỉ từ mở đầu tiếng Việt ở đầu câu ngoại ngữ (VD: "Đúng vậy. La guillotine...")
const VI_LEADING_LEAK_RE = /^(?:Dạ(?:\s+chào\s+bạn|\s+vâng)?|Đúng\s+vậy|Chào\s+bạn|Vâng)[,.!:\s]+/i;

// Bảng thuật ngữ di tích đa ngôn ngữ -> tiếng Việt chuẩn để ngăn dịch máy (MyMemory/GTX) dịch sai hiện vật (VD: 단두대 -> "quần"!)
const FOREIGN_QUERY_TERM_HINTS = [
  [/ホアロー(?:収容所)?|호아로(?:\s*수용소)?|火炉(?:监狱)?/g, ' Nhà tù Hỏa Lò '],
  [/ギロチン|단두대|断头台|\bguillotine\b/gi, ' máy chém Hỏa Lò '],
  [/カショ(?:独房)?|카쇼(?:\s*독방)?|卡绍(?:暗牢)?|黑牢|\bcachots?\b/gi, ' ngục tối Cachot Hỏa Lò '],
  [/モモタマナ(?:の木)?|バニヤン(?:の木)?|반얀나무|방나무|榄仁树|\bbadamier\b|\bbanyan\s+tree\b/gi, ' cây bàng Hỏa Lò '],
  [/下水道(?:脱獄)?|하수구(?:\s*탈옥)?|下水道(?:越狱)?|\bégouts?\b|\begouts?\b/gi, ' cống ngầm vượt ngục Hỏa Lò '],
  [/ハノイ[・\s]?ヒルトン|하노이\s*힐튼|河内希尔顿|米軍パイロット|미군\s*조종사|美国飞行员|\bpilotes?\s+américains?\b/gi, ' phi công Mỹ Hanoi Hilton Hỏa Lò '],
  [/聖なる夜|ナイトツアー|야간\s*투어|성스러운\s*밤|神圣之夜|夜游|\bnuit\s+sacrée\b|\bvisite\s+nocturne\b|\btour\s+de\s+nuit\b/gi, ' tour đêm Đêm thiêng liêng Hỏa Lò '],
  [/ドンソン銅鼓|동선\s*청동북|东山铜鼓|\btambour\s+de\s+bronze\b/gi, ' Trống đồng Đông Sơn Mã 001 '],
  [/ダットホン|大洪鐘|닷홍|대홍종|达鸿|大洪钟|\bcloche\s+de\s+bronze\b/gi, ' Đạt Hồng Đại Hồng Chung Mã 003 '],
  [/王室の宝剣|황실\s*보검|皇室宝剑|\bépée\s+royale\b/gi, ' Bảo kiếm Hoàng gia Mã 004 '],
  [/\btoilettes?\b|トイレ|お手洗い|화장실|洗手间|厕所|卫生间/gi, ' nhà vệ sinh WC Hỏa Lò '],
  [/\bprendre\s+des\s+photos?\b|\bphotographie\b|写真を撮|撮影して|사진을?\s*찍|촬영해|拍照|照相/gi, ' quy định chụp ảnh quay phim Hỏa Lò '],
  [/\bhoraires?\b|\bheures?\s+d['’]?ouverture\b|開館時間|営業時間|관람\s*시간|운영\s*시간|开放时间|几点开门/gi, ' giờ mở cửa Hỏa Lò '],
  [/\bbillets?\b|\btarifs?\b|\bprix\s+d['’]?entrée\b|入場料|チケット|입장료|티켓|门票|票价/gi, ' giá vé vào cửa Hỏa Lò '],
  [/\bconsignes?\b|\bcasiers?\b|ロッカー|물품\s*보관함|보관함|寄存柜|寄存/gi, ' tủ gửi đồ Hỏa Lò '],
  [/\baudioguides?\b|\baudio\s+guides?\b|音声ガイド|오디오\s*가이드|语音导览/gi, ' thuê máy thuyết minh Audioguide Hỏa Lò ']
];

/**
 * Chuẩn hóa trước các danh từ di tích cốt lõi trong câu hỏi ngoại ngữ để đảm bảo tra cứu đúng 100%
 * kể cả khi dịch máy MyMemory/GTX gặp thuật ngữ lịch sử hiếm.
 */
function extractForeignExhibitAnchors(rawQuery) {
  if (!rawQuery || typeof rawQuery !== 'string') return '';
  const anchors = [];
  for (const [re, viAnchor] of FOREIGN_QUERY_TERM_HINTS) {
    if (re.test(rawQuery)) {
      anchors.push(viAnchor.trim());
    }
  }
  return [...new Set(anchors)].join(', ');
}

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
 * - Với ngoại ngữ: gỡ chú thích tiếng Việt thừa trong ngoặc đơn, gỡ từ mở đầu tiếng Việt rò rỉ, và sửa lỗi dịch máy danh từ riêng.
 * - Với tiếng Việt: khôi phục dấu chuẩn cho danh từ riêng nếu LLM vô tình viết không dấu ("Hoa Lo" -> "Hỏa Lò").
 */
function postPolishForeignTerms(text, lang) {
  if (!text || typeof text !== 'string') return text;
  const code = String(lang || 'vi').toLowerCase().trim();
  const entry = GLOSSARY_BY_LANG[code];
  if (!entry) return text;

  let out = text;

  // 1. Gỡ chú thích tiếng Việt có dấu trong ngoặc đơn & từ mở đầu tiếng Việt rò rỉ (chỉ áp dụng cho ngoại ngữ!)
  if (code !== 'vi') {
    out = out.replace(VI_PARENTHETICAL_RE, '');
    out = out.replace(VI_LEADING_LEAK_RE, '').trim();
  }

  // 2. Thay thế các lỗi dịch máy / danh từ riêng chưa chuẩn hóa
  for (const [pattern, replacement] of entry.replacements) {
    out = out.replace(pattern, replacement);
  }

  // 3. Làm gọn khoảng trắng thừa quanh dấu câu
  out = out
    .replace(/\s+([,.;!?。！？、，])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return out;
}

module.exports = {
  GLOSSARY_BY_LANG,
  getGlossaryPromptHint,
  postPolishForeignTerms,
  extractForeignExhibitAnchors
};
