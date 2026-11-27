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

      if (normQuery.includes('huong dan vien') || normQuery.includes('thuyet minh vien')) {
        return {
          scenarioId: 'ASSISTANCE_DOCENT_BOOKING',
          response: isEn
            ? 'To book an on-site tour guide or docent for elderly visitors or large delegations, please register in advance via our official hotline or directly at the ticket booth at Gate No. 1. Our reception and security personnel are also available to support elderly visitors with walking and wheelchair navigation.'
            : 'Để đăng ký thuyết minh viên trực tiếp hỗ trợ cho đoàn tham quan (nhất là đoàn người cao tuổi hoặc đoàn đông), bạn hãy liên hệ qua hotline chính thức hoặc đăng ký tại quầy vé cổng chính số 1 Hỏa Lò. Đội ngũ nhân viên và bảo vệ di tích luôn sẵn lòng hỗ trợ dìu và đẩy xe lăn cho các cụ trong suốt lộ trình tham quan.',
          authorityBoundary: 'Đăng ký tại quầy vé cổng chính hoặc qua hotline chính thức.',
          actionableGuidance: 'Đăng ký tại quầy vé Cổng số 1 hoặc liên hệ hotline BQL.',
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
      const isChildren = normQuery.includes('tre em') || normQuery.includes('tre con') || normQuery.includes('em be') || normQuery.includes('con nho') || normQuery.includes('tre nho');
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

      const isSpecialExemption = /khuyet tat|huong dan vien|the nha bao|nha bao|cuu tu|cuu chien binh|thuong binh|nguoi co cong|can cuoc|vneid|anh chup the|quen vi o nha|quen the/i.test(normQuery);
      if (isSpecialExemption) {
        return {
          scenarioId: 'TICKET_SPECIAL_EXEMPTION',
          response: isEn
            ? 'Under current policy, free entry applies to children under 15 and revolutionary contributors, while a 50% discount (25,000 VND) applies to students with valid ID, seniors 60+, and severely disabled visitors. For licensed tour guides, press cards, companions of disabled guests, ex-prisoner relatives, or presenting a digital ID (VNeID/school app) when forgetting your physical card, please show your documents directly at Ticket Counter Gate No. 1 for staff verification.'
            : 'Dạ theo quy định hiện hành, Di tích Hỏa Lò miễn phí vé cho trẻ em dưới 15 tuổi và người có công với cách mạng; giảm 50% (còn 25.000 VNĐ) cho học sinh, sinh viên có thẻ hợp lệ, người cao tuổi từ 60 tuổi và người khuyết tật nặng. Với trường hợp người đi cùng người khuyết tật, thẻ hướng dẫn viên du lịch, thẻ nhà báo, thân nhân cựu tù hoặc quên thẻ cứng muốn xuất trình VNeID/thẻ điện tử, bạn vui lòng trình giấy tờ liên quan trực tiếp tại Quầy vé Cổng số 1 để nhân viên kiểm tra và áp dụng đúng chế độ ưu đãi nhé.',
          authorityBoundary: 'Nhân viên Quầy vé Cổng số 1 kiểm tra giấy tờ miễn giảm theo quy định.',
          actionableGuidance: 'Xuất trình giấy tờ xác nhận/VNeID tại Quầy vé Cổng số 1.',
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
      const isStorage = /gui do|de do|ba lo|balo|hanh ly|gui balo|cho gui do|tu gui do|mu bao hiem|cap laptop|laptop|ao mua|o dai|o gap|binh giu nhiet|binh nuoc/i.test(normQuery);
      const isMinorFirstAid = /xuoc.*ngon tay|bong bang|urgo|bang ca nhan|con sat khuan|quay y te/i.test(normQuery);
      const isSouvenir = /luu niem|mua qua|qua tang|quay luu niem|ao phong|coc su|tui tote|ban dao|nam cham|buu thiep|tinh dau|linh vat/i.test(normQuery);
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
        return {
          scenarioId: 'FACILITY_STORAGE',
          response: isEn
            ? 'Plain personal water bottles and compact folding umbrellas may be carried carefully inside. For bulky or wet belongings such as backpacks, motorbike helmets, long umbrellas, wet raincoats, or heavy bags, free personal lockers are available right beside Gate No. 1 entrance (please keep high-value laptops, wallets, and phones with you or check with Gate No. 1 staff for guidance).'
            : 'Dạ bạn yên tâm nhé! Với bình nước lọc cá nhân và ô gấp nhỏ gọn, bạn có thể cầm theo cẩn thận khi tham quan. Còn các vật dụng cồng kềnh hoặc ướt như ba lô, mũ bảo hiểm, ô dài, áo mưa ướt hay túi nặng, Di tích Hỏa Lò có tủ khóa gửi đồ miễn phí và khu vực hỗ trợ ngay gần lối vào Cổng chính số 1 (riêng tài sản giá trị cao như laptop, ví tiền, điện thoại bạn nên giữ bên mình hoặc trao đổi trực tiếp nhân viên quầy Cổng số 1 để yên tâm nhất ạ).',
          authorityBoundary: 'Tủ khóa gửi đồ miễn phí cạnh lối soát vé Cổng số 1.',
          actionableGuidance: 'Gửi đồ cồng kềnh tại tủ khóa miễn phí Cổng số 1; giữ đồ giá trị cao bên mình.',
          requiresHuman: false,
          style: 'QUICK_ANSWER'
        };
      }

      if (isSouvenir) {
        const isStreetVendor = /ban dao|via he|chinh hang/i.test(normQuery);
        const isBanyanSouvenir = /cây bàng|cay bang|lá bàng|la bang/i.test(normQuery);
        if (isStreetVendor) {
          return {
            scenarioId: 'FACILITY_SOUVENIR_OFFICIAL',
            response: isEn
              ? 'Official cultural souvenirs of Hoa Lo Prison Relic are sold exclusively inside the official souvenir shop near the exit—street vendors outside the gate are independent and not affiliated with the Management Board.'
              : 'Dạ các sản phẩm lưu niệm chính thức của Di tích Nhà tù Hỏa Lò chỉ được bày bán tại Cửa hàng lưu niệm bên trong khuôn viên gần lối ra bạn nhé; các hàng bán dạo ngoài vỉa hè là hộ kinh doanh tự phát, không thuộc hệ thống của Ban Quản lý Di tích ạ.',
            authorityBoundary: 'Cửa hàng lưu niệm chính thức nằm gần lối ra di tích.',
            actionableGuidance: 'Mua ấn phẩm chính thức tại Cửa hàng lưu niệm bên trong lối ra.',
            requiresHuman: false,
            style: 'QUICK_ANSWER'
          };
        }
        return {
          scenarioId: 'FACILITY_SOUVENIR',
          response: isEn
            ? (isBanyanSouvenir
              ? 'Currently, our catalogue does not list specific retail items made from the banyan tree at the souvenir shop (though banyan tea and jelly are served during the Sacred Night Tour). Please visit the souvenir counter near the exit directly to consult our staff on available cultural items.'
              : 'The official cultural souvenir shop near the exit features tote bags, T-shirts, ceramic mugs, notebooks, badges, and historical books. For exact sizes, protective gift packaging, or current seasonal stock, please ask our staff directly at the exit counter.')
            : (isBanyanSouvenir
              ? 'Hiện tại trong dữ liệu danh mục của mình chưa có thông tin chi tiết về các sản phẩm cụ thể làm từ cây bàng tại quầy lưu niệm (ngoại trừ trong tour đêm có phục vụ trà bàng và thạch bàng tri ân). Bạn vui lòng ghé trực tiếp quầy lưu niệm đặt gần lối ra của di tích để các bạn nhân viên tư vấn các sản phẩm lưu niệm độc đáo đang có sẵn nhé!'
              : 'Quầy lưu niệm chính thức đặt gần lối ra giới thiệu nhiều ấn phẩm văn hóa đặc sắc như túi tote, áo phông, cốc sứ, sổ tay, huy hiệu và sách lịch sử. Về size áo cụ thể, hộp bọc chống sốc hay các mẫu theo mùa hiện có sẵn, bạn vui lòng hỏi trực tiếp nhân viên tại quầy lưu niệm lối ra để được tư vấn và đóng gói chu đáo nhé.'),
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
      const isNightLogistics = /thue tron goi|rieng|doi ten|nhuong lai|om dot xuat|toi tre|19h15|khoi|phao sang|cho ngoi/i.test(normQuery);
      if (isNightLogistics && !isOtherForeign) {
        return {
          scenarioId: 'TOUR_NIGHT_LOGISTICS',
          response: isEn
            ? 'The Sacred Night Tour starts at 7:00 PM on Fri–Sun (approx. 90 minutes, combining walking through galleries with live theatrical scenes, lighting, and sound effects). For private group charters, transferring tickets due to illness, late-arrival entry, or seating needs, please contact our official Fanpage or Hotline 024.39342253 directly so the organizing team can arrange support.'
            : 'Dạ Tour đêm "Đêm thiêng liêng" khởi hành từ 19:00 các tối Thứ Sáu, Thứ Bảy và Chủ Nhật (khoảng 90 phút, kết hợp di chuyển qua các phòng giam và thưởng thức hoạt cảnh âm thanh, ánh sáng sống động). Với nhu cầu đặt suất riêng cho doanh nghiệp, đổi tên/nhượng vé khi ốm đột xuất, tới trễ giờ hay lưu ý hiệu ứng sân khấu cho trẻ nhỏ, bạn vui lòng liên hệ trực tiếp Fanpage chính thức hoặc Hotline 024.39342253 để Ban tổ chức hỗ trợ chuẩn xác nhất nhé.',
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
      if (/cam cham tay|so nan|tao dang|treu choc|nhay dieu|dua lung|tuong gach|buc tuong|tuong.*tu nhan|linh gac/i.test(normQuery)) {
        return {
          scenarioId: 'GUIDANCE_CONSERVATION_RESPECT',
          response: isEn
            ? 'To preserve the historic walls, ironwork, and wax figures, visitors are strictly asked not to touch exhibits, lean heavily against ancient brick walls, or strike mocking poses or dance trends inside the prison cells. Quiet, respectful photography is welcome with flash turned off.'
            : 'Dạ để bảo tồn nguyên trạng hiện vật, tượng sáp và tường gạch cổ hơn trăm năm tuổi, di tích đề nghị du khách không chạm tay vào hiện vật, không tựa mạnh lên tường cổ, và giữ thái độ trang nghiêm khi chụp ảnh (không tạo dáng trêu chọc bên tượng tù nhân hay quay nhảy bắt trend trong buồng giam) bạn nhé.',
          authorityBoundary: 'Nội quy bảo tồn hiện vật và giữ gìn sự trang nghiêm di tích.',
          actionableGuidance: 'Không chạm hiện vật, giữ thái độ trang nghiêm khi tham quan chụp ảnh.',
          requiresHuman: false,
          style: 'CUSTOMER_CARE'
        };
      }
      if (/khoang san thoang|nang triu|dieu hoa|tam dong cua|tu sua/i.test(normQuery)) {
        return {
          scenarioId: 'GUIDANCE_COMFORT_AND_STATUS',
          response: isEn
            ? 'Indoor thematic galleries are ventilated and climate-controlled, and right after passing the darker cells you step into the open-air prison courtyard shaded by the historic Banyan Tree with benches to rest and catch fresh air. For any temporary gallery maintenance notices, please check with Gate No. 1 staff or call 024.39342253.'
            : 'Dạ các gian trưng bày trong nhà có hệ thống thông gió, làm mát hợp lý; và ngay sau khu xà lim tối là khoảng sân trại giam mở thoáng đãng dưới tán Cây bàng cổ thụ và Đài tưởng niệm có ghế ngồi để bạn nghỉ chân hít thở không khí trong lành. Riêng thông tin gian nào đang tạm bảo trì trong tuần, bạn vui lòng xác nhận trực tiếp tại Quầy vé Cổng số 1 hoặc hotline 024.39342253 nhé.',
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
