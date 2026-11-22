/**
 * =========================================================================================
 * 💾 SAFE ATOMIC JSON STORAGE, ROLLING BACKUP, MIGRATION & SANITIZED LOGGER (PHASE 7)
 * =========================================================================================
 * - Atomic Write: ghi file tạm (.tmp.<pid>.<ts>) rồi rename đồng bộ -> không bao giờ hỏng file khi crash!
 * - Serialized Write Queue theo đường dẫn file -> chống race-condition ghi đồng thời.
 * - Rolling Backup tự động (giữ 5 bản gần nhất trong data/backups/) + hỗ trợ rollback 1 bước.
 * - Schema Versioning & Migration an toàn.
 * - Structured Logger tự động che giấu secret (API key, Bearer token, password).
 * =========================================================================================
 */

const fs = require('fs');
const path = require('path');

const SECRET_PATTERNS = [
  /(gsk_[a-zA-Z0-9]{8,})/g,
  /(Bearer\s+[a-zA-Z0-9._\-]{6,})/gi,
  /(mongodb(?:\+srv)?:\/\/[^:\s]+:)([^@\s]+)(@)/gi,
  /("(?:api_key|apiKey|admin_key|adminKey|password|token|secret|authorization)"\s*:\s*")([^"]+)(")/gi
];

function sanitizeForLog(input) {
  let str = typeof input === 'string' ? input : JSON.stringify(input);
  if (!str) return '';
  str = str.replace(SECRET_PATTERNS[0], '[REDACTED_GROQ_KEY]');
  str = str.replace(SECRET_PATTERNS[1], 'Bearer [REDACTED_TOKEN]');
  str = str.replace(SECRET_PATTERNS[2], '$1[REDACTED_PWD]$3');
  str = str.replace(SECRET_PATTERNS[3], '$1[REDACTED]$3');
  return str;
}

function logEvent(level, component, message, meta = null) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    component,
    msg: sanitizeForLog(message)
  };
  if (meta && typeof meta === 'object') {
    try {
      entry.meta = JSON.parse(sanitizeForLog(meta));
    } catch (e) {
      entry.meta = sanitizeForLog(String(meta));
    }
  }
  const line = JSON.stringify(entry);
  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);
  return entry;
}

class SafeJsonStore {
  constructor(filePath, options = {}) {
    this.filePath = path.resolve(filePath);
    this.backupDir = options.backupDir || path.join(path.dirname(this.filePath), 'backups');
    this.maxBackups = options.maxBackups || 5;
    this.schemaVersion = options.schemaVersion || 1;
    this.defaultData = options.defaultData !== undefined ? options.defaultData : [];
    this.migrateFn = typeof options.migrate === 'function' ? options.migrate : null;
    this._writeQueue = Promise.resolve();
  }

  ensureDirs() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.backupDir)) fs.mkdirSync(this.backupDir, { recursive: true });
  }

  readSync() {
    try {
      if (!fs.existsSync(this.filePath)) {
        return typeof this.defaultData === 'function'
          ? this.defaultData()
          : JSON.parse(JSON.stringify(this.defaultData));
      }
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return this.migrateFn ? this.migrateFn(parsed) : parsed;
    } catch (err) {
      logEvent('ERROR', 'SafeJsonStore', `Failed reading ${path.basename(this.filePath)}, attempting backup recovery`, { error: err.message });
      const recovered = this.recoverLatestBackupSync();
      if (recovered !== null) return recovered;
      return typeof this.defaultData === 'function'
        ? this.defaultData()
        : JSON.parse(JSON.stringify(this.defaultData));
    }
  }

  createBackupSync() {
    if (!fs.existsSync(this.filePath)) return null;
    this.ensureDirs();
    const base = path.basename(this.filePath, path.extname(this.filePath));
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.backupDir, `${base}.${stamp}.${process.pid}.bak.json`);
    fs.copyFileSync(this.filePath, backupFile);
    this.pruneBackupsSync(base);
    return backupFile;
  }

  listBackupsSync() {
    if (!fs.existsSync(this.backupDir)) return [];
    const base = path.basename(this.filePath, path.extname(this.filePath));
    return fs.readdirSync(this.backupDir)
      .filter(f => f.startsWith(base + '.') && f.endsWith('.bak.json'))
      .sort()
      .reverse()
      .map(f => path.join(this.backupDir, f));
  }

  pruneBackupsSync(base) {
    const files = fs.readdirSync(this.backupDir)
      .filter(f => f.startsWith(base + '.') && f.endsWith('.bak.json'))
      .sort();
    while (files.length > this.maxBackups) {
      const oldest = files.shift();
      try { fs.unlinkSync(path.join(this.backupDir, oldest)); } catch (e) {}
    }
  }

  recoverLatestBackupSync() {
    const backups = this.listBackupsSync();
    for (const bFile of backups) {
      try {
        const parsed = JSON.parse(fs.readFileSync(bFile, 'utf8'));
        logEvent('WARN', 'SafeJsonStore', `Recovered from backup ${path.basename(bFile)}`);
        return this.migrateFn ? this.migrateFn(parsed) : parsed;
      } catch (e) {}
    }
    return null;
  }

  writeSync(data, { skipBackup = false } = {}) {
    this.ensureDirs();
    if (!skipBackup && fs.existsSync(this.filePath)) {
      try { this.createBackupSync(); } catch (e) {}
    }
    const serialized = JSON.stringify(data, null, 2);
    // Kiểm tra JSON hợp lệ trước khi ghi đè file chính
    JSON.parse(serialized);
    const tmpPath = `${this.filePath}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
    fs.writeFileSync(tmpPath, serialized, 'utf8');
    fs.renameSync(tmpPath, this.filePath);
    return true;
  }

  /**
   * Ghi bất đồng bộ tuần tự hóa qua hàng đợi (chống ghi đồng thời đè nhau!)
   */
  writeAtomic(data, opts = {}) {
    const task = this._writeQueue.then(() => this.writeSync(data, opts));
    this._writeQueue = task.catch(() => {});
    return task;
  }

  /**
   * Transaction cập nhật an toàn: đọc -> biến đổi -> kiểm định -> ghi atomic; nếu lỗi tự giữ nguyên bản cũ
   */
  updateTransaction(mutatorFn) {
    const task = this._writeQueue.then(async () => {
      const current = this.readSync();
      const snapshot = JSON.parse(JSON.stringify(current));
      try {
        const next = await mutatorFn(snapshot);
        this.writeSync(next);
        return next;
      } catch (err) {
        logEvent('ERROR', 'SafeJsonStore', `Transaction aborted for ${path.basename(this.filePath)}`, { error: err.message });
        throw err;
      }
    });
    this._writeQueue = task.catch(() => {});
    return task;
  }

  rollbackLatestSync() {
    const backups = this.listBackupsSync();
    if (backups.length === 0) return { success: false, error: 'No backup available for rollback' };
    const latest = backups[0];
    const parsed = JSON.parse(fs.readFileSync(latest, 'utf8'));
    this.writeSync(parsed, { skipBackup: true });
    return { success: true, restoredFrom: path.basename(latest), data: parsed };
  }
}

module.exports = {
  SafeJsonStore,
  sanitizeForLog,
  logEvent
};
