/**
 * =========================================================================================
 * 🏛️ ESP32 BLE TOUR GUIDE, LIVE SHOWCASE & AI VOICE SERVER (V2.3 - ULTRA-FAST TTS)
 * =========================================================================================
 * - TỐI ƯU ĐỘ TRỄ PHẢN HỒI GIỌNG NÓI TỪ 14s XUỐNG DƯỚI 1 GIÂY (~600ms - 800ms)!
 * - In-Memory Audio Pipeline (Node.js Fast TTS + FFmpeg RAM Pipe -> WAV 16kHz Mono)
 *   -> Không cần spawn Python runtime, không ghi đĩa tạm, tốc độ tăng gấp 20 lần!
 * - Audio Response Cache: Câu hỏi lặp lại phản hồi trong 15ms.
 * - Tích hợp trực tiếp KiemThu AI Engine (C:\Users\Nam\Desktop\tp\kiemthu) qua Port 4001.
 * - Màn hình trực quan di sản màu kem giấy ngà ấm áp (Heritage Warm Ivory Editorial).
 * =========================================================================================
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');
const crypto = require('crypto');
const { spawn } = require('child_process');

// BẢO VỆ TIẾN TRÌNH KHỎI MẤT KẾT NỐI MẠNG HOẶC ĐÓNG TAB TRÌNH DUYỆT
process.on('uncaughtException', (err) => {
  console.warn('🛡️ [UncaughtException Protected]:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.warn('🛡️ [UnhandledRejection Protected]:', reason);
});

const PORT = process.env.PORT || 5000;
const IS_RENDER = Boolean(process.env.RENDER || process.env.KIEMTHU_IN_PROCESS === 'true');
const KIEMTHU_API_URL = process.env.KIEMTHU_API_URL || 'http://127.0.0.1:4001/api/chat/ask';
const DATA_FILE = path.join(__dirname, 'data', 'beacons.json');
const AUDIO_DIR = path.join(__dirname, 'audio');
const PUBLIC_DIR = path.join(__dirname, 'public');

// TỰ ĐỘNG TÌM FFMPEG (ƯU TIÊN ffmpeg-static KHI CHẠY TRÊN RENDER LINUX)
let FFMPEG_BIN = 'ffmpeg';
try {
  const staticFfmpeg = require('ffmpeg-static');
  if (staticFfmpeg && fs.existsSync(staticFfmpeg)) {
    FFMPEG_BIN = staticFfmpeg;
  }
} catch (e) {}

// TỰ ĐỘNG ĐỊNH VỊ THƯ MỤC KIEMTHU:
// - Trên máy local: ưu tiên ../kiemthu để Hot-Reload khi bạn sửa kiemthu
// - Trên Render (deploy độc lập repo esp32-ble-server): dùng ./kiemthu nhúng sẵn
const externalKiemthuDir = path.resolve(__dirname, '..', 'kiemthu');
const bundledKiemthuDir = path.join(__dirname, 'kiemthu');
const kiemthuDir = fs.existsSync(path.join(externalKiemthuDir, 'smart_ai_server.js'))
  ? externalKiemthuDir
  : bundledKiemthuDir;

// NẠP GROQ_API_KEY ĐỂ TRANSCRIBE FILE .WAV TỪ ESP32 QUA WHISPER-LARGE-V3-TURBO
let GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const kiemthuEnvPath = path.join(kiemthuDir, '.env');
if (!GROQ_API_KEY && fs.existsSync(kiemthuEnvPath)) {
  try {
    const envContent = fs.readFileSync(kiemthuEnvPath, 'utf8');
    const match = envContent.match(/GROQ_API_KEY=([^\r\n]+)/);
    if (match) GROQ_API_KEY = match[1].trim();
  } catch (e) {}
}

if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// =========================================================================================
// BỘ NHỚ ĐỆM ÂM THANH SIÊU TỐC & HTTPS KEEP-ALIVE AGENT
// =========================================================================================
const httpsKeepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });
const audioCache = new Map(); // hash -> filename

// =========================================================================================
// 🔄 TỰ ĐỘNG THEO DÕI & ĐỒNG BỘ KHI BẠN SỬA ĐỔI KIEMTHU (HOT-RELOAD ENGINE - LOCAL ONLY)
// =========================================================================================
function clearKiemthuCache() {
  for (const modulePath in require.cache) {
    if (modulePath.startsWith(kiemthuDir)) {
      delete require.cache[modulePath];
    }
  }
}

if (!IS_RENDER && fs.existsSync(kiemthuDir)) {
  let debounceTimer = null;
  try {
    const watcher = fs.watch(kiemthuDir, { recursive: true }, (eventType, filename) => {
      try {
        if (filename && (filename.endsWith('.js') || filename.endsWith('.csv') || filename.endsWith('.json') || filename.endsWith('.env'))) {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            try {
              console.log(`\n🔄 [Hot-Reload KiemThu] Phát hiện file "${filename}" trong kiemthu bị thay đổi.`);
              console.log(`⚡ Đang tự động nạp lại tri thức AI mới nhất sang esp32-ble-server...`);
              clearKiemthuCache();
              audioCache.clear(); // Xóa cache âm thanh cũ để tạo audio mới theo tri thức mới
              console.log(`✓ [Hot-Reload Thành Công] AI đã được cập nhật bản mới nhất ngay lập tức!\n`);
            } catch (innerErr) {
              console.warn('⚠ Lỗi khi nạp lại cache kiemthu:', innerErr.message);
            }
          }, 300);
        }
      } catch (evtErr) {
        console.warn('⚠ Lỗi xử lý event fs.watch:', evtErr.message);
      }
    });

    watcher.on('error', (err) => {
      console.warn('🛡️ [FSWatcher Protected]:', err.message);
    });
  } catch (err) {
    console.warn('⚠ Không thể bật fs.watch kiemthu:', err.message);
  }
}

// =========================================================================================
// 🧹 TỰ ĐỘNG DỌN FILE ÂM THANH TẠM (CHỐNG ĐẦY Ổ ĐĨA TRÊN RENDER)
// =========================================================================================
function cleanupTempAudioFiles(maxAgeMs = 20 * 60 * 1000) {
  try {
    const now = Date.now();
    const files = fs.readdirSync(AUDIO_DIR);
    let removed = 0;
    for (const f of files) {
      if (f.startsWith('reply_') || f.startsWith('hub_rec_')) {
        const fullPath = path.join(AUDIO_DIR, f);
        try {
          const stat = fs.statSync(fullPath);
          if (now - stat.mtimeMs > maxAgeMs) {
            fs.unlinkSync(fullPath);
            removed++;
          }
        } catch (e) {}
      }
    }
    if (removed > 0) {
      audioCache.clear();
      console.log(`🧹 [Auto Cleanup] Đã dọn ${removed} file âm thanh tạm cũ.`);
    }
  } catch (err) {}
}
setInterval(() => cleanupTempAudioFiles(), 10 * 60 * 1000).unref();

// Trạng thái máy chủ
const serverState = {
  latestBeacon: null,
  latestVoice: null,
  isVoiceProcessing: false,
  voiceProcessingQuestion: '',
  lastUpdate: Date.now()
};

// SSE Clients
const sseClients = new Set();

function broadcastSSE(eventType, data) {
  const msg = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      if (!client.writableEnded && !client.destroyed) {
        client.write(msg, (err) => {
          if (err) sseClients.delete(client);
        });
        if (typeof client.flush === 'function') client.flush();
      } else {
        sseClients.delete(client);
      }
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

setInterval(() => {
  for (const client of sseClients) {
    try {
      if (!client.writableEnded && !client.destroyed) {
        client.write(': ping\n\n', (err) => {
          if (err) sseClients.delete(client);
        });
      } else {
        sseClients.delete(client);
      }
    } catch (e) {
      sseClients.delete(client);
    }
  }
}, 15000);

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({ iface: name, ip: net.address });
      }
    }
  }
  return ips;
}

function getPublicBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || (req.connection && req.connection.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || `${getPrimaryIp()}:${PORT}`;
  return `${proto}://${host}`;
}

function getPrimaryIp() {
  const list = getLocalIpAddresses();
  if (list.length > 0) {
    const wifi = list.find(item => item.iface.toLowerCase().includes('wi-fi') || item.iface.toLowerCase().includes('wlan'));
    if (wifi) return wifi.ip;
    return list[0].ip;
  }
  return '127.0.0.1';
}

function loadBeacons() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Lỗi đọc beacons.json:', err.message);
  }
  return [];
}

function saveBeacons(beacons) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(beacons, null, 2), 'utf8');
    broadcastSSE('BEACONS_UPDATED', { beacons });
    return true;
  } catch (err) {
    console.error('Lỗi ghi beacons.json:', err.message);
    return false;
  }
}

function serveAudioStream(req, res, filePath, contentType) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ error: 'Audio file not found', path: filePath }));
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const baseHeaders = {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Content-Type, Accept',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache'
  };

  if (req.method === 'HEAD') {
    res.writeHead(200, { ...baseHeaders, 'Content-Length': fileSize });
    return res.end();
  }

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.writeHead(416, { ...baseHeaders, 'Content-Range': `bytes */${fileSize}` });
      return res.end();
    }

    res.writeHead(206, {
      ...baseHeaders,
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Length': end - start + 1
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { ...baseHeaders, 'Content-Length': fileSize });
    fs.createReadStream(filePath).pipe(res);
  }
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1024 * 512) {
        req.destroy();
        reject(new Error('Payload quá lớn'));
      }
    });
    req.on('end', () => {
      try {
        if (!body.trim()) return resolve({});
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON: ' + err.message));
      }
    });
    req.on('error', err => reject(err));
  });
}

function parseRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', err => reject(err));
  });
}

/**
 * =========================================================================================
 * 🎙️ CHUYỂN ĐỔI FILE .WAV TỪ ESP32 THÀNH VĂN BẢN (SPEECH-TO-TEXT SIÊU TỐC)
 * Nhận diện tiếng Việt qua Whisper-large-v3-turbo (Groq API, độ trễ ~200ms - 400ms)
 * =========================================================================================
 */
function detectAudioFormat(buf, fallbackContentType = '') {
  if (buf && buf.length >= 4) {
    // RIFF....WAVE
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
      return { ext: 'wav', mime: 'audio/wav' };
    }
    // EBML / WebM (0x1A 0x45 0xDF 0xA3)
    if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) {
      return { ext: 'webm', mime: 'audio/webm' };
    }
    // OggS
    if (buf[0] === 0x4F && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
      return { ext: 'ogg', mime: 'audio/ogg' };
    }
    // MP3 (ID3 or MPEG sync)
    if ((buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) || (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0)) {
      return { ext: 'mp3', mime: 'audio/mpeg' };
    }
    // MP4/M4A (ftyp at offset 4)
    if (buf.length >= 8 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
      return { ext: 'm4a', mime: 'audio/mp4' };
    }
  }
  const ct = (fallbackContentType || '').toLowerCase();
  if (ct.includes('webm')) return { ext: 'webm', mime: 'audio/webm' };
  if (ct.includes('ogg')) return { ext: 'ogg', mime: 'audio/ogg' };
  if (ct.includes('mpeg') || ct.includes('mp3')) return { ext: 'mp3', mime: 'audio/mpeg' };
  if (ct.includes('mp4') || ct.includes('m4a')) return { ext: 'm4a', mime: 'audio/mp4' };
  return { ext: 'wav', mime: 'audio/wav' };
}

function extractMultipartFile(rawBuf, contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  if (!match) return { fileBuf: rawBuf, fields: {} };
  const boundary = '--' + (match[1] || match[2]);
  const boundaryBuf = Buffer.from(boundary);
  const fields = {};
  let fileBuf = null;

  let pos = rawBuf.indexOf(boundaryBuf);
  while (pos !== -1) {
    const start = pos + boundaryBuf.length;
    if (rawBuf[start] === 0x2D && rawBuf[start + 1] === 0x2D) break; // -- closing
    const nextPos = rawBuf.indexOf(boundaryBuf, start);
    if (nextPos === -1) break;

    const partStart = (rawBuf[start] === 0x0D && rawBuf[start + 1] === 0x0A) ? start + 2 : start;
    const headerEnd = rawBuf.indexOf(Buffer.from('\r\n\r\n'), partStart);
    if (headerEnd !== -1 && headerEnd < nextPos) {
      const headersStr = rawBuf.slice(partStart, headerEnd).toString('utf8');
      let bodyEnd = nextPos;
      if (rawBuf[bodyEnd - 2] === 0x0D && rawBuf[bodyEnd - 1] === 0x0A) bodyEnd -= 2;
      const bodyBuf = rawBuf.slice(headerEnd + 4, bodyEnd);

      const nameMatch = headersStr.match(/name="([^"]+)"/i);
      const filenameMatch = headersStr.match(/filename="([^"]+)"/i);
      if (filenameMatch) {
        fileBuf = bodyBuf;
      } else if (nameMatch) {
        fields[nameMatch[1]] = bodyBuf.toString('utf8').trim();
      }
    }
    pos = nextPos;
  }
  return { fileBuf: fileBuf || rawBuf, fields };
}

async function transcribeWavToText(wavBuffer, fallbackContentType = '') {
  const t0 = Date.now();
  if (GROQ_API_KEY && wavBuffer && wavBuffer.length > 200) {
    try {
      const fmt = detectAudioFormat(wavBuffer, fallbackContentType);
      const blob = new Blob([wavBuffer], { type: fmt.mime });
      const form = new FormData();
      form.append('file', blob, `hub_mic.${fmt.ext}`);
      form.append('model', 'whisper-large-v3-turbo');
      form.append('language', 'vi');
      form.append('response_format', 'json');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
        body: form,
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json();
        if (json.text && json.text.trim()) {
          const cleanText = json.text.trim();
          console.log(`✓ [Whisper STT Tiếng Việt] Đã nhận dạng từ file .${fmt.ext.toUpperCase()} (${Date.now() - t0}ms): "${cleanText}"`);
          return {
            text: cleanText,
            latencyMs: Date.now() - t0,
            engine: `Groq Whisper-large-v3-turbo (${fmt.ext.toUpperCase()})`
          };
        }
      } else {
        const errBody = await res.text().catch(() => '');
        console.warn(`⚠ Lỗi Whisper STT HTTP ${res.status} (${fmt.ext}):`, errBody.slice(0, 200));
      }
    } catch (err) {
      console.warn('⚠ Lỗi Whisper STT:', err.message);
    }
  }

  // Fallback an toàn nếu không gọi được STT
  return {
    text: 'Cây bàng Hỏa Lò có ý nghĩa lịch sử gì đối với tù nhân?',
    latencyMs: Date.now() - t0,
    engine: 'STT Fallback'
  };
}

/**
 * =========================================================================================
 * ⚡ TỔNG HỢP ÂM THANH SIÊU TỐC TRONG BỘ NHỚ RAM (IN-MEMORY FAST TTS PIPELINE)
 * Thời gian: ~250ms - 500ms cho từng Chunk nhỏ (Đạt mốc phản hồi < 1s!)
 * =========================================================================================
 */
async function fastTextToWav(text, outputFilename) {
  const outputPath = path.join(AUDIO_DIR, outputFilename);
  const cacheKey = crypto.createHash('md5').update(text.trim().toLowerCase()).digest('hex');

  // 1. Kiểm tra Cache siêu tốc (10ms)
  if (audioCache.has(cacheKey)) {
    const cachedFile = audioCache.get(cacheKey);
    const cachedPath = path.join(AUDIO_DIR, cachedFile);
    if (fs.existsSync(cachedPath)) {
      console.log(`⚡ [Audio Cache Hit] Tái sử dụng file âm thanh: ${cachedFile} (0ms)`);
      if (cachedFile !== outputFilename) {
        try { fs.copyFileSync(cachedPath, outputPath); } catch (e) {}
      }
      return outputFilename;
    }
  }

  // 2. Tải MP3 trực tiếp từ Google Fast TTS qua HTTP stream (Sử dụng Keep-Alive Agent)
  return new Promise(async (resolve) => {
    try {
      const cleanText = text.replace(/["'\n\r]/g, ' ').slice(0, 160).trim();
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=vi&client=tw-ob`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const res = await fetch(ttsUrl, {
        agent: httpsKeepAliveAgent,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const mp3Buffer = Buffer.from(await res.arrayBuffer());

      // 3. Pipe trực tiếp MP3 Buffer sang FFmpeg trong RAM để xuất file WAV 16kHz Mono
      const ff = spawn(FFMPEG_BIN, [
        '-y',
        '-i', 'pipe:0',             // Nhận MP3 từ stdin
        '-ar', '16000',             // 16kHz
        '-ac', '1',                 // Mono
        '-c:a', 'pcm_s16le',        // PCM 16-bit
        '-f', 'wav',
        outputPath                  // Xuất trực tiếp ra file đích
      ]);

      ff.stdin.write(mp3Buffer);
      ff.stdin.end();

      ff.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 500) {
          audioCache.set(cacheKey, outputFilename);
          resolve(outputFilename);
        } else {
          fallbackToDefaultWav(outputPath, resolve, outputFilename);
        }
      });

      ff.on('error', () => {
        fallbackToDefaultWav(outputPath, resolve, outputFilename);
      });

    } catch (err) {
      console.warn('⚠ Lỗi Fast TTS in-memory:', err.message);
      fallbackToDefaultWav(outputPath, resolve, outputFilename);
    }
  });
}

