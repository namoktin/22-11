/**
 * =========================================================================================
 * 🧠 UNIVERSAL DROP-IN KNOWLEDGE AUTO-LOADER & SMART DOCUMENT CHUNKER (V9.0)
 * =========================================================================================
 * Tự động quét, bóc tách và nạp tri thức vào Bộ Não AI từ:
 * 1. `kiemthu/data/dataset_hoa_lo_vi/` (Gói tri thức chuẩn 14 phân khu Z01..Z14, 1.000 Q&A,
 *    36 Atomic Fact Cards, 28 mẩu chuyện nhỏ, 12 giải mã lầm tưởng, 10 Golden Facts P0).
 * 2. `kiemthu/data/custom/` (THƯ MỤC PLUG-AND-PLAY CHO NGƯỜI DÙNG):
 *    Chỉ cần thả BẤT KỲ file `.txt`, `.md`, `.json`, `.jsonl`, `.csv` (hoặc thư mục con)
 *    vào `kiemthu/data/custom/` -> tự động nhận diện định dạng (văn bản dài, hội thoại
 *    Khách/HDV, JSONL ChatML, JSON Q&A, CSV), tự cắt đoạn thông minh, khử trùng và nạp sống!
 */

const fs = require('fs');
const path = require('path');
const nlp = require('./nlp_processor');

const SUPPORTED_EXTS = new Set(['.json', '.jsonl', '.csv', '.txt', '.md']);

function cleanWhitespace(str) {
  return String(str || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseCSVLoose(content) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const text = String(content || '').replace(/^\uFEFF/, '');
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
  const headers = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1).map(cols => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] !== undefined ? cols[idx] : '';
    });
    return obj;
  });
}

function walkFiles(dirPath) {
  const results = [];
  if (!fs.existsSync(dirPath)) return results;
  let entries = [];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const ent of entries) {
    if (ent.name.startsWith('.') || ent.name.startsWith('_')) continue;
    const full = path.join(dirPath, ent.name);
    if (ent.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (SUPPORTED_EXTS.has(ext)) results.push(full);
    }
  }
  return results.sort();
}

/**
 * Tách văn bản dài hoặc đoạn hội thoại (.txt / .md) thành danh sách doc chuẩn:
 * - Nếu phát hiện cặp hội thoại (Khách/HDV, Hỏi/Đáp, Q/A, User/Assistant) -> bóc cặp Q&A.
 * - Với văn bản thuyết minh dài -> cắt theo tiêu đề Markdown (# / ## / ###) + đoạn 350–550 ký tự có nối gối 1 câu.
 */
