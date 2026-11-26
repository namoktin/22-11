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
const {
  semanticRouter,
  hasPhrase,
  hasRawPhrase,
  matchAccentedProperNoun,
  matchAccentSafe,
  analyzeDiscourseMode
} = require('./semantic_router');

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
      'dong kinh nghia thuc', 'trong dong', 'dong son', 'chim lac', 'dat hong',
      'dai hong chung', 'chuong dai hong', 'dathong', 'chuong lon', 'bao kiem', 'kiem hoang gia', 'luong long trieu nhat',
      'dep lop', 'rau muong', 'com tu', 'bua an tu', 'duoc dua duong', 'suoi reo', 'bao bi mat', 'truong hoc cach mang',
      'the tu', 'vn 2017', '2056', 'luoc xuong', 'gao dua', 'khan tay', 'kim khau', 'censure', 'khu tay',
      'nha bep', 'benh xa', 'khe cua', 'o quan sat', 'mang ton', 'ca sat', 'mai ngoi', 'tuong gach', 'xuan phuong',
      '1543', 'hoang quoc viet', 'nguyen quyen', 'le dai', 'xo viet nghe tinh',
      'ma 001', 'ma 002', 'ma 003', 'ma 004', 'so 001', 'so 002', 'so 003', 'so 004'
    ];
  }

  extractSubject(norm) {
    if (norm.includes('trong dong') || norm.includes('dong son') || norm.includes('chim lac') || norm.includes('ngoi sao 14 canh') || norm.includes('ma 001') || norm.includes('so 001')) return 'trong_dong';
    if (norm.includes('dat hong') || norm.includes('dathong') || norm.includes('dai hong chung') || norm.includes('chuong dai hong') || norm.includes('chuong lon') || norm.includes('thap chuong') || norm.includes('ma 003') || norm.includes('so 003')) return 'dat_hong';
    if (norm.includes('bao kiem') || norm.includes('kiem hoang gia') || norm.includes('luong long trieu nhat') || norm.includes('co vat hoang cung') || norm.includes('ma 004') || norm.includes('so 004')) return 'bao_kiem';
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

  /**
   * Phát hiện đa ý định trong 1 câu hỏi (Multi-Intent) + đối tượng khán giả (VD: trẻ em / giải thích đơn giản)
   * Nguyên lý 1 & 2: Bắt buộc bảo toàn dấu ("đóng cửa" ≠ "động của") và KHÔNG ghép ý định dịch vụ phụ vào diễn ngôn lịch sử!
   */
  detectSecondaryIntentsAndAudience(rawQuestion, primaryIntent, discourse = null) {
    const norm = ' ' + nlp.normalize(rawQuestion || '') + ' ';
    const mode = discourse || analyzeDiscourseMode(rawQuestion, norm);

    const isChildMode =
      hasPhrase(norm, 'cho tre em') || hasPhrase(norm, 'cho be') || hasPhrase(norm, 'cho con nho') ||
      hasPhrase(norm, 'giai thich don gian') || hasPhrase(norm, 'de hieu cho be') ||
      hasPhrase(norm, 'for kids') || hasPhrase(norm, 'for children') || hasPhrase(norm, 'simple explanation');

    if (mode.isHistoricalDiscourse) {
      return { secondaryIntents: [], audience: isChildMode ? 'child' : 'general' };
    }

    const secondary = [];
    const checks = [
      ['TICKET_INFORMATION', ['giá vé', 'vé vào', 'bao nhiêu tiền', 'ticket price', 'admission']],
      ['OPENING_HOURS', ['giờ mở cửa', 'mở cửa mấy giờ', 'mấy giờ mở cửa', 'mấy giờ đóng cửa', 'đóng cửa', 'nghỉ trưa', 'opening hours']],
      ['FACILITY_INFORMATION', ['nhà vệ sinh', 'wc', 'toilet', 'gửi đồ', 'balo', 'locker', 'restroom']],
      ['PARKING_SUPPORT', ['gửi xe', 'đỗ xe', 'bãi xe', 'parking']],
      ['PHOTOGRAPHY_POLICY', ['chụp ảnh', 'quay phim', 'flash', 'take photos']],
      ['TOUR_INFORMATION', ['tour đêm', 'đêm thiêng liêng', 'night tour']]
    ];
    for (const [intentName, phrases] of checks) {
      if (intentName === primaryIntent) continue;
      if (matchAccentSafe(rawQuestion, norm, phrases)) secondary.push(intentName);
    }

    return {
      secondaryIntents: secondary,
      audience: isChildMode ? 'child' : 'general'
    };
  }

  classify(rawQuestion, context = null) {
    const result = this._classifyCore(rawQuestion, context);
    const extra = this.detectSecondaryIntentsAndAudience(rawQuestion, result.intent, result.discourse || null);
    return {
      ...result,
      secondaryIntents: extra.secondaryIntents,
      audience: extra.audience,
      routeReason: result.reason || `Classified as ${result.intent}`
    };
  }

  _classifyCore(rawQuestion, context = null) {
    const raw = nlp.cleanRawText(rawQuestion);
    const norm = ' ' + nlp.normalize(raw) + ' ';
    const lower = raw.toLowerCase();

    const subject = this.extractSubject(norm) || context?.lastTopic || null;
    const aspect = this.extractAspect(norm);
    const earlyDiscourse = analyzeDiscourseMode(raw, norm);

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
    // Lưu ý: Không coi từ chung "nha tu" là mỏ neo Hỏa Lò khi khách đang hỏi đích danh nhà tù bên ngoài (Alcatraz, Bastille, Côn Đảo, Phú Quốc)!
    const hasSpecificExternalPrison = hasPhrase(norm, 'alcatraz') || hasPhrase(norm, 'bastille') || matchAccentedProperNoun(raw, 'côn đảo') || matchAccentedProperNoun(raw, 'phú quốc');
    const hasExplicitHoaLoSite = hasPhrase(norm, 'hoa lo') || hasPhrase(norm, 'maison centrale') || hasPhrase(norm, 'hanoi hilton');
    const hasHoaLoAnchor = (hasSpecificExternalPrison && !hasExplicitHoaLoSite)
      ? false
      : (semanticRouter.hasHoaLoCoreEntity(norm) ||
         hasPhrase(norm, 'tham quan trong nha') ||
         (earlyDiscourse.isHistoricalDiscourse && earlyDiscourse.historicalScore >= 4.5));

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
      'danh lo', 'xo so mien bac', 'chua cam cum', 'cam cum', 'thuoc tri', 'dau dau', 'dau rang uong thuoc', 'tap gym', '6 mui',
      'cat toc nam', 'quan karaoke', 'khach san 5 sao gan my dinh', 'mua ve may bay', 'lam ho chieu', 'bang lai xe a1',
      'nuoi meo', 'cho poodle', 'cay kim tien hop menh', 'xem tu vi', 'cung bo cap', 'vuot den do', 'luat giao thong',
      'giau nhat the gioi', 'cau tao cua nguyen tu', 'nguyen tu gom',
      'dong dat o nhat ban', 'thu do nuoc uc', 'dan so nhat ban', 'bong den dien', 'newton', 'trai dat cach mat troi',
      'mat trang co nuoc', 'bau troi tai sao co mau xanh', 'chatgpt voi gemini',
      // Địa danh ngoài Hỏa Lò (khi KHÔNG hỏi khoảng cách/đường đi từ Hỏa Lò)
      'chua mot cot', 'lang bac', 'nha tu con dao', 'nha tu phu quoc', 'dia dao cu chi', 'dinh doc lap',
      'vinh ha long', 'fansipan', 'cau vang da nang', 'thap eiffel', 'van ly truong thanh', 'kim tu thap ai cap',
      'bastille', 'alcatraz', 'ben nha rong', 'chua huong', 'trang an ninh binh', 'phong nha ke bang',
      'thanh co quang tri', 'nga ba dong loc', 'cho ben thanh', 'ho tay rong', 'cau long bien',
      'hoang thanh thang long', 'bao tang dan toc hoc', 'cong vien thu le', 'san bay noi bai', 'van mieu quoc tu giam'
    ];

    // Bắt buộc ranh giới từ nghiêm ngặt (hasPhrase) để tránh "chăn bông dày" -> "bong da", "bảo tồn" -> "o to"!
    const isHardOos = hardOosPatterns.some(p => hasPhrase(norm, p));
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
    if ((hasPhrase(norm, 'troi mua') || hasPhrase(norm, 'mua to') || hasPhrase(norm, 'nang nong') || hasPhrase(norm, 'rains') || hasPhrase(norm, 'raining') || hasPhrase(norm, 'rain')) &&
        (hasPhrase(norm, 'tham quan') || hasPhrase(norm, 'trong nha') || hasPhrase(norm, 'di tich') || hasPhrase(norm, 'hoa lo') || hasPhrase(norm, 'open'))) {
      return {
        intent: INTENTS.WEATHER_ADVISORY,
        subIntent: 'WEATHER_INDOOR_GUIDANCE',
        subject: 'tham_quan_trong_nha',
        aspect: 'VISIT_GUIDANCE',
        confidence: 0.96,
        reason: 'Khách hỏi khả năng tham quan trong nhà khi trời mưa/nắng nóng'
      };
    }

    // 0.085. Ngoại lệ tiện ích cốt lõi (Nhà vệ sinh / Restroom / Toilet) luôn thuộc phạm vi di tích (VI + EN)
    // Nguyên lý 2: Không cướp luồng câu hỏi lịch sử về thùng/xô vệ sinh trong buồng giam xưa!
    if (!earlyDiscourse.isHistoricalDiscourse &&
        (hasPhrase(norm, 'restroom') || hasPhrase(norm, 'restrooms') || hasPhrase(norm, 'washroom') || hasPhrase(norm, 'toilets') || hasPhrase(norm, 'toilet') || hasPhrase(norm, 'nha ve sinh') || hasPhrase(norm, 'di ve sinh'))) {
      return {
        intent: INTENTS.FACILITY_INFORMATION,
        subIntent: 'RESTROOM_LOCATION',
        subject: 'nha_ve_sinh',
        aspect: 'FACILITY_INFO',
        confidence: 0.96,
        reason: 'Khách hỏi vị trí nhà vệ sinh trong khuôn viên di tích'
      };
    }

    // 0.086. Câu hỏi tâm linh/ma quái tại Hỏa Lò -> HISTORICAL_FACT (tránh rơi sang OUT_OF_SCOPE)
    if (hasPhrase(norm, 'co ma') || hasPhrase(norm, 'ma quai') || hasPhrase(norm, 'ghost') || hasPhrase(norm, 'ghosts') || hasPhrase(norm, 'haunted')) {
      return {
        intent: INTENTS.HISTORICAL_FACT,
        subIntent: 'MYTH_FACT_CHECK',
        subject: 'lich_su_hoa_lo',
        aspect: 'FACTUAL',
        confidence: 0.94,
        reason: 'Giải đáp thắc mắc thực tế về không gian trang nghiêm của di tích'
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

    // 0.2. CỔNG PHÂN MIỀN NGỮ NGHĨA V7.0 + DISCOURSE MODE GATE V8.0
    const semRoute = semanticRouter.route(rawQuestion, norm);
    const discourse = semRoute.discourse || earlyDiscourse;
    const isHist = Boolean(discourse.isHistoricalDiscourse);

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

    // 1. Kiểm tra câu hỏi quá ngắn hoặc mơ hồ (Loại trừ lời chào, cảm ơn, tạm biệt, hiện vật, nhân vật & dịch vụ)
    const tokens = norm.trim().split(' ').filter(Boolean);
    const isPoliteOrGreeting = (
      norm.includes('chao') || norm.includes('hello') || norm.includes('hi') ||
      norm.includes('cam on') || norm.includes('thank') ||
      norm.includes('tam biet') || norm.includes('bye') ||
      norm.includes('gia ve') || norm.includes('gio mo')
    );
    const isKnownExhibitOrEntity = (
      norm.includes('may chem') || norm.includes('guillotine') ||
      norm.includes('cay bang') || norm.includes('cong ngam') ||
      norm.includes('cachot') || norm.includes('cum sat') || norm.includes('cum chan') ||
      norm.includes('trong dong') || norm.includes('bao kiem') || norm.includes('dai hong') ||
      norm.includes('chuong') || norm.includes('chuong dong') ||
      norm.includes('mccain') || norm.includes('hilton') || norm.includes('hoa lo') ||
      norm.includes('maison centrale') || norm.includes('dia chi') ||
      norm.includes('ve vao') || norm.includes('ve dem') || norm.includes('tour dem') ||
      norm.includes('gia ve') || norm.includes('gio mo') || norm.includes('nha ve sinh') ||
      norm.includes('toilet') || norm.includes('wc') || norm.includes('gui xe') ||
      norm.includes('thung ve sinh') || norm.includes('lap la') || norm.includes('but canh') ||
      norm.includes('ban do') || norm.includes('nguyen van cu') || norm.includes('hoang van thu') ||
      norm.includes('nguyen thai hoc') || norm.includes('xa lim') || norm.includes('buong giam') ||
      norm.includes('tu hinh') || norm.includes('mo cua') || norm.includes('dong cua')
    );
    const isVague = !isKnownExhibitOrEntity && (
      (tokens.length <= 2 && !isPoliteOrGreeting) || (
        (norm.includes('toi muon di khu do') || norm.includes('cho toi xem cai nay') || norm.includes('khu do co gi') || norm.includes('cho nay the nao') || (tokens.length <= 4 && norm.includes('giup toi'))) &&
        !context?.lastTopic &&
        !norm.includes('mat do') && !norm.includes('that lac') && !norm.includes('roi vi') && !norm.includes('roi do')
      )
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
      hasPhrase(norm, 'ban ten gi') || hasPhrase(norm, 'ban ten la gi') || hasPhrase(norm, 'mang ten la gi') ||
      hasPhrase(norm, 'em ten gi') || hasPhrase(norm, 'em ten la gi') || hasPhrase(norm, 'co ten la gi') ||
      hasPhrase(norm, 'ten ban la gi') || hasPhrase(norm, 'ten em la gi') || hasPhrase(norm, 'ten co la gi') ||
      hasPhrase(norm, 'ban la ai') || hasPhrase(norm, 'em la ai') || hasPhrase(norm, 'co la ai') || hasPhrase(norm, 'may la ai') ||
      hasPhrase(norm, 'ban la gi') || hasPhrase(norm, 'la robot') || hasPhrase(norm, 'la nguoi hay') ||
      hasPhrase(norm, 'ai tao ra ban') || hasPhrase(norm, 'ai lam ra ban')
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

    const isUserIdentityQuery = (
      hasPhrase(norm, 'toi ten la gi') || hasPhrase(norm, 'toi ten gi') || hasPhrase(norm, 'toi la ai') ||
      hasPhrase(norm, 'minh la ai') || hasPhrase(norm, 'ta la ai') || hasPhrase(norm, 'do biet toi la ai') ||
      hasPhrase(norm, 'biet toi la ai')
    );
    if (isUserIdentityQuery) {
      return {
        intent: INTENTS.CHITCHAT_BOT,
        subIntent: 'USER_IDENTITY',
        subject: null,
        aspect: 'IDENTITY',
        confidence: 0.98,
        reason: 'Du khách hỏi về danh tính của chính mình'
      };
    }

    const isBotLocationQuery = (
      (hasPhrase(norm, 'ban o dau') || hasPhrase(norm, 'ban dang o dau') || hasPhrase(norm, 'co dang o dau') ||
       hasPhrase(norm, 'co o dau') || hasPhrase(norm, 'em dang o dau') || hasPhrase(norm, 'em o dau') ||
       hasPhrase(norm, 'bot dang o dau') || hasPhrase(norm, 'bot o dau')) &&
      !hasPhrase(norm, 'nha ve sinh') && !hasPhrase(norm, 'toilet') && !hasPhrase(norm, 'loi thoat') &&
      !hasPhrase(norm, 'gui xe') && !hasPhrase(norm, 'di tich') && !hasPhrase(norm, 'hoa lo o dau') &&
      !hasPhrase(norm, 'xu ban') && !hasPhrase(norm, 'bi ban') && !hasPhrase(norm, 'truong ban') &&
      !hasPhrase(norm, 'tu hinh') && !hasPhrase(norm, 'hoang van thu') && !hasPhrase(norm, 'nguyen thai hoc') &&
      !hasPhrase(norm, 'tu tu') && !hasPhrase(norm, 'phi cong')
    );
    if (isBotLocationQuery) {
      return {
        intent: INTENTS.CHITCHAT_BOT,
        subIntent: 'BOT_LOCATION',
        subject: null,
        aspect: 'LOCATION',
        confidence: 0.98,
        reason: 'Hỏi vị trí của hướng dẫn viên ảo'
      };
    }

    const isExplicitJokeRequest = !isHist && (
      hasPhrase(norm, 'chuyen cuoi') || hasPhrase(norm, 'ke chuyen vui') || hasPhrase(norm, 'tau hai') ||
      hasPhrase(norm, 'ke tro vui') || hasPhrase(norm, 'tell me a joke') || hasPhrase(norm, 'funny joke') ||
      (discourse.isEnglishInput && hasPhrase(norm, 'joke')) ||
      (hasPhrase(norm, 'hai huoc') && (hasPhrase(norm, 'ke') || hasPhrase(norm, 'noi') || hasPhrase(norm, 'chuyen')) && !hasPhrase(norm, 'bai dang') && !hasPhrase(norm, 'mang xa hoi') && !hasPhrase(norm, 'biet danh'))
    );
    if (isExplicitJokeRequest) {
      return {
        intent: INTENTS.JOKE_REQUEST,
        subIntent: null,
        subject: null,
        aspect: 'ENTERTAINMENT',
        confidence: 0.98,
        reason: 'Yêu cầu kể chuyện cười trong không gian di tích'
      };
    }

    // Câu hỏi lộ trình có ràng buộc thời gian ngắn ("chỉ có 20 phút nên xem gì") -> CHỈ khi không phải diễn ngôn lịch sử!
    const hasShortTimeLimit = !isHist && (/\b(15|20|30|45)\s*(phut|p|min|minutes)\b/.test(norm) || hasPhrase(norm, 'it thoi gian') || hasPhrase(norm, 'co it thoi gian'));
    if (hasShortTimeLimit && !norm.includes('xay dung') && !norm.includes('thi cong')) {
      return {
        intent: INTENTS.TOUR_RECOMMENDATION,
        subIntent: 'TIME_CONSTRAINED_ROUTE',
        subject: 'lo_trinh_tham_quan',
        aspect: 'TOUR_PLANNING',
        confidence: 0.96,
        reason: 'Khách có giới hạn thời gian ngắn cần gợi ý lộ trình tinh gọn'
      };
    }

    if (!isHist && (norm.includes('dang xem nhat') || norm.includes('nen xem gi') || norm.includes('xem gi nhat') || norm.includes('noi bat nhat') || norm.includes('co gi hay nhat') || norm.includes('dac sac nhat')) && !norm.includes('vi sao')) {
      return {
        intent: INTENTS.HIGHLIGHTS_REQUEST,
        subIntent: 'MUST_SEE_HIGHLIGHTS',
        subject: null,
        aspect: 'RECOMMENDATION',
        confidence: 0.98,
        reason: 'Tư vấn các điểm nhấn đáng xem nhất tại Hỏa Lò'
      };
    }

    const hasViParking = matchAccentSafe(raw, norm,
      ['gửi xe', 'đỗ xe', 'bãi xe', 'chỗ để xe', 'chỗ gửi xe', 'bãi đỗ xe', 'gửi ô tô', 'gửi xe máy', 'chỗ đậu xe'],
      ['gui xe', 'do xe', 'bai xe', 'cho de xe', 'cho gui xe', 'bai do xe', 'gui o to', 'gui xe may', 'cho dau xe']
    ) || (
      matchAccentSafe(raw, norm, ['xe máy', 'ô tô'], ['xe may', 'o to']) &&
      matchAccentSafe(raw, norm, ['gửi', 'đỗ', 'đậu'], ['gui', 'do', 'dau'])
    );
    const hasEnParking = discourse.isEnglishInput && (hasPhrase(norm, 'park') || hasPhrase(norm, 'parking'));
    if (!isHist && (hasViParking || hasEnParking)) {
      return {
        intent: INTENTS.PARKING_SUPPORT,
        subIntent: (matchAccentSafe(raw, norm, ['ô tô'], ['o to']) || (discourse.isEnglishInput && hasPhrase(norm, 'car'))) ? 'PARKING_CAR' : 'PARKING_BIKE',
        subject: 'bai_gui_xe',
        aspect: 'SERVICE',
        confidence: 0.98,
        reason: 'Hỏi chỗ gửi xe máy / ô tô'
      };
    }

    const isBuyingCameraOutside = (hasPhrase(norm, 'mua may anh') || hasPhrase(norm, 'may anh cu') || hasPhrase(norm, 'sua may anh') || hasPhrase(norm, 'ban may anh'));
    if (!isHist && !isBuyingCameraOutside && (hasPhrase(norm, 'chup anh') || hasPhrase(norm, 'may anh') || hasPhrase(norm, 'quay phim') || hasPhrase(norm, 'chup hinh') || hasPhrase(norm, 'bat flash') || hasPhrase(norm, 'den flash') || hasPhrase(norm, 'take photos') || hasPhrase(norm, 'take pictures') || hasPhrase(norm, 'photos inside'))) {
      return {
        intent: INTENTS.PHOTOGRAPHY_POLICY,
        subIntent: 'PHOTO_RULE',
        subject: 'quy_dinh_chup_anh',
        aspect: 'REGULATION',
        confidence: 0.98,
        reason: 'Hỏi về quy định mang máy ảnh, chụp ảnh quay phim'
      };
    }

    const isDining = !isHist && !hasPhrase(norm, 'quay luu niem') && !hasPhrase(norm, 'luu niem') && (
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

    if ((norm.includes('ho guom') || norm.includes('ho hoan kiem') || norm.includes('hoan kiem')) && (norm.includes('di bo') || norm.includes('bao lau') || norm.includes('may phut') || norm.includes('bao xa') || norm.includes('cach bao xa') || norm.includes('mat bao lau') || norm.includes('how far') || norm.includes('on foot') || norm.includes('walking'))) {
      return {
        intent: INTENTS.VICINITY_DISTANCE,
        subIntent: 'WALKING_TO_HO_GUOM',
        subject: 'ho_guom',
        aspect: 'DISTANCE_WALK',
        confidence: 0.98,
        reason: 'Hỏi khoảng cách và thời gian đi bộ từ Hỏa Lò ra Hồ Gươm'
      };
    }

    if ((norm.includes('3 cau') || norm.includes('ba cau') || norm.includes('3 short sentences') || norm.includes('3 sentences')) && (norm.includes('tom tat') || norm.includes('ngan gon') || norm.includes('dung 3 cau') || norm.includes('ngan thoi') || norm.includes('summarize'))) {
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
    const strictArchiveBounds = [
      'tong so tu nhan suot lich su', 'tong so tu nhan bi giam suot lich su', 'tong so tu nhan trong lich su', 'chinh xac bao nhieu tu nhan trong suot'
    ];
    if (strictArchiveBounds.some(s => norm.includes(s))) {
      return {
        intent: INTENTS.OUT_OF_SCOPE,
        subIntent: null,
        subject: null,
        aspect: 'OUT_OF_BOUNDS',
        confidence: 0.95,
        reason: 'Chủ đề nằm ngoài phạm vi hoặc không có dữ liệu lưu trữ công khai tại Di tích Hỏa Lò'
      };
    }
    const strictOutOfScope = [
      'quan an', 'nha hang', 'quan ca phe', 'an uong quanh', 'an gi quanh', 'quan ngon',
      'thoi tiet', 'du bao thoi tiet', 'gia vang', 'chung khoan', 'bitcoin', 'crypto',
      'nha tu con dao', 'nha tu phu quoc'
    ];
    const hasStrictOosPhrase = strictOutOfScope.some(s => hasPhrase(norm, s)) || matchAccentedProperNoun(raw, 'côn đảo');
    if (!isHist && !hasPhrase(norm, 'hoa lo') && hasStrictOosPhrase) {
      return {
        intent: INTENTS.OUT_OF_SCOPE,
        subIntent: null,
        subject: null,
        aspect: 'OUT_OF_BOUNDS',
        confidence: 0.95,
        reason: 'Chủ đề nằm ngoài phạm vi hoặc không có dữ liệu lưu trữ công khai tại Di tích Hỏa Lò'
      };
    }

    const hasHoaLoWhitelist = isHist || this.hoaLoWhitelist.some(w => hasPhrase(norm, w));
    if (!hasHoaLoWhitelist) {
      const isOutOfScope = this.outOfScopeEntities.some(e => hasPhrase(norm, e));
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
    // Nguyên lý 1 & 2: Bảo toàn dấu ("bị rè" ≠ "bị rêu"), loại từ đơn mơ hồ ("đóng góp", "thái độ"), khóa khi là diễn ngôn lịch sử!
    const complaintSignals = [
      'khong hai long', 'khong tot', 'trai nghiem te', 'dich vu te', 'that vong',
      'buc minh', 'kho chiu', 'thai do nhan vien', 'thieu nhiet tinh', 'thai do khong tot',
      'thai do kem', 'thai do phuc vu', 'phuc vu kem', 'qua dong', 'chen chuc', 'on ao', 'khieu nai',
      'gop y phan anh', 'mat tien oan', 'rat te', 'khong dang tien', 'hoan tien', 'tra ve',
      're mot ben', 're tai', 're tieng', 'hong tai nghe', 'tai nghe bi', 'khong nghe duoc', 'tai nghe hong', 'loi tai nghe',
      'dong gop y kien', 'gap ban quan ly', 'gap to truong', 'so gop y', 'phan anh', 'y kien ve dich vu', 'gop y',
      'gat gong', 'quat mang', 'kho tinh', 'bat lich su', 'thieu ton trong',
      'dissatisfied', 'bad experience', 'terrible', 'awful', 'complaint', 'rude staff',
      'poor service', 'not satisfied', 'unhappy', 'noisy', 'crowded', 'broken headphone', 'audio crackling', 'feedback'
    ];
    const hasAccentedAudioStatic = matchAccentSafe(raw, norm, ['bị rè', 'rè một bên', 'rè tai', 'rè tiếng'], ['bi re', 're mot ben', 're tai', 're tieng']);
    const isNightTourBookingMentioningBox = hasPhrase(norm, 'dem thieng lieng') &&
      (hasPhrase(norm, 'dat lich') || hasPhrase(norm, 'dat truoc') || hasPhrase(norm, 'dang ky') || hasPhrase(norm, 'co ve'));
    const isFeedbackOrComplaint = !isHist && !isNightTourBookingMentioningBox && (
      hasAccentedAudioStatic ||
      complaintSignals.some(s => hasPhrase(norm, s)) ||
      (hasPhrase(norm, 'nhan vien') && (hasPhrase(norm, 'gat') || hasPhrase(norm, 'quat') || hasPhrase(norm, 'mang') || hasPhrase(norm, 'kem') || hasPhrase(norm, 'kho chiu') || hasPhrase(norm, 'thai do'))) ||
      (hasPhrase(norm, 'ban quan ly') && (hasPhrase(norm, 'gap') || hasPhrase(norm, 'gop y') || hasPhrase(norm, 'y kien') || hasPhrase(norm, 'phan anh') || hasPhrase(norm, 'dong gop')))
    );

    if (isFeedbackOrComplaint) {
      let subIntent = 'SERVICE_QUALITY';
      let urgency = 'NORMAL';
      if (hasPhrase(norm, 'thai do') || hasPhrase(norm, 'nhan vien') || hasPhrase(norm, 'thieu nhiet tinh') || hasPhrase(norm, 'gat gong') || hasPhrase(norm, 'quat') || hasPhrase(norm, 'rude')) {
        subIntent = 'STAFF_ATTITUDE';
        urgency = 'HIGH';
      } else if (hasAccentedAudioStatic || hasPhrase(norm, 'hong tai nghe') || hasPhrase(norm, 'tai nghe bi') || hasPhrase(norm, 'audioguide')) {
        subIntent = 'AUDIO_DEVICE';
        urgency = 'IMMEDIATE_ACTION';
      } else if (hasPhrase(norm, 'qua dong') || hasPhrase(norm, 'chen chuc') || hasPhrase(norm, 'on ao') || hasPhrase(norm, 'ngot ngat') || hasPhrase(norm, 'crowded')) {
        subIntent = 'OVERCROWDING';
      } else if (hasPhrase(norm, 'hoan tien') || hasPhrase(norm, 'tra ve') || hasPhrase(norm, 'doi ve') || hasPhrase(norm, 'refund')) {
        subIntent = 'REFUND_REQUEST';
      } else if (hasPhrase(norm, 'ban quan ly') || hasPhrase(norm, 'so gop y') || hasPhrase(norm, 'gop y') || hasPhrase(norm, 'dong gop y kien') || hasPhrase(norm, 'y kien') || hasPhrase(norm, 'khieu nai')) {
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
    const isLostItem = !isHist && (
      !norm.includes('ban roi') && !norm.includes('may bay') && !norm.includes('phi cong') &&
      (
        /\b(?:bi roi|danh roi|lam roi|bi mat|that lac|de quen|bo quen|quen)\b.*?\b(?:vi tien|chiec vi|cai vi|bop tien|bop|dien thoai|ao khoac|tui xach|balo|giay to|tai san|do dac|do ca nhan)\b/i.test(norm) ||
        hasPhrase(norm, 'mat do') || hasPhrase(norm, 'that lac') || hasPhrase(norm, 'quen do') ||
        hasPhrase(norm, 'roi vi') || hasPhrase(norm, 'roi do') || hasPhrase(norm, 'danh roi') ||
        hasPhrase(norm, 'lam roi') || hasPhrase(norm, 'mat vi') || hasPhrase(norm, 'mat dien thoai') ||
        hasPhrase(norm, 'mat giay to') || hasPhrase(norm, 'mat vi tien') || hasPhrase(norm, 'roi vi tien') ||
        hasPhrase(norm, 'bi roi vi') || hasPhrase(norm, 'roi tien') ||
        hasPhrase(norm, 'lost item') || hasPhrase(norm, 'lost my') || hasPhrase(norm, 'lost phone') || hasPhrase(norm, 'lost wallet')
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
    const isHistoricalLeafMedicalQuestion = norm.includes('la bang') || norm.includes('cay bang') || norm.includes('bup bang');
    const isEmergency = !isHist && !isHistoricalLeafMedicalQuestion && [
      'cap cuu', 'say nang', 'ngat xiu', 'ngat', 'chong mat', 'so cuu', 'phong y te', 'tram y te', 'ho tro y te',
      'lac con', 'lac tre', 'tim be', 'tim con', 'lac chau', 'lac be', 'tim chau', 'lost child', 'medical emergency', 'first aid'
    ].some(s => hasPhrase(norm, s));
    if (isEmergency) {
      let subIntent = 'MEDICAL_EMERGENCY';
      let urgency = 'CRITICAL';
      if (hasPhrase(norm, 'lac con') || hasPhrase(norm, 'lac tre') || hasPhrase(norm, 'tim be') || hasPhrase(norm, 'tim con') || hasPhrase(norm, 'lac chau') || hasPhrase(norm, 'lost child')) {
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
    if (!isHist && assistanceSignals.some(s => hasPhrase(norm, s))) {
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

    // 7.5. Hướng dẫn & Dịch vụ thuyết minh tự động (AUDIO_GUIDE_SUPPORT — đặt TRƯỚC Accessibility để câu hỏi Audioguide có nhắc "trẻ em" không bị kéo sang vé trẻ em!)
    const audioGuideSignals = [
      'audioguide', 'thuyet minh tu dong', 'tai nghe thuyet minh', 'may thuyet minh', '35 cau chuyen'
    ];
    if (!isHist && audioGuideSignals.some(s => hasPhrase(norm, s))) {
      return {
        intent: INTENTS.AUDIO_GUIDE_SUPPORT,
        subIntent: null,
        subject: 'audioguide',
        aspect: 'DEVICE_SERVICE',
        confidence: 0.95,
        reason: 'Hỏi về thiết bị và số lượng câu chuyện thuyết minh tự động Audioguide'
      };
    }

    // 8. Hỗ trợ đối tượng đặc thù, xe lăn, người cao tuổi (ACCESSIBILITY_SUPPORT)
    const accessibilitySignals = [
      'xe lan', 'khuyet tat', 'nguoi tan tat', 'nguoi cao tuoi', 'nguoi gia',
      'ong ba gia', 'tre em', 'tre con', 'con nho', 'tre nho', 'tre so sinh', 'xe day tre em', 'xe day em be', 'xe day', 'em be', 'bac thang',
      'loi di rieng', 'co cho ngoi nghi khong', 'ghe ngoi nghi', 'khiem thi', 'khiem thinh', 'nguoi mu', 'gay dan duong',
      'wheelchair', 'disabled', 'handicapped', 'elderly', 'senior', 'baby stroller', 'children', 'kids', 'ramp'
    ];
    if (!isHist && accessibilitySignals.some(s => hasPhrase(norm, s))) {
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
    // Nguyên lý 1 & 2: Bắt buộc bảo toàn dấu "đóng cửa" ≠ "động của" (sửa dứt điểm HL-788!), tách luật EN & khóa khi isHist!
    const isHistoricalOpening = (norm.includes('nam nao') || norm.includes('khi nao') || norm.includes('moc thoi gian')) && (norm.includes('cai tao') || norm.includes('xep hang') || norm.includes('di tich') || norm.includes('bao tang'));
    const isTemporaryExhibitionStatus = norm.includes('bang oi') || (norm.includes('chuyen de') && norm.includes('con mo'));
    const hasViHoursSignal = matchAccentSafe(raw, norm,
      ['giờ mở cửa', 'mở cửa lúc mấy giờ', 'mở cửa mấy giờ', 'mấy giờ mở cửa', 'đóng cửa', 'mấy giờ đóng cửa', 'có nghỉ trưa không', 'nghỉ trưa', 'ngày lễ có mở không', 'tết có mở không', 'ngày lễ', 'tết nguyên đán', 'quốc khánh', 'thứ hai có mở không', 'giờ tham quan', 'lịch hoạt động', 'mở cửa đón khách'],
      ['gio mo cua', 'mo cua luc may gio', 'mo cua may gio', 'may gio mo cua', 'dong cua', 'may gio dong cua', 'co nghi trua khong', 'nghi trua', 'ngay le co mo khong', 'tet co mo khong', 'ngay le', 'tet nguyen dan', 'quoc khanh', 'thu hai co mo khong', 'gio tham quan', 'lich hoat dong', 'mo cua don khach']
    );
    const enHoursSignals = ['opening hours', 'opening time', 'open today', 'when does it open', 'closing time', 'what time does it close', 'schedule'];
    const hasEnHoursSignal = (discourse.isEnglishInput && enHoursSignals.some(s => hasPhrase(norm, s))) ||
      hasPhrase(norm, 'opening hours') || hasPhrase(norm, 'opening time') || hasPhrase(norm, 'closing time');
    if (!isHist && !isHistoricalOpening && !isTemporaryExhibitionStatus && (hasViHoursSignal || hasEnHoursSignal)) {
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
    const strongTicketSignals = [
      'gia ve', 've vao cong', 've vao cua', 'mua ve', 'tien ve', 've xem', 'mua o dau', 'gia bao nhieu',
      'hssv', 'the sinh vien', 'the hoc sinh', 'giam gia ve', 'mien phi ve', 'dat ve truoc', 'dat ve',
      'doi ve', 'tra ve', 'hoan tien ve',
      'ticket', 'admission', 'entry fee', 'ticket price', 'how much is the ticket', 'how much for a ticket', 'student discount', 'free admission', 'book ticket', 'buy ticket'
    ];
    const personaDiscountSignals = ['hoc sinh', 'sinh vien', 'sv', 'uu dai', 'giam gia', 'mien phi', 'discount', 've tham quan'];
    const hasFeeOrTicketWord = /\b(gia ve|mua ve|ve vao|tien ve|giam gia|giam ve|duoc giam|giam 50|mien phi|uu dai|bao nhieu tien|bao nhieu|mat phi|mat tien|the sinh vien|the hoc sinh|the hssv|quen the|ticket|cost|fee|price|free|discount)\b/.test(norm);
    const matchesTicket = strongTicketSignals.some(s => hasPhrase(norm, s)) ||
                          (personaDiscountSignals.some(s => hasPhrase(norm, s)) && hasFeeOrTicketWord);
    if (!isHist && matchesTicket && !hasPhrase(norm, 'thoi tiet') && !hasPhrase(norm, 'may bay') && !hasPhrase(norm, 'taxi') && !hasPhrase(norm, 'airport')) {
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
    if (!isHist && contactSignals.some(s => hasPhrase(norm, s)) && !norm.includes('lang phu khanh') && !norm.includes('xay tren dat')) {
      return {
        intent: INTENTS.CONTACT_INFORMATION,
        subIntent: null,
        subject: 'dia_chi_lien_he',
        aspect: 'CONTACT_DETAIL',
        confidence: 0.94,
        reason: 'Hỏi về địa chỉ hiện hành, số điện thoại hoặc kênh liên hệ di tích'
      };
    }

    // (AUDIO_GUIDE_SUPPORT đã được ưu tiên kiểm tra ở mục 7.5 phía trên ACCESSIBILITY_SUPPORT)

    // 13. Tour & Trải nghiệm chuyên đề / Tour đêm (TOUR_INFORMATION)
    const tourInfoSignals = [
      'tour dem', 'dem thieng lieng', 'sang ngoi tinh than viet', 'song nhu nhung doa hoa',
      'lua thanh xuan', 'trung bay chuyen de', 'tam son chi thep', 'but thep long son'
    ];
    if (!isHist && tourInfoSignals.some(s => hasPhrase(norm, s))) {
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
      'goi y lo trinh', 'co nen di tour dem',
      'lo trinh nao tot nhat', 'tu van giup toi', 'bao nhieu thoi gian',
      'mat bao lau', 'thoi gian tham quan', 'mat bao nhieu phut', 'may tieng',
      'lo trinh phu hop nhat', 'lo trinh tham quan', 'lo trinh nao',
      'what to see', 'recommendation', 'itinerary', 'limited time', '15 minutes', '20 minutes', '30 minutes', '45 minutes', 'must see', 'highlights'
    ];
    const hasFamilyOrGroupContext = norm.includes('di cung gia dinh') || norm.includes('tham quan theo nhom');
    const asksPlanningWithFamily = hasFamilyOrGroupContext &&
      (!subject || /\b(lo trinh|nen xem|nen di|goi y|tu van|bao lau|phut|tieng|sap xep|itinerary|route|plan)\b/.test(norm)) &&
      !/\b(trong dong|dong son|cay bang|dat hong|dai hong chung|bao kiem|may chem|cachot|cong ngam|minh khai|hoang van thu|nguyen thai hoc|mccain|pho|dep lop|rau muong)\b/.test(norm);
    if (!isHist && !isHistoricalDuration && (recommendationSignals.some(s => hasPhrase(norm, s)) || asksPlanningWithFamily)) {
      return {
        intent: INTENTS.TOUR_RECOMMENDATION,
        subIntent: null,
        subject: 'lo_trinh_tham_quan',
        aspect: 'TOUR_PLANNING',
        confidence: 0.92,
        reason: 'Khách cần gợi ý lộ trình hoặc phân bổ thời gian hợp lý'
      };
    }

    // 15. Tiện ích, cơ sở vật chất & Quy định gửi đồ, WC (FACILITY_INFORMATION — loại từ đơn "ve sinh" tránh bắt nhầm công tác vệ sinh bảo tồn hiện vật!)
    const facilitySignals = [
      'nha ve sinh', 'di ve sinh', 've sinh o dau', 'nha ve sinh o dau', 'phong ve sinh', 'toilet', 'wc',
      'gui do', 'cho gui do', 'tu gui do',
      'gui balo', 'gui hanh ly', 'nuoc uong', 'mua nuoc', 'quay luu niem',
      'mua qua', 'chup anh', 'quay phim', 'co duoc chup anh khong', 'wifi',
      'flycam', 'may quay', 'dang huong', 'hoat dong trai nghiem'
    ];
    if (!isHist && facilitySignals.some(s => hasPhrase(norm, s))) {
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
    if (!isHist && orientationSignals.some(s => hasPhrase(norm, s))) {
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
    if (!isHist && guidanceSignals.some(s => hasPhrase(norm, s))) {
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
    if (exhibitSignals.some(s => hasPhrase(norm, s))) {
      return {
        intent: INTENTS.EXHIBIT_INFORMATION,
        subIntent: null,
        subject: subject || 'hien_vat',
        aspect: aspect || 'SPECIFICATION',
        confidence: 0.91,
        reason: 'Khách hỏi về quy cách, chất liệu, tính năng của hiện vật'
      };
    }

    // 18. Thông tin không gian, khu vực, phòng trưng bày (EXHIBITION_INFORMATION — bắt buộc word-boundary tránh "trai d" khớp "trai dat"!)
    const exhibitionSignals = [
      'khu ngoai', 'khu trong', 'trai d', 'trai j', 'trai i', 'trai nu', 'xa lim tu hinh',
      'buong giam', 'phong giam', 'dai tuong niem', 'phu dieu', 'thap canh', 'tuong bao',
      'dien tich', 'trung bay thuong xuyen', 'khu trung bay', 'gian trung bay'
    ];
    if (exhibitionSignals.some(s => hasPhrase(norm, s))) {
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
    if (explanationSignals.some(s => hasPhrase(norm, s))) {
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
    if (!semRoute.hasHoaLo && !isHist && !subject && !context?.lastTopic) {
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
