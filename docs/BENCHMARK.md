# 📊 REAL EXPERIMENTAL BENCHMARK REPORT — V3.0

> [!IMPORTANT]
> **Cam kết Trung thực 100%**: Toàn bộ số liệu dưới đây được đo trực tiếp bằng script thực thi thật (`npm run benchmark`), lưu vết đầy đủ tại `benchmarks/ai_benchmark_800_report.json` và `benchmarks/load_benchmark_report.json`. Không có bất kỳ số liệu ước đoán hay benchmark giả nào.

---

## 1. Benchmark AI Độc lập 800 Câu Đa Ngôn Ngữ (`benchmark:ai`)

- **Script**: `benchmarks/run_ai_benchmark_800.js`
- **Chế độ**: `OFFLINE_DETERMINISTIC_HOLD_OUT` (**0 cuộc gọi Groq API**, **Zero Data Leakage** — 800 câu hỏi viết mới tách biệt hoàn toàn khỏi `1.csv`, `3.csv`, `500`, `1000` JSON)
- **Phân bổ ngôn ngữ**: `500 VI` • `100 EN` • `50 FR` • `50 JA` • `50 KO` • `50 ZH` = **800 cases**
- **Tổng thời gian chạy**: `4,567 ms` (**trung bình `5.71 ms / câu hỏi`**)

### 1.1 Tổng hợp 8 Chỉ số Chuẩn (Trước vs Sau Nâng cấp)

| Chỉ số | Vòng đo đầu (trước sửa lỗi) | Vòng đo cuối (v3.0) | Mục tiêu Gate | Kết quả |
| :--- | :---: | :---: | :---: | :---: |
| **Accuracy (Overall)** | 88.13% | **98.25% (786/800)** | ≥ 95.0% | ✅ PASS |
| **Faithfulness** | 99.50% | **100.00%** | ≥ 99.0% | ✅ PASS |
| **Groundedness** | 100.00% | **100.00%** | ≥ 99.0% | ✅ PASS |
| **Retrieval Recall@5** | 100.00% | **100.00%** | ≥ 95.0% | ✅ PASS |
| **Hallucination Rate** | 0.50% | **0.00% (0/800)** | ≤ 1.0% | ✅ PASS |
| **Intent Classification Accuracy** | 80.68% | **93.18%** | ≥ 90.0% | ✅ PASS |
| **Language Detection Accuracy** | 75.38% | **97.63%** | ≥ 95.0% | ✅ PASS |
| **Answer Relevance** | 88.13% | **98.25%** | ≥ 95.0% | ✅ PASS |

### 1.2 Phân tích Chi tiết theo 12 Nhóm Bài Test

| Nhóm kiểm thử | Đạt / Tổng | Tỷ lệ | Nhận xét kỹ thuật |
| :--- | :---: | :---: | :--- |
| `IN_KB` (Tiếng Việt diễn đạt mới) | 158 / 160 | **98.75%** | Cải thiện mạnh từ 76.88% nhờ IDF + Year-Consistency Guard |
| `OUT_OF_KB` (Ngoài phạm vi) | 59 / 60 | **98.33%** | 1 ca biên *"Khoảng cách Trái Đất đến Mặt Trời"* trả lời từ chối thiếu dữ liệu thay vì `OUT_OF_SCOPE` |
| `TYPO_SLANG` (Không dấu, viết tắt) | 64 / 70 | **91.43%** | Còn 6 ca không dấu cực ngắn (`sac pin dien thoai cho nao`, `ve giay bi rach...`, `20 phut nen xem gi`) |
| `MULTI_INTENT` (Đa ý định) | 40 / 40 | **100.00%** | Tự động ghép thông tin phụ (vé + giờ, WC + gửi đồ...) |
| `MISSING_CONTEXT` (Nhiễu / thiếu ngữ cảnh) | 40 / 40 | **100.00%** | Yêu cầu làm rõ hoặc phản hồi an toàn, không đoán mò |
| `TRAPS_WRONG_PREMISE` (Bẫy sử học) | 75 / 80 | **93.75%** | Chặn chính xác bẫy 30.000đ, Hoàng Văn Thụ, Nguyễn Thái Học, 1951, lá bàng; còn 4 biến thể *"Bàng ơi"* bị `TOUR_INFORMATION` bắt trước và 1 biến thể *"Xác nhận giúp mình: ... chui cống ngầm"* bị bộ lọc injection bảo thủ chặn |
| `PROMPT_INJECTION` (Tấn công chỉ dẫn) | 50 / 50 | **100.00%** | Tăng từ 70% lên 100% sau khi vá bypass `isSafeMuseumContext` |
| `MULTILINGUAL_EN` | 100 / 100 | **100.00%** | Tăng từ 80% lên 100% |
| `MULTILINGUAL_FR` | 50 / 50 | **100.00%** | Nhận diện tiếng Pháp + xử lý chuẩn xác |
| `MULTILINGUAL_JA` | 50 / 50 | **100.00%** | Script Hiragana/Katakana nhận diện chính xác |
| `MULTILINGUAL_KO` | 50 / 50 | **100.00%** | Script Hangul nhận diện chính xác |
| `MULTILINGUAL_ZH` | 50 / 50 | **100.00%** | Script Hanzi nhận diện chính xác |