function parseTextOrMarkdownDocument(rawText, fileLabel, isUserCustom = true) {
  const docs = [];
  const text = cleanWhitespace(rawText);
  if (text.length < 25) return docs;

  // 1. Thử bóc tách định dạng hội thoại (Khách:/HDV:, Hỏi:/Đáp:, Q:/A:, User:/Assistant:)
  const dialogueRe = /(?:^|\n)\s*(?:Khách(?:\s+tham\s+quan)?|Du\s+khách|Hỏi|Câu\s+hỏi|User|Visitor|Q)\s*[:：]\s*([^\n]+(?:\n(?!\s*(?:HDV|Hướng\s+dẫn\s+viên|Đáp|Trả\s+lời|AI|Bot|Assistant|Guide|A)\s*[:：])[^\n]+)*)\n\s*(?:HDV|Hướng\s+dẫn\s+viên|Đáp|Trả\s+lời|AI|Bot|Assistant|Guide|A)\s*[:：]\s*([\s\S]*?)(?=\n\s*(?:Khách(?:\s+tham\s+quan)?|Du\s+khách|Hỏi|Câu\s+hỏi|User|Visitor|Q)\s*[:：]|$)/gi;
  let m;
  let dlgIdx = 0;
  while ((m = dialogueRe.exec(text)) !== null) {
    const q = cleanWhitespace(m[1]).replace(/\n+/g, ' ');
    const a = cleanWhitespace(m[2]).replace(/\n+/g, ' ');
    if (q.length >= 6 && a.length >= 18) {
      dlgIdx++;
      docs.push({
        id: `${fileLabel}_DLG_${dlgIdx}`,
        source: isUserCustom ? 'CUSTOM_DROPIN_DIALOGUE' : 'TEXT_DIALOGUE',
        fileLabel,
        question: q,
        answer: a,
        lang: nlp.detectLanguage(a) === 'en' ? 'en' : 'vi',
        intent: 'HISTORICAL_FACT',
        isUserCustom,
        priorityBoost: isUserCustom ? 0.065 : 0.03
      });
    }
  }
  if (dlgIdx >= 1) return docs;

  // 2. Cắt văn xuôi / tài liệu tổng thể theo tiêu đề Markdown + đoạn văn thông minh (350–550 ký tự, overlap 1 câu)
  const lines = text.split('\n');
  const sections = [];
  let h1 = fileLabel.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  let h2 = '';
  let buf = [];

  const flushSection = () => {
    const body = buf.join('\n').trim();
    if (body.length >= 25) {
      const heading = h2 ? `${h1} - ${h2}` : h1;
      sections.push({ heading, body });
    }
    buf = [];
  };

  for (const line of lines) {
    const t = line.trim();
    const m1 = t.match(/^#\s+(.+)/);
    const m2 = t.match(/^#{2,4}\s+(.+)/);
    if (m1) {
      flushSection();
      h1 = m1[1].trim();
      h2 = '';
    } else if (m2) {
      flushSection();
      h2 = m2[1].trim();
    } else {
      buf.push(line);
    }
  }
  flushSection();

  let chunkIdx = 0;
  for (const sec of sections) {
    const paragraphs = sec.body.split(/\n{2,}/).map(p => p.replace(/\n+/g, ' ').trim()).filter(p => p.length >= 20);
    const sentences = [];
    for (const p of paragraphs) {
      const protectedP = p.replace(/(\d+)\.(\d+)/g, '$1__DOT__$2');
      const parts = protectedP.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) || [protectedP];
      for (const s of parts) {
        const restored = s.replace(/__DOT__/g, '.').trim();
        if (restored.length >= 10) sentences.push(restored);
      }
    }

    let cur = '';
    let prevSent = '';
    for (const sent of sentences) {
      if (cur && (cur.length + sent.length + 1) > 520) {
        chunkIdx++;
        const lang = nlp.detectLanguage(cur) === 'en' ? 'en' : 'vi';
        docs.push({
          id: `${fileLabel}_SEC_${chunkIdx}`,
          source: isUserCustom ? 'CUSTOM_DROPIN_DOC' : 'TEXT_DOC',
          fileLabel,
          topic: sec.heading,
          question: `${sec.heading}: ${cur.slice(0, 180)}`,
          answer: cur,
          lang,
          intent: 'HISTORICAL_FACT',
          isUserCustom,
          priorityBoost: isUserCustom ? 0.06 : 0.025
        });
        // Nối gối 1 câu cuối để không mất mạch ngữ nghĩa giữa hai đoạn
        cur = prevSent && prevSent.length <= 160 ? `${prevSent} ${sent}` : sent;
      } else {
        cur = cur ? `${cur} ${sent}` : sent;
      }
      prevSent = sent;
    }
    if (cur.length >= 20) {
      chunkIdx++;
      const lang = nlp.detectLanguage(cur) === 'en' ? 'en' : 'vi';
      docs.push({
        id: `${fileLabel}_SEC_${chunkIdx}`,
        source: isUserCustom ? 'CUSTOM_DROPIN_DOC' : 'TEXT_DOC',
        fileLabel,
        topic: sec.heading,
        question: `${sec.heading}: ${cur.slice(0, 180)}`,
        answer: cur,
        lang,
        intent: 'HISTORICAL_FACT',
        isUserCustom,
        priorityBoost: isUserCustom ? 0.06 : 0.025
      });
    }
  }

  return docs;
}

/**
 * Bóc tách 1 dòng object JSON/JSONL thành 0..N tri thức chuẩn
 */
function extractDocsFromObject(obj, fileLabel, idx, isUserCustom = true) {
  const out = [];
  if (!obj || typeof obj !== 'object') return out;

  // 1. ChatML format: { messages: [{role:'user', content}, {role:'assistant', content}] }
  if (Array.isArray(obj.messages)) {
    const userMsg = obj.messages.find(m => m.role === 'user')?.content;
    const asstMsg = obj.messages.find(m => m.role === 'assistant')?.content;
    if (userMsg && asstMsg && asstMsg.length >= 18) {
      const lang = obj.language || (nlp.detectLanguage(asstMsg) === 'en' ? 'en' : 'vi');
      out.push({
        id: obj.id || `${fileLabel}_CHAT_${idx}`,
        source: isUserCustom ? 'CUSTOM_DROPIN_JSONL' : 'HOA_LO_DATASET_QA',
        fileLabel,
        zoneId: obj.zone_id || null,
        zoneName: obj.zone_vi || null,
        toneLevel: obj.tone_level || null,
        question: cleanWhitespace(userMsg),
        answer: cleanWhitespace(asstMsg),
        lang,
        intent: 'HISTORICAL_FACT',
        isUserCustom,
        priorityBoost: isUserCustom ? 0.065 : 0.04
      });
    }
    return out;
  }

  // 2. Q&A standard format (QA_Z*.jsonl, custom Q&A JSON/CSV)
  const q = obj.question || obj.cau_hoi || obj.prompt || obj.query || obj.q || obj.common_misconception || '';
  const a = obj.answer || obj.tra_loi || obj.reference_answer || obj.ideal_answer || obj.expected_answer || obj.golden_answer || obj.tactful_correction_vi || obj.content || obj.text || obj.story || obj.fact_vi || '';
  if (q && a && String(a).trim().length >= 18) {
    const lang = obj.language || (nlp.detectLanguage(a) === 'en' ? 'en' : 'vi');
    const artifactPrefix = obj.artifact ? `${obj.artifact}: ` : '';
    const answerText = obj.tactful_correction_vi && obj.truth && !obj.tactful_correction_vi.includes(obj.truth.slice(0, 30))
      ? `${cleanWhitespace(obj.tactful_correction_vi)} ${cleanWhitespace(obj.truth)}`
      : cleanWhitespace(a);
    out.push({
      id: obj.id || obj.myth_id || obj.story_id || `${fileLabel}_QA_${idx}`,
      source: isUserCustom ? 'CUSTOM_DROPIN_QA' : (obj.myth_id ? 'MYTH_BUSTER' : 'HOA_LO_DATASET_QA'),
      fileLabel,
      zoneId: obj.zone_id || null,
      zoneName: obj.zone_vi || null,
      artifact: obj.artifact || null,
      toneLevel: obj.tone_level || null,
      question: cleanWhitespace(`${artifactPrefix}${q}`),
      answer: answerText,
      lang,
      intent: 'HISTORICAL_FACT',
      isUserCustom,
      priorityBoost: isUserCustom ? 0.065 : (obj.myth_id ? 0.055 : 0.045)
    });
    return out;
  }

  // 3. Passage / Fact / Story format: { title|topic, content|text|story|summary|fact_vi }
  const title = obj.title || obj.topic || obj.name || obj.artifact || obj.zone_vi || '';
  const body = obj.story || obj.fact_vi || obj.content || obj.text || obj.summary || '';
  if (title && body && String(body).trim().length >= 20) {
    out.push({
      id: obj.id || obj.story_id || obj.card_id || `${fileLabel}_FACT_${idx}`,
      source: isUserCustom ? 'CUSTOM_DROPIN_FACT' : (obj.story_id ? 'MICRO_STORY' : 'GOLDEN_FACT_P0'),
      fileLabel,
      zoneId: obj.zone_id || (Array.isArray(obj.zone_ids) ? obj.zone_ids[0] : null),
      zoneName: obj.zone_vi || null,
      toneLevel: obj.tone_level || null,
      topic: cleanWhitespace(title),
      question: cleanWhitespace(`${title} ${String(body).slice(0, 140)}`),
      answer: cleanWhitespace(body),
      lang: 'vi',
      intent: 'HISTORICAL_FACT',
      isUserCustom,
      priorityBoost: isUserCustom ? 0.06 : (obj.story_id ? 0.035 : 0.055)
    });
    if (obj.fact_en && String(obj.fact_en).trim().length >= 20) {
      out.push({
        id: `${obj.id || fileLabel}_EN_${idx}`,
        source: isUserCustom ? 'CUSTOM_DROPIN_FACT_EN' : 'GOLDEN_FACT_P0_EN',
        fileLabel,
        zoneId: obj.zone_id || (Array.isArray(obj.zone_ids) ? obj.zone_ids[0] : null),
        topic: cleanWhitespace(title),
        question: cleanWhitespace(`${title} ${String(obj.fact_en).slice(0, 140)}`),
        answer: cleanWhitespace(obj.fact_en),
        lang: 'en',
        intent: 'HISTORICAL_FACT',
        isUserCustom,
        priorityBoost: isUserCustom ? 0.06 : 0.05
      });
    }
  }

  return out;
}

/**
 * Nạp 1 file bất kỳ (JSON / JSONL / CSV / TXT / MD)
 */
function parseAnyKnowledgeFile(filePath, { isUserCustom = true, zoneTones = null } = {}) {
  const docs = [];
  const ext = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath);
  const fileLabel = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Bỏ qua file hướng dẫn/manifest
  if (/^(readme|huong_dan|manifest)/i.test(baseName)) return docs;

  let raw = '';
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.warn(`[CustomKnowledgeLoader] Không đọc được ${filePath}: ${err.message}`);
    return docs;
  }
  if (!raw || raw.trim().length < 15) return docs;

  if (ext === '.txt' || ext === '.md') {
    return parseTextOrMarkdownDocument(raw, fileLabel, isUserCustom);
  }

  if (ext === '.csv') {
    const rows = parseCSVLoose(raw);
    rows.forEach((r, idx) => {
      docs.push(...extractDocsFromObject(r, fileLabel, idx + 1, isUserCustom));
    });
    return docs;
  }

  if (ext === '.jsonl') {
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 2);
    lines.forEach((line, idx) => {
      try {
        const obj = JSON.parse(line);
        if (zoneTones && obj.zone_id && obj.tone_level) zoneTones.set(obj.zone_id, obj.tone_level);
        docs.push(...extractDocsFromObject(obj, fileLabel, idx + 1, isUserCustom));
      } catch {}
    });
    return docs;
  }

  if (ext === '.json') {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.warn(`[CustomKnowledgeLoader] JSON lỗi cú pháp tại ${baseName}: ${err.message}`);
      return docs;
    }

    // 1. Zone JSON chuẩn (01_tri_thuc_theo_phan_khu/Z*.json)
    if (data && !Array.isArray(data) && Array.isArray(data.atomic_fact_cards)) {
      const zId = data.zone_id || fileLabel;
      const zName = data.zone_vi || zId;
      const tone = data.tone_level || null;
      if (zoneTones && zId && tone) zoneTones.set(zId, tone);

      if (data.summary && data.summary.length >= 25) {
        const people = Array.isArray(data.notable_people) && data.notable_people.length
          ? ` Nhân vật tiêu biểu: ${data.notable_people.join(', ')}.`
          : '';
        docs.push({
          id: `${zId}_SUMMARY`,
          source: isUserCustom ? 'CUSTOM_DROPIN_ZONE' : 'ZONE_SUMMARY',
          fileLabel,
          zoneId: zId,
          zoneName: zName,
          toneLevel: tone,
          topic: zName,
          question: `${zName} tổng quan phân khu ${(data.notable_people || []).join(' ')}`,
          answer: cleanWhitespace(`${data.summary}${people}`),
          lang: 'vi',
          intent: 'HISTORICAL_FACT',
          isUserCustom,
          priorityBoost: isUserCustom ? 0.06 : 0.035
        });
      }

      data.atomic_fact_cards.forEach((card, idx) => {
        const factsJoined = Array.isArray(card.verified_facts) ? card.verified_facts.join(' ') : '';
        if (factsJoined.length < 20) return;
        docs.push({
          id: card.card_id || `${zId}_F${idx + 1}`,
          source: isUserCustom ? 'CUSTOM_DROPIN_FACT_CARD' : 'ZONE_FACT_CARD',
          fileLabel,
          zoneId: zId,
          zoneName: zName,
          toneLevel: tone,
          topic: card.topic || zName,
          question: cleanWhitespace(`${zName} - ${card.topic || ''}: ${factsJoined.slice(0, 160)}`),
          answer: cleanWhitespace(factsJoined),
          lang: 'vi',
          intent: 'HISTORICAL_FACT',
          isUserCustom,
          priorityBoost: isUserCustom ? 0.065 : 0.045
        });
      });
      return docs;
    }

    // 2. Golden Facts P0 JSON
    if (data && Array.isArray(data.golden_facts)) {
      data.golden_facts.forEach((gf, idx) => {
        docs.push(...extractDocsFromObject(gf, fileLabel, idx + 1, isUserCustom));
      });
      return docs;
    }

    // 3. Micro-Stories JSON (chuyen_nho_it_biet.json)
    if (data && Array.isArray(data.stories)) {
      data.stories.forEach((st, idx) => {
        docs.push(...extractDocsFromObject(st, fileLabel, idx + 1, isUserCustom));
      });
      return docs;
    }

    // 4. Myth Busters JSON (giai_ma_nham_lan_thuong_gap.json)
    if (data && Array.isArray(data.myth_busters)) {
      data.myth_busters.forEach((mb, idx) => {
        docs.push(...extractDocsFromObject(mb, fileLabel, idx + 1, isUserCustom));
      });
      return docs;
    }

    // 5. Generic JSON Array hoặc Object chứa mảng items/qa/facts/records
    const arr = Array.isArray(data)
      ? data
      : (data.items || data.qa || data.facts || data.records || data.data || null);
    if (Array.isArray(arr)) {
      arr.forEach((item, idx) => {
        docs.push(...extractDocsFromObject(item, fileLabel, idx + 1, isUserCustom));
      });
    } else if (data && typeof data === 'object') {
      docs.push(...extractDocsFromObject(data, fileLabel, 1, isUserCustom));
    }
  }

  return docs;
}

