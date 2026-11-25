/**
 * =========================================================================================
 * 🛡️ CYBERSECURITY & RBAC MIDDLEWARE (PHASE 2 — FAIL-CLOSED PRODUCTION SECURITY)
 * =========================================================================================
 * 1. CORS Allowlist chặt chẽ trong Production (không dùng wildcard `*` ở production!)
 * 2. Full HTTP Security Headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, CSP, HSTS)
 * 3. Per-IP Sliding Window Rate Limiter phân tách theo tầng (public / voice / admin)
 * 4. Giới hạn nghiêm ngặt Payload JSON (64KB) & Audio Upload (5MB) + kiểm tra Magic-Byte thực tế
 * 5. RBAC 3 vai trò (guest / device / admin) với Timing-Safe Comparison (`crypto.timingSafeEqual`)
 *    - Admin APIs: FAIL-CLOSED mặc định khi thiếu ADMIN_API_KEY!
 *    - Device Auth: Hỗ trợ cấp/thu hồi/xoay khóa thiết bị ESP32 (`X-Device-Token` / `DEVICE_API_KEYS`)
 * 6. Chống lộ stack trace / đường dẫn nội bộ ra client.
 * =========================================================================================
 */

const crypto = require('crypto');
const path = require('path');
const { SafeJsonStore, logEvent } = require('../storage/safe_store');

const MAX_JSON_BYTES = Number(process.env.MAX_JSON_BYTES) || 64 * 1024;          // 64 KB
const MAX_AUDIO_BYTES = Number(process.env.MAX_AUDIO_BYTES) || 5 * 1024 * 1024;  // 5 MB

function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function getClientIp(req) {
  const trustProxy = process.env.TRUST_PROXY === 'true' || Boolean(process.env.RENDER);
  if (trustProxy && req.headers['x-forwarded-for']) {
    return req.headers['x-forwarded-for'].split(',')[0].trim();
  }
  return (req.socket && req.socket.remoteAddress) || '127.0.0.1';
}

function isProductionEnv() {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);
}

function parseAllowedOrigins() {
  const raw = (process.env.ALLOWED_ORIGINS || '').trim();
  if (raw) {
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }
  // Trong development cho phép localhost; trong production mặc định từ chối cross-origin nếu chưa cấu hình ALLOWED_ORIGINS
  return isProductionEnv()
    ? []
    : ['http://localhost:5000', 'http://127.0.0.1:5000', 'http://localhost:3000', 'http://127.0.0.1:3000'];
}

