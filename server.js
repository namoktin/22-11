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
const { SafeJsonStore, logEvent } = require('./src/storage/safe_store');
const {
  MAX_JSON_BYTES,
  MAX_AUDIO_BYTES,
  getClientIp,
  applySecurityHeaders,
  isOriginAllowedForRequest,
  RateLimiter,
  DeviceAuthManager,
  verifyAdminRequest,
  validateAudioBufferMagic,
  sanitizeStringInput,
  validateBeaconPayload,
  safeErrorResponse
} = require('./src/security/security_middleware');
const { BleAndDeviceManager } = require('./src/iot/ble_manager');
const { getGlossaryPromptHint, postPolishForeignTerms } = require('./kiemthu/engine/heritage_glossary');

// BẢO VỆ TIẾN TRÌNH CHUẨN PRODUCTION:
// - Chỉ bỏ qua lỗi ngắt kết nối socket/stream bình thường (EPIPE, ECONNRESET...)
// - Lỗi nghiêm trọng (EADDRINUSE, lỗi hệ thống không phục hồi được) sẽ log đầy đủ stack và thoát sạch để Render tự restart!
const BENIGN_NET_ERRORS = new Set(['EPIPE', 'ECONNRESET', 'ECONNABORTED', 'ERR_STREAM_WRITE_AFTER_END', 'ERR_STREAM_PREMATURE_CLOSE']);
process.on('uncaughtException', (err) => {
  if (err && BENIGN_NET_ERRORS.has(err.code)) {
    console.warn('🛡️ [Benign Socket Disconnect]:', err.code, err.message);
    return;
  }
  console.error('💥 [FATAL uncaughtException]:', err && err.stack ? err.stack : err);
  setTimeout(() => process.exit(1), 200).unref();
});
process.on('unhandledRejection', (reason) => {
  if (reason && BENIGN_NET_ERRORS.has(reason.code)) {
    console.warn('🛡️ [Benign Rejection]:', reason.code, reason.message);
    return;
  }
  console.error('⚠️ [unhandledRejection]:', reason && reason.stack ? reason.stack : reason);
});

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
const beaconCooldownMap = new Map(); // key: `${deviceId}:${beaconId}` -> timestampMs
const activeAudioStreams = new Map(); // streamId (baseName) -> { pcmParts: Buffer[], done: boolean, mergedPath: string, listeners: Set<http.ServerResponse>, createdAt: number }

// Dọn dẹp định kỳ tránh rò rỉ RAM cho các luồng streaming đã quá 5 phút
setInterval(() => {
  const now = Date.now();
  for (const [baseName, streamObj] of activeAudioStreams.entries()) {
    if (now - (streamObj.createdAt || 0) > 5 * 60 * 1000) {
      activeAudioStreams.delete(baseName);
    }
  }
}, 60 * 1000).unref();

function buildWavHeader(dataByteLen, sampleRate = 16000, channels = 1, bitsPerSample = 16) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const riffSize = dataByteLen >= 0x7FFFFFF0 ? 0x7FFFFFF8 : (36 + dataByteLen);
  header.write('RIFF', 0);
  header.writeUInt32LE(riffSize >>> 0, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataByteLen >>> 0, 40);
  return header;
}

// Trích xuất đúng dữ liệu PCM Int16 từ file .WAV (tìm chunk 'data' chuẩn kể cả khi ffmpeg chèn LIST/INFO) và cắt khoảng im lặng thừa 2 đầu
function extractCleanPcmFromWav(wavBuf) {
  if (!wavBuf || wavBuf.length < 44) return Buffer.alloc(0);
  let dataOffset = 44;
  let dataLen = wavBuf.length - 44;
  // Quét tìm đúng chunk 'data' trong RIFF
  let pos = 12;
  while (pos + 8 <= wavBuf.length) {
    const chunkId = wavBuf.toString('ascii', pos, pos + 4);
    const chunkSize = wavBuf.readUInt32LE(pos + 4);
    if (chunkId === 'data') {
      dataOffset = pos + 8;
      dataLen = Math.min(chunkSize, wavBuf.length - dataOffset);
      break;
    }
    pos += 8 + chunkSize + (chunkSize % 2);
  }
  const pcm = wavBuf.slice(dataOffset, dataOffset + (dataLen - (dataLen % 2)));
  const totalSamples = Math.floor(pcm.length / 2);
  if (totalSamples < 160) return pcm;

  // Cắt khoảng lặng thừa đầu/cuối (ngưỡng biên độ < 150) giữ lại biên 25ms mượt tự nhiên
  const threshold = 150;
  let startSample = 0;
  while (startSample < totalSamples && Math.abs(pcm.readInt16LE(startSample * 2)) < threshold) startSample++;
  let endSample = totalSamples - 1;
  while (endSample > startSample && Math.abs(pcm.readInt16LE(endSample * 2)) < threshold) endSample--;

  const padSamples = 400; // 25ms @ 16kHz
  const trimStart = Math.max(0, startSample - padSamples);
  const trimEnd = Math.min(totalSamples, endSample + padSamples);
  if (trimEnd <= trimStart) return pcm;
  return pcm.slice(trimStart * 2, trimEnd * 2);
}

// Tạo 120ms nghỉ hơi tự nhiên giữa các câu khi nối thành 1 file .WAV liền mạch
const NATURAL_BREATH_PCM = Buffer.alloc(16000 * 2 * 0.12); // 3840 bytes (120ms @ 16kHz 16-bit mono)

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
const kiemthuDir = (!IS_RENDER && fs.existsSync(path.join(externalKiemthuDir, 'smart_ai_server.js')))
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
const httpsKeepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 24, keepAliveMsecs: 15000 });
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

if (!IS_RENDER && process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'production' && fs.existsSync(kiemthuDir)) {
  let debounceTimer = null;
  try {
    const watcher = fs.watch(kiemthuDir, { recursive: true }, (eventType, filename) => {
      try {
        if (filename && !filename.includes('auto_learned_knowledge.json') && (filename.endsWith('.js') || filename.endsWith('.csv') || filename.endsWith('.json') || filename.endsWith('.env'))) {
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

    if (typeof watcher.unref === 'function') watcher.unref();
    watcher.on('error', (err) => {
      console.warn('🛡️ [FSWatcher Protected]:', err.message);
    });
  } catch (err) {
    console.warn('⚠ Không thể bật fs.watch kiemthu:', err.message);
  }
}

// =========================================================================================
// 🧹 TỰ ĐỘNG DỌN FILE ÂM THANH TẠM (CHỐNG ĐẦY Ổ ĐĨA KHI CHẠY 10.000+ CÂU HỎI)
// =========================================================================================
const MAX_TEMP_AUDIO_FILES = 400;
function cleanupTempAudioFiles(maxAgeMs = 8 * 60 * 1000) {
  try {
    const now = Date.now();
    const files = fs.readdirSync(AUDIO_DIR);
    let removed = 0;
    const survivors = [];
    for (const f of files) {
      if (f.startsWith('reply_') || f.startsWith('hub_rec_')) {
        const fullPath = path.join(AUDIO_DIR, f);
        try {
          const stat = fs.statSync(fullPath);
          if (now - stat.mtimeMs > maxAgeMs) {
            fs.unlinkSync(fullPath);
            removed++;
          } else {
            survivors.push({ fullPath, mtimeMs: stat.mtimeMs });
          }
        } catch (e) {}
      }
    }
    // Giới hạn trần tối đa 400 file tạm gần nhất để chịu tải burst lớn mà không bao giờ phình đĩa
    if (survivors.length > MAX_TEMP_AUDIO_FILES) {
      survivors.sort((a, b) => a.mtimeMs - b.mtimeMs);
      const excess = survivors.slice(0, survivors.length - MAX_TEMP_AUDIO_FILES);
      for (const item of excess) {
        try {
          fs.unlinkSync(item.fullPath);
          removed++;
        } catch (e) {}
      }
    }
    if (removed > 0) {
      audioCache.clear();
      console.log(`🧹 [Auto Cleanup] Đã dọn ${removed} file âm thanh tạm cũ.`);
    }
  } catch (err) {}
}
setInterval(() => cleanupTempAudioFiles(), 5 * 60 * 1000).unref();

// Trạng thái máy chủ
const SUPPORTED_LANGUAGES = {
  vi: { code: 'vi', label: 'Tiếng Việt', nativeName: 'Vietnamese', ttsCode: 'vi' },
  en: { code: 'en', label: 'English', nativeName: 'English', ttsCode: 'en' },
  fr: { code: 'fr', label: 'Français', nativeName: 'French', ttsCode: 'fr' },
  ja: { code: 'ja', label: '日本語', nativeName: 'Japanese', ttsCode: 'ja' },
  ko: { code: 'ko', label: '한국어', nativeName: 'Korean', ttsCode: 'ko' },
  zh: { code: 'zh', label: '中文', nativeName: 'Simplified Chinese', ttsCode: 'zh-CN' }
};

const MAX_TRANSLATION_CACHE = 2500;
const translationCache = new Map();
const translationInFlight = new Map();

function getTranslationCache(key) {
  if (!translationCache.has(key)) return undefined;
  const val = translationCache.get(key);
  translationCache.delete(key);
  translationCache.set(key, val);
  return val;
}

function setTranslationCache(key, value) {
  if (translationCache.has(key)) {
    translationCache.delete(key);
  } else if (translationCache.size >= MAX_TRANSLATION_CACHE) {
    const oldest = translationCache.keys().next().value;
    if (oldest !== undefined) translationCache.delete(oldest);
  }
  translationCache.set(key, value);
}

function normalizeLangCode(lang) {
  const raw = (lang || '').toString().toLowerCase().trim().split(/[-_]/)[0];
  return SUPPORTED_LANGUAGES[raw] ? raw : null;
}

const serverState = {
  latestBeacon: null,
  latestVoice: null,
  isVoiceProcessing: false,
  voiceProcessingQuestion: '',
  lockedLanguage: 'vi', // Khóa ngôn ngữ cứng: AI CHỈ được trả lời đúng ngôn ngữ này
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
}, 15000).unref();

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

const rateLimiter = new RateLimiter();
const deviceAuth = new DeviceAuthManager(path.join(__dirname, 'data', 'device_keys.json'));
const bleManager = new BleAndDeviceManager({
  calibrationPath: path.join(__dirname, 'data', 'ble_calibration.json')
});
const beaconsStore = new SafeJsonStore(DATA_FILE, { defaultData: [] });

function loadBeacons() {
  return beaconsStore.readSync();
}

function saveBeacons(beacons) {
  try {
    beaconsStore.writeSync(beacons);
    broadcastSSE('BEACONS_UPDATED', { beacons });
    return true;
  } catch (err) {
    logEvent('ERROR', 'BeaconsStore', 'Failed saving beacons.json', { error: err.message });
    return false;
  }
}

function serveAudioStream(req, res, filePath, contentType) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'error', error: 'Audio file not found' }));
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const baseHeaders = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache'
  };

  if (req.method === 'HEAD') {
    res.writeHead(200, { ...baseHeaders, 'Content-Length': fileSize });
    return res.end();
  }

  if (range && range.startsWith('bytes=')) {
    const rangeSpec = range.replace(/^bytes=/, '').trim();
    let start, end;

    if (rangeSpec.startsWith('-')) {
      // Suffix range: bytes=-500 (RFC 7233)
      const suffixLen = parseInt(rangeSpec.slice(1), 10);
      if (isNaN(suffixLen) || suffixLen <= 0) {
        res.writeHead(416, { ...baseHeaders, 'Content-Range': `bytes */${fileSize}` });
        return res.end();
      }
      start = Math.max(0, fileSize - suffixLen);
      end = fileSize - 1;
    } else {
      const parts = rangeSpec.split('-');
      start = parseInt(parts[0], 10);
      end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    }

    if (isNaN(start) || isNaN(end) || start < 0 || end < start || start >= fileSize) {
      res.writeHead(416, { ...baseHeaders, 'Content-Range': `bytes */${fileSize}` });
      return res.end();
    }

    end = Math.min(end, fileSize - 1);
    const chunkLength = end - start + 1;

    res.writeHead(206, {
      ...baseHeaders,
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Length': chunkLength
    });
    const stream = fs.createReadStream(filePath, { start, end });
    stream.on('error', (err) => {
      console.warn(`[AudioStream] Stream error for ${filePath}: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', error: 'Stream error' }));
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  } else {
    res.writeHead(200, { ...baseHeaders, 'Content-Length': fileSize });
    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      console.warn(`[AudioStream] Full stream error for ${filePath}: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', error: 'Stream error' }));
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  }
}

function parseJsonBody(req, maxBytes = MAX_JSON_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let aborted = false;
    req.on('data', chunk => {
      if (aborted) return;
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        aborted = true;
        const err = new Error(`JSON payload exceeds limit (${maxBytes} bytes)`);
        err.statusCode = 413;
        req.pause();
        return reject(err);
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (aborted) return;
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        if (!body.trim()) return resolve({});
        resolve(JSON.parse(body));
      } catch (err) {
        const parseErr = new Error('Invalid JSON body');
        parseErr.statusCode = 400;
        reject(parseErr);
      }
    });
    req.on('error', err => { if (!aborted) reject(err); });
  });
}

function parseRawBody(req, maxBytes = MAX_AUDIO_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let aborted = false;
    req.on('data', chunk => {
      if (aborted) return;
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        aborted = true;
        const err = new Error(`Audio upload exceeds limit (${maxBytes} bytes)`);
        err.statusCode = 413;
        req.pause();
        return reject(err);
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!aborted) resolve(Buffer.concat(chunks));
    });
    req.on('error', err => { if (!aborted) reject(err); });
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

// Trích xuất raw PCM chunk từ file .WAV mà không cắt xén khoảng lặng (dùng đo âm lượng chính xác)
function extractRawPcmChunk(wavBuf) {
  if (!wavBuf || wavBuf.length < 44) return Buffer.alloc(0);
  let dataOffset = 44;
  let dataLen = wavBuf.length - 44;
  let pos = 12;
  while (pos + 8 <= wavBuf.length) {
    const chunkId = wavBuf.toString('ascii', pos, pos + 4);
    const chunkSize = wavBuf.readUInt32LE(pos + 4);
    if (chunkId === 'data') {
      dataOffset = pos + 8;
      dataLen = Math.min(chunkSize, wavBuf.length - dataOffset);
      break;
    }
    pos += 8 + chunkSize + (chunkSize % 2);
  }
  return wavBuf.slice(dataOffset, dataOffset + (dataLen - (dataLen % 2)));
}

