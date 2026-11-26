/**
 * 2Guide Knowledge Base & Verified Dossiers
 * Kho tri thức chuẩn xác và toàn diện về Di tích Lịch sử Nhà tù Hỏa Lò:
 * 1. 13 Hồ sơ phân khu & hiện vật lịch sử chi tiết.
 * 2. Hồ sơ nghiệp vụ dịch vụ khách hàng (Vé, giờ mở cửa, tiện ích, khiếu nại, trợ năng).
 * 3. Bộ 500 câu hỏi - đáp tham chiếu chuẩn sử học (Ground Truth).
 */

const fs = require('fs');
const path = require('path');
const nlp = require('./nlp_processor');
const { LocalSemanticIndex } = require('./local_semantic_index');
const docentRewriter = require('./docent_rewriter');
const { loadDynamicKnowledgePacks, computeFolderSignature } = require('./custom_knowledge_loader');

// 1. HỒ SƠ 13 PHÂN KHU & HIỆN VẬT LỊCH SỬ
const HISTORICAL_EXHIBITS = {
  may_chem: {
    id: 'may_chem',
    name: 'Máy chém (Guillotine)',
    category: 'Máy chém & Công cụ tra tấn',
    keywords: ['may chem', 'guillotine', 'luoi dao', '4m', '50kg', 'nguyen thai hoc', 'yen bai', 'hanh quyet', 'tu hinh', 'toa an de hinh'],
    facts: [
      'Máy chém cao gần 4 mét, cột dựng bằng hai thanh gỗ lim song song.',
      'Lưỡi dao bằng thép vát chéo nặng 50kg, gắn kèm quả tạ chì trượt từ trên đỉnh xuống.',
      'Máy chém được thiết kế cơ động, có thể tháo rời để thực dân Pháp đưa đi hành quyết lưu động khắp Bắc Kỳ.',
      'Sáng ngày 17/6/1930, thực dân Pháp chuyển máy chém từ Hỏa Lò lên thị xã Yên Bái để hành quyết nhà yêu nước Nguyễn Thái Học cùng 12 nghĩa sĩ khởi nghĩa Yên Bái.',
      'Đồng chí Hoàng Văn Thụ không bị xử bằng máy chém mà bị xử bắn tại trường bắn Tương Mai (Hà Nội) ngày 24/5/1944.'
    ],
    directAnswer: 'Cỗ máy chém tại Nhà tù Hỏa Lò cao gần 4 mét với lưỡi dao thép vát chéo nặng 50kg rơi từ trên cao xuống. Thực dân Pháp dùng cỗ máy chém lưu động này để khủng bố phong trào yêu nước, tiêu biểu là việc đưa máy lên Yên Bái hành quyết nhà cách mạng Nguyễn Thái Học và 12 nghĩa sĩ năm 1930.'
  },

  cay_bang: {
    id: 'cay_bang',
    name: 'Cây bàng lịch sử',
    category: 'Sân trại giam & Cây bàng lịch sử',
    keywords: ['cay bang', 'la bang', 'bup bang', 'hat bang', 'canh bang', 'kiet ly', 'chua benh', 'quan but', 'tra bang', 'thach bang'],
    facts: [
      'Cây bàng cổ thụ trong sân trại giam được các cựu tù chính trị coi là người bạn tri kỷ và vị cứu tinh.',
      'Lá bàng bánh tẻ và búp bàng non được dùng để nhai hoặc sắc lấy nước uống chữa bệnh kiết lỵ, tiêu chảy rất hiệu nghiệm.',
      'Vỏ bàng dùng sắc nước rửa sạch các vết thương do tra tấn.',
      'Cành bàng được mài nhọn gọt giũa làm quản bút để viết tài liệu, báo chí bí mật.',
      'Hạt bàng đập lấy nhân giàu dầu và dinh dưỡng bồi dưỡng cho những đồng chí ốm nặng.',
      'Hiện nay trong tour đêm "Đêm thiêng liêng", du khách được thưởng thức các sản phẩm văn hóa ẩm thực tri ân từ cây bàng như trà bàng và thạch bàng.'
    ],
    directAnswer: 'Cây bàng cổ thụ tại sân trại giam Hỏa Lò là người bạn tri kỷ của tù nhân: búp và lá non dùng làm thuốc chữa khỏi bệnh kiết lỵ, cành bàng được mài làm quản bút viết báo bí mật, còn nhân hạt bàng bồi bổ sức khỏe cho tù nhân ốm nặng.'
  },

  vuot_nguc_1945: {
    id: 'vuot_nguc_1945',
    name: 'Cuộc vượt ngục tháng 3/1945 (Thời cơ Nhật đảo chính)',
    category: 'Vượt ngục & Đấu tranh',
    keywords: ['1945', '100 can bo', 'hon 100', 'nhat dao chinh', 'treo tuong', 'thang 3 1945', 'giai thoat hon 100', 'giai thoat hon 100 can bo'],
    facts: [
      'Cuộc vượt ngục giải thoát hơn 100 cán bộ cách mạng diễn ra vào tháng 3/1945 nhân thời cơ Nhật đảo chính Pháp.',
      'Lợi dụng tình hình hỗn loạn giữa quân Nhật và binh lính Pháp, các chiến sĩ cách mạng đã mưu trí trèo tường và cải trang để thoát ngục thành công.',
      'Lực lượng cán bộ vượt ngục này đã kịp thời trở về các địa phương lãnh đạo phong trào, bổ sung cán bộ cốt cán cho Tổng khởi nghĩa Cách mạng Tháng Tám năm 1945.'
    ],
    directAnswer: 'Cuộc vượt ngục giải thoát hơn 100 cán bộ cách mạng diễn ra vào tháng 3/1945 nhân thời cơ Nhật đảo chính Pháp. Các chiến sĩ đã mưu trí trèo tường và cải trang để trở về với phong trào cách mạng, kịp thời bổ sung lực lượng lãnh đạo Tổng khởi nghĩa Cách mạng Tháng Tám 1945.'
  },

  cong_ngam: {
    id: 'cong_ngam',
    name: 'Đường cống ngầm & Vượt ngục 1951',
    category: 'Cống ngầm & Vượt ngục lịch sử',
    keywords: ['cong ngam', 'vuot nguc 1951', 'song sat', 'noel', '24 12 1951', '1951', 'tho nhuom', 'quan su', 'cua song', '16 tu tu', '5 dong chi'],
    facts: [
      'Đêm Noel 24/12/1951: 16 tử tù chính trị đã bí mật cưa song sắt cống ngầm bằng những lưỡi dũa nhỏ giấu kín, chui qua đường cống ngầm bùn lầy chật hẹp thoát ra mặt đường phố Thợ Nhuộm (khu vực Quán Sứ).',
      'Trong vụ vượt ngục đêm Noel 1951, 5 đồng chí đã thoát thành công ra vùng tự do kháng chiến an toàn, số còn lại không may bị địch truy bắt lại.'
    ],
    directAnswer: 'Hệ thống cống ngầm Hỏa Lò ghi dấu vụ vượt ngục huyền thoại đêm Noel 24/12/1951 của 16 tử tù chính trị sau khi cưa song sắt cống ngầm để thoát ra phố Thợ Nhuộm, trong đó có 5 đồng chí đã trở về vùng căn cứ kháng chiến an toàn.'
  },

  cachot: {
    id: 'cachot',
    name: 'Ngục tối (Cachot)',
    category: 'Ngục tối Cachot',
    keywords: ['cachot', 'nguc toi', 'biet giam', 'cum chan', 'be xi mang', 'nghieng', 'mau don', 'phu ne', 'dia nguc'],
    facts: [
      'Cachot là khu ngục tối biệt giam dùng để trừng phạt những tù nhân bị coi là chống đối hoặc nguy hiểm.',
      'Phòng giam chật hẹp, tối đen như mực, không có ánh sáng tự nhiên và cực kỳ thiếu dưỡng khí.',
      'Tù nhân bị cùm chân cả ngày lẫn đêm trên bệ xi măng có độ nghiêng dốc ngược, khiến chân cao hơn đầu.',
      'Tư thế giam cầm dốc ngược khiến máu dồn lên não, gây phù nề mắt, mù lòa, lở loét và hoại tử da thịt.',
      'Cachot được người tù mệnh danh là "địa ngục của địa ngục" chốn trần gian.'
    ],
    directAnswer: 'Ngục tối Cachot được mệnh danh là "địa ngục của địa ngục", nơi tù nhân bị cùm chặt chân trên bệ xi măng nghiêng dốc trong bóng tối hoàn toàn, khiến máu dồn ngược lên não gây phù nề, mù lòa và kiệt quệ thể xác.'
  },

  khu_d_tu_hinh: {
    id: 'khu_d_tu_hinh',
    name: 'Khu D & Xà lim tử hình',
    category: 'Khu D & Xà lim tử hình',
    keywords: ['khu d', 'xa lim tu hinh', 'tu tu', 'buong so 1', 'hoang van thu', 'do nhuan', 'ao len', 'tuong mai', 'an chem'],
    facts: [
      'Khu D là khu vực biệt giam xà lim án chém, nơi giam giữ các tử tù chính trị chờ ngày thi hành án.',
      'Buồng số 1 Khu D từng giam giữ đồng chí Hoàng Văn Thụ - Ủy viên Thường vụ Trung ương Đảng.',
      'Trước khi bị xử bắn sáng 24/5/1944 tại Tương Mai, đồng chí Hoàng Văn Thụ đã để lại khí phách hiên ngang và bài thơ nhắn nhủ đồng chí.',
      'Tại đây diễn ra câu chuyện xúc động về chiếc áo len: nhạc sĩ Đỗ Nhuận nhường áo và bà Phạm Thị Vân bí mật đan áo len gửi tặng đồng chí Hoàng Văn Thụ giữ ấm.'
    ],
    directAnswer: 'Khu D là dãy xà lim giam giữ các chiến sĩ cách mạng bị kết án tử hình. Buồng số 1 từng giam giữ đồng chí Hoàng Văn Thụ với tinh thần bất khuất trước khi hy sinh tại trường bắn Tương Mai năm 1944.'
  },

  phong_giam_tap_the: {
    id: 'phong_giam_tap_the',
    name: 'Phòng giam tập thể',
    category: 'Khu phòng giam tập thể',
    keywords: ['phong giam tap the', 'trai nam', 'trai e', 'trai g', 'be cum chan', 'cap rang', 'song sat mat cao', 'ngot ngat'],
    facts: [
      'Phòng giam tập thể nam (Trại E, G) từng giam giữ hàng trăm tù nhân chen chúc trên hai dãy bệ xi măng.',
      'Chân tù nhân bị khóa cố định vào thanh cùm sắt dài dọc bệ xi măng vào ban đêm.',
      'Cửa sổ được bọc lưới sắt mắt cáo dày đặc nhằm ngăn cách tiếp tế và âm thanh.',
      'Thực dân Pháp sử dụng tù thường phạm làm "cập rằng" để giám sát, đánh đập tù chính trị.',
      'Các chiến sĩ đã biến phòng giam tập thể thành trường học cách mạng, truyền dạy văn hóa và lý luận chính trị.'
    ],
    directAnswer: 'Phòng giam tập thể Hỏa Lò từng giam hàng trăm tù nhân bị khóa chân trên bệ cùm xi măng dài ngột ngạt. Bất chấp đòn roi của cai ngục và cập rằng, các chiến sĩ đã kiên cường biến nơi đây thành trường học cách mạng.'
  },

  trai_nu: {
    id: 'trai_nu',
    name: 'Khu trại giam Nữ',
    category: 'Khu trại giam Nữ & Tù nhi',
    keywords: ['trai nu', 'tu nu', 'nguyen thi minh khai', 'hoang ngan', 'truong thi my', 'tuyet thuc', 'con tho', 'tu nhi'],
    facts: [
      'Khu trại giam Nữ giam giữ các nữ tù nhân chính trị, nhiều người mang theo con thơ hoặc sinh con ngay trong ngục tối.',
      'Nơi đây từng giam giữ các nữ chiến sĩ kiên trung như đồng chí Nguyễn Thị Minh Khai, Hoàng Ngân, Trương Thị Mỹ.',
      'Các nữ tù đã dũng cảm tổ chức nhiều cuộc tuyệt thực kéo dài ngày đòi nước sinh hoạt, sữa cho con nhỏ và chống đánh đập.',
      'Chị em còn tranh thủ học tập văn hóa, thêu thùa và chăm sóc động viên nhau giữ vững niềm tin cách mạng.'
    ],
    directAnswer: 'Khu trại giam Nữ ghi dấu tinh thần quả cảm của các nữ tù chính trị như đồng chí Nguyễn Thị Minh Khai, Hoàng Ngân. Dù bị giam cầm cùng con thơ trong thiếu thốn, các nữ chiến sĩ vẫn đoàn kết tuyệt thực đấu tranh bảo vệ quyền sống.'
  },

  cum_sat: {
    id: 'cum_sat',
    name: 'Hệ thống cùm sắt & Bệ cùm',
    category: 'Công cụ giam giữ & Bệ cùm',
    keywords: ['cum sat', 'cum chan', 'be cum', 'gong cum', 'thanh cum', 'khoa cum', 'khoa chan', 'cum go', 'cum go lim', 'chan bi cum'],
    facts: [
      'Hệ thống cùm chân bằng sắt được thực dân Pháp thiết kế gắn cố định dọc theo hai dãy bệ xi măng trong các phòng giam tập thể (Trại E, Trại G) và xà lim án chém.',
      'Vào ban đêm, chân của các tù nhân bị khóa chặt vào thanh cùm sắt suốt từ tối đến sáng hôm sau, khiến tù nhân không thể trở mình hoặc đi lại.',
      'Đối với tử tù tại Khu D và ngục tối Cachot, chế độ cùm kẹp còn tàn bạo hơn với cùm chéo chân hoặc cùm cả hai chân, bệ cùm dốc ngược khiến máu dồn lên đầu và chân bị phù nề, hoại tử.',
      'Chế độ cùm sắt là minh chứng đanh thép cho sự hà khắc của chế độ lao tù thực dân, áp dụng đối với tù nhân chính trị Việt Nam thời Pháp thuộc, hoàn toàn không phải nơi giam giữ phi công Mỹ.'
    ],
    directAnswer: 'Hệ thống cùm sắt tại Nhà tù Hỏa Lò được thực dân Pháp sử dụng để khóa chặt chân tù nhân vào các thanh sắt dài gắn dọc hai dãy bệ xi măng trong phòng giam tập thể và xà lim tử hình vào ban đêm. Chế độ cùm kẹp hà khắc này khiến chân người tù bị sưng phù, đau đớn cùng cực, là chứng tích điển hình cho sự tàn bạo của chế độ ngục tù thực dân thời Pháp thuộc.'
  },

  phi_cong: {
    id: 'phi_cong',
    name: 'Khu trưng bày phi công Mỹ ("Hanoi Hilton")',
    category: 'Khu phi công Mỹ (1964–1973)',
    keywords: ['phi cong', 'hanoi hilton', 'john mccain', 'pete peterson', 'ban roi', '1964 1973', 'truc bach', 'trao tra'],
    facts: [
      'Từ năm 1964 đến 1973, Nhà tù Hỏa Lò là nơi tạm giam các phi công Mỹ bị bắn rơi ở miền Bắc.',
      'Các phi công Mỹ gọi nơi đây bằng biệt danh châm biếm là "Hanoi Hilton".',
      'Phi công nổi tiếng có Trung úy Hải quân John McCain (bị bắn rơi tại hồ Trúc Bạch ngày 26/10/1967) và Douglas "Pete" Peterson (sau này là Đại sứ Mỹ đầu tiên tại Việt Nam).',
      'Chính phủ Việt Nam đã thực hiện chính sách đối xử nhân đạo: chăm sóc y tế, bảo đảm dinh dưỡng, cho phép nhận thư gia đình và tổ chức lễ Giáng sinh.',
      'Toàn bộ tù binh phi công Mỹ được trao trả tự do vào đầu năm 1973 sau Hiệp định Paris.'
    ],
    directAnswer: 'Giai đoạn 1964–1973, Hỏa Lò tạm giam các phi công Mỹ bị bắn rơi (được gọi là "Hanoi Hilton"), tiêu biểu có John McCain và Pete Peterson. Họ đã được hưởng chính sách nhân đạo và chăm sóc y tế chu đáo trước khi được trao trả năm 1973.'
  },

  maison_centrale: {
    id: 'maison_centrale',
    name: 'Cổng chính & Kiến trúc Maison Centrale',
    category: 'Cổng chính & Kiến trúc tổng thể',
    keywords: ['maison centrale', '1896', 'cong chinh', 'lang hoa lo', 'phu khanh', 'kien truc', 'tuong bao', 'manh chai', 'so 1 pho hoa lo', 'dia chi', 'o dau', 'vi tri', 'dia diem', 'pho hoa lo', 'cua nam', 'hoan kiem', 'dien tich'],
    facts: [
      'Di tích Lịch sử Nhà tù Hỏa Lò nằm tại số 1 phố Hỏa Lò, phường Cửa Nam, quận Hoàn Kiếm, thành phố Hà Nội.',
      'Nhà tù Hỏa Lò được thực dân Pháp xây dựng năm 1896, mang tên tiếng Pháp là "Maison Centrale" (Ngục Trung ương).',
      'Địa điểm xây dựng vốn là đất làng Phụ Khánh (tổng Vĩnh Xương, huyện Thọ Xương, Hà Nội) - làng nghề làm ấm đất và bếp hỏa lò nung gốm đỏ lửa quanh năm, do đó người dân quen gọi là Hỏa Lò.',
      'Làng Phụ Khánh vốn được hợp nhất từ hai thôn cổ là thôn Nguyên Khánh và thôn Phụ Khánh.',
      'Hệ thống tường bao bằng đá kiên cố cao khoảng 4m, dày 0.5m, phía trên cắm mảnh chai thủy tinh sắc nhọn và chăng dây thép gai kiên cố.',
      'Diện tích ban đầu của nhà tù rộng gần 13.000 m2; hiện nay khu di tích bảo tồn có diện tích hơn 2.400 m2.'
    ],
    directAnswer: 'Di tích Lịch sử Nhà tù Hỏa Lò tọa lạc tại số 1 phố Hỏa Lò, phường Cửa Nam, quận Hoàn Kiếm, Hà Nội. Nơi đây do thực dân Pháp xây dựng năm 1896 mang tên Maison Centrale trên nền đất làng Phụ Khánh chuyên làm ấm đất và lò nung gốm xưa.'
  },

  hien_vat_sinh_hoat: {
    id: 'hien_vat_sinh_hoat',
    name: 'Hiện vật sinh hoạt & Báo chí bí mật',
    category: 'Trường học cách mạng & Hiện vật',
    keywords: ['but canh bang', 'gach non', 'muoi than', 'bao chi bi mat', 'lao tu', 'bua liem', 'sinh hoat', 'truong hoc cach mang'],
    facts: [
      'Người tù đã mài cành bàng thành ngòi bút chấm mực.',
      'Dùng bột gạch non màu đỏ hoặc muội than củi hòa với nước để làm mực viết trên giấy vệ sinh hoặc vải vụn.',
      'Các tờ báo cách mạng bí mật như báo "Lao Tù", báo "Búa Liềm" được chép tay cẩn thận và chuyền tay nhau đọc bí mật.',
      'Các đồ dùng sinh hoạt được tái chế khéo léo từ vỏ đồ hộp nhôm, thìa mài sắc làm dao gọt, thể hiện tinh thần biến ngục tù thành trường học cách mạng.'
    ],
    directAnswer: 'Các hiện vật sinh hoạt như ngòi bút cành bàng, mực viết làm từ muội than và bột gạch non, cùng các tờ báo bí mật chép tay là minh chứng phi thường cho ý chí biến ngục tối Hỏa Lò thành trường học cách mạng.'
  },

  dai_tuong_niem: {
    id: 'dai_tuong_niem',
    name: 'Đài tưởng niệm & Bức phù điêu',
    category: 'Đài tưởng niệm & Bức phù điêu',
    keywords: ['dai tuong niem', 'phu dieu', 'le lien', 'dang huong', 'tri an', 'liet si', 'so luu but'],
    facts: [
      'Đài tưởng niệm Hỏa Lò là không gian thiêng liêng để du khách dâng hương tri ân các anh hùng liệt sĩ cách mạng.',
      'Bức phù điêu lớn tạc bằng đá tự nhiên do nhà điêu khắc Lê Liên sáng tác, khắc họa hình ảnh những chiến sĩ kiên trung kề vai sát cánh sau song sắt.',
      'Tại đây có cuốn sổ lưu bút để du khách trong và ngoài nước ghi lại những dòng cảm tưởng xúc động sau chuyến tham quan.'
    ],
    directAnswer: 'Đài tưởng niệm Hỏa Lò với bức phù điêu đá của nhà điêu khắc Lê Liên là không gian trang nghiêm tri ân các liệt sĩ cách mạng, nơi du khách có thể thành kính dâng hương và ghi lại lưu bút cảm tưởng.'
  },

  tour_dem: {
    id: 'tour_dem',
    name: 'Tour đêm "Đêm thiêng liêng"',
    category: 'Tour đêm & Trải nghiệm',
    keywords: ['tour dem', 'dem thieng lieng', 'trai nghiem dem', 'am thanh anh sang', 'tra bang', 'thach bang', 'sang ngoi tinh than viet', 'song nhu nhung doa hoa', 'lua thanh xuan'],
    facts: [
      'Tour đêm "Đêm thiêng liêng" là sản phẩm du lịch trải nghiệm độc đáo vào các tối cuối tuần tại Hỏa Lò.',
      'Có 3 chủ đề: "Đêm thiêng liêng 1 - Sáng ngời tinh thần Việt", "Đêm thiêng liêng 2 - Sống như những đóa hoa", "Đêm thiêng liêng 3 - Lửa thanh xuân".',
      'Chương trình ứng dụng nghệ thuật ánh sáng và âm thanh sống động, diễn hoạt các tình huống lịch sử xúc động.',
      'Kết thúc tour, khách được thưởng thức trà bàng và thạch bàng - món quà đặc trưng mang ý nghĩa tri ân từ cây bàng lịch sử.'
    ],
    directAnswer: 'Tour đêm "Đêm thiêng liêng" tái hiện chân thực cuộc đấu tranh kiên trung của người tù qua nghệ thuật âm thanh, ánh sáng và hoạt cảnh sân khấu xúc động, kết thúc bằng việc thưởng thức trà bàng và thạch bàng tri ân.'
  },

  bao_ton_hien_nay: {
    id: 'bao_ton_hien_nay',
    name: 'Bảo tồn & Dịch vụ hiện nay',
    category: 'Bảo tồn & Dịch vụ tham quan',
    keywords: ['bao ton', 'tuong sap', 'composite', 'audioguide', 'tai nghe', 'quay luu niem', 'tui tote', 'so tay', 'huy hieu'],
    facts: [
      'Di tích bảo tồn nguyên trạng các dãy xà lim, cửa sắt cổ có lớp sơn chống oxy hóa.',
      'Tái hiện không gian chân thực bằng hệ thống tượng tù nhân chế tác bằng composite/sáp.',
      'Hệ thống thuyết minh tự động Audioguide đa ngôn ngữ hỗ trợ du khách nghe giới thiệu chi tiết theo số thứ tự hiện vật.',
      'Khu quầy lưu niệm giới thiệu các ấn phẩm lịch sử, túi tote, sổ tay và quà tặng độc đáo in hình cổng di tích và lá bàng.'
    ],
    directAnswer: 'Di tích hiện nay kết hợp bảo tồn nguyên trạng các dãy xà lim với hệ thống tượng sáp composite chân thực, thiết bị thuyết minh Audioguide đa ngôn ngữ và không gian quầy lưu niệm văn hóa hiện đại.'
  },

  trong_dong: {
    id: 'trong_dong',
    name: 'Trống Đồng Đông Sơn (Mã 001)',
    category: 'Hiện vật BLE - Thời Đại Kim Khí',
    keywords: ['trong dong', 'dong son', 'ngoi sao 14 canh', 'chim lac', 'ma 001', 'so 001', 'thoi dai kim khi', 'van minh song hong', 'dong son bronze drum', 'bronze drum', 'lac bird', '14-pointed star'],
    facts: [
      'Trống đồng Đông Sơn tại Gian trưng bày số 1 (Mã 001) là bảo vật quốc gia kiệt xuất, biểu tượng thiêng liêng của nền văn minh sông Hồng từ thế kỷ thứ 7 trước Công nguyên (thời đại Hùng Vương dựng nước).',
      'Trống được đúc bằng đồng cổ; trên mặt trống có hình tượng ngôi sao 14 cánh tỏa sáng tượng trưng cho mặt trời.',
      'Bao quanh ngôi sao mặt trời là hoa văn chim Lạc tung cánh và các đoàn người hóa trang múa hát, phản ánh đời sống tín ngưỡng và sinh hoạt văn hóa rực rỡ của cư dân Lạc Việt cổ.'
    ],
    directAnswer: 'Dạ chào bạn, Trống đồng Đông Sơn tại Gian trưng bày số 1 (Mã 001) là bảo vật quốc gia kiệt xuất, biểu trưng cho nền văn minh sông Hồng từ thế kỷ thứ 7 trước Công nguyên. Trên mặt trống nổi bật hình tượng ngôi sao 14 cánh tượng trưng cho mặt trời, bao quanh là hoa văn chim Lạc tung cánh và các đoàn người hóa trang múa hát.'
  },

  dat_hong: {
    id: 'dat_hong',
    name: 'Đạt Hồng - Đại Hồng Chung (Mã 003)',
    category: 'Hiện vật BLE - Di Sản Cố Đô',
    keywords: ['dat hong', 'dathong', 'dai hong chung', 'chuong dai hong', 'chuong lon', 'thap chuong', 'ma 003', 'so 003', 'chuong dong co', 'great bronze bell', 'bronze bell', 'bat quai', 'rong may'],
    facts: [
      'Đạt Hồng - Đại Hồng Chung tại Gian trưng bày số 3 - Tháp Chuông Di Tích (Mã 003) là chiếc chuông đồng cổ được đúc dưới triều Nguyễn.',
      'Quả chuông nặng hơn 2 tấn; trên thân chuông khắc tinh xảo các bài minh văn, hoa văn bát quái và hình tượng rồng mây uyển chuyển.',
      'Mỗi hồi chuông ngân vang có thể vọng xa hàng chục dặm, gửi gắm ước nguyện quốc thái dân an và sự thanh tịnh cho tâm hồn.'
    ],
    directAnswer: 'Dạ chào bạn, Đạt Hồng (Đại Hồng Chung) tại Gian trưng bày số 3 (Mã 003) là chiếc chuông đồng cổ được đúc dưới triều Nguyễn với trọng lượng hơn 2 tấn. Trên thân chuông chạm khắc tinh xảo các bài minh văn, hoa văn bát quái và hình tượng rồng mây uyển chuyển; mỗi hồi chuông ngân vang có thể vọng xa hàng chục dặm cầu cho quốc thái dân an.'
  },

  bao_kiem: {
    id: 'bao_kiem',
    name: 'Bảo Kiếm Hoàng Gia Triều Nguyễn (Mã 004)',
    category: 'Hiện vật BLE - Cổ Vật Hoàng Cung',
    keywords: ['bao kiem', 'kiem hoang gia', 'luong long trieu nhat', 'co vat hoang cung', 'ma 004', 'so 004', 'royal sword', 'imperial sword', 'vang rong', 'ngoc bich'],
    facts: [
      'Bảo kiếm Hoàng gia tại Gian trưng bày số 4 - Cổ Vật Hoàng Cung (Mã 004) là bảo vật triều Nguyễn, biểu trưng quyền uy tối thượng của đấng quân vương.',
      'Vỏ kiếm được chế tác bằng vàng ròng, cẩn ngọc bích và đá quý ngũ sắc theo mô thức Lưỡng Long Triều Nhật.',
      'Lưỡi kiếm rèn từ thép tôi gia truyền sắc bén, thể hiện đỉnh cao nghệ thuật kim hoàn của các nghệ nhân cung đình xưa.'
    ],
    directAnswer: 'Dạ chào bạn, Bảo kiếm Hoàng gia triều Nguyễn tại Gian trưng bày số 4 (Mã 004) là biểu trưng quyền uy tối thượng của đấng quân vương xưa. Vỏ kiếm được chế tác bằng vàng ròng, cẩn ngọc bích và đá quý ngũ sắc theo mô thức Lưỡng Long Triều Nhật, còn lưỡi kiếm làm từ thép tôi gia truyền sắc bén thể hiện tài hoa kim hoàn bậc thầy của các nghệ nhân cung đình.'
  }
};

