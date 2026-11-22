# TECHNICAL AUDIT — 22-11 SMART MUSEUM GUIDE (BASELINE BEFORE MASTER UPGRADE)

> **Ngày kiểm toán:** 2026-11-22  
> **Phạm vi:** Toàn bộ mã nguồn repository `esp32-ble-server` (repo `22-11`), nhúng lõi `kiemthu`, firmware `esp32_firmware/esp32_ble_dialogue.ino`, cấu hình triển khai `render.yaml` và giao diện `public/`.  
> **Phương pháp:** Đọc trực tiếp toàn bộ source code, kiểm tra phụ thuộc, luồng dữ liệu, bảo mật, lưu trữ và phần cứng — không mặc định README là đúng.

---

## 1. Kiến trúc hiện tại (Baseline v2.4.0)

```
[ESP32 Firmware / Web Dashboard]
   ├── POST /api/ble-scan  ──▶ server.js (single-file 1,896 dòng) ──▶ data/beacons.json + audio/*.wav
   ├── POST /api/hub/ask   ──▶ server.js ──▶ Groq Whisper STT (.WAV)
   │                                    ──▶ kiemthu/smart_ai_server.js (In-Process)
   │                                           ├── nlp_processor.js + intent_classifier.js + semantic_router.js
   │                                           ├── knowledge_base.js (2,046 static records + LocalSemanticIndex)
   │                                           ├── answer_composer.js (Groq 3-model RAG + Local Compositional NLG)
   │                                           ├── auto_learning_store.js (trực tiếp ghi JSON & index)
   │                                           └── session_manager.js (in-memory Map, TTL 30m)
   │                                    ──▶ Google Translate TTS (Keep-Alive HTTPS) + FFmpeg RAM PCM
   └── GET /audio-stream/:id.wav ──▶ Progressive chunked RIFF/WAVE stream + merged file
```

---

## 2. Đánh giá trung thực từng module (Hoạt động thực vs Chưa hoàn thiện)

| Module | Trạng thái thực tế trước nâng cấp | Nhận xét kỹ thuật |
|---|---|---|
| `server.js` (HTTP + SSE + Audio) | Hoạt động | Quá tải trách nhiệm (~1.900 dòng), trộn lẫn HTTP routing, auth, BLE, TTS, STT, AI orchestration trong 1 file. |
| `kiemthu` NLP / Intent / KB | Hoạt động tốt (1.000/1.000 bộ test cũ) | Có 2.046 bản ghi xác thực + LocalSemanticIndex; thiếu tách đa ý định, thiếu log lý do định tuyến chuẩn hóa, thiếu chế độ giải thích cho trẻ em. |
| `answer_validator.js` | **Mới chỉ khai báo một phần** | Được `require()` trong `smart_ai_server.js:53` nhưng **KHÔNG được gọi trực tiếp trên đầu ra LLM RAG** ở tầng cuối! |
| `auto_learning_store.js` | **Rủi ro ô nhiễm tri thức** | Tự động đưa câu trả lời LLM thẳng vào chỉ mục phục vụ mà không có hàng đợi chờ duyệt, không có versioning/rollback, không kiểm tra mâu thuẫn bằng Validator. |
| `BLE & Multi-device` | **Chưa đạt chuẩn thực địa** | Không có lọc nhiễu RSSI (EMA), không có hysteresis chống nhảy beacon ở vùng giao thoa, dùng biến toàn cục `serverState` nên nhiều ESP32 sẽ **ghi đè trạng thái của nhau**, không có heartbeat/health. |
| `ESP32 Firmware` | **Chưa đạt chuẩn production** | Mặc định `#define USE_ROOT_CA 0` (`setInsecure()`), không có Watchdog, không có tự động nối lại Wi-Fi trong `loop()`, nút bấm BOOT mới gửi câu text cứng thay vì thu âm micro I2S INMP441 thật. |
| `Security / Auth` | **Yếu (nhiều lỗi P0)** | `ADMIN_API_KEY` để trống thì mở cửa tự do (fail-open), CORS `*` cả ở production, thiếu rate limiting ở `server.js`, không giới hạn kích thước upload `.WAV`, không xác thực thiết bị ESP32. |
| `Storage (JSON)` | **Nguy cơ hỏng file** | Dùng `fs.writeFileSync` trực tiếp không có khóa ghi đồng thời, không có atomic write-rename, không có backup/migration. |
| `Tests & CI/CD` | **Thiếu chuẩn hóa** | `package.json` chưa có `npm test`, chưa có unit/security/integration/load test, chưa có GitHub Actions CI, benchmark cũ mới test nội bộ chưa tách hold-out 6 ngôn ngữ 800+ câu. |

---

## 3. Phân loại vấn đề theo mức độ nghiêm trọng

