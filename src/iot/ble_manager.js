/**
 * =========================================================================================
 * 📡 BLE SIGNAL STABILIZER, ZONE HYSTERESIS & MULTI-DEVICE HUB MANAGER (PHASE 5)
 * =========================================================================================
 * 1. Lọc nhiễu RSSI bằng Exponential Moving Average (EMA) theo từng cặp (deviceId, beaconId).
 * 2. Chống nhảy Beacon liên tục khi đứng giữa 2 hiện vật (Hysteresis Margin +6 dBm + Stability Count).
 * 3. Phân định trung thực cấp độ định vị (KHÔNG tuyên bố định vị tọa độ x,y từ 1 RSSI!):
 *    - PROXIMITY (gần 1 beacon) -> ZONE (vùng trưng bày ổn định) -> ROOM (cấp phòng)
 * 4. Cooldown thông minh theo từng (deviceId, beaconId).
 * 5. Phát hiện xung đột Beacon trùng MAC/ID & hỗ trợ hiệu chỉnh ngưỡng RSSI theo môi trường.
 * 6. Quản lý đa thiết bị ESP32 độc lập hoàn toàn (Device Registry):
 *    - Không ghi đè state / session / ngôn ngữ giữa các thiết bị
 *    - Heartbeat, Health Status, Offline Detection (> 45s không nhịp tim), Error Counter
 * =========================================================================================
 */

const path = require('path');
const { SafeJsonStore, logEvent } = require('../storage/safe_store');

class BleAndDeviceManager {
  constructor(options = {}) {
    this.emaAlpha = Number(process.env.BLE_EMA_ALPHA) || 0.35;          // Hệ số làm mượt EMA
    this.hysteresisDb = Number(process.env.BLE_HYSTERESIS_DB) || 6;     // Chênh lệch tối thiểu để đổi vùng (dBm)
    this.minStableHits = Number(process.env.BLE_STABLE_HITS) || 2;      // Số lần quét liên tiếp để đổi vùng ổn định
    this.defaultRssiThreshold = Number(process.env.BLE_MIN_RSSI) || -78;
    this.offlineThresholdMs = Number(process.env.DEVICE_OFFLINE_MS) || 45 * 1000;

    // Trạng thái cách ly theo từng thiết bị: deviceId -> DeviceContext
    this.devices = new Map();
    this.maxDevices = Number(process.env.MAX_BLE_DEVICES) || 2000;
    this.deviceTtlMs = Number(process.env.BLE_DEVICE_TTL_MS) || 24 * 60 * 60 * 1000;
    setInterval(() => this.cleanupStaleDevices(), 10 * 60 * 1000).unref();
    // Khóa hiệu chỉnh môi trường theo từng beaconId: beaconId -> { rssiOffset, threshold }
    this.calibrationStore = new SafeJsonStore(
      options.calibrationPath || path.join(__dirname, '..', '..', 'data', 'ble_calibration.json'),
      { defaultData: { version: 1, globalRssiThreshold: this.defaultRssiThreshold, beacons: {} } }
    );
    this.calibration = this.calibrationStore.readSync();
  }

  cleanupStaleDevices() {
    const now = Date.now();
    for (const [id, dev] of this.devices.entries()) {
      // Giữ lại thiết bị cứng đã từng gửi heartbeat hoặc hoạt động trong 24h gần nhất
      const isStaleGuest = !dev.lastHeartbeatAt && (now - (dev.lastSeenAt || 0) > this.deviceTtlMs);
      const isVeryOld = now - (dev.lastSeenAt || 0) > this.deviceTtlMs * 7;
      if (isStaleGuest || isVeryOld) {
        this.devices.delete(id);
      }
    }
    if (this.devices.size > this.maxDevices) {
      const sorted = Array.from(this.devices.entries()).sort((a, b) => (a[1].lastSeenAt || 0) - (b[1].lastSeenAt || 0));
      const excess = this.devices.size - this.maxDevices;
      for (let i = 0; i < excess; i++) {
        this.devices.delete(sorted[i][0]);
      }
    }
  }