// 2. HỒ SƠ NGHIỆP VỤ & CHĂM SÓC KHÁCH THAM QUAN
const CUSTOMER_CARE_DOSSIERS = {
  tickets: {
    title: 'Quy định & Biểu phí vé tham quan',
    facts: [
      'Địa chỉ: Số 1 phố Hỏa Lò, phường Trần Hưng Đạo, quận Hoàn Kiếm, Hà Nội.',
      'Giá vé ban ngày: 50.000 VNĐ / lượt cho người lớn.',
      'Giá vé ưu đãi 50% (25.000 VNĐ / lượt): Áp dụng cho học sinh, sinh viên (xuất trình thẻ HSSV hợp lệ), người cao tuổi (từ 60 tuổi trở lên mang theo CCCD), người khuyết tật nặng.',
      'Miễn phí vé: Trẻ em dưới 15 tuổi, người có công với cách mạng, người khuyết tật đặc biệt nặng.',
      'Vé thuyết minh tự động (Audioguide): Thuê tại quầy vé với phí khoảng 50.000 VNĐ / máy (có nhiều ngôn ngữ: Việt, Anh, Pháp...).',
      'Vé tour đêm "Đêm thiêng liêng": Giá từ 399.000 - 499.000 VNĐ tùy chủ đề, diễn ra tối cuối tuần (thứ 6, 7, CN); PHẢI ĐẶT TRƯỚC qua fanpage hoặc hotline chính thức vì giới hạn số lượng khách.',
      'Chính sách hoàn/đổi vé: Vé ban ngày mua tại quầy có giá trị sử dụng trong ngày và không áp dụng hoàn tiền sau khi đã qua cửa soát vé; với các trường hợp thanh toán nhầm hoặc tour đêm cần đổi lịch, khách hàng liên hệ trực tiếp quầy vé để được nhân viên đối soát theo quy định.'
    ]
  },

  hours: {
    title: 'Khung giờ hoạt động & Mở cửa',
    facts: [
      'Giờ mở cửa ban ngày: Từ 8:00 đến 17:00 tất cả các ngày trong tuần (từ Thứ Hai đến Chủ Nhật).',
      'Di tích mở cửa liên tục không nghỉ trưa.',
      'Các ngày Lễ, Tết trong năm di tích vẫn mở cửa đón khách bình thường.',
      'Tour đêm "Đêm thiêng liêng": Bắt đầu đón khách từ 19:00 các tối Thứ Sáu, Thứ Bảy và Chủ Nhật (thời lượng tour khoảng 90 phút).'
    ]
  },

  facilities: {
    title: 'Cơ sở vật chất & Tiện ích phục vụ khách',
    facts: [
      'Tủ gửi đồ cá nhân: Có khu vực tủ gửi đồ miễn phí gần cổng soát vé dành cho balo, túi xách cồng kềnh. Du khách tự bảo quản tài sản có giá trị (tiền bạc, điện thoại, giấy tờ cá nhân).',
      'Nhà vệ sinh (WC): Bố trí tại khu vực sân trại giam và gần lối ra/quầy lưu niệm, sạch sẽ và có biển chỉ dẫn rõ ràng.',
      'Nước uống & Quầy lưu niệm: Quầy lưu niệm nằm ở gần lối ra, có bán đồ uống đóng chai và các sản phẩm văn hóa (sổ tay, túi tote, huy hiệu, sách tư liệu). Trong tour đêm có phục vụ trà bàng và thạch bàng miễn phí.',
      'Quy định chụp ảnh: Du khách được phép chụp ảnh lưu niệm thông thường (vui lòng tắt đèn flash tại các phòng giam để bảo quản hiện vật và tôn trọng không gian thiêng liêng); cấm quay phim chụp ảnh thương mại khi chưa có sự đồng ý của Ban quản lý.'
    ]
  },

  accessibility: {
    title: 'Chính sách hỗ trợ người cao tuổi, trẻ em & người khuyết tật',
    facts: [
      'Người cao tuổi & Người khuyết tật: Di tích là công trình cổ từ năm 1896 nên có một số bậc tam cấp cao; Ban quản lý có bố trí đường dốc ở các khu vực chính; nhân viên bảo vệ và hướng dẫn viên luôn sẵn lòng hỗ trợ dìu hoặc đẩy xe lăn khi khách cần giúp đỡ.',
      'Trẻ em: Trẻ em dưới 15 tuổi được miễn phí vé nhưng bắt buộc phải có người lớn đi cùng để bảo đảm an toàn. Các khu vực như Ngục tối Cachot và Máy chém có ánh sáng tối và bối cảnh chân thực, phụ huynh nên cân nhắc hướng dẫn phù hợp với tâm lý trẻ nhỏ.',
      'Ghế nghỉ chân: Bố trí tại khu vực sân trại giam dưới bóng mát cây bàng cổ thụ và một số hành lang.'
    ]
  },

  assistance_and_complaint: {
    title: 'Xử lý khiếu nại, phản ánh và hỗ trợ đặc biệt',
    facts: [
      'Khi khách phàn nàn / không hài lòng: Lắng nghe chân thành, ghi nhận phản hồi, xin lỗi vì trải nghiệm chưa trọn vẹn, giải thích nhẹ nhàng và hướng dẫn khách gặp tổ trưởng lễ tân hoặc để lại ý kiến vào sổ góp ý.',
      'Khi khách bị mất đồ / thất lạc tài sản: Hướng dẫn khách đến ngay phòng thường trực bảo vệ hoặc quầy thông tin tại cổng số 1 Hỏa Lò để trích xuất camera giám sát và kiểm tra sổ bàn giao tài sản thất lạc.',
      'Khi khách cần hỗ trợ y tế: Thông báo ngay cho nhân viên bảo vệ hoặc phòng trực y tế của di tích để được sơ cứu kịp thời.'
    ]
  },

  tour_recommendation: {
    title: 'Tư vấn hành trình & Lộ trình tham quan tối ưu',
    facts: [
      'Lộ trình chuẩn (60 - 90 phút): Cổng chính Maison Centrale ➡️ Lịch sử làng gốm Phụ Khánh ➡️ Trại giam tập thể nam (Trại E, G) ➡️ Ngục tối Cachot ➡️ Khu trại giam Nữ ➡️ Sân trại giam & Cây bàng cổ thụ ➡️ Khu D & Xà lim tử hình ➡️ Cỗ máy chém ➡️ Cửa cống ngầm vượt ngục 1951 ➡️ Khu phi công Mỹ ("Hanoi Hilton") ➡️ Đài tưởng niệm & Bức phù điêu ➡️ Quầy lưu niệm.',
      'Lộ trình nhanh (30 - 45 phút cho khách ít thời gian): Cổng chính ➡️ Cây bàng cổ thụ ➡️ Ngục tối Cachot ➡️ Cỗ máy chém ➡️ Cống ngầm vượt ngục ➡️ Khu phi công Mỹ ➡️ Đài tưởng niệm.',
      'Tham quan theo nhóm / đoàn: Nên liên hệ đặt trước thuyết minh viên trực tiếp tại quầy vé hoặc thuê mỗi người một tai nghe Audioguide để có trải nghiệm trọn vẹn nhất.'
    ]
  }
};