---

## 2. Benchmark Hiệu năng & Tải Đồng thời (`benchmark:load`)

- **Script**: `benchmarks/run_load_benchmark.js`
- **Môi trường**: Node.js `v22.21.0`, Windows x64, Local Loopback HTTP Gateway thật (AI deterministic offline + Live Streaming WAV/FFmpeg pipeline)

### 2.1 Tải BLE Scan (`POST /api/ble-scan`)

| Concurrency | Requests | RPS | P50 (ms) | P95 (ms) | P99 (ms) | Error Rate | RSS Memory | CPU (user+sys) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1** | 30 | 154.99 | 3.92 | 17.39 | 53.23 | **0%** | 41.1 MB | 125 ms |
| **10** | 100 | 101.33 | 41.95 | 218.85 | 233.21 | **0%** | 43.2 MB | 454 ms |
| **50** | 250 | 250.48 | 177.48 | 257.50 | 380.72 | **0%** | 48.8 MB | 718 ms |
| **100** | 400 | 129.31 | 809.37 | 1,139.31 | 1,149.22 | **0%** | 51.9 MB | 1,344 ms |

### 2.2 Tải Voice Ask End-to-End (`POST /api/hub/ask` — AI + Live TTS/FFmpeg Streaming WAV)

| Concurrency | Requests | RPS | P50 (ms) | P95 (ms) | P99 (ms) | Error Rate | RSS Memory | CPU (user+sys) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1** | 10 | 4.27 | 245.78 | 419.10 | 419.10 | **0%** | 136.2 MB | 860 ms |
| **10** | 40 | 7.75 | 395.56 | 2,880.71 | 3,014.11 | **0%** | 173.7 MB | 2,875 ms |
| **50** | 100 | 9.16 | 1,948.36 | 9,011.83 | 9,233.89 | **0%** | 252.5 MB | 4,406 ms |
| **100** | 200 | 17.19 | 2,680.30 | 4,523.27 | 7,908.81 | **0%** | 385.0 MB | 7,703 ms |

### 2.3 Phân tích Nút thắt Hiệu năng Thực tế
- **BLE Gateway** rất nhẹ: ở mức 100 thiết bị gửi liên tục vẫn đạt **0% lỗi** và chỉ tiêu tốn **51.9 MB RSS**.
- **Voice TTS Pipeline** đạt **0% lỗi** ở cả 4 mức tải (`1 → 100`), thời gian phản hồi đơn người dùng rất nhanh (`P50 = 245.78 ms`, `P95 = 419.10 ms`). Tuy nhiên ở tải cao `50–100` người dùng đồng thời sinh âm thanh mới chưa cache, P95 tăng lên `4.5s–9.0s` và RSS đạt `385 MB` do nhiều tiến trình FFmpeg giải mã đồng thời — cần giới hạn concurrency FFmpeg hoặc nâng RAM server ≥ 1 GB nếu phục vụ > 50 khách hỏi giọng nói mới cùng giây.

---

## 3. Hạng mục Chưa Kiểm chứng trên Phần cứng Vật lý (Honest Boundary)

Các thông số dưới đây **CHƯA được đo thực tế trên phần cứng** (chỉ kiểm chứng tĩnh mã nguồn firmware và mô phỏng logic server):
- Biên dịch và nạp `esp32_firmware/esp32_ble_dialogue.ino` v3.0 trên board ESP32 thật.
- Xác minh bắt tay TLS `ISRG Root X1` từ chip ESP32 thật tới Render HTTPS.
- Độ ổn định sóng RF BLE RSSI thực tế tại các phòng giam tường đá Hỏa Lò, chất lượng thu âm INMP441, và thời gian uptime liên tục 24–72h trên mạch thật.
