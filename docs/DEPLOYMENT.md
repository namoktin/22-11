# 🚀 PRODUCTION DEPLOYMENT & OPERATIONS GUIDE — V3.0

Hướng dẫn triển khai thực tế hệ thống **Smart Museum Guide v3.0** lên **Render.com** (Cloud) hoặc máy chủ LAN tại bảo tàng.

---

## 1. Biến Môi trường Bắt buộc (Environment Variables)

| Biến | Bắt buộc (Prod) | Mô tả | Ví dụ |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | ✅ | Bật chế độ bảo mật nghiêm ngặt (tắt CORS `*`, bật HSTS, ẩn stack trace) | `production` |
| `PORT` | ✅ | Cổng HTTP lắng nghe (Render tự cấp) | `10000` (Render) / `5000` (LAN) |
| `KIEMTHU_IN_PROCESS` | ✅ | Chạy bộ não AI KiemThu nhúng trực tiếp trong RAM (~5–30ms) | `true` |
| `ADMIN_API_KEY` | ✅ | Khóa quản trị ≥ 24 ký tự ngẫu nhiên (Fail-Closed: thiếu key → `503`) | *(Tạo bằng `openssl rand -hex 32`)* |
| `ALLOWED_ORIGINS` | ✅ | Danh sách domain được phép gọi API (phân tách bởi dấu phẩy) | `https://smart-museum.onrender.com` |
| `REQUIRE_DEVICE_AUTH` | Khuyến nghị | `true` để bắt buộc mọi ESP32 phải có `X-Device-Token` hợp lệ | `true` |
| `GROQ_API_KEY` | Tùy chọn | Bật Whisper STT + Groq 3-model RAG failover (thiếu vẫn chạy offline 98.25% accuracy trên KB cục bộ) | `gsk_...` |
| `RATE_LIMIT_GENERAL` | Tùy chọn | Ngưỡng request/phút cho API thường (mặc định `120`) | `120` |
| `RATE_LIMIT_VOICE` | Tùy chọn | Ngưỡng request/phút cho Voice AI (mặc định `30`) | `30` |
| `RATE_LIMIT_BLE` | Tùy chọn | Ngưỡng request/phút cho BLE Scan (mặc định `120`) | `120` |
| `RATE_LIMIT_ADMIN` | Tùy chọn | Ngưỡng request/phút cho Admin API (mặc định `20`) | `20` |

---

## 2. Triển khai lên Render.com

Repository đã cấu hình sẵn `render.yaml`:
1. Push mã nguồn lên GitHub (`namoktin/22-11`), đảm bảo **không** commit `.env`, `data/device_keys.json` hay file log tạm.
2. Trên Render Dashboard → chọn Web Service kết nối repo `22-11`:
   - **Build Command**: `npm ci`
   - **Start Command**: `node server.js`
   - **Health Check Path**: `/health`
3. Thiết lập các biến môi trường bí mật (`ADMIN_API_KEY`, `GROQ_API_KEY`, `ALLOWED_ORIGINS`, `REQUIRE_DEVICE_AUTH=true`) trực tiếp trên Render Environment tab (không ghi vào git).
4. Kiểm tra sau deploy:
   - `GET https://<service>/health` trả `200 OK` với `localSemanticVectorDocs >= 2000`.
   - Kiểm tra Fail-Closed: gọi `POST /api/beacons/update` không có header `X-Admin-Key` phải trả `401`.
   - Cấp token cho từng ESP32 Hub bằng `POST /api/devices/issue-key` và nạp token vào firmware thiết bị.

---

## 3. Lưu ý Quan trọng về Tài nguyên & SLA Sản xuất

### 3.1 Ephemeral Disk trên Render Free/Starter
- File JSON động (`data/beacons.json`, `data/device_keys.json`, `data/ble_calibration.json`, `kiemthu/data/auto_learned_knowledge.json`) sẽ bị reset sau mỗi lần redeploy nếu không gắn **Render Persistent Disk** (mount vào `/opt/render/project/src/data`) hoặc chuyển sang PostgreSQL/SQLite trên persistent volume.
- `SafeJsonStore` tự động tạo bản sao lưu xoay vòng trong `data/backups/` trước mỗi lần ghi và hỗ trợ rollback tức thì qua `POST /api/beacons/rollback` và `POST /api/auto-learning/rollback`.

### 3.2 Giới hạn RAM khi chạy Concurrent Voice TTS
- Kết quả load test thực tế (`docs/BENCHMARK.md`) cho thấy 100 kết nối đồng thời trên `/api/hub/ask` đẩy bộ nhớ tiến trình lên **385 MB RSS** (do nhiều tiến trình con FFmpeg giải mã đồng thời).
- **Khuyến nghị triển khai thực tế**:
  - Gói Render Free (512 MB RAM) phù hợp ổn định cho **1–25 thiết bị đồng thời**.
  - Với bảo tàng có **50–100+ thiết bị đồng thời**, cần nâng cấp lên gói ≥ 1–2 GB RAM (hoặc đặt `RATE_LIMIT_VOICE` phù hợp + bật hàng đợi giới hạn số FFmpeg worker song song).

### 3.3 Phân tích Dịch vụ TTS (Google Translate TTS vs Commercial SLA)
- Hiện tại hệ thống dùng endpoint Google TTS miễn phí (kèm Keep-Alive TLS, bounded retry, RAM PCM cache và file cache đa ngôn ngữ cho BLE beacons).
- **Rủi ro thương mại**: Endpoint miễn phí không có cam kết SLA và có thể bị rate-limit nếu lưu lượng lớn đột biến.
- **Lộ trình Production thương mại**: Giữ nguyên kiến trúc RAM PCM cache + Single Streaming `.WAV` hiện có, chỉ cần thay hàm fetch MP3 bằng **Google Cloud Text-to-Speech**, **Azure Neural TTS**, hoặc **ElevenLabs/Piper TTS cục bộ (offline LAN)** để đạt SLA 99.9% không phụ thuộc mạng ngoài.
