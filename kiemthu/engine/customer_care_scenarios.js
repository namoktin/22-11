/**
 * 2Guide Advanced Customer Care Scenario Engine v6.1 (Production-Grade)
 * 
 * Quản lý 10 kịch bản Chăm sóc khách hàng, Trợ năng và Tình huống thực tế:
 * 1. COMPLAINT_HANDLING (Khiếu nại: thái độ nhân viên, dịch vụ, chen chúc, tai nghe rè, hoàn tiền, ban quản lý)
 * 2. LOST_AND_FOUND (Mất tài sản, ví tiền, điện thoại, balo)
 * 3. TICKET_SUPPORT (Vé ban ngày 50k, giảm 50% HSSV/người cao tuổi, tour đêm 399k-499k, vé cũ 30k hết hạn, lỗi vé không vào được cổng)
 * 4. TOUR_GUIDANCE (Tư vấn theo thời gian: 15 phút, 30-45 phút, 60-90 phút; gia đình, người cao tuổi)
 * 5. FACILITY_ASSISTANCE (Tủ gửi đồ miễn phí, nhà vệ sinh WC, quà lưu niệm, chụp ảnh)
 * 6. ACCESSIBILITY_ASSISTANCE (Xe lăn, dốc thoải, người cao tuổi, trẻ nhỏ, du khách khiếm thị)
 * 7. EMERGENCY_GUIDANCE (Y tế cấp cứu say nắng/ngất xỉu -> Trạm y tế cổng số 1, gọi 115, BV Việt Đức/Tim; Trẻ lạc khẩn cấp)
 * 8. AUDIO_GUIDE_SUPPORT (Thuê 50k, đổi máy mới miễn phí ngay trong 1-2 phút khi rè/hỏng)
 * 9. VISITOR_FEEDBACK (Sổ góp ý cổng số 1, gặp Tổ trưởng lễ tân/đón tiếp)
 * 10. GENERAL_ASSISTANCE (Tiếp đón chung, kết nối nhân viên số 1 phố Hỏa Lò)
 */

const fs = require('fs');
const path = require('path');
const { getDocentReply } = require('./multilingual_docent');

class CustomerCareScenarioEngine {
  constructor() {
    this.policies = new Map();
    this.loadVerifiedPolicies();
  }

  loadVerifiedPolicies() {
    try {
      const pFile = path.join(__dirname, '..', 'data', 'verified_service_knowledge.json');
      if (fs.existsSync(pFile)) {
        const raw = fs.readFileSync(pFile, 'utf8');
        const data = JSON.parse(raw);
        (data.policies || []).forEach(p => {
          this.policies.set(p.id, p);
        });
      }
    } catch (e) {
      console.warn('[CustomerCareScenarioEngine] Lỗi nạp verified policies:', e.message);
    }
  }

  getPolicy(policyId) {
    return this.policies.get(policyId) || null;
  }

