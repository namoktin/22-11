/**
 * =========================================================================================
 * 🌐 NATIVE 6-LANGUAGE HERITAGE DOCENT LIBRARY & SPOKEN REGISTER RULES (V1.0)
 * =========================================================================================
 * Cung cấp:
 * 1. Quy tắc văn phong thuyết minh bản ngữ (Spoken Register) cho cả 6 ngôn ngữ:
 *    - VI: Chững chạc, lịch thiệp ("Dạ...", "mình"-"bạn", đủ chủ vị, không ngôn ngữ mạng).
 *    - EN: Poised international museum docent, natural spoken numbers & cadence.
 *    - FR: Vouvoiement strict ("vous"), ton cultivé de guide-conférencier.
 *    - JA: 丁寧語・敬語 (です・ます調), nhịp âm thanh bảo tàng tự nhiên.
 *    - KO: 정중한 박물관 도슨트 어투 (하십시오체/해요체), tuyệt đối không 반말.
 *    - ZH: 端庄亲切的博物馆讲解员口吻, luôn dùng kính ngữ "您", chuẩn tên Hán-Việt lịch sử.
 * 2. Bộ câu trả lời bản ngữ chất lượng chuẩn bảo tàng cho các tình huống cốt lõi trên cả 6 thứ tiếng
 *    -> Phản hồi 0ms tức thì, không phải qua dịch máy vòng vèo, không bao giờ rò rỉ tiếng Việt.
 * =========================================================================================
 */

const NATIVE_REGISTER_RULES = {
  vi: 'In Vietnamese, speak like a mature, warm senior museum docent using courteous "Dạ..." / "Mình xin chia sẻ..." and "mình"–"bạn" with complete subject-predicate sentences; NEVER use teen slang ("nè", "đấy!", "nha").',
  en: 'In English, speak with the poised, warm cadence of an international museum audio guide. Write numbers and currency naturally for speech (e.g., "50,000 Vietnamese dong", "8:00 AM to 5:00 PM") and never include Vietnamese words in parentheses.',
  fr: 'En français, adoptez le ton posé et raffiné d’un guide-conférencier de musée en utilisant strictement le vouvoiement (« vous »), jamais « tu ». Employez les termes historiques justes (Prison de Hoa Lo, Maison Centrale, cachots, guillotine, badamier) sans aucun mot vietnamien entre parenthèses.',
  ja: '日本語では、美術館・博物館のベテラン音声ガイドとして丁寧語・敬語（です・ます調、「ご説明いたします」「〜でございます」）のみを使い、常体（だ・である）や不自然な直訳を避けてください。句読点（。、）を自然に入れ、ベトナム語の注釈は一切入れないでください。',
  ko: '한국어에서는 품격 있고 따뜻한 박물관 전문 도슨트 어투(하십시오체·해요체, 예: "안내해 드리겠습니다", "~입니다")만 사용하고 반말은 절대 쓰지 마세요. 괄호 안에 베트남어 원문을 넣지 마세요.',
  zh: '中文请采用端庄、温和、地道的博物馆资深讲解员口吻，全程使用敬称“您”，避免生硬机翻腔。历史专有名词使用规范中越译名（如火炉监狱、安沛起义、阮太学、黄文树），切勿在括号内夹杂越南语原文。'
};

function normalizeLang(lang) {
  const c = String(lang || 'vi').toLowerCase().trim().split(/[-_]/)[0];
  return NATIVE_REGISTER_RULES[c] ? c : 'vi';
}

function getNativeRegisterInstruction(lang = 'vi') {
  return NATIVE_REGISTER_RULES[normalizeLang(lang)] || NATIVE_REGISTER_RULES.vi;
}