/**
 * Nạp toàn bộ bộ tri thức nâng cao:
 * - `data/dataset_hoa_lo_vi/` (chọn lọc thư mục 01, 02, 04 để tránh trùng lặp chéo 05/06)
 * - `data/custom/` (quét ĐỆ QUY toàn bộ mọi file người dùng thả vào!)
 */
function loadDynamicKnowledgePacks(dataDir) {
  const docs = [];
  const seen = new Set();
  const zoneTones = new Map();
  const stats = {
    datasetHoaLoViDocs: 0,
    customDocs: 0,
    customFiles: [],
    zonesLoaded: 0,
    bySource: {}
  };

  const pushUnique = (doc, bucket) => {
    if (!doc || !doc.question || !doc.answer) return;
    const normQ = nlp.normalize(doc.question);
    const normA = nlp.normalize(doc.answer).slice(0, 90);
    if (normQ.length < 4 || normA.length < 12) return;
    const key = `${doc.lang || 'vi'}|${normQ.slice(0, 120)}|${normA}`;
    if (seen.has(key)) return;
    seen.add(key);
    docs.push(doc);
    if (bucket === 'hoa_lo_vi') stats.datasetHoaLoViDocs++;
    if (bucket === 'custom') stats.customDocs++;
    stats.bySource[doc.source] = (stats.bySource[doc.source] || 0) + 1;
  };

  // 1. Nạp gói chuẩn dataset_hoa_lo_vi (01 + 02 + 04 — không nạp trùng 05/06 vốn là cùng 1.000 câu chia chéo)
  const hoaLoViRoot = path.join(dataDir, 'dataset_hoa_lo_vi');
  if (fs.existsSync(hoaLoViRoot)) {
    const selectedSubdirs = [
      '01_tri_thuc_theo_phan_khu',
      '02_chuyen_nho_va_giai_ma_hieu_nham',
      '04_hoi_dap_theo_phan_khu'
    ];
    for (const sub of selectedSubdirs) {
      const subDir = path.join(hoaLoViRoot, sub);
      for (const f of walkFiles(subDir)) {
        const parsed = parseAnyKnowledgeFile(f, { isUserCustom: false, zoneTones });
        parsed.forEach(d => pushUnique(d, 'hoa_lo_vi'));
      }
    }
    stats.zonesLoaded = zoneTones.size;
  }

  // 2. Nạp ĐỆ QUY toàn bộ thư mục Plug-and-Play `data/custom/`
  const customRoot = path.join(dataDir, 'custom');
  if (fs.existsSync(customRoot)) {
    const customFilePaths = walkFiles(customRoot);
    for (const f of customFilePaths) {
      const base = path.basename(f);
      if (/^(readme|huong_dan|manifest)/i.test(base)) continue;
      const parsed = parseAnyKnowledgeFile(f, { isUserCustom: true, zoneTones });
      if (parsed.length > 0) {
        stats.customFiles.push(path.relative(customRoot, f));
        parsed.forEach(d => pushUnique(d, 'custom'));
      }
    }
  }

  return { docs, zoneTones, stats };
}

/**
 * Tạo dấu vân tay nhẹ (filename + size + mtime) của thư mục `custom/` để phát hiện thay đổi ổn định trên cả Windows & Linux VM
 */
function computeFolderSignature(dirPath) {
  if (!fs.existsSync(dirPath)) return '';
  const files = walkFiles(dirPath);
  return files
    .map(f => {
      try {
        const st = fs.statSync(f);
        return `${path.relative(dirPath, f)}:${st.size}:${Math.floor(st.mtimeMs)}`;
      } catch {
        return '';
      }
    })
    .filter(Boolean)
    .join('|');
}

module.exports = {
  parseTextOrMarkdownDocument,
  parseAnyKnowledgeFile,
  loadDynamicKnowledgePacks,
  computeFolderSignature
};