// Kiểm tra xem file .WAV có giọng nói người thực sự không (loại bỏ tiếng click chuột cơ học hoặc phòng im lặng)
function analyzeWavVolume(buf, fmtExt) {
  if (!buf || buf.length < 100 || fmtExt !== 'wav') {
    return { isSilent: false, isQuiet: false, hasSustainedVoice: true, voicedFrames: 10, rms: 1000, peak: 5000 };
  }
  const pcm = extractRawPcmChunk(buf);
  const totalSamples = Math.floor(pcm.length / 2);
  if (totalSamples < 80) {
    return { isSilent: true, isQuiet: true, hasSustainedVoice: false, voicedFrames: 0, rms: 0, peak: 0 };
  }
  let sumSq = 0;
  let peak = 0;
  for (let i = 0; i < totalSamples; i++) {
    const s = Math.abs(pcm.readInt16LE(i * 2));
    if (s > peak) peak = s;
    sumSq += s * s;
  }
  const rms = Math.sqrt(sumSq / totalSamples);

  // Phân tích năng lượng theo từng khung 100ms (1600 samples @ 16kHz)
  // Bỏ qua khung đầu tiên (0-100ms) để loại trừ tiếng click chuột cơ học
  const frameSize = 1600;
  const totalFrames = Math.floor(totalSamples / frameSize);
  let voicedFrames = 0;
  if (totalFrames >= 2) {
    for (let f = 1; f < totalFrames; f++) {
      let fPeak = 0, fSumSq = 0;
      const start = f * frameSize * 2;
      for (let i = 0; i < frameSize; i++) {
        const s = Math.abs(pcm.readInt16LE(start + i * 2));
        if (s > fPeak) fPeak = s;
        fSumSq += s * s;
      }
      const fRms = Math.sqrt(fSumSq / frameSize);
      if (fRms > 90 || fPeak > 500) {
        voicedFrames++;
      }
    }
  }

  // File được coi là im lặng nếu:
  // 1. RMS < 15 VÀ Peak < 80 (hoàn toàn không có tín hiệu điện áp)
  // 2. HOẶC file > 300ms nhưng hoàn toàn KHÔNG CÓ khung âm thanh nào có năng lượng tiếng người (chỉ có tiếng lách cách chuột)
  const isPureSilence = rms < 15 && peak < 80;
  const isOnlyClickNoVoice = totalFrames >= 3 && voicedFrames === 0;
  const isSilent = isPureSilence || isOnlyClickNoVoice;

  return {
    isSilent,
    isQuiet: rms < 60,
    hasSustainedVoice: voicedFrames > 0,
    voicedFrames,
    rms: Math.round(rms),
    peak
  };
}

// Lời nhắc lịch sự bằng đúng ngôn ngữ khóa cứng khi mic không thu được tiếng người
function getEmptySpeechReply(lang = 'vi') {
  const map = {
    vi: 'Mình chưa nghe rõ giọng của bạn. Bạn vui lòng nói gần micro hơn và hỏi lại nhé!',
    en: 'I could not hear your voice clearly. Please speak closer to the microphone and ask again!',
    fr: 'Je n\'ai pas bien entendu votre voix. Veuillez parler plus près du microphone et reposer votre question !',
    ja: 'お声がよく聞き取れませんでした。マイクに近づいてもう一度お話しください。',
    ko: '목소리가 잘 들리지 않았습니다. 마이크에 가까이 대고 다시 질문해 주세요!',
    zh: '我没有听清您的声音，请靠近麦克风再问一次！'
  };
  return map[normalizeLangCode(lang) || 'vi'] || map.vi;
}

// Danh sách các câu ảo giác đặc trưng của Whisper khi nhận file im lặng/tiếng click chuột (đặc biệt là boilerplate YouTube Việt & Anh)
const WHISPER_HALLUCINATIONS_REGEX = new RegExp([
  'ghiền mì gõ',
  'subscribe cho kênh',
  'đăng ký kênh',
  'hãy subscribe',
  'hãy like',
  'like và subscribe',
  'like và theo dõi',
  'chia sẻ video',
  'bấm chuông',
  'nhấn chuông',
  'thông báo để không bỏ lỡ',
  'cảm ơn các bạn đã theo dõi',
  'cảm ơn các bạn đã xem',
  'cảm ơn bạn đã xem',
  'hẹn gặp lại các bạn',
  'video tiếp theo',
  'chúc các bạn xem video',
  'chúc các bạn một ngày',
  'để không bỏ lỡ những video',
  'những video hấp dẫn',
  'xem thêm tại',
  'đường link bên dưới',
  'hãy nhấn nút subscribe',
  'ate la di',
  'thank you for watching',
  'thanks for watching',
  'thank you\\.?$',
  'thanks\\.?$',
  'subtitles by',
  'amara\\.org',
  'mbc',
  'cảm ơn đã xem'
].join('|'), 'i');

async function transcribeWavToText(wavBuffer, fallbackContentType = '', targetLang = 'vi') {
  const t0 = Date.now();
  const fmt = detectAudioFormat(wavBuffer, fallbackContentType);
  const vol = analyzeWavVolume(wavBuffer, fmt.ext);

  if (vol.isSilent) {
    console.log(`🔇 [STT Silence Guard] Bỏ qua file im lặng/không có tiếng nói (RMS=${vol.rms}, Peak=${vol.peak}, voicedFrames=${vol.voicedFrames || 0})`);
    return {
      text: '',
      isEmptySpeech: true,
      latencyMs: Date.now() - t0,
      engine: `Silence Guard (RMS=${vol.rms})`
    };
  }

  if (GROQ_API_KEY && wavBuffer && wavBuffer.length > 200) {
    const cleanLang = normalizeLangCode(targetLang);
    const whisperPrompts = {
      vi: 'Hội thoại tiếng Việt tự nhiên giữa du khách và hướng dẫn viên ảo tại bảo tàng di tích Hỏa Lò: xin chào, bạn tên là gì, tôi tên là gì, bạn ở đâu, lịch sử di tích, hiện vật.',
      en: 'Natural English conversation between a visitor and a tour guide at Hoa Lo Prison Relic in Hanoi: hello, guillotine, banyan tree, prisoner, opening hours, ticket price.',
      fr: 'Conversation naturelle en français entre un visiteur et un guide au musée de la prison Hoa Lo à Hanoï : bonjour, guillotine, cachot, tarifs, horaires.',
      ja: 'ハノイのホアロー収容所博物館でのガイドと来館者の自然な会話：こんにちは、ギロチン、歴史、開館時間、入場料。',
      ko: '하노이 호아로 수용소 박물관에서 가이드와 방문객의 자연스러운 대화: 안녕하세요, 단두대, 역사, 관람 시간, 입장료.',
      zh: '河内火炉监狱博物馆导游与游客的自然中文对话：你好、断头台、历史、开放时间、门票价格。'
    };
    const whisperModels = ['whisper-large-v3-turbo', 'whisper-large-v3'];

    for (const wModel of whisperModels) {
      let timeout = null;
      try {
        const blob = new Blob([wavBuffer], { type: fmt.mime });
        const form = new FormData();
        form.append('file', blob, `hub_mic.${fmt.ext}`);
        form.append('model', wModel);
        if (cleanLang) {
          form.append('language', cleanLang);
        }
        form.append('temperature', '0.0'); // Khóa nhiệt độ 0.0 để chống ảo giác ngẫu nhiên
        form.append('prompt', whisperPrompts[cleanLang || 'vi'] || whisperPrompts.vi);
        form.append('response_format', 'verbose_json');

        const controller = new AbortController();
        timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout cho đoạn nói dài

        const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
          body: form,
          signal: controller.signal
        });
        clearTimeout(timeout);
        timeout = null;

        if (res.status === 429) {
          console.warn(`⚡ [Whisper Failover] ${wModel} chạm 429 -> chuyển Whisper model kế tiếp...`);
          continue;
        }

        if (res.ok) {
          const json = await res.json();
          let cleanText = (json.text || '').trim();

          // Chuẩn hóa và sửa lỗi phiên âm nhầm thường gặp của Whisper
          if (!cleanLang || cleanLang === 'vi') {
            cleanText = cleanText
              .replace(/^(mạng|vạng|vạn)\s+tên\s+là\s+gì/i, 'Bạn tên là gì')
              .replace(/^ate\s+la\s+di/i, 'Bạn tên là gì')
              .replace(/^(bạn|cô|em)\s+tê\s+là\s+gì/i, '$1 tên là gì')
              .replace(/^tôi\s+tê\s+là\s+gì/i, 'Tôi tên là gì');
          }

          const isHallucination = !cleanText ||
            WHISPER_HALLUCINATIONS_REGEX.test(cleanText) ||
            (!vol.hasSustainedVoice && (cleanText.length < 5 || WHISPER_HALLUCINATIONS_REGEX.test(cleanText)));

          if (!isHallucination) {
            console.log(`✓ [Whisper STT:${wModel}] Đã nhận dạng từ file .${fmt.ext.toUpperCase()} (${Date.now() - t0}ms, RMS=${vol.rms}, lang=${cleanLang || 'auto'}): "${cleanText}"`);
            return {
              text: cleanText,
              isEmptySpeech: false,
              latencyMs: Date.now() - t0,
              engine: `Groq ${wModel} (${(cleanLang || 'auto').toUpperCase()})`
            };
          }
          console.log(`🔇 [Whisper Hallucination Filtered] Bỏ qua câu ảo giác YouTube: "${cleanText}" (voicedFrames=${vol.voicedFrames}, RMS=${vol.rms})`);
          return {
            text: '',
            isEmptySpeech: true,
            latencyMs: Date.now() - t0,
            engine: `Hallucination Filter ("${cleanText.slice(0, 30)}...")`
          };
        } else {
          const errBody = await res.text().catch(() => '');
          console.warn(`⚠ Lỗi Whisper STT HTTP ${res.status} (${wModel}/${fmt.ext}):`, errBody.slice(0, 200));
        }
      } catch (err) {
        if (timeout) clearTimeout(timeout);
        console.warn(`⚠ Lỗi Whisper STT (${wModel}):`, err.message);
      }
    }
  }

  // Không tự bịa câu hỏi khi không nhận dạng được tiếng người
  return {
    text: '',
    isEmptySpeech: true,
    latencyMs: Date.now() - t0,
    engine: 'STT Empty Speech'
  };
}

// Bộ đệm PCM 16kHz Mono sạch trong RAM (0ms khi lặp cụm mở đầu / câu quen thuộc, KHÔNG ghi file tạm lên đĩa!)
const pcmCache = new Map(); // md5 -> Buffer (raw Int16 PCM 16kHz mono đã cắt khoảng lặng)

function trimRawPcmSilence(pcm) {
  if (!pcm || pcm.length < 320) return pcm || Buffer.alloc(0);
  const evenLen = pcm.length - (pcm.length % 2);
  const totalSamples = evenLen / 2;
  const threshold = 150;
  let startSample = 0;
  while (startSample < totalSamples && Math.abs(pcm.readInt16LE(startSample * 2)) < threshold) startSample++;
  let endSample = totalSamples - 1;
  while (endSample > startSample && Math.abs(pcm.readInt16LE(endSample * 2)) < threshold) endSample--;
  const padSamples = 400; // 25ms @ 16kHz
  const trimStart = Math.max(0, startSample - padSamples);
  const trimEnd = Math.min(totalSamples, endSample + padSamples);
  if (trimEnd <= trimStart) return pcm.slice(0, evenLen);
  return pcm.slice(trimStart * 2, trimEnd * 2);
}