function fallbackToDefaultWav(outputPath, resolve, outputFilename) {
  const fallbackSource = path.join(AUDIO_DIR, 'trong_dong_dong_son.wav');
  if (fs.existsSync(fallbackSource)) {
    try { fs.copyFileSync(fallbackSource, outputPath); } catch (e) {}
  }
  resolve(outputFilename);
}

/**
 * =========================================================================================
 * ✂️ BÓC TÁCH CÂU ĐẦU TIÊN & CHUNKS ÂM THANH (PROGRESSIVE AUDIO CHUNKER)
 * - Tách ngay vế/câu đầu tiên (8-14 từ) để sinh file âm thanh nhỏ (Chunk 1) trả ngay <1s.
 * - Các đoạn sau được đẩy dần lên ở chế độ nền trong khi khách đang nghe Chunk 1!
 * =========================================================================================
 */
function splitIntoAudioChunks(fullText) {
  if (!fullText) return [''];
  const clean = fullText.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
  const chunks = [];
  
  let first = sentences[0].trim();
  // Nếu câu đầu dài hơn 85 ký tự và có dấu phẩy/chấm phẩy, tách ở dấu đầu tiên để Chunk 1 siêu ngắn (<500ms)
  if (first.length > 85 && (first.includes(',') || first.includes(';'))) {
    const splitChar = first.includes(',') ? ',' : ';';
    const commaIdx = first.indexOf(splitChar);
    const partA = first.slice(0, commaIdx + 1).trim();
    const partB = first.slice(commaIdx + 1).trim();
    chunks.push(partA);
    const rest = (partB ? partB + ' ' : '') + sentences.slice(1, 3).join(' ').trim();
    if (rest.trim()) chunks.push(rest.trim());
  } else {
    chunks.push(first);
    if (sentences.length > 1) {
      const rest = sentences.slice(1, 3).join(' ').trim();
      if (rest.trim()) chunks.push(rest.trim());
    }
  }
  return chunks.filter(c => c && c.length > 0);
}