const DOCENT_MESSAGES = {
  PROMPT_INJECTION: {
    vi: 'Dạ mình là hướng dẫn viên ảo chính thức tại Di tích Lịch sử Nhà tù Hỏa Lò, luôn giữ nguyên vai trò chia sẻ tư liệu lịch sử xác thực và đồng hành hỗ trợ du khách tham quan. Rất hân hạnh được giải đáp cùng bạn về các hiện vật và câu chuyện nơi đây.',
    en: 'I serve as the official virtual docent of Hoa Lo Prison Historical Relic, dedicated to sharing verified history and assisting your visit. I must stay faithful to that role, and I would be glad to guide you through any exhibit or story here at Hoa Lo.',
    fr: 'Je suis le guide virtuel officiel du site historique de la Prison de Hoa Lo, dédié au partage d’archives historiques vérifiées et à l’accompagnement de votre visite. Je dois rester fidèle à ce rôle et serai ravi de vous présenter les salles et les récits de Hoa Lo.',
    ja: '私はホアロー収容所歴史遺跡の公式バーチャルガイドとして、検証された歴史資料のご案内とご来館のサポートを専門としております。その役割を守りながら、展示物や歴史物語について丁寧にご案内いたします。',
    ko: '저는 호아로 수용소 역사 유적의 공식 가상 도슨트로서, 검증된 역사 자료를 안내하고 관람을 돕는 역할에 충실해야 합니다. 호아로의 전시물과 역사 이야기에 대해 궁금하신 점을 정성껏 안내해 드리겠습니다.',
    zh: '我是河内火炉监狱历史遗迹的官方语音讲解员，始终恪守职责，为您提供经核实的史料讲解与参观导览服务。非常荣幸继续为您介绍这里的展区与历史故事。'
  },

  EXPIRED_POLICY: {
    vi: 'Dạ bạn lưu ý giúp mình nhé: mức giá vé 30.000 VNĐ là chính sách cũ trước năm 2016 và hiện nay ĐÃ HẾT HIỆU LỰC. Theo quy định hiện hành (Quyết định số 21/2021/QĐ-UBND), giá vé tham quan ban ngày tại Di tích Hỏa Lò là 50.000 VNĐ/người lớn (ưu đãi 50% còn 25.000 VNĐ cho học sinh, sinh viên và người cao tuổi).',
    en: 'Please note that the 30,000 VND ticket price was an older policy prior to 2016 and is currently EXPIRED. Under the current regulation (Decision No. 21/2021/QD-UBND), the standard daytime ticket to Hoa Lo Prison is 50,000 VND/adult (with a 50% discount to 25,000 VND for students and seniors).',
    fr: 'Veuillez noter que le tarif de 30 000 dongs vietnamiens correspondait à un ancien barème antérieur à 2016 et n’est plus en vigueur. Selon la réglementation actuelle, le billet d’entrée de jour à la Prison de Hoa Lo coûte 50 000 dongs par adulte, avec une réduction de 50 % à 25 000 dongs pour les étudiants et les seniors.',
    ja: '30,000ベトナムドンという入場料は2016年以前の旧料金であり、現在は終了しております。現行の規定では、ホアロー収容所の日中入場料は大人50,000ベトナムドン、学生および高齢者の方は50パーセント割引の25,000ベトナムドンとなっております。',
    ko: '30,000 베트남 동 요금은 2016년 이전의 구 규정으로 현재는 만료되었습니다. 현행 규정에 따라 호아로 수용소 주간 입장권은 성인 50,000 베트남 동이며, 학생과 만 60세 이상 어르신은 50퍼센트 할인된 25,000 베트남 동입니다.',
    zh: '温馨提示您，30,000越南盾是2016年之前的旧票价，现已停止执行。按照现行规定，火炉监狱日间门票为成人50,000越南盾，学生及老年人凭有效证件可享五折优惠，为25,000越南盾。'
  },

  EXTREME_NOISE: {
    vi: 'Chào bạn! Mình chưa nhận rõ câu hỏi của bạn. Bạn có thể hỏi về lịch sử Nhà tù Hỏa Lò, các hiện vật (Cỗ máy chém, Cây bàng, Ngục tối Cachot, Cống ngầm 1951), giá vé, giờ mở cửa hoặc hỏi "Đây là đâu?" nhé!',
    en: 'Hello! I did not catch a specific question. You can ask me about Hoa Lo Prison history, exhibits (Guillotine, Banyan tree, Cachot, US pilots), ticket prices, or opening hours!',
    fr: 'Bonjour ! Je n’ai pas bien saisi votre question. Vous pouvez m’interroger sur l’histoire de la Prison de Hoa Lo, ses objets exposés comme la guillotine, les cachots ou le badamier historique, ainsi que sur les tarifs et les horaires d’ouverture.',
    ja: 'こんにちは。ご質問の内容がうまく聞き取れませんでした。ホアロー収容所の歴史やギロチン、カショ独房、モモタマナの木などの展示物、入場料や開館時間についてお気軽にご質問ください。',
    ko: '안녕하세요! 질문 내용을 정확히 파악하지 못했습니다. 호아로 수용소의 역사, 단두대, 카쇼 독방, 반얀나무 전시물이나 입장료, 관람 시간 등에 대해 편하게 질문해 주세요.',
    zh: '您好，我未能听清您的具体问题。欢迎您询问河内火炉监狱的历史、断头台、黑牢、古榄仁树等展品，或门票与开放时间信息。'
  },

  GREETING: {
    vi: 'Dạ xin chào mừng bạn đến với Di tích Lịch sử Nhà tù Hỏa Lò. Mình là hướng dẫn viên ảo tại di tích, rất hân hạnh được đồng hành cùng bạn tìm hiểu các hiện vật, câu chuyện lịch sử và thông tin tham quan hôm nay. Bạn muốn bắt đầu từ chủ đề nào trước?',
    en: 'Hello and a warm welcome to Hoa Lo Prison Historical Relic. I am your virtual docent, honored to accompany you through the exhibits, historical narratives, and practical guidance for your visit today. Where would you like to begin?',
    fr: 'Bonjour et bienvenue au site historique de la Prison de Hoa Lo. Je suis votre guide virtuel et je suis ravi de vous accompagner à travers les salles, les récits historiques et les informations pratiques de votre visite. Par quel sujet souhaitez-vous commencer ?',
    ja: 'こんにちは。ホアロー収容所歴史遺跡へようこそ。私はバーチャルガイドとして、展示物や歴史物語、ご見学のご案内を心を込めてお手伝いいたします。どちらの展示やテーマからご覧になりますか。',
    ko: '안녕하세요, 호아로 수용소 역사 유적에 오신 것을 진심으로 환영합니다. 저는 여러분의 관람을 돕는 가상 도슨트입니다. 전시물과 역사 이야기, 관람 안내 중 어떤 주제부터 시작해 볼까요?',
    zh: '您好，欢迎您来到河内火炉监狱历史遗迹。我是这里的智能语音讲解员，非常荣幸陪伴您探索展区史料、文物故事与参观指南。请问您想先了解哪一部分？'
  },

  THANK_YOU: {
    vi: 'Dạ rất hân hạnh được đồng hành cùng bạn. Chúc bạn có một hành trình tham quan Di tích Lịch sử Nhà tù Hỏa Lò thật lắng đọng, sâu sắc và nhiều ý nghĩa.',
    en: 'You are most welcome—it is truly my pleasure to accompany you. Wishing you a deeply reflective, meaningful, and memorable journey through Hoa Lo Prison Historical Relic.',
    fr: 'Je vous en prie, c’est un véritable plaisir de vous accompagner. Je vous souhaite une visite pleine d’émotion et de sens au sein de la Prison de Hoa Lo.',
    ja: 'どういたしまして。ご案内できて光栄でございます。ホアロー収容所歴史遺跡でのご見学が、心に残る実り豊かなひとときとなりますよう願っております。',
    ko: '천만에요, 함께 안내해 드릴 수 있어 진심으로 기쁩니다. 호아로 수용소 역사 유적에서 깊이 있고 뜻깊은 관람 시간 보내시길 바랍니다.',
    zh: '不客气，非常荣幸为您讲解。祝您在河内火炉监狱历史遗迹拥有一段沉静、深刻且富有意义的参观之旅。'
  },

  GOODBYE: {
    vi: 'Dạ xin cảm ơn bạn đã ghé thăm Di tích Lịch sử Nhà tù Hỏa Lò hôm nay. Chúc bạn thượng lộ bình an và có thật nhiều trải nghiệm đáng nhớ tại thủ đô Hà Nội.',
    en: 'Goodbye, and thank you for visiting Hoa Lo Prison Historical Relic today. Wishing you safe travels and many memorable moments exploring the heritage of Hanoi.',
    fr: 'Au revoir et merci de votre visite à la Prison de Hoa Lo aujourd’hui. Je vous souhaite un excellent séjour et de très belles découvertes à Hanoï.',
    ja: '本日はホアロー収容所歴史遺跡へお越しいただき、誠にありがとうございました。どうぞお気をつけて、ハノイでの素敵な旅をお楽しみください。',
    ko: '오늘 호아로 수용소 역사 유적을 방문해 주셔서 진심으로 감사합니다. 안녕히 가시고, 하노이에서 뜻깊고 즐거운 여행 이어가시길 바랍니다.',
    zh: '感谢您今天到访河内火炉监狱历史遗迹，再见！祝您旅途平安，在河内收获更多美好而难忘的文化体验。'
  },

  BOT_USER_IDENTITY: {
    vi: 'Dạ bạn là vị khách quý đang đồng hành tham quan tại Di tích Nhà tù Hỏa Lò hôm nay. Mình chưa được biết quý danh của bạn, rất hân hạnh nếu bạn chia sẻ để mình tiện xưng hô và giới thiệu các câu chuyện lịch sử phù hợp.',
    en: 'You are our honored guest visiting Hoa Lo Prison Historical Relic today. You have not shared your name with me yet, so please let me know how you prefer to be addressed, and which exhibit you would like to explore.',
    fr: 'Vous êtes notre visiteur privilégié à la Prison de Hoa Lo aujourd’hui. Comme vous ne m’avez pas encore indiqué votre nom, n’hésitez pas à me le partager et à me dire quelle salle vous souhaitez découvrir.',
    ja: 'お客様は本日ホアロー収容所歴史遺跡をご見学中の大切なゲストでいらっしゃいます。まだお名前を伺っておりませんので、よろしければお呼び方とご関心のある展示をお知らせください。',
    ko: '고객님은 오늘 호아로 수용소 역사 유적을 찾아주신 소중한 방문객이십니다. 아직 성함을 듣지 못했는데, 편하신 호칭과 궁금한 전시 구역을 알려주시면 정성껏 안내해 드리겠습니다.',
    zh: '您今天是到访河内火炉监狱历史遗迹的尊贵来宾。您尚未告诉我您的称呼，欢迎随时告知，并告诉我您最想先参观哪一个展区。'
  },

  BOT_LOCATION: {
    vi: 'Dạ mình luôn hiện diện ngay bên cạnh trên thiết bị hướng dẫn để đồng hành cùng bạn qua từng phòng trưng bày. Bạn đang quan tâm đến hiện vật hay dấu tích nào trước mắt, mình sẵn sàng thuyết minh ngay.',
    en: 'I am right here alongside you through your guide device, accompanying every step of your tour across the galleries. Please ask whenever an exhibit or historical detail sparks your interest.',
    fr: 'Je suis juste à vos côtés sur votre appareil de visite pour vous accompagner dans chaque salle d’exposition. N’hésitez pas à m’interroger dès qu’un objet ou un détail historique attire votre attention.',
    ja: '私はお手元のガイド機器を通じて、各展示室のご見学にずっと寄り添っております。目の前の展示物や歴史について気になることがございましたら、いつでもお尋ねください。',
    ko: '저는 고객님의 가이드 기기 속에서 전시실 곳곳을 함께 동행하고 있습니다. 눈앞의 유물이나 역사적 배경이 궁금하실 때 언제든 편하게 물어봐 주세요.',
    zh: '我就在您的导览设备中，随时陪伴您走过每一间展室。无论您对眼前哪一件文物或哪一段历史感兴趣，我都可以立即为您讲解。'
  },

  BOT_IDENTITY: {
    vi: 'Dạ xin chào bạn, mình là hướng dẫn viên ảo của Di tích Lịch sử Nhà tù Hỏa Lò. Mình luôn sẵn sàng đồng hành cùng bạn bằng nguồn tư liệu lịch sử xác thực để lắng nghe và chia sẻ những câu chuyện giàu chiều sâu về con người và hiện vật nơi đây. Bạn muốn mình dẫn chuyện về chủ đề nào trước?',
    en: 'I am the virtual docent of Hoa Lo Prison Historical Relic in Hanoi. While I do not have a physical age, I bring together verified historical archives, exhibit stories, and visiting guidance to accompany you with clarity and care throughout your visit.',
    fr: 'Je suis le guide virtuel officiel du site historique de la Prison de Hoa Lo à Hanoï. Je rassemble les archives historiques vérifiées, les récits des objets exposés et les conseils pratiques pour vous accompagner tout au long de votre parcours.',
    ja: '私はハノイのホアロー収容所歴史遺跡のバーチャルガイドでございます。検証された歴史資料をもとに、展示物の物語やご見学のご案内を分かりやすくお伝えいたします。どちらのテーマからご案内いたしましょうか。',
    ko: '저는 하노이 호아로 수용소 역사 유적의 가상 도슨트입니다. 검증된 역사 자료를 바탕으로 유물의 이야기와 관람 안내를 정성껏 전해 드리고 있습니다. 어떤 주제부터 함께 살펴볼까요?',
    zh: '您好，我是河内火炉监狱历史遗迹的智能语音讲解员。我依托经核实的馆藏史料，为您生动讲述这里的文物故事并提供贴心的参观指引。您想先听哪一段历史呢？'
  },

  JOKE_REQUEST: {
    vi: 'Dạ Nhà tù Hỏa Lò là không gian di tích lịch sử trang nghiêm, nơi tưởng niệm sự hy sinh cao cả và ý chí bất khuất của các chiến sĩ yêu nước, nên mình xin phép không kể chuyện hài hước tại đây. Thay vào đó, mình rất sẵn lòng kể bạn nghe những câu chuyện có thật đầy trí tuệ, lạc quan và tình đồng chí cảm động của người tù năm xưa.',
    en: 'Hoa Lo Prison is a solemn, sacred place of remembrance honoring extraordinary courage and sacrifice, so telling a joke would not be fitting here. Instead, I would be glad to share remarkable true stories of wit, resilience, and quiet camaraderie among the prisoners.',
    fr: 'La Prison de Hoa Lo est un lieu de mémoire solennel qui honore le courage et le sacrifice des patriotes ; il ne serait donc pas approprié d’y raconter une blague. En revanche, je peux vous partager de véritables récits pleins d’esprit, de résilience et de fraternité entre détenus.',
    ja: 'ホアロー収容所は、愛国者たちの勇気と犠牲を悼む厳粛な歴史の場であるため、冗談をお話しすることは控えさせていただいております。代わりに、過酷な獄中でも希望と機知を失わなかった人々の感動的な実話をご紹介できます。',
    ko: '호아로 수용소는 애국지사들의 용기와 희생을 기리는 엄숙한 역사 공간이므로 농담은 삼가고 있습니다. 대신, 혹독한 수감 생활 속에서도 기지와 낙관, 동지애를 잃지 않았던 실제 감동 이야기를 들려드릴 수 있습니다.',
    zh: '河内火炉监狱是一处庄严肃穆的历史纪念地，铭记着先辈的英勇与牺牲，因此这里不便讲笑话。不过，我很乐意为您讲述当年囚犯在逆境中展现智慧、乐观与真挚战友情谊的真实故事。'
  },

  HIGHLIGHTS_REQUEST: {
    vi: 'Mình xin gợi ý cho bạn những điểm nhấn ấn tượng và giàu ý nghĩa lịch sử nhất tại Di tích Hỏa Lò mà bạn không nên bỏ lỡ: Cổng chính Maison Centrale kiên cố từ năm 1896, Ngục tối Cachot ("địa ngục của địa ngục"), Cỗ máy chém thời Pháp, Cây bàng cổ thụ tại sân trại, Cửa cống ngầm vượt ngục huyền thoại năm 1951, Khu trưng bày phi công Mỹ ("Hanoi Hilton"), và Đài tưởng niệm tri ân các anh hùng liệt sĩ.',
    en: 'The top must-see highlights at Hoa Lo Prison include: the formidable Maison Centrale Main Gate (1896), the pitch-dark Cachot cells ("hell within hell"), the original French Guillotine, the historic Banyan Tree in the prison yard, the 1951 escape sewer exit, the American pilots exhibition ("Hanoi Hilton"), and the solemn Memorial Monument.',
    fr: 'Voici les incontournables de la Prison de Hoa Lo : le portail principal de la Maison Centrale datant de 1896, les cachots obscurs, la guillotine originale de l’époque coloniale, le badamier historique de la cour, l’égout de la célèbre évasion de 1951, la salle consacrée aux pilotes américains surnommée Hanoi Hilton, et le monument commémoratif.',
    ja: 'ホアロー収容所の主な見どころをご案内いたします。1896年建造のメゾン・サントラル正門、地獄の中の地獄と呼ばれたカショ独房、フランス植民地時代の本物のギロチン、中庭の歴史的なモモタマナの木、1951年脱獄の下水道口、ハノイ・ヒルトンとして知られる米軍パイロット展示室、そして厳粛な慰霊碑をぜひご覧ください。',
    ko: '호아로 수용소에서 꼭 보셔야 할 핵심 전시 구역을 안내해 드리겠습니다. 1896년 세워진 메종 상트랄 정문, 지옥 속의 지옥이라 불린 카쇼 독방, 프랑스 식민 시대의 실제 단두대, 안뜰의 역사적인 반얀나무, 1951년 탈옥 하수구, 하노이 힐튼으로 불린 미군 조종사 전시실, 그리고 추모 기념비입니다.',
    zh: '为您推荐河内火炉监狱最不容错过的核心看点：始建于1896年的中央监狱正门、被称为“地狱中的地狱”的卡绍暗牢、法国殖民时期的原装断头台、院中的古榄仁树、1951年传奇越狱的下水道出口、被称为“河内希尔顿”的美国飞行员展区，以及庄严的烈士纪念碑。'
  },

  PARKING_SUPPORT: {
    vi: 'Về chỗ gửi xe khi tham quan Di tích Hỏa Lò: Xe máy bạn có thể gửi tại khu vực trước cổng di tích theo hướng dẫn trực tiếp của nhân viên bảo vệ trên phố Hỏa Lò. Đối với ô tô, do khuôn viên di tích không có bãi đỗ xe riêng, bạn vui lòng gửi xe tại tòa nhà Tháp Hà Nội (Hanoi Towers) ngay kế bên số 49 Hai Bà Trưng, hoặc các bãi gửi xe công cộng trên phố Dã Tượng và Lý Thường Kiệt nhé.',
    en: 'Parking guidelines for Hoa Lo Prison: Motorbikes can be parked on the designated sidewalk directly outside the main gate under the guidance of our security guards. For cars, as the relic does not have an on-site automobile lot, please park at the adjacent Hanoi Towers building (No. 49 Hai Ba Trung) or at public parking lots along Da Tuong and Ly Thuong Kiet streets.',
    fr: 'Concernant le stationnement près de la Prison de Hoa Lo : les motos peuvent être garées devant l’entrée principale sous la direction des agents de sécurité. Pour les voitures, le site ne disposant pas de parking privé, vous pouvez vous garer au bâtiment voisin Hanoi Towers au 49 rue Hai Ba Trung, ou dans les parkings publics des rues Da Tuong et Ly Thuong Kiet.',
    ja: '駐車場のご案内です。バイクはホアロー通り沿いの正門前エリアにて警備員の誘導に従って駐車いただけます。お車につきましては敷地内に専用駐車場がないため、隣接するハイバーチュン通り49番のハノイタワーズ、またはザートゥオン通りやリートゥオンキエット通りの公共駐車場をご利用ください。',
    ko: '호아로 수용소 주차 안내입니다. 오토바이는 호아로 거리 정문 앞 지정 구역에 경비 직원의 안내에 따라 주차하실 수 있습니다. 승용차는 유적 내 전용 주차장이 없으므로 바로 옆 하이바쯩 거리 49번지 하노이 타워 주차장이나 자뜨엉 거리, 리트엉끼엣 거리의 공영 주차장을 이용해 주세요.',
    zh: '关于火炉监狱的停车指引：摩托车可在火炉街正门外指定区域听从保安指引停放；小汽车因景区内未设专用停车场，建议停放至紧邻的二征夫人街49号河内塔大楼，或野象街与李常杰街沿线的公共停车场。'
  },

  PHOTOGRAPHY_POLICY: {
    vi: 'Dạ chào bạn, tại Di tích Nhà tù Hỏa Lò, du khách hoàn toàn được mang điện thoại và máy ảnh cá nhân vào chụp ảnh lưu niệm thông thường. Bạn lưu ý giúp mình là TẮT ĐÈN FLASH tại các buồng giam để bảo quản hiện vật và giữ sự trang nghiêm; còn việc quay phim, chụp ảnh thương mại hoặc dàn dựng cần đăng ký trước với Ban Quản lý Di tích nhé.',
    en: 'Visitors are welcome to take souvenir photos with phones and personal cameras throughout the site. Please note: TURN OFF CAMERA FLASH inside the cellblocks to preserve artifacts and maintain solemnity. Commercial photography, videography, or staged shoots require prior permission from the Relic Management Board.',
    fr: 'Vous pouvez tout à fait prendre des photos souvenirs avec votre téléphone ou votre appareil photo personnel. Veuillez toutefois désactiver le flash dans les cellules afin de préserver les objets historiques et de respecter la solennité des lieux. Tout tournage ou séance photo à usage commercial nécessite une autorisation préalable de la direction du site.',
    ja: '館内ではスマートフォンや個人用カメラでの記念撮影をお楽しみいただけます。ただし、展示物の保護と厳粛な空間を守るため、独房や展示室内ではフラッシュをオフにしてください。商業目的の撮影や取材につきましては、事前に遺跡管理委員会の許可が必要です。',
    ko: '관내에서는 휴대전화와 개인 카메라로 기념 사진을 자유롭게 촬영하실 수 있습니다. 다만 유물 보존과 엄숙한 분위기 유지를 위해 감방과 전시실 내부에서는 반드시 플래시를 꺼 주시기 바랍니다. 상업적 촬영이나 방송 취재는 유적 관리위원회의 사전 승인이 필요합니다.',
    zh: '欢迎您在参观时使用手机或个人相机拍照留念。为保护珍贵文物并维护肃穆氛围，请您在监室和展厅内务必关闭闪光灯；如需进行商业拍摄或专题摄制，须提前向遗迹管理委员会申请许可。'
  },

  DINING_VICINITY: {
    vi: 'Di tích Nhà tù Hỏa Lò không phục vụ ăn uống bên trong khuôn viên (chỉ có nước uống đóng chai tại quầy lưu niệm). Tuy nhiên, ngay trên phố Hỏa Lò và các con phố lân cận như Dã Tượng, Quán Sứ, Lý Thường Kiệt có rất nhiều quán phở bò gia truyền, bún chả và quán cà phê Hà Nội ngon, bạn có thể ghé thưởng thức ngay sau chuyến tham quan nhé!',
    en: 'Hoa Lo Prison does not provide food services inside the historical grounds (bottled water is available at the souvenir shop). However, right outside on Hoa Lo Street and neighboring streets such as Da Tuong, Quan Su, and Ly Thuong Kiet, you can easily find authentic Hanoi traditional beef pho, bun cha, and charming cafes to enjoy after your tour!',
    fr: 'Il n’y a pas de service de restauration à l’intérieur de la Prison de Hoa Lo, mais de l’eau en bouteille est disponible à la boutique souvenirs. Juste à l’extérieur, dans les rues Hoa Lo, Da Tuong, Quan Su et Ly Thuong Kiet, vous trouverez facilement d’excellents restaurants de pho, de bun cha et de charmants cafés hanoïens.',
    ja: 'ホアロー収容所の敷地内には飲食施設はございませんが、ミュージアムショップでペットボトル飲料をご購入いただけます。ご見学後は、すぐ外のホアロー通りやザートゥオン通り、クアンスー通り、リートゥオンキエット通り沿いに、本場のフォーやブンチャー、雰囲気の良いカフェが多数ございます。',
    ko: '호아로 수용소 내부에는 식당이 없으며, 기념품 매장에서 생수만 구매하실 수 있습니다. 관람을 마치신 뒤 바로 바깥 호아로 거리와 인근 자뜨엉, 꽌스, 리트엉끼엣 거리로 나가시면 하노이 정통 쌀국수, 분짜 맛집과 아늑한 카페를 쉽게 찾으실 수 있습니다.',
    zh: '火炉监狱景区内不设餐饮服务，仅在纪念品商店提供瓶装饮用水。参观结束后，您走出大门即可在火炉街及周边的野象街、馆使街、李常杰街轻松找到地道河内牛肉河粉、烤肉米线和特色咖啡馆。'
  },

  VICINITY_DISTANCE: {
    vi: 'Từ Di tích Nhà tù Hỏa Lò (số 1 phố Hỏa Lò) đi bộ ra Hồ Gươm (khu vực ngã tư Tràng Tiền - Đinh Tiên Hoàng hoặc Hàng Khay) mất khoảng 10 đến 15 phút, với quãng đường chừng 800m đến 1km. Bạn có thể đi theo đường Hỏa Lò rồi rẽ sang Lý Thường Kiệt hoặc Thợ Nhuộm để đi bộ thẳng ra hồ rất thuận tiện ạ.',
    en: 'From Hoa Lo Prison (No. 1 Hoa Lo Street) to Hoan Kiem Lake is approximately 800m to 1km, taking about 10 to 15 minutes of relaxed walking via Ly Thuong Kiet or Tho Nhuom Street toward Dinh Tien Hoang / Hang Khay.',
    fr: 'Depuis la Prison de Hoa Lo au 1 rue Hoa Lo jusqu’au lac Hoan Kiem, la distance est d’environ 800 mètres à 1 kilomètre, soit 10 à 15 minutes de marche agréable en empruntant la rue Ly Thuong Kiet ou la rue Tho Nhuom.',
    ja: 'ホアロー収容所からホアンキエム湖までは約800メートルから1キロメートルで、徒歩およそ10分から15分です。リートゥオンキエット通りまたはトニュオム通りをまっすぐ進まれると分かりやすく便利です。',
    ko: '호아로 수용소에서 호안끼엠 호수까지는 약 800미터에서 1킬로미터 거리로, 도보로 10분에서 15분 정도 걸립니다. 리트엉끼엣 거리나 터뉴옴 거리를 따라 걸어가시면 편리하게 도착하실 수 있습니다.',
    zh: '从火炉监狱步行前往还剑湖约800米至1公里，悠闲步行大约需要10至15分钟。您可以沿火炉街转入李常杰街或染匠街直行，路线十分便利。'
  },

  SUMMARY_3_SENTENCES: {
    vi: 'Mình xin tóm tắt lịch sử Nhà tù Hỏa Lò qua 3 câu ngắn gọn cho bạn dễ nhớ nhé. Thứ nhất, Nhà tù Hỏa Lò do thực dân Pháp xây dựng năm 1896 trên đất làng Phụ Khánh để giam giữ những người Việt Nam yêu nước. Thứ hai, nơi đây từng là "địa ngục trần gian" khét tiếng nhưng các chiến sĩ kiên trung đã biến nơi này thành trường học cách mạng. Thứ ba, ngày nay di tích là điểm đến lịch sử thiêng liêng nhằm tri ân sự hy sinh anh dũng và giáo dục truyền thống yêu nước.',
    en: 'Here is the history of Hoa Lo Prison in three concise sentences. First, Hoa Lo Prison was built by French colonialists in 1896 on Phu Khanh village land to detain Vietnamese patriots and revolutionaries. Second, once feared as a brutal hell on earth, resilient prisoners transformed it into a revolutionary school of courage and daring escapes. Third, today it stands as a sacred national relic honoring heroic sacrifice and preserving Hanoi’s historical memory.',
    fr: 'Voici l’histoire de la Prison de Hoa Lo en trois phrases. Premièrement, elle fut construite en 1896 par les autorités coloniales françaises sur les terres du village de Phu Khanh pour détenir les patriotes vietnamiens. Deuxièmement, malgré des conditions terribles, les prisonniers politiques en ont fait une véritable école révolutionnaire marquée par des évasions audacieuses. Troisièmement, elle constitue aujourd’hui un lieu de mémoire national dédié à l’hommage et à la transmission historique.',
    ja: 'ホアロー収容所の歴史を三つの文にまとめてご案内いたします。第一に、1896年にフランス植民地当局が愛国者や革命家を収容するため、フーカイン村の跡地に建設しました。第二に、過酷な地獄のような環境の中でも、政治犯たちはここを学びと連帯の場へと変え、大胆な脱獄も成し遂げました。第三に、現在は先人たちの勇気と犠牲を悼み、歴史を次世代へ伝える神聖な遺跡として保存されています。',
    ko: '호아로 수용소의 역사를 세 문장으로 간략히 정리해 드리겠습니다. 첫째, 1896년 프랑스 식민 당국이 베트남 애국지사들을 수감하기 위해 푸카인 마을 터에 건설했습니다. 둘째, 혹독한 환경 속에서도 정치범들은 이곳을 배움과 저항의 학교로 바꾸어 냈습니다. 셋째, 오늘날에는 영웅들의 희생을 기리고 역사를 전하는 소중한 국가 유적으로 보존되고 있습니다.',
    zh: '为您用三句话概括河内火炉监狱的历史。第一，它始建于1896年，是法国殖民当局在原富庆村土地上建造的监狱，用于关押越南爱国志士。第二，尽管环境极其残酷，坚贞的革命者们却把这里变成了革命学校，并留下了传奇的越狱壮举。第三，如今它作为庄严的国家历史遗迹，缅怀先烈牺牲并向世人传承珍贵历史。'
  },

  TIME_FEASIBILITY: {
    vi: 'Di tích Hỏa Lò mở cửa đón khách đến 17:00 chiều hàng ngày. Bây giờ là 4 giờ 15 thì bạn vẫn còn khoảng 45 phút, hoàn toàn KỊP xem các điểm cốt lõi nhất nếu bạn đi theo lộ trình rút gọn: Cổng chính Maison Centrale ➡️ Ngục tối Cachot ➡️ Cỗ máy chém ➡️ Cây bàng sân trại ➡️ Cửa cống ngầm ➡️ Đài tưởng niệm. Bạn hãy vào mua vé ngay để kịp thời gian nhé!',
    en: 'Hoa Lo Prison welcomes visitors until 5:00 PM daily. At 4:15 PM, you still have about 45 minutes, which is enough time to explore the core highlights: Main Gate ➡️ Cachot dark cells ➡️ Guillotine ➡️ Banyan tree courtyard ➡️ Escape sewer ➡️ Memorial Monument. Please proceed to the ticket counter right away to maximize your visit!',
    fr: 'La Prison de Hoa Lo reste ouverte jusqu’à 17 heures tous les jours. À 16 h 15, il vous reste environ 45 minutes, ce qui suffit pour voir l’essentiel : le portail principal ➡️ les cachots ➡️ la guillotine ➡️ le badamier dans la cour ➡️ l’égout d’évasion ➡️ le monument commémoratif. Je vous invite à prendre votre billet sans attendre.',
    ja: 'ホアロー収容所は毎日17時まで開館しております。16時15分からでも約45分ございますので、正門 ➡️ カショ独房 ➡️ ギロチン ➡️ 中庭のモモタマナの木 ➡️ 脱獄の下水道口 ➡️ 慰霊碑という主要ルートを十分にご覧いただけます。ぜひお早めにチケットをお求めください。',
    ko: '호아로 수용소는 매일 오후 5시까지 운영합니다. 오후 4시 15분이라면 약 45분의 시간이 남아 있어 정문 ➡️ 카쇼 독방 ➡️ 단두대 ➡️ 안뜰 반얀나무 ➡️ 탈옥 하수구 ➡️ 추모 기념비의 핵심 동선을 충분히 둘러보실 수 있습니다. 지금 바로 매표소에서 입장권을 구매해 보세요.',
    zh: '火炉监狱每日开放至下午5点。现在下午4点15分，您还有约45分钟，完全来得及游览精华路线：正门 ➡️ 卡绍暗牢 ➡️ 断头台 ➡️ 院中古榄仁树 ➡️ 越狱下水道口 ➡️ 烈士纪念碑。建议您立即前往售票处购票入馆。'
  },

  WEATHER_ADVISORY: {
    vi: 'Trời mưa bạn vẫn tham quan Hỏa Lò rất thuận tiện nhé! Khoảng 85-90% không gian tham quan (gồm các dãy phòng giam tập thể, xà lim tử hình, ngục tối Cachot, khu máy chém và phòng trưng bày chuyên đề) đều nằm hoàn toàn trong nhà và có hành lang mái che kiên cố. Chỉ có khu vực sân trại giam và cây bàng lịch sử là ngoài trời, bạn có thể mang theo ô hoặc di chuyển nhanh qua khu vực này là không lo bị ướt ạ.',
    en: 'Visiting Hoa Lo Prison during heavy rain is very comfortable! Around 85–90% of the tour areas—including collective cells, death row cells, Cachot, guillotine room, and thematic exhibitions—are fully indoors with sheltered corridors. Only the courtyard and ancient banyan tree are outdoors, so you can easily carry an umbrella or pass through quickly without worrying about getting wet.',
    fr: 'Même par forte pluie, la visite de la Prison de Hoa Lo reste très agréable. Environ 85 à 90 % du parcours — les cellules collectives, les cachots, la salle de la guillotine et les galeries thématiques — se trouvent à l’intérieur ou sous des couloirs couverts. Seule la cour du badamier historique est à ciel ouvert.',
    ja: '雨の日でもホアロー収容所はとても快適にご見学いただけます。雑居房、死刑囚独房、カショ独房、ギロチン展示室、企画展示室など全体の約85から90パーセントは屋内や屋根付き廊下となっております。屋外は中庭のモモタマナの木周辺のみですので、傘をお持ちであれば安心です。',
    ko: '비가 많이 오는 날에도 호아로 수용소는 매우 쾌적하게 관람하실 수 있습니다. 공동 감방, 사형수 독방, 카쇼 독방, 단두대 전시실 등 전체 동선의 약 85에서 90퍼센트가 실내이거나 지붕이 있는 복도로 연결되어 있으며, 안뜰의 반얀나무 구역만 야외입니다.',
    zh: '下雨天参观火炉监狱同样非常方便。馆内约85%至90%的区域——包括集体监室、死刑囚室、卡绍暗牢、断头台展室及专题展厅——均位于室内并设有遮雨走廊，仅中庭古榄仁树区域为露天，携带一把雨伞即可轻松游览。'
  },

  TOUR_START_GUIDANCE: {
    vi: 'Mình gợi ý cho bạn lộ trình tham quan chuẩn và giàu cảm xúc nhất tại Hỏa Lò nhé: Bắt đầu từ Cổng chính Maison Centrale ➡️ Xem sa bàn và các dãy buồng giam tập thể (Trại giam Nam) ➡️ Ngục tối Cachot ➡️ Sân trại giam và Cây bàng cổ thụ ➡️ Phòng trưng bày Cỗ máy chém và Xà lim tử hình ➡️ Dấu tích Cửa cống ngầm vượt ngục ➡️ Khu trưng bày phi công Mỹ ("Hanoi Hilton") ➡️ và điểm dừng cuối cùng là Đài tưởng niệm trang nghiêm để dâng hương tri ân.',
    en: 'Here is our recommended standard route for a meaningful visit: Start at the Main Gate Maison Centrale ➡️ View the scale model and male collective cells ➡️ Dark cells Cachot ➡️ Prison yard & historic Banyan Tree ➡️ Guillotine & Death Row cells ➡️ Escape Sewer exit ➡️ American pilots exhibition ➡️ Conclude with solemn incense offering at the Memorial Monument.',
    fr: 'Voici le parcours conseillé pour une visite complète : commencez par le portail principal Maison Centrale ➡️ la maquette et les cellules collectives ➡️ les cachots ➡️ la cour et le badamier historique ➡️ la guillotine et le couloir de la mort ➡️ l’égout de l’évasion ➡️ l’exposition sur les pilotes américains ➡️ puis terminez au monument commémoratif.',
    ja: 'おすすめの標準見学ルートをご案内いたします。メゾン・サントラル正門からスタートし ➡️ 館内模型と雑居房 ➡️ カショ独房 ➡️ 中庭と歴史的なモモタマナの木 ➡️ ギロチンと死刑囚独房 ➡️ 脱獄の下水道口 ➡️ 米軍パイロット展示室 ➡️ 最後に慰霊碑で静かに追悼される流れが最も充実しております。',
    ko: '가장 뜻깊은 표준 관람 동선을 추천해 드리겠습니다. 메종 상트랄 정문에서 시작하여 ➡️ 모형 전시 및 남성 공동 감방 ➡️ 카쇼 독방 ➡️ 안뜰과 반얀나무 ➡️ 단두대와 사형수 독방 ➡️ 탈옥 하수구 ➡️ 미군 조종사 전시실 ➡️ 마지막으로 추모 기념비에서 참배하며 마무리하시면 좋습니다.',
    zh: '为您推荐最经典且富有感染力的标准参观路线：从中央监狱正门出发 ➡️ 参观模型与男犯集体监室 ➡️ 卡绍暗牢 ➡️ 中庭与古榄仁树 ➡️ 断头台与死刑囚室 ➡️ 越狱下水道遗址 ➡️ 美国飞行员展区 ➡️ 最后前往庄严的烈士纪念碑敬献心意。'
  },

  EXPRESS_20_MINUTES: {
    vi: 'Với thời gian 20 phút, mình gợi ý lộ trình tham quan nhanh các điểm di tích quan trọng nhất: Cổng chính Maison Centrale ➡️ Cây bàng cổ thụ tại sân trại ➡️ Ngục tối Cachot ➡️ Cỗ máy chém ➡️ Cửa cống ngầm vượt ngục ➡️ Đài tưởng niệm để dâng hương tri ân. Lộ trình này giúp bạn cảm nhận được trọn vẹn tinh thần bất khuất của các chiến sĩ cách mạng mà vẫn đảm bảo kịp thời gian.',
    en: 'For a quick 20-minute visit, here is the recommended express highlights route: Main Gate Maison Centrale ➡️ Ancient Banyan Tree courtyard ➡️ Dark Cell Cachot ➡️ The Guillotine ➡️ Escape Sewer exit ➡️ Memorial Monument. This concise path allows you to experience the core heritage without feeling rushed.',
    fr: 'Si vous ne disposez que de 20 minutes, voici le parcours express conseillé : le portail principal Maison Centrale ➡️ le badamier historique dans la cour ➡️ les cachots ➡️ la guillotine ➡️ l’égout de l’évasion ➡️ le monument commémoratif. Vous saisirez ainsi l’essentiel de l’histoire du site.',
    ja: '20分ほどのお時間でしたら、こちらの短縮ルートがおすすめです。メゾン・サントラル正門 ➡️ 中庭のモモタマナの木 ➡️ カショ独房 ➡️ ギロチン ➡️ 脱獄の下水道口 ➡️ 慰霊碑の順に巡っていただくと、短い時間でも主要な見どころをしっかりご覧いただけます。',
    ko: '20분 정도 시간이 있으시다면 핵심 요약 코스를 추천해 드립니다. 메종 상트랄 정문 ➡️ 안뜰 반얀나무 ➡️ 카쇼 독방 ➡️ 단두대 ➡️ 탈옥 하수구 ➡️ 추모 기념비 순으로 이동하시면 짧은 시간에도 주요 역사를 알차게 살펴보실 수 있습니다.',
    zh: '如果您的时间只有20分钟，推荐您走精华快览路线：中央监狱正门 ➡️ 中庭古榄仁树 ➡️ 卡绍暗牢 ➡️ 断头台 ➡️ 越狱下水道口 ➡️ 烈士纪念碑。这样既能高效掌控时间，又能完整感受核心历史。'
  },

  ELDERLY_WHEELCHAIR_ROUTE: {
    vi: 'Đối với chuyến tham quan cùng người cao tuổi hoặc người dùng xe lăn, Di tích Hỏa Lò có bố trí dốc thoải ở các khu vực chính và ghế nghỉ chân dưới bóng mát cây bàng cổ thụ. Để bảo đảm sức khỏe cho bác, bạn nên ưu tiên lộ trình bằng phẳng: Cổng chính ➡️ Sân cây bàng ➡️ Đài tưởng niệm; hạn chế di chuyển vào các bậc tam cấp cao. Đội ngũ nhân viên bảo vệ luôn sẵn sàng hỗ trợ đẩy xe lăn hoặc dìu bác khi bạn cần giúp đỡ nhé.',
    en: 'For visitors accompanied by elderly family members or wheelchair users, Hoa Lo provides gentle ramps across major paths and shaded resting benches under the ancient banyan tree. We recommend prioritizing flat areas (Main Gate ➡️ Banyan Courtyard ➡️ Memorial Monument) and avoiding steep steps. Relic security staff are always ready to assist with walking or pushing wheelchairs.',
    fr: 'Pour les visiteurs âgés ou en fauteuil roulant, la Prison de Hoa Lo dispose de rampes douces sur les axes principaux et de bancs ombragés sous le badamier historique. Nous vous conseillons le trajet le plus plat : portail principal ➡️ cour du badamier ➡️ monument commémoratif. Nos agents sur place se tiennent prêts à vous aider.',
    ja: 'ご高齢の方や車椅子をご利用のお客様のために、主要エリアには緩やかなスロープと、中庭のモモタマナの木陰に休憩用ベンチを設けております。正門 ➡️ 中庭 ➡️ 慰霊碑の平坦なルートをおすすめしており、必要に応じて現地スタッフも喜んでお手伝いいたします。',
    ko: '어르신이나 휠체어 이용 관람객을 위해 주요 구간에는 완만한 경사로가 설치되어 있으며, 안뜰 반얀나무 아래에 휴식용 벤치가 마련되어 있습니다. 정문 ➡️ 안뜰 반얀나무 ➡️ 추모 기념비의 평탄한 동선을 추천드리며, 필요 시 현장 직원이 언제든 도와드리겠습니다.',
    zh: '针对老年游客及轮椅使用者，火炉监狱在主要通道设有平缓无障碍坡道，中庭古榄仁树下也备有遮荫休息座椅。建议优先选择平坦路线：正门 ➡️ 中庭古榄仁树 ➡️ 烈士纪念碑，现场工作人员也随时乐意提供协助。'
  },

  GHOST_MYTH_FACT_CHECK: {
    vi: 'Dạ không có chuyện ma quái đâu bạn nhé. Di tích Lịch sử Nhà tù Hỏa Lò là không gian lịch sử trang nghiêm, tôn vinh ý chí kiên cường và sự hy sinh anh dũng của các chiến sĩ yêu nước. Các khu trưng bày được bảo tồn và chiếu sáng khoa học để giúp du khách hiểu đúng giá trị lịch sử, hoàn toàn không mang yếu tố tâm linh kỳ bí ạ.',
    en: 'There are no ghosts here. Hoa Lo Prison is a sacred historical relic dedicated to honoring the bravery and sacrifice of patriotic Vietnamese revolutionaries. The exhibition space is solemn and well-lit to preserve historical memory, not supernatural stories.',
    fr: 'Il n’y a pas de fantômes ici. La Prison de Hoa Lo est un lieu historique solennel dédié à la mémoire du courage et du sacrifice des patriotes vietnamiens. Les salles sont soigneusement préservées et éclairées pour transmettre l’histoire avec respect.',
    ja: '心霊現象や幽霊といったことは一切ございません。ホアロー収容所は、ベトナムの愛国者たちの勇気と犠牲を敬意をもって伝える厳粛な歴史遺跡でございます。展示室も歴史を正しく学んでいただけるよう適切に整備・照明されております。',
    ko: '유령이나 귀신에 관한 이야기는 사실이 아닙니다. 호아로 수용소는 베트남 애국지사들의 용기와 희생을 기리는 엄숙한 역사 유적지이며, 모든 전시 공간은 역사를 올바르게 전달하기 위해 정갈하게 보존·조명되어 있습니다.',
    zh: '这里并没有任何灵异或鬼魂之说。河内火炉监狱是一处庄严肃穆的历史遗迹，旨在缅怀越南爱国志士的坚强意志与英勇牺牲。各展厅均采用科学的保护与照明设计，以客观传承真实历史。'
  },

  OPS_FOOD_DRINK_PROHIBITED: {
    vi: 'Để bảo tồn di tích lịch sử và giữ gìn vệ sinh chung, Di tích Nhà tù Hỏa Lò nghiêm cấm mang đồ ăn, thực phẩm có mùi, kẹo cao su, rượu bia hoặc các loại nước ngọt có màu vào các phòng trưng bày và buồng giam. Du khách chỉ được mang theo chai nước lọc cá nhân. Bạn có thể gửi đồ ăn và hành lý hoàn toàn miễn phí tại tủ gửi đồ Cổng chính số 1 trước khi vào tham quan.',
    en: 'To preserve the historical relic and maintain hygiene, visitors are strictly prohibited from bringing outside food, snacks, chewing gum, alcohol, or colored sugary drinks into the exhibition halls and prison cells. You may carry personal plain bottled water. Free luggage and food lockers are available at Gate No. 1.',
    fr: 'Afin de préserver le site historique et sa propreté, il est strictement interdit d’apporter de la nourriture, du chewing-gum, de l’alcool ou des boissons sucrées dans les salles et les cellules. Seule une bouteille d’eau nature est autorisée, et des casiers gratuits sont à votre disposition à l’entrée principale.',
    ja: '遺跡の保存と衛生維持のため、展示室や独房内への食べ物、ガム、アルコール、色付きの甘い飲み物の持ち込みは固く禁止されております。お水のペットボトルのみ持ち込み可能で、正門には無料のコインロッカーがございます。',
    ko: '유적 보존과 청결 유지를 위해 전시실과 감방 내부로 음식물, 껌, 주류 및 색소가 든 음료 반입이 엄격히 금지되어 있습니다. 개인 생수만 휴대하실 수 있으며, 정문 1번 게이트에 무료 물품 보관함이 마련되어 있습니다.',
    zh: '为保护历史遗迹与环境卫生，展厅及监室内严禁携带食物、口香糖、含酒精饮品或有色甜饮料进入。您仅可随身携带瓶装纯净水，其余食物与行李可免费存放在1号正门的寄存柜中。'
  },

  OPS_SMOKING_VIOLATION: {
    vi: 'Di tích Nhà tù Hỏa Lò nghiêm cấm tuyệt đối việc hút thuốc lá trong toàn bộ khuôn viên để phòng chống cháy nổ và giữ gìn không gian trang nghiêm. Bạn vui lòng báo ngay cho nhân viên bảo vệ gần nhất để các anh chị kịp thời nhắc nhở và xử lý nhé!',
    en: 'Smoking is strictly prohibited throughout Hoa Lo Prison Relic for fire safety and heritage preservation. Please immediately inform the nearest security guard or staff member so they can promptly remind the visitor.',
    fr: 'Il est strictement interdit de fumer dans l’ensemble de la Prison de Hoa Lo pour la sécurité incendie et le respect des lieux. Veuillez prévenir immédiatement l’agent de sécurité le plus proche si nécessaire.',
    ja: '防火および文化財保護のため、ホアロー収容所の敷地内は全面禁煙となっております。喫煙されている方を見かけられた場合は、お近くの警備員またはスタッフまでお知らせください。',
    ko: '화재 예방과 문화유산 보존을 위해 호아로 수용소 전 구역은 절대 금연 구역입니다. 흡연자를 발견하시면 즉시 가까운 경비원이나 직원에게 알려주시기 바랍니다.',
    zh: '为保障消防安全与文物保护，河内火炉监狱全园严禁吸烟。如遇违规吸烟情况，请立即告知最近的安保或工作人员及时劝阻。'
  },

  OPS_PETS_PROHIBITED: {
    vi: 'Để đảm bảo vệ sinh chung, an toàn cho du khách và bảo tồn di tích trang nghiêm, Di tích Nhà tù Hỏa Lò không cho phép mang thú cưng/vật nuôi vào khu vực trưng bày (kể cả khi bỏ trong túi xách). Bạn vui lòng gửi hoặc sắp xếp cho bé thú cưng ở bên ngoài trước khi vào tham quan nhé.',
    en: 'Pets and animals are not permitted inside the exhibition areas of Hoa Lo Prison Relic (even inside carrier bags) to ensure hygiene, visitor safety, and relic preservation. Please make arrangements for your pet before entering.',
    fr: 'Les animaux de compagnie ne sont pas admis dans les espaces d’exposition de la Prison de Hoa Lo, même dans un sac de transport, afin de garantir l’hygiène, la sécurité et la préservation du monument.',
    ja: '衛生管理やご来館者の安全、および文化財保護のため、キャリーバッグに入れた場合も含め、ペットを連れての入場はご遠慮いただいております。あらかじめご了承ください。',
    ko: '위생 관리와 관람객 안전, 유적 보존을 위해 이동 가방에 넣은 경우를 포함하여 반려동물 출입이 허용되지 않습니다. 입장 전 외부에 맡겨 주시기 바랍니다.',
    zh: '为保障环境卫生、游客安全及文物保护，火炉监狱展区内禁止携带宠物入内，即使装在宠物包中亦不允许，请您提前妥善安置。'
  },

  OPS_DRONE_PROHIBITED: {
    vi: 'Việc sử dụng flycam/drone bay quay trong khuôn viên Di tích Nhà tù Hỏa Lò bị nghiêm cấm để bảo đảm an toàn di tích và an ninh hàng không khu vực trung tâm Hà Nội, trừ trường hợp có giấy phép chính thức của cơ quan chức năng và Ban Quản lý Di tích.',
    en: 'Flying drones (flycams) inside or over Hoa Lo Prison Relic is strictly prohibited without special prior authorization from the Relic Management Board and relevant aviation/security authorities.',
    fr: 'Le survol et l’utilisation de drones au-dessus ou à l’intérieur de la Prison de Hoa Lo sont strictement interdits sans autorisation officielle préalable de la direction du site et des autorités compétentes.',
    ja: '遺跡の保護およびハノイ中心部の航空安全のため、関係当局と遺跡管理委員会の特別な許可がない限り、ドローンの飛行は固く禁止されております。',
    ko: '유적 보호와 하노이 도심 항공 안전을 위해 관계 당국 및 유적 관리위원회의 공식 사전 허가 없이는 드론 비행이 엄격히 금지되어 있습니다.',
    zh: '为确保遗迹安全及河内市中心空域安全，未经相关主管部门及遗迹管理委员会正式许可，严禁在火炉监狱内外放飞无人机。'
  },

  OPS_PAYMENT_METHODS: {
    vi: 'Vé tham quan tại quầy vé Cổng số 1 Hỏa Lò (50.000 VNĐ/người lớn) được niêm yết và thu bằng tiền Việt Nam Đồng (VNĐ). Quầy vé hỗ trợ thanh toán tiền mặt VNĐ và thanh toán không tiền mặt (chuyển khoản/QR); ngoại tệ (USD) thường không thu trực tiếp. Bạn vui lòng xác nhận hình thức quẹt thẻ quốc tế trực tiếp với thu ngân tại quầy vé nhé.',
    en: 'Official admission tickets at Hoa Lo Prison (50,000 VND/adult) are transacted in Vietnamese Dong (VND). Cash in VND and popular domestic cashless payments (QR/bank transfer) are commonly supported at the Gate No. 1 ticket counter; foreign currency (USD) is generally not accepted directly—please confirm international card acceptance directly with the ticket cashier.',
    fr: 'Les billets d’entrée, au tarif de 50 000 dongs vietnamiens par adulte, sont réglés en dongs vietnamiens au guichet principal. Les paiements en espèces en VND et les virements locaux par QR sont acceptés ; les devises étrangères comme le dollar américain ne sont généralement pas acceptées directement.',
    ja: '入場券は大人50,000ベトナムドンで、正門チケット売場にてベトナムドンでお支払いいただきます。現金および国内QR決済に対応しておりますが、米ドルなどの外貨は原則直接ご利用いただけません。国際カードのご利用可否は売場スタッフへご確認ください。',
    ko: '입장권은 성인 50,000 베트남 동이며, 정문 매표소에서 베트남 동으로 결제하실 수 있습니다. 베트남 동 현금과 현지 QR 결제를 지원하며, 미화 등 외화는 일반적으로 직접 받지 않으므로 해외 카드 사용 여부는 매표소 직원에게 확인해 주세요.',
    zh: '火炉监狱日间门票为成人50,000越南盾，在1号正门售票处以越南盾结算，支持越南盾现金及本地二维码转账。售票处通常不直接收取美元等外币，国际银行卡刷卡事宜请直接向售票员确认。'
  },

  OPS_WIFI_ACCESS: {
    vi: 'Hiện trong hệ thống thông tin của mình không có mật khẩu Wi-Fi công cộng của di tích. Du khách tham quan thường sử dụng mạng di động 4G/5G cá nhân; nếu cần kết nối mạng, bạn vui lòng hỏi trực tiếp nhân viên tại quầy đón tiếp Cổng chính số 1 nhé.',
    en: 'Our system does not hold a public Wi-Fi password for Hoa Lo Prison Relic. Visitors usually use personal 4G/5G mobile data during their visit, or you can ask staff at the Gate No. 1 reception counter if guest Wi-Fi is currently available.',
    fr: 'Je ne dispose pas d’un mot de passe Wi-Fi public pour le site. Les visiteurs utilisent généralement leur réseau mobile 4G ou 5G, ou peuvent se renseigner directement au comptoir d’accueil de l’entrée principale.',
    ja: '当システムには館内の公共Wi-Fiパスワードの情報がございません。多くのご来館者はご自身の4Gまたは5G回線をご利用になっておりますが、必要な場合は正門の受付スタッフにお尋ねください。',
    ko: '저희 안내 시스템에는 공용 와이파이 비밀번호 정보가 등록되어 있지 않습니다. 보통 개인 4G 또는 5G 데이터를 이용하시며, 필요하시면 정문 안내 데스크 직원에게 문의해 주세요.',
    zh: '本系统暂未收录景区公共Wi-Fi密码，游客参观时通常使用个人4G或5G移动网络；如有需要，您也可以向1号正门接待处工作人员咨询。'
  },

  OPS_PHONE_CHARGING: {
    vi: 'Trong các phòng trưng bày của Di tích Hỏa Lò hiện không bố trí ổ cắm sạc công cộng hay dịch vụ cho mượn sạc dự phòng. Trong trường hợp thực sự khẩn cấp cần liên lạc, bạn có thể ghé quầy đón tiếp tại Cổng chính số 1 để hỏi xem nhân viên có thể hỗ trợ tạm thời không nhé.',
    en: 'Hoa Lo Prison Relic does not provide public phone-charging kiosks or loaner power banks inside the exhibition rooms. You may ask the reception desk at Gate No. 1 in urgent cases, though we recommend bringing a personal power bank.',
    fr: 'Les salles d’exposition ne disposent pas de bornes de recharge publiques ni de batteries externes en prêt. En cas d’urgence, vous pouvez vous adresser à l’accueil à l’entrée principale.',
    ja: '展示室内には公共の充電設備やモバイルバッテリーの貸し出しサービスはございません。緊急で連絡が必要な場合は、正門の受付カウンターにてスタッフへご相談ください。',
    ko: '전시실 내부에는 공용 휴대전화 충전 시설이나 보조배터리 대여 서비스가 마련되어 있지 않습니다. 긴급한 연락이 필요하신 경우 정문 안내 데스크 직원에게 도움을 요청해 보실 수 있습니다.',
    zh: '展厅内暂不提供公共手机充电桩或充电宝租借服务。如您有紧急联络需要，可前往1号正门接待台询问工作人员是否能提供临时协助。'
  },

  OPS_DAMAGED_TICKET: {
    vi: 'Bạn đừng quá lo lắng nhé! Hãy giữ lại đầy đủ các mảnh vé giấy bị rách (nhất là phần có mã vạch/số sê-ri) và mang ngay tới quầy vé hoặc nhân viên soát vé tại Cổng chính số 1 để được kiểm tra đối chiếu và hỗ trợ kịp thời ạ.',
    en: 'Please do not worry. Keep all pieces of your torn paper ticket—especially the barcode or serial number—and bring them immediately to the ticket counter or Gate No. 1 staff for verification and assistance.',
    fr: 'Ne vous inquiétez pas : conservez tous les morceaux de votre billet, en particulier le code-barres ou le numéro de série, et présentez-les immédiatement au guichet principal pour vérification.',
    ja: 'どうぞご安心ください。破れてしまったチケットの切れ端、特にバーコードや通し番号の部分をすべてお持ちのうえ、正門のチケット売場または係員へすぐにご提示ください。確認のうえ対応いたします。',
    ko: '너무 걱정하지 마세요. 찢어진 입장권 조각, 특히 바코드나 일련번호 부분을 모두 챙기셔서 즉시 정문 매표소나 검표 직원에게 보여주시면 확인 후 신속히 도와드리겠습니다.',
    zh: '请您不必担心，请保留好破损纸质门票的完整残片，尤其是条形码和序列号部分，立即前往1号正门售票处或检票工作人员处核验处理。'
  },

  OPS_GROUP_BOOKING: {
    vi: 'Trẻ em dưới 15 tuổi (bao gồm học sinh tiểu học) được MIỄN PHÍ vé tham quan tại Di tích Nhà tù Hỏa Lò bạn nhé! Với các đoàn đông học sinh hoặc đoàn tham quan theo nhóm lớn, nhà trường nên liên hệ đăng ký trước với Phòng Trưng bày - Tuyên truyền qua số 024.39342253 hoặc email banquanlyditichhoalo@gmail.com để Ban Quản lý hỗ trợ đón tiếp chu đáo, phân luồng an toàn và bố trí thuyết minh đoàn phù hợp.',
    en: 'Children under 15 years old (including elementary school students) receive FREE admission to Hoa Lo Prison Relic! For large school or tour groups, we strongly recommend contacting the Exhibition & Education Department in advance via 024.39342253 or email banquanlyditichhoalo@gmail.com to arrange smooth entry and optional guided support.',
    fr: 'L’entrée à la Prison de Hoa Lo est gratuite pour les enfants de moins de 15 ans. Pour les groupes scolaires ou les grands groupes touristiques, il est vivement recommandé de réserver à l’avance auprès du service éducatif au 024 3934 2253 afin d’organiser un accueil fluide et un guide dédié.',
    ja: '15歳未満のお子様はホアロー収容所の入場料が無料となっております。学校団体や大人数のグループでお越しの際は、円滑なご案内とガイド手配のため、事前に遺跡管理委員会の電話番号024-3934-2253までご連絡いただくことをおすすめいたします。',
    ko: '만 15세 미만 어린이는 호아로 수용소 입장이 무료입니다. 대규모 학생 단체나 투어 그룹은 원활한 입장과 단체 해설 배정을 위해 사전에 유적 관리위원회 전화 024-3934-2253으로 예약 문의하시는 것을 권장합니다.',
    zh: '15岁以下儿童可免费参观河内火炉监狱。对于大型学生团队或旅游团体，建议提前致电遗迹管理委员会 024-3934-2253 预约登记，以便妥善安排入馆分流与团队讲解服务。'
  },

  OPS_COMMERCIAL_INAPPROPRIATE: {
    vi: 'Nhà tù Hỏa Lò là di tích lịch sử quốc gia trang nghiêm, vì vậy các hoạt động livestream bán hàng, chụp ảnh cưới trước hiện vật hành hình hay thuê mặt bằng tổ chức tiệc gala thương mại đều KHÔNG phù hợp và không được phép thực hiện tại đây. Mọi nhu cầu ghi hình báo chí/chuyên đề cần đăng ký và được Ban Quản lý Di tích chấp thuận trước qua số 024.39342253.',
    en: 'Commercial livestreaming, selling, wedding photography, or private corporate galas/events are not permitted in the solemn exhibition spaces of Hoa Lo Prison Relic. Any media or special filming requests must be formally approved in advance by the Relic Management Board (024.39342253).',
    fr: 'La Prison de Hoa Lo étant un monument historique national solennel, les ventes en direct, séances photos de mariage ou réceptions commerciales n’y sont pas autorisés. Toute demande de tournage médiatique doit recevoir l’accord préalable de la direction du site au 024 3934 2253.',
    ja: 'ホアロー収容所は厳粛な国家歴史遺跡であるため、商業ライブ配信、ウェディング撮影、営利イベントの開催は認められておりません。報道や専門取材の撮影は事前に管理委員会（024-3934-2253）の承認が必要です。',
    ko: '호아로 수용소는 엄숙한 국가 역사 유적이므로 상업적 라이브 방송, 웨딩 촬영, 기업 행사 등은 허용되지 않습니다. 언론 취재나 특수 촬영은 사전에 관리위원회(024-3934-2253)의 승인을 받아야 합니다.',
    zh: '河内火炉监狱为庄严的国家历史遗迹，禁止在此开展商业带货直播、婚纱拍摄或私人商业宴会。任何媒体采访或专题摄制均须提前致电管理委员会 024-3934-2253 获批。'
  },

  OPS_GENERAL: {
    vi: 'Về quy định vận hành và hỗ trợ thực địa cụ thể tại di tích, bạn vui lòng trao đổi trực tiếp với nhân viên đón tiếp tại Cổng chính số 1 Hỏa Lò hoặc gọi 024.39342253 để được hướng dẫn chính xác nhất nhé.',
    en: 'For specific on-site regulations or operational requests, please check directly with our staff at the Main Gate (No. 1 Hoa Lo Street) or call 024.39342253.',
    fr: 'Pour toute demande pratique ou précision sur le règlement intérieur, veuillez vous adresser directement au personnel d’accueil à l’entrée principale au 1 rue Hoa Lo ou appeler le 024 3934 2253.',
    ja: '館内の詳細なご利用規定や現地サポートにつきましては、ホアロー通り1番の正門受付スタッフまで直接お尋ねいただくか、024-3934-2253までお問い合わせください。',
    ko: '구체적인 관내 이용 규정이나 현장 지원이 필요하신 경우 호아로 거리 1번지 정문 안내 직원에게 직접 문의하시거나 024-3934-2253으로 연락해 주세요.',
    zh: '如需了解具体馆内规定或现场协助，请直接咨询火炉街1号正门接待处工作人员，或致电 024-3934-2253。'
  },

  OOS_DEFAULT: {
    vi: 'Dạ đây là một chủ đề thú vị nằm ngoài phạm vi tư liệu chuyên sâu tại Di tích Nhà tù Hỏa Lò, nên mình xin phép không suy đoán để giữ trọn tính chính xác. Khi trở lại hành trình khám phá Hỏa Lò hôm nay, bạn muốn mình giới thiệu về khu trưng bày hay giai đoạn lịch sử nào?',
    en: 'That is an intriguing topic outside the immediate historical scope and archives of Hoa Lo Prison Relic, so I prefer not to speculate beyond verified facts. Back here at Hoa Lo, which gallery, historical chapter, or visitor guideline would you like to explore next?',
    fr: 'C’est un sujet intéressant, mais il se situe en dehors des archives historiques spécialisées de la Prison de Hoa Lo ; je préfère donc ne pas spéculer. De retour dans notre visite de Hoa Lo, quelle salle ou quelle période souhaitez-vous découvrir maintenant ?',
    ja: '大変興味深い話題ですが、ホアロー収容所歴史遺跡の専門資料の範囲外となりますため、正確性を保つため推測は控えさせていただきます。館内の展示室や歴史について、次にご案内したい場所はございますか。',
    ko: '매우 흥미로운 주제이지만 호아로 수용소 역사 유적의 전문 자료 범위를 벗어나므로 정확성을 위해 추측하지 않겠습니다. 호아로 관람으로 돌아가 어떤 전시실이나 역사 이야기를 이어서 안내해 드릴까요?',
    zh: '这是一个很有趣的话题，但超出了河内火炉监狱历史遗迹的专业史料范围，为保证严谨准确我不做猜测。回到您今天的火炉监狱参观之旅，您希望我接下来为您介绍哪个展区或历史时期？'
  },

  ARCHIVE_KNOWLEDGE_GAP: {
    vi: 'Thông tin chi tiết này hiện chưa được ghi nhận trong kho tư liệu xác thực của Di tích Nhà tù Hỏa Lò mà mình được cung cấp, nên mình xin phép không suy đoán để đảm bảo độ chính xác lịch sử.',
    en: 'This specific detail is not documented in the verified historical archives currently provided for Hoa Lo Prison Relic. I prefer not to guess so that every historical fact I share remains accurate.',
    fr: 'Ce détail précis ne figure pas dans les archives historiques vérifiées de la Prison de Hoa Lo dont je dispose ; je préfère donc ne pas improviser afin de préserver la rigueur historique.',
    ja: 'この詳細な点につきましては、現在提供されているホアロー収容所の検証済み歴史資料には記録がございません。歴史的正確性を守るため、推測でのお答えは控えさせていただきます。',
    ko: '해당 세부 내용은 현재 제공된 호아로 수용소의 검증된 역사 자료에 기록되어 있지 않습니다. 역사적 정확성을 지키기 위해 추측하여 답변하지 않겠습니다.',
    zh: '这一具体细节目前尚未收录在河内火炉监狱经核实的馆藏史料中，为确保历史准确性，我不能随意推测。'
  },

  // Các kịch bản dịch vụ phổ biến dùng trực tiếp cho FR / JA / KO / ZH (0ms, không cần dịch máy!)
  SERVICE_OPENING_HOURS: {
    vi: 'Dạ chào bạn, Di tích Lịch sử Nhà tù Hỏa Lò mở cửa liên tục từ 8:00 đến 17:00 tất cả các ngày trong tuần (từ Thứ Hai đến Chủ Nhật, kể cả ngày Lễ, Tết) và KHÔNG đóng cửa nghỉ trưa bạn nhé. Ngoài ra, tour trải nghiệm "Đêm thiêng liêng" diễn ra từ 19:00 các tối Thứ Sáu, Thứ Bảy và Chủ Nhật (cần đặt vé trước).',
    en: 'Hoa Lo Prison Historical Relic is open continuously from 8:00 AM to 5:00 PM every day of the week, including weekends and public holidays, with no lunch break. In addition, the "Sacred Night" experience runs from 7:00 PM on Fridays, Saturdays, and Sundays with advance booking required.',
    fr: 'Le site historique de la Prison de Hoa Lo est ouvert tous les jours de 8 heures à 17 heures sans interruption, y compris les week-ends et jours fériés. La visite nocturne Nuit Sacrée a lieu à partir de 19 heures les vendredis, samedis et dimanches, sur réservation préalable.',
    ja: 'ホアロー収容所歴史遺跡は、祝日を含め毎日午前8時から午後5時まで昼休みなしで開館しております。また、毎週金曜日・土曜日・日曜日の午後7時からは、事前予約制のナイトツアー「聖なる夜」も開催されております。',
    ko: '호아로 수용소 역사 유적은 주말과 공휴일을 포함해 매일 오전 8시부터 오후 5시까지 점심 휴관 없이 운영합니다. 또한 매주 금요일, 토요일, 일요일 오후 7시부터는 사전 예약제로 야간 투어 성스러운 밤이 진행됩니다.',
    zh: '河内火炉监狱历史遗迹每天上午8点至下午5点全天连续开放，中午不闭馆，周末及节假日照常接待游客。此外，每周五、周六、周日晚7点还举办“神圣之夜”夜游体验，需提前预约购票。'
  },

  SERVICE_TICKET_DAYTIME: {
    vi: 'Dạ giá vé tham quan ban ngày tại Di tích Nhà tù Hỏa Lò là 50.000 VNĐ/người lớn. Học sinh, sinh viên (xuất trình thẻ), người cao tuổi từ 60 tuổi trở lên và người khuyết tật nặng được giảm 50% còn 25.000 VNĐ; trẻ em dưới 15 tuổi và người có công với cách mạng được miễn phí vé bạn nhé.',
    en: 'Daytime admission to Hoa Lo Prison Historical Relic is 50,000 VND per adult. A 50% discount (25,000 VND) applies to students with valid ID, seniors aged 60 and above, and visitors with severe disabilities. Children under 15 years old enjoy free admission.',
    fr: 'Le tarif d’entrée de jour à la Prison de Hoa Lo est de 50 000 dongs vietnamiens par adulte. Une réduction de 50 %, soit 25 000 dongs, est accordée aux étudiants sur présentation de leur carte ainsi qu’aux seniors de 60 ans et plus. L’entrée est gratuite pour les enfants de moins de 15 ans.',
    ja: 'ホアロー収容所の日中入場料は大人50,000ベトナムドンでございます。学生証をお持ちの学生の方および60歳以上の方は50パーセント割引の25,000ベトナムドンとなり、15歳未満のお子様は無料でご入場いただけます。',
    ko: '호아로 수용소 주간 입장료는 성인 50,000 베트남 동입니다. 학생증을 지참한 학생과 만 60세 이상 어르신은 50퍼센트 할인된 25,000 베트남 동이며, 만 15세 미만 어린이는 무료로 입장하실 수 있습니다.',
    zh: '河内火炉监狱日间门票为成人50,000越南盾。在校学生凭学生证、60岁及以上长者可享受半价优惠25,000越南盾，15岁以下儿童免费参观。'
  },

  SERVICE_RESTROOM_LOCKER: {
    vi: 'Nhà vệ sinh (WC) tại Di tích Hỏa Lò được bố trí sạch sẽ tại khu vực sân trại giam và gần lối ra quầy lưu niệm theo biển chỉ dẫn. Ngoài ra, ngay gần cổng soát vé có tủ gửi balo và đồ cá nhân hoàn toàn miễn phí cho du khách nhé.',
    en: 'Clean restrooms are conveniently located near the prison courtyard and beside the exit souvenir shop, clearly marked with directional signs. Free personal lockers for backpacks and bags are also available right beside the Main Gate entrance.',
    fr: 'Des toilettes propres se trouvent près de la cour de la prison ainsi qu’à proximité de la sortie et de la boutique souvenirs, clairement indiquées par des panneaux. Des casiers gratuits pour vos sacs sont également disponibles près de l’entrée principale.',
    ja: 'お手洗いは中庭付近と出口のミュージアムショップ横に清潔に整備されており、案内表示がございます。また、正門の入場口付近にはバックパックやお荷物を無料で預けられるロッカーもございます。',
    ko: '화장실은 안뜰 구역과 출구 기념품 매장 옆에 깨끗하게 마련되어 있으며 안내 표지판을 따라 쉽게 찾으실 수 있습니다. 또한 정문 입구 근처에 가방과 짐을 무료로 보관할 수 있는 물품 보관함이 준비되어 있습니다.',
    zh: '馆内洗手间设于中庭区域以及出口纪念品商店附近，沿途均有清晰指示牌。此外，1号正门检票口旁还为游客提供免费的背包与个人物品寄存柜。'
  },

  SERVICE_AUDIOGUIDE: {
    vi: 'Di tích Nhà tù Hỏa Lò có dịch vụ thuê thiết bị thuyết minh tự động Audioguide ngay tại quầy vé Cổng số 1 với mức phí khoảng 50.000 VNĐ/máy, hỗ trợ nhiều ngôn ngữ (Việt, Anh, Pháp...). Nếu tai nghe gặp trục trặc hoặc bị rè, bạn mang lại quầy vé sẽ được đổi máy mới miễn phí ngay lập tức.',
    en: 'An automated multilingual Audioguide handset can be rented at the Gate No. 1 ticket counter for approximately 50,000 VND per unit. Should your headset experience any static or technical issue, simply return to the counter for an immediate free replacement.',
    fr: 'Vous pouvez louer un audioguide multilingue au guichet de l’entrée principale pour environ 50 000 dongs vietnamiens par appareil. En cas de problème technique ou de grésillement, notre équipe le remplace gratuitement et immédiatement.',
    ja: '正門のチケット売場にて、多言語対応の音声ガイド機器を1台約50,000ベトナムドンでレンタルいただけます。万一音飛びや不具合がございましたら、売場にてすぐに無料交換いたします。',
    ko: '정문 매표소에서 다국어 오디오가이드 기기를 대당 약 50,000 베트남 동에 대여하실 수 있습니다. 이어폰 잡음이나 기기 이상이 생기면 매표소에서 즉시 무료로 새 기기로 교환해 드립니다.',
    zh: '您可以在1号正门售票处租借多语种自动语音导览机，租金约50,000越南盾一台。如设备出现杂音或故障，随时带回售票处即可立即免费更换新机。'
  },

  SERVICE_NIGHT_TOUR: {
    vi: 'Tour trải nghiệm "Đêm thiêng liêng" tại Di tích Hỏa Lò diễn ra từ 19:00 các tối Thứ Sáu, Thứ Bảy và Chủ Nhật hàng tuần (thời lượng khoảng 90 phút), giá vé khoảng 399.000 đến 499.000 VNĐ tùy chủ đề. Vì số lượng khách mỗi suất có hạn, bạn cần đặt vé trước qua fanpage chính thức hoặc hotline của Di tích nhé.',
    en: 'The "Sacred Night" tour at Hoa Lo Prison takes place at 7:00 PM every Friday, Saturday, and Sunday (approx. 90 minutes), priced between 399,000 and 499,000 VND depending on the theme. Because capacity is limited, advance reservation via Hoa Lo’s official fanpage or hotline is required.',
    fr: 'La visite nocturne Nuit Sacrée se déroule chaque vendredi, samedi et dimanche à partir de 19 heures pour une durée d’environ 90 minutes, au tarif de 399 000 à 499 000 dongs selon le thème. Les places étant limitées, une réservation préalable via la page officielle ou la ligne téléphonique du site est obligatoire.',
    ja: 'ナイトツアー「聖なる夜」は毎週金・土・日曜日の午後7時から約90分間開催されており、料金はテーマにより399,000から499,000ベトナムドンです。各回定員が限られているため、公式ページまたはホットラインでの事前予約が必要です。',
    ko: '호아로 수용소 야간 투어 성스러운 밤은 매주 금·토·일요일 오후 7시부터 약 90분간 진행되며, 테마에 따라 399,000에서 499,000 베트남 동입니다. 회차별 인원이 제한되어 있으므로 공식 페이지나 대표 전화로 사전 예약하셔야 합니다.',
    zh: '火炉监狱“神圣之夜”夜游体验于每周五、周六、周日晚7点举行，时长约90分钟，票价依主题约为399,000至499,000越南盾。因每场名额有限，请务必提前通过官方主页或热线预约。'
  }
};

function getDocentReply(key, lang = 'vi') {
  const code = normalizeLang(lang);
  const entry = DOCENT_MESSAGES[key];
  if (!entry) return null;
  return entry[code] || entry.en || entry.vi;
}

module.exports = {
  NATIVE_REGISTER_RULES,
  DOCENT_MESSAGES,
  getNativeRegisterInstruction,
  getDocentReply
};
