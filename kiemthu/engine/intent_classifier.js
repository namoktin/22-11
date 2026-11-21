/**
 * 2Guide Multi-Feature Semantic Intent Classifier v6.0 (Enterprise Edition)
 * 
 * Phân tích câu hỏi người dùng theo 4 chiều:
 * 1. Intent: 17 ý định cốt lõi (Lịch sử, Hiện vật, Giải thích, Khiếu nại, Trợ năng, Vé, Giờ...).
 * 2. SubIntent: Phân hóa chuyên sâu CSKH và Hỗ trợ khẩn cấp.
 * 3. Subject: Thực thể chính (may_chem, cay_bang, cong_ngam, phi_cong, cachot, xa_lim, ve, gio...).
 * 4. Aspect: Khía cạnh truy vấn (SPECIFICATION, ORIGIN, PURPOSE, SIGNIFICANCE, DAILY_PRISON_LIFE, POLICY_DETAIL...).
 */

const nlp = require('./nlp_processor');
const { semanticRouter, hasPhrase } = require('./semantic_router');

const INTENTS = {
  HISTORICAL_FACT: 'HISTORICAL_FACT',
  HISTORICAL_EXPLANATION: 'HISTORICAL_EXPLANATION',
  EXHIBIT_INFORMATION: 'EXHIBIT_INFORMATION',
  EXHIBITION_INFORMATION: 'EXHIBITION_INFORMATION',
  TOUR_INFORMATION: 'TOUR_INFORMATION',
  TOUR_RECOMMENDATION: 'TOUR_RECOMMENDATION',
  VISIT_GUIDANCE: 'VISIT_GUIDANCE',
  OPENING_HOURS: 'OPENING_HOURS',
  TICKET_INFORMATION: 'TICKET_INFORMATION',
  CONTACT_INFORMATION: 'CONTACT_INFORMATION',
  AUDIO_GUIDE_SUPPORT: 'AUDIO_GUIDE_SUPPORT',
  FACILITY_INFORMATION: 'FACILITY_INFORMATION',
  FACILITY_SUPPORT: 'FACILITY_INFORMATION', // backward compatibility
  CUSTOMER_ASSISTANCE: 'CUSTOMER_ASSISTANCE',
  CUSTOMER_COMPLAINT: 'CUSTOMER_COMPLAINT',
  LOST_AND_FOUND: 'LOST_AND_FOUND',
  ACCESSIBILITY_SUPPORT: 'ACCESSIBILITY_SUPPORT',
  EMERGENCY_SUPPORT: 'EMERGENCY_SUPPORT',
  SITE_OPERATIONS: 'SITE_OPERATIONS',
  CONVERSATIONAL_EMPATHY: 'CONVERSATIONAL_EMPATHY',
  FOLLOW_UP: 'FOLLOW_UP',
  CLARIFICATION: 'CLARIFICATION',
  AMBIGUOUS_QUERY: 'CLARIFICATION', // backward compatibility
  OUT_OF_SCOPE: 'OUT_OF_SCOPE',
  GREETING: 'GREETING',
  THANK_YOU: 'THANK_YOU',
  GOODBYE: 'GOODBYE',
  CHITCHAT_BOT: 'CHITCHAT_BOT',
  JOKE_REQUEST: 'JOKE_REQUEST',
  HIGHLIGHTS_REQUEST: 'HIGHLIGHTS_REQUEST',
  PARKING_SUPPORT: 'PARKING_SUPPORT',
  PHOTOGRAPHY_POLICY: 'PHOTOGRAPHY_POLICY',
  DINING_VICINITY: 'DINING_VICINITY',
  VICINITY_DISTANCE: 'VICINITY_DISTANCE',
  SUMMARY_REQUEST: 'SUMMARY_REQUEST',
  TIME_FEASIBILITY: 'TIME_FEASIBILITY',
  WEATHER_ADVISORY: 'WEATHER_ADVISORY',
  PROMPT_INJECTION: 'PROMPT_INJECTION',
  EXPIRED_POLICY: 'EXPIRED_POLICY'
};

class IntentClassifier {
  constructor() {
    this.outOfScopeEntities = [
      'thoi tiet', 'gia vang', 'chung khoan', 'vn index', 'gia co phieu', 'bitcoin', 'crypto',
      'fibonacci', 'code python', 'pytago', 'dijkstra', 'quicksort', 'phuong trinh', 'toan hoc',
      'chatgpt', 'gemini', 'bong da', 'world cup', 'ngoai hang anh',
      'dinh doc lap', 'dia dao cu chi', 'ben nha rong', 'chua bai dinh', 'trang an',
      'phong nha', 'ke bang', 'vinh ha long', 'fansipan', 'sapa', 'chua keo', 'chua huong',
      'thanh co quang tri', 'nga ba dong loc', 'cau vang da nang', 'ba na hills'
    ];

    this.hoaLoWhitelist = [
      'hoa lo', 'maison centrale', 'xa lim', 'cum chan', 'may chem', 'cay bang',
      'cong ngam', 'tu nhan', 'tu binh', 'phi cong', 'mccain', 'peterson', 'b 52', 'b52',
      'phan boi chau', 'luong van can', 'hoang van thu', 'nguyen thai hoc',
      'thung ve sinh', 'lap la', 'bat sat', 'que dan', 'so dang ky', 'ton do',
      'cat toc', 'nguyen thi minh khai', 'quang thai', 'pham thi van', 'le lien',
      'tuong niem', 'phu dieu', 'choi gac', 'vong gac', 'trai nu', 'trai nam',
      'cachot', 'dem thieng lieng', 'tra bang', 'thach bang', 'phu khanh',
      'lang hoa lo', 'lang phu khanh', 'khoa co chan', 'cong tay', 'xieng xich',
      'dong kinh nghia thuc'
    ];
  }

  extractSubject(norm) {
    if (norm.includes('may chem') || norm.includes('guillotine') || norm.includes('luoi dao') || norm.includes('cot go')) return 'may_chem';
    if (norm.includes('cay bang') || norm.includes('la bang') || norm.includes('hat bang') || norm.includes('canh bang') || norm.includes('tra bang') || norm.includes('thach bang')) return 'cay_bang';
    if (norm.includes('cong ngam') || norm.includes('vuot nguc') || norm.includes('nap cong')) return 'cong_ngam';
    if (norm.includes('phi cong') || norm.includes('hanoi hilton') || norm.includes('mccain') || norm.includes('peterson')) return 'phi_cong';
    if (norm.includes('cachot') || norm.includes('nguc toi') || norm.includes('ham toi') || norm.includes('biet giam')) return 'cachot';
    if (norm.includes('xa lim') || norm.includes('tu hinh') || norm.includes('hoang van thu') || norm.includes('nguyen thai hoc') || norm.includes('nguyen duc canh')) return 'xa_lim_tu_hinh';
    if (norm.includes('maison centrale') || norm.includes('cong so 1') || norm.includes('cong chinh') || norm.includes('phu khanh') || norm.includes('lang hoa lo') || norm.includes('tuong da')) return 'maison_centrale';
    if (norm.includes('but') || norm.includes('gach non') || norm.includes('muoi than') || norm.includes('bao chi') || norm.includes('ao len')) return 'hien_vat_sinh_hoat';
    if (norm.includes('ve sinh') || norm.includes('toilet') || norm.includes('wc')) return 'nha_ve_sinh';
    if (norm.includes('gia ve') || norm.includes('mua ve') || norm.includes('tien ve') || norm.includes('ve vao') || norm.includes('ve tham quan') || norm.includes('tour dem')) return 've_tham_quan';
    if (norm.includes('gio mo') || norm.includes('dong cua') || norm.includes('tet nguyen dan') || norm.includes('ngay le')) return 'gio_mo_cua';
    if (norm.includes('gui do') || norm.includes('balo') || norm.includes('hanh ly')) return 'gui_do';
    if (norm.includes('chup anh') || norm.includes('quay phim') || norm.includes('flash')) return 'quy_dinh_chup_anh';
    if (norm.includes('audioguide') || norm.includes('tai nghe') || norm.includes('thuyet minh tu dong')) return 'audioguide';
    return null;
  }