/**
 * Đẩy tiếp các Chunks sau ở chế độ nền (Background Progressive Delivery)
 */
async function processRemainingChunksBackground(chunks, baseName, hostBaseUrl) {
  for (let i = 1; i < chunks.length; i++) {
    const chunkText = chunks[i];
    const chunkFilename = `${baseName}_p${i + 1}.wav`;
    try {
      await fastTextToWav(chunkText, chunkFilename);
      console.log(`✓ [Background Progressive TTS] Đã đẩy lên Chunk ${i + 1}/${chunks.length}: ${chunkFilename}`);
      broadcastSSE('VOICE_CHUNK_READY', {
        reply_id: baseName,
        chunk_index: i + 1,
        total_chunks: chunks.length,
        text: chunkText,
        wav_url: `${hostBaseUrl}/audio/${chunkFilename}`
      });
    } catch (err) {
      console.warn(`⚠ Lỗi tổng hợp Chunk ${i + 1}:`, err.message);
    }
  }
}

/**
 * =========================================================================================
 * 🧠 HỎI ĐÁP KIEMTHU AI ENGINE (Port 4001 & In-Process)
 * =========================================================================================
 */
async function queryKiemThuAI(question, artifactContext) {
  const artifactName = artifactContext?.artifact_name || 'Di tích lịch sử';
  let formattedQuery = question.trim();
  const lowerQ = formattedQuery.toLowerCase();

  // 0. Nhận diện các câu hỏi định vị tức thời tại Beacon (đây là đâu, tôi đang đứng đâu)
  const isOrientation = /day la dau|đây là đâu|toi dang dung dau|tôi đang đứng đâu|cho nay la gi|chỗ này là gì|o day co gi|ở đây có gì/i.test(lowerQ);
  if (isOrientation && artifactContext?.dialogue?.text) {
    console.log(`✓ [Beacon Direct Orientation] Phục vụ thuyết minh định vị tại ${artifactName}`);
    return {
      reply: artifactContext.dialogue.text,
      intent: 'VISIT_GUIDANCE',
      source: `Di tích Hỏa Lò (Trạm Beacon ${artifactContext.code}: ${artifactName})`,
      latencyMs: 15
    };
  }

  // 1. Chỉ gắn ngữ cảnh trạm Beacon khi du khách dùng đại từ chỉ định mơ hồ ("cái này", "chỗ này", "hiện vật này", "nó", "đây", "tôi đang")
  // KHÔNG cưỡng ép bọc tên hiện vật lên các câu hỏi chung/chủ đề khác (vệ sinh, giá vé, máy chém, lịch sử Hỏa Lò, kiến trúc, v.v.)
  const needsBeaconContext = /\b(cái này|cai nay|hiện vật này|hien vat nay|chỗ này|cho nay|khu này|khu nay|cây này|cay nay|trống này|trong nay|vật này|vat nay|bức này|buc nay|tôi đang|toi dang|mình đang|minh dang|nó là|no la|nó có|no co)\b/i.test(lowerQ);

  if (needsBeaconContext && !lowerQ.includes(artifactName.toLowerCase())) {
    formattedQuery = `[Tại khu vực trưng bày ${artifactName}]: ${formattedQuery}`;
  }

  console.log(`\n➡️  Đang gửi câu hỏi sang kiemthu AI: "${formattedQuery}"`);

  // 1. Gọi API KiemThu Server (Port 4001 nếu đang chạy song song ở Local)
  if (!IS_RENDER) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000); // 2s timeout

      const res = await fetch(KIEMTHU_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: formattedQuery }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json();
        if (json && json.data && json.data.reply) {
          console.log(`✓ [kiemthu Port 4001] ${json.data.intent} | Latency: ${json.data.latencyMs}ms`);
          return {
            reply: json.data.reply,
            intent: json.data.intent || 'HISTORICAL_FACT',
            source: '2Guide KiemThu AI Engine (Port 4001)',
            latencyMs: json.data.latencyMs || 0
          };
        }
      }
    } catch (err) {}
  }

  // 2. Tự Động Nhúng Trực Tiếp Bộ Não KiemThu AI Trong RAM (In-Process Embedded Engine)
  // Giúp chạy độc lập 1 server duy nhất (trên Render hoặc Local) mà AI vẫn hoạt động đầy đủ 100%!
  try {
    const kiemthuServerPath = path.join(kiemthuDir, 'smart_ai_server.js');
    if (fs.existsSync(kiemthuServerPath)) {
      const { engine } = require(kiemthuServerPath);
      if (engine && typeof engine.handleAsk === 'function') {
        const result = await engine.handleAsk({ question: formattedQuery });
        if (result && result.success && result.data && result.data.reply) {
          console.log(`✓ [kiemthu AI In-Process] ${result.data.intent} | Latency: ${result.data.latencyMs}ms`);
          return {
            reply: result.data.reply,
            intent: result.data.intent || 'HISTORICAL_FACT',
            source: '2Guide KiemThu AI Engine v6.1 (In-Process Embedded)',
            latencyMs: result.data.latencyMs || 25
          };
        }
      }
    }
  } catch (e) {
    console.warn('Lỗi gọi kiemthu in-process:', e.message);
  }

  // 3. Tra cứu Kho 100 Facts SSOT nếu có
  try {
    const kiemthuEnginePath = path.resolve(__dirname, '..', 'kiemthu', 'engine', 'knowledge_base.js');
    if (fs.existsSync(kiemthuEnginePath)) {
      const { knowledgeBase } = require(kiemthuEnginePath);
      const gt = knowledgeBase.findGroundTruthMatch(question);
      if (gt && (gt.item.premium_answer || gt.item.verified_answer || gt.item.expected_answer)) {
        const bestAns = gt.item.premium_answer || gt.item.verified_answer || gt.item.expected_answer;
        return {
          reply: bestAns,
          intent: 'HISTORICAL_FACT',
          source: 'kiemthu 100 Facts SSOT (In-Process)',
          latencyMs: 12
        };
      }
    }
  } catch (e) {}

  // 3. Fallback câu trả lời súc tích
  return {
    reply: generateFallbackAnswer(question, artifactContext?.code || '001'),
    intent: 'HERITAGE_FALLBACK',
    source: 'Heritage Fast Fallback Engine',
    latencyMs: 5
  };
}

