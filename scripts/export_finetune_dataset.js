/**
 * =========================================================================================
 * 📦 EXPORT STANDARD FINE-TUNING DATASET (ChatML JSONL: train.jsonl & val.jsonl)
 * =========================================================================================
 * Gộp sạch, khử trùng lặp và chuẩn hóa toàn bộ tri thức XÁC THỰC của Di tích Nhà tù Hỏa Lò
 * + 4 trạm hiện vật BLE + mẫu hướng dẫn viên xử lý câu ngoài lề chuẩn 9.5+ sang định dạng
 * chuẩn công nghiệp OpenAI / Groq / HuggingFace / Unsloth / LoRA (.jsonl).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'kiemthu', 'data');
const OUT_DIR = path.join(ROOT, 'dataset_finetune');

const SYSTEM_PROMPT_VI =
  'Bạn là hướng dẫn viên văn hóa - lịch sử kỳ cựu tại Di tích Lịch sử Nhà tù Hỏa Lò (số 1 phố Hỏa Lò, Hoàn Kiếm, Hà Nội) và các gian trưng bày bảo vật (Mã 001–004). Trả lời bằng tiếng Việt chững chạc, ấm áp, đầy đủ chủ ngữ - vị ngữ, trung thực tuyệt đối với tư liệu lịch sử xác thực (không bịa đặt số liệu hay ngày tháng). Với câu hỏi ngoài phạm vi di tích, trả lời tinh tế, hữu ích như một hướng dẫn viên Hà Nội thực thụ và khéo léo kết nối trở lại hành trình khám phá Nhà tù Hỏa Lò.';

const SYSTEM_PROMPT_EN =
  'You are a seasoned, dignified cultural and historical docent at Hoa Lo Prison Historical Relic (No. 1 Hoa Lo Street, Hanoi) and its featured exhibition galleries (Codes 001–004). Respond in poised, warm, natural English, strictly faithful to verified historical archives (never fabricating dates or statistics). For off-topic questions, respond graciously like a cultured Hanoi tour guide and bridge naturally back to Hoa Lo Prison Relic.';

function parseCSV(content) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const text = content.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && next === '\n') i++;
      row.push(field.trim());
      if (row.some(c => c.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some(c => c.length > 0)) rows.push(row);
  }
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(cols => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] !== undefined ? cols[idx] : '';
    });
    return obj;
  });
}

function normKey(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(s) {
  return String(s || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, ' ')
    .trim();
}

function main() {
  const seen = new Set();
  const records = [];
  const sourceCounts = {};

  function addRecord({ question, answer, lang = 'vi', source = 'unknown', category = 'GENERAL' }) {
    const q = cleanText(question);
    const a = cleanText(answer);
    if (q.length < 6 || a.length < 20) return;
    const key = `${lang}|${normKey(q)}`;
    if (seen.has(key)) return;
    seen.add(key);
    records.push({
      messages: [
        { role: 'system', content: lang === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_VI },
        { role: 'user', content: q },
        { role: 'assistant', content: a }
      ],
      meta: { lang, source, category }
    });
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
  }

  // 1. 500 câu hỏi chuẩn lịch sử (500_cau_hoi_chuan_lich_su.json)
  const f500 = path.join(DATA_DIR, '500_cau_hoi_chuan_lich_su.json');
  if (fs.existsSync(f500)) {
    const items = JSON.parse(fs.readFileSync(f500, 'utf8'));
    for (const it of items) {
      addRecord({
        question: it.question,
        answer: it.reference_answer,
        lang: 'vi',
        source: '500_cau_hoi_chuan_lich_su.json',
        category: it.area || it.q_type || 'HISTORY'
      });
    }
  }

  // 2. 100 Facts & 500 biến thể xác thực có nguồn (2.csv)
  const f2 = path.join(DATA_DIR, '2.csv');
  if (fs.existsSync(f2)) {
    const rows = parseCSV(fs.readFileSync(f2, 'utf8'));
    for (const r of rows) {
      if (!r.question || !r.expected_answer) continue;
      addRecord({
        question: r.question,
        answer: r.expected_answer,
        lang: 'vi',
        source: '2.csv',
        category: r.category || 'VERIFIED_FACT'
      });
    }
  }

  // 3. 1.000 câu hỏi Hỏa Lò (1000_cau_hoi_hoa_lo.json)
  const f1000 = path.join(DATA_DIR, '1000_cau_hoi_hoa_lo.json');
  if (fs.existsSync(f1000)) {
    const items = JSON.parse(fs.readFileSync(f1000, 'utf8'));
    for (const it of items) {
      if (!it.question || !it.ground_truth_summary) continue;
      addRecord({
        question: it.question,
        answer: it.ground_truth_summary,
        lang: 'vi',
        source: '1000_cau_hoi_hoa_lo.json',
        category: it.category || 'HERITAGE_QA'
      });
    }
  }

  // 4. 16 Chính sách dịch vụ SSOT (verified_service_knowledge.json)
  const fSvc = path.join(DATA_DIR, 'verified_service_knowledge.json');
  if (fs.existsSync(fSvc)) {
    const svc = JSON.parse(fs.readFileSync(fSvc, 'utf8'));
    const policies = Array.isArray(svc) ? svc : (svc.policies || Object.values(svc));
    for (const p of policies) {
      if (!p || !p.title || !p.content) continue;
      addRecord({
        question: `Cho mình hỏi thông tin về ${p.title} tại Di tích Nhà tù Hỏa Lò?`,
        answer: p.content,
        lang: 'vi',
        source: 'verified_service_knowledge.json',
        category: 'SERVICE_POLICY'
      });
    }
  }

  // 5. 4 Hiện vật BLE (data/beacons.json)
  const fBeacons = path.join(ROOT, 'data', 'beacons.json');
  if (fs.existsSync(fBeacons)) {
    const beacons = JSON.parse(fs.readFileSync(fBeacons, 'utf8'));
    for (const b of beacons) {
      const text = b.dialogue?.text;
      if (!text) continue;
      addRecord({
        question: `Hãy giới thiệu chi tiết về hiện vật ${b.artifact_name} (Mã ${b.code}) tại ${b.location || 'khu trưng bày'}?`,
        answer: `Dạ mình xin giới thiệu cùng bạn về ${b.artifact_name} tại ${b.location || 'khu trưng bày'}: ${text}`,
        lang: 'vi',
        source: 'beacons.json',
        category: 'BLE_EXHIBIT'
      });
    }
  }

  // 6. Các hồ sơ chuyên sâu & bẫy sự thật (VI + EN) từ expanded_heritage_knowledge.json
  const fExp = path.join(DATA_DIR, 'expanded_heritage_knowledge.json');
  const curatedExpQuestions = {
    EXP_TRAP_HVT: ['Đồng chí Hoàng Văn Thụ có bị xử chém bằng máy chém tại Hỏa Lò không?', 'Was Hoang Van Thu executed by guillotine at Hoa Lo Prison?'],
    EXP_TRAP_US_CACHOT: ['Các phi công Mỹ có bị giam trong ngục tối Cachot và cùm chân không?', 'Were American pilots shackled in the Cachot dark cells at Hoa Lo?'],
    EXP_TRAP_1945_1951: ['Có phải năm 1945 có 16 tử tù cưa song sắt cống ngầm vượt ngục không?', 'Did 16 death-row prisoners escape through the sewer in 1945?'],
    EXP_TRAP_WEIGHT_500KG: ['Lưỡi dao máy chém tại Nhà tù Hỏa Lò có nặng tới 500kg không?', 'Does the guillotine blade at Hoa Lo Prison weigh 500kg?'],
    EXP_HIST_PRISON_MEALS_DEP_LOP: ['Ngày xưa bữa ăn của tù nhân trong Nhà tù Hỏa Lò ra sao và đôi dép lốp có ý nghĩa gì?', 'What were prisoners’ daily meals like at Hoa Lo Prison and what do tire sandals represent?'],
    EXP_HIST_FEMALE_PRISONERS: ['Các nữ chiến sĩ cách mạng tại Trại giam Nữ Hỏa Lò đã đấu tranh và bảo vệ con nhỏ như thế nào?', 'How did female revolutionary prisoners at Hoa Lo Prison resist and protect children?'],
    EXP_HIST_SECRET_PRESS_POETRY: ['Phong trào biến Nhà tù Hỏa Lò thành trường học cách mạng và báo bí mật diễn ra như thế nào?', 'How did political prisoners turn Hoa Lo Prison into a revolutionary school with secret newspapers?'],
    EXP_HIST_ARCHITECTURE_PHU_KHANH: ['Kiến trúc Nhà tù Hỏa Lò xây năm 1896 trên đất làng Phụ Khánh có quy mô và đặc điểm gì?', 'What are the architectural features of Maison Centrale built in 1896 on Phu Khanh village?'],
    EXP_HIST_HOA_LO_VS_CON_DAO_UNIQUE: ['So sánh Nhà tù Hỏa Lò có điểm gì đặc biệt so với Nhà tù Côn Đảo hay Phú Quốc?', 'What makes Hoa Lo Prison unique compared to Con Dao or Phu Quoc prisons?'],
    EXP_HIST_MEMORIAL_MONUMENT: ['Đài tưởng niệm tại Di tích Nhà tù Hỏa Lò có ý nghĩa gì?', 'What is the significance of the Memorial Monument at Hoa Lo Prison Relic?'],
    EXP_BLE_001_TRONG_DONG: ['Trống đồng Đông Sơn ở Gian trưng bày số 1 (Mã 001) có niên đại và hoa văn gì nổi bật?', 'What is the age and significance of the Dong Son Bronze Drum at Exhibition Hall 1?'],
    EXP_BLE_003_DAT_HONG: ['Đại Hồng Chung Đạt Hồng ở Mã 003 đúc triều nào, nặng mấy tấn và chạm khắc gì?', 'Tell me about the Dat Hong Great Bronze Bell at Hall 3, including its weight and motifs.'],
    EXP_BLE_004_BAO_KIEM: ['Bảo kiếm Hoàng gia triều Nguyễn ở Mã 004 chế tác bằng gì và biểu trưng cho điều gì?', 'What materials and royal symbolism define the Nguyen Dynasty Royal Sword at Hall 4?']
  };
  if (fs.existsSync(fExp)) {
    const exps = JSON.parse(fs.readFileSync(fExp, 'utf8'));
    for (const e of exps) {
      const pair = curatedExpQuestions[e.id];
      if (pair) {
        if (e.answer_vi) addRecord({ question: pair[0], answer: e.answer_vi, lang: 'vi', source: 'expanded_heritage_knowledge.json', category: e.category });
        if (e.answer_en) addRecord({ question: pair[1], answer: e.answer_en, lang: 'en', source: 'expanded_heritage_knowledge.json', category: e.category });
      }
    }
  }

  // 7. Mẫu chuẩn ứng xử câu hỏi ngoài lề kiểu hướng dẫn viên 9.5+ (VI + EN)
  const docentOosGold = [
    {
      lang: 'vi',
      q: 'Giá Bitcoin hôm nay bao nhiêu tiền vậy?',
      a: 'Dạ các chỉ số tài chính như Bitcoin hay giá vàng biến động từng phút, còn mình khi đồng hành dẫn tham quan tại Di tích Nhà tù Hỏa Lò không theo dõi bảng giá trực tuyến để tránh thông tin thiếu chuẩn xác. Đổi lại, những giá trị lịch sử bền vững theo năm tháng tại Hỏa Lò luôn sẵn sàng để mình chia sẻ cùng bạn bất cứ lúc nào.'
    },
    {
      lang: 'vi',
      q: 'Văn Miếu Quốc Tử Giám có ý nghĩa gì đối với lịch sử Hà Nội?',
      a: 'Dạ Văn Miếu – Quốc Tử Giám là biểu tượng thiêng liêng của truyền thống hiếu học và nền văn hiến ngàn năm Thăng Long – Hà Nội. Khi trở lại hành trình khám phá Di tích Nhà tù Hỏa Lò ngay gần đó, bạn sẽ thấy một lát cắt lịch sử khác không kém phần sâu sắc — nơi nhiều trí thức và chiến sĩ yêu nước đã giữ trọn khí phách trong chốn lao tù.'
    },
    {
      lang: 'vi',
      q: 'Nhà tù Côn Đảo nằm ở đâu và có gì đáng chú ý?',
      a: 'Dạ Nhà tù Côn Đảo nằm ngoài khơi tỉnh Bà Rịa – Vũng Tàu, ghi dấu trang sử bi tráng về sự cô lập ngoài hải đảo và lòng kiên trung của nhiều thế hệ chiến sĩ cách mạng. Tương tự tinh thần bất khuất ấy nhưng ở ngay giữa lòng thủ đô Hà Nội, Di tích Nhà tù Hỏa Lò lưu giữ câu chuyện biến nhà tù thành trường học cách mạng rất đặc trưng — bạn muốn mình kể tiếp về khu vực nào tại Hỏa Lò?'
    },
    {
      lang: 'vi',
      q: 'Thời tiết Hà Nội hôm nay có mưa không?',
      a: 'Dạ hệ thống hướng dẫn tại di tích không kết nối dữ liệu dự báo thời tiết theo thời gian thực nên bạn xem nhanh trên ứng dụng thời tiết sẽ chuẩn xác nhất. Rất thuận tiện là khoảng 85 đến 90 phần trăm không gian tham quan tại Di tích Nhà tù Hỏa Lò đều nằm trong nhà có mái che kiên cố, bạn hoàn toàn yên tâm khám phá cùng mình.'
    },
    {
      lang: 'vi',
      q: 'Bạn giải thích ngắn gọn giúp mình thuyết tương đối của Einstein được không?',
      a: 'Dạ thuyết tương đối của Einstein cho thấy không gian và thời gian không phải những đại lượng cố định tuyệt đối mà có thể co giãn, uốn cong theo vận tốc chuyển động và trường hấp dẫn. Cảm nhận về chiều dài thời gian ấy cũng dễ khiến người ta liên tưởng tới những năm tháng gian lao nhưng đầy bản lĩnh của các chiến sĩ từng bị giam cầm sau bức tường đá Nhà tù Hỏa Lò.'
    },
    {
      lang: 'en',
      q: 'What is the weather in Tokyo right now?',
      a: 'I do not have access to live meteorological feeds while guiding, so checking a weather app will give you the most reliable update. Whenever you are ready to continue your cultural journey here at Hoa Lo Prison Historical Relic, roughly 85 to 90 percent of our galleries are comfortably indoors and sheltered.'
    },
    {
      lang: 'en',
      q: 'What is the Bitcoin price today?',
      a: 'Financial markets like Bitcoin move by the minute, and as a historical docent at Hoa Lo Prison Relic I do not track live market tickers. What endures far beyond daily price swings are the timeless human stories of resilience preserved right here at Hoa Lo—would you like to explore one of our galleries?'
    }
  ];
  for (const d of docentOosGold) {
    addRecord({ question: d.q, answer: d.a, lang: d.lang, source: 'docent_95_gold_oos', category: 'OUT_OF_SCOPE_DOCENT' });
  }

  // Xáo trộn xác định (deterministic Fisher-Yates) để chia 90% train / 10% val cân bằng mọi nhóm
  let seed = 20261126;
  function rand() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }
  for (let i = records.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [records[i], records[j]] = [records[j], records[i]];
  }

  const valCount = Math.max(20, Math.round(records.length * 0.1));
  const valSet = records.slice(0, valCount);
  const trainSet = records.slice(valCount);

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const toJsonl = (arr) => arr.map(r => JSON.stringify({ messages: r.messages })).join('\n') + '\n';
  fs.writeFileSync(path.join(OUT_DIR, 'train.jsonl'), toJsonl(trainSet), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'val.jsonl'), toJsonl(valSet), 'utf8');

  const readme = `# Bộ Dữ Liệu Chuẩn Fine-Tuning AI Hướng Dẫn Viên Hỏa Lò (ChatML JSONL)

Thư mục này chứa bộ dữ liệu đã được **gộp sạch, khử trùng lặp và chuẩn hóa** từ toàn bộ nguồn tri thức xác thực của dự án, sẵn sàng dùng ngay cho **LoRA / QLoRA / Unsloth / HuggingFace TRL / OpenAI / Groq Fine-Tuning**.

## Thống kê bộ dữ liệu
- **Tổng số mẫu sạch duy nhất**: \`${records.length}\` hội thoại
- **Tập huấn luyện (\`train.jsonl\`)**: \`${trainSet.length}\` mẫu (~90%)
- **Tập đánh giá (\`val.jsonl\`)**: \`${valSet.length}\` mẫu (~10%)
- **Định dạng chuẩn**: JSON Lines (\`.jsonl\`), mỗi dòng có cấu trúc:
  \`\`\`json
  {"messages":[{"role":"system","content":"..."},{"role":"user","content":"..."},{"role":"assistant","content":"..."}]}
  \`\`\`

## Nguồn dữ liệu đã gộp
${Object.entries(sourceCounts).map(([k, v]) => `- \`${k}\`: **${v}** mẫu`).join('\n')}

## Cách tái tạo lại bộ dữ liệu khi cập nhật tri thức mới
\`\`\`bash
node scripts/export_finetune_dataset.js
\`\`\`

## Lưu ý về dữ liệu thô bổ sung
Ngoài bộ \`.jsonl\` sạch này, toàn bộ dữ liệu gốc & bộ đề kiểm thử mở rộng (gồm cả bộ **10.000 câu hỏi Hỏa Lò** JSON/CSV/XLSX và **3 bộ đề test 1.000 câu**) đều được đồng bộ đầy đủ tại \`kiemthu/data/\`.
`;
  fs.writeFileSync(path.join(OUT_DIR, 'README_DATASET.md'), readme, 'utf8');

  console.log(`✓ EXPORTED FINE-TUNE DATASET: total=${records.length} (train=${trainSet.length}, val=${valSet.length})`);
  console.log('Sources:', JSON.stringify(sourceCounts));
}

main();