  extractAspect(norm) {
    if (norm.includes('nang bao nhieu') || norm.includes('cao bao nhieu') || norm.includes('kich thuoc') || norm.includes('trong luong') || norm.includes('chat lieu') || norm.includes('cau tao') || norm.includes('lam bang gi')) {
      return 'SPECIFICATION';
    }
    if (norm.includes('nguon goc') || norm.includes('xuat xu') || norm.includes('dua vao day khi nao') || norm.includes('khi nao dua vao') || norm.includes('nam nao') || norm.includes('xay dung nam nao') || norm.includes('vi sao lai goi la') || norm.includes('tai sao co ten')) {
      return 'ORIGIN';
    }
    if (norm.includes('dung de lam gi') || norm.includes('su dung de lam gi') || norm.includes('su dung nhu the nao') || norm.includes('cong dung') || norm.includes('chuc nang')) {
      return 'PURPOSE';
    }
    if (norm.includes('y nghia') || norm.includes('dac biet') || norm.includes('bieu tuong') || norm.includes('vi sao nguoi ta nhac nhieu') || norm.includes('tai sao lai co y nghia')) {
      return 'SIGNIFICANCE';
    }
    if (norm.includes('cuoc song') || norm.includes('sinh hoat') || norm.includes('chua benh') || norm.includes('chong doi') || norm.includes('khiet ly') || norm.includes('viet chu')) {
      return 'DAILY_PRISON_LIFE';
    }
    if (norm.includes('tuong tu') || norm.includes('hien vat nao khac') || norm.includes('co gi giong') || norm.includes('khac khong')) {
      return 'COMPARISON_EXPANSION';
    }
    if (norm.includes('gia bao nhieu') || norm.includes('bao nhieu tien') || norm.includes('may gio') || norm.includes('quy dinh')) {
      return 'POLICY_DETAIL';
    }
    if (norm.includes('lam the nao') || norm.includes('o dau') || norm.includes('gap ai') || norm.includes('ho tro')) {
      return 'ACTION_REQUEST';
    }
    return 'GENERAL';
  }