  getOrCreateDevice(deviceId) {
    const cleanId = String(deviceId || 'GUEST_CLIENT').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64);
    let dev = this.devices.get(cleanId);
    if (!dev) {
      if (this.devices.size >= this.maxDevices) {
        this.cleanupStaleDevices();
      }
      dev = {
        deviceId: cleanId,
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now(),
        lastHeartbeatAt: null,
        firmwareVersion: 'unknown',
        wifiRssi: null,
        freeHeap: null,
        batteryPct: null,
        lockedLanguage: null,           // Cách ly ngôn ngữ riêng theo từng thiết bị!
        activeBeaconId: null,
        activeBeaconCode: null,
        activeZoneEnteredAt: 0,
        candidateBeaconId: null,
        candidateStableCount: 0,
        emaRssiByBeacon: new Map(),     // beaconId -> smoothedRssi
        cooldownByBeacon: new Map(),    // beaconId -> lastTriggeredAtMs
        latestBeaconPayload: null,
        latestVoicePayload: null,
        activeVoiceSeq: 0,              // Sequence number chống đảo thứ tự voice
        stats: {
          bleScans: 0,
          bleTriggers: 0,
          bleSkippedCooldown: 0,
          bleSkippedHysteresis: 0,
          bleSkippedWeakSignal: 0,
          voiceRequests: 0,
          errors: 0,
          lastError: null
        }
      };
      this.devices.set(cleanId, dev);
    }
    dev.lastSeenAt = Date.now();
    return dev;
  }

  /**
   * Phát hiện xung đột Beacon trùng MAC hoặc trùng Code trong beacons.json
   */
  detectBeaconConflicts(beacons) {
    const macSeen = new Map();
    const codeSeen = new Map();
    const conflicts = [];

    for (const b of (beacons || [])) {
      const mac = (b.mac || '').toUpperCase().trim();
      const code = String(b.code || '').trim();
      if (mac) {
        if (macSeen.has(mac)) {
          conflicts.push({ type: 'DUPLICATE_MAC', mac, ids: [macSeen.get(mac), b.id] });
        } else {
          macSeen.set(mac, b.id);
        }
      }
      if (code) {
        if (codeSeen.has(code)) {
          conflicts.push({ type: 'DUPLICATE_CODE', code, ids: [codeSeen.get(code), b.id] });
        } else {
          codeSeen.set(code, b.id);
        }
      }
    }
    return conflicts;
  }

  getThresholdForBeacon(beacon) {
    const custom = this.calibration?.beacons?.[beacon.id]?.threshold;
    if (typeof custom === 'number') return custom;
    if (typeof beacon.rssi_threshold === 'number') return beacon.rssi_threshold;
    return this.calibration?.globalRssiThreshold || this.defaultRssiThreshold;
  }

  setCalibration(beaconId, { threshold, rssiOffset = 0 }) {
    if (!this.calibration.beacons) this.calibration.beacons = {};
    this.calibration.beacons[beaconId] = {
      threshold: Number(threshold),
      rssiOffset: Number(rssiOffset || 0),
      updatedAt: new Date().toISOString()
    };
    this.calibrationStore.writeSync(this.calibration);
    return this.calibration.beacons[beaconId];
  }

  /**
   * Ước lượng mức định vị trung thực theo RSSI (KHÔNG bao giờ tuyên bố tọa độ chính xác từ 1 RSSI!)
   */
  classifyPositioningLevel(smoothedRssi) {
    if (smoothedRssi >= -60) return { level: 'PROXIMITY_IMMEDIATE', approxBand: '< 1.5m (ngay trước hiện vật)' };
    if (smoothedRssi >= -75) return { level: 'ZONE_NEAR', approxBand: '1.5m - 4m (trong vùng trưng bày)' };
    if (smoothedRssi >= -88) return { level: 'ROOM_FAR', approxBand: '4m - 10m (cấp phòng/hành lang)' };
    return { level: 'OUT_OF_RANGE', approxBand: '> 10m (ngoài vùng kích hoạt)' };
  }

  /**
   * Đánh giá tín hiệu BLE từ ESP32/Client với EMA + Hysteresis + Stability + Smart Cooldown
   */
  evaluateBleScan({ deviceId, beacon, rawRssi = null, isManual = false, force = false }) {
    const dev = this.getOrCreateDevice(deviceId);
    dev.stats.bleScans++;

    // Bấm test thủ công hoặc force=true -> bỏ qua lọc RSSI/cooldown để kiểm thử ngay
    if (isManual || force) {
      dev.activeBeaconId = beacon.id;
      dev.activeBeaconCode = beacon.code;
      dev.activeZoneEnteredAt = Date.now();
      dev.stats.bleTriggers++;
      return {
        action: 'TRIGGER',
        reason: 'manual_or_forced',
        smoothedRssi: rawRssi,
        positioning: { level: 'MANUAL_ZONE_SELECT', approxBand: 'Chọn thủ công / mô phỏng' },
        device: dev
      };
    }

    // 1. Lọc nhiễu RSSI bằng EMA (Exponential Moving Average)
    const offset = Number(this.calibration?.beacons?.[beacon.id]?.rssiOffset || 0);
    const hasNumericRssi = typeof rawRssi === 'number' && !isNaN(rawRssi);
    let smoothedRssi = hasNumericRssi ? (rawRssi + offset) : -65;

    if (hasNumericRssi) {
      const prevEma = dev.emaRssiByBeacon.get(beacon.id);
      smoothedRssi = prevEma === undefined
        ? (rawRssi + offset)
        : Number((this.emaAlpha * (rawRssi + offset) + (1 - this.emaAlpha) * prevEma).toFixed(2));
      dev.emaRssiByBeacon.set(beacon.id, smoothedRssi);
    }

    const positioning = this.classifyPositioningLevel(smoothedRssi);
    const threshold = this.getThresholdForBeacon(beacon);

    // 2. Ngưỡng tín hiệu tối thiểu theo môi trường
    if (hasNumericRssi && smoothedRssi < threshold) {
      dev.stats.bleSkippedWeakSignal++;
      return {
        action: 'SKIP_WEAK_SIGNAL',
        reason: `Smoothed RSSI (${smoothedRssi} dBm) below threshold (${threshold} dBm)`,
        smoothedRssi,
        threshold,
        positioning,
        device: dev
      };
    }

    // 3. Hysteresis & Zone Stability (chống nhảy qua lại liên tục khi khách đứng ở ranh giới 2 hiện vật!)
    if (dev.activeBeaconId && dev.activeBeaconId !== beacon.id && hasNumericRssi) {
      const activeRssi = dev.emaRssiByBeacon.get(dev.activeBeaconId);
      const isStrongerByMargin = activeRssi === undefined || (smoothedRssi >= activeRssi + this.hysteresisDb);

      if (!isStrongerByMargin) {
        dev.stats.bleSkippedHysteresis++;
        return {
          action: 'SKIP_HYSTERESIS',
          reason: `Candidate ${beacon.id} (${smoothedRssi} dBm) did not beat active ${dev.activeBeaconId} (${activeRssi} dBm) by +${this.hysteresisDb} dBm`,
          smoothedRssi,
          activeBeaconId: dev.activeBeaconId,
          positioning,
          device: dev
        };
      }

      // Yêu cầu ổn định tối thiểu `minStableHits` lần quét liên tiếp trước khi chuyển vùng
      if (dev.candidateBeaconId === beacon.id) {
        dev.candidateStableCount++;
      } else {
        dev.candidateBeaconId = beacon.id;
        dev.candidateStableCount = 1;
      }

      if (dev.candidateStableCount < this.minStableHits) {
        dev.stats.bleSkippedHysteresis++;
        return {
          action: 'SKIP_STABILIZING',
          reason: `Stabilizing zone transition to ${beacon.id} (${dev.candidateStableCount}/${this.minStableHits})`,
          smoothedRssi,
          stableCount: dev.candidateStableCount,
          requiredHits: this.minStableHits,
          positioning,
          device: dev
        };
      }
    }

    // 4. Smart Cooldown theo từng cặp (deviceId, beaconId)
    const cooldownSec = Number(beacon.cooldown_seconds || 0);
    if (cooldownSec > 0) {
      const lastTrig = dev.cooldownByBeacon.get(beacon.id) || 0;
      const elapsedSec = (Date.now() - lastTrig) / 1000;
      if (elapsedSec < cooldownSec) {
        dev.stats.bleSkippedCooldown++;
        return {
          action: 'SKIP_COOLDOWN',
          reason: `Cooldown active for ${beacon.id}`,
          remainingSeconds: Math.ceil(cooldownSec - elapsedSec),
          cooldownSeconds: cooldownSec,
          smoothedRssi,
          positioning,
          device: dev
        };
      }
    }

    // Đủ điều kiện kích hoạt vùng mới ổn định!
    dev.activeBeaconId = beacon.id;
    dev.activeBeaconCode = beacon.code;
    dev.activeZoneEnteredAt = Date.now();
    dev.candidateBeaconId = null;
    dev.candidateStableCount = 0;
    dev.cooldownByBeacon.set(beacon.id, Date.now());
    dev.stats.bleTriggers++;

    return {
      action: 'TRIGGER',
      reason: 'stable_zone_detected',
      smoothedRssi,
      positioning,
      device: dev
    };
  }

  recordHeartbeat(deviceId, telemetry = {}) {
    const dev = this.getOrCreateDevice(deviceId);
    dev.lastHeartbeatAt = Date.now();
    if (telemetry.firmware_version) dev.firmwareVersion = String(telemetry.firmware_version).slice(0, 32);
    if (typeof telemetry.wifi_rssi === 'number') dev.wifiRssi = telemetry.wifi_rssi;
    if (typeof telemetry.free_heap === 'number') dev.freeHeap = telemetry.free_heap;
    if (typeof telemetry.battery_pct === 'number') dev.batteryPct = telemetry.battery_pct;
    if (telemetry.current_code) dev.activeBeaconCode = String(telemetry.current_code).slice(0, 20);
    if (telemetry.last_error) {
      dev.stats.errors++;
      dev.stats.lastError = { msg: String(telemetry.last_error).slice(0, 200), at: new Date().toISOString() };
    }
    return this.getDeviceHealthSnapshot(dev.deviceId);
  }

  recordDeviceError(deviceId, errorMessage) {
    const dev = this.getOrCreateDevice(deviceId);
    dev.stats.errors++;
    dev.stats.lastError = { msg: String(errorMessage || 'unknown').slice(0, 200), at: new Date().toISOString() };
  }

  getDeviceHealthSnapshot(deviceId) {
    const dev = this.devices.get(deviceId);
    if (!dev) return null;
    const now = Date.now();
    const msSinceSeen = now - dev.lastSeenAt;
    const status = msSinceSeen > this.offlineThresholdMs
      ? 'OFFLINE'
      : (dev.stats.errors >= 10 ? 'DEGRADED' : 'ONLINE');
    return {
      device_id: dev.deviceId,
      status,
      ms_since_last_seen: msSinceSeen,
      last_seen_at: new Date(dev.lastSeenAt).toISOString(),
      last_heartbeat_at: dev.lastHeartbeatAt ? new Date(dev.lastHeartbeatAt).toISOString() : null,
      firmware_version: dev.firmwareVersion,
      wifi_rssi: dev.wifiRssi,
      free_heap: dev.freeHeap,
      battery_pct: dev.batteryPct,
      locked_language: dev.lockedLanguage,
      active_beacon_code: dev.activeBeaconCode,
      stats: { ...dev.stats }
    };
  }

  listAllDevicesHealth() {
    const list = [];
    for (const id of this.devices.keys()) {
      list.push(this.getDeviceHealthSnapshot(id));
    }
    return {
      total_devices: list.length,
      online_count: list.filter(d => d.status === 'ONLINE').length,
      degraded_count: list.filter(d => d.status === 'DEGRADED').length,
      offline_count: list.filter(d => d.status === 'OFFLINE').length,
      devices: list
    };
  }
}

module.exports = {
  BleAndDeviceManager
};
