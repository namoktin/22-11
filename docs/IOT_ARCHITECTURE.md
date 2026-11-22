# 📡 IOT, BLE & ESP32 ARCHITECTURE — SMART MUSEUM GUIDE V3.0

Tài liệu đặc tả kiến trúc phần cứng IoT, thuật toán xử lý tín hiệu BLE RSSI, phân cấp định vị trong nhà trung thực (Indoor Positioning), quản lý đa thiết bị (Multi-Device Hub) và Firmware ESP32 v3.0.

---

## 1. Xử lý Tín hiệu BLE RSSI (`src/iot/ble_manager.js`)

Tín hiệu Bluetooth Low Energy trong không gian bảo tàng tường đá/bê tông dày như Nhà tù Hỏa Lò chịu nhiễu phản xạ đa đường (multipath fading) và suy hao cơ thể người (human body attenuation ±8–15 dBm). Do đó, v3.0 thay thế ngưỡng RSSI đơn giản bằng chuỗi lọc 5 bước:

1. **Hiệu chỉnh môi trường (Calibration Offset & Threshold)**:
   - Mỗi Beacon có `rssi_offset` và `threshold` riêng lưu bền vững trong `data/ble_calibration.json`, chỉnh nóng qua `POST /api/ble/calibrate` (Admin RBAC).
2. **Exponential Moving Average (EMA) Smoothing**:
   $$\text{EMA}_t = \alpha \cdot \text{RSSI}_t + (1 - \alpha) \cdot \text{EMA}_{t-1} \quad (\alpha = 0.35)$$
   Loại bỏ nhiễu gai đột ngột (1 gói tin nhảy từ `-88 dBm` lên `-62 dBm` được làm mượt về `-78.9 dBm`, không gây kích hoạt giả).
3. **Hysteresis Margin (`+6 dBm`)**:
   - Khi thiết bị đang bám ở Beacon A, Beacon B chỉ được phép chiếm quyền chuyển vùng nếu `EMA(B) >= EMA(A) + 6 dBm`, ngăn chặn hiện tượng "ping-pong" chuyển thuyết minh liên tục khi khách đứng ở ranh giới hai gian trưng bày.
4. **Stability Counter (`>= 2` mẫu liên tiếp)**:
   - Yêu cầu ít nhất 2 gói tin liên tiếp đạt ngưỡng trước khi chuyển sang Beacon mới.
5. **Smart Cooldown & Duplicate Conflict Detection**:
   - Cooldown độc lập theo cặp `(device_id, beacon_id)` (mặc định 45 giây).
   - `detectBeaconConflicts()` chặn tạo/sửa Beacon trùng địa chỉ MAC hoặc trùng mã `code` (`HTTP 409 Conflict`).

---

## 2. Phân cấp Định vị Trong nhà (Indoor Positioning — Trung thực Kỹ thuật)

> [!IMPORTANT]
> **Nguyên tắc trung thực**: Hệ thống **KHÔNG** tuyên bố định vị tọa độ `(x, y)` chính xác mức mét chỉ bằng RSSI của 1 BLE Beacon. Trong thực tế vật lý, 1 giá trị RSSI chỉ phản ánh mức suy hao tín hiệu gần đúng.

| Cấp độ | Tên cấp độ | Độ chính xác thực tế | Phần cứng yêu cầu | Hỗ trợ trong v3.0 |
| :--- | :--- | :--- | :--- | :---: |
| **Level 1** | **Beacon Proximity (`PROXIMITY_IMMEDIATE`)** | ~0.5 – 2 m (`EMA >= -62 dBm`) | 1 BLE Beacon / hiện vật | ✅ Đang hoạt động |
| **Level 2** | **Zone Detection (`ZONE_NEAR`)** | ~2 – 5 m (`-76 <= EMA < -62 dBm`) | 1 BLE Beacon / khu trưng bày | ✅ Đang hoạt động |
| **Level 3** | **Room-Level Positioning (`ROOM_FAR`)** | Cấp phòng (`EMA < -76 dBm`) | 1–2 BLE Beacons / phòng | ✅ Đang hoạt động |
| **Level 4** | **Coordinate-Level `(x, y)` Positioning** | ±0.3 – 1.5 m | ≥ 3–4 Beacons/phòng (Trilateration/Fingerprinting) hoặc **UWB (DW3000)** / **BLE 5.1 AoA** | ❌ Chưa triển khai (phân tích bên dưới) |

