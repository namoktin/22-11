/**
 * =========================================================================================
 * ⚡ REAL PERFORMANCE & CONCURRENCY LOAD BENCHMARK (1 / 10 / 50 / 100 CONCURRENT USERS)
 * =========================================================================================
 * Đo thực tế trên server.js chạy thật (local loopback):
 * - P50, P95, P99 latency (ms)
 * - Requests per second (RPS)
 * - Error rate (%)
 * - Memory usage (RSS MB, Heap Used MB)
 * - CPU time (user + system ms)
 * - Concurrent sessions
 * Lưu báo cáo thật ra benchmarks/load_benchmark_report.json
 * =========================================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.KIEMTHU_IN_PROCESS = 'true';
process.env.RATE_LIMIT_GENERAL = '100000';
process.env.RATE_LIMIT_VOICE = '100000';
process.env.RATE_LIMIT_BLE = '100000';
delete process.env.GROQ_API_KEY;

const { server, rateLimiter } = require('../server');

let baseUrl = '';

function postJson(reqPath, payload) {
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    const u = new URL(baseUrl + reqPath);
    const body = JSON.stringify(payload);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        resolve({ status: res.statusCode, ms, ok: res.statusCode === 200 });
      });
    });
    req.on('error', () => {
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      resolve({ status: 0, ms, ok: false });
    });
    req.write(body);
    req.end();
  });
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Number(sorted[idx].toFixed(2));
}

async function runLevel(concurrency, totalRequests, endpoint, payloadBuilder) {
  rateLimiter.reset();
  const latencies = [];
  let errors = 0;
  let nextIdx = 0;

  const cpuBefore = process.cpuUsage();
  const tStart = process.hrtime.bigint();

  async function worker() {
    while (true) {
      const i = nextIdx++;
      if (i >= totalRequests) break;
      const res = await postJson(endpoint, payloadBuilder(i));
      latencies.push(res.ms);
      if (!res.ok) errors++;
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const elapsedSec = Number(process.hrtime.bigint() - tStart) / 1e9;
  const cpuDiff = process.cpuUsage(cpuBefore);
  const mem = process.memoryUsage();
  latencies.sort((a, b) => a - b);

  return {
    concurrency,
    total_requests: totalRequests,
    elapsed_sec: Number(elapsedSec.toFixed(3)),
    rps: Number((totalRequests / Math.max(elapsedSec, 0.001)).toFixed(2)),
    error_rate_pct: Number(((errors / totalRequests) * 100).toFixed(2)),
    latency_ms: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      max: Number((latencies[latencies.length - 1] || 0).toFixed(2))
    },
    memory_mb: {
      rss: Number((mem.rss / 1024 / 1024).toFixed(1)),
      heapUsed: Number((mem.heapUsed / 1024 / 1024).toFixed(1))
    },
    cpu_ms: {
      user: Number((cpuDiff.user / 1000).toFixed(1)),
      system: Number((cpuDiff.system / 1000).toFixed(1))
    }
  };
}

async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  console.log(`\n⚡ Starting Real Load Benchmark against ${baseUrl}...`);

  const bleLevels = [];
  for (const [c, n] of [[1, 30], [10, 100], [50, 250], [100, 400]]) {
    const r = await runLevel(c, n, '/api/ble-scan', (i) => ({
      device_id: `LOAD_HUB_${i % c}`,
      beacon_mac: `AA:BB:CC:DD:EE:0${(i % 4) + 1}`,
      rssi: -62,
      force: true
    }));
    bleLevels.push(r);
    console.log(`  [BLE /api/ble-scan]      C=${String(c).padStart(3)} | RPS=${String(r.rps).padStart(7)} | P50=${r.latency_ms.p50}ms | P95=${r.latency_ms.p95}ms | P99=${r.latency_ms.p99}ms | Err=${r.error_rate_pct}% | RSS=${r.memory_mb.rss}MB`);
  }

  // Đo AI + Cached TTS End-to-End Voice Endpoint (/api/hub/ask) ở 1 / 10 / 50 / 100 concurrent
  // Warm up 1 lần trước để đo chính xác tải phục vụ sau khi đã warm PCM cache
  await postJson('/api/hub/ask', { device_id: 'WARM', code: '002', language: 'vi', voice_text: 'Giá vé vào cổng Nhà tù Hỏa Lò bao nhiêu tiền?' });

  const voiceLevels = [];
  const sampleQs = [
    'Giá vé vào cổng Nhà tù Hỏa Lò bao nhiêu tiền?',
    'Giờ mở cửa Hỏa Lò mấy giờ?',
    'Nhà vệ sinh ở đâu?',
    'Cỗ máy chém cao bao nhiêu mét?'
  ];
  for (const [c, n] of [[1, 10], [10, 40], [50, 100], [100, 200]]) {
    const r = await runLevel(c, n, '/api/hub/ask', (i) => ({
      device_id: `VOICE_LOAD_${i % c}`,
      code: '002',
      language: 'vi',
      voice_text: sampleQs[i % sampleQs.length]
    }));
    voiceLevels.push(r);
    console.log(`  [Voice /api/hub/ask]     C=${String(c).padStart(3)} | RPS=${String(r.rps).padStart(7)} | P50=${r.latency_ms.p50}ms | P95=${r.latency_ms.p95}ms | P99=${r.latency_ms.p99}ms | Err=${r.error_rate_pct}% | RSS=${r.memory_mb.rss}MB`);
  }

  const report = {
    generated_at: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      note: 'Local loopback load test with deterministic AI + RAM PCM cache (no external LLM/TTS network jitter).'
    },
    ble_scan_load: bleLevels,
    voice_ask_load: voiceLevels
  };

  const outPath = path.join(__dirname, 'load_benchmark_report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n💾 Saved load benchmark report: ${outPath}`);

  await new Promise(resolve => server.close(resolve));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
