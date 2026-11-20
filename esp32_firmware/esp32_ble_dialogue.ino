/**
 * =========================================================================================
 * 🏛️ ESP32 BLE TOUR GUIDE & AI VOICE CLIENT (V2.0)
 * =========================================================================================
 * - Quét các thiết bị BLE Beacons (Mã 001: Trống Đồng, 002: Cây Bàng, 003: Đạt Hồng, 004: Bảo Kiếm)
 * - Gửi HTTP POST JSON lên Server qua Wi-Fi: /api/ble-scan
 * - Nhận tín hiệu lấy được luôn (Zero-cooldown, Instant Trigger)
 * - Stream và phát file âm thanh .WAV chuẩn PCM 16kHz Mono trực tiếp từ Server qua DAC I2S PCM5102A & Amply MAX97220
 * - Tích hợp hàm gửi Voice Query (câu hỏi giọng nói) và đo độ trễ từ lúc hết nói đến tiếng đầu tiên
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
#include "Audio.h"

// 1. CẤU HÌNH MẠNG WI-FI & ĐỊA CHỈ MÁY CHỦ
const char* WIFI_SSID     = "TEN_WIFI_CUA_BAN";
const char* WIFI_PASSWORD = "MAT_KHAU_WIFI";
// Có thể điền LAN (http://192.168.1.88:5000), Pinggy (http://xxxx.a.pinggy.link), hoặc Render (https://ten-app.onrender.com)
const char* SERVER_BASE   = "https://ten-app-cua-ban.onrender.com";
const char* DEVICE_ID     = "ESP32_SMART_GUIDE_01";

// 2. CẤU HÌNH CHÂN I2S DAC (PCM5102A), AMPLY MAX97220, MICROPHONE (INMP441) & NÚT BẤM HUB
#define PIN_I2S_BCK         26   // DAC Bit Clock (BCLK)
#define PIN_I2S_LCK         25   // DAC Word Select (LRCK)
#define PIN_I2S_DIN         22   // DAC Serial Data (DIN)
#define PIN_MAX97220_EN     21   // Chân mở amply MAX97220 (Mức HIGH)
#define PIN_HUB_TALK_BUTTON 0    // Nút bấm "Hỏi Cục Hub" (Nút BOOT GPIO 0 trên ESP32)

// Chân Microphone I2S (INMP441 / SPH0645) để thu âm câu hỏi của du khách
#define PIN_MIC_SCK         14   // Mic Serial Clock
#define PIN_MIC_WS          15   // Mic Word Select (WS)
#define PIN_MIC_SD          32   // Mic Serial Data Out (SD)
#define MIC_SAMPLE_RATE     16000 // Tần số mẫu chuẩn 16kHz
#define MIC_RECORD_SEC      3     // Thời lượng thu âm mỗi câu hỏi (3 giây)

// 3. THÔNG SỐ BLE
#define BLE_SCAN_TIME_SEC 2
#define SCAN_INTERVAL_MS  3000
#define MIN_RSSI_TRIGGER  -80

Audio audio;
BLEScan* pBLEScan;
HTTPClient http;
WiFiClientSecure secureClient;

// Tự động chọn HTTP hoặc HTTPS (hỗ trợ cả LAN, Pinggy và Render.com)
bool beginServerRequest(const String& url) {
  http.setTimeout(15000);
  bool ok = false;
  if (url.startsWith("https://")) {
    secureClient.setInsecure();
    ok = http.begin(secureClient, url);
  } else {
    ok = http.begin(url);
  }
  if (ok) {
    http.addHeader("X-Pinggy-No-Screen", "true");
  }
  return ok;
}

bool isAudioPlaying = false;
unsigned long lastScanTime = 0;
String currentArtifactCode = "001";
String pendingNextChunkUrl = "";
bool hasPendingNextChunk = false;

struct BestBeacon {
  String mac;
  int rssi;
  String name;
  bool found;
};
BestBeacon currentBestBeacon;

// Callback phát hiện thiết bị BLE
class MyAdvertisedDeviceCallbacks: public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) {
      int rssi = advertisedDevice.getRSSI();
      String mac = advertisedDevice.getAddress().toString().c_str();
      mac.toUpperCase();

      if (rssi > currentBestBeacon.rssi) {
        currentBestBeacon.mac = mac;
        currentBestBeacon.rssi = rssi;
        currentBestBeacon.name = advertisedDevice.getName().c_str();
        currentBestBeacon.found = true;
      }
    }
};

// =========================================================================================
// HÀM GỬI MÃ HIỆN VẬT / BEACON LÊN SERVER (NHẬN TÍN HIỆU LẤY ĐƯỢC LUÔN)
// =========================================================================================
void sendBleTriggerToServer(String beaconMac, int rssi, String optionalCode = "") {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠ WiFi mất kết nối!");
    return;
  }

  String url = String(SERVER_BASE) + "/api/ble-scan";
  Serial.printf("\n📡 [HTTP POST] Gửi tín hiệu lên Server: %s\n", url.c_str());

  beginServerRequest(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> docOut;
  docOut["device_id"] = DEVICE_ID;
  if (optionalCode.length() > 0) {
    docOut["code"] = optionalCode;
  } else {
    docOut["beacon_mac"] = beaconMac;
    docOut["rssi"] = rssi;
  }

  String jsonString;
  serializeJson(docOut, jsonString);

  int httpCode = http.POST(jsonString);

  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    DynamicJsonDocument docIn(2048);
    deserializeJson(docIn, payload);

    String status = docIn["status"] | "";
    String action = docIn["action"] | "";

    if (status == "success" && action == "PLAY_AUDIO") {
      const char* code         = docIn["code"] | "001";
      const char* artifactName = docIn["artifact_name"] | "Hiện vật";
      const char* speaker      = docIn["dialogue"]["speaker"] | "Thuyết Minh Viên";
      const char* dialogueText = docIn["dialogue"]["text"] | "";
      const char* wavUrl       = docIn["audio"]["wav_url"] | docIn["audio"]["url"] | "";

      currentArtifactCode = String(code);

      Serial.println("\n===========================================================");
      Serial.printf("🏛️ HIỆN VẬT NHẬN DIỆN : [MÃ %s] %s\n", code, artifactName);
      Serial.printf("👤 DIỄN GIẢ           : %s\n", speaker);
      Serial.printf("💬 LỜI THOẠI          : \n\"%s\"\n", dialogueText);
      Serial.printf("🎵 STREAMING FILE .WAV: %s\n", wavUrl);
      Serial.println("===========================================================\n");

      // Bắt đầu stream và phát file .WAV qua I2S DAC (PCM5102A) + MAX97220
      if (strlen(wavUrl) > 0) {
        Serial.println("🔊 Đang nạp luồng âm thanh .WAV...");
        isAudioPlaying = true;
        audio.connecttohost(wavUrl);
      }
    }
  } else {
    Serial.printf("❌ Lỗi gửi request: HTTP %d\n", httpCode);
  }
  http.end();
}

// =========================================================================================
// HÀM TẠO HEADER CHUẨN FILE .WAV 44 BYTES (16kHz, 16-bit, Mono)
// =========================================================================================
void generateWavHeader(uint8_t* header, int totalDataLen, int sampleRate, int channels, int bitsPerSample) {
  int byteRate = sampleRate * channels * bitsPerSample / 8;
  int totalAudioLen = totalDataLen + 36;
  header[0] = 'R'; header[1] = 'I'; header[2] = 'F'; header[3] = 'F';
  header[4] = (uint8_t)(totalAudioLen & 0xff);
  header[5] = (uint8_t)((totalAudioLen >> 8) & 0xff);
  header[6] = (uint8_t)((totalAudioLen >> 16) & 0xff);
  header[7] = (uint8_t)((totalAudioLen >> 24) & 0xff);
  header[8] = 'W'; header[9] = 'A'; header[10] = 'V'; header[11] = 'E';
  header[12] = 'f'; header[13] = 'm'; header[14] = 't'; header[15] = ' ';
  header[16] = 16; header[17] = 0; header[18] = 0; header[19] = 0;
  header[20] = 1; header[21] = 0; // PCM format
  header[22] = (uint8_t)channels; header[23] = 0;
  header[24] = (uint8_t)(sampleRate & 0xff);
  header[25] = (uint8_t)((sampleRate >> 8) & 0xff);
  header[26] = (uint8_t)((sampleRate >> 16) & 0xff);
  header[27] = (uint8_t)((sampleRate >> 24) & 0xff);
  header[28] = (uint8_t)(byteRate & 0xff);
  header[29] = (uint8_t)((byteRate >> 8) & 0xff);
  header[30] = (uint8_t)((byteRate >> 16) & 0xff);
  header[31] = (uint8_t)((byteRate >> 24) & 0xff);
  header[32] = (uint8_t)(channels * bitsPerSample / 8); header[33] = 0;
  header[34] = (uint8_t)bitsPerSample; header[35] = 0;
  header[36] = 'd'; header[37] = 'a'; header[38] = 't'; header[39] = 'a';
  header[40] = (uint8_t)(totalDataLen & 0xff);
  header[41] = (uint8_t)((totalDataLen >> 8) & 0xff);
  header[42] = (uint8_t)((totalDataLen >> 16) & 0xff);
  header[43] = (uint8_t)((totalDataLen >> 24) & 0xff);
}

// =========================================================================================
// HÀM GỬI FILE ÂM THANH .WAV TỪ CỤC HUB LÊN SERVER (POST /api/hub/ask - Content-Type: audio/wav)
// =========================================================================================
void sendWavRecordingToServer(uint8_t* wavBuffer, size_t wavSize) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠ WiFi mất kết nối!");
    return;
  }

  String url = String(SERVER_BASE) + "/api/hub/ask";
  unsigned long tEndSpeech = millis();

  Serial.println("\n🎙️ [CỤC HUB GỬI FILE .WAV] Đang truyền file âm thanh lên Server AI...");
  Serial.printf("📦 Dung lượng file: %d bytes | Hiện vật mã: %s\n", wavSize, currentArtifactCode.c_str());

  beginServerRequest(url);
  http.addHeader("Content-Type", "audio/wav");
  http.addHeader("X-Artifact-Code", currentArtifactCode);
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("X-End-Speech-Time", String(tEndSpeech));

  int httpCode = http.POST(wavBuffer, wavSize);

  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    DynamicJsonDocument docIn(2048);
    deserializeJson(docIn, payload);

    const char* transcribedQ = docIn["transcribed_question"] | docIn["question"] | "";
    const char* replyText    = docIn["reply_text"] | "";
    const char* wavUrl       = docIn["audio_wav_url"] | "";
    const char* nextUrl      = docIn["next_chunk_url"] | "";
    int latencyMs            = docIn["latency_measurement"]["time_to_first_sound_ms"] | 0;

    Serial.println("\n-----------------------------------------------------------");
    Serial.printf("🗣️ CÂU HỎI NHẬN DẠNG (STT): \"%s\"\n", transcribedQ);
    Serial.printf("🤖 AI TRẢ LỜI VÀO TAI NGHE: \"%s\"\n", replyText);
    Serial.printf("⚡ THỜI GIAN ĐẾN TIẾNG ĐẦU TIÊN: %d ms (< 1s Siêu Tốc!)\n", latencyMs);
    Serial.printf("🎵 ĐOẠN 1 (.WAV): %s\n", wavUrl);
    if (nextUrl && strlen(nextUrl) > 0) {
      pendingNextChunkUrl = String(nextUrl);
      hasPendingNextChunk = true;
    } else {
      pendingNextChunkUrl = "";
      hasPendingNextChunk = false;
    }
    Serial.println("-----------------------------------------------------------\n");

    if (strlen(wavUrl) > 0) {
      isAudioPlaying = true;
      audio.connecttohost(wavUrl);
    }
  } else {
    Serial.printf("❌ Lỗi gửi file .WAV: HTTP %d\n", httpCode);
  }
  http.end();
}

// =========================================================================================
// HÀM GỬI CÂU HỎI DẠNG TEXT (DÙNG CHO KIỂM THỬ)
// =========================================================================================
void sendVoiceQueryToServer(String questionText) {
  if (WiFi.status() != WL_CONNECTED) return;

  // Endpoint chuyên dụng cho Cục Hub: /api/hub/ask (hoặc /api/voice-query)
  String url = String(SERVER_BASE) + "/api/hub/ask";
  unsigned long tEndSpeech = millis(); // Mốc thời gian kết thúc nói

  Serial.println("\n🎙️ [CỤC HUB GỬI YÊU CẦU] Đang gửi câu hỏi lên Server AI...");
  Serial.printf("👉 Câu hỏi: \"%s\" (Vị trí hiện vật mã: %s)\n", questionText.c_str(), currentArtifactCode.c_str());

  beginServerRequest(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<512> docOut;
  docOut["device_id"] = DEVICE_ID;
  docOut["code"] = currentArtifactCode;
  docOut["voice_text"] = questionText;
  docOut["end_speech_time"] = tEndSpeech;

  String jsonString;
  serializeJson(docOut, jsonString);

  int httpCode = http.POST(jsonString);

  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    DynamicJsonDocument docIn(2048);
    deserializeJson(docIn, payload);

    const char* replyText = docIn["reply_text"] | "";
    const char* wavUrl    = docIn["audio_wav_url"] | "";
    const char* nextUrl   = docIn["next_chunk_url"] | "";
    int latencyMs         = docIn["latency_measurement"]["time_to_first_sound_ms"] | 0;

    Serial.println("\n-----------------------------------------------------------");
    Serial.printf("🤖 AI TRẢ LỜI VÀO TAI NGHE: \"%s\"\n", replyText);
    Serial.printf("⚡ THỜI GIAN ĐẾN TIẾNG ĐẦU TIÊN: %d ms (< 1s Siêu Tốc!)\n", latencyMs);
    Serial.printf("🎵 ĐOẠN 1 (.WAV): %s\n", wavUrl);
    if (nextUrl && strlen(nextUrl) > 0) {
      Serial.printf("⏳ ĐOẠN 2 (TIẾP NỐI): %s\n", nextUrl);
      pendingNextChunkUrl = String(nextUrl);
      hasPendingNextChunk = true;
    } else {
      pendingNextChunkUrl = "";
      hasPendingNextChunk = false;
    }
    Serial.println("-----------------------------------------------------------\n");

    if (strlen(wavUrl) > 0) {
      isAudioPlaying = true;
      audio.connecttohost(wavUrl);
    }
  } else {
    Serial.printf("❌ Lỗi Voice Query: HTTP %d\n", httpCode);
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\n===========================================================");
  Serial.println("  ESP32 BLE TOUR GUIDE & AI VOICE CLIENT (V2.0) STARTING   ");
  Serial.println("===========================================================");

  // [1] Khởi tạo chân bật Amply MAX97220 (Mở mức HIGH)
  pinMode(PIN_MAX97220_EN, OUTPUT);
  digitalWrite(PIN_MAX97220_EN, HIGH);
  Serial.println("✓ Amply MAX97220 đã bật (GPIO 21 = HIGH)");

  // [2] Khởi tạo I2S DAC (PCM5102A) xuất âm thanh .WAV
  audio.setPinout(PIN_I2S_BCK, PIN_I2S_LCK, PIN_I2S_DIN);
  audio.setVolume(18); // Âm lượng từ 0 - 21
  Serial.println("✓ I2S DAC PCM5102A sẵn sàng (BCK:26, LCK:25, DIN:22)");

  // [3] Kết nối Wi-Fi
  Serial.printf("📶 Đang kết nối Wi-Fi: %s ...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startWifi = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startWifi < 12000) {
    delay(400);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n✓ Wi-Fi kết nối thành công! IP ESP32: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n⚠ Không kết nối được Wi-Fi!");
  }

  // [4] Khởi tạo nút bấm "Hỏi Cục Hub" (GPIO 0 / Nút BOOT)
  pinMode(PIN_HUB_TALK_BUTTON, INPUT_PULLUP);
  Serial.println("✓ Nút bấm Cục Hub sẵn sàng (GPIO 0 / Nút BOOT)");

  // [5] Khởi tạo BLE Scanner
  BLEDevice::init(DEVICE_ID);
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);

  Serial.println("✓ Hệ thống sẵn sàng! Bắt đầu quét BLE...");
  Serial.println("===========================================================\n");
}

void loop() {
  // Luôn phục vụ luồng âm thanh I2S giải mã không bị giật tiếng
  audio.loop();

  if (isAudioPlaying) {
    if (!audio.isRunning()) {
      if (hasPendingNextChunk && pendingNextChunkUrl.length() > 0) {
        Serial.printf("\n🔊 [Progressive Delivery] Đang phát tiếp đoạn sau: %s\n", pendingNextChunkUrl.c_str());
        String nextUrl = pendingNextChunkUrl;
        hasPendingNextChunk = false;
        pendingNextChunkUrl = "";
        audio.connecttohost(nextUrl.c_str());
      } else {
        Serial.println("✓ [Audio] Đã phát xong toàn bộ các đoạn âm thanh!");
        isAudioPlaying = false;
        lastScanTime = millis();
      }
    }
    return;
  }

  // [A] Kiểm tra nút bấm Cục Hub: Khách bấm nút để hỏi AI
  if (digitalRead(PIN_HUB_TALK_BUTTON) == LOW) {
    delay(50); // Chống rung phím (debounce)
    if (digitalRead(PIN_HUB_TALK_BUTTON) == LOW) {
      Serial.println("\n🎙️ [CỤC HUB] Khách nhấn nút hỏi AI về hiện vật hiện tại!");
      // Gửi yêu cầu lên Server: /api/hub/ask
      sendVoiceQueryToServer("Hãy giới thiệu cho tôi về hiện vật này và ý nghĩa lịch sử.");
      // Chờ nhả nút để tránh gửi trùng lặp
      while (digitalRead(PIN_HUB_TALK_BUTTON) == LOW) {
        audio.loop();
        delay(10);
      }
      return;
    }
  }

  // [B] Quét BLE định kỳ khi không phát âm thanh
  unsigned long now = millis();
  if (now - lastScanTime >= SCAN_INTERVAL_MS) {
    lastScanTime = now;

    currentBestBeacon.found = false;
    currentBestBeacon.rssi = -999;
    currentBestBeacon.mac = "";

    pBLEScan->start(BLE_SCAN_TIME_SEC, false);

    if (currentBestBeacon.found && currentBestBeacon.rssi >= MIN_RSSI_TRIGGER) {
      Serial.printf("🎯 Thấy Beacon gần nhất: [%s] | RSSI: %d dBm\n",
                    currentBestBeacon.mac.c_str(), currentBestBeacon.rssi);
      sendBleTriggerToServer(currentBestBeacon.mac, currentBestBeacon.rssi);
    }

    pBLEScan->clearResults();
  }
}

// Hook thông tin âm thanh
void audio_info(const char *info){ Serial.print("audio_info: "); Serial.println(info); }
void audio_eof_mp3(const char *info){ isAudioPlaying = false; }
