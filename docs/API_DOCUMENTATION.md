# 📡 API DOCUMENTATION — SMART MUSEUM GUIDE V3.0

Tài liệu đặc tả toàn bộ HTTP/SSE endpoints của Gateway `server.js` v3.0.

**Base URL (Local)**: `http://localhost:5000`  
**Base URL (Production)**: `https://<your-render-service>.onrender.com`

---

## 1. Quy ước Xác thực & Mã lỗi Chung

| Vai trò | Header bắt buộc | Mã lỗi khi vi phạm |
| :--- | :--- | :--- |
| **Guest** | Không cần (tuân thủ `ALLOWED_ORIGINS` ở Production) | `403 Forbidden` (CORS sai), `429 Too Many Requests` |
| **Device** | `X-Device-Token: <token>` + `device_id` | `401 Unauthorized` (thiếu/sai/đã thu hồi token) |
| **Admin** | `X-Admin-Key: <ADMIN_API_KEY>` | `503 Service Unavailable` (server chưa set key), `401 Unauthorized` (sai key) |

**Giới hạn đầu vào:**
- JSON Payload tối đa: `65,536 bytes` (`64 KB`) → vượt trả `413`.
- Audio Upload tối đa: `5,242,880 bytes` (`5 MB`) → vượt trả `413`; sai magic bytes âm thanh trả `415`.

---

## 2. Public & Visitor Endpoints

### `GET /health` (alias: `GET /api/health`)
Trả về trạng thái sức khỏe hệ thống, thống kê Knowledge Base, `LocalSemanticIndex`, `Auto-Learning 2.0` và số lượng thiết bị IoT đang hoạt động.
- **Auth**: Guest
- **Response `200`**:
```json
{
  "status": "ok",
  "version": "3.0.0",
  "uptime_sec": 42,
  "kb_stats": {
    "facts100": 500,
    "groundTruth500": 500,
    "dataset1000": 1000,
    "localSemanticVectorDocs": 2015
  },
  "auto_learning": {
    "total_approved": 0,
    "total_pending": 0,
    "versions": 0
  }
}
```

### `GET /api/beacons`
Lấy danh sách toàn bộ BLE Beacons và kịch bản thuyết minh hiện vật.
- **Auth**: Guest
- **Response `200`**: `{ "success": true, "beacons": [...] }`

### `GET /api/events`
Kết nối Server-Sent Events (SSE) thời gian thực nhận sự kiện `BLE_TRIGGER`, `VOICE_PROCESSING`, `VOICE_RESPONSE`, `BEACONS_UPDATED` (ping keep-alive mỗi 15s).
- **Auth**: Guest

### `POST /api/hub/ask` (aliases: `/api/voice-query`, `/api/hub-query`, `/api/esp32/ask`)
Gửi câu hỏi bằng **JSON text** hoặc **Raw Binary Audio (`.wav`/`.mp3`/`.ogg`/`.flac`/`.m4a`/`.webm`)** để AI trả lời và trả về **Single Progressive Streaming `.WAV`**.
- **Auth**: Guest / Device (`X-Device-Token` nếu bật `REQUIRE_DEVICE_AUTH`)
- **Rate Limit Tier**: `voice`
- **Request (JSON)**:
```json
{
  "device_id": "ESP32_HUB_01",
  "code": "002",
  "language": "vi",
  "voice_seq": 12,
  "voice_text": "Giá vé vào cổng Nhà tù Hỏa Lò bao nhiêu tiền?"
}
```
- **Request (Raw Audio)**: `Content-Type: audio/wav` + query `?device_id=ESP32_HUB_01&code=002&lang=vi&seq=12`
- **Response `200`**:
```json
{
  "success": true,
  "question": "Giá vé vào cổng Nhà tù Hỏa Lò bao nhiêu tiền?",
  "reply_text": "...",
  "intent": "TICKET_INFORMATION",
  "language": "vi",
  "audio_mode": "SINGLE_STREAMING_WAV",
  "audio_wav_url": "http://.../audio-stream/reply_123456.wav",
  "latency_ms": { "stt": 0, "ai": 15, "tts_first_audio": 240, "total": 255 }
}
```