  /**
   * Xử lý kịch bản Chăm sóc khách hàng chuyên sâu theo ngữ cảnh và sub-intent V6.1
   */
  resolveScenario({
    intent,
    subIntent = null,
    urgency = 'NORMAL',
    normQuery = '',
    userProfile = {},
    language = 'vi'
  }) {
    const isEn = language === 'en';

    // 1. KỊCH BẢN KHIẾU NẠI & PHÀN NÀN (COMPLAINT_HANDLING)
    if (intent === 'CUSTOMER_COMPLAINT') {
      const sub = subIntent || 'SERVICE_QUALITY';

      if (sub === 'STAFF_ATTITUDE') {
        const pol = this.getPolicy('POLICY_COMPLAINTS_HANDLING');
        return {
          scenarioId: 'COMPLAINT_STAFF_ATTITUDE',
          response: isEn
            ? 'We sincerely apologize if you experienced impolite behavior from our staff today. Professionalism and respect are our utmost priorities. Could you share where this occurred (e.g., ticket booth or entrance gate)? You may also speak directly to the Duty Supervisor at the main entrance (No. 1 Hoa Lo) or write in our official guest feedback registry so we can promptly address this.'
            : 'Mình rất tiếc và xin chân thành cáo lỗi cùng bạn nếu bạn có trải nghiệm chưa trọn vẹn về thái độ phục vụ của nhân viên hôm nay. Ban Quản lý Di tích luôn coi trọng sự tôn trọng và văn minh đón tiếp. Bạn có thể cho mình biết sự việc xảy ra tại khu vực nào (quầy vé hay cửa soát vé) không? Bạn hãy gặp trực tiếp Tổ trưởng tổ đón tiếp tại cổng chính số 1 Hỏa Lò hoặc ghi vào sổ góp ý để Ban Quản lý kiểm tra và chấn chỉnh kịp thời nhé.',
          authorityBoundary: pol?.authority_boundary || 'Tổ trưởng lễ tân và Ban Quản lý trực tiếp xử lý kiểm điểm nhân viên.',
          actionableGuidance: 'Gặp Tổ trưởng tổ đón tiếp tại Cổng số 1 hoặc ghi Sổ góp ý.',
          requiresHuman: true,
          style: 'EMPATHETIC_SUPPORT'
        };
      }

      if (sub === 'AUDIO_DEVICE') {
        const pol = this.getPolicy('POLICY_AUDIOGUIDE_DEVICE');
        return {
          scenarioId: 'COMPLAINT_AUDIO_DEVICE',
          response: isEn
            ? 'We are truly sorry for the technical issue with your audio guide (crackling sound or audio interruption). To continue enjoying your tour, please bring the device back to the ticket counter at the entrance, and our staff will test and IMMEDIATELY REPLACE IT WITH A NEW UNIT FREE OF CHARGE within 1-2 minutes.'
            : 'Mình rất xin lỗi bạn về sự cố kỹ thuật của tai nghe thuyết minh (bị rè hoặc gián đoạn âm thanh). Để không làm ảnh hưởng hành trình tham quan, bạn hãy mang ngay máy về quầy vé ở cổng chính; các bạn nhân viên sẽ kiểm tra và ĐỔI NGAY MỘT MÁY MỚI HOÀN TOÀN MIỄN PHÍ cho bạn trong 1-2 phút nhé!',
          authorityBoundary: pol?.authority_boundary || 'Nhân viên quầy vé đổi máy mới ngay lập tức.',
          actionableGuidance: 'Mang máy về Quầy vé cổng chính để đổi máy mới miễn phí ngay lập tức.',
          requiresHuman: true,
          style: 'EMPATHETIC_SUPPORT'
        };
      }

      if (sub === 'OVERCROWDING') {
        const pol = this.getPolicy('POLICY_OVERCROWDING_MANAGEMENT');
        return {
          scenarioId: 'COMPLAINT_OVERCROWDING',
          response: isEn
            ? 'We understand that heavy crowds during peak hours can cause discomfort and noise in the narrow historical cells. We recommend taking a relaxing pause in the airy prison courtyard under the shaded banyan tree or near the Memorial Monument, and then revisiting the cells once the crowd thins out.'
            : 'Mình rất tiếc vì lượng khách tham quan tăng cao hôm nay gây cảm giác đông đúc và ồn ào cho bạn. Không gian các phòng giam Hỏa Lò mang tính chất di tích lịch sử nguyên trạng nên vào giờ cao điểm có thể hơi ngột ngạt. Mình gợi ý bạn có thể di chuyển ra sân trại giam dưới bóng mát cây bàng cổ thụ hoặc khu Đài tưởng niệm thoáng đãng để nghỉ chân, sau đó quay lại các buồng giam hẹp khi lượng khách đã giãn bớt nhé.',
          authorityBoundary: pol?.authority_boundary || 'Đội bảo vệ và lễ tân điều tiết giãn luồng.',
          actionableGuidance: 'Nghỉ chân tại Sân cây bàng hoặc Đài tưởng niệm thoáng đãng.',
          requiresHuman: false,
          style: 'EMPATHETIC_SUPPORT'
        };
      }

      if (sub === 'REFUND_REQUEST') {
        const pol = this.getPolicy('POLICY_REFUND_EXCHANGE');
        return {
          scenarioId: 'COMPLAINT_REFUND_REQUEST',
          response: isEn
            ? 'Under the site financial regulations, purchased daytime tickets are non-refundable once issued (except under extraordinary force majeure circumstances decided by management). As an AI guide, I cannot authorize refunds; please present your ticket stub directly to the Chief Cashier at the main entrance (No. 1 Hoa Lo) for official review.'
            : 'Dạ theo quy định quản lý tài chính của Di tích Hỏa Lò, vé tham quan ban ngày đã mua không áp dụng chính sách hoàn trả hoặc đổi tiền mặt sau khi xuất vé (trừ các trường hợp bất khả kháng theo quy định của BQL). Vì mình là trợ lý ảo nên không có thẩm quyền giải quyết tài chính, bạn vui lòng mang cuống vé/hóa đơn đến gặp trực tiếp Trưởng quầy vé tại cổng chính số 1 Hỏa Lò để được nhân viên tiếp nhận và hỗ trợ cụ thể nhé.',
          authorityBoundary: pol?.authority_boundary || 'AI tuyệt đối không tự ý cam kết hoàn tiền. Trưởng quầy vé thụ lý trực tiếp.',
          actionableGuidance: 'Đến gặp Trưởng quầy vé tại Cổng chính số 1 Hỏa Lò.',
          requiresHuman: true,
          style: 'CUSTOMER_CARE'
        };
      }

      if (sub === 'MANAGEMENT_FEEDBACK') {
        const pol = this.getPolicy('POLICY_COMPLAINTS_HANDLING');
        return {
          scenarioId: 'COMPLAINT_MANAGEMENT_FEEDBACK',
          response: isEn
            ? 'The Management Board of Hoa Lo Prison Relic deeply values constructive feedback to continuously improve our services. You can leave your comments in the official Guest Registry at the main entrance, speak with the Duty Reception Team Leader, or contact us via our official hotline and fanpage.'
            : 'Dạ Ban Quản lý Di tích Nhà tù Hỏa Lò luôn trân trọng mọi ý kiến phản ánh chân thành của du khách để không ngừng nâng cao chất lượng dịch vụ. Bạn có thể để lại ý kiến vào "Sổ góp ý" đặt tại quầy thông tin cổng số 1 Hỏa Lò, hoặc trao đổi trực tiếp với Tổ trưởng tổ đón tiếp trong ca trực để được ghi nhận đầy đủ nhất nhé.',
          authorityBoundary: pol?.authority_boundary || 'Ban Quản lý và Tổ trưởng tổ đón tiếp tiếp nhận phản hồi.',
          actionableGuidance: 'Ghi ý kiến vào Sổ góp ý tại quầy thông tin cổng số 1 Hỏa Lò.',
          requiresHuman: true,
          style: 'CUSTOMER_CARE'
        };
      }

      // Default complaint
      return {
        scenarioId: 'COMPLAINT_GENERAL',
        response: isEn
          ? 'We are truly sorry that your visit did not meet your expectations today. We sincerely value your feedback to improve our visitor experience. Could you share what caused your dissatisfaction? If this requires immediate assistance, our team at the main gate (No. 1 Hoa Lo) is always ready to support you.'
          : 'Mình rất tiếc vì trải nghiệm hôm nay chưa đáp ứng được kỳ vọng của bạn. Mình xin chân thành ghi nhận phản hồi này để ban quản lý di tích hoàn thiện chất lượng dịch vụ tốt hơn. Bạn có thể chia sẻ cụ thể điều gì khiến bạn chưa hài lòng không? Nếu vấn đề cần can thiệp trực tiếp ngay lúc này, bạn có thể đến phòng thường trực tại cổng số 1 phố Hỏa Lò để được các anh chị nhân viên hỗ trợ xử lý nhé.',
        authorityBoundary: 'Tổ thường trực cổng chính số 1 Hỏa Lò tiếp nhận.',
        actionableGuidance: 'Liên hệ phòng thường trực Cổng số 1 để được hỗ trợ trực tiếp.',
        requiresHuman: true,
        style: 'EMPATHETIC_SUPPORT'
      };
    }

    // 2. KỊCH BẢN HỖ TRỢ KHẨN CẤP, MẤT ĐỒ & TÀI SẢN (CUSTOMER_ASSISTANCE / LOST_AND_FOUND / EMERGENCY_SUPPORT)
    if (intent === 'CUSTOMER_ASSISTANCE' || intent === 'LOST_AND_FOUND' || intent === 'EMERGENCY_SUPPORT') {
      const sub = subIntent || (intent === 'LOST_AND_FOUND' ? 'LOST_ITEM' : (intent === 'EMERGENCY_SUPPORT' ? 'MEDICAL_EMERGENCY' : 'GENERAL_SUPPORT'));

      if (sub === 'LOST_CHILD_URGENT') {
        const pol = this.getPolicy('POLICY_LOST_CHILD_URGENT');
        return {
          scenarioId: 'ASSISTANCE_LOST_CHILD',
          response: isEn
            ? 'URGENT: Please stay calm and immediately contact the nearest security guard or approach the Security Office at Gate No. 1. Our security team will immediately broadcast an alert across our relic PA system and coordinate checkpoints at all exit gates to help locate your child.'
            : 'KHẨN CẤP: Bạn hãy giữ bình tĩnh và báo ngay cho nhân viên bảo vệ gần nhất hoặc đến thẳng Phòng thường trực bảo vệ tại cổng chính số 1 Hỏa Lò. Đội ngũ an ninh di tích sẽ lập tức phát thông báo khẩn cấp trên hệ thống loa truyền thanh toàn di tích và chốt chặn các cửa ra vào để hỗ trợ tìm kiếm bé ngay lập tức.',
          authorityBoundary: pol?.authority_boundary || 'Bảo vệ phát loa nội bộ khẩn cấp và chốt chặn cổng kiểm soát.',
          actionableGuidance: 'Đến ngay Phòng thường trực Bảo vệ Cổng số 1 hoặc báo bảo vệ gần nhất.',
          requiresHuman: true,
          style: 'EMPATHETIC_SUPPORT'
        };
      }

      if (sub === 'MEDICAL_EMERGENCY') {
        const pol = this.getPolicy('POLICY_FIRST_AID_MEDICAL');
        return {
          scenarioId: 'ASSISTANCE_MEDICAL_EMERGENCY',
          response: isEn
            ? 'For medical assistance (heatstroke, dizziness, or fainting), please notify our on-duty guards immediately or escort the visitor to the First Aid Station at Gate No. 1. Our staff provides on-site first aid and coordinates 115 emergency services or immediate hospital transfer to Hanoi Heart Hospital or Viet Duc Hospital (500m away).'
            : 'Nếu có người bị say nắng, ngất xỉu hoặc cần trợ giúp y tế khẩn cấp, bạn hãy báo ngay cho nhân viên bảo vệ gần nhất hoặc đưa người bệnh ra Trạm sơ cấp cứu tại phòng trực cổng chính số 1 Hỏa Lò. Nhân viên di tích có sẵn tủ thuốc sơ cứu và sẽ lập tức hỗ trợ gọi xe cấp cứu 115 hoặc chuyển viện gần nhất (Bệnh viện Tim Hà Nội hoặc Việt Đức cách 500m).',
          authorityBoundary: pol?.authority_boundary || 'Sơ cấp cứu tại chỗ, điều phối xe cấp cứu 115 hoặc chuyển viện gần nhất.',
          actionableGuidance: 'Báo bảo vệ gần nhất hoặc đưa người bệnh ra phòng y tế cổng số 1.',
          requiresHuman: true,
          style: 'EMPATHETIC_SUPPORT'
        };
      }

      if (sub === 'LOST_ITEM') {
        const pol = this.getPolicy('POLICY_LOST_AND_FOUND');
        return {
          scenarioId: 'ASSISTANCE_LOST_ITEM',
          response: isEn
            ? 'If you have lost personal belongings, please visit the Security Office at the main entrance (No. 1 Hoa Lo Street) to fill in the Lost & Found Registry. Our security team will cross-check items turned in during the day; internal security camera review is conducted by our security personnel according to duty protocols to assist you.'
            : 'Bạn hãy đến ngay phòng thường trực bảo vệ tại cổng chính số 1 Hỏa Lò để khai báo thông tin vào "Sổ tiếp nhận tài sản thất lạc". Đội an ninh sẽ đối chiếu các đồ vật do khách hoặc nhân viên nhặt được bàn giao trong ngày; quy trình trích xuất camera an ninh nội bộ sẽ do Đội bảo vệ thực hiện theo đúng thẩm quyền nghiệp vụ để hỗ trợ bạn.',
          authorityBoundary: pol?.authority_boundary || 'Khai báo sổ tài sản thất lạc. Trích xuất camera do Đội bảo vệ thực hiện theo thẩm quyền nghiệp vụ.',
          actionableGuidance: 'Khai báo tại Phòng thường trực bảo vệ Cổng số 1 Hỏa Lò.',
          requiresHuman: true,
          style: 'CUSTOMER_CARE'
        };
      }

      if (sub === 'TICKET_ISSUE' || /không vào được|lỗi vé|không quét được|mã qr|không nhận vé|kẹt cổng/i.test(normQuery)) {
        const pol = this.getPolicy('POLICY_TICKET_ENTRY_ERROR');
        return {
          scenarioId: 'TICKET_ENTRY_ISSUE',
          response: isEn
            ? 'If you have purchased a ticket but cannot pass the barrier: 1) For QR codes, turn your phone brightness to maximum and ensure the QR is for today; 2) If the automatic reader fails, show the ticket/screen to the guard directly at the gate for manual scan; 3) If the code is unreadable, please approach Ticket Counter No. 1 (5 meters away) to receive a replacement ticket in 1 minute.'
            : 'Nếu bạn đã mua vé nhưng chưa qua được cổng kiểm soát, bạn hãy làm theo hướng dẫn sau nhé: thứ nhất, với vé điện tử hoặc mã QR, bạn bật độ sáng màn hình tối đa và kiểm tra đúng ngày tham quan. Thứ hai, nếu đầu đọc tự động không nhận, bạn đưa vé hoặc màn hình cho nhân viên soát vé đứng ngay tại cửa để được quét thủ công hoặc mở cổng trực tiếp. Thứ ba, nếu vé bị lỗi mã vạch, bạn đến ngay Quầy vé số 1 (cách cửa 5 mét) để được cấp thẻ thay thế trong 1 phút nhé.',
          authorityBoundary: pol?.authority_boundary || 'Nhân viên soát vé và quầy vé cổng số 1 hỗ trợ ngay lập tức.',
          actionableGuidance: 'Đưa vé cho nhân viên soát vé tại cửa hoặc đến Quầy vé số 1 hỗ trợ.',
          requiresHuman: true,
          style: 'QUICK_ANSWER'
        };
      }

      if (sub === 'SCHOOL_ACTIVITY_SPACE' || /muon micro|khoang san nho|trao thuong/i.test(normQuery)) {
        return {
          scenarioId: 'ASSISTANCE_SCHOOL_ACTIVITY',
          response: isEn
            ? 'For school delegations wishing to gather briefly for awards, group photos, or to ask about microphone/courtyard support at the end of a visit, please register in advance with the Management Board via Hotline 024.39342253 so staff can arrange an appropriate time and spot without disturbing the solemnity for other visitors.'
            : 'Dạ với các đoàn học sinh muốn tập hợp ngắn để trao thưởng, chụp ảnh kỷ niệm hoặc hỏi mượn âm thanh cuối buổi tham quan, nhà trường vui lòng liên hệ đăng ký trước với Ban Quản lý Di tích qua Hotline 024.39342253 (hoặc Quầy lễ tân Cổng số 1) để được bố trí khu vực và thời điểm phù hợp, đảm bảo sự trang nghiêm và không ảnh hưởng tới các đoàn khách khác nhé.',
          authorityBoundary: 'Ban Quản lý Di tích xét duyệt và sắp xếp khu vực đoàn trường qua Hotline 024.39342253.',
          actionableGuidance: 'Đăng ký trước với Ban Quản lý qua Hotline 024.39342253.',
          requiresHuman: true,
          style: 'CUSTOMER_CARE'
        };
      }

      if (sub === 'DOCENT_BOOKING' || normQuery.includes('huong dan vien') || normQuery.includes('thuyet minh vien')) {
        const isLateArrival = /toi tre|den tre|ket.*cau|9h25|cho them/i.test(normQuery);
        return {
          scenarioId: 'ASSISTANCE_DOCENT_BOOKING',
          response: isEn
            ? (isLateArrival
              ? 'If your group is delayed by traffic for a scheduled on-site tour guide, please call our Hotline 024.39342253 right away with your group name and estimated arrival time so the reception team can coordinate your docent schedule smoothly.'
              : 'To book a live on-site tour guide (for families, groups of ~15 guests, or delegations) or confirm the current group guiding fee, please inquire directly at Ticket Counter Gate No. 1 or reserve in advance via Hotline 024.39342253. Walk-in availability depends on the daily shift schedule, and multilingual Audioguides (50,000 VND/unit) are always ready on the spot.')
            : (isLateArrival
              ? 'Dạ nếu đoàn đã đặt lịch thuyết minh viên nhưng gặp kẹt xe tới trễ, bạn hãy gọi ngay Hotline 024.39342253 (Phòng Trưng bày – Tuyên truyền) báo tên đoàn và giờ dự kiến tới cổng để bộ phận đón tiếp kịp thời điều phối thuyết minh viên chờ và sắp xếp ca dẫn chu đáo cho đoàn nhé.'
              : 'Dạ để đặt thuê thuyết minh viên trực tiếp cho gia đình hoặc đoàn khoảng 15 người (cũng như kiểm tra biểu phí thuyết minh theo quy mô đoàn hiện hành), bạn có thể liên hệ đặt trước qua Hotline 024.39342253 hoặc đăng ký trực tiếp tại Quầy vé Cổng chính số 1 Hỏa Lò. Nếu tới trực tiếp không hẹn trước, nhân viên quầy vé sẽ kiểm tra ca trực thuyết minh viên còn trống ngay lúc đó; ngoài ra di tích luôn sẵn máy thuyết minh tự động Audioguide (50.000 VNĐ/máy) để cả đoàn dùng ngay rất tiện ạ.'),
          authorityBoundary: 'Đăng ký thuyết minh viên & kiểm tra biểu phí tại Quầy vé Cổng số 1 hoặc Hotline 024.39342253.',
          actionableGuidance: 'Liên hệ Quầy vé Cổng số 1 hoặc Hotline 024.39342253 để xác nhận lịch thuyết minh viên.',
          requiresHuman: true,
          style: 'CUSTOMER_CARE'
        };
      }

      return {
        scenarioId: 'ASSISTANCE_GENERAL',
        response: isEn
          ? 'For immediate assistance or special help, please approach our on-site security guards or receptionists located at the entrance and courtyard. They are always on duty to support you.'
          : 'Đối với các vấn đề cần hỗ trợ trực tiếp tại chỗ, bạn hãy liên hệ ngay với các nhân viên bảo vệ hoặc lễ tân túc trực tại sảnh đón tiếp và sân trại giam. Ban quản lý di tích luôn sẵn sàng hỗ trợ bạn nhanh nhất.',
        authorityBoundary: 'Nhân viên lễ tân và bảo vệ tại chỗ.',
        actionableGuidance: 'Gặp nhân viên lễ tân/bảo vệ tại sảnh đón tiếp hoặc sân trại.',
        requiresHuman: true,
        style: 'CUSTOMER_CARE'
      };
    }

    // 3. KỊCH BẢN TRỢ NĂNG & ĐỐI TƯỢNG ĐẶC BIỆT (ACCESSIBILITY_SUPPORT)
    if (intent === 'ACCESSIBILITY_SUPPORT') {
      const isBlind = normQuery.includes('khiem thi') || normQuery.includes('nguoi mu') || normQuery.includes('gay dan duong');
      const isChildren = normQuery.includes('tre em') || normQuery.includes('tre con') || normQuery.includes('em be') || normQuery.includes('con nho') || normQuery.includes('tre nho') || normQuery.includes('be nha minh') || normQuery.includes('thang tuoi') || normQuery.includes('xe day');
      const isElderly = userProfile?.hasElderly || normQuery.includes('nguoi gia') || normQuery.includes('nguoi cao tuoi') || normQuery.includes('bo me lon tuoi') || normQuery.includes('ong ba');

      if (isBlind) {
        return {
          scenarioId: 'ACCESSIBILITY_BLIND',
          response: isEn
            ? 'Visually impaired visitors may bring guide canes inside the relic and use our Audioguide system for detailed commentary at each section. Our security guards and reception staff are always on duty to support and guide your way safely.'
            : 'Du khách khiếm thị hoàn toàn được mang gậy dẫn đường vào tham quan di tích. Bạn có thể sử dụng tai nghe Audioguide để nghe thuyết minh chi tiết từng khu vực, và đội ngũ nhân viên, bảo vệ luôn sẵn sàng đồng hành, hỗ trợ dẫn đường khi bạn cần giúp đỡ.',
          authorityBoundary: 'Nhân viên bảo vệ và lễ tân hỗ trợ trực tiếp.',
          actionableGuidance: 'Thuê tai nghe Audioguide tại quầy vé và yêu cầu hỗ trợ dẫn đường.',
          requiresHuman: false,
          style: 'CUSTOMER_CARE'
        };
      }

      if (isChildren) {
        const pol = this.getPolicy('POLICY_CHILDREN_SAFETY');
        return {
          scenarioId: 'ACCESSIBILITY_CHILDREN',
          response: isEn
            ? 'Children under 15 enjoy free admission but must be accompanied by an adult. Parents are advised to guide children mindfully when passing darker historical cells such as Cachot and the Guillotine room.'
            : 'Trẻ em dưới 15 tuổi được miễn phí vé tham quan nhưng bắt buộc phải có người lớn đi cùng để bảo đảm an toàn. Các khu vực như Ngục tối Cachot và Máy chém có không gian tối và bối cảnh lịch sử chân thực, phụ huynh nên chú ý hướng dẫn phù hợp với tâm lý của các bé.',
          authorityBoundary: pol?.authority_boundary || 'Phụ huynh có trách nhiệm giám sát trẻ nhỏ.',
          actionableGuidance: 'Trẻ em dưới 15 tuổi miễn vé; phụ huynh lưu ý khi qua buồng tối Cachot và máy chém.',
          requiresHuman: false,
          style: 'CUSTOMER_CARE'
        };
      }

      if (isElderly) {
        const pol = this.getPolicy('POLICY_ACCESSIBILITY_WHEELCHAIR');
        return {
          scenarioId: 'ACCESSIBILITY_ELDERLY',
          response: isEn
            ? 'For elderly visitors, the site features ramp access at main corridors and shaded stone benches under the ancient banyan tree in the courtyard. If needed, you can register for wheelchair assistance or request on-site security guards to assist with walking through historical stone steps.'
            : 'Đối với du khách cao tuổi, di tích đã bố trí đường dốc thoải tại các lối đi chính và nhiều ghế đá nghỉ chân rợp bóng mát dưới cây bàng sân trại giam. Bạn có thể đăng ký mượn xe lăn hoặc nhờ các anh chị bảo vệ hỗ trợ dìu các cụ qua một số bậc tam cấp cổ nhé.',
          authorityBoundary: pol?.authority_boundary || 'Nhân viên bảo vệ hỗ trợ người cao tuổi.',
          actionableGuidance: 'Nghỉ chân dưới bóng cây bàng sân trại; nhờ bảo vệ hỗ trợ bậc tam cấp.',
          requiresHuman: false,
          style: 'CUSTOMER_CARE'
        };
      }

      const pol = this.getPolicy('POLICY_ACCESSIBILITY_WHEELCHAIR');
      return {
        scenarioId: 'ACCESSIBILITY_WHEELCHAIR',
        response: isEn
          ? 'Hoa Lo Prison Relic has ramp access at major entrances for wheelchair users. Security guards and reception staff are always available to assist with navigating steps. Shaded resting benches are located in the courtyard under the banyan tree.'
          : 'Di tích Nhà tù Hỏa Lò có trang bị đường dốc thoải tại các lối đi chính phục vụ du khách sử dụng xe lăn. Nhân viên bảo vệ luôn túc trực để hỗ trợ đẩy xe qua các bậc tam cấp cổ khi cần. Sân trại giam có ghế nghỉ chân rợp mát dưới bóng cây bàng lịch sử.',
        authorityBoundary: pol?.authority_boundary || 'Đội bảo vệ hỗ trợ di chuyển xe lăn.',
        actionableGuidance: 'Sử dụng đường dốc tại lối đi chính hoặc nhờ bảo vệ hỗ trợ xe lăn.',
        requiresHuman: false,
        style: 'CUSTOMER_CARE'
      };
    }

    // 4. KỊCH BẢN THÔNG TIN VÉ & SỰ CỐ VÀO CỔNG (TICKET_INFORMATION)
    if (intent === 'TICKET_INFORMATION') {
      const isEntryIssue = /không vào được|lỗi vé|không quét được|mã qr|không nhận vé|kẹt cổng/i.test(normQuery);
      if (isEntryIssue) {
        const pol = this.getPolicy('POLICY_TICKET_ENTRY_ERROR');
        return {
          scenarioId: 'TICKET_ENTRY_ISSUE',
          response: isEn
            ? 'If you have purchased a ticket but cannot pass the barrier: 1) For QR codes, turn your phone brightness to maximum and ensure the QR is for today; 2) If the automatic reader fails, show the ticket/screen to the guard directly at the gate for manual scan; 3) If the code is unreadable, please approach Ticket Counter No. 1 (5 meters away) to receive a replacement ticket in 1 minute.'
            : 'Nếu bạn đã mua vé nhưng chưa qua được cổng kiểm soát, bạn hãy làm theo hướng dẫn sau nhé: thứ nhất, với vé điện tử hoặc mã QR, bạn bật độ sáng màn hình tối đa và kiểm tra đúng ngày tham quan. Thứ hai, nếu đầu đọc tự động không nhận, bạn đưa vé hoặc màn hình cho nhân viên soát vé đứng ngay tại cửa để được quét thủ công hoặc mở cổng trực tiếp. Thứ ba, nếu vé bị lỗi mã vạch, bạn đến ngay Quầy vé số 1 (cách cửa 5 mét) để được cấp thẻ thay thế trong 1 phút nhé.',
          authorityBoundary: pol?.authority_boundary || 'Nhân viên soát vé và quầy vé cổng số 1 hỗ trợ ngay lập tức.',
          actionableGuidance: 'Đưa vé cho nhân viên soát vé tại cửa hoặc đến Quầy vé số 1 hỗ trợ.',
          requiresHuman: true,
          style: 'QUICK_ANSWER'
        };
      }

      const isTicketReentry = /soat ve|ngoai cop xe|quay lai dung ve|ra lay.*quay lai/i.test(normQuery);
      if (isTicketReentry) {
        return {
          scenarioId: 'TICKET_REENTRY',
          response: isEn
            ? 'Standard daytime tickets are scanned once upon entry. If you just stepped inside and need to run briefly out to your motorbike/car to grab forgotten belongings, please inform the gate attendant right before stepping out and keep your stub/receipt so staff can verify and assist your re-entry smoothly.'
            : 'Dạ thông thường mỗi vé tham quan ban ngày chỉ soát một lượt vào cổng. Trường hợp bạn vừa vào sân ít phút cần chạy nhanh ra cốp xe lấy đồ quên, bạn hãy báo trực tiếp với nhân viên soát vé ngay tại cửa trước khi bước ra và giữ nguyên cuống vé để nhân viên xác nhận, hỗ trợ bạn quay lại tiếp tục tham quan thuận tiện nhé.',
          authorityBoundary: 'Nhân viên soát vé tại Cổng chính số 1 trực tiếp xác nhận.',
          actionableGuidance: 'Báo trực tiếp nhân viên soát vé tại cửa trước khi bước ra ngoài.',
          requiresHuman: true,
          style: 'CUSTOMER_CARE'
        };
      }

      const isTicketWeatherOrOutage = /bao to|cup dien|mat dien|bao luu/i.test(normQuery);
      if (isTicketWeatherOrOutage) {
        return {
          scenarioId: 'TICKET_FORCE_MAJEURE',
          response: isEn
            ? 'Normally daytime tickets are valid on the date of purchase. However, in genuine force majeure events such as severe storms or power outages affecting site operations, please present your tickets directly to the Cashier Supervisor at Ticket Counter Gate No. 1 (or call 024.39342253) for official Management Board review and assistance.'
            : 'Dạ theo quy định chung, vé tham quan ban ngày có giá trị trong ngày mua. Riêng trong trường hợp bất khả kháng như mưa bão lớn hoặc sự cố mất điện làm gián đoạn hoạt động tham quan, bạn vui lòng giữ nguyên cuống vé và trao đổi trực tiếp với Trưởng quầy vé Cổng chính số 1 (hoặc Hotline 024.39342253) để Ban Quản lý xem xét phương án hỗ trợ phù hợp theo quy định nhé.',
          authorityBoundary: 'Ban Quản lý và Trưởng quầy vé Cổng số 1 giải quyết trường hợp bất khả kháng.',
          actionableGuidance: 'Giữ cuống vé và gặp Trưởng quầy vé Cổng chính số 1 để được hỗ trợ.',
          requiresHuman: true,
          style: 'CUSTOMER_CARE'
        };
      }

      const isTicketOnlineBooking = /qua mang|app nao|website chinh thuc|xep hang duoi nang|dat truoc ve/i.test(normQuery);
      if (isTicketOnlineBooking) {
        return {
          scenarioId: 'TICKET_ONLINE_CHANNELS',
          response: isEn
            ? 'Daytime tickets (50,000 VND/adult) are sold quickly directly at Ticket Counter Gate No. 1 with fast moving queues, and you can also check official online booking channels or updates on https://hoalo.vn, our verified Fanpage, or Hotline 024.39342253. Visiting early around 8:00–9:00 AM is the easiest way to avoid Sunday midday queues.'
            : 'Dạ vé tham quan ban ngày (50.000 VNĐ/người lớn) được bán trực tiếp rất nhanh tại Quầy vé Cổng chính số 1 (hỗ trợ cả chuyển khoản/QR nên xếp hàng di chuyển khá nhanh). Để kiểm tra kênh đặt vé trực tuyến chính thức hoặc đặt trước cho đoàn/Tour Đêm, bạn hãy tra cứu trên Website https://hoalo.vn, Fanpage chính thức Di tích Nhà tù Hỏa Lò hoặc gọi Hotline 024.39342253; đi sớm tầm 8:00–9:00 sáng Chủ nhật cũng sẽ rất thoáng mát và đỡ chờ đợi ạ.',
          authorityBoundary: 'Quầy vé Cổng số 1, Website https://hoalo.vn và Hotline 024.39342253.',
          actionableGuidance: 'Mua trực tiếp tại Cổng số 1 hoặc kiểm tra kênh đặt trước trên https://hoalo.vn.',
          requiresHuman: false,
          style: 'CUSTOMER_CARE'
        };
      }

      const isEarlyMorningArrival = /7h45|7 gio 45|vao san ngoi doi|8h00 cua moi mo/i.test(normQuery);
      if (isEarlyMorningArrival) {
        return {
          scenarioId: 'TICKET_EARLY_ARRIVAL',
          response: isEn
            ? 'Hoa Lo Prison Relic officially opens its ticket counter and gates at 8:00 AM daily (until 5:00 PM). Arriving around 7:45 AM, you can wait comfortably outside Gate No. 1 shaded entrance area—ticket sales and entry open right at 8:00 AM sharp.'
            : 'Dạ Di tích Nhà tù Hỏa Lò chính thức mở cửa bán vé và đón khách vào tham quan đúng 8:00 sáng hàng ngày (đến 17:00, không nghỉ trưa). Lúc 7h45 sáng, bạn có thể đứng chờ thoáng mát ngay khu vực trước Cổng chính số 1 phố Hỏa Lò; đúng 8:00 quầy vé và cửa soát vé sẽ mở đón lượt khách đầu tiên ngay ạ.',
          authorityBoundary: 'Giờ mở cửa chính thức 8:00–17:00 hàng ngày.',
          actionableGuidance: 'Chờ tại khu vực Cổng số 1, quầy vé mở đón khách lúc 8:00 sáng.',
          requiresHuman: false,
          style: 'QUICK_ANSWER'
        };
      }

      const isComboTicket = /ve combo|gop chung/i.test(normQuery);
      if (isComboTicket) {
        return {
          scenarioId: 'TICKET_COMBO_INFO',
          response: isEn
            ? 'Currently, daytime admission to Hoa Lo Prison Relic (50,000 VND/adult, 25,000 VND for students/seniors) is issued independently at Gate No. 1 rather than via a fixed combined ticket with the Vietnamese Women’s Museum or Temple of Literature. Please check https://hoalo.vn or Hotline 024.39342253 for any seasonal heritage pass promotions.'
            : 'Dạ hiện tại Di tích Nhà tù Hỏa Lò áp dụng vé tham quan riêng biệt mua trực tiếp tại Cổng số 1 (50.000 VNĐ/người lớn, 25.000 VNĐ cho HSSV và người cao tuổi), chưa có loại vé combo cố định gộp chung với Bảo tàng Phụ nữ hay Văn Miếu trong danh mục niêm yết thường xuyên. Tuy nhiên cả hai điểm này đều nằm rất gần Hỏa Lò nên bạn rất tiện kết hợp đi trong cùng một buổi; nếu có chương trình liên kết theo dịp lễ, Ban Quản lý sẽ thông báo trên https://hoalo.vn hoặc Hotline 024.39342253 ạ.',
          authorityBoundary: 'Biểu phí vé tham quan niêm yết riêng tại Di tích Hỏa Lò.',
          actionableGuidance: 'Mua vé riêng tại Quầy vé Cổng số 1 (50.000 VNĐ/người lớn).',
          requiresHuman: false,
          style: 'CUSTOMER_CARE'
        };
      }

      const isFreeMapLeaflet = /to roi|so do tham quan/i.test(normQuery);
      if (isFreeMapLeaflet) {
        return {
          scenarioId: 'TICKET_MAP_LEAFLET',
          response: isEn
            ? 'When purchasing your ticket at Gate No. 1, you can ask our reception desk for any available printed Vietnamese/English route brochures, and the entire site also features clear directional floor arrows, numbered gallery signs, and the 35-stop Audioguide (50,000 VND) so you will never miss a section.'
            : 'Dạ khi mua vé tại Cổng chính số 1, bạn có thể hỏi trực tiếp nhân viên quầy vé/quầy thông tin về tờ rơi sơ đồ hướng dẫn hiện có sẵn; đồng thời dọc toàn bộ tuyến tham quan đều có hệ thống biển sơ đồ lớn, mũi tên chỉ đường một chiều và đánh số các gian trưng bày rất rõ ràng (hoặc bạn có thể thuê máy Audioguide 50.000 VNĐ theo đúng thứ tự 35 điểm dừng để đi trọn vẹn không bỏ sót khu nào nhé).',
          authorityBoundary: 'Quầy vé / Quầy thông tin Cổng chính số 1 và hệ thống biển chỉ dẫn nội khu.',
          actionableGuidance: 'Hỏi tờ rơi sơ đồ tại Quầy thông tin Cổng số 1 và đi theo mũi tên chỉ dẫn.',
          requiresHuman: false,
          style: 'QUICK_ANSWER'
        };
      }

      const isInfantStrollerTicket = /thang tuoi|xe day|18 thang/i.test(normQuery) && /mien ve|mien phi|ve/i.test(normQuery);
      if (isInfantStrollerTicket) {
        return {
          scenarioId: 'TICKET_INFANT_STROLLER',
          response: isEn
            ? 'Yes! Children under 15 years old (including 18-month-old toddlers in strollers) receive 100% free admission when accompanied by an adult. Main corridors also have sloped ramps for strollers, and our guards are happy to help with older stone steps.'
            : 'Dạ hoàn toàn đúng bạn nhé! Trẻ em dưới 15 tuổi (bao gồm cả bé 18 tháng tuổi nằm xe đẩy đi cùng bố mẹ) được miễn phí vé tham quan 100%. Di tích có lối dốc thoải ở các hành lang chính để đẩy xe thuận tiện và bảo vệ luôn sẵn lòng hỗ trợ qua một vài bậc tam cấp cổ, phụ huynh chỉ cần lưu ý che chắn nhẹ cho bé khi đi qua các phòng giam tối nhé.',
          authorityBoundary: 'Chính sách miễn phí vé cho trẻ dưới 15 tuổi.',
          actionableGuidance: 'Bé dưới 15 tuổi miễn vé hoàn toàn; sử dụng lối dốc thoải cho xe đẩy.',
          requiresHuman: false,
          style: 'CUSTOMER_CARE'
        };
      }

      const isTicketEdgeRefundOrBuyAhead = /mua nham|huy tra|doi gio|ve dien tu|mua san ve|bao tru tien|chua thay.*xuat ve|khong qua duoc|hoan ve|doi ngay/i.test(normQuery);
      if (isTicketEdgeRefundOrBuyAhead) {
        return {
          scenarioId: 'TICKET_EXCHANGE_OR_PAYMENT_SUPPORT',
          response: isEn
            ? 'Daytime tickets are normally valid on the day of issue and non-refundable once printed. If you accidentally bought the wrong quantity, need to hand a pre-bought ticket to a companion arriving shortly, wish to check e-ticket rescheduling, or saw your payment deducted without receiving a ticket, please show your transfer receipt/booking confirmation directly to the Cashier Supervisor at Ticket Counter Gate No. 1 for prompt verification.'
            : 'Dạ vé tham quan ban ngày thông thường có giá trị trong ngày và không tự động hoàn hủy sau khi xuất vé. Nếu bạn mua nhầm số lượng, cần mua sẵn vé cho người thân đến sau ít phút, muốn hỏi đổi khung giờ vé điện tử hay gặp lỗi app đã trừ tiền nhưng chưa nhận được vé, bạn hãy mang ngay biên lai chuyển khoản hoặc mã xác nhận tới Quầy vé Cổng chính số 1 để Trưởng quầy vé kiểm tra đối chiếu và hỗ trợ kịp thời nhé.',
          authorityBoundary: 'Trưởng quầy vé Cổng chính số 1 trực tiếp kiểm tra giao dịch và hỗ trợ.',
          actionableGuidance: 'Đưa biên lai/mã đặt vé cho Trưởng quầy vé tại Cổng chính số 1.',
          requiresHuman: true,
          style: 'CUSTOMER_CARE'
        };
      }

      const isSpecialExemption = /khuyet tat|huong dan vien|the nha bao|nha bao|cuu tu|cuu chien binh|thuong binh|nguoi co cong|can cuoc|vneid|anh chup the|quen vi o nha|quen the|giam o day|bo phan don tiep|ong ngoai/i.test(normQuery);
      if (isSpecialExemption) {
        return {
          scenarioId: 'TICKET_SPECIAL_EXEMPTION',
          response: isEn
            ? 'Under current policy, free entry applies to children under 15 and revolutionary contributors, while a 50% discount (25,000 VND) applies to students with valid ID, seniors 60+, and severely disabled visitors. For licensed tour guides, press cards, companions of disabled guests, ex-prisoner relatives wishing to inform our reception desk, or presenting a digital ID (VNeID/school app), please contact Hotline 024.39342253 or show your documents at Ticket Counter Gate No. 1 for thoughtful staff verification.'
            : 'Dạ theo quy định hiện hành, Di tích Hỏa Lò miễn phí vé cho trẻ em dưới 15 tuổi và người có công với cách mạng; giảm 50% (còn 25.000 VNĐ) cho học sinh, sinh viên có thẻ hợp lệ, người cao tuổi từ 60 tuổi và người khuyết tật nặng. Với trường hợp gia đình thân nhân cựu tù chính trị từng bị giam tại Hỏa Lò muốn liên hệ bộ phận đón tiếp hỗ trợ chu đáo, thẻ hướng dẫn viên du lịch quốc tế/nội địa dẫn khách, thẻ nhà báo, người đi cùng người khuyết tật hoặc quên thẻ cứng dùng VNeID, bạn vui lòng liên hệ trước qua Hotline 024.39342253 hoặc xuất trình giấy tờ trực tiếp tại Quầy vé Cổng số 1 để nhân viên đón tiếp kiểm tra và áp dụng đúng chế độ ưu đãi nhé.',
          authorityBoundary: 'Nhân viên Quầy vé & Bộ phận đón tiếp Cổng số 1 kiểm tra giấy tờ miễn giảm và tiếp đón thân nhân.',
          actionableGuidance: 'Liên hệ Hotline 024.39342253 hoặc xuất trình giấy tờ tại Quầy vé Cổng số 1.',
          requiresHuman: false,
          style: 'CUSTOMER_CARE'
        };
      }

      if (normQuery.includes('sinh vien') || normQuery.includes('hoc sinh') || normQuery.includes('hssv') || normQuery.includes('giam gia')) {
        return {
          scenarioId: 'TICKET_DISCOUNT_STUDENT',
          response: isEn
            ? 'Pupils and students with a valid student ID enjoy a 50% discount on daytime admission, priced at 25,000 VND/ticket. Please present your student card directly at the ticket booth at Gate No. 1.'
            : 'Học sinh, sinh viên xuất trình thẻ HSSV hợp lệ được giảm 50% giá vé tham quan ban ngày, chỉ còn 25.000 VNĐ/vé. Bạn vui lòng xuất trình thẻ tại quầy vé cổng chính số 1 Hỏa Lò khi mua vé nhé.',
          authorityBoundary: 'Kiểm tra thẻ HSSV tại quầy vé cổng chính.',
          actionableGuidance: 'Xuất trình thẻ HSSV tại Quầy vé cổng chính để nhận ưu đãi 25.000 VNĐ/vé.',
          requiresHuman: false,
          style: 'QUICK_ANSWER'
        };
      }

      if (normQuery.includes('tour dem') || normQuery.includes('dem thieng lieng')) {
        const pol = this.getPolicy('POLICY_TICKET_NIGHT_TOUR');
        return {
          scenarioId: 'TICKET_NIGHT_TOUR',
          response: isEn
            ? 'Tickets for the Sacred Night Tour range from 399,000 to 499,000 VND depending on the theme. Due to limited seats, advance booking via the official Hoa Lo Prison fanpage or hotline is required.'
            : 'Vé tour đêm "Đêm thiêng liêng" có giá từ 399.000 đến 499.000 VNĐ tùy chủ đề. Do số lượng chỗ mỗi suất có hạn, vé tour đêm bắt buộc phải đặt trước qua fanpage hoặc hotline chính thức của di tích.',
          authorityBoundary: pol?.authority_boundary || 'Đặt trước qua Fanpage/Hotline chính thức.',
          actionableGuidance: 'Đặt chỗ trước qua Fanpage Di tích Nhà tù Hỏa Lò hoặc hotline.',
          requiresHuman: false,
          style: 'QUICK_ANSWER'
        };
      }

      const pol = this.getPolicy('POLICY_TICKET_DAYTIME');
      const isOtherForeign = ['fr', 'ja', 'ko', 'zh'].includes(language);
      return {
        scenarioId: 'TICKET_GENERAL_DAYTIME',
        response: isOtherForeign
          ? getDocentReply('SERVICE_TICKET_DAYTIME', language)
          : (isEn
            ? 'Daytime ticket to Hoa Lo Prison is 50,000 VND for adults. A 50% discount (25,000 VND) applies to students with valid student ID, seniors aged 60+ with ID, and severely disabled visitors. Free entry is granted to children under 15 and revolutionary contributors. Audio guides are available for rent at the ticket booth for around 50,000 VND. For the Sacred Night Tour (399,000 - 499,000 VND), advance booking via the official page is required.'
            : 'Giá vé tham quan ban ngày tại Di tích Hỏa Lò là 50.000 VNĐ/người lớn. Học sinh, sinh viên (xuất trình thẻ HSSV), người cao tuổi từ 60 tuổi trở lên và người khuyết tật nặng được giảm 50% còn 25.000 VNĐ. Miễn phí vé cho trẻ em dưới 15 tuổi và người có công với cách mạng. Bạn có thể thuê tai nghe thuyết minh Audioguide tại quầy vé với phí 50.000 VNĐ/máy. Riêng tour đêm "Đêm thiêng liêng" có giá từ 399.000 - 499.000 VNĐ và cần đặt trước qua fanpage chính thức.'),
        authorityBoundary: pol?.authority_boundary || 'Niêm yết tại quầy vé cổng chính số 1 Hỏa Lò.',
        actionableGuidance: 'Mua vé trực tiếp tại Quầy vé cổng chính số 1 Hỏa Lò.',
        requiresHuman: false,
        style: 'CUSTOMER_CARE'
      };
    }

    // 5. KỊCH BẢN GIỜ HOẠT ĐỘNG (OPENING_HOURS)
    if (intent === 'OPENING_HOURS') {
      const pol = this.getPolicy('POLICY_HOURS_DAYTIME');
      const isOtherForeign = ['fr', 'ja', 'ko', 'zh'].includes(language);
      return {
        scenarioId: 'HOURS_GENERAL',
        response: isOtherForeign
          ? getDocentReply('SERVICE_OPENING_HOURS', language)
          : (isEn
            ? 'Hoa Lo Prison Relic is open daily from 8:00 AM to 5:00 PM without lunch break, including weekends, public holidays, and Tet. The Sacred Night Tour takes place on Friday, Saturday, and Sunday evenings starting at 7:00 PM (booking in advance is mandatory).'
            : 'Di tích Lịch sử Nhà tù Hỏa Lò mở cửa từ 8:00 đến 17:00 tất cả các ngày trong tuần (từ Thứ Hai đến Chủ Nhật, kể cả ngày Lễ và Tết), mở cửa liên tục không nghỉ trưa. Các chương trình tour đêm "Đêm thiêng liêng" đón khách từ 19:00 các tối thứ Sáu, thứ Bảy và Chủ Nhật (cần đặt trước).'),
        authorityBoundary: pol?.authority_boundary || 'Cố định 8:00 - 17:00 tất cả các ngày.',
        actionableGuidance: 'Tham quan ban ngày từ 8:00 đến 17:00 không nghỉ trưa.',
        requiresHuman: false,
        style: 'QUICK_ANSWER'
      };
    }

    // 6. KỊCH BẢN TIỆN ÍCH & CƠ SỞ VẬT CHẤT (FACILITY_INFORMATION / FACILITY_SUPPORT)
    if (intent === 'FACILITY_INFORMATION' || intent === 'FACILITY_SUPPORT') {
      const isOtherForeign = ['fr', 'ja', 'ko', 'zh'].includes(language);
      if (isOtherForeign && !/luu niem|mua qua|qua tang|chup anh|quay phim/i.test(normQuery)) {
        return {
          scenarioId: 'FACILITY_MULTILINGUAL',
          response: getDocentReply('SERVICE_RESTROOM_LOCKER', language),
          authorityBoundary: 'Biển chỉ dẫn tại sân trại và lối ra.',
          actionableGuidance: 'Đi theo biển chỉ dẫn tại sân trại giam hoặc gần lối ra.',
          requiresHuman: false,
          style: 'QUICK_ANSWER'
        };
      }
      const isRestroom = /ve sinh|toilet|wc|nha ve sinh/i.test(normQuery);
      const isStorage = subIntent === 'STORAGE_BAG_SIZE' || (subIntent !== 'SOUVENIR_SHOP' && /\b(gui do|de do|ba lo|balo|hanh ly|gui balo|cho gui do|tu gui do|mu bao hiem|cap laptop|laptop|ao mua|o dai|o gap|binh giu nhiet|binh nuoc|tui deo cheo|cat tu|ong kinh)\b/i.test(normQuery));
      const isMinorFirstAid = /xuoc.*ngon tay|bong bang|urgo|bang ca nhan|con sat khuan|quay y te/i.test(normQuery);
      const isSouvenir = subIntent === 'SOUVENIR_SHOP' || /luu niem|mua qua|qua tang|quay luu niem|cua hang luu niem|quay sach|ao phong|coc su|tui tote|ban dao|nam cham|buu thiep|tinh dau|linh vat|tra la bang|hop tra|banh thach la bang|banh com la bang/i.test(normQuery);
      const isPhoto = /chup anh|quay phim|gopro|osmo|youtube|tao dang|tuong|cham tay|tua lung/i.test(normQuery);

      if (isMinorFirstAid) {
        return {
          scenarioId: 'FACILITY_MINOR_FIRST_AID',
          response: isEn
            ? 'Yes, the Reception and First Aid Station at Gate No. 1 keeps a basic first-aid kit with band-aids and antiseptic. Please approach the nearest staff member or Gate No. 1 reception for immediate help cleaning and dressing your scratch.'
            : 'Dạ có bạn nhé! Phòng trực và Trạm sơ cứu tại Cổng chính số 1 Hỏa Lò có sẵn tủ thuốc sơ cứu cơ bản (băng cá nhân urgo, bông gạc, cồn sát khuẩn). Bạn hãy báo nhân viên gần nhất hoặc ghé ngay quầy lễ tân Cổng số 1 để được hỗ trợ sát khuẩn và băng vết xước kịp thời nhé.',
          authorityBoundary: 'Tủ sơ cứu cơ bản tại Phòng trực Cổng số 1.',
          actionableGuidance: 'Ghé quầy thông tin / phòng trực Cổng số 1 để lấy bông băng sát khuẩn.',
          requiresHuman: true,
          style: 'EMPATHETIC_SUPPORT'
        };
      }

      if (isRestroom) {
        const isNearGuillotine = /máy chém|may chem/i.test(normQuery);
        const isNearBanyan = /cay bang|cây bàng|san trai|sân trại/i.test(normQuery) || userProfile?.currentSubject === 'cay_bang' || (userProfile?.contextZone && userProfile.contextZone.toLowerCase().includes('bàng'));
        return {
          scenarioId: 'FACILITY_WC',
          response: isEn
            ? (isNearGuillotine
              ? 'Restrooms are not located next to the guillotine. They are situated in the prison courtyard and near the souvenir shop close to the exit, clearly marked with signs.'
              : (isNearBanyan
                ? 'Restrooms are conveniently located right in the prison courtyard near the Ancient Banyan Tree and near the souvenir area close to the exit, clearly marked with signs.'
                : 'Restrooms are located in the prison courtyard and near the souvenir area close to the exit, clearly marked with directional signs.'))
            : (isNearGuillotine
              ? 'Khu vệ sinh (WC) của di tích không nằm ở cạnh cỗ máy chém bạn nhé. Nhà vệ sinh được bố trí tại khu vực sân trại giam và gần quầy lưu niệm ở lối ra, có biển chỉ dẫn rõ ràng. Nếu cần hỗ trợ thêm, bạn có thể hỏi nhân viên bảo vệ gần đó để được hướng dẫn lối đi nhanh nhất ạ.'
              : (isNearBanyan
                ? 'Khu vệ sinh (WC) của di tích được bố trí ngay tại khu vực sân trại giam (cạnh sân cây bàng) và gần quầy lưu niệm ở lối ra, có biển chỉ dẫn rõ ràng và sạch sẽ. Bạn đang ở sân cây bàng thì nhà vệ sinh ở ngay góc sân này rất gần và thuận tiện đi lại ạ.'
                : 'Khu vệ sinh (WC) của di tích được bố trí tại khu vực sân trại giam và gần quầy lưu niệm ở lối ra, có biển chỉ dẫn rõ ràng và sạch sẽ.')),
          authorityBoundary: 'Biển chỉ dẫn tại sân trại và lối ra.',
          actionableGuidance: 'Đi theo biển chỉ dẫn tại sân trại giam hoặc gần lối ra.',
          requiresHuman: false,
          style: 'QUICK_ANSWER'
        };
      }

      if (isStorage) {
        const isCompactCameraBag = /tui deo cheo|ong kinh|a4/i.test(normQuery);
        return {
          scenarioId: 'FACILITY_STORAGE',
          response: isEn
            ? (isCompactCameraBag
              ? 'Compact personal cross-body camera bags (around A4 size) may generally be carried inside the galleries—please wear the bag neatly in front of you in narrow cells so it does not bump glass cases or walls. If you prefer hands-free comfort, free lockers are available beside Gate No. 1 (keep high-value lenses and electronics secure with you).'
              : 'Plain personal water bottles and compact folding umbrellas may be carried carefully inside. For bulky or wet belongings such as backpacks, motorbike helmets, long umbrellas, wet raincoats, or heavy bags, free personal lockers are available right beside Gate No. 1 entrance (please keep high-value laptops, wallets, and phones with you or check with Gate No. 1 staff for guidance).')
            : (isCompactCameraBag
              ? 'Dạ với túi đeo chéo nhỏ gọn cỡ tờ giấy A4 đựng ống kính máy ảnh có giá trị cao, thông thường bạn có thể đeo gọn phía trước người khi vào tham quan các buồng giam (lưu ý cẩn thận tránh va chạm vào tủ kính hay tường hiện vật ở lối hẹp). Nếu mang túi nặng hoặc cồng kềnh hơn, Di tích có tủ khóa gửi đồ miễn phí ngay Cổng số 1 — tuy nhiên tài sản đắt tiền như máy ảnh, ống kính bạn vẫn nên giữ sát bên mình theo hướng dẫn của bảo vệ cửa soát vé cho yên tâm nhất ạ.'
              : 'Dạ bạn yên tâm nhé! Với bình nước lọc cá nhân và ô gấp nhỏ gọn, bạn có thể cầm theo cẩn thận khi tham quan. Còn các vật dụng cồng kềnh hoặc ướt như ba lô, mũ bảo hiểm, ô dài, áo mưa ướt hay túi nặng, Di tích Hỏa Lò có tủ khóa gửi đồ miễn phí và khu vực hỗ trợ ngay gần lối vào Cổng chính số 1 (riêng tài sản giá trị cao như laptop, ví tiền, điện thoại bạn nên giữ bên mình hoặc trao đổi trực tiếp nhân viên quầy Cổng số 1 để yên tâm nhất ạ).'),
          authorityBoundary: 'Tủ khóa gửi đồ miễn phí cạnh lối soát vé Cổng số 1.',
          actionableGuidance: 'Gửi đồ cồng kềnh tại tủ khóa miễn phí Cổng số 1; giữ đồ giá trị cao bên mình.',
          requiresHuman: false,
          style: 'QUICK_ANSWER'
        };
      }

      if (isSouvenir) {
        const isStreetVendorOrOfficial = /ban dao|via he|chinh hang|chinh chu|giong het|ban hang online|kenh ban hang|doanh thu|quy bao ton|thue mat bang/i.test(normQuery);
        const isSouvenirAccessOrHours = /mua lai ve|ve vao cong|dong cua som|truoc 17h|kiem ke/i.test(normQuery);
        const isSouvenirPayment = /visa|mastercard|the tin dung|chuyen khoan|tien mat/i.test(normQuery);
        const isBanyanTeaRetail = /tra la bang|tra bang|la bang|hop tra|banh thach la bang|banh com la bang|thach bang/i.test(normQuery);
        const isBooksOrMerchSpec = /quay sach|sach lich su|tieng anh|tieng phap|ao phong|du size|xxl|10 hop|hoi nghi|hoa don|sach tranh|to mau|the kien thuc|an pham giao duc/i.test(normQuery);

        if (isSouvenirAccessOrHours) {
          return {
            scenarioId: 'FACILITY_SOUVENIR_ACCESS_HOURS',
            response: isEn
              ? 'The official souvenir shop is located inside the relic near the end of the tour route and operates along the relic’s daily schedule (8:00 AM – 5:00 PM). If you only wish to stop by the souvenir counter without re-touring, please ask the reception staff at Gate No. 1 directly for current entry guidance; arriving before 4:30 PM ensures comfortable browsing before the 5:00 PM closing.'
              : 'Dạ Cửa hàng lưu niệm chính thức nằm bên trong khuôn viên gần cuối tuyến tham quan và hoạt động đồng bộ theo khung giờ mở cửa của Di tích (8:00–17:00 hàng ngày). Nếu bạn chỉ muốn ghé mua quà lưu niệm hoặc trà lá bàng mà không đi lại toàn tuyến, bạn vui lòng trao đổi trực tiếp với nhân viên đón tiếp tại Cổng chính số 1 để được hướng dẫn thuận tiện nhất; và bạn nên ghé quầy lưu niệm trước khoảng 16:30–16:45 để thoải mái lựa chọn trước giờ đóng cửa 17:00 nhé.',
            authorityBoundary: 'Cửa hàng lưu niệm chính thức khu vực lối ra (8:00–17:00).',
            actionableGuidance: 'Trao đổi tại Cổng số 1 và ghé Quầy lưu niệm gần lối ra trước 17:00.',
            requiresHuman: false,
            style: 'CUSTOMER_CARE'
          };
        }

        if (isSouvenirPayment) {
          return {
            scenarioId: 'FACILITY_SOUVENIR_PAYMENT',
            response: isEn
              ? 'At the official souvenir shop near the exit, you can pay in Vietnamese Dong cash and popular cashless methods such as bank transfer/QR; for international Visa/Mastercard card terminal availability at the counter that day, please confirm directly with the souvenir shop cashier.'
              : 'Dạ tại Quầy hàng lưu niệm chính thức gần lối ra Di tích Hỏa Lò, bạn có thể thanh toán bằng tiền mặt VNĐ cũng như chuyển khoản/quét mã QR rất thuận tiện. Riêng việc máy POS quẹt thẻ tín dụng quốc tế Visa/Mastercard hoạt động tại thời điểm mua, bạn hỏi nhanh bạn thu ngân ngay tại quầy lưu niệm để được hỗ trợ chính xác nhất nhé.',
            authorityBoundary: 'Quầy thu ngân Cửa hàng lưu niệm lối ra Di tích Hỏa Lò.',
            actionableGuidance: 'Thanh toán tiền mặt VNĐ hoặc hỏi phương thức quẹt thẻ/QR tại quầy lưu niệm.',
            requiresHuman: false,
            style: 'QUICK_ANSWER'
          };
        }

        if (isStreetVendorOrOfficial) {
          return {
            scenarioId: 'FACILITY_SOUVENIR_OFFICIAL',
            response: isEn
              ? 'Official cultural souvenirs of Hoa Lo Prison Relic (tote bags, books, badges, banyan tea gifts) are distributed exclusively through the official Souvenir Shop inside the relic near the exit and official channels verified via https://hoalo.vn, our blue-tick Fanpage, or Hotline 024.39342253—supporting heritage preservation activities rather than outside street vendors or unofficial look-alike shops.'
              : 'Dạ các ấn phẩm văn hóa và quà lưu niệm chính thức của Di tích Nhà tù Hỏa Lò (túi tote, áo phông, huy hiệu, sách lịch sử, trà lá bàng...) chỉ được phát hành trực tiếp tại Cửa hàng lưu niệm bên trong khuôn viên gần lối ra và các kênh truyền thông chính chủ được xác nhận trên Website https://hoalo.vn, Fanpage chính thức Di tích Nhà tù Hỏa Lò hoặc Hotline 024.39342253. Các hàng bán dạo ngoài vỉa hè hay trang mạng giả mạo không thuộc hệ thống của Ban Quản lý Di tích; để đặt mua từ xa hoặc xác minh trang chính chủ, bạn hãy nhắn trực tiếp Fanpage chính thức hoặc gọi 024.39342253 nhé.',
            authorityBoundary: 'Cửa hàng lưu niệm chính thức & kênh xác thực https://hoalo.vn / 024.39342253.',
            actionableGuidance: 'Mua trực tiếp tại Cửa hàng lưu niệm lối ra hoặc xác minh qua https://hoalo.vn.',
            requiresHuman: false,
            style: 'CUSTOMER_CARE'
          };
        }

        if (isBanyanTeaRetail) {
          return {
            scenarioId: 'FACILITY_SOUVENIR_TEA',
            response: isEn
              ? 'Banyan-leaf tea (Trà lá bàng) is a signature cultural specialty inspired by the historic Banyan Tree at Hoa Lo Prison—crafted from clean partnered raw materials rather than stripping leaves from the preserved ancient tree in the courtyard! While guests enjoy complimentary banyan tea and jelly during the Sacred Night Tour, exact packaging details at the daytime souvenir shop (tea bags vs. loose leaf, expiry date, labeling for international flights, sugar-free/herbal ingredients, or precautions for pregnant women and young children) should be verified directly on the product label and with staff at the exit Souvenir Shop (or Hotline 024.39342253).'
              : 'Dạ Trà lá bàng là đặc sản văn hóa lấy cảm hứng tri ân từ Cây bàng lịch sử Hỏa Lò — nguyên liệu làm trà thương phẩm được tuyển chọn, chế biến từ nguồn trồng sạch liên kết theo quy chuẩn an toàn chứ tuyệt đối không hái trụi từ cây bàng cổ thụ đang được bảo tồn trong sân di tích bạn nhé! Trong chương trình Tour Đêm có phục vụ thưởng thức trà bàng và thạch bàng; còn với trà đóng hộp bày bán tại Quầy lưu niệm ban ngày, các thông số cụ thể trên lô hàng hiện hành (dạng túi lọc hay lá khô, hạn bảo quản, tem nhãn xuất xứ cho hành lý bay quốc tế, thành phần mộc không đường/thảo mộc hay lưu ý cho phụ nữ mang thai, người kiêng đường và trẻ nhỏ, cũng như việc uống thử tại quầy) bạn vui lòng kiểm tra trực tiếp nhãn bao bì và hỏi nhân viên tại Quầy lưu niệm lối ra hoặc Hotline 024.39342253 để chính xác tuyệt đối ạ.',
            authorityBoundary: 'Nhân viên Quầy lưu niệm lối ra và nhãn bao bì sản phẩm chính thức.',
            actionableGuidance: 'Kiểm tra tem nhãn thành phần, HSD trực tiếp tại Quầy lưu niệm lối ra.',
            requiresHuman: false,
            style: 'CUSTOMER_CARE'
          };
        }

        if (isBooksOrMerchSpec) {
          return {
            scenarioId: 'FACILITY_SOUVENIR_BOOKS_MERCH',
            response: isEn
              ? 'The official Souvenir & Book Shop near the exit carries historical publications on Hoa Lo Prison (Maison Centrale) alongside T-shirts, tote bags, ceramic mugs, notebooks, and badges. For current stock of English/French editions, exact T-shirt sizes (S–XXL) and cotton fabric feel, or bulk conference gift sets with branded bags and retail invoices, please ask the Souvenir Shop staff directly or contact Hotline 024.39342253.'
              : 'Dạ tại Quầy sách và Cửa hàng lưu niệm chính thức gần lối ra Di tích Hỏa Lò có trưng bày nhiều đầu sách lịch sử, tư liệu về Maison Centrale cùng áo phông, túi tote, sổ tay, cốc sứ và huy hiệu mang dấu ấn Hỏa Lò. Để kiểm tra các tựa sách bản tiếng Anh/Pháp đang sẵn kệ, đủ size áo phông (từ S đến XXL) và chất liệu vải, hay đặt số lượng lớn làm quà tặng hội nghị kèm túi hộp và xuất hóa đơn theo quy định, bạn vui lòng trao đổi trực tiếp với nhân viên tại Quầy lưu niệm lối ra hoặc gọi Hotline 024.39342253 để được tư vấn và chuẩn bị chu đáo nhất nhé.',
            authorityBoundary: 'Quầy sách & Quầy lưu niệm chính thức khu vực lối ra (Hotline 024.39342253).',
            actionableGuidance: 'Hỏi trực tiếp nhân viên Quầy lưu niệm lối ra hoặc gọi 024.39342253.',
            requiresHuman: false,
            style: 'CUSTOMER_CARE'
          };
        }

        return {
          scenarioId: 'FACILITY_SOUVENIR',
          response: isEn
            ? 'The official cultural souvenir shop near the exit features tote bags, T-shirts, ceramic mugs, notebooks, badges, and historical books. For exact sizes, protective gift packaging, or current seasonal stock, please ask our staff directly at the exit counter.'
            : 'Quầy lưu niệm chính thức đặt gần lối ra giới thiệu nhiều ấn phẩm văn hóa đặc sắc như túi tote, áo phông, cốc sứ, sổ tay, huy hiệu và sách lịch sử. Về size áo cụ thể, hộp bọc chống sốc hay các mẫu theo mùa hiện có sẵn, bạn vui lòng hỏi trực tiếp nhân viên tại quầy lưu niệm lối ra để được tư vấn và đóng gói chu đáo nhé.',
          authorityBoundary: 'Quầy lưu niệm khu vực lối ra.',
          actionableGuidance: 'Ghé quầy lưu niệm tại lối ra để xem các ấn phẩm văn hóa Hỏa Lò.',
          requiresHuman: false,
          style: 'QUICK_ANSWER'
        };
      }

      if (isPhoto) {
        return {
          scenarioId: 'FACILITY_PHOTOGRAPHY',
          response: isEn
            ? 'Regular photo taking is allowed (please turn off camera flash in dark cells to protect relics and maintain solemnity). Commercial filming requires advance permission from the management board.'
            : 'Dạ du khách được phép chụp ảnh lưu niệm thông thường tại di tích bạn nhé. Bạn vui lòng tắt đèn flash tại các phòng giam để bảo quản hiện vật và giữ gìn không gian trang nghiêm; còn việc quay phim thương mại cần được Ban quản lý chấp thuận trước ạ.',
          authorityBoundary: 'Quy định bảo quản di tích.',
          actionableGuidance: 'Được chụp ảnh lưu niệm, vui lòng tắt đèn flash tại buồng giam.',
          requiresHuman: false,
          style: 'QUICK_ANSWER'
        };
      }

      return {
        scenarioId: 'FACILITY_GENERAL',
        response: isEn
          ? 'Hoa Lo Prison provides free luggage lockers, restrooms in the courtyard, audio guides at the ticket booth, and a souvenir shop near the exit.'
          : 'Di tích Hỏa Lò trang bị đầy đủ tủ gửi đồ miễn phí ở cổng, nhà vệ sinh tại sân trại, quầy cho thuê tai nghe Audioguide và quầy lưu niệm ở lối ra phục vụ du khách.',
        authorityBoundary: 'Tiện ích phục vụ khách tham quan.',
        actionableGuidance: 'Tham khảo biển sơ đồ tiện ích tại cổng vào.',
        requiresHuman: false,
        style: 'CUSTOMER_CARE'
      };
    }

    // 6.1. KỊCH BẢN THÔNG TIN LIÊN HỆ & ĐỊA CHỈ (CONTACT_INFORMATION)
    if (intent === 'CONTACT_INFORMATION') {
      return {
        scenarioId: 'CONTACT_INFO_OFFICIAL',
        response: isEn
          ? 'Hoa Lo Prison Relic is located at No. 1 Hoa Lo Street, Cua Nam Ward, Hoan Kiem District, Hanoi. Official Hotline: 024.39342253 / 024.39342317; Email: banquanlyditichhoalo@gmail.com; Website: https://hoalo.vn.'
          : 'Di tích Lịch sử Nhà tù Hỏa Lò tọa lạc tại số 1 phố Hỏa Lò, phường Cửa Nam, quận Hoàn Kiếm, thành phố Hà Nội. Số điện thoại liên hệ chính thức: 024.39342253 (Phòng Trưng bày - Tuyên truyền), 024.39342317 (Phòng Hành chính); Email: banquanlyditichhoalo@gmail.com; Website: https://hoalo.vn.',
        authorityBoundary: 'Thông tin liên hệ chính thức của Ban quản lý di tích.',
        actionableGuidance: 'Liên hệ qua hotline hoặc website chính thức https://hoalo.vn.',
        requiresHuman: false,
        style: 'QUICK_ANSWER'
      };
    }

    // 6.2. KỊCH BẢN HƯỚNG DẪN THUYẾT MINH TỰ ĐỘNG (AUDIO_GUIDE_SUPPORT)
    if (intent === 'AUDIO_GUIDE_SUPPORT') {
      const isOtherForeign = ['fr', 'ja', 'ko', 'zh'].includes(language);
      if (!isOtherForeign && (subIntent === 'AUDIO_GUIDE_DEPOSIT' || /can cuoc dat coc|tra may xong|quen lay lai/i.test(normQuery))) {
        return {
          scenarioId: 'AUDIO_GUIDE_DEPOSIT',
          response: isEn
            ? 'Do not worry! If a visitor returns the Audioguide handset and forgets to collect their deposited ID card, our Gate No. 1 counter staff seal and safeguard all unclaimed IDs at the end of the day. Simply call Hotline 024.39342253 or return to Ticket Counter Gate No. 1 to verify your identity and retrieve it.'
            : 'Dạ bạn yên tâm nhé! Nếu lỡ trả máy thuyết minh Audioguide xong mà quên lấy lại thẻ căn cước đặt cọc, nhân viên quầy Cổng số 1 sẽ kiểm đếm, niêm phong và lưu giữ cẩn thận giấy tờ của khách cuối ngày. Bạn chỉ cần gọi ngay Hotline 024.39342253 hoặc quay lại Quầy vé/Quầy Audioguide Cổng chính số 1 xác minh thông tin là sẽ được bàn giao lại đầy đủ ạ.',
          authorityBoundary: 'Quầy Audioguide Cổng số 1 & Hotline 024.39342253 lưu giữ giấy tờ đặt cọc.',
          actionableGuidance: 'Gọi Hotline 024.39342253 hoặc quay lại Quầy Audioguide Cổng số 1 nhận lại CCCD.',
          requiresHuman: true,
          style: 'CUSTOMER_CARE'
        };
      }
      if (!isOtherForeign && (subIntent === 'AUDIO_GUIDE_NUMBERING' || /con so gan|tuan tu|chieu mui ten|nhay coc/i.test(normQuery))) {
        return {
          scenarioId: 'AUDIO_GUIDE_NUMBERING',
          response: isEn
            ? 'Yes! The 35 Audioguide numbers posted on display cabinets and gallery entrances are arranged sequentially along the one-way floor directional arrows, so you can simply follow the route and press each number in order without missing a single story.'
            : 'Dạ đúng rồi bạn nhé! Hệ thống 35 câu chuyện trên thiết bị thuyết minh tự động Audioguide được đánh số rõ ràng trên từng khu vực, tủ hiện vật tương ứng theo chiều mũi tên tham quan một chiều dọc hành lang, giúp bạn bấm số nghe tuần tự từ đầu đến cuối rất trực quan mà không lo bị nhảy cóc hay sót điểm dừng nào ạ.',
          authorityBoundary: 'Hệ thống 35 điểm dừng Audioguide theo chiều mũi tên tham quan một chiều.',
          actionableGuidance: 'Di chuyển theo mũi tên một chiều và bấm số thứ tự gắn trên biển/tủ trưng bày.',
          requiresHuman: false,
          style: 'QUICK_ANSWER'
        };
      }
      return {
        scenarioId: 'AUDIO_GUIDE_SERVICE',
        response: isOtherForeign
          ? getDocentReply('SERVICE_AUDIOGUIDE', language)
          : (isEn
            ? 'Hoa Lo Prison provides an automated Audioguide handset (no app download required) with 35 historical stories for 50,000 VND per unit at Ticket Counter Gate No. 1. Each handset selects its own language independently—so mixed-language groups can walk together—headsets are cleaned between uses, and any defective unit is replaced free in 1–2 minutes.'
            : 'Di tích Hỏa Lò trang bị thiết bị thuyết minh tự động Audioguide gồm 35 câu chuyện lịch sử (không cần tải app điện thoại), thuê trực tiếp tại quầy vé Cổng số 1 với phí 50.000 VNĐ/máy. Mỗi máy cho phép chọn ngôn ngữ độc lập (Việt, Anh, Pháp, Nhật, Hàn...) nên nhóm đa quốc tịch hoàn toàn đi chung tuyến rất tiện; tai nghe được vệ sinh kiểm tra và đổi mới miễn phí trong 1–2 phút nếu có lỗi âm thanh nhé.'),
        authorityBoundary: 'Thuê thiết bị tại quầy vé cổng chính số 1 Hỏa Lò.',
        actionableGuidance: 'Thuê tai nghe Audioguide tại quầy vé cổng chính (50.000 VNĐ/máy).',
        requiresHuman: false,
        style: 'CUSTOMER_CARE'
      };
    }

    // 6.3. KỊCH BẢN TOUR ĐÊM & TRƯNG BÀY CHUYÊN ĐỀ (TOUR_INFORMATION)
    if (intent === 'TOUR_INFORMATION') {
      const isOtherForeign = ['fr', 'ja', 'ko', 'zh'].includes(language);
      if (!isOtherForeign && (subIntent === 'TOUR_EVENTS_EXHIBITIONS' || /trien lam chuyen de|giao luu|nhan chung|cuu tu/i.test(normQuery))) {
        return {
          scenarioId: 'TOUR_EVENTS_EXHIBITIONS',
          response: isEn
            ? 'In addition to the permanent galleries, Hoa Lo Prison Relic regularly hosts thematic exhibitions and special talks with historical witnesses and former political prisoners. Upcoming schedules and public registration announcements are posted officially on https://hoalo.vn, the official Hoa Lo Prison Fanpage, and via Hotline 024.39342253.'
            : 'Dạ bên cạnh tuyến trưng bày cố định, Di tích Nhà tù Hỏa Lò thường xuyên tổ chức các trưng bày chuyên đề mới và chương trình giao lưu, gặp gỡ nhân chứng lịch sử hoặc cựu tù chính trị. Để cập nhật sớm nhất lịch triển lãm tháng tới và cách đăng ký tham dự công khai, bạn hãy theo dõi trực tiếp Website https://hoalo.vn, Fanpage chính thức Di tích Nhà tù Hỏa Lò hoặc liên hệ Hotline 024.39342253 nhé.',
          authorityBoundary: 'Lịch trưng bày chuyên đề & giao lưu nhân chứng đăng tải trên https://hoalo.vn và Fanpage chính thức.',
          actionableGuidance: 'Theo dõi lịch sự kiện trên https://hoalo.vn, Fanpage Hỏa Lò hoặc Hotline 024.39342253.',
          requiresHuman: false,
          style: 'TOUR_GUIDANCE'
        };
      }
      const isNightLogistics = /thue tron goi|rieng|doi ten|nhuong lai|om dot xuat|toi tre|19h15|khoi|phao dien|phao sang|den chop|nhay sang|dong kinh|cho ngoi|ghe ngoi|chong muoi|ao khoac mong|hoat canh/i.test(normQuery);
      if (isNightLogistics && !isOtherForeign) {
        return {
          scenarioId: 'TOUR_NIGHT_LOGISTICS',
          response: isEn
            ? 'The Sacred Night Tour starts at 7:00 PM on Fri–Sun (approx. 90 minutes, combining guided walking through galleries with live theatrical scenes, sound, and lighting effects, plus seated/resting stops in the courtyard and banyan tea appreciation). Comfortable neat attire, a light jacket on cool evenings, and optional mosquito spray are helpful for the outdoor banyan courtyard. For private corporate charters, ticket name transfers due to illness, late arrival, or sensitivity to stage lights/sound (for children, seniors, or photosensitive guests), please contact the official Fanpage or Hotline 024.39342253 directly so our organizers can advise and assist.'
            : 'Dạ Tour đêm "Đêm thiêng liêng" khởi hành từ 19:00 các tối Thứ Sáu, Thứ Bảy và Chủ Nhật (khoảng 90 phút, kết hợp di chuyển qua các phòng giam cùng những phân đoạn hoạt cảnh âm thanh, ánh sáng sâu lắng và chặng dừng ngồi nghỉ thưởng trà bàng tại sân cây bàng). Khi tham gia buổi tối ngoài sân cây bàng, bạn nên mặc trang phục lịch sự gọn gàng, có thể mang áo khoác mỏng nếu trời se lạnh hoặc chuẩn bị nhẹ xịt chống muỗi nếu da nhạy cảm. Với nhu cầu đặt suất riêng cho công ty, đổi tên/nhượng vé khi ốm đột xuất, tới trễ giờ, bố trí ghế ngồi hay lưu ý hiệu ứng ánh sáng/khói/âm thanh cho trẻ nhỏ, người cao tuổi và khách nhạy sáng, bạn vui lòng liên hệ trực tiếp Fanpage chính thức hoặc Hotline 024.39342253 để Ban tổ chức tư vấn và sắp xếp chu đáo nhất nhé.',
          authorityBoundary: 'Liên hệ Fanpage chính thức hoặc Hotline 024.39342253.',
          actionableGuidance: 'Liên hệ Hotline 024.39342253 / Fanpage Hỏa Lò để xác nhận suất tour đêm.',
          requiresHuman: true,
          style: 'TOUR_GUIDANCE'
        };
      }
      return {
        scenarioId: 'TOUR_NIGHT_AND_THEMATIC',
        response: isOtherForeign
          ? getDocentReply('SERVICE_NIGHT_TOUR', language)
          : (isEn
            ? 'The Sacred Night Tour takes place on Friday, Saturday, and Sunday evenings starting at 7:00 PM (90-minute duration) with 3 themes: "Sacred Night 1 - Shining Vietnamese Spirit", "Sacred Night 2 - Living Like Flowers", and "Sacred Night 3 - Youthful Fire". Ticket prices range from 399,000 to 499,000 VND and advance booking via our official fanpage/hotline is mandatory due to limited capacity.'
            : 'Tour đêm "Đêm thiêng liêng" diễn ra vào các tối thứ Sáu, thứ Bảy và Chủ Nhật (bắt đầu đón khách từ 19:00, thời lượng khoảng 90 phút) gồm 3 chủ đề: "Đêm thiêng liêng 1 - Sáng ngời tinh thần Việt", "Đêm thiêng liêng 2 - Sống như những đóa hoa", và "Đêm thiêng liêng 3 - Lửa thanh xuân". Giá vé từ 399.000 - 499.000 VNĐ và bắt buộc phải đặt trước qua hotline hoặc fanpage chính thức của di tích vì số lượng khách mỗi tour có giới hạn.'),
        authorityBoundary: 'Chương trình tour đêm trải nghiệm cuối tuần (cần đặt chỗ trước).',
        actionableGuidance: 'Đặt vé tour đêm trước qua hotline hoặc fanpage chính thức.',
        requiresHuman: false,
        style: 'TOUR_GUIDANCE'
      };
    }

    // 6.5. KỊCH BẢN ĐỊNH VỊ VỊ TRÍ & GIỚI THIỆU ĐIỂM DỪNG (LOCATION_ORIENTATION)
    if (subIntent === 'LOCATION_ORIENTATION' || /day la dau|toi dang dung dau|toi dang o dau|cho nay la gi|o day co gi|toi dang lam gi|minh dang o dau|minh dang lam gi/i.test(normQuery)) {
      const isCayBang = /cay bang|san trai|san giam/i.test(normQuery) || userProfile?.currentSubject === 'cay_bang' || (userProfile?.contextZone && userProfile.contextZone.toLowerCase().includes('bàng'));
      const isTrongDong = /trong dong/i.test(normQuery) || userProfile?.currentSubject === 'trong_dong' || (userProfile?.contextZone && userProfile.contextZone.toLowerCase().includes('trống đồng'));
      const isMayChem = /may chem|guillotine/i.test(normQuery) || userProfile?.currentSubject === 'may_chem' || (userProfile?.contextZone && userProfile.contextZone.toLowerCase().includes('máy chém'));
      const isWhatAmIDoing = /toi dang lam gi|minh dang lam gi/i.test(normQuery);

      if (isWhatAmIDoing) {
        return {
          scenarioId: 'ORIENTATION_WHAT_AM_I_DOING',
          response: isEn
            ? 'You are visiting Hoa Lo Prison Relic, currently at the Ancient Banyan Tree area in the prison courtyard. Feel free to explore the surrounding exhibits or ask me any questions about the history, prisoner stories, or tour facilities!'
            : 'Bạn đang tham quan Di tích Lịch sử Nhà tù Hỏa Lò tại khu vực sân trại giam. Bạn có thể quan sát hiện vật, gốc bàng lịch sử và các phòng giam xung quanh, hoặc hỏi mình bất cứ thông tin nào về lịch sử hay tiện ích tham quan nhé!',
          authorityBoundary: 'Hướng dẫn viên ảo hỗ trợ định hướng tham quan.',
          actionableGuidance: 'Tiếp tục tham quan các điểm trưng bày theo lộ trình.',
          requiresHuman: false,
          style: 'TOUR_GUIDANCE'
        };
      }

      if (isCayBang) {
        return {
          scenarioId: 'ORIENTATION_BANYAN_TREE',
          response: isEn
            ? 'You are standing before the historic Ancient Banyan Tree in the prison courtyard of Hoa Lo Prison. This sacred witness was deeply attached to the lives of revolutionary fighters: leaves and bark were used as medicines for dysentery, branches were carved into penholders, and banyan seeds provided precious nutrition during harsh imprisonment.'
            : 'Trước mắt bạn là Cây bàng cổ thụ lịch sử tại sân Trại giam Nhà tù Hỏa Lò. Cây bàng này đã gắn bó máu thịt với biết bao thế hệ chiến sĩ cách mạng kiên trung; vỏ và lá bàng từng được các chiến sĩ dùng làm bài thuốc trị bệnh kiết lỵ, cành bàng vót làm quản bút, còn búp bàng non được chắt chiu làm nguồn dinh dưỡng quý giá trong những ngày bị giam cầm khắc nghiệt.',
          authorityBoundary: 'Điểm dừng Gian trưng bày số 2 - Sân Trại giam Hỏa Lò.',
          actionableGuidance: 'Quan sát cây bàng cổ thụ và bia lưu niệm trong sân trại.',
          requiresHuman: false,
          style: 'TOUR_GUIDANCE'
        };
      }

      if (isTrongDong) {
        return {
          scenarioId: 'ORIENTATION_BRONZE_DRUM',
          response: isEn
            ? 'You are standing at the Dong Son Bronze Drum exhibition area, a prominent artifact of ancient Dong Son civilization in Vietnamese history.'
            : 'Bạn đang đứng tại gian trưng bày Trống Đồng Đông Sơn, chứng tích tiêu biểu cho nền văn hóa Đông Sơn rực rỡ thời kỳ đồ đồng của dân tộc Việt Nam.',
          authorityBoundary: 'Gian trưng bày Trống Đồng.',
          actionableGuidance: 'Quan sát hoa văn chim lạc và mặt trời trên mặt trống đồng.',
          requiresHuman: false,
          style: 'TOUR_GUIDANCE'
        };
      }

      if (isMayChem) {
        return {
          scenarioId: 'ORIENTATION_GUILLOTINE',
          response: isEn
            ? 'You are standing before the historic Guillotine, nearly 4 meters high, brought to Vietnam by the French colonialists at the end of the 19th century to terrorize patriotic revolutionaries.'
            : 'Bạn đang đứng trước cỗ máy chém khổng lồ cao gần 4 mét do thực dân Pháp đưa sang Việt Nam cuối thế kỷ XIX để khủng bố tinh thần các chiến sĩ cách mạng yêu nước.',
          authorityBoundary: 'Khu vực trưng bày Máy chém & Công cụ tra tấn.',
          actionableGuidance: 'Quan sát cấu tạo khung gỗ và lưỡi dao vát chéo 50kg.',
          requiresHuman: false,
          style: 'TOUR_GUIDANCE'
        };
      }

      return {
        scenarioId: 'ORIENTATION_GENERAL',
        response: isEn
          ? 'You are visiting Hoa Lo Prison Relic (Maison Centrale, No. 1 Hoa Lo Street, Hanoi). You are currently following the exhibition tour route through the historical prison quarters.'
          : 'Bạn đang đứng tại Di tích Lịch sử Nhà tù Hỏa Lò (số 1 phố Hỏa Lò, Hoàn Kiếm, Hà Nội). Bạn đang ở trong lộ trình tham quan các gian trưng bày lịch sử của nhà tù.',
        authorityBoundary: 'Di tích Lịch sử Nhà tù Hỏa Lò.',
        actionableGuidance: 'Tiếp tục di chuyển theo mũi tên chỉ dẫn tham quan.',
        requiresHuman: false,
        style: 'TOUR_GUIDANCE'
      };
    }

    // 7. KỊCH BẢN TƯ VẤN HÀNH TRÌNH & QUY ĐỊNH THAM QUAN (TOUR_RECOMMENDATION / VISIT_GUIDANCE)
    if (intent === 'TOUR_RECOMMENDATION' || intent === 'VISIT_GUIDANCE') {
      if (subIntent === 'GUIDANCE_WAYFINDING' || /diem don grab|cong ra cuoi cung|hai cua re|chieu thuan|nga tu ly thuong kiet|chua quan su/i.test(normQuery)) {
        let wfVi = 'Dạ bạn cứ di chuyển thuận theo hệ thống mũi tên một chiều đánh số thứ tự dọc tuyến tham quan (Cổng chính ➡️ Các buồng giam ➡️ Sân Cây Bàng ➡️ Máy chém & Xà lim Khu D ➡️ Cống ngầm ➡️ Khu Phi công Mỹ ➡️ Đài tưởng niệm ➡️ Quầy lưu niệm & Lối ra về mặt phố Hỏa Lò). Nếu cần chỉ đường nhanh tại ngã rẽ, bạn hỏi nhân viên bảo vệ gần nhất ngay nhé.';
        let wfEn = 'Please follow the numbered one-way directional arrows throughout the site from the Main Gate through the cells, Banyan Courtyard, Guillotine, Escape Sewer, American Pilots gallery, Memorial Monument, and exit near the Souvenir Shop back onto Hoa Lo Street.';
        if (/diem don grab/i.test(normQuery)) {
          wfVi = 'Dạ khi kết thúc tham quan bước ra Cổng số 1 phố Hỏa Lò, bạn có thể ghim điểm đón Grab ngay tại số 1 phố Hỏa Lò (phường Cửa Nam, quận Hoàn Kiếm). Lưu ý vào khung giờ cao điểm hoặc khi có nhiều xe đoàn dừng trước cổng, bác tài có thể hẹn bạn đi bộ vài chục mét ra phía đầu phố Hỏa Lò giao Hai Bà Trưng hoặc Lý Thường Kiệt để lên xe thoáng và an toàn hơn nhé.';
          wfEn = 'You can pin Grab pickup right at No. 1 Hoa Lo Street (Cua Nam Ward, Hoan Kiem). During busy hours or when tour buses park outside, stepping a short walk toward the Hai Ba Trung or Ly Thuong Kiet street corner makes pickup quicker and smoother.';
        } else if (/cong ra cuoi cung/i.test(normQuery)) {
          wfVi = 'Dạ tuyến tham quan Di tích Nhà tù Hỏa Lò được thiết kế theo vòng khép kín một chiều: đi qua các gian trưng bày, Đài tưởng niệm và Quầy lưu niệm xong, lối ra cuối cùng sẽ dẫn bạn trở lại ngay mặt phố Hỏa Lò sát khu vực Cổng chính số 1 (rất thuận tiện để lấy đồ gửi tủ, lấy xe hoặc gọi xe ra về) ạ.';
          wfEn = 'The tour follows a one-way loop through all galleries, the Memorial Monument, and the Souvenir Shop, exiting right back onto Hoa Lo Street beside Main Gate No. 1—convenient for lockers, parking, and pickup.';
        } else if (/nga tu ly thuong kiet/i.test(normQuery)) {
          wfVi = 'Dạ từ ngã tư Lý Thường Kiệt – Quán Sứ, bạn đi men theo phố Lý Thường Kiệt hướng về phía Tòa nhà Tháp Hà Nội (Hanoi Towers) rồi rẽ vào phố Hỏa Lò, chỉ tản bộ chừng 3 đến 5 phút (khoảng 250–350 mét) là thấy ngay mặt tiền cổ kính Cổng số 1 phố Hỏa Lò của Di tích Nhà tù Hỏa Lò ạ.';
          wfEn = 'From the Ly Thuong Kiet – Quan Su intersection, walk along Ly Thuong Kiet Street toward Hanoi Towers and turn onto Hoa Lo Street—it is a quick 3 to 5 minute walk right to Main Gate No. 1 Hoa Lo.';
        } else if (/chua quan su/i.test(normQuery)) {
          wfVi = 'Dạ đúng rồi bạn nhé! Chùa Quán Sứ nằm rất gần Di tích Nhà tù Hỏa Lò, chỉ cách khoảng 350–450 mét (tản bộ chừng 5 đến 7 phút). Với khung giờ buổi sáng từ 8h30 đến 11h30 (3 tiếng), bạn hoàn toàn dư dả thời gian thăm Chùa Quán Sứ thanh tịnh rồi đi bộ sang Hỏa Lò tham quan trọn vẹn lộ trình tiêu chuẩn 60–90 phút mà vẫn rất thong thả ạ.';
          wfEn = 'Yes! Quan Su Pagoda is only a 5 to 7 minute walk (about 400m) from Hoa Lo Prison Relic. A 3-hour morning window from 8:30 AM to 11:30 AM gives you plenty of relaxed time to visit both Quan Su Pagoda and the full 60–90 minute Hoa Lo route.';
        } else if (/hai cua re|chieu thuan/i.test(normQuery)) {
          wfVi = 'Dạ khi đi qua khoảng sân Cây Bàng cổ thụ, bạn chỉ cần bám theo các biển mũi tên đánh số thứ tự dọc theo lộ trình tham quan một chiều gắn trên tường và dưới sàn hành lang (từ khu Trại giam Nữ / Sân Cây Bàng nối tiếp sang Khu D xà lim tử hình, Máy chém, Cống ngầm rồi lên Khu trưng bày Phi công Mỹ và Đài tưởng niệm). Nếu thấy băn khoăn tại ngã rẽ, nhân viên bảo vệ trực ngay khu vực sân luôn sẵn lòng chỉ hướng chuẩn để bạn không bỏ sót gian nào nhé.';
          wfEn = 'After the Banyan Tree courtyard, simply follow the numbered one-way directional arrows on the walls and floor—they lead smoothly through Death Row Area D, the Guillotine, Escape Sewer, up to the American Pilots gallery, and the Memorial Monument. Staff in the courtyard are always happy to point the way.';
        }
        return {
          scenarioId: 'GUIDANCE_WAYFINDING',
          response: isEn ? wfEn : wfVi,
          authorityBoundary: 'Hệ thống biển chỉ dẫn nội khu và tọa độ Cổng chính số 1 phố Hỏa Lò.',
          actionableGuidance: 'Đi theo mũi tên đánh số một chiều hoặc hỏi nhân viên bảo vệ gần nhất.',
          requiresHuman: false,
          style: 'TOUR_GUIDANCE'
        };
      }

      if (subIntent === 'GUIDANCE_SOLO_SAFETY' || /nhan vien bao ve truc/i.test(normQuery)) {
        return {
          scenarioId: 'GUIDANCE_SOLO_SAFETY',
          response: isEn
            ? 'You can feel completely at ease visiting solo in the late afternoon. All galleries remain well-lit and monitored, and security guards and staff stay on duty across the relic until closing time at 5:00 PM. If you ever need help or fresh air, the open Banyan Tree courtyard and nearby staff are just steps away.'
            : 'Dạ bạn hoàn toàn yên tâm khi đi tham quan một mình vào cuối buổi chiều (tầm 16h30) nhé! Toàn bộ các phòng trưng bày và hành lang tại Di tích Nhà tù Hỏa Lò đều sáng đèn an toàn, có hệ thống giám sát và nhân viên bảo vệ túc trực xuyên suốt cho đến khi hết giờ mở cửa 17:00. Không gian di tích hoàn toàn trang nghiêm, an toàn — nếu cần hỗ trợ bất cứ lúc nào bạn cứ gọi nhân viên gần nhất hoặc ra sân Cây Bàng thoáng đãng nghỉ chân ạ.',
          authorityBoundary: 'Đội ngũ bảo vệ và hệ thống chiếu sáng trực xuyên suốt tới 17:00.',
          actionableGuidance: 'Yên tâm tham quan; liên hệ bảo vệ gần nhất nếu cần hỗ trợ.',
          requiresHuman: false,
          style: 'EMPATHETIC_SUPPORT'
        };
      }

      if (/trang phuc|mac do gi|ao ba lo|dep xo ngon|vay qua ngan|ao ho vai|ao lop/i.test(normQuery)) {
        return {
          scenarioId: 'GUIDANCE_DRESS_CODE',
          response: isEn
            ? 'Hoa Lo Prison is a solemn national historical memorial, so visitors are kindly asked to wear neat, respectful attire (avoid overly short skirts, revealing tops, or offensive slogans). If you forgot a light jacket or shawl, please check with our reception staff at Gate No. 1 for assistance.'
            : 'Dạ Di tích Nhà tù Hỏa Lò là không gian lịch sử trang nghiêm nên du khách cần mặc trang phục lịch sự, gọn gàng, tránh đồ quá hở hang hoặc phản cảm. Nếu bạn lỡ mặc áo sát nách, váy ngắn mà quên mang áo khoác che vai, bạn cứ trao đổi với nhân viên lễ tân tại Cổng chính số 1 để được hướng dẫn hỗ trợ phù hợp nhé.',
          authorityBoundary: 'Quy định trang phục trang nghiêm tại Di tích Quốc gia.',
          actionableGuidance: 'Mặc trang phục gọn gàng, lịch sự khi vào tham quan di tích.',
          requiresHuman: false,
          style: 'CUSTOMER_CARE'
        };
      }
      if (/cam cham tay|so nan|tao dang|treu choc|nhay dieu|dua lung|tuong gach|buc tuong|tuong.*tu nhan|linh gac|buoc len be|buc xi mang|duoc phep ngoi|giu trat tu|thu thach sinh ton|ngoi li/i.test(normQuery)) {
        let ruleVi = 'Dạ để bảo tồn nguyên trạng hiện vật, tượng sáp và tường gạch cổ hơn trăm năm tuổi, di tích đề nghị du khách không chạm tay vào hiện vật, không tựa mạnh lên tường cổ, và giữ thái độ trang nghiêm khi chụp ảnh (không tạo dáng trêu chọc bên tượng tù nhân hay quay nhảy bắt trend trong buồng giam) bạn nhé.';
        let ruleEn = 'To preserve the historic walls, ironwork, and wax figures, visitors are strictly asked not to touch exhibits, lean heavily against ancient brick walls, or strike mocking poses or dance trends inside the prison cells. Quiet, respectful photography is welcome with flash turned off.';
        if (/thu thach sinh ton|ngoi li/i.test(normQuery)) {
          ruleVi = 'Dạ mình xin phép trao đổi thẳng thắn là Di tích Nhà tù Hỏa Lò không cho phép thực hiện các thử thách ngồi lì hay quay clip sinh tồn bên trong phòng giam tối Cachot bạn nhé. Đây là không gian di tích lịch sử quốc gia trang nghiêm ghi dấu nỗi đau và ý chí kiên trung của các chiến sĩ yêu nước; bạn có thể tham quan, ghi hình tôn trọng không bật flash và tìm hiểu sâu câu chuyện lịch sử phía sau ngục tối Cachot cùng mình ạ.';
          ruleEn = 'Survival challenges or sitting inside the Cachot solitary cell for videos are strictly not permitted at Hoa Lo Prison Relic, as it is a solemn national memorial and preserved historical structure. You are welcome to observe respectfully, take non-flash photos from the designated walkway, and learn the real history of Cachot.';
        } else if (/buoc len be|buc xi mang|duoc phep ngoi/i.test(normQuery)) {
          ruleVi = 'Dạ du khách không được phép bước lên bệ xi măng, chạm vào cùm sắt hay ngồi lên bục hiện vật gần nắp cống ngầm lịch sử bạn nhé — tất cả đều là hiện vật/không gian bảo tồn cần giữ nguyên trạng và sự trang nghiêm. Khi mỏi chân cần nghỉ ngơi, bạn hãy ra hàng ghế đá, ghế nghỉ bố trí sẵn tại khu vực sân trại giam dưới bóng Cây bàng cổ thụ rất thoáng mát ạ.';
          ruleEn = 'Visitors are asked not to step onto cement beds, touch shackles, or sit on the historic curbs near the escape sewer, as all preserved surfaces require protection. Shaded resting benches are available right in the Banyan Tree courtyard whenever you need a break.';
        } else if (/giu trat tu/i.test(normQuery)) {
          ruleVi = 'Dạ theo nội quy tham quan Di tích Nhà tù Hỏa Lò, tất cả du khách và các đoàn học sinh đều được khuyến nghị đi nhẹ, nói khẽ và giữ trật tự trang nghiêm — đặc biệt khi đi qua các không gian lắng đọng như Ngục tối Cachot, Xà lim tử hình Khu D và Đài tưởng niệm. Nếu có đoàn nói cười hơi lớn làm ảnh hưởng không gian, bạn có thể nhắc khéo hoặc báo nhân viên bảo vệ trực gần đó hỗ trợ điều tiết lịch sự nhé.';
          ruleEn = 'Under Hoa Lo Prison Relic etiquette, all visitors and school groups are asked to speak softly and keep solemn order—especially inside sensitive areas like Cachot, Death Row Area D, and the Memorial Monument. On-duty guards nearby are always ready to gently remind loud groups.';
        }
        return {
          scenarioId: 'GUIDANCE_CONSERVATION_RESPECT',
          response: isEn ? ruleEn : ruleVi,
          authorityBoundary: 'Nội quy bảo tồn hiện vật và giữ gìn sự trang nghiêm di tích.',
          actionableGuidance: 'Không chạm/ngồi lên hiện vật, giữ trật tự và thái độ trang nghiêm.',
          requiresHuman: false,
          style: 'CUSTOMER_CARE'
        };
      }
      if (/khoang san thoang|nang triu|dieu hoa|tam dong cua|tu sua|viem mui di ung|am moc/i.test(normQuery)) {
        const isAllergyMold = /viem mui di ung|am moc/i.test(normQuery);
        return {
          scenarioId: 'GUIDANCE_COMFORT_AND_STATUS',
          response: isEn
            ? (isAllergyMold
              ? 'Although the historic prison walls are over a century old, the galleries are cleaned daily and fitted with ventilation and fans to minimize damp odors. If you have sensitive allergic rhinitis, wearing a light mask inside narrow cells and taking fresh-air pauses in the open Banyan Tree courtyard right outside is very comfortable.'
              : 'Indoor thematic galleries are ventilated and climate-controlled, and right after passing the darker cells you step into the open-air prison courtyard shaded by the historic Banyan Tree with benches to rest and catch fresh air. For any temporary gallery maintenance notices, please check with Gate No. 1 staff or call 024.39342253.')
            : (isAllergyMold
              ? 'Dạ dù các bức tường gạch đá tại Di tích Hỏa Lò đã hơn trăm năm tuổi, toàn bộ các buồng giam và phòng trưng bày hiện nay đều được Ban Quản lý vệ sinh thường xuyên, lắp đặt hệ thống thông gió và quạt hút khí nên khá sạch thoáng, hạn chế mùi ẩm mốc. Nếu bạn bị viêm mũi dị ứng khá nhạy cảm, bạn có thể đeo thêm khẩu trang mỏng khi đi qua các xà lim hẹp và bước ra khoảng sân Cây Bàng thoáng đãng ngay kề bên để hít thở khí trời rất dễ chịu ạ.'
              : 'Dạ các gian trưng bày trong nhà có hệ thống thông gió, làm mát hợp lý; và ngay sau khu xà lim tối là khoảng sân trại giam mở thoáng đãng dưới tán Cây bàng cổ thụ và Đài tưởng niệm có ghế ngồi để bạn nghỉ chân hít thở không khí trong lành. Riêng thông tin gian nào đang tạm đóng cửa tu sửa bảo quản trong tuần, bạn vui lòng xác nhận trực tiếp tại Quầy vé Cổng số 1 hoặc Hotline 024.39342253 nhé.'),
          authorityBoundary: 'Không gian sân trại mở & thông tin vận hành tại Cổng số 1.',
          actionableGuidance: 'Nghỉ chân tại Sân cây bàng cổ thụ thoáng đãng sau khi qua buồng giam.',
          requiresHuman: false,
          style: 'EMPATHETIC_SUPPORT'
        };
      }
      const timeConstraint = userProfile?.timeConstraint;
      const isUltraShort = (timeConstraint != null && timeConstraint <= 20) || /15 phút|15 phut|15p|rất vội|rat voi|cực nhanh|cuc nhanh/i.test(normQuery);
      const isShort = (timeConstraint != null && timeConstraint <= 45) || /ít thời gian|it thoi gian|20 phút|20 phut|30 phút|30 phut|45 phút|45 phut|vội|voi|nhanh/i.test(normQuery);

      if (isUltraShort) {
        return {
          scenarioId: 'TOUR_ULTRA_SHORT_15MIN',
          response: isEn
            ? 'If you only have 15 minutes (or 15-20 minutes), focus on 3 core must-see landmarks: 1) Main Entrance Maison Centrale ➡️ 2) Ancient Banyan Tree in the prison courtyard ➡️ 3) The Memorial Monument & Relief.'
            : 'Nếu chỉ có 15 phút (hoặc 15 đến 20 phút), bạn nên đi thẳng vào 3 điểm cốt lõi nhất: 1) Cổng chính Maison Centrale ➡️ 2) Cây bàng cổ thụ tại sân trại giam ➡️ 3) Đài tưởng niệm & Bức phù điêu tri ân các chiến sĩ cách mạng.',
          authorityBoundary: 'Tuyến tham quan 15-20 phút siêu tốc.',
          actionableGuidance: 'Đi nhanh 3 điểm: Cổng chính ➡️ Cây bàng ➡️ Đài tưởng niệm.',
          requiresHuman: false,
          style: 'SMART_RECOMMENDATION'
        };
      }

      if (isShort) {
        return {
          scenarioId: 'TOUR_SHORT_HIGHLIGHT',
          response: isEn
            ? 'If you have only 20-45 minutes, focus on these core highlights: Main Gate (Maison Centrale) ➡️ Courtyard & Ancient Banyan Tree ➡️ Cachot Dark Cell ➡️ The Guillotine ➡️ Escape Sewer ➡️ American Pilot Section ("Hanoi Hilton") ➡️ Memorial Monument.'
            : 'Nếu có ít thời gian (khoảng 20 đến 45 phút), bạn nên ưu tiên lộ trình rút gọn qua các điểm dừng cốt lõi: Cổng chính Maison Centrale ➡️ Cây bàng cổ thụ sân trại ➡️ Ngục tối Cachot ➡️ Cỗ máy chém ➡️ Cửa cống ngầm vượt ngục ➡️ Khu trưng bày phi công Mỹ ➡️ Đài tưởng niệm.',
          authorityBoundary: 'Lộ trình tối ưu cho khách thời gian ngắn.',
          actionableGuidance: 'Theo tuyến rút gọn 7 điểm dừng chính.',
          requiresHuman: false,
          style: 'SMART_RECOMMENDATION'
        };
      }

      return {
        scenarioId: 'TOUR_STANDARD_ITINERARY',
        response: isEn
          ? 'A standard visit takes 60 to 90 minutes following the numbered sequence: Main gate ➡️ Collective male cells ➡️ Cachot ➡️ Female cell ➡️ Courtyard & Banyan tree ➡️ Death row Area D ➡️ Guillotine ➡️ Escape sewer ➡️ American pilot section ➡️ Memorial monument. Renting an audio guide will enhance your experience.'
          : 'Chuyến tham quan tiêu chuẩn kéo dài khoảng 60 đến 90 phút theo thứ tự các điểm dừng: Cổng chính Maison Centrale ➡️ Phòng giam tập thể nam ➡️ Ngục tối Cachot ➡️ Trại giam Nữ ➡️ Sân trại giam & Cây bàng cổ thụ ➡️ Xà lim tử hình Khu D ➡️ Cỗ máy chém ➡️ Cửa cống ngầm ➡️ Khu trưng bày phi công Mỹ ➡️ Đài tưởng niệm. Bạn nên thuê thêm tai nghe Audioguide để nghe thuyết minh chi tiết nhé.',
        authorityBoundary: 'Lộ trình chuẩn 10 chặng di tích.',
        actionableGuidance: 'Tham quan theo thứ tự số thứ tự các phòng giam (60-90 phút).',
        requiresHuman: false,
        style: 'TOUR_GUIDANCE'
      };
    }

    return null;
  }
}

module.exports = new CustomerCareScenarioEngine();