  classify(rawQuestion, context = null) {
    const raw = nlp.cleanRawText(rawQuestion);
    const norm = ' ' + nlp.normalize(raw) + ' ';
    const lower = raw.toLowerCase();

    const subject = this.extractSubject(norm) || context?.lastTopic || null;
    const aspect = this.extractAspect(norm);

    // 0. Kiểm tra Prompt Injection / Phá rào bảo mật
    if (nlp.detectPromptInjection(rawQuestion)) {
      return {
        intent: INTENTS.PROMPT_INJECTION,
        subIntent: null,
        subject: null,
        aspect: 'SECURITY',
        confidence: 0.99,
        reason: 'Phát hiện yêu cầu can thiệp câu lệnh hệ thống hoặc giả mạo vai trò'
      };
    }

    // 0.05. Kiểm tra nhiễu cực đoan / ký tự lạ / toàn số / emoji / câu đệm vô nghĩa / lặp từ
    const trimmedNorm = norm.trim();
    const normTokens = trimmedNorm ? trimmedNorm.split(' ') : [];
    const uniqueTokens = new Set(normTokens);
    const isPureNoiseOrFiller =
      !trimmedNorm ||
      /^[0-9\s]+$/.test(trimmedNorm) ||
      (normTokens.length === 1 && /^(a|aa|alo|test|testing|ok|oke|u|vang|ha|hihi|hehe|haha|o|um|uh|eh|hi|hey)$/.test(normTokens[0]) && !/^(hi|hey)$/.test(normTokens[0])) ||
      /^(alo alo|alo alo 1234|testing 123|gi co|hihi|hehe|haha)$/.test(trimmedNorm) ||
      (normTokens.length >= 4 && uniqueTokens.size <= 2 && /^(hoa lo|nha tu|test|alo|ok|a)$/.test([...uniqueTokens].join(' ')));

    if (isPureNoiseOrFiller) {
      return {
        intent: INTENTS.CLARIFICATION,
        subIntent: 'EXTREME_NOISE_OR_FILLER',
        subject: null,
        aspect: 'CLARIFICATION_NEEDED',
        confidence: 0.96,
        reason: 'Phát hiện tín hiệu nhiễu / ký tự đặc biệt / thử mic / câu đệm ngắn'
      };
    }

    // 0.06. Kiểm tra chào hỏi / cảm ơn / tạm biệt / hỏi danh tính trợ lý (cả VI & EN)
    const isGreetingOnly = /^(xin chao|chao ban|chao|hello|hi|hey|good morning|good afternoon|good evening)/.test(trimmedNorm) &&
      normTokens.length <= 8 && !hasPhrase(norm, 'gia ve') && !hasPhrase(norm, 'may chem') && !hasPhrase(norm, 'cay bang');
    if (isGreetingOnly) {
      return {
        intent: INTENTS.GREETING,
        subIntent: 'GREETING',
        subject: null,
        aspect: 'SOCIAL',
        confidence: 0.97,
        reason: 'Lời chào mở đầu từ du khách'
      };
    }
    if (/^(cam on|thank you|thanks|tks|many thanks)\b/.test(trimmedNorm) && normTokens.length <= 10) {
      return {
        intent: INTENTS.THANK_YOU,
        subIntent: 'THANK_YOU',
        subject: null,
        aspect: 'SOCIAL',
        confidence: 0.97,
        reason: 'Lời cảm ơn từ du khách'
      };
    }
    if (/^(tam biet|bye|goodbye|see you|hen gap lai)\b/.test(trimmedNorm) && normTokens.length <= 10) {
      return {
        intent: INTENTS.GOODBYE,
        subIntent: 'GOODBYE',
        subject: null,
        aspect: 'SOCIAL',
        confidence: 0.97,
        reason: 'Lời tạm biệt từ du khách'
      };
    }
    if (
      hasPhrase(norm, 'ban ten la gi') || hasPhrase(norm, 'ban la ai') || hasPhrase(norm, 'ai tao ra ban') ||
      hasPhrase(norm, 'sao ban thong minh') || hasPhrase(norm, 'ban thong minh the')
    ) {
      return {
        intent: INTENTS.CHITCHAT_BOT,
        subIntent: 'BOT_IDENTITY',
        subject: null,
        aspect: 'SOCIAL',
        confidence: 0.96,
        reason: 'Khách hỏi về danh tính / khen ngợi trợ lý ảo'
      };
    }

    // 0.07. CỔNG CHẶN NGOÀI LỀ TOÀN DIỆN (chạy TRƯỚC SITE_OPERATIONS để 'Giá Bitcoin' không nhảy vào vé 50k!)
    const hasHoaLoAnchor = hasPhrase(norm, 'hoa lo') || hasPhrase(norm, 'maison centrale') ||
      hasPhrase(norm, 'may chem') || hasPhrase(norm, 'cay bang') || hasPhrase(norm, 'cachot') ||
      hasPhrase(norm, 'cong ngam') || hasPhrase(norm, 'hanoi hilton') || hasPhrase(norm, 'dem thieng lieng') ||
      hasPhrase(norm, 'tham quan trong nha') || hasPhrase(norm, 'di tich');

    const hardOosPatterns = [
      // Tài chính, tiền số, ngân hàng, bất động sản
      'bitcoin', 'crypto', 'chung khoan', 'vn index', 'co phieu', 'gia vang', 'sjc', 'gia xang', 'ron 95',
      'ty gia do la', 'vietcombank', 'lai suat', 'gui tiet kiem', 'tai khoan ngan hang', 'bat dong san', 'lam sao de giau', 'lam giau',
      // Thời tiết thuần túy (loại trừ câu hỏi tham quan trong nhà khi trời mưa)
      'du bao thoi tiet', 'weather in', 'co mua khong',
      // Thể thao, giải trí, game, mạng xã hội, người nổi tiếng
      'world cup', 'ngoai hang anh', 'doi tuyen viet nam', 'da may gio', 'bong da',
      'netflix', 'lien quan', 'minecraft', 'leo rank', 'tiktok', 'son tung', 'elon musk', 'bill gates',
      // Công nghệ, lập trình, toán, bài tập, dịch thuật, văn học
      'python', 'javascript', 'quicksort', 'fibonacci', 'dijkstra', 'docker', 'ubuntu', 'windows 11', 'man hinh xanh',
      'phuong trinh', 'tich phan', 'pytago', 'cong 2 bang may', '2 cong 2', 'ielts', 'viet cv', 'don xin nghi phep',
      'ta con meo', 'truyen kieu', 'bai tho song', 'triet hoc mac', 'dich cau nay', 'giao tiep trong 30 ngay',
      'iphone', 'so sanh samsung', 'laptop nao choi game', 'hack wifi',
      // Ẩm thực công thức, đời sống, y tế dân sinh, xổ số, tử vi, thú cưng, tình cảm
      'huong dan nau pho', 'cach lam banh chung', 'cong thuc pha tra sua', 'tu van tinh cam', 'nguoi yeu doi chia tay',
      'danh lo', 'xo so mien bac', 'chua cam cum', 'dau rang uong thuoc', 'tap gym', '6 mui',
      'cat toc nam', 'quan karaoke', 'khach san 5 sao gan my dinh', 'mua ve may bay', 'lam ho chieu', 'bang lai xe a1',
      'nuoi meo', 'cho poodle', 'cay kim tien hop menh', 'xem tu vi', 'cung bo cap', 'vuot den do phat',
      'dong dat o nhat ban', 'thu do nuoc uc', 'dan so nhat ban', 'bong den dien', 'newton', 'trai dat cach mat troi',
      'mat trang co nuoc', 'bau troi tai sao co mau xanh', 'chatgpt voi gemini',
      // Địa danh ngoài Hỏa Lò (khi KHÔNG hỏi khoảng cách/đường đi từ Hỏa Lò)
      'chua mot cot', 'lang bac', 'nha tu con dao', 'nha tu phu quoc', 'dia dao cu chi', 'dinh doc lap',
      'vinh ha long', 'fansipan', 'cau vang da nang', 'thap eiffel', 'van ly truong thanh', 'kim tu thap ai cap',
      'bastille', 'alcatraz', 'ben nha rong', 'chua huong', 'trang an ninh binh', 'phong nha ke bang',
      'thanh co quang tri', 'nga ba dong loc', 'cho ben thanh', 'ho tay rong', 'cau long bien',
      'hoang thanh thang long', 'bao tang dan toc hoc', 'cong vien thu le', 'san bay noi bai', 'van mieu quoc tu giam'
    ];

    const isHardOos = hardOosPatterns.some(p => hasPhrase(norm, p) || norm.includes(p));
    if (isHardOos && !hasHoaLoAnchor) {
      return {
        intent: INTENTS.OUT_OF_SCOPE,
        subIntent: 'STRICT_OUT_OF_DOMAIN',
        subject: null,
        aspect: 'OUT_OF_BOUNDS',
        confidence: 0.98,
        reason: 'Câu hỏi nằm ngoài phạm vi Di tích Lịch sử Nhà tù Hỏa Lò'
      };
    }

    // 0.08. Ngoại lệ thời tiết TRONG KHUÔN VIÊN DI TÍCH ("trời mưa có tham quan trong nhà được không?")
    if ((hasPhrase(norm, 'troi mua') || hasPhrase(norm, 'mua to') || hasPhrase(norm, 'nang nong')) &&
        (hasPhrase(norm, 'tham quan') || hasPhrase(norm, 'trong nha') || hasPhrase(norm, 'di tich') || hasPhrase(norm, 'hoa lo'))) {
      return {
        intent: INTENTS.VISIT_GUIDANCE,
        subIntent: 'WEATHER_INDOOR_GUIDANCE',
        subject: 'tham_quan_trong_nha',
        aspect: 'VISIT_GUIDANCE',
        confidence: 0.96,
        reason: 'Khách hỏi khả năng tham quan trong nhà khi trời mưa/nắng nóng'
      };
    }

    // 0.1. Kiểm tra chính sách cũ / hết hạn (EXPIRED_POLICY)
    if ((norm.includes('30 000') || norm.includes('30k') || norm.includes('truoc 2016') || norm.includes('2016')) &&
        (hasPhrase(norm, 've') || hasPhrase(norm, 'gia ve') || hasPhrase(norm, 'hoa lo'))) {
      return {
        intent: INTENTS.EXPIRED_POLICY,
        subIntent: 'EXPIRED_TICKET_PRICE',
        subject: 've_tham_quan',
        aspect: 'POLICY_DETAIL',
        confidence: 0.98,
        reason: 'Khách hỏi về chính sách giá vé cũ giai đoạn trước năm 2016 đã hết hiệu lực'
      };
    }

    // 0.2. CỔNG PHÂN MIỀN NGỮ NGHĨA V7.0 (5-Zone Semantic Domain Gate)
    const semRoute = semanticRouter.route(rawQuestion, norm);

    // Tầng 0 ưu tiên tuyệt đối: An toàn khẩn cấp (Trẻ lạc, Y tế, Bệnh viện gần nhất - VI & EN)
    if (semRoute.domain === 'SAFETY_EMERGENCY') {
      return {
        intent: INTENTS.EMERGENCY_SUPPORT,
        subIntent: semRoute.subType,
        subject: 'assistance_emergency',
        aspect: 'EMERGENCY_REQUEST',
        urgency: semRoute.urgency,
        confidence: 0.98,
        reason: `Cổng An toàn ngữ nghĩa phát hiện tình huống khẩn cấp: ${semRoute.subType}`
      };
    }

    // Tầng 1: Quy định vận hành & tiện ích đặc thù (hút thuốc, thú cưng, drone, livestream, sạc pin, wifi, thanh toán thẻ/USD, đoàn 40 HS, rách vé)
    if (semRoute.domain === 'SITE_OPERATIONS') {
      return {
        intent: INTENTS.SITE_OPERATIONS,
        subIntent: semRoute.subType,
        subject: 'van_hanh_di_tich',
        aspect: 'SITE_OPERATIONS',
        confidence: 0.96,
        reason: `Cổng Vận hành phát hiện tình huống thực địa: ${semRoute.subType}`
      };
    }

    // Tầng 2: Câu nhiễu / quá ngắn / gõ bừa / thiếu ngữ cảnh rõ ràng (CLARIFICATION)
    if (semRoute.domain === 'AMBIGUOUS_NOISE') {
      return {
        intent: INTENTS.CLARIFICATION,
        subIntent: semRoute.subType,
        subject: null,
        aspect: 'CLARIFICATION_NEEDED',
        confidence: 0.94,
        reason: `Cổng Ngữ nghĩa yêu cầu làm rõ: ${semRoute.subType}`
      };
    }

    // Tầng 3: Giao tiếp cảm xúc đời thường (mỏi chân, nóng, đói, buồn, khen, hát/thơ)
    if (semRoute.domain === 'CONVERSATIONAL_EMPATHY') {
      return {
        intent: INTENTS.CONVERSATIONAL_EMPATHY,
        subIntent: semRoute.subType,
        subject: null,
        aspect: 'EMPATHY',
        confidence: 0.94,
        reason: `Giao tiếp cảm xúc/đời thường của du khách: ${semRoute.subType}`
      };
    }

    // Tầng 4: Ngoài phạm vi di tích rõ ràng (địa danh khác, tài chính, thể thao, lập trình, mua sắm, Grab/taxi/SIM)
    if (semRoute.domain === 'OUT_OF_DOMAIN') {
      return {
        intent: INTENTS.OUT_OF_SCOPE,
        subIntent: semRoute.subType,
        subject: null,
        aspect: 'OUT_OF_BOUNDS',
        confidence: 0.95,
        reason: `Cổng Phân miền ngữ nghĩa loại trừ ngoài phạm vi: ${semRoute.subType}`
      };
    }

    // 1. Kiểm tra câu hỏi quá ngắn hoặc mơ hồ (Loại trừ lời chào, cảm ơn, tạm biệt)
    const tokens = norm.trim().split(' ').filter(Boolean);
    const isPoliteOrGreeting = (
      norm.includes('chao') || norm.includes('hello') || norm.includes('hi') ||
      norm.includes('cam on') || norm.includes('thank') ||
      norm.includes('tam biet') || norm.includes('bye') ||
      norm.includes('gia ve') || norm.includes('gio mo')
    );
    const isVague = (
      tokens.length <= 2 &&
      !isPoliteOrGreeting
    ) || (
      (norm.includes('toi muon di khu do') || norm.includes('cho toi xem cai nay') || norm.includes('khu do co gi') || norm.includes('cho nay the nao') || (tokens.length <= 4 && norm.includes('giup toi'))) &&
      !context?.lastTopic &&
      !norm.includes('mat do') && !norm.includes('that lac') && !norm.includes('roi vi') && !norm.includes('roi do')
    );

    if (isVague) {
      return {
        intent: INTENTS.AMBIGUOUS_QUERY,
        subIntent: null,
        subject: null,
        aspect: 'CLARIFICATION_NEEDED',
        missingInfo: 'EXHIBIT_OR_AREA_NAME',
        confidence: 0.9,
        reason: 'Câu hỏi thiếu thông tin cụ thể để xác định hiện vật hoặc nhu cầu'
      };
    }

    // 1.5. Giao tiếp hàng ngày, trợ năng & dịch vụ thực tế (Chitchat, Thanks, Goodbye, Parking, Photo)
    if (/^(cảm\s*ơn|thank\s*you|thanks|cảm\s*ơn\s*bạn|biết\s*ơn|đa\s*tạ)\b/i.test(lower) || norm === 'cam on' || norm === 'cam on ban' || norm === 'thank you' || norm === 'thanks') {
      return {
        intent: INTENTS.THANK_YOU,
        subIntent: null,
        subject: null,
        aspect: 'POLITENESS',
        confidence: 0.98,
        reason: 'Lời cảm ơn từ du khách'
      };
    }

    if (/^(tạm\s*biệt|bye|goodbye|hẹn\s*gặp\s*lại|chào\s*tạm\s*biệt|hẹn\s*hôm\s*khác)\b/i.test(lower) || norm === 'tam biet' || norm === 'bye' || norm === 'goodbye' || norm === 'hen gap lai') {
      return {
        intent: INTENTS.GOODBYE,
        subIntent: null,
        subject: null,
        aspect: 'POLITENESS',
        confidence: 0.98,
        reason: 'Lời chào tạm biệt của du khách'
      };
    }

    const isNotOrgQuery = !hasPhrase(norm, 'ban quan ly') && !hasPhrase(norm, 'giam doc') && !hasPhrase(norm, 'truong phong');
    const isBotAgeQuery = isNotOrgQuery && (hasPhrase(norm, 'bao nhieu tuoi') || hasPhrase(norm, 'may tuoi') || hasPhrase(norm, 'sinh nam')) &&
                          (hasPhrase(norm, 'ban') || hasPhrase(norm, 'em') || hasPhrase(norm, 'bot') || hasPhrase(norm, 'huong dan vien')) &&
                          !hasPhrase(norm, 'cay') && !hasPhrase(norm, 'bang') && !hasPhrase(norm, 'nguyen') && !hasPhrase(norm, 'hoang van thu');
    const isBotIdentityQuery = isNotOrgQuery && (
      hasPhrase(norm, 'ban ten gi') || hasPhrase(norm, 'em ten gi') || hasPhrase(norm, 'ten ban la gi') ||
      hasPhrase(norm, 'ban la ai') || hasPhrase(norm, 'em la ai') || hasPhrase(norm, 'ban la gi') ||
      hasPhrase(norm, 'la robot') || hasPhrase(norm, 'la nguoi hay')
    );
    if (isBotAgeQuery || isBotIdentityQuery) {
      return {
        intent: INTENTS.CHITCHAT_BOT,
        subIntent: 'BOT_IDENTITY',
        subject: null,
        aspect: 'IDENTITY',
        confidence: 0.98,
        reason: 'Hỏi về danh tính, tên tuổi hướng dẫn viên ảo'
      };
    }

    if (norm.includes('chuyen cuoi') || norm.includes('ke chuyen vui') || norm.includes('tau hai') || norm.includes('hai huoc') || norm.includes('ke tro vui')) {
      return {
        intent: INTENTS.JOKE_REQUEST,
        subIntent: null,
        subject: null,
        aspect: 'ENTERTAINMENT',
        confidence: 0.98,
        reason: 'Yêu cầu kể chuyện cười trong không gian di tích'
      };
    }

    if ((norm.includes('dang xem nhat') || norm.includes('nen xem gi') || norm.includes('xem gi nhat') || norm.includes('noi bat nhat') || norm.includes('co gi hay nhat') || norm.includes('dac sac nhat')) && !norm.includes('vi sao')) {
      return {
        intent: INTENTS.HIGHLIGHTS_REQUEST,
        subIntent: 'MUST_SEE_HIGHLIGHTS',
        subject: null,
        aspect: 'RECOMMENDATION',
        confidence: 0.98,
        reason: 'Tư vấn các điểm nhấn đáng xem nhất tại Hỏa Lò'
      };
    }

    if (norm.includes('gui xe') || norm.includes('do xe') || norm.includes('bai xe') || norm.includes('cho de xe') || norm.includes('cho gui xe') || norm.includes('bai do xe') || norm.includes('gui o to') || norm.includes('gui xe may') || norm.includes('cho dau xe')) {
      return {
        intent: INTENTS.PARKING_SUPPORT,
        subIntent: norm.includes('o to') ? 'PARKING_CAR' : 'PARKING_BIKE',
        subject: 'bai_gui_xe',
        aspect: 'SERVICE',
        confidence: 0.98,
        reason: 'Hỏi chỗ gửi xe máy / ô tô'
      };
    }

    const isBuyingCameraOutside = (hasPhrase(norm, 'mua may anh') || hasPhrase(norm, 'may anh cu') || hasPhrase(norm, 'sua may anh') || hasPhrase(norm, 'ban may anh'));
    if (!isBuyingCameraOutside && (hasPhrase(norm, 'chup anh') || hasPhrase(norm, 'may anh') || hasPhrase(norm, 'quay phim') || hasPhrase(norm, 'chup hinh') || hasPhrase(norm, 'bat flash') || hasPhrase(norm, 'den flash'))) {
      return {
        intent: INTENTS.PHOTOGRAPHY_POLICY,
        subIntent: 'PHOTO_RULE',
        subject: 'quy_dinh_chup_anh',
        aspect: 'REGULATION',
        confidence: 0.98,
        reason: 'Hỏi về quy định mang máy ảnh, chụp ảnh quay phim'
      };
    }

    const isDining = !hasPhrase(norm, 'quay luu niem') && !hasPhrase(norm, 'luu niem') && (
      hasPhrase(norm, 'quan pho') || hasPhrase(norm, 'quan an') || hasPhrase(norm, 'an gi') ||
      hasPhrase(norm, 'an trua') || hasPhrase(norm, 'an toi') || hasPhrase(norm, 'quan ngon') ||
      hasPhrase(norm, 'quan ca phe') || hasPhrase(norm, 'ca phe gan') || hasPhrase(norm, 'mon ngon') ||
      (hasPhrase(norm, 'restaurant') && (hasPhrase(norm, 'nearby') || hasPhrase(norm, 'near here')))
    );
    if (isDining) {
      return {
        intent: INTENTS.DINING_VICINITY,
        subIntent: 'FOOD_AND_BEVERAGE',
        subject: 'quan_an_gan_day',
        aspect: 'CIVILIAN_SERVICE',
        confidence: 0.98,
        reason: 'Hỏi quán ăn, quán phở, ẩm thực xung quanh di tích'
      };
    }

    if ((norm.includes('ho guom') || norm.includes('ho hoan kiem')) && (norm.includes('di bo') || norm.includes('bao lau') || norm.includes('may phut') || norm.includes('bao xa') || norm.includes('cach bao xa') || norm.includes('mat bao lau'))) {
      return {
        intent: INTENTS.VICINITY_DISTANCE,
        subIntent: 'WALKING_TO_HO_GUOM',
        subject: 'ho_guom',
        aspect: 'DISTANCE_WALK',
        confidence: 0.98,
        reason: 'Hỏi khoảng cách và thời gian đi bộ từ Hỏa Lò ra Hồ Gươm'
      };
    }

    if ((norm.includes('3 cau') || norm.includes('ba cau')) && (norm.includes('tom tat') || norm.includes('ngan gon') || norm.includes('dung 3 cau') || norm.includes('ngan thoi'))) {
      return {
        intent: INTENTS.SUMMARY_REQUEST,
        subIntent: 'THREE_SENTENCES_SUMMARY',
        subject: 'lich_su_hoa_lo',
        aspect: 'SUMMARY_CONSTRAINT',
        confidence: 0.98,
        reason: 'Yêu cầu tóm tắt lịch sử Hỏa Lò trong đúng 3 câu ngắn'
      };
    }

    if ((norm.includes('4 gio 15') || norm.includes('4h15') || norm.includes('16h15') || norm.includes('4 rưỡi') || norm.includes('chieu roi')) && (norm.includes('kip khong') || norm.includes('co kip') || norm.includes('con kip') || norm.includes('vao xem co kịp') || norm.includes('vao xem co kip khong'))) {
      return {
        intent: INTENTS.TIME_FEASIBILITY,
        subIntent: 'VISIT_FEASIBILITY_AFTERNOON',
        subject: 'gio_mo_cua',
        aspect: 'FEASIBILITY',
        confidence: 0.98,
        reason: 'Khách hỏi đến lúc 4h15 chiều vào xem có kịp không'
      };
    }

    if ((norm.includes('mua to') || norm.includes('dang mua') || norm.includes('troi mua')) && (norm.includes('bi uot') || norm.includes('uot khong') || norm.includes('tham quan duoc khong') || norm.includes('co bi uot'))) {
      return {
        intent: INTENTS.WEATHER_ADVISORY,
        subIntent: 'RAIN_WEATHER_VISIT',
        subject: 'thoi_tiet_tham_quan',
        aspect: 'EXPERIENCE',
        confidence: 0.98,
        reason: 'Khách hỏi trời mưa to tham quan Hỏa Lò có bị ướt không'
      };
    }

    if (norm.includes('khong biet bat dau') || norm.includes('bat dau xem tu dau') || norm.includes('bat dau tu dau') || norm.includes('chi giup minh di')) {
      return {
        intent: INTENTS.TOUR_RECOMMENDATION,
        subIntent: 'SUGGESTED_START_ROUTE',
        subject: 'lo_trinh_tham_quan',
        aspect: 'TOUR_PLANNING',
        confidence: 0.98,
        reason: 'Khách chưa biết bắt đầu xem từ đâu, cần hướng dẫn lộ trình xuất phát'
      };
    }

    // 2. Chào hỏi và xã giao (Greeting)
    const isGreeting = (
      /^(xin\s*chào|chào\s*(bạn|ai|ad|admin|em)|hello|hi|hey|good\s*morning|chào\s*buổi\s*sáng)\b/i.test(lower)
    ) && tokens.length <= 5;
    if (isGreeting) {
      return {
        intent: INTENTS.GREETING,
        subIntent: null,
        subject: null,
        aspect: 'POLITENESS',
        confidence: 0.95,
        reason: 'Lời chào hỏi thông thường'
      };
    }

    // 3. Ngoài phạm vi di tích (Out Of Scope)
    const strictOutOfScope = [
      'quan an', 'nha hang', 'quan ca phe', 'an uong quanh', 'an gi quanh', 'quan ngon',
      'thoi tiet', 'du bao thoi tiet', 'gia vang', 'chung khoan', 'bitcoin', 'crypto',
      'con dao', 'nha tu con dao', 'nha tu phu quoc',
      'tong so tu nhan suot lich su', 'tong so tu nhan bi giam suot lich su', 'tong so tu nhan trong lich su', 'chinh xac bao nhieu tu nhan trong suot'
    ];
    if (strictOutOfScope.some(s => norm.includes(s))) {
      return {
        intent: INTENTS.OUT_OF_SCOPE,
        subIntent: null,
        subject: null,
        aspect: 'OUT_OF_BOUNDS',
        confidence: 0.95,
        reason: 'Chủ đề nằm ngoài phạm vi hoặc không có dữ liệu lưu trữ công khai tại Di tích Hỏa Lò'
      };
    }

    const hasHoaLoWhitelist = this.hoaLoWhitelist.some(w => norm.includes(' ' + w + ' ') || norm.includes(w));
    if (!hasHoaLoWhitelist) {
      const isOutOfScope = this.outOfScopeEntities.some(e => norm.includes(' ' + e + ' ') || norm.includes(e));
      if (isOutOfScope) {
        return {
          intent: INTENTS.OUT_OF_SCOPE,
          subIntent: null,
          subject: null,
          aspect: 'OUT_OF_BOUNDS',
          confidence: 0.95,
          reason: 'Câu hỏi hoàn toàn nằm ngoài phạm vi Di tích Nhà tù Hỏa Lò'
        };
      }
    }

    // 4. Khiếu nại, phản ánh không hài lòng & Đóng góp ý kiến (Customer Complaint)
    const complaintSignals = [
      'khong hai long', 'khong tot', 'trai nghiem te', 'dich vu te', 'that vong',
      'buc minh', 'kho chiu', 'thai do nhan vien', 'thieu nhiet tinh', 'thai do khong tot',
      'thai do kem', 'phuc vu kem', 'qua dong', 'chen chuc', 'on ao', 'khieu nai',
      'gop y phan anh', 'mat tien oan', 'rat te', 'khong dang tien', 'hoan tien', 'tra ve',
      'bi re', 're mot ben', 're tai', 're tieng', 'hong tai nghe', 'tai nghe bi', 'khong nghe duoc', 'tai nghe hong', 'loi tai nghe',
      'dong gop y kien', 'dong gop', 'gap ban quan ly', 'gap to truong', 'so gop y', 'phan anh', 'y kien ve dich vu', 'gop y',
      'gat gong', 'quat mang', 'kho tinh', 'bat lich su', 'thieu ton trong', 'thai do',
      'dissatisfied', 'bad experience', 'terrible', 'awful', 'complaint', 'rude staff',
      'poor service', 'not satisfied', 'unhappy', 'noisy', 'crowded', 'broken headphone', 'audio crackling', 'feedback'
    ];
    const isFeedbackOrComplaint = complaintSignals.some(s => norm.includes(s)) ||
      (norm.includes('nhan vien') && (norm.includes('gat') || norm.includes('quat') || norm.includes('mang') || norm.includes('kem') || norm.includes('kho chiu') || norm.includes('thai do'))) ||
      (norm.includes('ban quan ly') && (norm.includes('gap') || norm.includes('gop y') || norm.includes('y kien') || norm.includes('phan anh') || norm.includes('dong gop')));

    if (isFeedbackOrComplaint) {
      let subIntent = 'SERVICE_QUALITY';
      let urgency = 'NORMAL';
      if (norm.includes('thai do') || norm.includes('nhan vien') || norm.includes('thieu nhiet tinh') || norm.includes('gat gong') || norm.includes('quat') || norm.includes('rude')) {
        subIntent = 'STAFF_ATTITUDE';
        urgency = 'HIGH';
      } else if (norm.includes('bi re') || norm.includes('re mot ben') || norm.includes('hong tai nghe') || norm.includes('tai nghe bi') || norm.includes('audioguide')) {
        subIntent = 'AUDIO_DEVICE';
        urgency = 'IMMEDIATE_ACTION';
      } else if (norm.includes('qua dong') || norm.includes('chen chuc') || norm.includes('on ao') || norm.includes('ngot ngat') || norm.includes('crowded')) {
        subIntent = 'OVERCROWDING';
      } else if (norm.includes('hoan tien') || norm.includes('tra ve') || norm.includes('doi ve') || norm.includes('refund')) {
        subIntent = 'REFUND_REQUEST';
      } else if (norm.includes('ban quan ly') || norm.includes('so gop y') || norm.includes('gop y') || norm.includes('dong gop') || norm.includes('y kien') || norm.includes('khieu nai')) {
        subIntent = 'MANAGEMENT_FEEDBACK';
      }

      return {
        intent: INTENTS.CUSTOMER_COMPLAINT,
        subIntent,
        subject: 'service_care',
        aspect: 'COMPLAINT_FEEDBACK',
        urgency,
        confidence: 0.94,
        reason: `Khách hàng khiếu nại/góp ý phân loại: ${subIntent}`
      };
    }

    // 5. Thất lạc tài sản & Hỗ trợ mất đồ (LOST_AND_FOUND)
    const isLostItem = (
      !norm.includes('ban roi') && !norm.includes('may bay') && !norm.includes('phi cong') &&
      (
        /\b(?:bi roi|danh roi|lam roi|bi mat|that lac|de quen|bo quen|quen)\b.*?\b(?:vi tien|chiec vi|cai vi|bop tien|bop|dien thoai|ao khoac|tui xach|balo|giay to|tai san|do dac|do ca nhan)\b/i.test(norm) ||
        norm.includes('mat do') || norm.includes('that lac') || norm.includes('quen do') ||
        norm.includes('roi vi') || norm.includes('roi do') || norm.includes('danh roi') ||
        norm.includes('lam roi') || norm.includes('mat vi') || norm.includes('mat dien thoai') ||
        norm.includes('mat giay to') || norm.includes('mat vi tien') || norm.includes('roi vi tien') ||
        norm.includes('bi roi vi') || norm.includes('roi tien') ||
        norm.includes('lost item') || norm.includes('lost my') || norm.includes('lost phone') || norm.includes('lost wallet')
      )
    );
    if (isLostItem) {
      return {
        intent: INTENTS.LOST_AND_FOUND,
        subIntent: 'LOST_ITEM',
        subject: 'assistance_emergency',
        aspect: 'ASSISTANCE_REQUEST',
        urgency: 'ACTIONABLE',
        confidence: 0.95,
        reason: 'Khách hàng bị thất lạc tài sản, cần hỗ trợ tìm kiếm'
      };
    }

    // 6. Cấp cứu y tế & Tình huống khẩn cấp (EMERGENCY_SUPPORT)
    const isEmergency = [
      'cap cuu', 'say nang', 'ngat xiu', ' ngat ', 'chong mat', 'so cuu', ' y te ', 'phong y te',
      'lac con', 'lac tre', 'tim be', 'tim con', 'lac chau', 'lac be', 'tim chau', 'lost child', 'medical emergency', 'first aid'
    ].some(s => norm.includes(s));
    if (isEmergency) {
      let subIntent = 'MEDICAL_EMERGENCY';
      let urgency = 'CRITICAL';
      if (norm.includes('lac con') || norm.includes('lac tre') || norm.includes('tim be') || norm.includes('tim con') || norm.includes('lac chau') || norm.includes('lost child')) {
        subIntent = 'LOST_CHILD_URGENT';
        urgency = 'URGENT';
      }
      return {
        intent: INTENTS.EMERGENCY_SUPPORT,
        subIntent,
        subject: 'assistance_emergency',
        aspect: 'EMERGENCY_REQUEST',
        urgency,
        confidence: 0.98,
        reason: `Tình huống khẩn cấp cần can thiệp ngay: ${subIntent}`
      };
    }

    // 7. Yêu cầu hỗ trợ chung từ nhân viên (CUSTOMER_ASSISTANCE)
    const assistanceSignals = [
      'can giup do', 'gap nhan vien', 'gap bao ve', 'lien he ban quan ly', 'can ho tro', 'huong dan vien giup'
    ];
    if (assistanceSignals.some(s => norm.includes(s))) {
      return {
        intent: INTENTS.CUSTOMER_ASSISTANCE,
        subIntent: 'GENERAL_SUPPORT',
        subject: 'assistance_general',
        aspect: 'ASSISTANCE_REQUEST',
        urgency: 'NORMAL',
        confidence: 0.90,
        reason: 'Khách hàng cần liên hệ nhân viên hỗ trợ trực tiếp'
      };
    }

    // 8. Hỗ trợ đối tượng đặc thù, xe lăn, người cao tuổi (ACCESSIBILITY_SUPPORT)
    const accessibilitySignals = [
      'xe lan', 'khuyet tat', 'nguoi tan tat', 'nguoi cao tuoi', 'nguoi gia',
      'ong ba gia', 'tre em', 'tre con', 'con nho', 'tre nho', 'tre so sinh', 'xe day tre em', 'xe day em be', 'xe day', 'em be', 'bac thang',
      'loi di rieng', 'co cho ngoi nghi khong', 'ghe ngoi nghi', 'khiem thi', 'khiem thinh', 'nguoi mu', 'gay dan duong',
      'wheelchair', 'disabled', 'handicapped', 'elderly', 'senior', 'baby stroller', 'children', 'kids', 'ramp'
    ];
    if (accessibilitySignals.some(s => norm.includes(s))) {
      return {
        intent: INTENTS.ACCESSIBILITY_SUPPORT,
        subIntent: null,
        subject: 'accessibility',
        aspect: 'ACCESSIBILITY_NEEDS',
        confidence: 0.92,
        reason: 'Khách hàng hỏi về khả năng tiếp cận và hỗ trợ đối tượng đặc thù'
      };
    }

    // 9. Giờ mở cửa & Lịch hoạt động (OPENING_HOURS)
    const isHistoricalOpening = (norm.includes('nam nao') || norm.includes('khi nao') || norm.includes('moc thoi gian')) && (norm.includes('cai tao') || norm.includes('xep hang') || norm.includes('di tich') || norm.includes('bao tang'));
    const hoursSignals = [
      'gio mo cua', 'mo cua luc may gio', 'mo cua may gio', 'may gio mo cua', 'dong cua', 'may gio dong cua',
      'co nghi trua khong', 'ngay le co mo khong', 'tet co mo khong', 'ngay le', 'tet nguyen dan', 'quoc khanh',
      'thu hai co mo khong', 'gio tham quan', 'lich hoat dong', 'mo cua don khach',
      'opening hours', 'opening time', 'open today', 'when does it open', 'closing time', 'what time does it close', 'schedule'
    ];
    if (!isHistoricalOpening && hoursSignals.some(s => norm.includes(s))) {
      return {
        intent: INTENTS.OPENING_HOURS,
        subIntent: null,
        subject: 'gio_mo_cua',
        aspect: 'POLICY_DETAIL',
        confidence: 0.95,
        reason: 'Hỏi về khung giờ và ngày mở cửa đón khách'
      };
    }

    // 10. Thông tin giá vé & Chính sách miễn giảm (TICKET_INFORMATION)
    const ticketSignals = [
      'gia ve', 've vao cong', 've vao cua', 'mua ve', 'tien ve', 've tham quan', 've xem', 'mua o dau', 'gia bao nhieu',
      'hoc sinh', 'sinh vien', 'hssv', 'giam gia ve', 'mien phi ve', 'dat ve truoc', 'dat ve',
      'doi ve', 'tra ve', 'hoan tien ve',
      'ticket', 'admission', 'entry fee', 'ticket price', 'how much is the ticket', 'how much for a ticket', 'student discount', 'free admission', 'book ticket', 'buy ticket'
    ];
    if (ticketSignals.some(s => hasPhrase(norm, s)) && !hasPhrase(norm, 'thoi tiet') && !hasPhrase(norm, 'may bay') && !hasPhrase(norm, 'taxi') && !hasPhrase(norm, 'airport')) {
      return {
        intent: INTENTS.TICKET_INFORMATION,
        subIntent: null,
        subject: 've_tham_quan',
        aspect: 'POLICY_DETAIL',
        confidence: 0.95,
        reason: 'Hỏi về biểu phí, vé vào cổng và chính sách miễn giảm'
      };
    }

    // 11. Thông tin liên hệ, địa chỉ, hotline, website (CONTACT_INFORMATION)
    const contactSignals = [
      'dia chi hien nay', 'dia chi o dau', 'dia chi nha tu', 'so dien thoai', 'hotline',
      'website', 'email', 'trang web', 'so 1 pho hoa lo', 'thong tin lien he', 'dia chi cu the'
    ];
    if (contactSignals.some(s => norm.includes(s)) && !norm.includes('lang phu khanh') && !norm.includes('xay tren dat')) {
      return {
        intent: INTENTS.CONTACT_INFORMATION,
        subIntent: null,
        subject: 'dia_chi_lien_he',
        aspect: 'CONTACT_DETAIL',
        confidence: 0.94,
        reason: 'Hỏi về địa chỉ hiện hành, số điện thoại hoặc kênh liên hệ di tích'
      };
    }

    // 12. Hướng dẫn & Dịch vụ thuyết minh tự động (AUDIO_GUIDE_SUPPORT)
    const audioGuideSignals = [
      'audioguide', 'thuyet minh tu dong', 'tai nghe thuyet minh', 'may thuyet minh', '35 cau chuyen'
    ];
    if (audioGuideSignals.some(s => norm.includes(s))) {
      return {
        intent: INTENTS.AUDIO_GUIDE_SUPPORT,
        subIntent: null,
        subject: 'audioguide',
        aspect: 'DEVICE_SERVICE',
        confidence: 0.95,
        reason: 'Hỏi về thiết bị và số lượng câu chuyện thuyết minh tự động Audioguide'
      };
    }

    // 13. Tour & Trải nghiệm chuyên đề / Tour đêm (TOUR_INFORMATION)
    const tourInfoSignals = [
      'tour dem', 'dem thieng lieng', 'sang ngoi tinh than viet', 'song nhu nhung doa hoa',
      'lua thanh xuan', 'trung bay chuyen de', 'tam son chi thep', 'but thep long son'
    ];
    if (tourInfoSignals.some(s => norm.includes(s))) {
      return {
        intent: INTENTS.TOUR_INFORMATION,
        subIntent: null,
        subject: 'tour_dem_chuyen_de',
        aspect: 'PROGRAM_INFO',
        confidence: 0.93,
        reason: 'Hỏi về chương trình tour đêm hoặc các trưng bày chuyên đề'
      };
    }

    // 14. Tư vấn lộ trình & Phân bổ thời gian (TOUR_RECOMMENDATION)
    const isHistoricalDuration = norm.includes('xay dung') || norm.includes('thi cong') || norm.includes('hoan thanh') || norm.includes('xay');
    const recommendationSignals = [
      '15 phut', 'co 15 phut', 'chi co 15 phut', '20 phut', 'co 20 phut', 'xem duoc gi', 'xem duoc nhung gi', 'nen xem gi', 'nen xem nhung gi',
      'nen tham quan gi truoc', 'it thoi gian', 'co 30 phut', 'co 45 phut', 'co 1 tieng',
      'goi y lo trinh', 'tham quan theo nhom', 'di cung gia dinh', 'co nen di tour dem',
      'lo trinh nao tot nhat', 'tu van giup toi', 'bao nhieu thoi gian',
      'mat bao lau', 'thoi gian tham quan', 'mat bao nhieu phut', 'may tieng',
      'lo trinh phu hop nhat', 'lo trinh tham quan', 'lo trinh nao',
      'what to see', 'recommendation', 'itinerary', 'limited time', '15 minutes', '20 minutes', '30 minutes', '45 minutes', 'must see', 'highlights'
    ];
    if (!isHistoricalDuration && recommendationSignals.some(s => norm.includes(s))) {
      return {
        intent: INTENTS.TOUR_RECOMMENDATION,
        subIntent: null,
        subject: 'lo_trinh_tham_quan',
        aspect: 'TOUR_PLANNING',
        confidence: 0.92,
        reason: 'Khách cần gợi ý lộ trình hoặc phân bổ thời gian hợp lý'
      };
    }

    // 15. Tiện ích, cơ sở vật chất & Quy định gửi đồ, WC (FACILITY_INFORMATION)
    const facilitySignals = [
      've sinh', 'nha ve sinh', 'di ve sinh', 've sinh o dau', 'nha ve sinh o dau', 'toilet', 'wc',
      'gui do', 'cho gui do', 'tu gui do',
      'gui balo', 'gui hanh ly', 'nuoc uong', 'mua nuoc', 'quay luu niem',
      'mua qua', 'chup anh', 'quay phim', 'co duoc chup anh khong', 'wifi',
      'flycam', 'may quay', 'dang huong', 'hoat dong trai nghiem'
    ];
    if (facilitySignals.some(s => norm.includes(s))) {
      return {
        intent: INTENTS.FACILITY_INFORMATION,
        subIntent: null,
        subject: subject || 'tien_ich_co_so_vat_chat',
        aspect: 'FACILITY_INFO',
        confidence: 0.92,
        reason: 'Hỏi về vị trí và quy định các tiện ích phục vụ khách'
      };
    }

    // 15.5. Định vị vị trí hiện tại & Giới thiệu điểm tham quan (LOCATION_ORIENTATION)
    const orientationSignals = [
      'day la dau', 'day la cho nao', 'day la khu nao', 'toi dang dung dau', 'toi dang o dau',
      'o day la dau', 'cho nay la gi', 'khu nay la gi', 'toi dang lam gi', 'minh dang o dau',
      'minh dang dung dau', 'cho nay co gi', 'o day co gi'
    ];
    if (orientationSignals.some(s => norm.includes(s))) {
      return {
        intent: INTENTS.VISIT_GUIDANCE,
        subIntent: 'LOCATION_ORIENTATION',
        subject: subject || 'dinh_vi_vi_tri',
        aspect: 'ORIENTATION',
        confidence: 0.95,
        reason: 'Khách hỏi vị trí hiện tại hoặc không gian đang đứng'
      };
    }

    // 16. Hướng dẫn & Lưu ý trước chuyến đi (VISIT_GUIDANCE)
    const guidanceSignals = [
      'can biet truoc khi toi', 'truoc chuyen di', 'snapshot', 'gio mo cua, dia chi va gia ve',
      'di nhu the nao', 'loi di vao', 'loi di ra', 'huong di nao', 'tim khu vuc', 'cach quan sat',
      'quy dinh tham quan', 'trang phuc tham quan', 'trang phuc', 'mac do gi'
    ];
    if (guidanceSignals.some(s => norm.includes(s))) {
      return {
        intent: INTENTS.VISIT_GUIDANCE,
        subIntent: null,
        subject: subject || 'huong_dan_tham_quan',
        aspect: 'GUIDELINES',
        confidence: 0.90,
        reason: 'Hướng dẫn chuẩn bị trước chuyến tham quan hoặc nội quy'
      };
    }

    // 17. Thông tin hiện vật cụ thể (EXHIBIT_INFORMATION)
    const exhibitSignals = [
      'may chem', 'guillotine', 'cay bang', 'cong ngam', 'cachot', 'cum sat', 'cum chan',
      'bo quan ao', 'quan ao tu nhan', 'thung ve sinh', 'lap la', 'bat sat', 'que dan',
      'ban chai', 'tau thuoc', 'gang tay', 'but canh bang', 'gach non', 'muoi than',
      'bao chi bi mat', 'to bao lao tu', 'bua liem', 'ao len', 'hien vat', 'vat dung',
      'nang bao nhieu', 'cao bao nhieu', 'lam bang gi', 'chat lieu', 'cau tao'
    ];
    if (exhibitSignals.some(s => norm.includes(s))) {
      return {
        intent: INTENTS.EXHIBIT_INFORMATION,
        subIntent: null,
        subject: subject || 'hien_vat',
        aspect: aspect || 'SPECIFICATION',
        confidence: 0.91,
        reason: 'Khách hỏi về quy cách, chất liệu, tính năng của hiện vật'
      };
    }

    // 18. Thông tin không gian, khu vực, phòng trưng bày (EXHIBITION_INFORMATION)
    const exhibitionSignals = [
      'khu ngoai', 'khu trong', 'trai d', 'trai j', 'trai i', 'trai nu', 'xa lim tu hinh',
      'buong giam', 'phong giam', 'dai tuong niem', 'phu dieu', 'thap canh', 'tuong bao',
      'dien tich', 'trung bay thuong xuyen', 'khu trung bay', 'gian trung bay'
    ];
    if (exhibitionSignals.some(s => norm.includes(s))) {
      return {
        intent: INTENTS.EXHIBITION_INFORMATION,
        subIntent: null,
        subject: subject || 'khu_trung_bay',
        aspect: aspect || 'EXHIBITION_SPACE',
        confidence: 0.90,
        reason: 'Khách hỏi về không gian, quy mô hoặc phân khu trưng bày'
      };
    }

    // 19. Giải thích nguyên nhân, bối cảnh, so sánh, mâu thuẫn nguồn (HISTORICAL_EXPLANATION)
    const explanationSignals = [
      'tai sao', 'vi sao', 'nguyen nhan', 'nguon goc', 'vi ly do gi',
      'y nghia la gi', 'muc dich', 'vi sao lai goi la', 'tai sao co ten',
      'so sanh', 'phan biet', 'khac nhau', 'mau thuan', 'khac biet nguon'
    ];
    if (explanationSignals.some(s => norm.includes(s))) {
      return {
        intent: INTENTS.HISTORICAL_EXPLANATION,
        subIntent: null,
        subject: subject || 'lich_su_hoa_lo',
        aspect: aspect || 'HISTORICAL_CONTEXT',
        confidence: 0.88,
        reason: 'Khách hỏi lý do, nguồn gốc, ý nghĩa hoặc phân tích mâu thuẫn/so sánh'
      };
    }

    // 20. Phân luồng cuối: Không mặc định đẩy câu ngoài miền vào HISTORICAL_FACT
    if (!semRoute.hasHoaLo && !subject && !context?.lastTopic) {
      return {
        intent: INTENTS.OUT_OF_SCOPE,
        subIntent: 'OOD_UNMATCHED_DOMAIN',
        subject: null,
        aspect: 'OUT_OF_BOUNDS',
        confidence: 0.85,
        reason: 'Câu hỏi không chứa thực thể hay ngữ cảnh thuộc phạm vi Di tích Hỏa Lò'
      };
    }

    return {
      intent: INTENTS.HISTORICAL_FACT,
      subIntent: null,
      subject: subject || 'lich_su_su_kien',
      aspect: 'FACTUAL',
      confidence: 0.85,
      reason: 'Câu hỏi tra cứu nhân vật, niên đại hoặc sự kiện lịch sử'
    };
  }
}

module.exports = {
  INTENTS,
  classifier: new IntentClassifier()
};