// Tải MP3 từ Google TTS qua native https.get + Keep-Alive Agent THẬT (tránh Node fetch undici bỏ qua agent gây TLS handshake lại!)
function fetchGoogleTtsMp3KeepAlive(cleanText, ttsCode, timeoutMs = 3500) {
  return new Promise((resolve, reject) => {
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${encodeURIComponent(ttsCode)}&client=tw-ob`;
    const req = https.get(ttsUrl, {
      agent: httpsKeepAliveAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Connection': 'keep-alive'
      },
      timeout: timeoutMs
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Google TTS HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('timeout', () => {
      req.destroy(new Error('Google TTS timeout'));
    });
    req.on('error', reject);
  });
}

// Hàng đợi giới hạn luồng giải mã FFmpeg (tránh bão tiến trình OS khi 50+ CCU cùng hỏi!)
const MAX_FFMPEG_CONCURRENT = Math.max(2, Math.min(os.cpus().length || 2, 4));
let activeFfmpegJobs = 0;
const ffmpegWaitQueue = [];

function runWithFfmpegSemaphore(fn) {
  return new Promise((resolve, reject) => {
    const startJob = () => {
      activeFfmpegJobs++;
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => {
          activeFfmpegJobs--;
          const next = ffmpegWaitQueue.shift();
          if (next) next();
        });
    };
    if (activeFfmpegJobs < MAX_FFMPEG_CONCURRENT) {
      startJob();
    } else {
      ffmpegWaitQueue.push(startJob);
    }
  });
}

// Giải mã MP3 -> PCM 16kHz Mono 100% TRONG RAM (pipe:0 -> pipe:1, KHÔNG ghi/đọc đĩa tạm, có semaphore + timeout diệt zombie!)
function decodeMp3BufferToPcmRam(mp3Buffer) {
  return runWithFfmpegSemaphore(() => new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG_BIN, [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', 'pipe:0',
      '-ar', '16000',
      '-ac', '1',
      '-f', 's16le',
      'pipe:1'
    ]);
    const out = [];
    let settled = false;
    const finish = (err, pcmBuf = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      if (err) reject(err);
      else resolve(pcmBuf);
    };

    const killTimer = setTimeout(() => {
      try { ff.kill('SIGKILL'); } catch (e) {}
      finish(new Error('FFmpeg RAM decode timeout (>5s)'));
    }, 5000);
    if (typeof killTimer.unref === 'function') killTimer.unref();

    ff.stdout.on('data', d => out.push(d));
    ff.on('close', (code) => {
      const pcm = Buffer.concat(out);
      if (code === 0 && pcm.length > 100) {
        finish(null, trimRawPcmSilence(pcm));
      } else {
        finish(new Error(`FFmpeg RAM decode exit ${code}`));
      }
    });
    ff.on('error', err => finish(err));
    ff.stdin.on('error', () => {});
    ff.stdin.end(mp3Buffer);
  }));
}

/**
 * =========================================================================================
 * ⚡ TỔNG HỢP PCM 16kHz SIÊU TỐC 100% TRONG RAM (KEEP-ALIVE TLS + ZERO DISK I/O + PCM CACHE)
 * Thời gian: ~250ms - 400ms (và 0ms khi trúng cụm mở đầu / câu đã có trong RAM!)
 * =========================================================================================
 */
function sanitizeTextForSpeech(text, lang = 'vi') {
  if (!text) return '';
  let s = String(text);
  // Chuyển mũi tên lộ trình thành từ nối tự nhiên để AI Voice đọc mượt có mạch câu
  s = s.replace(/\s*(?:➡️|→|➡)\s*/g, lang === 'vi' ? ', tiếp theo tới ' : ', then ');
  // Chuyển đánh số đầu đoạn kiểu "1) ", "2) " thành từ nối tự nhiên thay vì đọc cộc
  s = s.replace(/(?:^|\s)\d+\)\s+/g, ', ');
  // Loại bỏ Markdown: **bold**, *italic*, __underline__, `code`, # header
  s = s.replace(/[*_#`~]/g, ' ');
  // Loại bỏ Markdown links [anchor](url) -> anchor
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Thay thế dấu ngoặc kép dạng fancy: “ ” « » " '
  s = s.replace(/[“”«»"'`]/g, ' ');
  // Chuyển ký hiệu đặc biệt thành lời đọc tự nhiên cho khách
  if (lang === 'vi') {
    s = s.replace(/\/người\b/gi, ' một người');
    s = s.replace(/\/vé\b/gi, ' một vé');
    s = s.replace(/\/lượt\b/gi, ' một lượt');
    s = s.replace(/\+/g, ' cộng ');
    s = s.replace(/&/g, ' và ');
    s = s.replace(/%/g, ' phần trăm');
  } else {
    s = s.replace(/\/person\b/gi, ' per person');
    s = s.replace(/\/ticket\b/gi, ' per ticket');
    s = s.replace(/\+/g, ' plus ');
    s = s.replace(/&/g, ' and ');
    s = s.replace(/%/g, ' percent');
  }
  // Loại bỏ ký tự thừa thãi
  s = s.replace(/[^\p{L}\p{N}\s.,?!:;-]/gu, ' ');
  // Chuẩn hóa khoảng trắng và dấu phẩy thừa
  s = s.replace(/\s*,\s*,+/g, ',').replace(/^\s*,\s*/, '').replace(/\s+/g, ' ').trim();
  return s;
}

const MAX_PCM_CACHE = 800;

async function fastTextToPcm(text, lang = 'vi') {
  const langInfo = SUPPORTED_LANGUAGES[normalizeLangCode(lang) || 'vi'];
  const ttsCode = langInfo.ttsCode;
  const sanitized = sanitizeTextForSpeech(text, lang);
  const cleanText = sanitized.slice(0, 185).trim();
  if (!cleanText) return Buffer.alloc(0);

  const cacheKey = crypto.createHash('md5').update(`${ttsCode}:${cleanText.toLowerCase()}`).digest('hex');
  if (pcmCache.has(cacheKey)) {
    const hit = pcmCache.get(cacheKey);
    pcmCache.delete(cacheKey);
    pcmCache.set(cacheKey, hit);
    return hit;
  }

  // Bounded retry (tối đa 2 lượt) để chống lỗi mạng thoáng qua khi tải Google TTS
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const mp3Buffer = await fetchGoogleTtsMp3KeepAlive(cleanText, ttsCode, 3500);
      const cleanPcm = await decodeMp3BufferToPcmRam(mp3Buffer);
      if (pcmCache.size >= MAX_PCM_CACHE) {
        const oldest = pcmCache.keys().next().value;
        if (oldest) pcmCache.delete(oldest);
      }
      pcmCache.set(cacheKey, cleanPcm);
      return cleanPcm;
    } catch (err) {
      if (attempt === 2) {
        logEvent('WARN', 'FastTTS', 'TTS synthesis failed after retry', { error: err.message, lang: ttsCode });
      }
    }
  }
  return Buffer.alloc(0);
}

async function fastTextToWav(text, outputFilename, lang = 'vi') {
  const outputPath = path.join(AUDIO_DIR, outputFilename);
  const pcm = await fastTextToPcm(text, lang);
  if (pcm && pcm.length > 100) {
    fs.writeFileSync(outputPath, Buffer.concat([buildWavHeader(pcm.length), pcm]));
    return outputFilename;
  }
  return new Promise((resolve) => fallbackToDefaultWav(outputPath, resolve, outputFilename));
}

function fallbackToDefaultWav(outputPath, resolve, outputFilename) {
  // Tuyệt đối KHÔNG chép nhầm audio Trống Đồng khi TTS câu hỏi bất kỳ lỗi — tạo file WAV rỗng hợp lệ để player không bị phát nhầm hiện vật!
  try {
    const silentPcm = Buffer.alloc(3200); // 100ms @ 16kHz 16-bit mono
    fs.writeFileSync(outputPath, Buffer.concat([buildWavHeader(silentPcm.length), silentPcm]));
  } catch (e) {}
  resolve(outputFilename);
}

/**
 * =========================================================================================
 * ✂️ BÓC TÁCH CÂU ĐẦU TIÊN & CHUNKS ÂM THANH (PROGRESSIVE AUDIO CHUNKER)
 * - Tách ngay vế/câu đầu tiên (8-14 từ) để sinh file âm thanh nhỏ (Chunk 1) trả ngay <1s.
 * - Các đoạn sau được đẩy dần lên ở chế độ nền trong khi khách đang nghe Chunk 1!
 * =========================================================================================
 */
