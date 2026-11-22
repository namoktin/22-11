# 🛡️ CYBERSECURITY ARCHITECTURE & HARDENING REPORT — V3.0

Tài liệu đặc tả các lớp bảo mật đã được triển khai và kiểm chứng tự động bằng bộ `npm run test:security` (`tests/security.test.js`).

---

## 1. Threat Model & Ma trận Phòng thủ

| Mối đe dọa | Mức độ trước nâng cấp | Biện pháp phòng thủ v3.0 | Trạng thái kiểm thử |
| :--- | :---: | :--- | :---: |
| Chiếm quyền Admin CRUD Beacon / Auto-Learning khi thiếu env key | **P0** | **Fail-Closed Admin Auth** (`verifyAdminRequest`): trả `503 Service Unavailable` nếu chưa cấu hình `ADMIN_API_KEY`, trả `401` nếu sai key, so sánh bằng `crypto.timingSafeEqual` | ✅ Đã chứng minh (`Security 2`) |
| CORS Wildcard `*` cho phép trang độc hại gọi API từ trình duyệt | **P0** | Tắt hoàn toàn `*` trong `NODE_ENV=production`; chỉ cho phép `ALLOWED_ORIGINS` cấu hình tường minh; từ chối `403 Forbidden` cho origin lạ trên `/api/*` | ✅ Đã chứng minh (`Security 1`) |
| Giả mạo thiết bị ESP32 gửi dữ liệu BLE/Heartbeat trái phép | **P0** | `DeviceAuthManager`: cấp/xoay vòng/thu hồi `X-Device-Token`, lưu hash SHA-256 (không lưu plaintext token trên đĩa), so sánh constant-time | ✅ Đã chứng minh (`Security 3`) |
| Upload file giả mạo (HTML/JS/EXE đổi đuôi `.wav`) hoặc payload quá lớn DoS | **P0** | Giới hạn `MAX_JSON_BYTES = 64KB` (`413`), `MAX_AUDIO_BYTES = 5MB` (`413`), kiểm tra **binary magic bytes** (`RIFF/WAVE`, `ID3`, `OggS`, `fLaC`, `MP4/M4A`, `WebM`) trả `415 Unsupported Media Type` | ✅ Đã chứng minh (`Security 4`) |
| Flood / Brute-force API (Voice, BLE, Admin) | **P1** | Sliding-window `RateLimiter` theo IP với 4 ngưỡng tách biệt (`general`, `voice`, `ble`, `admin`), trả `429 Too Many Requests` kèm `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` | ✅ Đã chứng minh (`Security 5`) |
| Rò rỉ stack trace, đường dẫn nội bộ hoặc API key ra client / log | **P1** | `safeErrorResponse()` ẩn hoàn toàn stack trace & đường dẫn file nội bộ; `sanitizeForLog()` tự động che `gsk_*`, `Bearer *`, `X-Admin-Key`, password | ✅ Đã chứng minh (`Security 6`, `Unit 2`) |
| Prompt Injection / Jailbreak / XSS / SQLi vào AI & Auto-Learning | **P1** | Bộ lọc 5 lớp trong `nlp_processor.js` chặn 100% (50/50) bài test injection + Auto-Learning 2.0 chặn đầu độc tri thức trước khi vào Staging | ✅ Đã chứng minh (`Benchmark 800`, `Unit 5`) |
| MITM trên kết nối HTTPS của ESP32 (`client.setInsecure()`) | **P0** | Firmware v3.0 bật `#define PRODUCTION_MODE 1` mặc định, xác minh TLS bằng chứng chỉ gốc **ISRG Root X1 PEM** nhúng sẵn; nghiêm cấm `setInsecure()` trong Production | ⚠️ Đã kiểm tra mã nguồn (chưa chạy trên mạch ESP32 thật) |

---

## 2. Phân quyền RBAC (Role-Based Access Control)

Hệ thống tách bạch 3 vai trò rõ ràng:

