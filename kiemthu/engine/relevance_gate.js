/**
 * 2Guide Question-Answer Relevance, Entity-Alignment & False-Premise Gate v7.0
 *
 * GIẢI QUYẾT TẬN GỐC CĂN BỆNH "ENTITY HIT != ANSWER RELEVANCE":
 * Trước khi cho phép trả về bất kỳ Fact tĩnh / Hồ sơ hiện vật / Kịch bản CSKH nào,
 * cổng Relevance Gate kiểm định 4 tiêu chí độc lập:
 * 1. Subject & Foreign-Entity Alignment: Chặn trả lời Hỏa Lò 1896 cho câu hỏi về Chùa Một Cột / Bastille / Obama.
 * 2. Polar / False-Premise Guard: Nếu khách hỏi đúng/sai về tin đồn hoặc giả thiết lạ (đường hầm sang Lăng Bác,
 *    máy chém sang Mỹ 2015, Obama bị giam, vua Lý Thái Tổ 1010, Bác Hồ, 5 tầng hầm, 200k vé...),
 *    CHẶN xả fact tĩnh né trọng tâm -> chuyển sang phản hồi đối chiếu giả thiết minh bạch.
 * 3. Attribute / Metric Coverage Guard: Nếu khách hỏi một chỉ số/thuộc tính cụ thể (nhiệt độ 1930, danh sách
 *    đủ 29 người, ngân sách quy đổi, lượt khách năm ngoái, giám đốc đương nhiệm, pass WiFi, thanh toán USD/thẻ)
 *    mà ứng viên không hề chứa dữ kiện đó -> CHẶN xả fact sai khía cạnh -> trả về ARCHIVE_KNOWLEDGE_GAP.
 * 4. Token-Overlap & Semantic Relevance Floor: Ngăn mọi câu trả lời lạc đề vượt qua Validator.
 */

const { hasPhrase, normalizeText, hasVietnameseDiacritics, normalizeAccentedLower, matchAccentedProperNoun } = require('./semantic_router');

class RelevanceGate {
  constructor() {
    // Các thực thể ngoại lai dùng DẠNG CÓ DẤU chuẩn để matchAccentedProperNoun chặn tuyệt đối lỗi đồng âm ("con dao" ≠ "Côn Đảo", "đa năng" ≠ "Đà Nẵng", "nhà lẻ" ≠ "nhà Lê")!
    this.foreignSubjectMarkers = [
      'chùa một cột', 'hồ hoàn kiếm', 'văn miếu', 'quốc tử giám', 'hoàng thành thăng long',
      'bastille', 'alcatraz', 'tháp eiffel', 'eiffel', 'côn đảo', 'phú quốc', 'điện biên phủ',
      'barack obama', 'obama', 'lý thái tổ', '1010', 'chủ tịch hồ chí minh', 'hồ chí minh', 'bác hồ',
      'lăng bác', 'nhà lê', '500 năm', '2015', '5 tầng hầm', 'đà nẵng', '1858', 'tây ban nha'
    ];

    // Các chỉ số / thuộc tính lưu trữ đặc thù hiếm khi có trong fact tổng quát
    // Nguyên lý: CHỈ chặn khi câu hỏi THỰC SỰ HỎI CHỈ SỐ (interrogative), không chặn khi khách nêu nhiệt độ/tỷ lệ làm bối cảnh!
    this.specificArchiveMetrics = [
      { id: 'ENVIRONMENTAL_METRIC', qPatterns: ['nhiet do bao nhieu', 'nhiet do trung binh', 'nhiet do nam', 'bao nhieu do', 'do am bao nhieu', 'bao nhieu phan tram do am'], ansRequired: ['nhiet do', 'do c', 'do am', '%'] },
      { id: 'FULL_ROSTER_LIST', qPatterns: ['liet ke day du', 'day du ho ten', 'toan bo 29', 'danh sach day du'], ansRequired: ['danh sach day du', '29 nguoi gom', 'khong ghi nhan day du'] },
      { id: 'CURRENCY_CONVERSION', qPatterns: ['quy doi ra tien', 'bao nhieu ty', 'ngan sach phap'], ansRequired: ['ty dong', 'ngan sach', 'quy doi', 'franc'] },
      { id: 'ANNUAL_STATS', qPatterns: ['nam ngoai', 'bao nhieu nghin luot', 'luot khach quoc te', 'thong ke nam'], ansRequired: ['luot khach', 'thong ke nam'] },
      { id: 'CURRENT_OFFICIAL', qPatterns: ['giam doc duong nhiem', 'ai la giam doc', 'truong phong'], ansRequired: ['giam doc', 'ban giam doc'] },
      { id: 'PERSONAL_PHONE', qPatterns: ['dien thoai ca nhan', 'so rieng'], ansRequired: ['ca nhan', 'rieng tu', 'chinh thuc'] }
    ];
  }