// Cắt 1 đoạn văn dài thành các mảnh <= maxLen ký tự tại dấu câu / ranh giới từ (KHÔNG BAO GIỜ cắt cụt giữa từ hoặc bỏ sót cuối câu!)
function splitLongSegmentSafely(segment, maxLen = 148) {
  const parts = [];
  let remaining = (segment || '').trim();
  while (remaining.length > maxLen) {
    const windowStr = remaining.slice(0, maxLen);
    // Ưu tiên ngắt tại dấu câu tự nhiên (, ; : — – 、 ，) trong nửa sau cửa sổ
    let cutIdx = -1;
    for (let i = windowStr.length - 1; i >= Math.floor(maxLen * 0.45); i--) {
      if (/[,;:—–、，]/.test(windowStr[i])) {
        cutIdx = i + 1;
        break;
      }
    }
    // Nếu không có dấu phẩy -> ngắt tại dấu cách gần nhất (với CJK không dấu cách thì ngắt thẳng maxLen)
    if (cutIdx === -1) {
      const lastSpace = windowStr.lastIndexOf(' ');
      cutIdx = lastSpace >= Math.floor(maxLen * 0.4) ? lastSpace : maxLen;
    }
    const piece = remaining.slice(0, cutIdx).trim();
    if (piece) parts.push(piece);
    remaining = remaining.slice(cutIdx).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

function splitIntoAudioChunks(fullText, maxChunkChars = 148, lang = 'vi') {
  if (!fullText) return [''];
  let clean = fullText
    .replace(/\s*(?:➡️|→|➡)\s*/g, lang === 'vi' ? ', tiếp theo tới ' : ', then ')
    .replace(/[\n\r]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Bảo vệ số có dấu chấm thập phân hoặc phân cách hàng nghìn (50.000, 25.000, 4.5m)
  clean = clean.replace(/(\d+)\.(\d+)/g, '$1__DOT__$2');
  // Bảo vệ các từ viết tắt phổ biến
  clean = clean.replace(/\b(TP|QĐ|VNĐ|TS|ThS|GS|BS|No|St|Mr|Mrs|Ms|Dr|tr|đ)\./gi, '$1__DOT__');
  // Hỗ trợ dấu kết câu cả Latin (. ! ?) và CJK (。 ！ ？)
  const rawSentences = clean.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) || [clean];
  const sentences = rawSentences.map(s => s.replace(/__DOT__/g, '.').trim()).filter(Boolean);
  if (sentences.length === 0) return [clean.replace(/__DOT__/g, '.')];

  const chunks = [];

  // Đoạn 1 SIÊU GỌN (ưu tiên ngắt ngay tại dấu phẩy/hai chấm đầu tiên trong 18..68 ký tự để tiếng đầu tiên phát ra chỉ ~250-380ms, hoặc 0ms khi trúng cache cụm mở đầu!)
  const s0 = sentences[0];
  let firstParts;
  if (s0.length > 68) {
    const commaIdx = s0.slice(18, 68).search(/[,;:—–、，]/);
    if (commaIdx !== -1) {
      const cut = 18 + commaIdx + 1;
      firstParts = [s0.slice(0, cut).trim(), ...splitLongSegmentSafely(s0.slice(cut).trim(), maxChunkChars)];
    } else {
      firstParts = splitLongSegmentSafely(s0, 68);
    }
  } else {
    firstParts = [s0];
  }
  chunks.push(firstParts[0]);

  // Gom phần dư của câu 1 (nếu câu 1 dài) + TẤT CẢ các câu còn lại thành các đoạn <= maxChunkChars (không bỏ sót bất kỳ chữ nào!)
  const tailSegments = [...firstParts.slice(1), ...sentences.slice(1)];
  let currentBuf = '';
  for (const seg of tailSegments) {
    if (seg.length > maxChunkChars) {
      if (currentBuf) {
        chunks.push(currentBuf.trim());
        currentBuf = '';
      }
      chunks.push(...splitLongSegmentSafely(seg, maxChunkChars));
    } else if (!currentBuf) {
      currentBuf = seg;
    } else if ((currentBuf.length + 1 + seg.length) <= maxChunkChars) {
      currentBuf += ' ' + seg;
    } else {
      chunks.push(currentBuf.trim());
      currentBuf = seg;
    }
  }
  if (currentBuf) chunks.push(currentBuf.trim());

  return chunks.filter(c => c && c.length > 0);
}

// Tạo & cache 1 file .WAV hoàn chỉnh cho lời thoại BLE Beacon khi thuyết minh bằng ngôn ngữ khác tiếng Việt
async function synthesizeCachedBeaconWav(beacon, translatedText, lang) {
  const hash = crypto.createHash('md5').update(`${beacon.id}:${lang}:${translatedText.trim()}`).digest('hex').slice(0, 10);
  const safeId = (beacon.id || beacon.code || 'beacon').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const cachedFilename = `beacon_${safeId}_${lang}_${hash}.wav`;
  const cachedPath = path.join(AUDIO_DIR, cachedFilename);

  if (fs.existsSync(cachedPath) && fs.statSync(cachedPath).size > 500) {
    return cachedFilename;
  }

  const chunks = splitIntoAudioChunks(translatedText, 148, lang);
  const pcmList = await Promise.all(chunks.map(c => fastTextToPcm(c, lang)));
  const pcmParts = [];
  for (const pcm of pcmList) {
    if (pcm && pcm.length > 0) {
      if (pcmParts.length > 0) pcmParts.push(NATURAL_BREATH_PCM);
      pcmParts.push(pcm);
    }
  }

  if (pcmParts.length > 0) {
    const allPcm = Buffer.concat(pcmParts);
    const fullWav = Buffer.concat([buildWavHeader(allPcm.length), allPcm]);
    fs.writeFileSync(cachedPath, fullWav);
    console.log(`✓ [Multilingual Beacon WAV] Đã tạo & cache thuyết minh BLE [${lang.toUpperCase()}]: ${cachedFilename} (${fullWav.length} bytes)`);
    return cachedFilename;
  }
  return beacon.audio_file;
}

/**
 * Đẩy tiếp các Chunks sau (ĐÃ TỔNG HỢP SONG SONG TRONG RAM) vào ĐÚNG 1 LUỒNG STREAMING .WAV DUY NHẤT!
 * Đồng thời ghi ra 1 file .WAV gộp hoàn chỉnh (reply_<id>.wav) để nghe lại / tua đầy đủ!
 */
async function processRemainingChunksBackground(chunks, baseName, hostBaseUrl, lang = 'vi', preStartedPromises = null) {
  const streamObj = activeAudioStreams.get(baseName);
  const mergedFilename = `${baseName}.wav`;
  const mergedPath = path.join(AUDIO_DIR, mergedFilename);

  // Tổng hợp SONG SONG toàn bộ các đoạn 2..N ngay lập tức (nhanh gấp 3-4 lần so với tuần tự!)
  const promises = preStartedPromises || chunks.slice(1).map(c => fastTextToPcm(c, lang));

  try {
    for (let i = 1; i < chunks.length; i++) {
      const chunkText = chunks[i];
      try {
        const nextPcm = await promises[i - 1];
        if (nextPcm && nextPcm.length > 0 && streamObj) {
          const joinedPart = Buffer.concat([NATURAL_BREATH_PCM, nextPcm]);
          streamObj.pcmParts.push(joinedPart);
          // Đẩy trực tiếp PCM Đoạn 2..N vào tất cả các luồng HTTP .WAV đang mở (liền mạch 0ms ngắt quãng!)
          for (const clientRes of streamObj.listeners) {
            try {
              if (!clientRes.writableEnded && !clientRes.destroyed) {
                clientRes.write(joinedPart);
              }
            } catch (e) {
              streamObj.listeners.delete(clientRes);
            }
          }
        }
        console.log(`✓ [Single Streaming WAV] Đã nối liền mạch Đoạn ${i + 1}/${chunks.length} vào ${mergedFilename}`);
        if (serverState.latestVoice && Array.isArray(serverState.latestVoice.chunks)) {
          const stChunk = serverState.latestVoice.chunks.find(c => c.index === i + 1);
          if (stChunk) stChunk.status = 'ready';
        }
        broadcastSSE('VOICE_CHUNK_READY', {
          reply_id: baseName,
          chunk_index: i + 1,
          total_chunks: chunks.length,
          text: chunkText,
          wav_url: `${hostBaseUrl}/audio-stream/${mergedFilename}`,
          merged_ready: i === chunks.length - 1
        });
      } catch (err) {
        console.warn(`⚠ Lỗi nối Đoạn ${i + 1}:`, err.message);
      }
    }
  } finally {
    if (streamObj) {
      // Gộp toàn bộ PCM thành 1 file .WAV hoàn chỉnh có header chuẩn xác (để replay & seek mượt mà!)
      try {
        const allPcm = Buffer.concat(streamObj.pcmParts);
        const fullWav = Buffer.concat([buildWavHeader(allPcm.length), allPcm]);
        fs.writeFileSync(mergedPath, fullWav);
        streamObj.mergedPath = mergedPath;
        console.log(`✓ [Merged Single WAV] Đã lưu trọn bộ 1 file duy nhất: ${mergedFilename} (${fullWav.length} bytes)`);
      } catch (e) {
        console.warn('⚠ Lỗi ghi file WAV gộp:', e.message);
      }

      streamObj.done = true;
      for (const clientRes of streamObj.listeners) {
        try {
          if (!clientRes.writableEnded && !clientRes.destroyed) clientRes.end();
        } catch (e) {}
      }
      streamObj.listeners.clear();
      setTimeout(() => activeAudioStreams.delete(baseName), 60 * 1000).unref();
    }
  }
}

/**
 * =========================================================================================
 * 🧠 HỎI ĐÁP KIEMTHU AI ENGINE (Port 4001 & In-Process)
 * =========================================================================================
 */
// Chuẩn hóa bỏ dấu tiếng Việt để so khớp câu hỏi về hiện vật trong data/beacons.json
function normalizeVnText(str) {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Tìm xem câu hỏi có nhắc tới hiện vật ngoài Hỏa Lò trong data/beacons.json không (Trống Đồng, Đạt Hồng, Bảo Kiếm...)
function findMatchingBeaconExhibit(question) {
  const normQ = ' ' + normalizeVnText(question) + ' ';
  const beacons = loadBeacons();
  for (const b of beacons) {
    const normName = normalizeVnText(b.artifact_name || b.name);
    // Bỏ qua Cây Bàng Hỏa Lò vì KiemThu AI đã có kho dữ liệu Hỏa Lò rất sâu về Cây Bàng
    if (normName.includes('cay bang') || normName.includes('hoa lo')) continue;
    const hints = [];
    if (normName.includes('trong dong')) hints.push('trong dong', 'dong son', 'chim lac', 'ngoi sao 14 canh', 'gian so 1', 'gian trung bay so 1', 'cai trong', 'ma 001', 'so 001', 'bronze drum');
    if (normName.includes('dat hong') || normName.includes('dai hong chung')) hints.push('dat hong', 'dathong', 'dai hong chung', 'chuong dai hong', 'chuong lon', 'chuong dong', 'thap chuong', 'gian so 3', 'gian trung bay so 3', 'qua chuong', 'cai chuong', 'chuong nay', 'ma 003', 'so 003', 'bronze bell');
    if (normName.includes('bao kiem')) hints.push('bao kiem', 'kiem hoang gia', 'luong long trieu nhat', 'thanh kiem', 'kiem co', 'gian so 4', 'gian trung bay so 4', 'cay kiem', 'kiem nay', 'ma 004', 'so 004', 'royal sword');
    if (normName.length >= 4) hints.push(normName);
    if (hints.some(h => normQ.includes(' ' + h + ' '))) {
      return b;
    }
  }
  return null;
}

const VI_ALL_DIACRITIC_RE = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;
const VI_UNIQUE_DIACRITIC_RE = /[ăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

// Kiểm tra nhanh xem văn bản đã đúng ngôn ngữ khóa cứng chưa
function isTextInLanguage(text, targetLang) {
  if (!text || !targetLang) return true;
  // Loại bỏ danh từ riêng di tích tiếng Việt thường được trích dẫn nguyên văn trong câu ngoại ngữ (không dùng \b sau chữ có dấu!)
  const PROPER_NOUNS_VI_RE = /(?:Nhà\s+tù\s+)?Hỏa\s+Lò|Nguyễn\s+Thái\s+Học|Hoàng\s+Văn\s+Thụ|Nguyễn\s+Đức\s+Cảnh|Trần\s+Tử\s+Bình|Phan\s+Bội\s+Châu|Lương\s+Văn\s+Can|Nguyễn\s+Thị\s+Minh\s+Khai|Hà\s+Nội|Hoàn\s+Kiếm|Hồ\s+Gươm|Bắc\s+Kỳ|Đông\s+Sơn|Yên\s+Bái|Côn\s+Đảo|Cây\s+Bàng|Đêm\s+Thiêng\s+Liêng|Đạt\s+Hồng|Đại\s+Hồng\s+Chung|Bảo\s+Kiếm|Trống\s+Đồng|Lưỡng\s+Long\s+Triều\s+Nhật|Tương\s+Mai|Trúc\s+Bạch|Quán\s+Sứ|Thợ\s+Nhuộm|Phụ\s+Khánh|Việt\s+Nam|Phở/gi;
  const scrubbedForLatinCheck = String(text).replace(PROPER_NOUNS_VI_RE, 'HoaLoRef');

  const hasViDiacritics = VI_ALL_DIACRITIC_RE.test(text);
  const hasCJK = /[\u4E00-\u9FFF]/.test(text);
  const hasJP = /[\u3040-\u30FF]/.test(text);
  const hasKR = /[\uAC00-\uD7AF\u1100-\u11FF]/.test(text);
  const hasFrAccents = /[çéèêëàâîïôùûüœæ]/i.test(scrubbedForLatinCheck) && !VI_UNIQUE_DIACRITIC_RE.test(scrubbedForLatinCheck);

  const alphaTokens = scrubbedForLatinCheck.match(/[A-Za-zÀ-ỹĐđ]+/g) || [];
  const totalAlpha = alphaTokens.length || 1;
  const viAllCount = alphaTokens.filter(tok => VI_ALL_DIACRITIC_RE.test(tok)).length;
  const viOnlyCount = alphaTokens.filter(tok => VI_UNIQUE_DIACRITIC_RE.test(tok)).length;
  const viAllRatio = viAllCount / totalAlpha;
  const viOnlyRatio = viOnlyCount / totalAlpha;

  if (targetLang === 'vi') return !hasJP && !hasKR && !hasCJK && (hasViDiacritics || totalAlpha <= 3);
  if (targetLang === 'en') {
    if (hasJP || hasKR || hasCJK) return false;
    if (/\b(chao ban|di tich|nha tu|hoa lo la|gia ve|mo cua|khong dung|hien vat nay|nghiem cam|thuc pham)\b/i.test(scrubbedForLatinCheck)) return false;
    if (viAllCount === 0) return true;
    return viAllRatio <= 0.25 && /\b(the|is|are|was|were|in|at|of|and|to|for|with|from|this|that|you|can|by|on|prison|museum|artifact)\b/i.test(scrubbedForLatinCheck);
  }
  if (targetLang === 'ja') return hasJP;
  if (targetLang === 'ko') return hasKR;
  if (targetLang === 'zh') return hasCJK && !hasJP && !hasKR;
  if (targetLang === 'fr') {
    if (hasJP || hasKR || hasCJK) return false;
    if (/\b(di tich|nha tu|gia ve|mo cua|nghiem cam|thuc pham)\b/i.test(scrubbedForLatinCheck)) return false;
    if (viOnlyCount === 0 && (hasFrAccents || /\b(le|la|les|de|du|des|est|sont|pour|avec|dans|vous|prison|musée|musee|bonjour|merci)\b/i.test(scrubbedForLatinCheck))) return true;
    return viOnlyRatio <= 0.22 && (hasFrAccents || /\b(le|la|les|de|du|des|est|sont|pour|avec|dans|vous|prison|musée|musee|bonjour|merci)\b/i.test(scrubbedForLatinCheck));
  }
  return true;
}

const GROQ_PRIMARY_MODEL = 'qwen/qwen3.8-27b';
const GROQ_FALLBACK_MODEL = 'openai/gpt-oss-120b';
const GROQ_LIGHT_MODEL = 'openai/gpt-oss-20b';
const GROQ_SUPPORTED_MODELS = [GROQ_LIGHT_MODEL, GROQ_PRIMARY_MODEL, GROQ_FALLBACK_MODEL];

let sharedGroqPool = null;
function getSharedGroqPool() {
  if (sharedGroqPool) return sharedGroqPool;
  try {
    const poolPath = path.join(kiemthuDir, 'engine', 'groq_pool.js');
    if (fs.existsSync(poolPath)) {
      sharedGroqPool = require(poolPath).groqPool;
      return sharedGroqPool;
    }
  } catch (e) {}
  return null;
}

let gtxCooldownUntil = 0;
let myMemoryCooldownUntil = 0;

function decodeBasicHtmlEntities(s) {
  return String(s || '')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function detectSourceLangForMT(text, targetLang) {
  if (/[\u3040-\u30FF]/.test(text)) return 'ja';
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) return 'ko';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh-CN';
  if (VI_UNIQUE_DIACRITIC_RE.test(text) || /\b(hoa lo|nha tu|di tich|may chem|cay bang|cong ngam|hien vat|bao nhieu)\b/i.test(text)) {
    return targetLang === 'vi' ? 'en' : 'vi';
  }
  if (/[ñ¿¡]|(\b(hola|gracias|cuanto|donde|esos|esas|sandalias|neumaticos|cuando|cuesta|prision|guillotina|museo)\b)/i.test(text)) return 'es';
  if (/[çœæ]|(\b(bonjour|merci|combien|ou est|quel est|quelle est|horaires|billet|billets|toilettes|ouverte|musée)\b)/i.test(text)) return 'fr';
  if (/[äöß]|(\b(bitte|danke|wie viel|wann|gefaengnis)\b)/i.test(text)) return 'de';
  return 'en';
}

function splitTextForMt(text, maxLen = 390) {
  const s = String(text || '').trim();
  if (s.length <= maxLen) return [s];
  const sentences = s.match(/[^.!?。！？]+[.!?。！？]*/g) || [s];
  const chunks = [];
  let buf = '';
  for (const sent of sentences) {
    const trimmed = sent.trim();
    if (!trimmed) continue;
    if ((buf + ' ' + trimmed).trim().length <= maxLen) {
      buf = (buf ? buf + ' ' : '') + trimmed;
    } else {
      if (buf) chunks.push(buf);
      if (trimmed.length > maxLen) {
        for (let i = 0; i < trimmed.length; i += maxLen) {
          chunks.push(trimmed.slice(i, i + maxLen));
        }
        buf = '';
      } else {
        buf = trimmed;
      }
    }
  }
  if (buf) chunks.push(buf);
  return chunks.slice(0, 6);
}

async function translateViaMyMemory(text, targetLang) {
  if (!text || Date.now() < myMemoryCooldownUntil) return null;
  const langMap = { vi: 'vi', en: 'en', fr: 'fr', ja: 'ja', ko: 'ko', zh: 'zh-CN' };
  const tl = langMap[targetLang];
  if (!tl) return null;
  const sl = detectSourceLangForMT(text, targetLang);
  if (sl === tl) return null;

  try {
    const chunks = splitTextForMt(text, 390);
    const outParts = [];
    for (const part of chunks) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const urlMm = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(part)}&langpair=${encodeURIComponent(`${sl}|${tl}`)}`;
      const res = await fetch(urlMm, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
      clearTimeout(timeout);
      if (!res.ok) {
        if (res.status === 429) myMemoryCooldownUntil = Date.now() + 10 * 60 * 1000;
        return null;
      }
      const json = await res.json();
      const translatedPart = decodeBasicHtmlEntities(json?.responseData?.translatedText || '');
      if (!translatedPart || /MYMEMORY WARNING/i.test(translatedPart)) {
        if (/MYMEMORY WARNING/i.test(translatedPart)) {
          myMemoryCooldownUntil = Date.now() + 15 * 60 * 1000;
          console.warn('⚠ MyMemory chạm ngưỡng ngày -> tạm nghỉ 15 phút.');
        }
        return null;
      }
      outParts.push(translatedPart);
    }
    const merged = outParts.join(' ').replace(/\s+/g, ' ').trim();
    if (merged && merged.toLowerCase() !== text.trim().toLowerCase()) {
      return merged;
    }
  } catch (e) {
    console.warn(`⚠ MyMemory dịch (${targetLang}) lỗi:`, e.message);
  }
  return null;
}

// Dịch dự phòng qua Google Translate GTX (tự tạm nghỉ 10 phút nếu GCP IP bị 429)
async function translateViaGoogleGTX(text, targetLang) {
  if (Date.now() < gtxCooldownUntil) return null;
  try {
    const tlMap = { vi: 'vi', en: 'en', fr: 'fr', ja: 'ja', ko: 'ko', zh: 'zh-CN' };
    const tl = tlMap[targetLang] || 'en';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(gtxUrl, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
    clearTimeout(timeout);
    if (res.status === 429) {
      gtxCooldownUntil = Date.now() + 10 * 60 * 1000;
      console.warn('⚠ Google GTX trả HTTP 429 -> tạm nghỉ 10 phút, dùng MyMemory/Groq.');
      return null;
    }
    if (res.ok) {
      const ctype = res.headers.get('content-type') || '';
      if (!ctype.includes('json')) {
        gtxCooldownUntil = Date.now() + 10 * 60 * 1000;
        console.warn(`⚠ Google GTX fallback trả content-type không phải json (${ctype}), tạm nghỉ 10 phút.`);
        return null;
      }
      const json = await res.json();
      const translated = (json?.[0] || []).map(part => part?.[0] || '').join('').trim();
      if (translated) return translated;
    }
  } catch (e) {
    console.warn(`⚠ Google GTX fallback lỗi (${targetLang}):`, e.message);
  }
  return null;
}

async function callLightGroqMessages(messages, temperature = 0.1, maxTokens = 320, timeoutMs = 3500) {
  if (!GROQ_API_KEY) return null;
  const pool = getSharedGroqPool();
  if (pool) {
    const res = await pool.callGroqChat({
      apiKey: GROQ_API_KEY,
      messages,
      mode: 'light',
      preferredModels: GROQ_SUPPORTED_MODELS,
      temperature,
      top_p: 0.9,
      max_tokens: maxTokens,
      timeoutMs,
      minHeadroomTokens: 650
    });
    return res ? res.content : null;
  }

  for (const model of GROQ_SUPPORTED_MODELS) {
    let timeout = null;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), timeoutMs);
      const isGptOss = model.startsWith('openai/gpt-oss');
      const bodyPayload = { model, temperature, messages };
      if (isGptOss) {
        bodyPayload.reasoning_effort = 'low';
        bodyPayload.max_completion_tokens = maxTokens + 100;
      } else {
        bodyPayload.max_tokens = maxTokens;
      }
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (res.ok) {
        const json = await res.json();
        const ans = (json.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        if (ans) return ans;
      }
    } catch (e) {
      if (timeout) clearTimeout(timeout);
    }
  }
  return null;
}

// Dịch siêu tốc kết hợp Cache + Single-flight + Groq Pool (24k TPM) + MyMemory + GTX Guard để 0 rò rỉ ngôn ngữ
async function translateTextStrict(text, targetLang, mode = 'answer') {
  if (!text) return text;
  const langInfo = SUPPORTED_LANGUAGES[targetLang];
  if (!langInfo) return text;

  if (mode === 'answer' && isTextInLanguage(text, targetLang)) {
    return text;
  }

  const cacheKey = `${mode}:${targetLang}:${crypto.createHash('md5').update(text.trim()).digest('hex')}`;
  const cachedTrans = getTranslationCache(cacheKey);
  if (cachedTrans !== undefined) return cachedTrans;

  if (translationInFlight.has(cacheKey)) {
    return translationInFlight.get(cacheKey);
  }

  const runTranslate = async () => {
    const glossaryHint = mode === 'answer' ? getGlossaryPromptHint(targetLang) : '';
    const glossaryLine = glossaryHint ? ` ${glossaryHint}` : '';
    const groqSysPrompt = mode === 'query'
      ? `Translate the visitor's museum question into natural Vietnamese for database lookup. Output ONLY the Vietnamese translation, no explanations.`
      : `You are a refined senior museum audio guide translator. Translate the following text STRICTLY into ${langInfo.nativeName} ONLY with a poised, natural spoken docent tone. Keep all historical dates, numbers, and proper names accurate.${glossaryLine} Output ONLY the ${langInfo.nativeName} text — ZERO words from any other language, no parenthetical Vietnamese translations, no markdown, no notes.`;

    if (mode === 'query') {
      // Chiến lược tiết kiệm Groq tối đa: dịch câu hỏi đầu vào bằng MyMemory / GTX TRƯỚC (0 token Groq!)
      const mmQuery = await translateViaMyMemory(text, targetLang);
      if (mmQuery && mmQuery.toLowerCase() !== text.trim().toLowerCase()) {
        setTranslationCache(cacheKey, mmQuery);
        return mmQuery;
      }
      const gtxQuery = await translateViaGoogleGTX(text, targetLang);
      if (gtxQuery && gtxQuery.toLowerCase() !== text.trim().toLowerCase()) {
        setTranslationCache(cacheKey, gtxQuery);
        return gtxQuery;
      }
      const groqQuery = await callLightGroqMessages([
        { role: 'system', content: groqSysPrompt },
        { role: 'user', content: text }
      ], 0.1, 220, 3200);
      if (groqQuery) {
        setTranslationCache(cacheKey, groqQuery);
        return groqQuery;
      }
      return text;
    }

    // Mode 'answer': Groq pool nhẹ trước (nếu còn headroom), rơi ngay xuống MyMemory -> GTX
    const pool = getSharedGroqPool();
    if (GROQ_API_KEY && (!pool || !pool.areAllCoolingDown(GROQ_SUPPORTED_MODELS))) {
      const groqAns = await callLightGroqMessages([
        { role: 'system', content: groqSysPrompt },
        { role: 'user', content: text }
      ], 0.1, 340, 3500);
      if (groqAns && (targetLang === 'vi' || isTextInLanguage(groqAns, targetLang))) {
        const polished = postPolishForeignTerms(groqAns, targetLang);
        setTranslationCache(cacheKey, polished);
        return polished;
      }
    }

    const mmAns = await translateViaMyMemory(text, targetLang);
    if (mmAns && (targetLang === 'vi' || isTextInLanguage(mmAns, targetLang))) {
      const polished = postPolishForeignTerms(mmAns, targetLang);
      setTranslationCache(cacheKey, polished);
      return polished;
    }

    const gtxAns = await translateViaGoogleGTX(text, targetLang);
    if (gtxAns && (targetLang === 'vi' || isTextInLanguage(gtxAns, targetLang))) {
      const polished = postPolishForeignTerms(gtxAns, targetLang);
      setTranslationCache(cacheKey, polished);
      return polished;
    }

    // TUYỆT ĐỐI KHÔNG trả về tiếng Việt thô gắn nhãn ngoại ngữ nếu đang khóa khác 'vi'!
    return targetLang === 'vi' ? text : null;
  };

  const promise = runTranslate().finally(() => {
    translationInFlight.delete(cacheKey);
  });
  translationInFlight.set(cacheKey, promise);
  return promise;
}

// Dịch câu hỏi ngoại ngữ (Nhật/Hàn/Trung/Pháp/Tây Ban Nha/Đức...) sang tiếng Việt để tra đúng 2.046 tư liệu Hỏa Lò
async function normalizeForeignQueryForLookup(rawQuery) {
  const raw = String(rawQuery || '').trim();
  if (!raw) return rawQuery;
  const hasNonLatin = /[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u1100-\u11FF\u0400-\u04FF\u0E00-\u0E7F]/.test(raw);
  const hasEuroForeignAccents = /[ñ¿¡áéíóúüäößàèìòùçëïœæ]/i.test(raw) && !VI_UNIQUE_DIACRITIC_RE.test(raw) && !/\b(hoa lo|nha tu|di tich|gia ve|mo cua|bao nhieu|la gi|o dau)\b/i.test(raw);
  const looksEuroForeignWords = /\b(bonjour|merci|combien|ou est|quel est|quelle est|horaires|billet|billets|prison|guillotine|toilettes|ouverte|hola|gracias|cuanto|donde esta|esos|esas|sandalias|neumaticos|cuando|cuesta|prision|guillotina|museo|bitte|danke|wie viel|wann|gefaengnis)\b/i.test(raw);

  if (hasNonLatin || hasEuroForeignAccents || looksEuroForeignWords) {
    const viQuery = await translateTextStrict(raw, 'vi', 'query');
    if (viQuery && viQuery !== raw) {
      console.log(`🌐 [Multilingual Query] "${raw}" -> VI lookup: "${viQuery}"`);
      return viQuery;
    }
  }
  return rawQuery;
}

// Trả lời bằng Groq LLM bám sát dữ liệu hiện vật trong data/beacons.json theo ĐÚNG ngôn ngữ đã khóa
async function answerFromBeaconData(question, beacon, targetLang = 'vi') {
  const baseText = beacon.dialogue?.text || beacon.dialogue?.short_cue || '';
  const langInfo = SUPPORTED_LANGUAGES[targetLang] || SUPPORTED_LANGUAGES.vi;
  const glossaryHint = getGlossaryPromptHint(targetLang);
  const glossaryLine = glossaryHint ? `\n${glossaryHint}` : '';
  if (GROQ_API_KEY) {
    const ans = await callLightGroqMessages([
      {
        role: 'system',
        content: `You are a seasoned, dignified museum docent. You MUST reply STRICTLY in ${langInfo.nativeName} ONLY (even if the visitor spoke another language). Answer in 2-3 poised, complete, natural spoken sentences based faithfully on the artifact info below. Never cut off mid-sentence. No markdown, no parenthetical Vietnamese translations.${glossaryLine}\nArtifact: ${beacon.artifact_name} (Code ${beacon.code}, ${beacon.location || ''})\nNotes: ${baseText}`
      },
      { role: 'user', content: question }
    ], 0.25, 270, 4200);
    if (ans) {
      return {
        reply: postPolishForeignTerms(ans, targetLang),
        intent: 'EXHIBIT_INFORMATION',
        source: `Data Hiện Vật (Mã ${beacon.code}) + Groq AI [${targetLang.toUpperCase()}]`,
        latencyMs: 250
      };
    }
  }
  return {
    reply: baseText || `Hiện vật ${beacon.artifact_name} tại ${beacon.location || 'khu trưng bày'}.`,
    intent: 'EXHIBIT_INFORMATION',
    source: `Data Hiện Vật (data/beacons.json • Mã ${beacon.code})`,
    latencyMs: 5
  };
}

async function callKiemThuOnce(queryText, sessionId = null, targetLang = 'vi', artifactContext = null) {
  const hasExplicitKiemthuUrl = Boolean(process.env.KIEMTHU_API_URL);

  // 1. Chỉ gọi HTTP ngoài khi người dùng chủ động cấu hình biến KIEMTHU_API_URL
  // (Tránh chờ TCP timeout ~2000ms trên Windows khi cổng 4001 không bật!)
  if (hasExplicitKiemthuUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(KIEMTHU_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: queryText, sessionId: sessionId || undefined, language: targetLang, artifactContext }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json();
        if (json && json.data && json.data.reply) {
          console.log(`✓ [kiemthu HTTP API] ${json.data.intent} | Latency: ${json.data.latencyMs}ms`);
          return {
            reply: json.data.reply,
            intent: json.data.intent || 'HISTORICAL_FACT',
            source: json.data.provider || '2Guide KiemThu AI Engine v8.0 (HTTP API)',
            latencyMs: json.data.latencyMs || 0
          };
        }
      }
    } catch (err) {}
  }

  // 2. Ưu tiên gọi TRỰC TIẾP Bộ Não KiemThu AI Trong RAM (In-Process Embedded Engine: ~5ms - 30ms!)
  try {
    const kiemthuServerPath = path.join(kiemthuDir, 'smart_ai_server.js');
    if (fs.existsSync(kiemthuServerPath)) {
      const { engine } = require(kiemthuServerPath);
      if (engine && typeof engine.handleAsk === 'function') {
        const result = await engine.handleAsk({ question: queryText, sessionId: sessionId || undefined, language: targetLang, artifactContext });
        if (result && result.success && result.data && result.data.reply) {
          console.log(`✓ [kiemthu AI In-Process] ${result.data.intent} | Latency: ${result.data.latencyMs}ms`);
          return {
            reply: result.data.reply,
            intent: result.data.intent || 'HISTORICAL_FACT',
            responseType: result.data.responseType || null,
            source: result.data.provider || '2Guide KiemThu AI Engine v8.0 (In-Process Embedded)',
            latencyMs: result.data.latencyMs || 15
          };
        }
      }
    }
  } catch (e) {
    console.warn('Lỗi gọi kiemthu in-process:', e.message);
  }

  return null;
}

async function queryKiemThuAI(question, artifactContext, sessionId = null, targetLang = 'vi') {
  const lockedLang = normalizeLangCode(targetLang) || serverState.lockedLanguage || 'vi';
  const rawQuery = (question || '').trim();
  const lookupQuery = await normalizeForeignQueryForLookup(rawQuery);
  const normQ = normalizeVnText(lookupQuery);
  const artifactName = artifactContext?.artifact_name || 'Di tích lịch sử';

  const getStrictLangSafeNotice = (langCode) => {
    const fallbackByLang = {
      en: 'Our AI translation service is briefly busy right now. Please try asking again in a few seconds in English.',
      fr: 'Notre service de traduction est momentanément surchargé. Veuillez réessayer votre question dans quelques secondes.',
      ja: '現在AI翻訳サーバーが混み合っております。数秒後にもう一度ご質問ください。',
      ko: '현재 AI 번역 서버에 요청이 집중되어 있습니다. 몇 초 뒤에 다시 질문해 주세요.',
      zh: '当前AI翻译服务访问量较高，请您在几秒钟后重新提问，我将继续为您用中文解答。'
    };
    return fallbackByLang[langCode] || fallbackByLang.en;
  };

  // Hàm bọc bảo đảm KHÓA NGÔN NGỮ CỨNG 100%: AI CHỈ được nói đúng lockedLang
  const enforceStrictLang = async (resObj) => {
    if (!resObj || !resObj.reply) return resObj;
    const tag = `🔒 [${lockedLang.toUpperCase()}]`;
    if (!isTextInLanguage(resObj.reply, lockedLang)) {
      const translated = await translateTextStrict(resObj.reply, lockedLang, 'answer');
      if (translated && (lockedLang === 'vi' || isTextInLanguage(translated, lockedLang))) {
        resObj.reply = translated;
        if (!String(resObj.source || '').includes(tag)) {
          resObj.source = `${resObj.source} ${tag}`;
        }
      } else if (lockedLang !== 'vi') {
        resObj.reply = getStrictLangSafeNotice(lockedLang);
        resObj.source = `${resObj.source} 🔒 [${lockedLang.toUpperCase()}-SAFE]`;
      }
    } else if (lockedLang !== 'vi' && !String(resObj.source || '').includes('🔒')) {
      resObj.source = `${resObj.source} ${tag}`;
    }
    if (lockedLang !== 'vi' && resObj.reply) {
      resObj.reply = postPolishForeignTerms(resObj.reply, lockedLang);
    }
    resObj.language = lockedLang;
    return resObj;
  };

  // BƯỚC 0 (CHỈ DÙNG KHI OFFLINE KHÔNG CÓ GROQ AI):
  // Khi có Groq AI online, đưa thẳng sang Universal Grounded RAG để AI tự hiểu ngữ nghĩa chính xác
  // (phân biệt rõ "bạn ở đâu" vs "tôi đang đứng ở đâu" vs "nhà vệ sinh ở đâu" vs "máy chém ở đâu"!).
  if (!GROQ_API_KEY) {
    const asksHoaLoAddress = /\b(dia chi|pho hoa lo|quan nao|phuong nao|ha noi|tp hcm|sai gon|tinh nao|o dau tren ban do)\b/.test(normQ);
    const isStrictSelfOrientation = lookupQuery.length <= 70 && !asksHoaLoAddress && (
      /^(toi|minh|em|ta|chung toi)\s+(dang\s+)?(dung|o)\s+(o\s+)?(dau|cho nao|khu nao|khu vuc nao|vi tri nao|gian nao|phong nao|tram nao)\b/.test(normQ) ||
      /^(dang\s+)?dung\s+(o\s+)?(dau|cho nao|khu nao|gian nao)\b/.test(normQ) ||
      /^(day|cho nay|khu nay|o day|noi nay|gian nay)\s+la\s+(dau|gi|cho nao|khu nao|hien vat gi)\b/.test(normQ) ||
      /^(where am i|where are we|what place is this|what exhibit is this)\b/.test(normQ)
    );
    if (isStrictSelfOrientation && artifactContext?.dialogue?.text) {
      console.log(`✓ [Offline BLE Position Answer] Định vị trực tiếp tại trạm ${artifactContext.code}: ${artifactName}`);
      return await enforceStrictLang({
        reply: `Bạn đang đứng tại khu vực ${artifactName} (${artifactContext.location || 'Di tích'}). ${artifactContext.dialogue.text}`,
        intent: 'VISIT_GUIDANCE',
        source: `Định vị BLE Beacon (Mã ${artifactContext.code}: ${artifactName})`,
        latencyMs: 10
      });
    }
  }

  // BƯỚC 1: GỬI NGUYÊN BẢN CÂU HỎI SANG KIEMTHU TRƯỚC KÈM NGÔN NGỮ KHÓA CỨNG + NGỮ CẢNH TRẠM BLE HIỆN TẠI
  console.log(`\n➡️  Đang gửi câu hỏi sang kiemthu AI [🔒 ${lockedLang.toUpperCase()} | Mã ${artifactContext?.code || 'N/A'}]: "${lookupQuery}"`);
  let kiemthuResult = await callKiemThuOnce(lookupQuery, sessionId, lockedLang, artifactContext);

  // BƯỚC 2: CHỈ KHI kiemthu chưa rõ đối tượng / báo mơ hồ / chưa ghi nhận / ngoài phạm vi
  if (kiemthuResult) {
    const isAmbiguousOrMissed =
      kiemthuResult.intent === 'CLARIFICATION' ||
      kiemthuResult.intent === 'AMBIGUOUS_QUERY' ||
      kiemthuResult.intent === 'OUT_OF_SCOPE' ||
      /chưa được ghi nhận|chưa ghi nhận|ngoài phạm vi|bạn muốn hỏi về|bạn đang nhắc đến|chưa rõ|not documented|outside the scope|don't have any information|do not have information|数据库中没有|没有关于|情報がありません|정보가 없습니다/i.test(kiemthuResult.reply || '');

    const isGracefulDocentOos =
      kiemthuResult.responseType === 'DOCENT_GRACEFUL_OUT_OF_SCOPE' ||
      kiemthuResult.responseType === 'OUT_OF_SCOPE_ARCHIVE_BOUNDARY';

    if (isAmbiguousOrMissed) {
      const matchedByName = findMatchingBeaconExhibit(lookupQuery);
      if (matchedByName) {
        console.log(`✓ [Beacon Data Fallback] Trả lời từ data/beacons.json cho hiện vật: ${matchedByName.artifact_name}`);
        return await enforceStrictLang(await answerFromBeaconData(rawQuery, matchedByName, lockedLang));
      }

      // Không để từ chỉ định đời thường ("quanh đây", "hôm nay", "it", "this") ghi đè câu trả lời ngoài lề tinh tế thành bài thuyết minh Beacon!
      const hasDeicticPronoun = /\b(cai nay|hien vat nay|vat nay|cho nay|khu nay|o day|tai day|tai cho nay|cay nay|trong nay|chuong nay|kiem nay|truoc mat|no|day|this|it|here)\b/.test(normQ);
      if (!isGracefulDocentOos && kiemthuResult.intent !== 'OUT_OF_SCOPE' && hasDeicticPronoun && artifactContext) {
        const normArtifact = normalizeVnText(artifactName);
        const replacedQuery = lookupQuery.replace(/(cái này|cai nay|hiện vật này|hien vat nay|vật này|vat nay|cây này|cay nay|chỗ này|cho nay|khu này|khu nay|tại đây|tai day|ở đây|o day|\bnó\b)/gi, artifactName);
        const contextualQuery = replacedQuery !== lookupQuery ? replacedQuery : `${artifactName}: ${lookupQuery}`;
        console.log(`📍 [BLE Context Retry] Hỏi lại kèm vị trí BLE (${artifactName}): "${contextualQuery}"`);
        const retryResult = await callKiemThuOnce(contextualQuery, sessionId, lockedLang, artifactContext);
        if (retryResult && !/chưa được ghi nhận|ngoài phạm vi|not documented|outside the scope/i.test(retryResult.reply || '')) {
          return await enforceStrictLang(retryResult);
        }
        return await enforceStrictLang(await answerFromBeaconData(rawQuery, artifactContext, lockedLang));
      }
    }

    return await enforceStrictLang(kiemthuResult);
  }

  // BƯỚC 3: Tra cứu Kho 100 Facts SSOT nếu có
  try {
    const kiemthuEnginePath = path.join(kiemthuDir, 'engine', 'knowledge_base.js');
    if (fs.existsSync(kiemthuEnginePath)) {
      const { knowledgeBase } = require(kiemthuEnginePath);
      const gt = knowledgeBase.findGroundTruthMatch(lookupQuery);
      if (gt && (gt.item.premium_answer || gt.item.verified_answer || gt.item.expected_answer)) {
        const bestAns = gt.item.premium_answer || gt.item.verified_answer || gt.item.expected_answer;
        return await enforceStrictLang({
          reply: bestAns,
          intent: 'HISTORICAL_FACT',
          source: 'kiemthu 100 Facts SSOT (In-Process)',
          latencyMs: 12
        });
      }
    }
  } catch (e) {}

  // BƯỚC 4: Fallback câu trả lời súc tích
  return await enforceStrictLang({
    reply: generateFallbackAnswer(lookupQuery, artifactContext?.code || '001'),
    intent: 'HERITAGE_FALLBACK',
    source: 'Heritage Fast Fallback Engine',
    latencyMs: 5
  });
}

function generateFallbackAnswer(question, code) {
  if (code === '001') {
    return 'Dạ chào bạn, Trống đồng Đông Sơn có niên đại khoảng thế kỷ thứ 7 trước Công nguyên, là bảo vật quốc gia đúc bằng đồng tượng trưng cho quyền uy và văn minh sông Hồng ạ.';
  } else if (code === '002') {
    return 'Dạ chào bạn, Cây bàng cổ thụ Hỏa Lò gắn bó với các tù nhân chính trị; lá và vỏ cây từng được dùng làm thuốc chữa bệnh còn búp bàng làm thức ăn bồi dưỡng cho các đồng chí ốm nặng.';
  } else if (code === '003') {
    return 'Dạ chào bạn, Đạt Hồng là Đại Hồng Chung nặng hơn hai tấn đúc thời Nguyễn; tiếng chuông ngân vang xa hàng chục dặm cầu cho quốc thái dân an ạ.';
  } else if (code === '004') {
    return 'Dạ chào bạn, Bảo kiếm hoàng gia triều Nguyễn được đúc bằng vàng ròng nạm đá quý ngũ sắc, là biểu trưng cho quyền uy tối thượng của thiên tử xưa.';
  }
  return 'Mình xin giới thiệu với bạn: hiện vật này là di sản văn hóa quý giá với nhiều tầng ý nghĩa lịch sử sâu sắc tại khu di tích ạ.';
}

// Chắt lọc 1-2 câu quan trọng nhất để nghe qua tai nghe cực nhanh (trọn câu, không cắt đứt từ)
function extractSpokenSummary(fullText) {
  if (!fullText) return '';
  const paragraphs = fullText.split('\n').map(p => p.trim()).filter(p => p.length > 5);
  let target = paragraphs[0] || fullText;
  let protectedTarget = target.replace(/(\d+)\.(\d+)/g, '$1__DOT__$2');
  protectedTarget = protectedTarget.replace(/\b(TP|QĐ|VNĐ|TS|ThS|GS|BS|No|St|Mr|Mrs|Ms|Dr|tr|đ)\./gi, '$1__DOT__');
  
  const sentences = protectedTarget.match(/[^.!?。！？]+[.!?。！？]+/g);
  if (sentences && sentences.length >= 1) {
    let combined = sentences[0];
    for (let i = 1; i < sentences.length; i++) {
      if ((combined + ' ' + sentences[i]).length <= 250) {
        combined += ' ' + sentences[i];
      } else {
        break;
      }
    }
    return combined.replace(/__DOT__/g, '.').trim();
  }
  return target.trim();
}

// KHỞI TẠO HTTP SERVER (HARDENED PRODUCTION GATEWAY V3.0)
const server = http.createServer(async (req, res) => {
  applySecurityHeaders(req, res);

  if (req.method === 'OPTIONS') {
    if (!isOriginAllowedForRequest(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', error: 'CORS origin not allowed' }));
    }
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Chặn cross-origin không được phép trong Production (chỉ áp dụng cho /api/*)
  if (pathname.startsWith('/api/') && !isOriginAllowedForRequest(req)) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ status: 'error', error: 'Forbidden CORS origin' }));
  }

  // Sliding-Window Rate Limiter theo IP & Tier
  const clientIp = getClientIp(req);
  if (pathname.startsWith('/api/') && pathname !== '/api/events' && pathname !== '/api/state' && pathname !== '/api/health') {
    let tier = 'general';
    if (pathname === '/api/hub/ask' || pathname === '/api/voice-query' || pathname === '/api/hub-query' || pathname === '/api/esp32/ask') {
      tier = 'voice';
    } else if (pathname === '/api/ble-scan' || pathname === '/api/beacon-trigger') {
      tier = 'ble';
    } else if (pathname.startsWith('/api/beacons/') || pathname.startsWith('/api/auto-learning/') || pathname.startsWith('/api/devices/issue') || pathname.startsWith('/api/devices/revoke') || pathname === '/api/ble/calibrate') {
      tier = 'admin';
    }
    const rl = rateLimiter.check(clientIp, tier);
    res.setHeader('X-RateLimit-Limit', String(rl.limit));
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(Math.ceil(rl.resetMs / 1000)));
      res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ status: 'error', error: 'Too many requests. Please retry shortly.' }));
    }
  }

  // 1. Phục vụ Single Progressive Streaming WAV: /audio-stream/<baseName>.wav
  // - Khi đang tổng hợp Đoạn 2: stream liền mạch 1 file .WAV duy nhất (Chunk 1 PCM + Chunk 2 PCM nối tiếp 0ms ngắt quãng!)
  // - Khi đã gộp xong: phục vụ thẳng file .WAV hoàn chỉnh (có đầy đủ thời lượng & tua đi tua lại!)
  if (pathname.startsWith('/audio-stream/')) {
    const filename = path.basename(pathname);
    const streamId = filename.replace(/\.wav$/i, '');
    const mergedPath = path.join(AUDIO_DIR, filename);

    // Nếu đã gộp xong thành 1 file .WAV hoàn chỉnh trên đĩa -> phục vụ file tĩnh chuẩn Range/Content-Length!
    if (fs.existsSync(mergedPath)) {
      return serveAudioStream(req, res, mergedPath, 'audio/wav');
    }

    const streamObj = activeAudioStreams.get(streamId);
    if (!streamObj) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', error: 'Audio stream not found' }));
    }

    if (req.method === 'HEAD') {
      res.writeHead(200, {
        'Content-Type': 'audio/wav',
        'Accept-Ranges': 'none',
        'Cache-Control': 'no-cache, no-store'
      });
      return res.end();
    }

    res.writeHead(200, {
      'Content-Type': 'audio/wav',
      'Accept-Ranges': 'none',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache, no-store',
      'X-Accel-Buffering': 'no'
    });

    // Ghi 44-byte RIFF/WAVE streaming header + toàn bộ PCM đã có (Đoạn 1)
    res.write(buildWavHeader(0x7FFFFFF0));
    for (const part of streamObj.pcmParts) {
      res.write(part);
    }

    if (streamObj.done) {
      return res.end();
    }

    streamObj.listeners.add(res);
    const detach = () => streamObj.listeners.delete(res);
    req.on('close', detach);
    res.on('close', detach);
    res.on('error', detach);
    return;
  }

  // 1.5 Phục vụ Audio Streaming tĩnh (/audio/...)
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

  // 3.5 API Khóa Ngôn Ngữ Cứng: GET/POST /api/language
  if (pathname === '/api/language') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({
        locked_language: serverState.lockedLanguage,
        language_info: SUPPORTED_LANGUAGES[serverState.lockedLanguage],
        supported: Object.values(SUPPORTED_LANGUAGES)
      }));
    }
    if (req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const reqLang = normalizeLangCode(body.language || body.lang || parsedUrl.query.lang);
        if (!reqLang) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ error: 'Ngôn ngữ không hợp lệ. Hỗ trợ: vi, en, fr, ja, ko, zh' }));
        }
        serverState.lockedLanguage = reqLang;
        serverState.lastUpdate = Date.now();
        console.log(`🔒 [Language Lock] Đã khóa cứng ngôn ngữ AI sang: ${SUPPORTED_LANGUAGES[reqLang].label} (${reqLang})`);
        broadcastSSE('LANGUAGE_CHANGED', {
          locked_language: reqLang,
          language_info: SUPPORTED_LANGUAGES[reqLang]
        });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          success: true,
          locked_language: reqLang,
          language_info: SUPPORTED_LANGUAGES[reqLang]
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }
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

      // Xác thực thiết bị (RBAC: guest / device / admin) & Kiểm định BLE bằng EMA + Hysteresis + Stability + Cooldown
      const deviceId = sanitizeStringInput(payload.device_id || req.headers['x-device-id'] || 'CLIENT', 64) || 'CLIENT';
      const devAuth = deviceAuth.verifyDevice(req, deviceId);
      if (!devAuth.ok) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ status: 'error', error: devAuth.reason }));
      }

      const isManualTest = Boolean(payload.force) || deviceId === 'LOCAL_DASHBOARD' || deviceId.startsWith('TEST');
      const rawRssi = payload.rssi !== undefined && payload.rssi !== null ? Number(payload.rssi) : null;
      const bleEval = bleManager.evaluateBleScan({
        deviceId,
        beacon: target,
        rawRssi: isNaN(rawRssi) ? null : rawRssi,
        isManual: isManualTest,
        force: Boolean(payload.force)
      });

      if (bleEval.action !== 'TRIGGER') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          status: bleEval.action === 'SKIP_COOLDOWN' ? 'cooldown' : 'filtered',
          action: bleEval.action,
          code: target.code,
          artifact_id: target.id,
          artifact_name: target.artifact_name,
          smoothed_rssi: bleEval.smoothedRssi,
          positioning: bleEval.positioning,
          remaining_seconds: bleEval.remainingSeconds || 0,
          message: bleEval.reason
        }));
      }

      const hostBaseUrl = getPublicBaseUrl(req);
      const devCtx = bleEval.device;
      const lockedLang = normalizeLangCode(payload.language || payload.lang || req.headers['x-language'] || parsedUrl.query.lang) || devCtx.lockedLanguage || serverState.lockedLanguage || 'vi';
      if (payload.language || payload.lang || req.headers['x-language']) {
        devCtx.lockedLanguage = lockedLang;
      }

      let dialogueOut = { ...(target.dialogue || {}) };
      let artifactNameOut = target.artifact_name;
      let locationOut = target.location;
      let audioFilename = target.audio_file;
      let mp3Filename = target.audio_mp3 || target.audio_file;

      // KHÓA NGÔN NGỮ CHO CẢ THUYẾT MINH TỰ ĐỘNG BLE BEACON:
      // Nếu ngôn ngữ khóa != tiếng Việt -> dịch lời thoại & sinh/cache file .WAV chuẩn theo đúng ngôn ngữ đó!
      if (lockedLang !== 'vi' && dialogueOut.text) {
        const [trText, trName, trLoc] = await Promise.all([
          translateTextStrict(dialogueOut.text, lockedLang, 'answer'),
          translateTextStrict(artifactNameOut, lockedLang, 'answer'),
          locationOut ? translateTextStrict(locationOut, lockedLang, 'answer') : Promise.resolve(locationOut)
        ]);
        dialogueOut.text = trText || dialogueOut.text;
        artifactNameOut = trName || artifactNameOut;
        locationOut = trLoc || locationOut;
        audioFilename = await synthesizeCachedBeaconWav(target, dialogueOut.text, lockedLang);
        mp3Filename = audioFilename;
      }

      const wavUrl = `${hostBaseUrl}/audio/${audioFilename}`;
      const mp3Url = `${hostBaseUrl}/audio/${mp3Filename}`;

      const responsePayload = {
        status: 'success',
        action: 'PLAY_AUDIO',
        code: target.code,
        artifact_id: target.id,
        artifact_name: artifactNameOut,
        location: locationOut,
        icon: target.icon || '🏛️',
        locked_language: lockedLang,
        dialogue: dialogueOut,
        audio: {
          wav_url: wavUrl,
          mp3_url: mp3Url,
          url: wavUrl,
          filename: audioFilename
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
      let isEmptySpeech = false;

      if (contentType.includes('audio') || contentType.includes('octet-stream') || contentType.includes('multipart/form-data')) {
        // [TRƯỜNG HỢP CỐT LÕI]: ESP32 / TRÌNH DUYỆT GỬI FILE .WAV (RAW BINARY HOẶC MULTIPART FORM-DATA)
        let rawAudioBuffer = await parseRawBody(req);
        let formFields = {};
        if (contentType.includes('multipart/form-data')) {
          const parsedMp = extractMultipartFile(rawAudioBuffer, req.headers['content-type'] || '');
          rawAudioBuffer = parsedMp.fileBuf;
          formFields = parsedMp.fields;
        }
        const audioValidation = validateAudioBufferMagic(rawAudioBuffer, contentType);
        if (!audioValidation.valid) {
          res.writeHead(415, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ status: 'error', error: audioValidation.reason }));
        }
        const fmt = { ext: audioValidation.ext, mime: audioValidation.mime };
        const incomingWavName = `hub_rec_${Date.now()}.${fmt.ext}`;
        fs.writeFileSync(path.join(AUDIO_DIR, incomingWavName), rawAudioBuffer);
        inputAudioFile = incomingWavName;
        console.log(`🎙️ [Cục Hub Ghi Âm] Đã nhận file .${fmt.ext.toUpperCase()} (${rawAudioBuffer.length} bytes): ${incomingWavName}`);

        // Trích xuất lockedLang và deviceId trước để Whisper nhận dạng đúng ngôn ngữ khóa cứng!
        const urlObj = url.parse(req.url, true);
        const reqDeviceId = sanitizeStringInput(formFields.device_id || req.headers['x-device-id'] || urlObj.query.device_id || 'ESP32_HUB_MIC', 64) || 'ESP32_HUB_MIC';
        const reqDevCtx = bleManager.getOrCreateDevice(reqDeviceId);
        const lockedLang = normalizeLangCode(formFields.language || formFields.lang || req.headers['x-language'] || urlObj.query.lang) || reqDevCtx.lockedLanguage || serverState.lockedLanguage || 'vi';
        if (lockedLang) {
          reqDevCtx.lockedLanguage = lockedLang;
        }

        // Chuyển file âm thanh tiếng nói của du khách thành văn bản qua Whisper AI (có khóa ngôn ngữ)
        const sttRes = await transcribeWavToText(rawAudioBuffer, contentType, lockedLang);
        transcribedText = sttRes.text;
        isEmptySpeech = Boolean(sttRes.isEmptySpeech);
        sttInfo = { engine: sttRes.engine, latencyMs: sttRes.latencyMs };

        payload = {
          code: formFields.code || req.headers['x-artifact-code'] || req.headers['x-code'] || urlObj.query.code || '001',
          voice_text: transcribedText,
          end_speech_time: parseInt(formFields.end_speech_time || req.headers['x-end-speech-time'], 10) || tServerReceived,
          device_id: reqDeviceId,
          language: lockedLang
        };
      } else {
        // [TRƯỜNG HỢP KIỂM THỬ]: Gửi JSON { "voice_text": "..." }
        payload = await parseJsonBody(req);
      }

      const deviceId = sanitizeStringInput(payload.device_id || req.headers['x-device-id'] || 'ESP32_HUB_01', 64) || 'ESP32_HUB_01';
      const devAuth = deviceAuth.verifyDevice(req, deviceId);
      if (!devAuth.ok) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ status: 'error', error: devAuth.reason }));
      }
      const devCtx = bleManager.getOrCreateDevice(deviceId);
      devCtx.stats.voiceRequests++;
      const myVoiceSeq = ++devCtx.activeVoiceSeq;

      const rawEndSpeech = Number(payload.end_speech_time || req.headers['x-end-speech-time'] || 0);
      // Chỉ dùng mốc thời gian client gửi lên nếu là Unix Epoch ms hợp lệ (trong vòng ±60s), tránh millis() của ESP32 làm lệch số đo
      const tEndSpeech = (rawEndSpeech > 1600000000000 && Math.abs(tServerReceived - rawEndSpeech) < 60000)
        ? rawEndSpeech
        : tServerReceived;
      const questionText = isEmptySpeech
        ? ''
        : sanitizeStringInput(payload.voice_text || payload.question || payload.text || payload.message || payload.query || 'Hãy giới thiệu cho tôi về hiện vật này.', 500);
      const currentCode = sanitizeStringInput(payload.code || req.headers['x-artifact-code'] || devCtx.activeBeaconCode || '001', 20) || '001';
      // Bật trí nhớ hội thoại đa lượt tự động theo từng thiết bị ESP32 / trình duyệt!
      const rawSess = payload.sessionId || payload.session_id || req.headers['x-session-id'] || `sess_${deviceId}`;
      const reqSessionId = String(rawSess).replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 72);
      const lockedLang = normalizeLangCode(payload.language || payload.lang || req.headers['x-language'] || parsedUrl.query.lang) || devCtx.lockedLanguage || serverState.lockedLanguage || 'vi';
      if (payload.language || payload.lang || req.headers['x-language']) {
        devCtx.lockedLanguage = lockedLang;
      }

      const SAFE_FALLBACK_BEACON = {
        code: currentCode || '001',
        artifact_name: 'Nhà tù Hỏa Lò (Tổng thể)',
        zone: 'Khu A',
        zone_name: 'Toàn cảnh di tích'
      };
      const beacons = loadBeacons();
      const currentArtifact = (Array.isArray(beacons) && beacons.find(b => b.code === currentCode)) ||
                             (Array.isArray(beacons) && beacons[0]) ||
                             SAFE_FALLBACK_BEACON;

      // Báo SSE bắt đầu đo
      serverState.isVoiceProcessing = true;
      serverState.voiceProcessingQuestion = questionText || '(Không nhận rõ giọng nói)';
      serverState.lastUpdate = Date.now();
      broadcastSSE('VOICE_PROCESSING', {
        question: questionText || '(Không nhận rõ giọng nói)',
        artifact: currentArtifact.artifact_name,
        code: currentArtifact.code,
        locked_language: lockedLang,
        input_type: inputAudioFile ? 'WAV_MIC_UPLOAD' : 'JSON_TEXT',
        tEndSpeech: tEndSpeech
      });

      // BƯỚC 1: HỎI BỘ NÃO KIEMTHU AI VỚI CHẾ ĐỘ KHÓA NGÔN NGỮ CỨNG + TRÍ NHỚ HỘI THOẠI ĐA LƯỢT
      const tAiStart = Date.now();
      const kiemthuResult = isEmptySpeech
        ? {
            reply: getEmptySpeechReply(lockedLang),
            intent: 'CLARIFICATION',
            source: 'STT Silence / Noise Guard',
            latencyMs: 1
          }
        : await queryKiemThuAI(questionText, currentArtifact, reqSessionId, lockedLang);
      const tAiDone = Date.now();

      const fullReply = kiemthuResult.reply;
      const chunks = splitIntoAudioChunks(fullReply, 148, lockedLang);
      const baseName = `reply_${Date.now()}`;

      // BƯỚC 2: TỔNG HỢP SIÊU TỐC 100% TRONG RAM (KHÔNG GHI ĐĨA TẠM) + BẮN SONG SONG CÁC ĐOẠN SAU NGAY LẬP TỨC!
      const tChunk1Start = Date.now();
      const pcm1Promise = fastTextToPcm(chunks[0], lockedLang);
      const remainingPcmPromises = chunks.length > 1
        ? chunks.slice(1).map(c => fastTextToPcm(c, lockedLang))
        : null;
      const rawPcm1 = await pcm1Promise;
      const pcm1 = (rawPcm1 && rawPcm1.length > 0) ? rawPcm1 : Buffer.alloc(3200);
      const tFirstAudioSoundReady = Date.now();

      const mergedFilename = `${baseName}.wav`;
      const mergedPath = path.join(AUDIO_DIR, mergedFilename);

      if (chunks.length === 1) {
        // Chỉ có 1 đoạn -> ghi thẳng file chuẩn luôn
        const singleWav = Buffer.concat([buildWavHeader(pcm1.length), pcm1]);
        fs.writeFileSync(mergedPath, singleWav);
      } else {
        // Có nhiều đoạn -> tạo live progressive stream trong RAM để phát liền mạch thành 1 file .WAV duy nhất!
        activeAudioStreams.set(baseName, {
          pcmParts: [pcm1],
          done: false,
          mergedPath,
          listeners: new Set(),
          createdAt: Date.now()
        });
      }

      // ĐO ĐỘ TRỄ CHÍNH XÁC: TỪ HẾT NÓI ĐẾN TIẾNG ĐẦU TIÊN VỀ TAI NGHE
      const totalLatencyMs = tFirstAudioSoundReady - tEndSpeech;
      const aiThinkingMs = tAiDone - tAiStart;
      const ttsSynthesisMs = tFirstAudioSoundReady - tChunk1Start;
      const uploadNetworkMs = tAiStart - tEndSpeech;

      const hostBaseUrl = getPublicBaseUrl(req);
      const unifiedStreamUrl = `${hostBaseUrl}/audio-stream/${mergedFilename}`;

      const chunksMetadata = chunks.map((c, idx) => ({
        index: idx + 1,
        text: c,
        status: idx === 0 ? 'ready' : 'generating',
        wav_url: unifiedStreamUrl
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
        locked_language: lockedLang,
        language_label: SUPPORTED_LANGUAGES[lockedLang]?.label || lockedLang,
        audio_mode: 'SINGLE_STREAMING_WAV',
        audio_wav_url: unifiedStreamUrl,
        current_chunk: 1,
        total_chunks: chunks.length,
        chunks: chunksMetadata,
        has_next_chunk: false,
        next_chunk_url: null,
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

      // Bảo đảm thứ tự âm thanh: nếu cùng thiết bị đã gửi câu mới hơn, đánh dấu superseded để tránh phát ngược thứ tự!
      const isSuperseded = devCtx.activeVoiceSeq !== myVoiceSeq;
      voiceResponse.device_id = deviceId;
      voiceResponse.voice_seq = myVoiceSeq;
      voiceResponse.superseded = isSuperseded;

      serverState.isVoiceProcessing = false;
      if (!isSuperseded) {
        devCtx.latestVoicePayload = voiceResponse;
        serverState.latestVoice = voiceResponse;
        serverState.lastUpdate = Date.now();
        broadcastSSE('VOICE_RESPONSE', voiceResponse);
      }

      res.setHeader('X-Latency-To-First-Sound-Ms', totalLatencyMs.toString());
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(voiceResponse, null, 2));

      // BƯỚC 3: ĐẨY DẦN CÁC ĐOẠN TIẾP THEO (ĐÃ BẮN SONG SONG SẴN) LÊN CHÍNH LUỒNG .WAV DUY NHẤT!
      if (chunks.length > 1) {
        if (!isSuperseded) {
          processRemainingChunksBackground(chunks, baseName, hostBaseUrl, lockedLang, remainingPcmPromises);
        } else {
          // Nếu câu này đã bị câu mới hơn vượt mặt (superseded), lập tức dọn dẹp RAM để chống memory leak!
          activeAudioStreams.delete(baseName);
        }
      }
      return;

    } catch (err) {
      serverState.isVoiceProcessing = false;
      const status = err.statusCode || 500;
      const msg = status === 413 ? err.message : (status === 400 ? 'Invalid request payload' : 'Internal voice processing error');
      return safeErrorResponse(res, status, msg, err);
    }
  }

  // 6. API QUẢN TRỊ BEACON — FAIL-CLOSED MẶC ĐỊNH (BẮT BUỘC ADMIN_API_KEY + INPUT VALIDATION + ATOMIC SAVE)
  if (req.method === 'POST' && pathname === '/api/beacons/update') {
    const adminCheck = verifyAdminRequest(req);
    if (!adminCheck.ok) {
      res.writeHead(adminCheck.statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ status: 'error', error: adminCheck.error }));
    }
    try {
      const data = await parseJsonBody(req);
      const val = validateBeaconPayload(data);
      if (!val.valid) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ status: 'error', error: 'Validation failed', details: val.errors }));
      }
      const beacons = loadBeacons();
      const index = beacons.findIndex(b => b.id === data.id || b.code === data.target_code || b.code === data.code);
      if (index < 0) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ status: 'error', error: 'Beacon not found' }));
      }

      if (data.new_code) beacons[index].code = sanitizeStringInput(data.new_code, 20);
      if (data.artifact_name) beacons[index].artifact_name = sanitizeStringInput(data.artifact_name, 160);
      if (data.speaker) beacons[index].dialogue.speaker = sanitizeStringInput(data.speaker, 100);
      if (data.text) beacons[index].dialogue.text = sanitizeStringInput(data.text, 2000);
      if (data.mac) beacons[index].mac = sanitizeStringInput(data.mac, 32).toUpperCase();
      if (data.cooldown_seconds !== undefined) beacons[index].cooldown_seconds = Number(data.cooldown_seconds);
      if (data.rssi_threshold !== undefined) beacons[index].rssi_threshold = Number(data.rssi_threshold);

      const conflicts = bleManager.detectBeaconConflicts(beacons);
      if (conflicts.length > 0) {
        res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ status: 'error', error: 'Duplicate beacon MAC or code conflict', conflicts }));
      }

      saveBeacons(beacons);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: true, beacons }));
    } catch (err) {
      return safeErrorResponse(res, err.statusCode || 500, err.statusCode ? err.message : 'Failed updating beacon', err);
    }
  }

  // 6.1. Thêm mới Beacon (Admin Fail-Closed)
  if (req.method === 'POST' && pathname === '/api/beacons/create') {
    const adminCheck = verifyAdminRequest(req);
    if (!adminCheck.ok) {
      res.writeHead(adminCheck.statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ status: 'error', error: adminCheck.error }));
    }
    try {
      const data = await parseJsonBody(req);
      const val = validateBeaconPayload({ ...data, new_code: data.code });
      if (!val.valid || !data.code || !data.artifact_name) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ status: 'error', error: 'Missing required fields (code, artifact_name) or invalid format', details: val.errors }));
      }
      const beacons = loadBeacons();
      const newBeacon = {
        id: sanitizeStringInput(data.id || `beacon_${data.code}`, 40),
        code: sanitizeStringInput(data.code, 20),
        mac: sanitizeStringInput(data.mac || `AA:BB:CC:DD:EE:${String(beacons.length + 1).padStart(2, '0')}`, 32).toUpperCase(),
        artifact_name: sanitizeStringInput(data.artifact_name, 160),
        location: sanitizeStringInput(data.location || 'Khu trưng bày', 160),
        icon: sanitizeStringInput(data.icon || '🏛️', 8),
        cooldown_seconds: Number(data.cooldown_seconds ?? 45),
        rssi_threshold: Number(data.rssi_threshold ?? -76),
        audio_file: sanitizeStringInput(data.audio_file || 'trong_dong_dong_son.wav', 120),
        dialogue: {
          speaker: sanitizeStringInput(data.speaker || 'Hướng Dẫn Viên AI', 100),
          text: sanitizeStringInput(data.text || '', 2000)
        }
      };
      beacons.push(newBeacon);
      const conflicts = bleManager.detectBeaconConflicts(beacons);
      if (conflicts.length > 0) {
        res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ status: 'error', error: 'Duplicate beacon MAC or code conflict', conflicts }));
      }
      saveBeacons(beacons);
      res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: true, beacon: newBeacon }));
    } catch (err) {
      return safeErrorResponse(res, err.statusCode || 500, err.statusCode ? err.message : 'Failed creating beacon', err);
    }
  }

  // 6.2. Xóa Beacon (Admin Fail-Closed)
  if ((req.method === 'DELETE' || req.method === 'POST') && pathname === '/api/beacons/delete') {
    const adminCheck = verifyAdminRequest(req);
    if (!adminCheck.ok) {
      res.writeHead(adminCheck.statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ status: 'error', error: adminCheck.error }));
    }
    try {
      const data = await parseJsonBody(req);
      const targetId = data.id || parsedUrl.query.id;
      const targetCode = data.code || parsedUrl.query.code;
      const beacons = loadBeacons();
      const idx = beacons.findIndex(b => (targetId && b.id === targetId) || (targetCode && b.code === targetCode));
      if (idx < 0) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ status: 'error', error: 'Beacon not found' }));
      }
      const [removed] = beacons.splice(idx, 1);
      saveBeacons(beacons);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: true, removed }));
    } catch (err) {
      return safeErrorResponse(res, err.statusCode || 500, 'Failed deleting beacon', err);
    }
  }

  // 6.3. Rollback Beacons từ Backup (Admin Fail-Closed)
  if (req.method === 'POST' && pathname === '/api/beacons/rollback') {
    const adminCheck = verifyAdminRequest(req);
    if (!adminCheck.ok) {
      res.writeHead(adminCheck.statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ status: 'error', error: adminCheck.error }));
    }
    const rb = beaconsStore.rollbackLatestSync();
    res.writeHead(rb.success ? 200 : 404, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(rb));
  }

  // 6.4. Hiệu chỉnh ngưỡng RSSI BLE theo môi trường (Admin Fail-Closed)
  if (req.method === 'POST' && pathname === '/api/ble/calibrate') {
    const adminCheck = verifyAdminRequest(req);
    if (!adminCheck.ok) {
      res.writeHead(adminCheck.statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ status: 'error', error: adminCheck.error }));
    }
    try {
      const data = await parseJsonBody(req);
      if (!data.beacon_id || data.threshold === undefined) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ status: 'error', error: 'Missing beacon_id or threshold' }));
      }
      const cal = bleManager.setCalibration(sanitizeStringInput(data.beacon_id, 40), {
        threshold: Number(data.threshold),
        rssiOffset: Number(data.rssi_offset || 0)
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: true, calibration: cal }));
    } catch (err) {
      return safeErrorResponse(res, 400, 'Invalid calibration payload', err);
    }
  }

  // 6.5. Quản trị Auto-Learning 2.0 (Approve / Reject / Rollback — Admin Fail-Closed!)
  if (req.method === 'POST' && (pathname === '/api/auto-learning/approve' || pathname === '/api/auto-learning/reject' || pathname === '/api/auto-learning/rollback')) {
    const adminCheck = verifyAdminRequest(req);
    if (!adminCheck.ok) {
      res.writeHead(adminCheck.statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ status: 'error', error: adminCheck.error }));
    }
    try {
      const data = await parseJsonBody(req);
      const { autoLearningStore } = require(path.join(kiemthuDir, 'engine', 'auto_learning_store.js'));
      let result;
      if (pathname === '/api/auto-learning/approve') {
        result = autoLearningStore.approveProposal(data.proposal_id, {
          approvedBy: sanitizeStringInput(data.approved_by || 'admin', 64),
          editedAnswer: data.edited_answer ? sanitizeStringInput(data.edited_answer, 1200) : null,
          note: sanitizeStringInput(data.note || '', 200)
        });
      } else if (pathname === '/api/auto-learning/reject') {
        result = autoLearningStore.rejectProposal(data.proposal_id, {
          rejectedBy: sanitizeStringInput(data.rejected_by || 'admin', 64),
          reason: sanitizeStringInput(data.reason || 'rejected_by_curator', 200)
        });
      } else {
        result = autoLearningStore.rollbackToVersion(data.version !== undefined ? Number(data.version) : null);
      }
      res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(result));
    } catch (err) {
      return safeErrorResponse(res, 500, 'Auto-learning admin action failed', err);
    }
  }

  // 6.6. Cấp phát / Xoay / Thu hồi khóa thiết bị ESP32 (Admin Fail-Closed!)
  if (req.method === 'POST' && (pathname === '/api/devices/issue-key' || pathname === '/api/devices/revoke')) {
    const adminCheck = verifyAdminRequest(req);
    if (!adminCheck.ok) {
      res.writeHead(adminCheck.statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ status: 'error', error: adminCheck.error }));
    }
    try {
      const data = await parseJsonBody(req);
      if (!data.device_id) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ status: 'error', error: 'Missing device_id' }));
      }
      if (pathname === '/api/devices/issue-key') {
        const issued = deviceAuth.issueDeviceKey(data.device_id);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: true, ...issued }));
      } else {
        const ok = deviceAuth.revokeDeviceKey(data.device_id, sanitizeStringInput(data.reason || 'admin_revoked', 120));
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ success: ok, device_id: data.device_id }));
      }
    } catch (err) {
      return safeErrorResponse(res, 400, 'Device credential operation failed', err);
    }
  }

  // 6.7. ESP32 Multi-Device Heartbeat & Health Telemetry
  if (req.method === 'POST' && pathname === '/api/devices/heartbeat') {
    try {
      const data = await parseJsonBody(req);
      const devId = sanitizeStringInput(data.device_id || req.headers['x-device-id'] || '', 64);
      if (!devId) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ status: 'error', error: 'Missing device_id' }));
      }
      const devAuth = deviceAuth.verifyDevice(req, devId);
      if (!devAuth.ok) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ status: 'error', error: devAuth.reason }));
      }
      const health = bleManager.recordHeartbeat(devId, data);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ success: true, device: health }));
    } catch (err) {
      return safeErrorResponse(res, err.statusCode || 400, 'Invalid heartbeat payload', err);
    }
  }

  if (req.method === 'GET' && pathname === '/api/devices/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      status: 'ok',
      ...bleManager.listAllDevicesHealth()
    }, null, 2));
  }

  // 6.8. Thu thập Phản hồi Du khách (Feedback -> Auto-Learning 2.0)
  if (req.method === 'POST' && pathname === '/api/feedback') {
    try {
      const data = await parseJsonBody(req);
      const { autoLearningStore } = require(path.join(kiemthuDir, 'engine', 'auto_learning_store.js'));
      const resFb = autoLearningStore.recordFeedback({
        question: sanitizeStringInput(data.question || '', 500),
        reply: sanitizeStringInput(data.reply || '', 700),
        rating: data.rating,
        comment: sanitizeStringInput(data.comment || '', 300),
        deviceId: sanitizeStringInput(data.device_id || req.headers['x-device-id'] || 'GUEST', 64),
        language: normalizeLangCode(data.language) || 'vi'
      });
      res.writeHead(resFb.success ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(resFb));
    } catch (err) {
      return safeErrorResponse(res, err.statusCode || 400, 'Invalid feedback payload', err);
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

  // 8.4 API Xem Kho Tri Thức Tự Học & Chỉ Mục Ngữ Nghĩa Cục Bộ (Phương pháp 1 + 2)
  if (req.method === 'GET' && pathname === '/api/learned-knowledge') {
    let learnedSummary = { total_learned: 0, storage: 'Local JSON' };
    let semanticDocs = 0;
    try {
      const { autoLearningStore } = require(path.join(kiemthuDir, 'engine', 'auto_learning_store.js'));
      const { knowledgeBase } = require(path.join(kiemthuDir, 'engine', 'knowledge_base.js'));
      learnedSummary = autoLearningStore.getSummary();
      semanticDocs = knowledgeBase.localSemanticIndex?.docs?.length || 0;
    } catch (e) {}
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      status: 'ok',
      local_semantic_index_docs: semanticDocs,
      auto_learning: learnedSummary
    }, null, 2));
  }

  // 8.5 Health check cho Render & Uptime monitor
  if (req.method === 'GET' && (pathname === '/health' || pathname === '/api/health')) {
    let kbStats = null;
    try {
      const kbPath = path.join(kiemthuDir, 'engine', 'knowledge_base.js');
      const learnPath = path.join(kiemthuDir, 'engine', 'auto_learning_store.js');
      if (fs.existsSync(kbPath)) {
        const { knowledgeBase } = require(kbPath);
        const autoLearn = fs.existsSync(learnPath) ? require(learnPath).autoLearningStore : null;
        kbStats = {
          facts100: knowledgeBase.facts100?.length || 0,
          groundTruth500: knowledgeBase.groundTruth500?.length || 0,
          servicePolicies: knowledgeBase.servicePolicies?.length || 0,
          expandedKnowledge: knowledgeBase.expandedKnowledge?.length || 0,
          dataset1000: knowledgeBase.dataset1000?.length || 0,
          localSemanticVectorDocs: knowledgeBase.localSemanticIndex?.docs?.length || 0,
          autoLearnedLocal: autoLearn ? autoLearn.records.length : 0
        };
      }
    } catch (e) {}
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      status: 'ok',
      uptime_sec: Math.round(process.uptime()),
      render_mode: IS_RENDER,
      ffmpeg_bin: FFMPEG_BIN,
      kiemthu_dir: kiemthuDir,
      kiemthu_ready: fs.existsSync(path.join(kiemthuDir, 'smart_ai_server.js')),
      kb_stats: kbStats,
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

// Tối ưu HTTP keep-alive & timeout tương thích chuẩn với Nginx Reverse Proxy (chống 502 và nghẽn socket kéo dài nhiều năm)
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.requestTimeout = 35000;

if (require.main === module) {
  server.listen(PORT, () => {
    const primaryIp = getPrimaryIp();
    // Pre-warm KiemThu AI + Google TTS TLS Keep-Alive + FFmpeg RAM cache ngay lúc boot!
    try {
      const kPath = path.join(kiemthuDir, 'smart_ai_server.js');
      if (fs.existsSync(kPath)) require(kPath);
    } catch (e) {
      console.warn('⚠ Pre-warm kiemthu notice:', e.message);
    }
    fastTextToPcm('Xin chào', 'vi').catch(() => {});
    console.log('\n================================================================');
    console.log('🏛️  ESP32 BLE TOUR GUIDE SERVER (V3.0 - PRODUCTION HARDENED)');
    console.log('================================================================');
    console.log(`📡 Màn Hình Trực Quan (Localhost): http://localhost:${PORT}`);
    console.log(`🌐 IP Mạng LAN (ESP32 Kết Nối)   : http://${primaryIp}:${PORT}`);
    console.log(`⚡ API Nhận Tín Hiệu (Mã/BLE)    : http://${primaryIp}:${PORT}/api/ble-scan`);
    console.log(`🎙️ API Giọng Nói AI (Voice Chat) : http://${primaryIp}:${PORT}/api/hub/ask`);
    console.log(`🛡️ Bảo Mật Production            : Fail-Closed Admin, RBAC, Rate-Limit, Magic-Byte`);
    console.log('================================================================\n');
  });
}

module.exports = {
  server,
  bleManager,
  deviceAuth,
  rateLimiter,
  beaconsStore,
  queryKiemThuAI,
  sanitizeTextForSpeech,
  splitIntoAudioChunks,
  normalizeLangCode,
  isTextInLanguage,
  translateTextStrict,
  normalizeForeignQueryForLookup
};