function applySecurityHeaders(req, res) {
  const origin = req.headers.origin || '';
  const allowed = parseAllowedOrigins();
  const isProd = isProductionEnv();

  // CORS chặt chẽ: KHÔNG BAO GIỜ phát wildcard `*` khi NODE_ENV=production!
  if (origin) {
    if (allowed.includes(origin) || (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/i.test(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else if (!isProd && allowed.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    // Trong production với origin lạ: KHÔNG gắn Access-Control-Allow-Origin -> trình duyệt chặn CORS!
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range, X-End-Speech-Time, X-Artifact-Code, X-Code, X-Device-Id, X-Device-Token, X-Session-Id, X-Audio-Format, X-Pinggy-No-Screen, X-Language, X-Admin-Key');

  // HTTP Security Headers chuẩn OWASP
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(self)');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; media-src 'self' blob: data:; connect-src 'self'");
  if (isProd || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

function isOriginAllowedForRequest(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // Same-origin, curl, ESP32 không gửi Origin header
  const allowed = parseAllowedOrigins();
  if (allowed.includes(origin)) return true;
  if (!isProductionEnv()) {
    if (allowed.includes('*')) return true;
    if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/i.test(origin)) return true;
  }
  // Cho phép same-host (Origin trùng Host header)
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (host) {
    try {
      const u = new URL(origin);
      if (u.host === host) return true;
    } catch (e) {}
  }
  return false;
}

/**
 * Sliding-Window Rate Limiter theo IP + Tier
 */
class RateLimiter {
  constructor() {
    this.buckets = new Map(); // key -> number[] timestamps
    this.maxBuckets = 10000;  // Chặn phình RAM khi bị flood từ hàng nghìn IP giả mạo
    setInterval(() => this.cleanup(), 60 * 1000).unref();
  }

  check(ip, tier = 'general', customLimit = null) {
    const now = Date.now();
    const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000;
    const defaults = {
      general: Number(process.env.RATE_LIMIT_GENERAL) || 120,
      voice: Number(process.env.RATE_LIMIT_VOICE) || 120,
      ble: Number(process.env.RATE_LIMIT_BLE) || 90,
      admin: Number(process.env.RATE_LIMIT_ADMIN) || 30
    };
    const limit = customLimit || defaults[tier] || 120;
    const key = `${tier}:${ip}`;
    if (!this.buckets.has(key) && this.buckets.size >= this.maxBuckets) {
      const oldestKey = this.buckets.keys().next().value;
      if (oldestKey) this.buckets.delete(oldestKey);
    }
    const arr = (this.buckets.get(key) || []).filter(ts => now - ts < windowMs);
    arr.push(now);
    this.buckets.set(key, arr);

    const remaining = Math.max(0, limit - arr.length);
    return {
      allowed: arr.length <= limit,
      limit,
      remaining,
      resetMs: arr.length > 0 ? Math.max(0, windowMs - (now - arr[0])) : windowMs
    };
  }

  reset() {
    this.buckets.clear();
  }

  cleanup() {
    const now = Date.now();
    const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000;
    for (const [k, arr] of this.buckets.entries()) {
      const kept = arr.filter(ts => now - ts < windowMs);
      if (kept.length === 0) this.buckets.delete(k);
      else this.buckets.set(k, kept);
    }
  }
}

/**
 * Quản lý Khóa Thiết bị ESP32 & Cơ chế Thu hồi / Xoay khóa (Device Key Registry)
 */
class DeviceAuthManager {
  constructor(storePath) {
    this.store = new SafeJsonStore(storePath, {
      defaultData: { version: 1, keys: {}, revoked: [] }
    });
    this.state = this.store.readSync();
    if (!this.state.keys) this.state.keys = {};
    if (!Array.isArray(this.state.revoked)) this.state.revoked = [];
  }

  getEnvDeviceTokens() {
    // Format hỗ trợ: DEVICE_API_KEYS="ESP32_01:tok1,ESP32_02:tok2" hoặc token đơn "tok_shared"
    const raw = (process.env.DEVICE_API_KEYS || '').trim();
    const map = new Map();
    if (!raw) return map;
    for (const part of raw.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.includes(':')) {
        const idx = trimmed.indexOf(':');
        map.set(trimmed.slice(0, idx).trim(), trimmed.slice(idx + 1).trim());
      } else {
        map.set('*', trimmed);
      }
    }
    return map;
  }

  isDeviceAuthEnforced() {
    return process.env.REQUIRE_DEVICE_AUTH === 'true' ||
      Boolean((process.env.DEVICE_API_KEYS || '').trim()) ||
      Object.keys(this.state.keys || {}).length > 0;
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
  }

  issueDeviceKey(deviceId) {
    const cleanId = String(deviceId || '').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 64);
    if (!cleanId) throw new Error('Invalid device_id');
    const plainToken = 'esp_' + crypto.randomBytes(24).toString('hex');
    const tokenHash = this.hashToken(plainToken);
    this.state.keys[cleanId] = {
      tokenHash,
      issuedAt: new Date().toISOString(),
      status: 'active'
    };
    this.state.revoked = this.state.revoked.filter(r => r.deviceId !== cleanId);
    this.store.writeSync(this.state);
    logEvent('INFO', 'DeviceAuth', `Issued/rotated key for device ${cleanId}`);
    return { deviceId: cleanId, token: plainToken, issuedAt: this.state.keys[cleanId].issuedAt };
  }

  revokeDeviceKey(deviceId, reason = 'admin_revoked') {
    const cleanId = String(deviceId || '').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 64);
    if (!cleanId) return false;
    if (this.state.keys[cleanId]) {
      this.state.keys[cleanId].status = 'revoked';
      this.state.keys[cleanId].revokedAt = new Date().toISOString();
    }
    this.state.revoked.push({ deviceId: cleanId, reason, revokedAt: new Date().toISOString() });
    this.store.writeSync(this.state);
    logEvent('WARN', 'DeviceAuth', `Revoked device ${cleanId}`, { reason });
    return true;
  }

  verifyDevice(req, deviceId = '') {
    const token = (req.headers['x-device-token'] || '').trim() ||
      ((req.headers.authorization || '').startsWith('Device ') ? req.headers.authorization.slice(7).trim() : '');
    const cleanId = String(deviceId || req.headers['x-device-id'] || '').trim();

    // Kiểm tra danh sách thu hồi trước
    if (cleanId && this.state.keys[cleanId]?.status === 'revoked') {
      return { ok: false, role: 'revoked', reason: 'Device credentials have been revoked' };
    }

    // Nếu thiết bị đã đăng ký khóa trong registry -> bắt buộc xác thực
    if (cleanId && this.state.keys[cleanId]?.status === 'active') {
      if (!token) return { ok: false, role: 'guest', reason: 'Missing X-Device-Token for registered device' };
      const ok = timingSafeEqualStr(this.hashToken(token), this.state.keys[cleanId].tokenHash);
      return ok
        ? { ok: true, role: 'device', deviceId: cleanId }
        : { ok: false, role: 'guest', reason: 'Invalid X-Device-Token' };
    }

    // Kiểm tra DEVICE_API_KEYS từ biến môi trường
    const envMap = this.getEnvDeviceTokens();
    if (envMap.size > 0) {
      if (!token) {
        if (process.env.REQUIRE_DEVICE_AUTH === 'true') {
          return { ok: false, role: 'guest', reason: 'Device authentication required' };
        }
        return { ok: true, role: 'guest', deviceId: cleanId || 'GUEST' };
      }
      const expectedSpecific = cleanId ? envMap.get(cleanId) : null;
      const expectedWildcard = envMap.get('*');
      if ((expectedSpecific && timingSafeEqualStr(token, expectedSpecific)) ||
          (expectedWildcard && timingSafeEqualStr(token, expectedWildcard))) {
        return { ok: true, role: 'device', deviceId: cleanId || 'REGISTERED_DEVICE' };
      }
      return { ok: false, role: 'guest', reason: 'Invalid device API key' };
    }

    if (process.env.REQUIRE_DEVICE_AUTH === 'true') {
      return { ok: false, role: 'guest', reason: 'Device authentication required but no keys configured' };
    }
    return { ok: true, role: 'guest', deviceId: cleanId || 'GUEST' };
  }
}

/**
 * Xác thực Quản trị viên — FAIL-CLOSED MẶC ĐỊNH!
 * Nếu ADMIN_API_KEY chưa được cấu hình -> TỪ CHỐI 503/401 (KHÔNG BAO GIỜ mở cửa tự do!)
 */
function verifyAdminRequest(req) {
  const configuredKey = (process.env.ADMIN_API_KEY || '').trim();
  if (!configuredKey) {
    return {
      ok: false,
      statusCode: 503,
      role: 'none',
      error: 'Admin API disabled: ADMIN_API_KEY environment variable is not configured (fail-closed).'
    };
  }
  const hdrKey = (req.headers['x-admin-key'] || '').trim();
  const authHdr = (req.headers.authorization || '').trim();
  const bearer = authHdr.startsWith('Bearer ') ? authHdr.slice(7).trim() : '';
  const supplied = hdrKey || bearer;

  if (!supplied || !timingSafeEqualStr(supplied, configuredKey)) {
    return {
      ok: false,
      statusCode: 401,
      role: 'none',
      error: 'Unauthorized: Missing or invalid administrator credentials.'
    };
  }
  return { ok: true, statusCode: 200, role: 'admin' };
}

/**
 * Kiểm định nhị phân Magic-Byte cho tệp âm thanh tải lên (chống giả mạo MIME / upload file độc hại!)
 */
function validateAudioBufferMagic(buf, declaredContentType = '') {
  if (!Buffer.isBuffer(buf) || buf.length < 44) {
    return { valid: false, reason: 'Audio payload too small or empty (< 44 bytes)' };
  }
  if (buf.length > MAX_AUDIO_BYTES) {
    return { valid: false, reason: `Audio payload exceeds limit (${MAX_AUDIO_BYTES} bytes)` };
  }

  // Từ chối rõ ràng HTML / Script / Executable / PDF / ZIP giả danh audio
  const headAscii = buf.slice(0, 16).toString('utf8').trim().toLowerCase();
  if (headAscii.startsWith('<!doc') || headAscii.startsWith('<html') || headAscii.startsWith('<script') ||
      headAscii.startsWith('mz') || headAscii.startsWith('%pdf') || headAscii.startsWith('pk\x03\x04') ||
      headAscii.startsWith('\x7felf')) {
    return { valid: false, reason: 'Rejected disguised non-audio binary/script file' };
  }

  // 1. RIFF....WAVE
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45) {
    return { valid: true, ext: 'wav', mime: 'audio/wav' };
  }
  // 2. WebM / Matroska (EBML 0x1A45DFA3)
  if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) {
    return { valid: true, ext: 'webm', mime: 'audio/webm' };
  }
  // 3. OGG (OggS)
  if (buf[0] === 0x4F && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
    return { valid: true, ext: 'ogg', mime: 'audio/ogg' };
  }
  // 4. MP3 (ID3 or frame sync 0xFFE0)
  if ((buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) ||
      (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0)) {
    return { valid: true, ext: 'mp3', mime: 'audio/mpeg' };
  }
  // 5. MP4 / M4A (ftyp at offset 4)
  if (buf.length >= 12 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    return { valid: true, ext: 'm4a', mime: 'audio/mp4' };
  }
  // 6. FLAC (fLaC)
  if (buf[0] === 0x66 && buf[1] === 0x4C && buf[2] === 0x61 && buf[3] === 0x43) {
    return { valid: true, ext: 'flac', mime: 'audio/flac' };
  }

  return {
    valid: false,
    reason: `Unsupported or spoofed audio signature (declared=${declaredContentType || 'none'})`
  };
}

/**
 * Validate input text & beacon fields chống injection / chuỗi siêu dài / ký tự điều khiển
 */
function sanitizeStringInput(val, maxLen = 500) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function validateBeaconPayload(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Payload must be a JSON object'] };
  if (data.new_code !== undefined && !/^[a-zA-Z0-9_\-]{1,20}$/.test(String(data.new_code).trim())) {
    errors.push('Invalid beacon code format (1-20 alphanumeric chars)');
  }
  if (data.mac !== undefined && !/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(String(data.mac).trim())) {
    errors.push('Invalid MAC address format (expected AA:BB:CC:DD:EE:FF)');
  }
  if (data.cooldown_seconds !== undefined) {
    const cd = Number(data.cooldown_seconds);
    if (isNaN(cd) || cd < 0 || cd > 3600) errors.push('cooldown_seconds must be between 0 and 3600');
  }
  if (data.rssi_threshold !== undefined) {
    const rt = Number(data.rssi_threshold);
    if (isNaN(rt) || rt < -110 || rt > -20) errors.push('rssi_threshold must be between -110 and -20 dBm');
  }
  if (data.text !== undefined && String(data.text).length > 2000) {
    errors.push('dialogue text exceeds 2000 characters');
  }
  return { valid: errors.length === 0, errors };
}

function safeErrorResponse(res, statusCode, publicMessage, internalErr = null) {
  if (internalErr) {
    logEvent('ERROR', 'HTTP', publicMessage, { error: internalErr.message || String(internalErr) });
  }
  if (!res.headersSent) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  }
  res.end(JSON.stringify({
    status: 'error',
    error: publicMessage
  }));
}

module.exports = {
  MAX_JSON_BYTES,
  MAX_AUDIO_BYTES,
  timingSafeEqualStr,
  getClientIp,
  isProductionEnv,
  parseAllowedOrigins,
  applySecurityHeaders,
  isOriginAllowedForRequest,
  RateLimiter,
  DeviceAuthManager,
  verifyAdminRequest,
  validateAudioBufferMagic,
  sanitizeStringInput,
  validateBeaconPayload,
  safeErrorResponse
};