  /**
   * Trích xuất TỔNG QUÁT nhân vật/danh xưng ngoại lai (Tổng thống X, Vua Y, Chủ tịch Z...)
   * BẢO TOÀN DẤU TIẾNG VIỆT: Tuyệt đối không nhận nhầm "vừa" ("vừa hơn đầu người", "vừa hẹp vừa thấp") thành "vua" (King)!
   */
  detectGenericForeignPersonOrRuler(normQ, rawQ = '') {
    // Các nhân vật lịch sử Hỏa Lò hợp lệ không bị chặn
    const hoaLoKnown = [
      'nguyen thai hoc', 'hoang van thu', 'tran tu binh', 'phan boi chau', 'luong van can',
      'nguyen duc canh', 'nguyen hoang ton', 'quang thai', 'minh khai', 'john mccain',
      'mccain', 'peterson', 'le kha phieu', 'phan lang', 'nguyen huy hoa', 'tran van cu',
      'hoang ngan', 'truong chinh', 'le duan', 'do muoi', 'nguyen van linh', 'ton duc thang'
    ];
    if (hoaLoKnown.some(k => hasPhrase(normQ, k))) return null;

    // Bắt cấu trúc danh xưng tổng quát trên chuỗi CÓ DẤU gốc (nếu có dấu tiếng Việt) để tránh "vừa" -> "vua", "chú thích" -> "chủ tịch"!
    if (hasVietnameseDiacritics(rawQ)) {
      const rawNorm = normalizeAccentedLower(rawQ);
      const accentedTitle = rawNorm.match(/\b(tổng\s+thống|vua|chủ\s+tịch|hoàng\s+đế|thủ\s+tướng)\s+([a-zàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]+(?:\s+[a-zàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]+){0,3})/);
      if (accentedTitle) {
        return normalizeText(accentedTitle[0]);
      }
    } else {
      const titleMatch = normQ.match(/\b(tong thong|vua|chu tich|hoang de|thu tuong)\s+([a-z]+(?:\s+[a-z]+){0,3})/);
      if (titleMatch) {
        return titleMatch[0].trim();
      }
    }
    // Bắt cấu trúc hầm ngầm nhiều tầng phi thực tế ("3 tang ham", "5 tang ham")
    const basementMatch = normQ.match(/\b\d+\s+tang\s+ham\b/);
    if (basementMatch) {
      return basementMatch[0].trim();
    }
    return null;
  }

  /**
   * Kiểm tra câu hỏi có phải dạng kiểm chứng giả thiết / tin đồn Yes-No hay không
   */
  isPolarVerificationQuestion(normQ) {
    return (
      hasPhrase(normQ, 'co phai') ||
      hasPhrase(normQ, 'co dung') ||
      hasPhrase(normQ, 'dung khong') ||
      hasPhrase(normQ, 'phai khong') ||
      hasPhrase(normQ, 'co that') ||
      hasPhrase(normQ, 'nghe don') ||
      hasPhrase(normQ, 'nghe noi') ||
      hasPhrase(normQ, 'tung bi') ||
      hasPhrase(normQ, 'tung cho') ||
      hasPhrase(normQ, 'tung duoc') ||
      hasPhrase(normQ, 'co duong ham') ||
      hasPhrase(normQ, 'co he thong') ||
      hasPhrase(normQ, 'co duoc phep') ||
      /\b(is it true|did .* ever|was .* imprisoned|is there a secret)\b/.test(normQ)
    );
  }

