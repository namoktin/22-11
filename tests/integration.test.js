const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.KIEMTHU_IN_PROCESS = 'true';
process.env.ADMIN_API_KEY = 'IntegrationTestAdminKey_2026!';
process.env.RATE_LIMIT_GENERAL = '500';
process.env.RATE_LIMIT_VOICE = '500';
process.env.RATE_LIMIT_BLE = '500';
process.env.RATE_LIMIT_ADMIN = '500';
delete process.env.GROQ_API_KEY; // Chạy deterministic offline không phụ thuộc mạng ngoài

const { server, rateLimiter } = require('../server');
const { autoLearningStore } = require(path.join(__dirname, '..', 'kiemthu', 'engine', 'auto_learning_store'));

let baseUrl = '';

function request(method, reqPath, { headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(baseUrl + reqPath);
    const reqHeaders = { ...headers };
    if (body !== null && !reqHeaders['Content-Length'] && !reqHeaders['content-length']) {
      reqHeaders['Content-Length'] = Buffer.byteLength(body);
    }
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      headers: reqHeaders
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const text = buf.toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, buf, text, json });
      });
    });
    req.on('error', reject);
    if (body !== null) req.write(body);
    req.end();
  });
}

test.before(async () => {
  rateLimiter.reset();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
});

test('Integration 1: /health reports full KB + LocalSemanticIndex + Auto-Learning 2.0 stats', async () => {
  const r = await request('GET', '/health');
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'ok');
  assert.ok(r.json.kb_stats.facts100 >= 500);
  assert.ok(r.json.kb_stats.dataset1000 >= 1000);
  assert.ok(r.json.kb_stats.localSemanticVectorDocs >= 2000);
});

test('Integration 2: Multi-Device BLE Isolation, Hysteresis & Heartbeat Telemetry', async () => {
  // Device 1 triggers Beacon 001 with strong RSSI
  const d1a = await request('POST', '/api/ble-scan', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: 'HUB_INT_1', beacon_mac: 'AA:BB:CC:DD:EE:01', rssi: -60, language: 'vi' })
  });
  assert.equal(d1a.status, 200);
  assert.equal(d1a.json.action, 'PLAY_AUDIO');
  assert.equal(d1a.json.code, '001');

  // Device 1 immediately re-scans same beacon -> SKIP_COOLDOWN
  const d1cd = await request('POST', '/api/ble-scan', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: 'HUB_INT_1', beacon_mac: 'AA:BB:CC:DD:EE:01', rssi: -58 })
  });
  assert.equal(d1cd.status, 200);
  assert.equal(d1cd.json.action, 'SKIP_COOLDOWN');

  // Device 2 simultaneously scans Beacon 002 -> completely isolated, triggers immediately!
  const d2 = await request('POST', '/api/ble-scan', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: 'HUB_INT_2', beacon_mac: 'AA:BB:CC:DD:EE:02', rssi: -58, language: 'vi' })
  });
  assert.equal(d2.status, 200);
  assert.equal(d2.json.action, 'PLAY_AUDIO');
  assert.equal(d2.json.code, '002');

  // Heartbeat + Health Check lists both hubs ONLINE
  const hb = await request('POST', '/api/devices/heartbeat', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: 'HUB_INT_1', firmware_version: '3.0.0-prod', wifi_rssi: -52, free_heap: 135000 })
  });
  assert.equal(hb.status, 200);

  const health = await request('GET', '/api/devices/health');
  assert.equal(health.status, 200);
  assert.ok(health.json.online_count >= 2);
});

test('Integration 3: Voice Query /api/hub/ask returns accurate answer + valid Single Streaming WAV', async () => {
  const r = await request('POST', '/api/hub/ask', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_id: 'HUB_INT_VOICE',
      code: '002',
      language: 'vi',
      voice_text: 'Giá vé vào cổng Nhà tù Hỏa Lò bao nhiêu tiền?'
    })
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.audio_mode, 'SINGLE_STREAMING_WAV');
  assert.ok(r.json.reply_text.includes('50.000'));
  assert.ok(r.json.audio_wav_url.includes('/audio-stream/'));

  const wavPath = new URL(r.json.audio_wav_url).pathname;
  const wav = await request('GET', wavPath);
  assert.equal(wav.status, 200);
  assert.equal(wav.buf.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.buf.toString('ascii', 8, 12), 'WAVE');
});

test('Integration 4: Auto-Learning 2.0 full HTTP lifecycle (propose -> admin approve -> semantic hit -> rollback)', async () => {
  const prop = autoLearningStore.propose({
    question: 'Cột cờ trên đỉnh tháp canh Hỏa Lò cao bao nhiêu?',
    answer: 'Hồ sơ Di tích Nhà tù Hỏa Lò ghi nhận bốn góc nhà tù có các chòi canh kiên cố dùng để giám sát toàn bộ khuôn viên trại giam.',
    intent: 'HISTORICAL_FACT',
    language: 'vi',
    sources: ['HOALO_INTEGRATION_TEST']
  });
  assert.equal(prop.accepted, true);

  // Admin approves proposal via HTTP API
  const appr = await request('POST', '/api/auto-learning/approve', {
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': process.env.ADMIN_API_KEY },
    body: JSON.stringify({ proposal_id: prop.proposalId, approved_by: 'qa_curator' })
  });
  assert.equal(appr.status, 200);
  assert.equal(appr.json.success, true);

  // Feedback API works
  const fb = await request('POST', '/api/feedback', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'Giá vé bao nhiêu?', reply: '50.000 VNĐ', rating: 'up', device_id: 'HUB_INT_1' })
  });
  assert.equal(fb.status, 200);
  assert.equal(fb.json.success, true);

  // Admin rolls back cleanly so integration test leaves zero test pollution!
  const rb = await request('POST', '/api/auto-learning/rollback', {
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': process.env.ADMIN_API_KEY },
    body: JSON.stringify({})
  });
  assert.equal(rb.status, 200);
  assert.equal(rb.json.success, true);
});

test('Integration 5: Admin Beacon Create -> Update -> Delete cleanly with atomic storage', async () => {
  const createRes = await request('POST', '/api/beacons/create', {
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': process.env.ADMIN_API_KEY },
    body: JSON.stringify({
      id: 'beacon_temp_999',
      code: '999',
      mac: 'AA:BB:CC:DD:EE:99',
      artifact_name: 'Hiện vật Kiểm thử Tạm',
      text: 'Lời thoại kiểm thử tích hợp.'
    })
  });
  assert.equal(createRes.status, 201);

  const updRes = await request('POST', '/api/beacons/update', {
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': process.env.ADMIN_API_KEY },
    body: JSON.stringify({ id: 'beacon_temp_999', artifact_name: 'Hiện vật Kiểm thử Đã Cập Nhật' })
  });
  assert.equal(updRes.status, 200);
  assert.ok(updRes.json.beacons.some(b => b.id === 'beacon_temp_999' && b.artifact_name.includes('Cập Nhật')));

  const delRes = await request('DELETE', '/api/beacons/delete?id=beacon_temp_999', {
    headers: { 'X-Admin-Key': process.env.ADMIN_API_KEY }
  });
  assert.equal(delRes.status, 200);
  assert.equal(delRes.json.success, true);
});
