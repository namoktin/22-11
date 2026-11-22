# 🧪 TESTING & CI/CD QUALITY GATE — V3.0

Tài liệu mô tả chiến lược kiểm thử tự động và cổng chất lượng CI/CD (`.github/workflows/ci.yml`).

---

## 1. Tháp Kiểm thử (Test Pyramid)

| Tầng kiểm thử | Lệnh chạy | Tập tin | Số bài test | Trạng thái thực tế |
| :--- | :--- | :--- | :---: | :---: |
| **Static Syntax Lint** | `npm run lint` | `scripts/syntax_check.js` | 30/30 JS files | ✅ PASSED |
| **Dependency Audit** | `npm audit --audit-level=high` | `package-lock.json` | 0 high/critical | ✅ PASSED |
| **Unit Tests** | `npm run test:unit` | `tests/unit.test.js` | **9 / 9** | ✅ PASSED (357 ms) |
| **Security Tests** | `npm run test:security` | `tests/security.test.js` | **6 / 6** | ✅ PASSED (2,077 ms) |
| **Integration Tests** | `npm run test:integration` | `tests/integration.test.js` | **5 / 5** | ✅ PASSED (2,748 ms) |
| **AI Hold-Out Benchmark** | `npm run benchmark:ai` | `benchmarks/run_ai_benchmark_800.js` | **800 cases** | ✅ PASSED (98.25% acc, 0% hallu) |
| **Concurrency Load Test** | `npm run benchmark:load` | `benchmarks/run_load_benchmark.js` | **1 / 10 / 50 / 100 C** | ✅ PASSED (0% errors) |

---

## 2. Chi tiết Phạm vi Các Bài Kiểm thử

### 2.1 Unit Tests (`tests/unit.test.js` — 9 tests)
1. `SafeJsonStore`: atomic write, rolling backup, tự khôi phục khi file JSON bị hỏng (corrupt), và rollback.
2. `sanitizeForLog`: che giấu `gsk_*`, Bearer token, password trong log.
3. `BleAndDeviceManager`: EMA smoothing chặn gai nhiễu 1 gói tin (`-88 → -62`), xác nhận khi tiến gần ổn định, hysteresis `+6 dBm`, cooldown, và cô lập trạng thái giữa 2 thiết bị.
4. `RealAnswerValidator`: bắt lỗi mâu thuẫn lịch sử (VD: Hoàng Văn Thụ bị xử chém) và phát hiện niên đại/số liệu không có trong bằng chứng.
5. `AutoLearningStoreV2`: chặn prompt injection & contradiction, tách biệt staging (`pending`) không cho phục vụ trước khi duyệt, phê duyệt bởi Admin → khớp ngữ nghĩa → rollback về version cũ.
6. `IntentClassifier`: phát hiện đa ý định (`secondaryIntents`) và chế độ trẻ em (`audience: 'child'`).
7. `LocalSemanticIndex`: Entity Consistency Guard chặn nhầm lẫn giữa các hiện vật khác nhau.
8. `LocalHumanComposer`: sinh 50/50 biến thể lời nói tự nhiên khác nhau hoàn toàn trong khi bảo toàn số liệu gốc.
9. `Security validators`: kiểm tra magic bytes file âm thanh và schema validator cho Beacon.

### 2.2 Security Tests (`tests/security.test.js` — 6 tests, chạy ở `NODE_ENV=production`)
1. OWASP HTTP headers (`nosniff`, `DENY`, `CSP`, `HSTS`) + **không có CORS wildcard `*`**, chặn origin lạ bằng `403`, cho phép `ALLOWED_ORIGINS`.
2. Admin API **Fail-Closed**: trả `503` khi thiếu `ADMIN_API_KEY`, `401` khi sai key, `400` khi MAC sai định dạng.
3. ESP32 Device RBAC: cấp key → xác thực thành công → từ chối sai token (`401`) → thu hồi key → chặn lại ngay (`401`).
4. Từ chối file HTML/script giả mạo `audio/wav` (`415`) và JSON vượt quá 64KB (`413`).
5. Rate Limiter chủ động chặn flood bằng `429 Too Many Requests` kèm header `Retry-After`.
6. Lỗi JSON/hệ thống **không** rò rỉ stack trace hay đường dẫn file nội bộ ra client.

### 2.3 Integration Tests (`tests/integration.test.js` — 5 tests)
1. `GET /health` báo cáo đầy đủ KB (≥ 500 facts, ≥ 1,000 Q&A, ≥ 2,000 semantic vector docs).
2. Multi-Device BLE Isolation (`HUB_INT_1` & `HUB_INT_2`), Cooldown, Heartbeat và `GET /api/devices/health`.
3. `POST /api/hub/ask` trả lời đúng giá vé `50.000` + sinh **Single Streaming `.WAV`** hợp lệ (`RIFF/WAVE` header thực tế tải được qua HTTP `200`).
4. Chu trình HTTP đầy đủ **Auto-Learning 2.0**: propose → approve (Admin) → semantic hit → rollback.
5. Chu trình Admin CRUD Beacon: Create (`201`) → Update (`200`) → Delete (`200`) với lưu trữ atomic an toàn.

---

## 3. Chạy Toàn bộ Kiểm thử Cục bộ & CI

```bash
# Chạy toàn bộ cổng kiểm thử (Lint + Unit + Security + Integration)
npm test

# Chạy toàn bộ bộ benchmark thực nghiệm (800-case AI + 1/10/50/100 Load)
npm run benchmark
```

GitHub Actions (`.github/workflows/ci.yml`) tự động chạy trên mọi `push` và `pull_request` lên `main`/`master`:
1. `npm ci`
2. `npm audit --audit-level=high`
3. `npm run lint`
4. `npm run test:unit`
5. `npm run test:security`
6. `npm run test:integration`
7. `npm run benchmark:ai` (CI Gate: yêu cầu `Accuracy >= 95%` & `Hallucination Rate <= 1%`)