### `GET /audio-stream/:streamId.wav` & `HEAD /audio-stream/:streamId.wav`
Phát luồng âm thanh WAV 16kHz Mono 16-bit liền mạch:
- Đang tổng hợp: HTTP chunked stream (44-byte RIFF/WAVE header + PCM các đoạn nối tiếp 0ms ngắt quãng).
- Đã gộp xong: Phục vụ file tĩnh hỗ trợ `Accept-Ranges: bytes` (tua tiến/lùi trên trình duyệt).

### `POST /api/feedback`
Gửi phản hồi đánh giá câu trả lời của du khách vào hệ thống Auto-Learning 2.0.
- **Auth**: Guest
- **Body**: `{ "question": "...", "reply": "...", "rating": 5, "comment": "...", "device_id": "GUEST", "language": "vi" }`

---

## 3. IoT & ESP32 Device Endpoints

### `POST /api/ble-scan` (alias: `POST /api/beacon-trigger`)
Thiết bị ESP32 gửi tín hiệu BLE quét được lên server để xử lý lọc EMA, hysteresis, stability, cooldown và nhận URL âm thanh thuyết minh.
- **Auth**: Device (`X-Device-Token` khi thiết bị đã cấp khóa hoặc `REQUIRE_DEVICE_AUTH=true`)
- **Rate Limit Tier**: `ble`
- **Body**:
```json
{
  "device_id": "ESP32_HUB_01",
  "beacon_mac": "AA:BB:CC:DD:EE:01",
  "rssi": -60,
  "language": "vi"
}
```
- **Response `200`**:
  - `action`: `PLAY_AUDIO` | `SKIP_COOLDOWN` | `SKIP_WEAK_SIGNAL` | `SKIP_HYSTERESIS` | `SKIP_UNSTABLE`
  - `positioning_level`: `PROXIMITY_IMMEDIATE` | `ZONE_NEAR` | `ROOM_FAR`
  - `smoothed_rssi`, `audio_wav_url`, `code`, `artifact_name`

### `POST /api/devices/heartbeat`
ESP32 gửi telemetry định kỳ (mỗi 20s) báo cáo sức khỏe thiết bị.
- **Auth**: Device
- **Body**: `{ "device_id": "ESP32_HUB_01", "firmware_version": "3.0.0-prod", "wifi_rssi": -55, "free_heap": 142000, "uptime_sec": 3600, "last_error_code": "OK" }`

### `GET /api/devices/health`
Xem trạng thái toàn bộ các ESP32 Hub đang kết nối (`ONLINE`, `DEGRADED`, `OFFLINE`).
- **Auth**: Guest / Monitoring

---

## 4. Admin Management Endpoints (Fail-Closed RBAC)

Tất cả endpoint dưới đây **bắt buộc header `X-Admin-Key`** và áp dụng Rate Limit tier `admin`:

| Method | Endpoint | Chức năng |
| :--- | :--- | :--- |
| `POST` | `/api/beacons/create` | Tạo Beacon mới (validate schema + chặn trùng MAC/code trả `409` + atomic save) |
| `POST` | `/api/beacons/update` | Cập nhật nội dung/ngưỡng/MAC Beacon + phát SSE `BEACONS_UPDATED` |
| `DELETE` / `POST` | `/api/beacons/delete` | Xóa Beacon theo `?id=...` / `?code=...` hoặc JSON body |
| `POST` | `/api/beacons/rollback` | Phục hồi `data/beacons.json` từ bản backup gần nhất trong `data/backups/` |
| `POST` | `/api/ble/calibrate` | Hiệu chỉnh `threshold` và `rssi_offset` cho từng Beacon theo không gian phòng |
| `GET` | `/api/learned-knowledge` | Xem thống kê kho Auto-Learning 2.0 (pending, approved, versions) |
| `POST` | `/api/auto-learning/approve` | Phê duyệt đề xuất tri thức `{ "proposal_id": "...", "reviewer": "admin" }` → xuất bản sang KB + tạo snapshot |
| `POST` | `/api/auto-learning/reject` | Từ chối đề xuất `{ "proposal_id": "...", "reason": "..." }` |
| `POST` | `/api/auto-learning/rollback` | Rollback kho tri thức đã duyệt về phiên bản `{ "version": N }` (hoặc phiên bản trước đó) |
| `POST` | `/api/devices/issue-key` | Cấp mới hoặc xoay vòng `X-Device-Token` cho `{ "device_id": "ESP32_01" }` |
| `POST` | `/api/devices/revoke-key` | Thu hồi ngay quyền truy cập của thiết bị `{ "device_id": "ESP32_01", "reason": "..." }` |