### P0 — Lỗi bảo mật nghiêm trọng / Nguy cơ mất hoặc hỏng dữ liệu
1. **P0-1 (Fail-Open Admin Auth):** `server.js` chỉ kiểm tra `X-Admin-Key` khi biến `ADMIN_API_KEY` được đặt. Khi triển khai quên set biến này, mọi máy cùng mạng/Internet đều sửa được `beacons.json`.
2. **P0-2 (Wildcard CORS & Thiếu HTTP Security Headers):** `Access-Control-Allow-Origin: *` cố định ở mọi môi trường; thiếu `X-Content-Type-Options`, `X-Frame-Options`, `CSP`, `HSTS`, `Referrer-Policy`.
3. **P0-3 (Không giới hạn Payload / Audio Upload & Không Rate Limit ở Gateway):** `parseRawBody` và `parseJsonBody` cộng dồn buffer vô hạn → dễ bị tấn công tràn RAM (OOM DoS) trên Render 512MB. Thiếu kiểm tra định dạng nhị phân thực tế để từ chối file giả mạo.
4. **P0-4 (Không xác thực thiết bị ESP32 & Rò rỉ/Ghi đè trạng thái đa thiết bị):** Mọi client có thể giả mạo `device_id`; `serverState` dùng chung toàn cục nên 2 cục ESP32 dùng đồng thời sẽ ghi đè ngôn ngữ & trạng thái của nhau.
5. **P0-5 (Auto-Learning không kiểm duyệt — Risk of Knowledge Poisoning):** Câu trả lời từ LLM tự động đi thẳng vào tập phục vụ `auto_learned_knowledge.json` mà không qua hàng đợi phê duyệt, không kiểm tra mâu thuẫn, không có provenance và rollback.
6. **P0-6 (ESP32 TLS `setInsecure()` mặc định & thiếu cơ chế bảo vệ phần cứng):** Kết nối HTTPS bỏ qua xác minh chứng chỉ (nguy cơ MITM), không có Watchdog (`esp_task_wdt`) và không tự kết nối lại Wi-Fi khi rớt sóng.
7. **P0-7 (Ghi file JSON không nguyên tử & không có Backup):** Ghi trực tiếp `fs.writeFileSync` dễ làm hỏng dữ liệu khi crash hoặc nhiều request ghi đồng thời.

### P1 — Lỗi ảnh hưởng trực tiếp độ tin cậy & trải nghiệm
1. **P1-1 (Validator chưa kiểm chứng đầu ra LLM RAG):** `RealAnswerValidator` chưa chặn/hiệu chỉnh các mốc năm/số đo LLM tự suy diễn ngoài bằng chứng truy xuất.
2. **P1-2 (BLE nhảy vùng liên tục ở biên 2 hiện vật):** Firmware và Backend chưa áp dụng lọc EMA RSSI + Hysteresis (+dBm margin) + độ ổn định mẫu liên tiếp.
3. **P1-3 (Trùng lặp / Đảo thứ tự luồng Voice):** Chưa có `AbortController` / request sequence hủy phiên cũ khi cùng một thiết bị gửi câu hỏi mới liên tiếp.
4. **P1-4 (Thiếu Automated Test Suite & CI/CD):** Không có kiểm thử hồi quy tự động trước khi deploy.
5. **P1-5 (Rủi ro thương mại của Google Translate TTS không chính thức):** `translate.google.com/translate_tts` là endpoint không có SLA thương mại, cần ghi rõ giới hạn và cơ chế retry/fallback an toàn.

### P2 — Tối ưu hóa & Khả năng mở rộng
1. **P2-1 (Monolith `server.js`):** Cần tách các module trách nhiệm rõ ràng (`src/security/`, `src/iot/`, `src/storage/`).
2. **P2-2 (Multi-intent & Child Mode):** Chưa phát hiện nhiều ý định trong cùng một câu và chưa có chế độ giải thích dễ hiểu cho trẻ em.
3. **P2-3 (Telemetry & Device Health):** Thiếu endpoint heartbeat, thống kê lỗi theo thiết bị, phát hiện thiết bị offline.
4. **P2-4 (Đo lường hiệu năng chịu tải):** Chưa có benchmark P50/P95/P99 ở mức 1 / 10 / 50 / 100 người dùng đồng thời.

### P3 — Cải tiến tùy chọn
1. **P3-1:** Chuyển đổi sang MongoDB/SQLite khi số lượng bảo tàng/thiết bị vượt quy mô 1 điểm di tích.
2. **P3-2:** Tích hợp TTS thương mại (Azure Speech / Google Cloud TTS / ElevenLabs) thay Google Translate TTS khi thương mại hóa chính thức.
3. **P3-3:** OTA Firmware signing cho ESP32 ngoài thực địa.

---

## 4. Điểm Baseline trước nâng cấp (Đánh giá trung thực theo Rubric)

| Hạng mục | Trọng số | Điểm Baseline (/10) | Lý do chứng minh |
|---|---:|---:|---|
| Software Architecture | 15% | 5.5 | Hoạt động nhưng `server.js` nguyên khối, state toàn cục không cách ly đa thiết bị. |
| AI & RAG Quality | 20% | 7.2 | Có 2.046 bản ghi + Semantic Search + RAG nhưng Validator chưa kiểm chứng LLM, Auto-Learning chưa tách staging. |
| IoT & BLE Reliability | 15% | 4.5 | Thiếu lọc EMA/Hysteresis, thiếu Wi-Fi reconnect/Watchdog/Mic capture thật, chưa hỗ trợ multi-device health. |
| Security | 15% | 3.5 | Fail-open admin, CORS `*`, không rate-limit gateway, không upload cap, không device auth, ESP32 `setInsecure()`. |
| Testing & Benchmark | 15% | 4.0 | Chỉ có script nội bộ, chưa có `npm test`, chưa có hold-out 800 câu 6 ngôn ngữ, chưa có load/security test, chưa có CI. |
| Performance & Scalability | 10% | 7.0 | TTS RAM pipeline tốt (~1–390ms), chưa đo tải 10/50/100 concurrent và thiếu chống OOM DoS. |
| Deployment & Maintainability | 10% | 6.0 | Có `render.yaml` & `/health`, thiếu docs chuẩn kiến trúc, thiếu backup/migration dữ liệu. |
| **Tổng điểm có trọng số** | **100%** | **5.40 / 10** | Đạt mức demo tốt, **chưa đạt chuẩn triển khai production 9+/10**. |