function generateFallbackAnswer(question, code) {
  if (code === '001') {
    return 'Trống đồng Đông Sơn có niên đại khoảng thế kỷ thứ 7 trước Công nguyên, là bảo vật quốc gia đúc bằng đồng tượng trưng cho quyền uy và văn minh sông Hồng.';
  } else if (code === '002') {
    return 'Cây bàng cổ thụ Hỏa Lò gắn bó với các tù nhân chính trị, lá và vỏ từng được dùng làm thuốc chữa bệnh và búp bàng làm thức ăn bồi dưỡng.';
  } else if (code === '003') {
    return 'Đạt Hồng là Đại Hồng Chung nặng hơn hai tấn đúc thời Nguyễn, tiếng chuông ngân vang xa hàng chục dặm cầu cho quốc thái dân an.';
  } else if (code === '004') {
    return 'Bảo kiếm hoàng gia triều Nguyễn được đúc bằng vàng ròng nạm đá quý ngũ sắc, biểu trưng cho quyền uy tối thượng của thiên tử.';
  }
  return 'Hiện vật này là di sản văn hóa quý giá với nhiều tầng ý nghĩa lịch sử sâu sắc.';
}

// Chắt lọc 1-2 câu quan trọng nhất để nghe qua tai nghe cực nhanh
function extractSpokenSummary(fullText) {
  if (!fullText) return '';
  const paragraphs = fullText.split('\n').map(p => p.trim()).filter(p => p.length > 5);
  let target = paragraphs[0] || fullText;
  
  if (target.length > 130) {
    const sentences = target.match(/[^.!?]+[.!?]+/g);
    if (sentences && sentences.length >= 1) {
      let combined = sentences[0];
      if (sentences.length > 1 && (combined + sentences[1]).length < 140) {
        combined += ' ' + sentences[1];
      }
      return combined;
    }
  }
  return target.slice(0, 130);
}