const STOPWORDS = new Set([
  'nha', 'tu', 'hoa', 'lo', 'la', 'gi', 'o', 'va', 'cua', 'trong', 'co', 'duoc', 'cac',
  'nhung', 'nay', 'do', 'tai', 'sao', 'bao', 'nhieu', 'the', 'nao', 'khong', 'cho',
  'toi', 'biet', 'thac', 'mac', 'dung', 'ngay', 'truoc', 'phai', 'a', 'da', 'dang',
  've', 'voi', 'mot', 'hai', 'nhieu', 'nhu', 'khi', 'nao', 'ai', 'dau', 'chiec', 'cai',
  'che', 'tao', 'che tao', 'nhu the nao', 'ra sao', 'su', 'dung', 'lam', 'de', 'hoi', 'xem',
  'nam', 'vao', 'thang', 'ngay', 'con', 'thi', 'thi sao', 'the con', 'thoi'
]);

function parseCSV(content) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    
    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField);
      currentField = '';
      if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  
  if (rows.length === 0) return [];
  const headers = rows[0].map(h => h.trim().replace(/^\uFEFF/, ''));
  return rows.slice(1).filter(r => r.length >= headers.length).map(r => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] || '').trim();
    });
    return obj;
  });
}

class KnowledgeBase {
  constructor() {
    this.exhibits = HISTORICAL_EXHIBITS;
    this.groundTruth500 = [];
    this.groundTruthMap = new Map();
    this.invertedIndex500 = new Map();
    this.servicePolicies = [];
    this.servicePoliciesMap = new Map();
    
    // Kho 100 Facts xác thực từ 1.csv và 500 câu hỏi chuẩn từ 3.csv
    this.facts100 = [];
    this.facts100ByExactQ = new Map();
    this.facts100ByCoreQ = new Map();
    this.facts100BySeed = new Map();
    this.facts100InvertedIndex = new Map();

    // Kho tri thức mở rộng xác thực (Bẫy lịch sử, Song ngữ EN/VI, Lịch sử toàn diện, Giao thông, Tiện ích)
    this.expandedKnowledge = [];
    // Kho bổ trợ 1000 câu hỏi Hỏa Lò (đã lọc nhiễu)
    this.dataset1000 = [];
    this.invertedIndex1000 = new Map();

    // Kho tri thức tự nạp động: gói chuẩn dataset_hoa_lo_vi (14 phân khu + 1.000 Q&A + chuyện nhỏ + giải mã lầm tưởng)
    // và thư mục Plug-and-Play `kiemthu/data/custom/` (thả bất kỳ file .txt/.md/.json/.jsonl/.csv nào là tự nạp!)
    this.customDocs = [];
    this.zoneTones = new Map();
    this.customStats = { datasetHoaLoViDocs: 0, customDocs: 0, customFiles: [], zonesLoaded: 0, bySource: {} };
    this._customWatcherStarted = false;
    this._customFolderSig = '';
    this._onReloadCallbacks = [];

    this.load100VerifiedFacts();
    this.load500GroundTruth();
    this.loadVerifiedServiceKnowledge();
    this.loadExpandedKnowledge();
    this.loadDataset1000();
    this.loadDynamicKnowledge();
    this.localSemanticIndex = new LocalSemanticIndex();
    this.buildLocalSemanticIndex();
  }

  loadDynamicKnowledge() {
    try {
      const dataDir = path.join(__dirname, '..', 'data');
      const customDir = path.join(dataDir, 'custom');
      const loaded = loadDynamicKnowledgePacks(dataDir);
      this.customDocs = loaded.docs || [];
      this.zoneTones = loaded.zoneTones || new Map();
      this.customStats = loaded.stats || { datasetHoaLoViDocs: 0, customDocs: 0, customFiles: [], zonesLoaded: 0, bySource: {} };
      this._customFolderSig = computeFolderSignature(customDir);
      if (this.customDocs.length > 0) {
        console.log(`[KnowledgeBase] Đã nạp ${this.customStats.datasetHoaLoViDocs} tri thức chuẩn (dataset_hoa_lo_vi • ${this.customStats.zonesLoaded} phân khu) & ${this.customStats.customDocs} tri thức thả file custom/ (${this.customStats.customFiles.length} file).`);
      }
    } catch (e) {
      console.warn('[KnowledgeBase] Lỗi nạp dynamic knowledge packs:', e.message);
    }
  }

  reloadDynamicKnowledge() {
    const t0 = Date.now();
    this.loadDynamicKnowledge();
    this.buildLocalSemanticIndex();
    const summary = {
      reloadedMs: Date.now() - t0,
      totalSemanticDocs: this.localSemanticIndex?.docs?.length || 0,
      ...this.customStats
    };
    console.log(`🔄 [Auto-Brain Reload] Đã nạp nóng ${summary.totalSemanticDocs} tri thức (custom: ${summary.customDocs} mục từ ${summary.customFiles.length} file) trong ${summary.reloadedMs}ms!`);
    for (const cb of this._onReloadCallbacks) {
      try { cb(summary); } catch {}
    }
    return summary;
  }

  startCustomBrainWatcher(onReloaded = null) {
    if (typeof onReloaded === 'function' && !this._onReloadCallbacks.includes(onReloaded)) {
      this._onReloadCallbacks.push(onReloaded);
    }
    if (this._customWatcherStarted || process.env.NODE_ENV === 'test') return;
    this._customWatcherStarted = true;

    const customDir = path.join(__dirname, '..', 'data', 'custom');
    try {
      if (!fs.existsSync(customDir)) fs.mkdirSync(customDir, { recursive: true });
    } catch {}

    let debounceTimer = null;
    const triggerIfChanged = () => {
      try {
        const nextSig = computeFolderSignature(customDir);
        if (nextSig !== this._customFolderSig) {
          this.reloadDynamicKnowledge();
        }
      } catch (err) {
        console.warn('⚠ [Auto-Brain Watcher] Lỗi kiểm tra thư mục custom/:', err.message);
      }
    };

    try {
      const watcher = fs.watch(customDir, { recursive: false }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(triggerIfChanged, 800);
      });
      if (typeof watcher.unref === 'function') watcher.unref();
      watcher.on('error', () => {});
    } catch {}