### Phân tích Chi phí – Lợi ích nếu Nâng cấp lên Định vị Tọa độ `(x, y)`
- **BLE RSSI Fingerprinting / Trilateration (3–4 beacon/phòng)**: Chi phí thấp (~10–15 USD/beacon), sai số vẫn 1.5–3 m trong tường đá Hỏa Lò, tốn công khảo sát bản đồ radio (site survey) mỗi khi thay đổi vách trưng bày.
- **Ultra-Wideband (UWB DW3000 / ESP32 + DWM3000)**: Độ chính xác 10–30 cm, nhưng chi phí phần cứng tăng gấp 5–8× (~25–40 USD/anchor + tag) và tiêu thụ điện năng cao hơn đáng kể.
- **Kết luận kiến trúc cho Smart Museum Guide**: Đối với thuyết minh hiện vật tự động, **Level 1–2 (Proximity + Zone Detection kết hợp EMA + Hysteresis + Calibration)** là điểm tối ưu nhất về chi phí/hiệu năng, không cần đầu tư UWB.

---

## 3. Quản lý Đa thiết bị (Multi-Device Hub)

- Mỗi ESP32 Hub có `device_id` duy nhất và `X-Device-Token` xác thực độc lập (`DeviceAuthManager`).
- Trạng thái BLE (`activeBeacon`, `emaMap`, `cooldownMap`), khóa ngôn ngữ (`deviceLanguageMap`), phiên hội thoại AI (`sess_<deviceId>`) và `voice_seq` (barge-in superseding) được **cô lập hoàn toàn theo `device_id`** — nhiều Hub quét đồng thời không ghi đè nhau (đã chứng minh trong `Integration 2` và `Unit 3`).
- **Heartbeat & Health Telemetry**:
  - ESP32 gửi `POST /api/devices/heartbeat` mỗi 20 giây kèm `firmware_version`, `wifi_rssi`, `free_heap`, `uptime_sec`, `last_error_code`.
  - Server tự động phân loại thiết bị qua `GET /api/devices/health`:
    - `ONLINE`: heartbeat `< 45s`, `free_heap >= 40KB`
    - `DEGRADED`: `45s <= age < 90s` hoặc `free_heap < 40KB` hoặc có mã lỗi phần cứng
    - `OFFLINE`: mất tín hiệu `>= 90s`

---

## 4. Firmware ESP32 v3.0 (`esp32_firmware/esp32_ble_dialogue.ino`)

Các nâng cấp an toàn và ổn định đã triển khai trong mã nguồn firmware:
1. **TLS Verification (`PRODUCTION_MODE 1`)**: Loại bỏ hoàn toàn `client.setInsecure()` ở production; nhúng chứng chỉ gốc **ISRG Root X1 PEM** (`secureClient.setCACert(ISRG_ROOT_X1_CA)`).
2. **Task Watchdog Timer (15 giây)**: `esp_task_wdt_init(15, true)` + `esp_task_wdt_reset()` định kỳ trong vòng lặp chính, thu âm và streaming HTTP để tự phục hồi nếu treo mạng/I2S.
3. **Wi-Fi Exponential Backoff Reconnect**: Tự động kết nối lại Wi-Fi với độ trễ tăng dần (`2s → 4s → 8s → ... → 30s`) khi mất sóng.
4. **Real I2S INMP441 Microphone Capture + Safe Memory Management**:
   - Đọc mẫu PCM 16kHz 16-bit mono từ mic INMP441 (có kiểm tra lỗi khởi tạo `i2s_driver_install`), ghi 44-byte RIFF/WAVE header, cấp phát bộ đệm an toàn (ưu tiên PSRAM, fallback heap giới hạn), **luôn `free()` trong mọi nhánh lỗi** chống memory leak.
   - Hỗ trợ **Barge-In**: nhấn nút hỏi mới sẽ dừng phát audio cũ ngay lập tức và tăng `voice_seq`.
5. **Structured Error Codes**: `OK`, `ERR_WIFI_DOWN`, `ERR_HTTP_TIMEOUT`, `ERR_AUTH_401`, `ERR_I2S_MIC`, `ERR_I2S_SPK`, `ERR_OOM` gửi kèm trong Heartbeat.

> [!WARNING]
> **Giới hạn kiểm chứng phần cứng (Trung thực)**: Do môi trường kiểm thử tự động hiện tại là máy Windows không gắn board ESP32/INMP441/PCM5102A/BLE Beacon vật lý, các phần mềm máy chủ và logic BLE/Multi-Device đã được kiểm thử đầy đủ bằng unit/integration/load test, trong khi **biên dịch Arduino IDE/PlatformIO và kiểm thử chạy liên tục trên board ESP32 thật cần được xác minh trực tiếp trên phần cứng trước khi triển khai đại trà**.