1. **Guest (`Khách tham quan / Web Showcase`)**
   - Được phép: `GET /health`, `GET /api/beacons`, `GET /api/state`, `GET /api/events`, `POST /api/hub/ask`, `POST /api/feedback`, `GET /audio-stream/:id.wav`, `GET /audio/:file`.
   - Bị chặn: Mọi API quản trị (`401`/`503`), mọi cross-origin không nằm trong `ALLOWED_ORIGINS` (`403`).

2. **Device (`Thiết bị ESP32 Hub`)**
   - Xác thực qua header `X-Device-Token` (hoặc `Authorization: Bearer <token>`) kết hợp `device_id`.
   - Khi thiết bị chưa được cấp key ở chế độ dev mở, hệ thống cho phép đăng ký kiểm thử; ngay khi key được cấp cho `device_id` (hoặc bật `REQUIRE_DEVICE_AUTH=true` trong Production), mọi request thiếu/sai token hoặc đã bị thu hồi (`revoked`) đều bị từ chối `401 Unauthorized`.
   - Hỗ trợ xoay vòng khóa (`POST /api/devices/issue-key`) và thu hồi ngay lập tức khi mất thiết bị (`POST /api/devices/revoke-key`).

3. **Admin (`Quản trị viên Bảo tàng`)**
   - Xác thực qua header `X-Admin-Key` (hoặc `Authorization: Bearer <ADMIN_API_KEY>`).
   - **Fail-Closed mặc định**: Nếu biến môi trường `ADMIN_API_KEY` chưa được thiết lập (hoặc < 12 ký tự yếu), mọi endpoint quản trị trả ngay `503`.
   - Bảo vệ toàn bộ: `/api/beacons/create`, `/api/beacons/update`, `/api/beacons/delete`, `/api/beacons/rollback`, `/api/ble/calibrate`, `/api/auto-learning/approve`, `/api/auto-learning/reject`, `/api/auto-learning/rollback`, `/api/devices/issue-key`, `/api/devices/revoke-key`.

---

## 3. HTTP Security Headers (OWASP Baseline)

Mọi phản hồi từ Gateway đều gắn tự động các header sau (`applySecurityHeaders`):
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), camera=(), microphone=(self)`
- `Content-Security-Policy`: chặn `object-src 'none'`, `frame-ancestors 'none'`, giới hạn nguồn script/media
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (bật khi `NODE_ENV=production` hoặc qua TLS proxy)

---

## 4. Quản lý Secrets & Dependency Audit

- **Zero hardcoded secrets**: Toàn bộ `GROQ_API_KEY`, `ADMIN_API_KEY`, `ALLOWED_ORIGINS`, `REQUIRE_DEVICE_AUTH` quản lý qua biến môi trường. File `.env` và `data/device_keys.json` nằm trong `.gitignore`.
- **NPM Dependency Audit**: Kết quả chạy thực tế `npm audit --audit-level=high` = **0 vulnerabilities** (`found 0 vulnerabilities`).

---

## 5. Bảo mật Firmware ESP32 (`esp32_firmware/esp32_ble_dialogue.ino`)

- `PRODUCTION_MODE 1` loại bỏ hoàn toàn `WiFiClientSecure::setInsecure()`, sử dụng `secureClient.setCACert(ISRG_ROOT_X1_CA)` để xác minh chuỗi chứng chỉ TLS của Render/Let's Encrypt.
- Không hardcode credential production trong mã nguồn git; dùng placeholder `#define WIFI_SSID` / `#define DEVICE_AUTH_TOKEN` và khuyến nghị nạp qua `secrets.h` (gitignored) hoặc ESP32 NVS Flash có mã hóa.
- Cơ chế timeout HTTP (`10s` chuẩn, `15s` upload audio), exponential backoff reconnect Wi-Fi, và ESP32 Task Watchdog `15s` ngăn thiết bị treo vô hạn.