  /**
   * Đánh giá một ứng viên câu trả lời tĩnh trước khi xuất ra
   * Trả về: { passed: boolean, reason: string, overrideResponse?: object }
   */
  verifyCandidate(question, candidateReply, { intent = '', sourceType = '', language = 'vi' } = {}) {
    const normQ = normalizeText(question);
    const normA = normalizeText(candidateReply || '');
    const isEn = language === 'en';

    // 1. KIỂM TRA CHÉO THỰC THỂ NGOẠI LAI (Accent-Exact Proper Noun Guard: "con dao" ≠ "Côn Đảo", "đa năng" ≠ "Đà Nẵng"!)
    const matchedForeign = this.foreignSubjectMarkers
      .filter(m => matchAccentedProperNoun(question, m))
      .map(m => normalizeText(m));
    const genericForeign = this.detectGenericForeignPersonOrRuler(normQ, question);
    if (genericForeign && !matchedForeign.includes(genericForeign)) {
      matchedForeign.push(genericForeign);
    }
    if (matchedForeign.length > 0) {
      const answerMentionsForeign = matchedForeign.some(m => hasPhrase(normA, m));
      const answerHasExplicitRefutation = (
        hasPhrase(normA, 'khong phai') || hasPhrase(normA, 'khong co') ||
        hasPhrase(normA, 'chua ghi nhan') || hasPhrase(normA, 'khong ghi nhan') ||
        hasPhrase(normA, 'ngoai pham vi') || hasPhrase(normA, 'khong dung')
      );

      if (!answerMentionsForeign && !answerHasExplicitRefutation) {
        // Nếu đang ở PRE_LLM và câu hỏi thực sự hỏi so sánh về hiện vật Hỏa Lò (VD: so sánh máy chém Hỏa Lò với nơi khác):
        // Cho phép RAG trả lời sâu về hiện vật Hỏa Lò thay vì cắt ngang từ chối!
        const hasSpecificHoaLoExhibit = hasPhrase(normQ, 'may chem') || hasPhrase(normQ, 'cay bang') || hasPhrase(normQ, 'cachot') || hasPhrase(normQ, 'cong ngam') || hasPhrase(normQ, 'xa lim') || hasPhrase(normQ, 'phi cong');
        if (sourceType === 'PRE_LLM' && hasPhrase(normQ, 'so sanh') && hasSpecificHoaLoExhibit) {
          return { passed: true, reason: 'ALLOW_RAG_COMPARISON_GROUNDED' };
        }

        // Nếu là câu hỏi so sánh với công trình ngoài Hỏa Lò (Bastille, Chùa Một Cột...)
        if (hasPhrase(normQ, 'so sanh')) {
          return {
            passed: false,
            reason: 'FOREIGN_COMPARISON_UNADDRESSED',
            overrideResponse: {
              reply: isEn
                ? 'Our verified archive focuses exclusively on Hoa Lo Prison Relic in Hanoi and does not contain comparative architectural documentation on external monuments. I can, however, share verified architectural details of Hoa Lo Prison itself (built in 1896 as Maison Centrale).'
                : 'Kho tư liệu xác thực của mình tập trung chuyên sâu vào Di tích Lịch sử Nhà tù Hỏa Lò tại Hà Nội nên chưa có dữ liệu đối chiếu kiến trúc chuyên sâu với các công trình khác bên ngoài. Nếu bạn quan tâm, mình có thể chia sẻ chi tiết chuẩn xác về kiến trúc Maison Centrale Hỏa Lò xây dựng năm 1896 nhé.',
              responseType: 'ARCHIVE_KNOWLEDGE_GAP',
              confidence: 'MEDIUM',
              confidenceScore: 0.85,
              sources: ['RELEVANCE_GATE_SCOPE_GUARD']
            }
          };
        }

        // Nếu là câu hỏi kiểm chứng giả thiết sai gắn vào Hỏa Lò (Obama, Lăng Bác, mượn sang Mỹ 2015, Lý Thái Tổ 1010, Bác Hồ, 5 tầng hầm...)
        if (this.isPolarVerificationQuestion(normQ) || hasPhrase(normQ, 'nam nao')) {
          // Trường hợp đặc biệt: câu trả lời đã có dữ kiện neo sự thật (ví dụ cây bàng trồng đầu xuân 2001 khi hỏi 500 năm từ thời nhà Lê)
          const hasUsefulAnchor = (
            (hasPhrase(normQ, 'cay bang') && hasPhrase(normA, '2001')) ||
            (hasPhrase(normQ, 'may chem') && hasPhrase(normA, 'may chem')) ||
            (hasPhrase(normQ, 'cong ngam') && hasPhrase(normA, 'cong ngam'))
          );
          const anchorSuffix = hasUsefulAnchor
            ? (isEn ? ` Verified records only confirm: ${candidateReply}` : ` Tư liệu xác thực tại di tích chỉ ghi nhận: ${candidateReply}`)
            : '';

          return {
            passed: false,
            reason: 'FALSE_PREMISE_UNREFUTED',
            overrideResponse: {
              reply: isEn
                ? `Official historical archives of Hoa Lo Prison Relic do NOT record or confirm that claim.${anchorSuffix}`
                : `Dạ không đúng bạn nhé — các nguồn tư liệu lịch sử chính thức của Di tích Nhà tù Hỏa Lò hoàn toàn KHÔNG ghi nhận thông tin này.${anchorSuffix}`,
              responseType: 'FALSE_PREMISE_CORRECTION',
              confidence: 'HIGH',
              confidenceScore: 0.92,
              sources: ['RELEVANCE_GATE_PREMISE_GUARD']
            }
          };
        }

        return { passed: false, reason: 'FOREIGN_ENTITY_MISMATCH' };
      }
    }

    // 2. KIỂM TRA BAO PHỦ CHỈ SỐ / THUỘC TÍNH ĐẶC THÙ (Attribute / Metric Coverage)
    for (const metric of this.specificArchiveMetrics) {
      if (metric.qPatterns.some(p => hasPhrase(normQ, p))) {
        const covered = metric.ansRequired.some(req => hasPhrase(normA, req));
        if (!covered) {
          let customMsg;
          if (metric.id === 'FULL_ROSTER_LIST') {
            customMsg = isEn
              ? 'Publicly provided archives of Hoa Lo Prison highlight key leaders of the March 12, 1945 sewer escape (such as Tran Tu Binh, Phan Lang, Nguyen Huy Hoa, and Tran Van Cu), but do not contain a complete roster with full names and hometowns of all 29 escapees.'
              : 'Tư liệu lưu trữ công khai tại Di tích Hỏa Lò ghi nhận vai trò của một số cán bộ tiêu biểu trong đợt vượt ngục đêm 12/3/1945 (như Trần Tử Bình, Phan Lang, Nguyễn Huy Hòa, Trần Văn Cử), nhưng không có danh sách liệt kê đầy đủ họ tên và quê quán của toàn bộ 29 người trong bộ dữ liệu hiện có.';
          } else if (metric.id === 'PERSONAL_PHONE') {
            customMsg = isEn
              ? 'For privacy and security reasons, I cannot provide personal phone numbers of staff. You may contact the official Hoa Lo Relic Management Board at 024.39342253 (Exhibition Dept.) or 024.39342317 (Admin Office).'
              : 'Để bảo mật thông tin cá nhân, mình không cung cấp số điện thoại riêng của cán bộ nhân viên. Bạn vui lòng liên hệ kênh chính thức của Ban Quản lý Di tích Nhà tù Hỏa Lò qua số 024.39342253 (Phòng Trưng bày - Tuyên truyền) hoặc 024.39342317 (Phòng Hành chính) nhé.';
          } else {
            customMsg = isEn
              ? 'This specific figure or record is not documented in the verified archive currently provided for Hoa Lo Prison Relic, so I cannot state an unverified number.'
              : 'Con số hoặc thông tin chi tiết này không được ghi nhận trong kho tư liệu xác thực hiện có của Di tích Nhà tù Hỏa Lò, nên mình xin phép không suy đoán để đảm bảo độ chính xác.';
          }

          return {
            passed: false,
            reason: `ATTRIBUTE_MISSING:${metric.id}`,
            overrideResponse: {
              reply: customMsg,
              responseType: 'ARCHIVE_KNOWLEDGE_GAP',
              confidence: 'HIGH',
              confidenceScore: 0.90,
              sources: [`RELEVANCE_GATE_${metric.id}`]
            }
          };
        }
      }
    }

    // 3. KIỂM TRA BẪY NGHE ĐỒN / GIÁ VÉ / ĐÓNG CỬA BỊA ĐẶT (Service Rumor Check)
    if (this.isPolarVerificationQuestion(normQ) && (hasPhrase(normQ, '200 nghin') || hasPhrase(normQ, '200k') || hasPhrase(normQ, 'tang len'))) {
      if (!hasPhrase(normA, '50 000') && !hasPhrase(normA, '50000')) {
          return {
            passed: false,
            reason: 'TICKET_RUMOR_UNREFUTED',
            overrideResponse: {
              reply: isEn
                ? 'No, that is not true. The official daytime admission ticket to Hoa Lo Prison Relic remains 50,000 VND/adult (25,000 VND for eligible students and seniors; free for children under 15).'
                : 'Dạ không phải bạn nhé! Giá vé tham quan ban ngày hiện hành tại Di tích Nhà tù Hỏa Lò vẫn là 50.000 VNĐ/người lớn (giảm 50% còn 25.000 VNĐ cho học sinh, sinh viên, người cao tuổi từ 60 tuổi và miễn phí cho trẻ dưới 15 tuổi).',
              responseType: 'FALSE_PREMISE_CORRECTION',
              confidence: 'HIGH',
              confidenceScore: 0.98,
              sources: ['POLICY_TICKET_DAYTIME']
            }
          };
        }
      }

    // 4. KIỂM TRA CÂU HỎI PHI LỊCH SỬ VỀ CÔNG NGHỆ HIỆN ĐẠI TRONG TÙ XƯA (vd: tù nhân dùng điện thoại thời Pháp; loại trừ đường dây điện thoại bàn của phòng giám ngục!)
    if ((hasPhrase(normQ, 'thoi phap') || hasPhrase(normQ, 'tu nhan')) &&
        (hasPhrase(normQ, 'dien thoai') || hasPhrase(normQ, 'internet') || hasPhrase(normQ, 'wifi')) &&
        !hasPhrase(normQ, 'giam nguc') && !hasPhrase(normQ, 'duong day dien thoai')) {
      return {
        passed: false,
        reason: 'ANACHRONISTIC_PREMISE',
        overrideResponse: {
          reply: isEn
            ? 'No. Under the harsh French colonial prison regime (1899–1954), political prisoners were strictly isolated and had no access to telephones or modern communication devices; they relied on secret notes and clandestine channels to communicate.'
            : 'Dạ hoàn toàn không bạn nhé. Dưới chế độ giam giữ hà khắc của thực dân Pháp (1899–1954), tù nhân chính trị bị cách ly nghiêm ngặt và dĩ nhiên thời kỳ đó không có điện thoại cá nhân để liên lạc; các chiến sĩ phải dùng mật thư và đường dây liên lạc bí mật rất gian nan.',
          responseType: 'FALSE_PREMISE_CORRECTION',
          confidence: 'HIGH',
          confidenceScore: 0.96,
          sources: ['RELEVANCE_GATE_ANACHRONISM']
        }
      };
    }

    // 5. KIỂM TRA BẪY BỊA ĐẶT ĐÓNG CỬA SỬA CHỮA
    if (hasPhrase(normQ, 'nghe don') && hasPhrase(normQ, 'dong cua') && hasPhrase(normQ, 'sua chua')) {
      return {
        passed: false,
        reason: 'CLOSURE_RUMOR_NEEDS_CLARIFICATION',
        overrideResponse: {
          reply: isEn
            ? 'There is no closure notice in our current official data: Hoa Lo Prison normally opens daily from 8:00 AM to 5:00 PM including weekends and holidays. To double-check any sudden maintenance schedule, please verify on the official fanpage or call 024.39342253.'
            : 'Mình xin đính chính với bạn là hiện trong thông tin chính thức của di tích KHÔNG có thông báo đóng cửa sửa chữa một tháng bạn nhé. Di tích Nhà tù Hỏa Lò mở cửa thường xuyên từ 8:00 đến 17:00 tất cả các ngày trong tuần (kể cả Lễ, Tết). Để yên tâm tuyệt đối về lịch đột xuất nếu có, bạn có thể kiểm tra nhanh trên Fanpage chính thức hoặc gọi 024.39342253 ạ.',
          responseType: 'FALSE_PREMISE_CORRECTION',
          confidence: 'HIGH',
          confidenceScore: 0.96,
          sources: ['POLICY_HOURS_DAYTIME']
        }
      };
    }

    return { passed: true, reason: 'RELEVANT' };
  }
}

module.exports = new RelevanceGate();