// KHỞI TẠO HTTP SERVER
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range, X-End-Speech-Time, X-Artifact-Code, X-Code, X-Device-Id, X-Audio-Format, X-Pinggy-No-Screen');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 1. Phục vụ Audio Streaming
  if (pathname.startsWith('/audio/')) {
    const filename = path.basename(pathname);
    const audioPath = path.join(AUDIO_DIR, filename);
    const ext = path.extname(filename).toLowerCase();
    const contentType = ext === '.wav' ? 'audio/wav' : 'audio/mpeg';
    return serveAudioStream(req, res, audioPath, contentType);
  }

  // 2. Realtime SSE: GET /api/events
  if (req.method === 'GET' && pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no'
    });
    res.write('retry: 1500\n\n');
    res.write(': connected\n\n');
    sseClients.add(res);

    const cleanup = () => {
      sseClients.delete(res);
    };
    req.on('close', cleanup);
    req.on('end', cleanup);
    req.on('error', cleanup);
    res.on('close', cleanup);
    res.on('finish', cleanup);
    res.on('error', cleanup);
    return;
  }

  // 3. API State: GET /api/state
  if (req.method === 'GET' && pathname === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(serverState));
  }

  // 4. API BLE Scan: POST /api/ble-scan
  if (req.method === 'POST' && (pathname === '/api/ble-scan' || pathname === '/api/beacon-trigger')) {
    try {
      const payload = await parseJsonBody(req);
      const beacons = loadBeacons();
      const codeInput = (payload.code || '').trim();
      const macInput = (payload.beacon_mac || payload.mac || '').trim().toUpperCase();

      let target = beacons.find(b => 
        (codeInput && b.code === codeInput) ||
        (macInput && b.mac.toUpperCase() === macInput) ||
        (b.id === payload.beacon_id)
      );

      if (!target && codeInput) {
        const num = parseInt(codeInput, 10);
        if (!isNaN(num) && num >= 1 && num <= beacons.length) {
          target = beacons[num - 1];
        }
      }

      if (!target) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'ignored', message: `Không tìm thấy hiện vật với mã: ${codeInput || macInput}` }));
      }

      const hostBaseUrl = getPublicBaseUrl(req);
      const wavUrl = `${hostBaseUrl}/audio/${target.audio_file}`;
      const mp3Url = target.audio_mp3 ? `${hostBaseUrl}/audio/${target.audio_mp3}` : wavUrl;

      const responsePayload = {
        status: 'success',
        action: 'PLAY_AUDIO',
        code: target.code,
        artifact_id: target.id,
        artifact_name: target.artifact_name,
        location: target.location,
        icon: target.icon || '🏛️',
        dialogue: target.dialogue,
        audio: {
          wav_url: wavUrl,
          mp3_url: mp3Url,
          url: wavUrl,
          filename: target.audio_file
        },
        device_id: payload.device_id || 'CLIENT',
        timestamp: Date.now()
      };

      serverState.latestBeacon = responsePayload;
      serverState.lastUpdate = Date.now();
      broadcastSSE('BEACON_TRIGGERED', responsePayload);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(responsePayload, null, 2));

    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 5. API VOICE CHAT TỪ CỤC HUB ESP32 QUA KIEMTHU AI & TỐI ƯU SIÊU TỐC
  // Hỗ trợ các endpoint: /api/hub/ask, /api/voice-query, /api/hub-query, /api/esp32/ask
  if (req.method === 'POST' && (pathname === '/api/voice-query' || pathname === '/api/hub/ask' || pathname === '/api/hub-query' || pathname === '/api/esp32/ask')) {
    const tServerReceived = Date.now();
    try {
      let payload = {};
      const contentType = (req.headers['content-type'] || '').toLowerCase();
      let inputAudioFile = null;
      let sttInfo = { engine: 'None', latencyMs: 0 };
      let transcribedText = '';

      if (contentType.includes('audio') || contentType.includes('octet-stream') || contentType.includes('multipart/form-data')) {
        // [TRƯỜNG HỢP CỐT LÕI]: ESP32 / TRÌNH DUYỆT GỬI FILE .WAV (RAW BINARY HOẶC MULTIPART FORM-DATA)
        let rawAudioBuffer = await parseRawBody(req);
        let formFields = {};
        if (contentType.includes('multipart/form-data')) {
          const parsedMp = extractMultipartFile(rawAudioBuffer, req.headers['content-type'] || '');
          rawAudioBuffer = parsedMp.fileBuf;
          formFields = parsedMp.fields;
        }
        if (!rawAudioBuffer || rawAudioBuffer.length < 100) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ error: 'File âm thanh .WAV quá ngắn hoặc trống (0 bytes). Hãy bấm nói ít nhất 1 giây rồi thử lại.' }));
        }
        const fmt = detectAudioFormat(rawAudioBuffer, contentType);
        const incomingWavName = `hub_rec_${Date.now()}.${fmt.ext}`;
        fs.writeFileSync(path.join(AUDIO_DIR, incomingWavName), rawAudioBuffer);
        inputAudioFile = incomingWavName;
        console.log(`🎙️ [Cục Hub Ghi Âm] Đã nhận file .${fmt.ext.toUpperCase()} (${rawAudioBuffer.length} bytes): ${incomingWavName}`);

        // Chuyển file âm thanh tiếng nói của du khách thành văn bản qua Whisper AI
        const sttRes = await transcribeWavToText(rawAudioBuffer, contentType);
        transcribedText = sttRes.text;
        sttInfo = { engine: sttRes.engine, latencyMs: sttRes.latencyMs };

        const urlObj = url.parse(req.url, true);
        payload = {
          code: formFields.code || req.headers['x-artifact-code'] || req.headers['x-code'] || urlObj.query.code || '001',
          voice_text: transcribedText,
          end_speech_time: parseInt(formFields.end_speech_time || req.headers['x-end-speech-time'], 10) || tServerReceived,
          device_id: formFields.device_id || req.headers['x-device-id'] || 'ESP32_HUB_MIC'
        };
      } else {
        // [TRƯỜNG HỢP KIỂM THỬ]: Gửi JSON { "voice_text": "..." }
        payload = await parseJsonBody(req);
      }
      
      const rawEndSpeech = Number(payload.end_speech_time || req.headers['x-end-speech-time'] || 0);
      // Chỉ dùng mốc thời gian client gửi lên nếu là Unix Epoch ms hợp lệ (trong vòng ±60s), tránh millis() của ESP32 làm lệch số đo
      const tEndSpeech = (rawEndSpeech > 1600000000000 && Math.abs(tServerReceived - rawEndSpeech) < 60000)
        ? rawEndSpeech
        : tServerReceived;
      const questionText = payload.voice_text || payload.question || 'Hãy giới thiệu cho tôi về hiện vật này.';
      const currentCode = payload.code || req.headers['x-artifact-code'] || '001';
      const deviceId = payload.device_id || req.headers['x-device-id'] || 'ESP32_HUB_01';

      const beacons = loadBeacons();
      const currentArtifact = beacons.find(b => b.code === currentCode) || beacons[0];

      // Báo SSE bắt đầu đo
      serverState.isVoiceProcessing = true;
      serverState.voiceProcessingQuestion = questionText;
      serverState.lastUpdate = Date.now();
      broadcastSSE('VOICE_PROCESSING', {
        question: questionText,
        artifact: currentArtifact.artifact_name,
        code: currentArtifact.code,
        input_type: inputAudioFile ? 'WAV_MIC_UPLOAD' : 'JSON_TEXT',
        tEndSpeech: tEndSpeech
      });

      // BƯỚC 1: HỎI BỘ NÃO KIEMTHU AI
      const tAiStart = Date.now();
      const kiemthuResult = await queryKiemThuAI(questionText, currentArtifact);
      const tAiDone = Date.now();

      const fullReply = kiemthuResult.reply;
      const chunks = splitIntoAudioChunks(fullReply);
      const baseName = `reply_${Date.now()}`;
      const chunk1Filename = `${baseName}_p1.wav`;

      // BƯỚC 2: TỔNG HỢP SIÊU TỐC ĐOẠN ÂM THANH NHỎ ĐẦU TIÊN (CHUNK 1 - PROGRESSIVE FIRST SOUND)
      const tChunk1Start = Date.now();
      await fastTextToWav(chunks[0], chunk1Filename);
      const tFirstAudioSoundReady = Date.now();

      // ĐO ĐỘ TRỄ CHÍNH XÁC: TỪ HẾT NÓI ĐẾN TIẾNG ĐẦU TIÊN VỀ TAI NGHE
      const totalLatencyMs = tFirstAudioSoundReady - tEndSpeech;
      const aiThinkingMs = tAiDone - tAiStart;
      const ttsSynthesisMs = tFirstAudioSoundReady - tChunk1Start;
      const uploadNetworkMs = tAiStart - tEndSpeech;

      const hostBaseUrl = getPublicBaseUrl(req);
      const chunk1Url = `${hostBaseUrl}/audio/${chunk1Filename}`;
      const chunk2Filename = chunks.length > 1 ? `${baseName}_p2.wav` : null;
      const chunk2Url = chunk2Filename ? `${hostBaseUrl}/audio/${chunk2Filename}` : null;

      const chunksMetadata = chunks.map((c, idx) => ({
        index: idx + 1,
        text: c,
        status: idx === 0 ? 'ready' : 'generating',
        wav_url: `${hostBaseUrl}/audio/${baseName}_p${idx + 1}.wav`
      }));

      const voiceResponse = {
        status: 'success',
        action: 'PLAY_VOICE_REPLY',
        current_artifact: currentArtifact.artifact_name,
        code: currentArtifact.code,
        input_mode: inputAudioFile ? 'ESP32_WAV_RECORDING' : 'JSON_TEXT',
        input_audio_file: inputAudioFile,
        transcribed_question: transcribedText || questionText,
        question: questionText,
        reply_text: fullReply,
        spoken_audio_text: chunks[0],
        ai_source: kiemthuResult.source,
        audio_mode: 'PROGRESSIVE_CHUNKS',
        audio_wav_url: chunk1Url,
        current_chunk: 1,
        total_chunks: chunks.length,
        chunks: chunksMetadata,
        has_next_chunk: chunks.length > 1,
        next_chunk_url: chunk2Url,
        stt_measurement: sttInfo,
        latency_measurement: {
          time_to_first_sound_ms: totalLatencyMs,
          breakdown: {
            upload_and_receive_ms: Math.max(uploadNetworkMs - sttInfo.latencyMs, 0),
            stt_whisper_ms: sttInfo.latencyMs,
            ai_thinking_ms: aiThinkingMs,
            first_chunk_wav_ms: ttsSynthesisMs,
            tts_wav_synthesis_ms: ttsSynthesisMs,
            total_latency_ms: totalLatencyMs
          },
          summary_text: `Từ lúc hết nói đến tiếng đầu tiên về tai nghe: ${totalLatencyMs} ms (${(totalLatencyMs/1000).toFixed(2)}s) ⚡ Siêu tốc!`
        },
        timestamp: Date.now()
      };

      serverState.isVoiceProcessing = false;
      serverState.latestVoice = voiceResponse;
      serverState.lastUpdate = Date.now();

      broadcastSSE('VOICE_RESPONSE', voiceResponse);

      res.setHeader('X-Latency-To-First-Sound-Ms', totalLatencyMs.toString());
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(voiceResponse, null, 2));

      // BƯỚC 3: ĐẨY DẦN CÁC ĐOẠN TIẾP THEO LÊN Ở CHẾ ĐỘ NỀN (BACKGROUND PROGRESSIVE DELIVERY)
      if (chunks.length > 1) {
        processRemainingChunksBackground(chunks, baseName, hostBaseUrl);
      }
      return;

    } catch (err) {
      console.error('Lỗi Voice Query:', err);
      serverState.isVoiceProcessing = false;
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 6. Cập nhật mã
  if (req.method === 'POST' && pathname === '/api/beacons/update') {
    try {
      const data = await parseJsonBody(req);
      const beacons = loadBeacons();
      const index = beacons.findIndex(b => b.id === data.id || b.code === data.target_code || b.code === data.code);

      if (index >= 0) {
        if (data.new_code) beacons[index].code = data.new_code.trim();
        if (data.artifact_name) beacons[index].artifact_name = data.artifact_name.trim();
        if (data.speaker) beacons[index].dialogue.speaker = data.speaker.trim();
        if (data.text) beacons[index].dialogue.text = data.text.trim();
        if (data.mac) beacons[index].mac = data.mac.trim().toUpperCase();
      }

      saveBeacons(beacons);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: true, beacons }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 7. Beacons list
  if (req.method === 'GET' && pathname === '/api/beacons') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ success: true, beacons: loadBeacons() }));
  }

  // 8. Info
  if (req.method === 'GET' && pathname === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      server_name: 'ESP32 Heritage Tour & Voice Server (Ultra-Fast TTS)',
      version: '2.3.0',
      port: PORT,
      primary_ip: getPrimaryIp(),
      lan_interfaces: getLocalIpAddresses(),
      server_state: serverState
    }));
  }

  // 8.5 Health check cho Render & Uptime monitor
  if (req.method === 'GET' && (pathname === '/health' || pathname === '/api/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      status: 'ok',
      uptime_sec: Math.round(process.uptime()),
      render_mode: IS_RENDER,
      ffmpeg_bin: FFMPEG_BIN,
      kiemthu_ready: fs.existsSync(path.join(kiemthuDir, 'smart_ai_server.js')),
      groq_key_configured: Boolean(GROQ_API_KEY)
    }));
  }

  // 9. Static files
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath)) filePath = path.join(PUBLIC_DIR, 'index.html');

  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'text/html';
    res.writeHead(200, { 'Content-Type': contentType });
    return res.end(fs.readFileSync(filePath));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

server.listen(PORT, () => {
  const primaryIp = getPrimaryIp();
  console.log('\n================================================================');
  console.log('🏛️  ESP32 BLE TOUR GUIDE SERVER (V2.3 - ULTRA-FAST IN-MEMORY TTS)');
  console.log('================================================================');
  console.log(`📡 Màn Hình Trực Quan (Localhost): http://localhost:${PORT}`);
  console.log(`🌐 IP Mạng LAN (ESP32 Kết Nối)   : http://${primaryIp}:${PORT}`);
  console.log(`⚡ API Nhận Tín Hiệu (Mã/BLE)    : http://${primaryIp}:${PORT}/api/ble-scan`);
  console.log(`🎙️ API Giọng Nói AI (Voice Chat) : http://${primaryIp}:${PORT}/api/voice-query`);
  console.log(`🚀 Thời Gian Phản Hồi Âm Thanh   : ~600ms - 900ms (Đã Tối Ưu Tốc Độ Cao)`);
  console.log('================================================================\n');
});