    // Quét dấu vân tay nhẹ mỗi 12 giây (tốn <1ms) để hỗ trợ cả thư mục con sâu và upload qua SCP/WinSCP trên Linux VM!
    const pollTimer = setInterval(triggerIfChanged, 12000);
    if (typeof pollTimer.unref === 'function') pollTimer.unref();
  }

  findDynamicMatch(question, { language = 'vi', minScore = 0.56, onlyUserCustom = false } = {}) {
    if (!question || !this.localSemanticIndex || this.customDocs.length === 0) return null;
    const cleanQ = nlp.cleanVoiceSpokenInput(question) || question;
    const hits = this.localSemanticIndex.search(cleanQ, {
      lang: language,
      topK: 1,
      minScore,
      onlyDynamic: !onlyUserCustom,
      onlyUserCustom
    });
    return hits.length > 0 ? hits[0] : null;
  }

  buildLocalSemanticIndex() {
    const t0 = Date.now();
    this.localSemanticIndex = new LocalSemanticIndex();

    for (const item of this.facts100) {
      const ans = item.premium_answer || item.expected_answer;
      if (item.question && ans) {
        this.localSemanticIndex.addDocument({
          id: item.question_id || item.seed_id || 'F100',
          source: 'FACTS_100',
          question: item.question,
          answer: ans,
          lang: 'vi',
          intent: item.expected_intent || 'HISTORICAL_FACT',
          priorityBoost: 0.03
        });
      }
    }

    for (const item of this.groundTruth500) {
      const ans = item.reference_answer || item.verified_answer || item.ground_truth_summary || item.expected_answer;
      if (item.question && ans) {
        this.localSemanticIndex.addDocument({
          id: item.id || 'GT500',
          source: 'GROUND_TRUTH_500',
          question: item.question,
          answer: ans,
          lang: 'vi',
          intent: 'HISTORICAL_FACT',
          priorityBoost: 0.02
        });
      }
    }

    for (const item of this.dataset1000) {
      if (item.question && item.answer) {
        this.localSemanticIndex.addDocument({
          id: item.id,
          source: 'DATASET_1000',
          question: item.question,
          answer: item.answer,
          lang: 'vi',
          intent: 'HISTORICAL_FACT'
        });
      }
    }

    for (const ex of Object.values(HISTORICAL_EXHIBITS)) {
      if (ex.directAnswer) {
        this.localSemanticIndex.addDocument({
          id: `EX_${ex.id}`,
          source: 'EXHIBIT_DOSSIER',
          question: `${ex.name} ${(ex.keywords || []).slice(0, 6).join(' ')}`,
          answer: ex.directAnswer,
          lang: 'vi',
          intent: 'EXHIBIT_INFORMATION'
        });
      }
    }

    for (const d of this.customDocs) {
      if (d.question && d.answer) {
        this.localSemanticIndex.addDocument({
          id: d.id,
          source: d.source || 'CUSTOM_DROPIN',
          question: d.question,
          aliases: d.aliases || [],
          answer: d.answer,
          lang: d.lang || 'vi',
          intent: d.intent || 'HISTORICAL_FACT',
          priorityBoost: d.priorityBoost || 0.04,
          zoneId: d.zoneId || null,
          zoneName: d.zoneName || null,
          toneLevel: d.toneLevel || null,
          topic: d.topic || null,
          fileLabel: d.fileLabel || null,
          isDynamic: true,
          isUserCustom: Boolean(d.isUserCustom)
        });
      }
    }

    this.localSemanticIndex.rebuildIdf();
    console.log(`[LocalSemanticIndex] Đã dựng chỉ mục vector ngữ nghĩa cho ${this.localSemanticIndex.docs.length} tri thức cục bộ (${Date.now() - t0}ms).`);
  }

  findSemanticLocalMatch(question, { language = 'vi', stationCode = null, minScore = 0.68 } = {}) {
    if (!question || !this.localSemanticIndex) return null;
    const cleanQ = nlp.cleanVoiceSpokenInput(question) || question;
    const hits = this.localSemanticIndex.search(cleanQ, {
      lang: language,
      stationCode,
      topK: 1,
      minScore
    });
    return hits.length > 0 ? hits[0] : null;
  }

  _endSemanticPlaceholder() {
  }

  loadExpandedKnowledge() {
    try {
      const file = path.join(__dirname, '..', 'data', 'expanded_heritage_knowledge.json');
      if (fs.existsSync(file)) {
        const items = JSON.parse(fs.readFileSync(file, 'utf8'));
        this.expandedKnowledge = Array.isArray(items)
          ? items.sort((a, b) => (b.priority || 0) - (a.priority || 0))
          : [];
        console.log(`[KnowledgeBase] Đã nạp ${this.expandedKnowledge.length} cụm tri thức mở rộng & Fact-Check Traps.`);
      }
    } catch (e) {
      console.warn('[KnowledgeBase] Lỗi nạp expanded_heritage_knowledge.json:', e.message);
    }
  }

  loadDataset1000() {
    try {
      const file = path.join(__dirname, '..', 'data', '1000_cau_hoi_hoa_lo.json');
      if (!fs.existsSync(file)) return;
      const items = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!Array.isArray(items)) return;

      this.dataset1000 = items.map((item, idx) => {
        let summary = item.ground_truth_summary || '';
        // Lọc lỗi lịch sử cũ nếu summary nhầm Hoàng Văn Thụ vào danh sách máy chém
        if (/hoàng văn thụ/i.test(summary) && /máy chém/i.test(summary) && !/xử bắn/i.test(summary)) {
          summary = summary.replace(/,\s*Hoàng Văn Thụ\s*\(1944\)/gi, '');
        }
        const normQ = nlp.normalize(item.question || '');
        const tokens = nlp.tokenize(item.question || '').filter(t => t.length > 2 && !STOPWORDS.has(t));
        tokens.forEach(t => {
          if (!this.invertedIndex1000.has(t)) this.invertedIndex1000.set(t, []);
          this.invertedIndex1000.get(t).push(idx);
        });
        return {
          id: `D1000_${item.id || idx}`,
          category: item.category || '',
          target_poi: item.target_poi || '',
          question: item.question || '',
          answer: summary,
          normQ,
          tokens: new Set(tokens)
        };
      }).filter(x => x.answer && x.answer.length > 20);
      console.log(`[KnowledgeBase] Đã nạp bổ sung ${this.dataset1000.length} câu hỏi-đáp từ 1000_cau_hoi_hoa_lo.json.`);
    } catch (e) {
      console.warn('[KnowledgeBase] Lỗi nạp 1000_cau_hoi_hoa_lo.json:', e.message);
    }
  }

  /**
   * Tra cứu kho tri thức mở rộng & Fact-Check Traps (đã có bảo vệ dấu tiếng Việt + Discourse Gate + lọc Category!)
   */
  findExpandedMatch(question, language = 'vi', minPriority = 0, options = {}) {
    if (!question || !this.expandedKnowledge.length) return null;
    const { hasVietnameseDiacritics, hasRawPhrase, analyzeDiscourseMode } = require('./semantic_router');
    const norm = ' ' + nlp.normalize(question) + ' ';
    const hasPhraseLocal = (kw) => {
      const clean = nlp.normalize(kw);
      return clean ? norm.includes(' ' + clean + ' ') : false;
    };
    const hasAccents = hasVietnameseDiacritics(question);
    const discourse = options.discourse || analyzeDiscourseMode(question, norm);
    const excludeCategories = new Set(options.excludeCategories || []);

    for (const item of this.expandedKnowledge) {
      if ((item.priority || 0) < minPriority) continue;
      if (excludeCategories.size > 0 && excludeCategories.has(item.category)) continue;

      // Nguyên lý 2: Không để các mẫu dịch vụ / nội quy / giờ mở cửa cướp luồng câu hỏi diễn ngôn lịch sử!
      const isOpsItem = ['SERVICE', 'CSKH', 'REGULATION', 'EN_SERVICE', 'EMPATHY'].includes(item.category) ||
        item.id === 'EXP_TRAP_LUNCH_CLOSED' || item.id === 'EXP_TRAP_CHILD_TICKET';
      if (isOpsItem && discourse.isHistoricalDiscourse) continue;

      // Nguyên lý 1: Bảo vệ đồng âm "đóng cửa" ≠ "động của" trong EXP_TRAP_LUNCH_CLOSED và "trống đồng" ≠ "trong dòng" trong EXP_BLE_001_TRONG_DONG!
      const { matchAccentConsistentPhrase } = require('./semantic_router');
      if (item.id === 'EXP_TRAP_LUNCH_CLOSED') {
        const hasRealHoursPhrase = ['đóng cửa', 'mở cửa', 'nghỉ trưa', 'xuyên trưa', 'mấy giờ', 'mấy h', 'trưa', 'lunch', 'open'].some(p => matchAccentConsistentPhrase(question, p));
        if (!hasRealHoursPhrase) continue;
      }
      if (item.id === 'EXP_BLE_001_TRONG_DONG') {
        const hasRealDrumPhrase = ['trống đồng', 'đông sơn', 'chim lạc', 'ngôi sao 14 cánh', 'bronze drum', 'dong son drum', 'mã 001', 'số 001'].some(p => matchAccentConsistentPhrase(question, p));
        if (!hasRealDrumPhrase) continue;
      }

      // Bảo vệ so sánh hiện vật (VD: so sánh máy chém Hỏa Lò với máy chém ở TP.HCM không phải hiểu nhầm địa chỉ Hỏa Lò!)
      if (item.id === 'EXP_TRAP_ADDR_HCM' && (hasPhraseLocal('so sanh') || hasPhraseLocal('may chem') || hasPhraseLocal('bao tang'))) {
        continue;
      }

      const allGroups = item.mustMatchAll || [];
      const allOk = allGroups.every(group =>
        Array.isArray(group) ? group.some(kw => hasPhraseLocal(kw)) : hasPhraseLocal(group)
      );
      if (!allOk) continue;

      const anyList = item.mustMatchAny || [];
      const anyOk = anyList.length === 0 || anyList.some(kw => hasPhraseLocal(kw));
      if (!anyOk) continue;

      const notList = item.mustNotMatchAny || [];
      if (notList.length > 0 && notList.some(kw => hasPhraseLocal(kw))) continue;

      const reply = (language === 'en' && item.answer_en) ? item.answer_en : item.answer_vi;
      return {
        id: item.id,
        category: item.category,
        priority: item.priority || 80,
        reply
      };
    }
    return null;
  }

  /**
   * Tra cứu bổ trợ từ kho 1000 câu hỏi Hỏa Lò (chỉ chạy khi các tầng trên chưa khớp)
   */
  findDataset1000Match(question) {
    if (!question || !this.dataset1000.length) return null;
    const norm = nlp.normalize(question);
    if (!this.hasHistoricalEntity(norm)) return null;

    const tokens = nlp.tokenize(question).filter(t => t.length > 2 && !STOPWORDS.has(t));
    if (tokens.length < 3) return null;

    const scores = new Map();
    tokens.forEach(t => {
      const list = this.invertedIndex1000.get(t);
      if (list) {
        const idf = Math.log(1 + this.dataset1000.length / list.length);
        list.forEach(idx => scores.set(idx, (scores.get(idx) || 0) + idf));
      }
    });

    let bestIdx = -1;
    let bestScore = 0;
    for (const [idx, sc] of scores.entries()) {
      if (sc > bestScore) {
        bestScore = sc;
        bestIdx = idx;
      }
    }

    if (bestIdx >= 0 && bestScore >= 4.0) {
      const item = this.dataset1000[bestIdx];
      let intersect = 0;
      tokens.forEach(t => { if (item.tokens.has(t)) intersect++; });
      const ratio = intersect / tokens.length;
      if (ratio >= 0.55 && intersect >= 3) {
        return { item, score: bestScore, ratio };
      }
    }
    return null;
  }

  /**
   * Xác định Intent tinh gọn cho từng Fact trong 100 Facts xác thực (20+ Fine-Grained Intents V6.2)
   */
  determineFactIntent(seedId, category, question) {
    if (seedId === 'F079') return 'OPENING_HOURS';
    if (seedId === 'F080') return 'TICKET_INFORMATION';
    if (seedId === 'F064') return 'AUDIO_GUIDE_SUPPORT';
    if (['F066', 'F067', 'F068'].includes(seedId)) return 'TOUR_INFORMATION';
    if (['F077', 'F078'].includes(seedId)) return 'EXHIBITION_INFORMATION';
    if (seedId === 'F069') return 'TOUR_RECOMMENDATION';
    if (['F001', 'F081'].includes(seedId)) return 'CONTACT_INFORMATION';
    if (['F070', 'F071', 'F072', 'F073'].includes(seedId)) return 'FACILITY_INFORMATION';
    if (seedId === 'F100') return 'VISIT_GUIDANCE';
    if (['F025', 'F026', 'F027', 'F028', 'F029', 'F030', 'F031', 'F032', 'F033', 'F034', 'F038', 'F039', 'F040', 'F041', 'F042', 'F043', 'F074', 'F075', 'F076', 'F089', 'F090', 'F099'].includes(seedId)) {
      return 'EXHIBIT_INFORMATION';
    }
    if (['F007', 'F008', 'F009', 'F010', 'F011', 'F012', 'F013', 'F014', 'F015', 'F017', 'F023', 'F065', 'F093', 'F097'].includes(seedId)) {
      return 'EXHIBITION_INFORMATION';
    }
    if (['F004', 'F005', 'F024', 'F083', 'F084', 'F085', 'F086', 'F088', 'F091', 'F094', 'F096', 'F098'].includes(seedId)) {
      return 'HISTORICAL_EXPLANATION';
    }
    return 'HISTORICAL_FACT';
  }

  /**
   * Hiệu chuẩn độ tin cậy (Confidence Calibration) dựa trên tính nhất quán của nguồn và độ hoàn chỉnh dữ liệu V6.2.1
   */
  determineFactConfidence(seedId, keyPoints = '', rubric = '') {
    const kp = (keyPoints || '').toLowerCase();
    const caveatKeywords = [
      'thay đổi', 'snapshot', 'khác nhau', 'phục chế', 'giai đoạn', 'thời điểm',
      'sai khác', 'mâu thuẫn', 'tại thời điểm', 'chưa thống nhất', 'tái dựng',
      'không phải tổng kiểm kê'
    ];
    const mediumSeeds = ['F080', 'F081', 'F100', 'F083', 'F086', 'F071', 'F072', 'F076', 'F077', 'F070', 'F040', 'F056', 'F079', 'F087', 'F088'];
    const hasCaveat = caveatKeywords.some(w => kp.includes(w));
    
    if (hasCaveat || mediumSeeds.includes(seedId)) {
      return {
        level: 'MEDIUM',
        score: 0.85,
        reason: 'Dữ liệu có sắc thái thời điểm, số liệu giai đoạn hoặc sự khác biệt cần đối chiếu giữa các nguồn'
      };
    }
    
    return {
      level: 'HIGH',
      score: 0.98,
      reason: 'Dữ kiện lịch sử được xác thực nhất quán từ nguồn chính thức'
    };
  }

  /**
   * Biên soạn phản hồi thích ứng chuẩn Hướng dẫn viên bảo tàng (Docent Rewriter Engine v6.3)
   * TUYỆT ĐỐI BẢO TOÀN DỮ KIỆN NGUYÊN TỬ (Atomic Fact Preservation):
   * Không thay đổi bất kỳ con số, độ tuổi, tên riêng, ngày tháng, giá vé, số điện thoại hay điều kiện miễn giảm nào.
   */
  getAdaptiveFactAnswer(seedId, variant, expectedAnswer, keyPoints, question, category = '') {
    return docentRewriter.generateAnswer({
      seedId,
      variant,
      question,
      expectedAnswer,
      keyPoints,
      category
    });
  }

  /**
   * Nạp 100 Facts xác thực từ 1.csv và 500 câu hỏi từ 3.csv
   */
  load100VerifiedFacts() {
    try {
      const p1Candidates = [
        path.join(__dirname, '..', 'data', '1.csv'),
        path.join(__dirname, '..', 'data', '2.csv'),
        path.join(__dirname, '..', 'data', 'HoaLo_Manual_Grading.csv')
      ];
      let p1 = p1Candidates.find(p => {
        if (!fs.existsSync(p)) return false;
        try {
          const sample = fs.readFileSync(p, 'utf8').slice(0, 1000);
          return sample.includes('question_id') && sample.includes('expected_answer');
        } catch { return false; }
      });
      const p3 = path.join(__dirname, '..', 'data', '3.csv');
      if (!p1 || !fs.existsSync(p3)) {
        console.warn('[KnowledgeBase] Không tìm thấy file dữ liệu 100 Facts (1.csv/2.csv) hoặc 3.csv trong data/');
        return;
      }

      const f1List = parseCSV(fs.readFileSync(p1, 'utf8'));
      const f3List = parseCSV(fs.readFileSync(p3, 'utf8'));

      const f1Map = new Map();
      f1List.forEach(item => {
        f1Map.set(item.question_id, item);
      });

      f3List.forEach((r3, idx) => {
        const r1 = f1Map.get(r3.question_id) || {};
        const unwrap = nlp.unwrapMetaQuery(r3.question);
        const seedId = r3.seed_id || r1.seed_id;
        const vNum = parseInt(r3.variant, 10) || 1;
        const keyPoints = r1.key_points || '';
        const rubric = r1.rubric || '';
        const expectedAnswer = r1.expected_answer || '';
        const expectedIntent = this.determineFactIntent(seedId, r3.category, r3.question);
        const premiumAnswer = this.getAdaptiveFactAnswer(seedId, vNum, expectedAnswer, keyPoints, r3.question, r3.category);
        const confObj = this.determineFactConfidence(seedId, keyPoints, rubric);

        const item = {
          question_id: r3.question_id,
          seed_id: seedId,
          variant: vNum,
          category: r3.category,
          difficulty: r3.difficulty,
          question: r3.question,
          coreQuestion: unwrap.coreQuery,
          expected_answer: expectedAnswer,
          premium_answer: premiumAnswer,
          expected_intent: expectedIntent,
          confidence: confObj.level,
          confidenceScore: confObj.score,
          key_points: keyPoints,
          rubric: rubric,
          source_ids: r1.source_ids || '',
          source_urls: r1.source_urls || '',
          knowledge_id: r3.knowledge_id,
          answerability: r3.answerability || r1.answerability || 'Có'
        };

        this.facts100.push(item);

        // Exact full question mapping
        const normQ = nlp.normalize(item.question);
        this.facts100ByExactQ.set(normQ, item);

        // Exact core question mapping
        const normCore = nlp.normalize(item.coreQuestion);
        if (!this.facts100ByCoreQ.has(normCore)) {
          this.facts100ByCoreQ.set(normCore, item);
        }

        // Seed mapping
        if (!this.facts100BySeed.has(item.seed_id)) {
          this.facts100BySeed.set(item.seed_id, item);
        }

        // Token inverted index for retrieval on partial queries
        const tokens = nlp.tokenize(item.coreQuestion + ' ' + (item.key_points || ''));
        tokens.forEach(t => {
          if (t.length > 2 && !STOPWORDS.has(t)) {
            if (!this.facts100InvertedIndex.has(t)) {
              this.facts100InvertedIndex.set(t, []);
            }
            this.facts100InvertedIndex.get(t).push(idx);
          }
        });
      });

      console.log(`[KnowledgeBase] Đã nạp thành công ${this.facts100.length} câu hỏi và 100 Facts chuẩn xác từ 1.csv và 3.csv.`);
    } catch (e) {
      console.warn('[KnowledgeBase] Lỗi khi nạp 100 facts:', e.message);
    }
  }

  loadVerifiedServiceKnowledge() {
    try {
      const file = path.join(__dirname, '..', 'data', 'verified_service_knowledge.json');
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf8');
        const parsed = JSON.parse(raw);
        this.servicePolicies = parsed.policies || [];
        this.servicePolicies.forEach(p => {
          this.servicePoliciesMap.set(p.id, p);
        });
      }
    } catch (e) {
      console.warn('[KnowledgeBase] Không nạp được verified_service_knowledge.json:', e.message);
    }
  }

  /**
   * Tìm kiếm chính sách dịch vụ đã xác thực (Verified Service Knowledge)
   */
  findServicePolicy(query, intent) {
    if (!this.servicePolicies.length) return null;
    const norm = ' ' + nlp.normalize(query) + ' ';

    // 1. Kiểm tra chính sách cũ / hết hạn (EXPIRED)
    if (norm.includes('30 000') || norm.includes('30k') || norm.includes('gia ve cu') || norm.includes('truoc 2016') || norm.includes('2016')) {
      const expiredPolicy = this.servicePoliciesMap.get('POLICY_HISTORICAL_EXPIRED_2016');
      if (expiredPolicy) {
        return {
          policy: expiredPolicy,
          isExpired: true,
          matchScore: 10
        };
      }
    }

    // 2. Kiểm tra các trường hợp đặc thù theo từ khóa
    let targetId = null;
    if (norm.includes('hoan tien') || norm.includes('tra ve') || norm.includes('doi ve') || norm.includes('refund')) {
      targetId = 'POLICY_REFUND_EXCHANGE';
    } else if (norm.includes('lac con') || norm.includes('lac tre') || norm.includes('tim be') || norm.includes('tim con') || norm.includes('lac chau')) {
      targetId = 'POLICY_LOST_CHILD_URGENT';
    } else if (norm.includes('so cuu') || norm.includes('cap cuu') || norm.includes('y te') || norm.includes('ngat') || norm.includes('chong mat')) {
      targetId = 'POLICY_FIRST_AID_MEDICAL';
    } else if (norm.includes('mat do') || norm.includes('that lac') || norm.includes('roi vi') || norm.includes('quen do') || norm.includes('lost') || norm.includes('camera')) {
      targetId = 'POLICY_LOST_AND_FOUND';
    } else if (norm.includes('tai nghe') || norm.includes('audioguide') || norm.includes('bi re') || norm.includes('re mot ben') || norm.includes('hong tai nghe')) {
      targetId = 'POLICY_AUDIOGUIDE_DEVICE';
    } else if (norm.includes('xe lan') || norm.includes('khuyet tat') || norm.includes('bac tam cap') || norm.includes('nguoi gia')) {
      targetId = 'POLICY_ACCESSIBILITY_WHEELCHAIR';
    } else if (norm.includes('xe day') || norm.includes('em be') || norm.includes('tre nho') || norm.includes('tre em')) {
      targetId = 'POLICY_CHILDREN_SAFETY';
    } else if (norm.includes('tour dem') || norm.includes('dem thieng lieng')) {
      targetId = (norm.includes('gio') || norm.includes('lich') || norm.includes('may gio')) ? 'POLICY_HOURS_NIGHT_TOUR' : 'POLICY_TICKET_NIGHT_TOUR';
    } else if (norm.includes('qua dong') || norm.includes('chen chuc') || norm.includes('on ao') || norm.includes('ngot ngat')) {
      targetId = 'POLICY_OVERCROWDING_MANAGEMENT';
    } else if (norm.includes('thai do') || norm.includes('nhan vien') || norm.includes('phan anh') || norm.includes('khieu nai') || norm.includes('gop y') || norm.includes('so gop y')) {
      targetId = 'POLICY_COMPLAINTS_HANDLING';
    } else if (norm.includes('gio mo') || norm.includes('dong cua') || norm.includes('nghi trua') || norm.includes('tet') || norm.includes('ngay le')) {
      targetId = 'POLICY_HOURS_DAYTIME';
    } else if (norm.includes('gia ve') || norm.includes('ve vao') || norm.includes('sinh vien') || norm.includes('hoc sinh') || norm.includes('hssv') || norm.includes('bao nhieu tien')) {
      targetId = 'POLICY_TICKET_DAYTIME';
    } else if (norm.includes('gui do') || norm.includes('balo') || norm.includes('ve sinh') || norm.includes('toilet') || norm.includes('wc')) {
      targetId = 'POLICY_FACILITY_STORAGE_WC';
    }

    if (targetId && this.servicePoliciesMap.has(targetId)) {
      return {
        policy: this.servicePoliciesMap.get(targetId),
        isExpired: false,
        matchScore: 9
      };
    }

    // 3. Fallback theo danh mục ý định
    if (intent === 'TICKET_INFORMATION') {
      return { policy: this.servicePoliciesMap.get('POLICY_TICKET_DAYTIME'), isExpired: false, matchScore: 5 };
    }
    if (intent === 'OPENING_HOURS') {
      return { policy: this.servicePoliciesMap.get('POLICY_HOURS_DAYTIME'), isExpired: false, matchScore: 5 };
    }
    if (intent === 'ACCESSIBILITY_SUPPORT') {
      return { policy: this.servicePoliciesMap.get('POLICY_ACCESSIBILITY_WHEELCHAIR'), isExpired: false, matchScore: 5 };
    }
    if (intent === 'FACILITY_SUPPORT') {
      return { policy: this.servicePoliciesMap.get('POLICY_FACILITY_STORAGE_WC'), isExpired: false, matchScore: 5 };
    }
    if (intent === 'CUSTOMER_COMPLAINT') {
      return { policy: this.servicePoliciesMap.get('POLICY_COMPLAINTS_HANDLING'), isExpired: false, matchScore: 5 };
    }
    if (intent === 'CUSTOMER_ASSISTANCE') {
      return { policy: this.servicePoliciesMap.get('POLICY_LOST_AND_FOUND'), isExpired: false, matchScore: 5 };
    }

    return null;
  }

  load500GroundTruth() {
    try {
      const file = path.join(__dirname, '..', 'data', '500_cau_hoi_chuan_lich_su.json');
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf8');
        const items = JSON.parse(raw);
        this.groundTruth500 = items.map((item, idx) => {
          const normQ = nlp.normalize(item.question);
          const tokens = nlp.tokenize(item.question);
          this.groundTruthMap.set(normQ, item);

          tokens.forEach(t => {
            if (t.length > 2 && !STOPWORDS.has(t)) {
              if (!this.invertedIndex500.has(t)) this.invertedIndex500.set(t, []);
              this.invertedIndex500.get(t).push(idx);
            }
          });

          return {
            ...item,
            normQ,
            tokens: new Set(tokens)
          };
        });
      }
    } catch (e) {
      console.warn('[KnowledgeBase] Không nạp được 500 ground truth:', e.message);
    }
  }

  hasHistoricalEntity(norm) {
    if (!norm) return false;
    const normSpaced = ' ' + norm + ' ';
    const entities = [
      'may chem', 'guillotine', 'cay bang', 'la bang', 'hat bang',
      'cong ngam', 'vuot nguc', 'phi cong', 'mccain', 'peterson', 'hanoi hilton',
      'cum chan', 'be cum', 'cum sat', 'thanh go cum', 'cachot', 'nguc toi',
      'xa lim', 'tu hinh', 'hoang van thu', 'nguyen thai hoc', 'nguyen duc canh',
      'phan boi chau', 'maison centrale', 'phu khanh', 'lang phu khanh',
      'de lao', 'rue rollandes', 'dem thieng lieng', 'trai nu', 'trai e', 'trai g',
      'truong thi my', 'nguyen thi minh khai', 'tran tu binh', 'le lien',
      'phu dieu', 'dai tuong niem', 'dai hong chung', 'chua ba da',
      '1896', '1899', '1945', '1951', '1954', '1964', '1973',
      'tu tu', 'tu chinh tri', 'song sat', 'so mat tham', 'giam nguc',
      'thung ve sinh', 'lap la', 'bat sat', 'que dan', 'so dang ky', 'ton do'
    ];
    return entities.some(e => normSpaced.includes(' ' + e + ' ') || norm.includes(e));
  }

  /**
   * Tìm kiếm trong kho tri thức xác thực (Ưu tiên tuyệt đối 100 Facts từ 1.csv/3.csv, fallback 500 ground truth)
   */
  findGroundTruthMatch(question) {
    if (!question || typeof question !== 'string') return null;
    const norm = nlp.normalize(question);
    const unwrap = nlp.unwrapMetaQuery(question);
    const normCore = nlp.normalize(unwrap.coreQuery);
    // Chỉ xét thực thể trên câu hỏi lõi (normCore) để tránh tiền tố vị trí Beacon gây bắt nhầm chủ đề
    const hasEntity = this.hasHistoricalEntity(normCore);

    // =========================================================================
    // 1. TÌM KIẾM TRONG KHO 100 FACTS XÁC THỰC (1.csv & 3.csv)
    // =========================================================================
    if (this.facts100.length > 0) {
      // 1.1. Exact match toàn bộ chuỗi câu hỏi (bao gồm tất cả các câu trong 3.csv)
      if (this.facts100ByExactQ.has(norm)) {
        const item = this.facts100ByExactQ.get(norm);
        return { item, score: 1.0, type: 'EXACT', isFact100: true, requiresConflictCheck: unwrap.requiresConflictCheck };
      }

      // 1.2. Exact match câu hỏi lõi (core query sau khi bóc tách meta-prompt)
      if (this.facts100ByCoreQ.has(normCore)) {
        const item = this.facts100ByCoreQ.get(normCore);
        return { item, score: 0.99, type: 'EXACT', isFact100: true, requiresConflictCheck: unwrap.requiresConflictCheck };
      }
      if (this.facts100ByExactQ.has(normCore)) {
        const item = this.facts100ByExactQ.get(normCore);
        return { item, score: 0.99, type: 'EXACT', isFact100: true, requiresConflictCheck: unwrap.requiresConflictCheck };
      }

      // 1.25. Entity & Key Phrase Guided Retrieval (chỉ áp dụng cho câu hỏi trực diện/ngắn, KHÔNG đè câu hỏi phân tích sâu dài!)
      const qNormSpaced = ' ' + normCore + ' ';
      const coreWordCount = normCore ? normCore.split(' ').filter(Boolean).length : 0;
      if (qNormSpaced.includes(' nguyen duc canh ') && coreWordCount <= 16) {
        const item = this.facts100BySeed.get('F037') || this.facts100BySeed.get('F094');
        if (item) return { item, score: 0.98, type: 'SEMANTIC_FACT', isFact100: true };
      }
      if (qNormSpaced.includes(' nguyen hoang ton ') || (coreWordCount <= 16 && qNormSpaced.includes(' chem ') && (qNormSpaced.includes(' cong chinh ') || qNormSpaced.includes(' truoc cong ')))) {
        const item = this.facts100BySeed.get('F036');
        if (item) return { item, score: 0.98, type: 'SEMANTIC_FACT', isFact100: true };
      }
      if ((qNormSpaced.includes(' tau thuoc ') || qNormSpaced.includes(' tau hut thuoc ')) && coreWordCount <= 14) {
        const item = this.facts100BySeed.get('F040');
        if (item) return { item, score: 0.98, type: 'SEMANTIC_FACT', isFact100: true };
      }
      if (qNormSpaced.includes(' tran tu binh ') && coreWordCount <= 16 && (qNormSpaced.includes(' vuot nguc ') || qNormSpaced.includes(' 1945 ') || qNormSpaced.includes(' cach nao '))) {
        const item = this.facts100BySeed.get('F050') || this.facts100BySeed.get('F051');
        if (item) return { item, score: 0.98, type: 'SEMANTIC_FACT', isFact100: true };
      }
      if (qNormSpaced.includes(' may chem ') && coreWordCount <= 14 && (qNormSpaced.includes(' cao bao nhieu ') || qNormSpaced.includes(' cau tao ') || qNormSpaced.includes(' kich thuoc '))) {
        const item = this.facts100BySeed.get('F033');
        if (item) return { item, score: 0.98, type: 'SEMANTIC_FACT', isFact100: true };
      }
      // Chỉ trả lời tóm tắt F023 cho câu hỏi định nghĩa ngắn về Cachot (tránh lặp 24 lần cho mọi câu hỏi chuyên sâu về Cachot!)
      if ((qNormSpaced.includes(' cachot ') || qNormSpaced.includes(' nguc toi ')) &&
          (coreWordCount <= 10 || qNormSpaced.includes(' cachot la gi ') || qNormSpaced.includes(' nguc toi la gi ') || qNormSpaced.includes(' gioi thieu cachot '))) {
        const item = this.facts100BySeed.get('F023');
        if (item) return { item, score: 0.98, type: 'SEMANTIC_FACT', isFact100: true };
      }
      if ((qNormSpaced.includes(' tai sao ') || qNormSpaced.includes(' vi sao ') || qNormSpaced.includes(' nguon goc ')) && (qNormSpaced.includes(' goi la ') || qNormSpaced.includes(' ten ')) && qNormSpaced.includes(' hoa lo ')) {
        const item = this.facts100BySeed.get('F005') || this.groundTruth500.find(x => x.id === 'HL-001');
        if (item) return { item, score: 0.98, type: 'SEMANTIC_FACT', isFact100: !!item.seed_id };
      }
      if (coreWordCount <= 16 && (qNormSpaced.includes(' manh thuy tinh ') || qNormSpaced.includes(' manh sanh ') || qNormSpaced.includes(' thuy tinh ')) && qNormSpaced.includes(' tuong ')) {
        const item = this.groundTruth500.find(x => x.id === 'HL-008');
        if (item) return { item, score: 0.97, type: 'SEMANTIC', isFact100: false };
      }
      if (coreWordCount <= 16 && (qNormSpaced.includes(' kien truc su ') || (qNormSpaced.includes(' ai ') && qNormSpaced.includes(' thiet ke ') && (qNormSpaced.includes(' nha tu ') || qNormSpaced.includes(' hoa lo '))))) {
        const item = this.groundTruth500.find(x => x.id === 'HL-034');
        if (item) return { item, score: 0.97, type: 'SEMANTIC', isFact100: false };
      }
      // Disambiguation: Vượt ngục đêm Noel 24/12/1951 (chỉ cho câu tóm tắt/ngắn, không đè câu hỏi chi tiết sâu!)
      if (coreWordCount <= 16 && (qNormSpaced.includes(' 1951 ') || qNormSpaced.includes(' noel ')) && (qNormSpaced.includes(' vuot nguc ') || qNormSpaced.includes(' cong ngam ') || qNormSpaced.includes(' tu tu '))) {
        return {
          item: {
            seed_id: 'F_NOEL_1951',
            expected_answer: HISTORICAL_EXHIBITS.cong_ngam.directAnswer,
            premium_answer: 'Đêm Noel 24/12/1951, 16 tử tù chính trị tại Nhà tù Hỏa Lò đã bí mật cưa song sắt đường cống ngầm để vượt ngục thoát ra phố Thợ Nhuộm (khu vực Quán Sứ); trong đó có 5 đồng chí thoát ra vùng tự do kháng chiến an toàn, 11 đồng chí không may bị địch truy bắt lại.'
          },
          score: 0.98,
          type: 'SEMANTIC_FACT',
          isFact100: true
        };
      }
      // Disambiguation: Nguyễn Thái Học bị đưa lên Yên Bái hành quyết ngày 17/6/1930
      if (coreWordCount <= 16 && qNormSpaced.includes(' nguyen thai hoc ') && (qNormSpaced.includes(' 1930 ') || qNormSpaced.includes(' dua len dau ') || qNormSpaced.includes(' hanh quyet ') || qNormSpaced.includes(' o dau '))) {
        return {
          item: {
            seed_id: 'F_NGUYEN_THAI_HOC_1930',
            expected_answer: 'Sáng ngày 17/6/1930, thực dân Pháp đã đưa nhà yêu nước Nguyễn Thái Học cùng 12 nghĩa sĩ khởi nghĩa Yên Bái cùng cỗ máy chém từ Hỏa Lò lên thị xã Yên Bái để hành quyết, không phải hành quyết tại Hỏa Lò.',
            premium_answer: 'Sáng ngày 17/6/1930, thực dân Pháp đã đưa nhà yêu nước Nguyễn Thái Học cùng 12 nghĩa sĩ khởi nghĩa Yên Bái lên thị xã Yên Bái để hành quyết bằng cỗ máy chém lưu động, không phải hành quyết tại Hỏa Lò.'
          },
          score: 0.98,
          type: 'SEMANTIC_FACT',
          isFact100: true
        };
      }
      // Disambiguation: Công dụng cây bàng với tù nhân chính trị (cho câu hỏi ngắn/tổng quát <= 18 từ)
      if (coreWordCount <= 18 && qNormSpaced.includes(' cay bang ') && (qNormSpaced.includes(' giup ich ') || qNormSpaced.includes(' cong dung ') || qNormSpaced.includes(' dung de lam gi ') || qNormSpaced.includes(' tu nhan '))) {
        return {
          item: {
            seed_id: 'F_CAY_BANG_USES',
            expected_answer: HISTORICAL_EXHIBITS.cay_bang.directAnswer,
            premium_answer: 'Cây bàng cổ thụ ngoài sân trại giam là người bạn tri kỷ của các tù nhân chính trị: lá và búp bàng non dùng chữa kiết lỵ, tiêu chảy; vỏ bàng sắc rửa vết thương; cành bàng mài làm quản bút viết báo bí mật; còn nhân hạt bàng bồi dưỡng cho đồng chí ốm nặng.'
          },
          score: 0.97,
          type: 'SEMANTIC_FACT',
          isFact100: true
        };
      }
      // Disambiguation: Đặc sản từ cây bàng trong Tour đêm (trà bàng, thạch bàng)
      if ((qNormSpaced.includes(' cay bang ') || qNormSpaced.includes(' la bang ')) && (qNormSpaced.includes(' dac san ') || qNormSpaced.includes(' thuong thuc ') || qNormSpaced.includes(' mon ') || qNormSpaced.includes(' tra bang ') || qNormSpaced.includes(' thach bang '))) {
        return {
          item: {
            seed_id: 'F_TOUR_DEM_BANG_FOOD',
            expected_answer: 'Trong chương trình trải nghiệm Tour đêm "Đêm thiêng liêng" tại Di tích Nhà tù Hỏa Lò, du khách được thưởng thức các món đặc sản tri ân từ cây bàng như trà bàng, thạch bàng và bánh lá bàng.',
            premium_answer: 'Trong tour đêm "Đêm thiêng liêng" tại Di tích Nhà tù Hỏa Lò, du khách được thưởng thức các món đặc sản tri ân từ cây bàng như trà bàng và thạch bàng.'
          },
          score: 0.98,
          type: 'SEMANTIC_FACT',
          isFact100: true
        };
      }
      // Disambiguation: Lịch diễn ra Tour đêm Đêm thiêng liêng (Thứ 6, Thứ 7, Chủ Nhật 19:00)
      if ((qNormSpaced.includes(' tour dem ') || qNormSpaced.includes(' dem thieng lieng ')) && (qNormSpaced.includes(' toi nao ') || qNormSpaced.includes(' thu may ') || qNormSpaced.includes(' ngay nao ') || qNormSpaced.includes(' lich '))) {
        return {
          item: {
            seed_id: 'F_TOUR_DEM_SCHEDULE',
            expected_answer: 'Chương trình trải nghiệm Tour đêm "Đêm thiêng liêng" tại Di tích Nhà tù Hỏa Lò thường diễn ra vào 19:00 các tối Thứ Sáu, Thứ Bảy và Chủ Nhật hàng tuần (cần đặt vé trước qua fanpage/hotline chính thức do số lượng chỗ có hạn).',
            premium_answer: 'Tour đêm "Đêm thiêng liêng" tại Di tích Nhà tù Hỏa Lò diễn ra vào lúc 19:00 các tối Thứ Sáu, Thứ Bảy và Chủ Nhật hàng tuần (du khách cần đặt vé trước qua fanpage hoặc hotline chính thức của di tích).'
          },
          score: 0.98,
          type: 'SEMANTIC_FACT',
          isFact100: true
        };
      }
      // Disambiguation: Chuyên đề "Bàng ơi" đã kết thúc ngày 31/12/2024
      if (qNormSpaced.includes(' bang oi ')) {
        return {
          item: {
            seed_id: 'F_EXHIBITION_BANG_OI',
            expected_answer: 'Trưng bày chuyên đề "Bàng ơi" tại Di tích Nhà tù Hỏa Lò đã chính thức kết thúc vào ngày 31/12/2024 và hiện không còn mở cửa đón khách tham quan chuyên đề này.',
            premium_answer: 'Trưng bày chuyên đề "Bàng ơi" tại Di tích Nhà tù Hỏa Lò đã kết thúc vào ngày 31/12/2024 nên hiện nay không còn mở cửa nữa.'
          },
          score: 0.99,
          type: 'SEMANTIC_FACT',
          isFact100: true
        };
      }
      // Disambiguation: Ăn lá bàng chữa đau bụng là kinh nghiệm dân gian, KHÔNG phải khuyến nghị y tế hiện đại
      if ((qNormSpaced.includes(' la bang ') || qNormSpaced.includes(' bup bang ')) && (qNormSpaced.includes(' dau bung ') || qNormSpaced.includes(' y te ') || qNormSpaced.includes(' khuyen nghi '))) {
        return {
          item: {
            seed_id: 'F_LA_BANG_FOLK_NOT_MEDICAL',
            expected_answer: 'Việc tù nhân Hỏa Lò xưa dùng búp và lá bàng non chữa kiết lỵ, đau bụng là kinh nghiệm dân gian trong điều kiện ngục tù khắc nghiệt thiếu thuốc men; đây KHÔNG phải khuyến nghị y tế hiện đại để tự ý áp dụng điều trị ngày nay.',
            premium_answer: 'Việc tù nhân chính trị xưa ăn búp và lá bàng non để giảm đau bụng, kiết lỵ là kinh nghiệm dân gian trong hoàn cảnh tù đày thiếu thuốc men, hoàn toàn không phải khuyến nghị y tế hiện đại.'
          },
          score: 0.99,
          type: 'SEMANTIC_FACT',
          isFact100: true
        };
      }

      // 1.3. Tìm kiếm theo Token Inverted Index có trọng số IDF + Kiểm tra nhất quán Mốc Năm trong kho 100 Facts
      if (hasEntity) {
        const coreTokens = nlp.tokenize(unwrap.coreQuery).filter(t => t.length > 2 && !STOPWORDS.has(t));
        const qYears = String(unwrap.coreQuery).match(/\b(18\d{2}|19\d{2}|20\d{2})\b/g) || [];
        if (coreTokens.length >= 3) {
          const docScores = new Map();
          const docHits = new Map();
          coreTokens.forEach(t => {
            const docIndices = this.facts100InvertedIndex.get(t) || [];
            const idf = Math.log(1 + this.facts100.length / (docIndices.length + 1));
            docIndices.forEach(idx => {
              docScores.set(idx, (docScores.get(idx) || 0) + idf);
              docHits.set(idx, (docHits.get(idx) || 0) + 1);
            });
          });

          let bestDocIdx = -1;
          let maxScore = 0;
          let bestHits = 0;
          for (const [idx, sc] of docScores.entries()) {
            const item = this.facts100[idx];
            if (qYears.length > 0) {
              const candText = `${item.question || ''} ${item.expected_answer || ''} ${item.premium_answer || ''}`;
              const candYears = candText.match(/\b(18\d{2}|19\d{2}|20\d{2})\b/g) || [];
              if (candYears.length > 0 && !qYears.some(y => candYears.includes(y))) {
                continue; // Chặn match lệch mốc năm (VD: hỏi 1951 nhưng trả về 1945)
              }
            }
            if (sc > maxScore) {
              maxScore = sc;
              bestDocIdx = idx;
              bestHits = docHits.get(idx) || 0;
            }
          }

          const overlapRatio = bestHits / coreTokens.length;
          if (bestDocIdx !== -1 && (overlapRatio >= 0.80 || (coreTokens.length >= 5 && bestHits >= 4))) {
            const item = this.facts100[bestDocIdx];
            return {
              item,
              score: Math.min(0.85, 0.50 + overlapRatio * 0.35),
              type: 'SEMANTIC_FACT',
              isFact100: true,
              requiresConflictCheck: unwrap.requiresConflictCheck
            };
          }
        }
      }
    }

    // =========================================================================
    // 2. TÌM KIẾM TRONG KHO 500 CÂU HỎI CHUẨN SỬ HỌC CŨ (FALLBACK)
    // =========================================================================
    if (!this.groundTruth500.length) return null;

    // 2.1. Exact Match 100%
    if (this.groundTruthMap.has(norm)) {
      const item = this.groundTruthMap.get(norm);
      return { item, score: 1.0, type: 'EXACT', isFact100: false };
    }
    if (this.groundTruthMap.has(normCore)) {
      const item = this.groundTruthMap.get(normCore);
      return { item, score: 0.98, type: 'EXACT', isFact100: false };
    }

    // Tuyệt đối không fuzzy match nếu câu hỏi không chứa thực thể di tích cụ thể
    if (!hasEntity) return null;

    // 2. TF-IDF Token Inverted Index Match trên Content Words (chỉ dùng câu hỏi lõi unwrap.coreQuery)
    const qTokens = nlp.tokenize(unwrap.coreQuery);
    const contentTokens = qTokens.filter(t => t.length > 2 && !STOPWORDS.has(t));
    if (contentTokens.length < 3) return null; // Cần ít nhất 3 từ khóa nội dung để tránh bắt nhầm sang hiện vật khác

    const scores = new Map();
    contentTokens.forEach(token => {
      const indices = this.invertedIndex500.get(token);
      if (indices) {
        const idf = Math.log(1 + this.groundTruth500.length / indices.length);
        indices.forEach(idx => {
          scores.set(idx, (scores.get(idx) || 0) + idf);
        });
      }
    });

    // Nhận diện chủ đề của câu hỏi trên normCore để tránh tiền tố Beacon lọc nhầm phân khu
    const qHasGuillotine = normCore.includes('may chem') || normCore.includes('guillotine');
    const qHasBanyan = normCore.includes('cay bang') || normCore.includes('la bang') || normCore.includes('hat bang');
    const qHasSewer = normCore.includes('cong ngam') || normCore.includes('vuot nguc');
    const qHasPilot = normCore.includes('phi cong') || normCore.includes('mccain') || normCore.includes('peterson') || normCore.includes('hanoi hilton');
    const qHasShackles = normCore.includes('cum') || normCore.includes('gong') || normCore.includes('cum chan') || normCore.includes('cum sat') || normCore.includes('be cum');
    const qHasMcCain = normCore.includes('mccain');
    const qHasPeterson = normCore.includes('peterson');
    const qHasCachot = normCore.includes('cachot') || normCore.includes('nguc toi');
    const qHasDeathRow = normCore.includes('xa lim') || normCore.includes('tu hinh') || normCore.includes('hoang van thu');
    const qHas1951 = normCore.includes('1951') || normCore.includes('noel') || normCore.includes('24 12') || normCore.includes('16 tu tu') || normCore.includes('5 dong chi');
    const qHas1945 = normCore.includes('1945') || normCore.includes('hon 100') || normCore.includes('100 can bo') || normCore.includes('nhat dao chinh');
    const qHasPenInk = normCore.includes('muc viet') || normCore.includes('but') || normCore.includes('bao chi') || normCore.includes('viet bao');
    const qHasNguyenThaiHoc = normCore.includes('nguyen thai hoc');
    const qHasHongChung = normCore.includes('dai hong chung') || normCore.includes('chuong');

    let bestScore = 0;
    let bestIdx = -1;

    for (const [idx, score] of scores.entries()) {
      const candidate = this.groundTruth500[idx];
      const candNorm = candidate.normQ;

      // Kiểm tra tính nhất quán về chủ đề (Topic Consistency & Entity Scoping)
      if (qHasHongChung && !candNorm.includes('chuong') && !candNorm.includes('dai hong chung')) continue;
      if (qHasGuillotine && !candNorm.includes('may chem') && !candNorm.includes('guillotine')) continue;
      if (qHasBanyan && !candNorm.includes('bang')) continue;
      if (qHasSewer && !candNorm.includes('cong') && !candNorm.includes('vuot nguc')) continue;
      if (qHasPilot && !candNorm.includes('phi cong') && !candNorm.includes('mccain') && !candNorm.includes('peterson') && !candNorm.includes('hilton')) continue;
      if (qHasShackles && (candNorm.includes('phi cong') || candNorm.includes('mccain') || candNorm.includes('hilton') || candNorm.includes('may chem'))) continue;
      if (qHasPilot && (candNorm.includes('cum sat') || candNorm.includes('be cum') || candNorm.includes('may chem'))) continue;
      if ((norm.includes('kien truc') || norm.includes('cong chinh') || norm.includes('phu khanh')) && !qHasGuillotine && candNorm.includes('may chem')) continue;
      if (qHasMcCain && !candNorm.includes('mccain')) continue;
      if (qHasPeterson && !candNorm.includes('peterson')) continue;
      if (qHas1951 && candNorm.includes('1945') && !candNorm.includes('1951')) continue;
      if (qHas1945 && candNorm.includes('1951') && !candNorm.includes('1945')) continue;
      if (qHasPenInk && candNorm.includes('may chem')) continue;
      if (qHasNguyenThaiHoc && !candNorm.includes('nguyen thai hoc')) continue;
      if (qHasCachot && !candNorm.includes('cachot') && !candNorm.includes('nguc toi')) continue;
      if (qHasDeathRow && !candNorm.includes('xa lim') && !candNorm.includes('tu hinh') && !candNorm.includes('hoang van thu')) continue;

      // Entity Scoping: Chống bắt nhầm tài liệu chỉ vì trùng từ khóa chung chung
      if ((candNorm.includes('may chem') || candNorm.includes('guillotine')) && !qHasGuillotine) continue;
      if (candNorm.includes('cay bang') && !qHasBanyan) continue;
      if (candNorm.includes('cong ngam') && !qHasSewer) continue;
      if ((candNorm.includes('phi cong') || candNorm.includes('mccain') || candNorm.includes('hilton')) && !qHasPilot) continue;
      if ((candNorm.includes('cum sat') || candNorm.includes('be cum') || candNorm.includes('thanh go cum')) && !qHasShackles) continue;
      if ((candNorm.includes('cachot') || candNorm.includes('nguc toi')) && !qHasCachot) continue;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    }

    if (bestScore >= 3.0 && bestIdx >= 0) {
      const item = this.groundTruth500[bestIdx];
      const itemTokens = item.tokens;
      let intersect = 0;
      contentTokens.forEach(t => { if (itemTokens.has(t)) intersect++; });
      const ratio = intersect / Math.max(1, contentTokens.length);

      if (ratio >= 0.75 && intersect >= 3) {
        return { item, score: 0.60, ratio, type: 'SEMANTIC' };
      }
    }

    return null;
  }

  /**
   * Khớp hiện vật / phân khu lịch sử
   */
  findHistoricalExhibit(question) {
    const norm = ' ' + nlp.normalize(question) + ' ';
    const { semanticRouter, hasPhrase } = require('./semantic_router');
    const ext = semanticRouter.detectExternalDomainSignals(norm);
    // Chặn match chéo sang hồ sơ Hỏa Lò nếu câu hỏi đang hỏi về địa danh ngoài di tích (Chùa Một Cột, Hồ Hoàn Kiếm, Bastille...) mà không nhắc Hỏa Lò
    if ((ext.hasExternalPlace || hasPhrase(norm, 'ho hoan kiem')) && !hasPhrase(norm, 'hoa lo') && !hasPhrase(norm, 'maison centrale') && !hasPhrase(norm, 'phu khanh')) {
      return null;
    }

    let bestExhibit = null;
    let maxMatch = 0;

    for (const [key, exhibit] of Object.entries(HISTORICAL_EXHIBITS)) {
      let matchCount = 0;
      for (const kw of exhibit.keywords) {
        if (hasPhrase(norm, kw)) {
          matchCount += (kw.includes(' ') ? 3 : 1);
        }
      }

      // Luật ưu tiên phân biệt đặc thù & Chống va chạm chéo (Anti-Collision)
      const isFluCold = hasPhrase(norm, 'cam cum') || hasPhrase(norm, 'thuoc tri');
      if (key === 'cum_sat' && !isFluCold && (hasPhrase(norm, 'cum') || hasPhrase(norm, 'gong') || hasPhrase(norm, 'cum sat') || hasPhrase(norm, 'cum chan') || hasPhrase(norm, 'be cum'))) matchCount += 25;
      if (key === 'cum_sat' && isFluCold) matchCount -= 50;
      if (key === 'phi_cong' && (hasPhrase(norm, 'cum') || hasPhrase(norm, 'gong') || hasPhrase(norm, 'cum sat') || hasPhrase(norm, 'cum chan'))) matchCount -= 50;
      if (key === 'may_chem' && (hasPhrase(norm, 'kien truc') || hasPhrase(norm, 'cong chinh') || hasPhrase(norm, 'phu khanh')) && !hasPhrase(norm, 'may chem') && !hasPhrase(norm, 'guillotine')) matchCount -= 50;
      if (key === 'cay_bang' && hasPhrase(norm, 'cay bang')) matchCount += 10;
      if (key === 'hien_vat_sinh_hoat' && (hasPhrase(norm, 'muc viet') || hasPhrase(norm, 'but') || hasPhrase(norm, 'bao chi') || hasPhrase(norm, 'gach non') || hasPhrase(norm, 'muoi than'))) matchCount += 15;
      if (key === 'vuot_nguc_1945' && (hasPhrase(norm, '1945') || hasPhrase(norm, 'hon 100') || hasPhrase(norm, '100 can bo') || hasPhrase(norm, 'nhat dao chinh'))) matchCount += 15;
      if (key === 'may_chem' && (hasPhrase(norm, 'may chem') || hasPhrase(norm, 'guillotine'))) matchCount += 10;
      if (key === 'cong_ngam' && (hasPhrase(norm, 'cong ngam') || (hasPhrase(norm, 'vuot nguc') && !hasPhrase(norm, '1945') && !hasPhrase(norm, '100')))) matchCount += 10;
      if (key === 'phi_cong' && (hasPhrase(norm, 'phi cong') || hasPhrase(norm, 'mccain') || hasPhrase(norm, 'hilton'))) matchCount += 10;
      if (key === 'cachot' && (hasPhrase(norm, 'cachot') || hasPhrase(norm, 'nguc toi'))) matchCount += 10;
      if (key === 'khu_d_tu_hinh' && (hasPhrase(norm, 'tu hinh') || hasPhrase(norm, 'hoang van thu'))) matchCount += 10;
      if (key === 'tour_dem' && (hasPhrase(norm, 'tour dem') || hasPhrase(norm, 'dem thieng lieng'))) matchCount += 10;
      if (key === 'maison_centrale' && (hasPhrase(norm, 'maison centrale') || hasPhrase(norm, 'phu khanh') || hasPhrase(norm, 'cong so 1') || hasPhrase(norm, 'pho hoa lo') || (hasPhrase(norm, 'dia chi') && (hasPhrase(norm, 'hoa lo') || hasPhrase(norm, 'nha tu') || hasPhrase(norm, 'di tich'))) || (hasPhrase(norm, 'hoa lo') && hasPhrase(norm, 'o dau')))) matchCount += 15;

      if (matchCount > maxMatch) {
        maxMatch = matchCount;
        bestExhibit = exhibit;
      }
    }

    if (maxMatch >= 3 && bestExhibit) {
      return { exhibit: bestExhibit, matchScore: maxMatch };
    }
    return null;
  }

  /**
   * Lấy ngữ cảnh dịch vụ khách hàng (Customer Care)
   */
  getCustomerCareContext(intent) {
    switch (intent) {
      case 'TICKET_INFORMATION':
        return CUSTOMER_CARE_DOSSIERS.tickets;
      case 'OPENING_HOURS':
        return CUSTOMER_CARE_DOSSIERS.hours;
      case 'FACILITY_SUPPORT':
        return CUSTOMER_CARE_DOSSIERS.facilities;
      case 'ACCESSIBILITY_SUPPORT':
        return CUSTOMER_CARE_DOSSIERS.accessibility;
      case 'CUSTOMER_COMPLAINT':
      case 'CUSTOMER_ASSISTANCE':
        return CUSTOMER_CARE_DOSSIERS.assistance_and_complaint;
      case 'TOUR_RECOMMENDATION':
      case 'VISIT_GUIDANCE':
        return CUSTOMER_CARE_DOSSIERS.tour_recommendation;
      default:
        return null;
    }
  }

  /**
   * Truy xuất câu trả lời theo khía cạnh chuyên sâu (Aspect & Entity Graph V6.0)
   * Phục vụ các câu hỏi cùng chủ đề nhưng khác yêu cầu (Cây bàng, Máy chém, Cống ngầm...)
   */
  getSemanticAspectAnswer(subject, aspect) {
    if (subject === 'cay_bang') {
      if (aspect === 'PURPOSE' || aspect === 'DAILY_PRISON_LIFE') {
        return {
          answer: 'Cây bàng gắn bó mật thiết với cuộc sống tù nhân Hỏa Lò: búp và lá bàng non được dùng nhai sống hoặc sắc lấy nước uống chữa khỏi bệnh kiết lỵ, tiêu chảy; vỏ cây bàng dùng sắc nước rửa sạch vết thương tra tấn; cành bàng được mài nhọn làm quản bút viết tài liệu, báo chí bí mật; nhân hạt bàng bùi béo dùng bồi dưỡng cho những đồng chí ốm nặng.',
          sourceId: 'DOSSIER_CAY_BANG_LIFE',
          source: 'Hồ sơ Di sản Cây bàng Hỏa Lò'
        };
      }
      if (aspect === 'SIGNIFICANCE') {
        return {
          answer: 'Cây bàng cổ thụ trong sân trại giam Hỏa Lò là người bạn tri âm và biểu tượng kiên cường bất khuất của các chiến sĩ cách mạng. Dưới tán bàng rợp bóng mát, tù nhân tìm thấy niềm an ủi, nơi trao đổi tin tức bí mật và cảm nhận mầm sống tự do kiên cường vươn lên giữa bốn bức tường đá giam cầm.',
          sourceId: 'DOSSIER_CAY_BANG_SYMBOL',
          source: 'Hồ sơ Di sản Cây bàng Hỏa Lò'
        };
      }
      if (aspect === 'ORIGIN') {
        return {
          answer: 'Ngày xưa khắp khuôn viên rộng gần 13.000 mét vuông của Nhà tù Hỏa Lò từng có nhiều cây bàng do tù nhân và binh lính trồng từ đầu thế kỷ 20. Trải qua biến thiên lịch sử, cây bàng cổ thụ gần trăm tuổi hiện nay tại sân trại giam là chứng nhân lịch sử quý giá còn được bảo tồn nguyên vẹn.',
          sourceId: 'DOSSIER_CAY_BANG_ORIGIN',
          source: 'Hồ sơ Di sản Cây bàng Hỏa Lò'
        };
      }
    }

    if (subject === 'may_chem') {
      if (aspect === 'SPECIFICATION') {
        return {
          answer: 'Cỗ máy chém tại Nhà tù Hỏa Lò có chiều cao thực tế gần 4 mét, cột dựng bằng hai thanh gỗ lim song song với lưỡi dao bằng thép vát chéo nặng 50kg gắn kèm quả tạ chì trượt từ trên đỉnh xuống.',
          sourceId: 'DOSSIER_MAY_CHEM_SPEC',
          source: 'Hồ sơ Hiện vật Cỗ máy chém Hỏa Lò'
        };
      }
      if (aspect === 'ORIGIN') {
        return {
          answer: 'Cỗ máy chém được thực dân Pháp đưa sang Việt Nam từ đầu thế kỷ 20. Máy được thiết kế cơ động để tháo rời vận chuyển lưu động đi hành quyết khắp Bắc Kỳ, tiêu biểu là việc đưa lên Yên Bái sáng 17/6/1930 để hành quyết nhà yêu nước Nguyễn Thái Học cùng 12 nghĩa sĩ khởi nghĩa Yên Bái.',
          sourceId: 'DOSSIER_MAY_CHEM_ORIGIN',
          source: 'Hồ sơ Hiện vật Cỗ máy chém Hỏa Lò'
        };
      }
      if (aspect === 'PURPOSE') {
        return {
          answer: 'Thực dân Pháp sử dụng cỗ máy chém tại Hỏa Lò như một công cụ khủng bố tinh thần tàn bạo nhằm đàn áp phong trào đấu tranh giải phóng dân tộc của nhân dân Việt Nam.',
          sourceId: 'DOSSIER_MAY_CHEM_PURPOSE',
          source: 'Hồ sơ Hiện vật Cỗ máy chém Hỏa Lò'
        };
      }
      if (aspect === 'COMPARISON_EXPANSION') {
        return {
          answer: 'Ngoài cỗ máy chém, tại Nhà tù Hỏa Lò còn có nhiều hiện vật và khu vực giam giữ trừng phạt khét tiếng khác như: Ngục tối Cachot (nơi cùm dốc ngược chân trong bóng tối hoàn toàn), Dãy xà lim tử hình Khu D, và các bộ cùm sắt chân dài trong phòng giam tập thể nam.',
          sourceId: 'DOSSIER_MAY_CHEM_COMPARISON',
          source: 'Hồ sơ Hiện vật Giam giữ & Tra tấn Hỏa Lò'
        };
      }
    }

    return null;
  }

  /**
   * =========================================================================
   * UNIVERSAL TOP-K HYBRID RAG RETRIEVER (V7.5)
   * Gom Top-K tư liệu xác thực liên quan nhất từ TOÀN BỘ 5 kho tri thức
   * (100 Facts + 500 Ground Truth + 1000 Dataset + 13 Hồ sơ Phân khu + Expanded + BLE Station)
   * để LLM tổng hợp trả lời CHÍNH XÁC mọi biến thể câu hỏi mới (1000+ kiểu hỏi khác nhau).
   * =========================================================================
   */
  retrieveTopKContext(question, { subject = null, intent = null, artifactContext = null, topK = 8 } = {}) {
    const snippets = [];
    const seen = new Set();
    const addSnippet = (label, text) => {
      if (!text || typeof text !== 'string') return;
      const clean = text.replace(/\s+/g, ' ').trim();
      if (clean.length < 15) return;
      const sig = clean.slice(0, 75).toLowerCase();
      if (seen.has(sig)) return;
      seen.add(sig);
      snippets.push(label ? `[${label}] ${clean}` : clean);
    };

    const norm = nlp.normalize(question || '');
    const tokens = nlp.tokenize(question || '').filter(t => t.length > 2 && !STOPWORDS.has(t));

    // 1. Ngữ cảnh trạm BLE hiện vật du khách đang đứng: CHỈ đưa vào snippet khi câu hỏi hỏi về định vị hoặc hiện vật trước mắt
    const isExplicitLocationQuery = /\b(o day|tai day|cho nay|khu nay|hien vat nay|vat nay|day la dau|toi dang o dau|dung o dau|truoc mat|xung quanh|this|here|around)\b/i.test(norm) ||
      intent === 'VISIT_GUIDANCE' ||
      intent === 'LOCATION_ORIENTATION';
    if (isExplicitLocationQuery && artifactContext && artifactContext.artifact_name) {
      const dlg = artifactContext.dialogue?.text || artifactContext.dialogue?.short_cue || '';
      addSnippet(
        `VỊ TRÍ HIỆN TẠI CỦA DU KHÁCH (BLE Mã ${artifactContext.code || 'N/A'})`,
        `Du khách đang đứng ngay tại: ${artifactContext.artifact_name} (${artifactContext.location || 'Khu trưng bày'}). Thông tin hiện vật: ${dlg}`
      );
    }

    // 2. XẾP HẠNG TRUY XUẤT NGỮ NGHĨA THỐNG NHẤT TRÊN TOÀN BỘ 3.128 VECTOR (Unified Semantic Ranking First!)
    // Đưa Top-3 tư liệu khớp ngữ nghĩa sâu nhất (từ custom/, dataset_hoa_lo_vi, facts100, groundTruth500, dataset1000)
    // lên ĐẦU ngữ cảnh RAG để LLM trả lời đúng trọng tâm câu hỏi cụ thể thay vì bị hồ sơ tổng quan chiếm chỗ!
    let matchedToneLevel = null;
    let hasCustomDropInMatch = false;
    let hasDynamicArchiveMatch = false;
    if (this.localSemanticIndex && this.localSemanticIndex.docs.length > 0) {
      const cleanQ = nlp.cleanVoiceSpokenInput(question) || question;
      // Ưu tiên tài liệu thả file custom/ trước nếu khớp
      if (this.customStats?.customDocs > 0) {
        const userHits = this.localSemanticIndex.search(cleanQ, {
          lang: null,
          topK: 2,
          minScore: 0.34,
          onlyUserCustom: true
        });
        for (const hit of userHits) {
          const doc = hit.doc;
          if (hit.score >= 0.40) hasCustomDropInMatch = true;
          addSnippet(`Tài liệu mới (${doc.fileLabel || 'custom'}${doc.topic ? ' • ' + doc.topic : ''})`, doc.answer);
        }
      }
      // Tìm kiếm thống nhất trên toàn kho 3.128 vector ngữ nghĩa
      const unifiedHits = this.localSemanticIndex.search(cleanQ, {
        lang: null,
        topK: 4,
        minScore: 0.32
      });
      for (const hit of unifiedHits) {
        const doc = hit.doc;
        if (!matchedToneLevel) {
          matchedToneLevel = doc.toneLevel || (doc.zoneId ? this.zoneTones.get(doc.zoneId) : null) || null;
        }
        if (doc.isUserCustom && hit.score >= 0.40) hasCustomDropInMatch = true;
        if (doc.isDynamic && hit.score >= 0.36) hasDynamicArchiveMatch = true;
        const label = doc.isUserCustom
          ? `Tài liệu mới (${doc.fileLabel || 'custom'}${doc.topic ? ' • ' + doc.topic : ''})`
          : (doc.zoneName ? `Tư liệu ${doc.zoneName} (${doc.id})` : `Tư liệu xác thực ${doc.id}`);
        addSnippet(label, doc.answer);
      }
    }

    // 2.5. Hồ sơ phân khu lịch sử liên quan (13 phân khu Hỏa Lò - cung cấp nền bối cảnh sau Top-K cụ thể)
    const matchedExhibit = this.findHistoricalExhibit(question) ||
      (subject && HISTORICAL_EXHIBITS[subject] ? { exhibit: HISTORICAL_EXHIBITS[subject] } : null);
    if (matchedExhibit && matchedExhibit.exhibit) {
      const ex = matchedExhibit.exhibit;
      if (Array.isArray(ex.facts)) {
        addSnippet(`Hồ sơ ${ex.name}`, ex.facts.join(' '));
      } else if (ex.directAnswer) {
        addSnippet(`Hồ sơ ${ex.name}`, ex.directAnswer);
      }
    }

    // 3. Kho tri thức mở rộng (expanded_heritage_knowledge.json)
    const expMatch = this.findExpandedMatch(question, 'vi', 0);
    if (expMatch && expMatch.reply) {
      addSnippet(`Tư liệu xác thực ${expMatch.id}`, expMatch.reply);
    }

    // 4. Chính sách dịch vụ & chăm sóc khách hàng nếu có
    const policyMatch = this.findServicePolicy(question, intent);
    if (policyMatch && policyMatch.policy?.content) {
      addSnippet(`Chính sách ${policyMatch.policy.title}`, policyMatch.policy.content);
    }
    const ccCtx = this.getCustomerCareContext(intent);
    if (ccCtx && Array.isArray(ccCtx.facts)) {
      addSnippet(ccCtx.title, ccCtx.facts.slice(0, 3).join(' '));
    }

    // 5. Top-3 từ Kho 100 Facts xác thực (facts100) theo Inverted Index
    if (tokens.length > 0 && this.facts100.length > 0) {
      const scoreMap = new Map();
      for (const t of tokens) {
        const list = this.facts100InvertedIndex.get(t);
        if (!list) continue;
        const idf = Math.log(1 + this.facts100.length / (list.length + 1));
        for (const idx of list) {
          scoreMap.set(idx, (scoreMap.get(idx) || 0) + idf);
        }
      }
      const ranked = [...scoreMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      for (const [idx, sc] of ranked) {
        if (sc < 1.2) continue;
        const item = this.facts100[idx];
        const ans = item.premium_answer || item.expected_answer;
        if (ans) addSnippet(`Fact ${item.seed_id || item.question_id || idx}`, ans);
      }
    }

    // 6. Top-2 từ Kho 500 câu hỏi chuẩn sử học (groundTruth500)
    if (tokens.length > 0 && this.groundTruth500.length > 0) {
      const scoreMap = new Map();
      for (const t of tokens) {
        const list = this.invertedIndex500.get(t);
        if (!list) continue;
        const idf = Math.log(1 + this.groundTruth500.length / (list.length + 1));
        for (const idx of list) {
          scoreMap.set(idx, (scoreMap.get(idx) || 0) + idf);
        }
      }
      const ranked = [...scoreMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
      for (const [idx, sc] of ranked) {
        if (sc < 2.2) continue;
        const item = this.groundTruth500[idx];
        const ans = item.reference_answer || item.verified_answer;
        if (ans) addSnippet(`Tư liệu ${item.id || idx}`, ans);
      }
    }

    // 7. Top-2 từ Kho 1000 câu hỏi Hỏa Lò (dataset1000)
    if (tokens.length > 0 && this.dataset1000.length > 0) {
      const scoreMap = new Map();
      for (const t of tokens) {
        const list = this.invertedIndex1000.get(t);
        if (!list) continue;
        const idf = Math.log(1 + this.dataset1000.length / (list.length + 1));
        for (const idx of list) {
          scoreMap.set(idx, (scoreMap.get(idx) || 0) + idf);
        }
      }
      const ranked = [...scoreMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
      for (const [idx, sc] of ranked) {
        if (sc < 2.5) continue;
        const item = this.dataset1000[idx];
        if (item && item.answer) addSnippet(`Kho Hỏa Lò ${item.id}`, item.answer);
      }
    }

    // 8. Nếu chưa có snippet di tích nào nhưng có từ khóa chung Hỏa Lò -> thêm tổng quan cốt lõi
    if (snippets.length <= (artifactContext ? 1 : 0)) {
      addSnippet(
        'Tổng quan Di tích Nhà tù Hỏa Lò',
        'Di tích Lịch sử Nhà tù Hỏa Lò (Maison Centrale, số 1 phố Hỏa Lò, quận Hoàn Kiếm, Hà Nội) do thực dân Pháp xây dựng năm 1896 trên đất làng gốm Phụ Khánh. Mở cửa 8:00–17:00 hàng ngày (không nghỉ trưa), vé 50.000 VNĐ/người lớn, ưu đãi 25.000 VNĐ cho HSSV/người cao tuổi, miễn phí trẻ dưới 15 tuổi. Các điểm nổi bật: Cổng chính, Ngục tối Cachot, Cỗ máy chém cao gần 4m lưỡi thép 50kg, Cây bàng cổ thụ sân trại giam, Cống ngầm vượt ngục 1945 & 1951, Khu phi công Mỹ 1964–1973 (Hanoi Hilton), Đài tưởng niệm.'
      );
    }

    return {
      snippets: snippets.slice(0, topK),
      hasArchiveEvidence: snippets.length > 0,
      hasMatchedExhibit: Boolean(matchedExhibit) || hasCustomDropInMatch,
      matchedToneLevel,
      hasCustomDropInMatch,
      hasDynamicArchiveMatch
    };
  }
}

module.exports = {
  HISTORICAL_EXHIBITS,
  CUSTOMER_CARE_DOSSIERS,
  knowledgeBase: new KnowledgeBase()
};
