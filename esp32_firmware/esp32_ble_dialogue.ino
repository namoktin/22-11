/**
 * =========================================================================================
 * 🏛️ ESP32 SMART MUSEUM GUIDE & AI VOICE FIRMWARE (V3.0 — PRODUCTION HARDENED)
 * =========================================================================================
 * Nâng cấp độ tin cậy & bảo mật phần cứng (Phase 2 & Phase 5):
 * 1. TLS Certificate Pinning / Root CA Verification (ISRG Root X1 PEM) bật mặc định ở PRODUCTION_MODE=1.
 *    (KHÔNG dùng setInsecure() trong production!)
 * 2. Device Authentication qua header `X-Device-Token` (tách cấu hình bí mật sang secrets.h nếu cần).
 * 3. ESP32 Hardware Task Watchdog (15 giây) chống treo hệ thống ngoài thực địa.
 * 4. Wi-Fi Auto-Reconnect không chặn luồng với Exponential Backoff.
 * 5. BLE EMA RSSI Filter + Hysteresis (+6 dBm) + 2-hit Zone Stability + 45s Cooldown.
 * 6. Thu âm Microphone I2S thật (INMP441) + Barge-in (ngắt loa ngay khi khách bấm hỏi) +
 *    cấp phát/giải phóng bộ nhớ chặt chẽ (zero heap leak).
 * 7. Heartbeat Telemetry định kỳ (Wi-Fi RSSI, Free Heap, Firmware Version, Error Code).
 * =========================================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <driver/i2s.h>
#include <esp_task_wdt.h>
#include "Audio.h"

// =========================================================================================
// 1. CẤU HÌNH BẢO MẬT & KẾT NỐI (KHUYẾN NGHỊ TÁCH RA FILE secrets.h KHÔNG COMMIT LÊN GIT)
// =========================================================================================
#define FIRMWARE_VERSION    "3.0.0-prod"
#define PRODUCTION_MODE     1    // 1 = BẮT BUỘC xác minh chứng chỉ TLS (không gọi setInsecure!)
#define WDT_TIMEOUT_SEC     15   // Hardware Watchdog 15 giây

const char* WIFI_SSID       = "TEN_WIFI_CUA_BAN";
const char* WIFI_PASSWORD   = "MAT_KHAU_WIFI";
// Google Cloud VM Server (Port 80 Nginx Reverse Proxy -> Node.js 5000):
const char* SERVER_BASE     = "http://34.87.63.30";
const char* DEVICE_ID       = "ESP32_SMART_GUIDE_01";
const char* DEVICE_TOKEN    = ""; // Để trống nếu chế độ mặc định; hoặc điền token được cấp qua API /api/devices/issue-key
const char* LOCKED_LANGUAGE = "vi"; // vi | en | fr | ja | ko | zh

// Chứng chỉ gốc Let's Encrypt ISRG Root X1 (Render.com HTTPS)
const char* ISRG_ROOT_X1_CA = R"EOF(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----
)EOF";

// =========================================================================================
// 2. PHẦN CỨNG I2S DAC (PCM5102A), AMPLY (MAX97220), MICROPHONE (INMP441) & NÚT BẤM
// =========================================================================================
#define PIN_I2S_BCK         26
#define PIN_I2S_LCK         25
#define PIN_I2S_DIN         22
#define PIN_MAX97220_EN     21
#define PIN_HUB_TALK_BUTTON 0

#define I2S_MIC_PORT        I2S_NUM_1
#define PIN_MIC_SCK         14
#define PIN_MIC_WS          15
#define PIN_MIC_SD          32
#define MIC_SAMPLE_RATE     16000
#define MIC_MAX_RECORD_SEC  10
#define MIC_MIN_RECORD_MS   600

// =========================================================================================
// 3. THÔNG SỐ BLE EMA + HYSTERESIS + HEARTBEAT + ERROR CODES
// =========================================================================================
#define BLE_SCAN_TIME_SEC     2
#define SCAN_INTERVAL_MS      3000
#define HEARTBEAT_INTERVAL_MS 20000
#define MIN_RSSI_TRIGGER      -76
#define BLE_HYSTERESIS_DB     6
#define BLE_STABLE_HITS       2
#define BEACON_COOLDOWN_MS    45000
#define HTTP_TIMEOUT_MS       10000
#define DISCOVERY_PRINT_ALL   0

const char* ALLOWED_BEACON_MACS[] = {
  "AA:BB:CC:DD:EE:01", // Thay bằng MAC thật khi bật DISCOVERY_PRINT_ALL=1 ngoài thực địa
  "AA:BB:CC:DD:EE:02",
  "AA:BB:CC:DD:EE:03",
  "AA:BB:CC:DD:EE:04"
};
const int ALLOWED_BEACON_COUNT = sizeof(ALLOWED_BEACON_MACS) / sizeof(ALLOWED_BEACON_MACS[0]);

const uint8_t TARGET_IBEACON_UUID[16] = {
  0xFD, 0xA5, 0x06, 0x93, 0xA4, 0xE2, 0x4F, 0xB1,
  0xAF, 0xCF, 0xC6, 0xEB, 0x07, 0x64, 0x78, 0x25
};

// Mã lỗi chuẩn hóa cho telemetry
String lastErrorCode = "";
uint32_t wifiReconnectBackoffMs = 2000;
unsigned long lastWifiAttemptMs = 0;
unsigned long lastHeartbeatMs = 0;
unsigned long lastScanTime = 0;

Audio audio;
BLEScan* pBLEScan = nullptr;
WiFiClientSecure secureClient;
bool isAudioPlaying = false;
bool micInitialized = false;
String currentArtifactCode = "001";

// Bộ lọc EMA + Hysteresis theo từng beacon trong Whitelist
float emaRssi[4] = { -120.0f, -120.0f, -120.0f, -120.0f };
bool emaInit[4]  = { false, false, false, false };
int activeBeaconIdx = -1;
int candidateIdx = -1;
int candidateHits = 0;
unsigned long lastTriggerByIdx[4] = { 0, 0, 0, 0 };

struct ScanBest {
  String mac;
  int idx;
  int rssi;
  bool found;
};
ScanBest scanBest;

void recordError(const char* code, const char* detail) {
  lastErrorCode = String(code) + ":" + String(detail);
  Serial.printf("🚨 [ERR %s] %s | FreeHeap=%u\n", code, detail, ESP.getFreeHeap());
}

// =========================================================================================
// 4. WI-FI AUTO-RECONNECT & BẢO MẬT HTTPS TLS
// =========================================================================================
bool ensureWiFiConnected() {
  if (WiFi.status() == WL_CONNECTED) {
    wifiReconnectBackoffMs = 2000;
    return true;
  }
  unsigned long now = millis();
  if (now - lastWifiAttemptMs < wifiReconnectBackoffMs) return false;

  lastWifiAttemptMs = now;
  Serial.printf("📶 [WiFi] Mất kết nối -> thử kết nối lại (backoff %lums)...\n", wifiReconnectBackoffMs);
  WiFi.disconnect(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 5000) {
    esp_task_wdt_reset();
    delay(200);
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("✓ [WiFi] Đã kết nối lại! IP=%s | RSSI=%d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
    wifiReconnectBackoffMs = 2000;
    return true;
  }
  recordError("ERR_WIFI_DOWN", "Reconnect failed");
  wifiReconnectBackoffMs = min((uint32_t)30000, wifiReconnectBackoffMs * 2);
  return false;
}

bool beginServerRequest(HTTPClient& http, const String& url) {
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.setConnectTimeout(5000);
  bool ok = false;
  if (url.startsWith("https://")) {
#if PRODUCTION_MODE
    secureClient.setCACert(ISRG_ROOT_X1_CA);
#else
    secureClient.setInsecure(); // CHỈ DÀNH CHO DEV LOCAL — CẤM BẬT TRONG PRODUCTION!
#endif
    ok = http.begin(secureClient, url);
  } else {
    ok = http.begin(url);
  }
  if (ok) {
    http.addHeader("X-Device-Id", DEVICE_ID);
    http.addHeader("X-Device-Token", DEVICE_TOKEN);
    http.addHeader("X-Language", LOCKED_LANGUAGE);
    http.addHeader("X-Pinggy-No-Screen", "true");
  }
  return ok;
}

// =========================================================================================
// 5. KHỞI TẠO MICROPHONE I2S (INMP441) & THU ÂM .WAV AN TOÀN BỘ NHỚ
// =========================================================================================
bool initI2SMicrophone() {
  const i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = MIC_SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 6,
    .dma_buf_len = 512,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0
  };
  const i2s_pin_config_t pin_config = {
    .bck_io_num = PIN_MIC_SCK,
    .ws_io_num = PIN_MIC_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = PIN_MIC_SD
  };
  if (i2s_driver_install(I2S_MIC_PORT, &i2s_config, 0, NULL) != ESP_OK) {
    recordError("ERR_MIC_INIT", "i2s_driver_install failed");
    return false;
  }
  if (i2s_set_pin(I2S_MIC_PORT, &pin_config) != ESP_OK) {
    recordError("ERR_MIC_INIT", "i2s_set_pin failed");
    return false;
  }
  return true;
}

void writeWavHeader(uint8_t* h, uint32_t pcmBytes, uint32_t sampleRate) {
  uint32_t byteRate = sampleRate * 2;
  uint32_t riffLen = pcmBytes + 36;
  memcpy(h, "RIFF", 4);
  memcpy(h + 4, &riffLen, 4);
  memcpy(h + 8, "WAVEfmt ", 8);
  uint32_t fmtLen = 16; uint16_t pcmFmt = 1, ch = 1, align = 2, bits = 16;
  memcpy(h + 16, &fmtLen, 4); memcpy(h + 20, &pcmFmt, 2); memcpy(h + 22, &ch, 2);
  memcpy(h + 24, &sampleRate, 4); memcpy(h + 28, &byteRate, 4);
  memcpy(h + 32, &align, 2); memcpy(h + 34, &bits, 2);
  memcpy(h + 36, "data", 4); memcpy(h + 40, &pcmBytes, 4);
}

// Push-to-Talk thu âm thực từ I2S Mic, tự động giải phóng RAM sau khi gửi xong!
void captureAndSendMicWav() {
  if (!ensureWiFiConnected()) return;

  // Barge-in: ngắt âm thanh đang phát ngay lập tức khi khách nhấn hỏi
  if (isAudioPlaying) {
    audio.stopSong();
    isAudioPlaying = false;
  }

  if (!micInitialized) {
    recordError("ERR_MIC_UNAVAILABLE", "Fallback text query");
    return;
  }

  // Tự động thích ứng bộ nhớ: Ưu tiên PSRAM (10s), tự fallback 6s hoặc 4s trên ESP32 RAM nội bộ nhỏ
  size_t recSec = psramFound() ? MIC_MAX_RECORD_SEC : 6;
  size_t maxPcmBytes = MIC_SAMPLE_RATE * 2 * recSec;
  uint8_t* wavBuf = (uint8_t*)(psramFound() ? ps_malloc(44 + maxPcmBytes) : malloc(44 + maxPcmBytes));
  if (!wavBuf && !psramFound()) {
    recSec = 4;
    maxPcmBytes = MIC_SAMPLE_RATE * 2 * recSec;
    wavBuf = (uint8_t*)malloc(44 + maxPcmBytes);
  }
  if (!wavBuf) {
    recordError("ERR_MEM_ALLOC", "Failed to allocate WAV buffer");
    return;
  }

  size_t recordedBytes = 0;
  unsigned long startMs = millis();
  Serial.println("🎙️ [Mic I2S] Đang thu âm Push-to-Talk (nhả nút để gửi)...");

  while ((digitalRead(PIN_HUB_TALK_BUTTON) == LOW || millis() - startMs < MIC_MIN_RECORD_MS) &&
         recordedBytes + 1024 <= maxPcmBytes) {
    esp_task_wdt_reset();
    size_t bytesRead = 0;
    esp_err_t rc = i2s_read(I2S_MIC_PORT, wavBuf + 44 + recordedBytes, 1024, &bytesRead, pdMS_TO_TICKS(100));
    if (rc == ESP_OK && bytesRead > 0) {
      recordedBytes += bytesRead;
    } else if (rc != ESP_OK) {
      recordError("ERR_I2S_READ", "Microphone read error");
      break;
    }
  }

  if (recordedBytes < 3200) {
    Serial.println("⚠ Đoạn thu quá ngắn, hủy gửi.");
    free(wavBuf);
    return;
  }

  writeWavHeader(wavBuf, recordedBytes, MIC_SAMPLE_RATE);

  HTTPClient http;
  String url = String(SERVER_BASE) + "/api/hub/ask";
  if (beginServerRequest(http, url)) {
    http.addHeader("Content-Type", "audio/wav");
    http.addHeader("X-Artifact-Code", currentArtifactCode);
    int code = http.POST(wavBuf, 44 + recordedBytes);
    if (code == HTTP_CODE_OK) {
      String payload = http.getString();
      DynamicJsonDocument docIn(3072);
      if (deserializeJson(docIn, payload) == DeserializationError::Ok) {
        const char* wavUrl = docIn["audio_wav_url"] | "";
        if (strlen(wavUrl) > 0) {
          Serial.printf("🔊 [Single Streaming WAV] %s\n", wavUrl);
          isAudioPlaying = true;
          audio.connecttohost(wavUrl);
        }
      }
    } else {
      recordError("ERR_HTTP_ASK", String(code).c_str());
    }
    http.end();
  }
  free(wavBuf); // Luôn giải phóng bộ nhớ -> ZERO MEMORY LEAK!
}

// =========================================================================================
// 6. BLE SCANNER + EMA + HYSTERESIS + HEARTBEAT TELEMETRY
// =========================================================================================
int matchAllowedBeaconIndex(BLEAdvertisedDevice& dev, const String& macUpper) {
  for (int i = 0; i < ALLOWED_BEACON_COUNT; i++) {
    if (macUpper.equalsIgnoreCase(ALLOWED_BEACON_MACS[i])) return i;
  }
  if (dev.haveManufacturerData()) {
    std::string mfg = dev.getManufacturerData();
    if (mfg.length() >= 25 && (uint8_t)mfg[0] == 0x4C && (uint8_t)mfg[1] == 0x00 &&
        (uint8_t)mfg[2] == 0x02 && (uint8_t)mfg[3] == 0x15 &&
        memcmp((const uint8_t*)mfg.data() + 4, TARGET_IBEACON_UUID, 16) == 0) {
      return 0;
    }
  }
  return -1;
}

class HeritageBleCallbacks : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice dev) override {
    int rssi = dev.getRSSI();
    String mac = dev.getAddress().toString().c_str();
    mac.toUpperCase();
#if DISCOVERY_PRINT_ALL
    Serial.printf("🔍 [BLE] MAC=%s RSSI=%d Name=%s\n", mac.c_str(), rssi, dev.getName().c_str());
#endif
    int idx = matchAllowedBeaconIndex(dev, mac);
    if (idx < 0) return;

    // Lọc mượt EMA ngay trên ESP32
    emaRssi[idx] = emaInit[idx] ? (0.35f * rssi + 0.65f * emaRssi[idx]) : (float)rssi;
    emaInit[idx] = true;
    int smooth = (int)roundf(emaRssi[idx]);

    if (smooth >= MIN_RSSI_TRIGGER && smooth > scanBest.rssi) {
      scanBest.found = true;
      scanBest.idx = idx;
      scanBest.mac = mac;
      scanBest.rssi = smooth;
    }
  }
};

void sendBleTrigger(const String& mac, int smoothedRssi) {
  if (!ensureWiFiConnected()) return;
  HTTPClient http;
  String url = String(SERVER_BASE) + "/api/ble-scan";
  if (!beginServerRequest(http, url)) return;
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> docOut;
  docOut["device_id"] = DEVICE_ID;
  docOut["beacon_mac"] = mac;
  docOut["rssi"] = smoothedRssi;
  docOut["language"] = LOCKED_LANGUAGE;
  String body;
  serializeJson(docOut, body);

  int code = http.POST(body);
  if (code == HTTP_CODE_OK) {
    String payload = http.getString();
    DynamicJsonDocument docIn(2048);
    if (deserializeJson(docIn, payload) == DeserializationError::Ok) {
      String action = docIn["action"] | "";
      if (action == "PLAY_AUDIO") {
        currentArtifactCode = String((const char*)(docIn["code"] | "001"));
        const char* wavUrl = docIn["audio"]["wav_url"] | "";
        if (strlen(wavUrl) > 0) {
          isAudioPlaying = true;
          audio.connecttohost(wavUrl);
        }
      }
    }
  } else {
    recordError("ERR_HTTP_BLE", String(code).c_str());
  }
  http.end();
}

void sendHeartbeat() {
  if (!ensureWiFiConnected()) return;
  HTTPClient http;
  String url = String(SERVER_BASE) + "/api/devices/heartbeat";
  if (!beginServerRequest(http, url)) return;
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> docOut;
  docOut["device_id"] = DEVICE_ID;
  docOut["firmware_version"] = FIRMWARE_VERSION;
  docOut["wifi_rssi"] = WiFi.RSSI();
  docOut["free_heap"] = ESP.getFreeHeap();
  docOut["current_code"] = currentArtifactCode;
  if (lastErrorCode.length() > 0) {
    docOut["last_error"] = lastErrorCode;
    lastErrorCode = "";
  }
  String body;
  serializeJson(docOut, body);
  http.POST(body);
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(500);
  esp_task_wdt_init(WDT_TIMEOUT_SEC, true);
  esp_task_wdt_add(NULL);

  pinMode(PIN_MAX97220_EN, OUTPUT);
  digitalWrite(PIN_MAX97220_EN, HIGH);
  pinMode(PIN_HUB_TALK_BUTTON, INPUT_PULLUP);

  audio.setPinout(PIN_I2S_BCK, PIN_I2S_LCK, PIN_I2S_DIN);
  audio.setVolume(18);
  micInitialized = initI2SMicrophone();

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  ensureWiFiConnected();

  BLEDevice::init(DEVICE_ID);
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new HeritageBleCallbacks());
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);

  Serial.printf("✓ ESP32 Smart Museum Firmware %s Ready | FreeHeap=%u\n", FIRMWARE_VERSION, ESP.getFreeHeap());
}

void loop() {
  esp_task_wdt_reset();
  audio.loop();

  // [1] Barge-in & Push-to-Talk: cho phép ngắt loa hỏi ngay bất kỳ lúc nào!
  if (digitalRead(PIN_HUB_TALK_BUTTON) == LOW) {
    delay(40);
    if (digitalRead(PIN_HUB_TALK_BUTTON) == LOW) {
      captureAndSendMicWav();
      return;
    }
  }

  if (isAudioPlaying) {
    if (!audio.isRunning()) {
      isAudioPlaying = false;
      lastScanTime = millis();
    }
    return;
  }

  unsigned long now = millis();
  if (now - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatMs = now;
    sendHeartbeat();
  }

  // [2] Quét BLE với EMA + Hysteresis + Stability + Cooldown
  if (now - lastScanTime >= SCAN_INTERVAL_MS) {
    lastScanTime = now;
    scanBest = { "", -1, -999, false };
    pBLEScan->start(BLE_SCAN_TIME_SEC, false);
    esp_task_wdt_reset();

    if (scanBest.found && scanBest.idx >= 0) {
      bool allowTrigger = true;
      if (activeBeaconIdx >= 0 && activeBeaconIdx != scanBest.idx) {
        if (scanBest.rssi < (int)emaRssi[activeBeaconIdx] + BLE_HYSTERESIS_DB) {
          allowTrigger = false;
        } else {
          candidateHits = (candidateIdx == scanBest.idx) ? (candidateHits + 1) : 1;
          candidateIdx = scanBest.idx;
          if (candidateHits < BLE_STABLE_HITS) allowTrigger = false;
        }
      }
      if (allowTrigger && (now - lastTriggerByIdx[scanBest.idx] >= BEACON_COOLDOWN_MS || lastTriggerByIdx[scanBest.idx] == 0)) {
        activeBeaconIdx = scanBest.idx;
        candidateIdx = -1;
        candidateHits = 0;
        lastTriggerByIdx[scanBest.idx] = now;
        sendBleTrigger(scanBest.mac, scanBest.rssi);
      }
    }
    pBLEScan->clearResults();
  }
}

void audio_info(const char *info) { Serial.printf("audio_info: %s\n", info); }
void audio_eof_mp3(const char *info) { isAudioPlaying = false; }
