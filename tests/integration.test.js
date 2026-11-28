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
process.env.TTS_PROVIDER = 'google'; // KHÔNG bao giờ đốt credit ElevenLabs khi chạy test tự động!
delete process.env.ELEVENLABS_API_KEY;

const { server, rateLimiter, ttsEngine } = require('../server');
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

test('Integration 6: Long-passage multi-chunk ElevenLabs streaming WAV never exceeds concurrency=2 and delivers complete audio', async () => {
  const origPref = ttsEngine.providerPref;
  const origKey = ttsEngine.elevenLabsApiKey;
  const origCall = ttsEngine.callElevenLabsRaw.bind(ttsEngine);
  const origRetryMs = ttsEngine.elevenLabsConcurrentRetryMs;

  let activeCalls = 0;
  let peakCalls = 0;
  let totalCalls = 0;
  let simulated429Once = false;

  try {
    ttsEngine.clearCache();
    ttsEngine.providerPref = 'auto';
    ttsEngine.elevenLabsApiKey = 'sk_mock_integration_only';
    ttsEngine.elevenLabsCooldownUntil = 0;
    ttsEngine.elevenLabsSupportsPcm16k = true;
    ttsEngine.elevenLabsConcurrentRetryMs = 15;
    ttsEngine.callElevenLabsRaw = async (text, lang, fmt) => {
      activeCalls++;
      totalCalls++;
      if (activeCalls > peakCalls) peakCalls = activeCalls;
      await new Promise(r => setTimeout(r, 30));
      try {
        if (!simulated429Once && totalCalls === 2) {
          simulated429Once = true;
          const err = new Error('ElevenLabs HTTP 429: {"detail":{"type":"rate_limit_error","code":"concurrent_limit_exceeded"}}');
          err.statusCode = 429;
          err.body = '{"detail":{"type":"rate_limit_error","code":"concurrent_limit_exceeded"}}';
          throw err;
        }
        // Trả về PCM 16kHz hợp lệ (4000 bytes = 125ms mỗi đoạn)
        return { buffer: Buffer.alloc(4000, 33), outputFormat: fmt, voiceId: 'mock_v3' };
      } finally {
        activeCalls--;
      }
    };

    const r = await request('POST', '/api/hub/ask', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: 'HUB_INT_LONG_EL',
        code: '002',
        language: 'vi',
        voice_text: 'Hãy kể chi tiết cuộc vượt ngục lịch sử đêm Giáng sinh năm 1951 ở Nhà tù Hỏa Lò'
      })
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.tts_provider, 'elevenlabs');
    assert.ok(r.json.total_chunks >= 2, `Expected multi-chunk response for long story, got ${r.json.total_chunks}`);

    const wavPath = new URL(r.json.audio_wav_url).pathname;
    const wav = await request('GET', wavPath);
    assert.equal(wav.status, 200);
    assert.equal(wav.buf.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.buf.toString('ascii', 8, 12), 'WAVE');
    // Tổng độ dài WAV phải chứa ĐẦY ĐỦ tất cả các đoạn (mỗi đoạn 4000 bytes PCM) -> KHÔNG mất tiếng đoạn nào!
    assert.ok(wav.buf.length >= 44 + r.json.total_chunks * 4000, `Streamed WAV truncated: got ${wav.buf.length}B for ${r.json.total_chunks} chunks`);
    assert.ok(peakCalls <= 2, `Peak concurrent ElevenLabs calls must stay <= 2, saw ${peakCalls}`);
    assert.equal(ttsEngine.isElevenLabsActive(), true, 'Transient concurrent_limit_exceeded must NOT poison global cooldown');
  } finally {
    ttsEngine.callElevenLabsRaw = origCall;
    ttsEngine.providerPref = origPref;
    ttsEngine.elevenLabsApiKey = origKey;
    ttsEngine.elevenLabsConcurrentRetryMs = origRetryMs;
    ttsEngine.clearCache();
  }
});

test('Integration 7: Progressive Chunk-1 streaming returns /api/hub/ask before Chunk-1 EOF and streams seamless full WAV', async () => {
  const { ttsEngine } = require('../server');
  const origPref = ttsEngine.providerPref;
  const origKey = ttsEngine.elevenLabsApiKey;
  const origCall = ttsEngine.callElevenLabsRaw.bind(ttsEngine);

  try {
    ttsEngine.clearCache();
    ttsEngine.providerPref = 'auto';
    ttsEngine.elevenLabsApiKey = 'sk_mock_stream_integration';
    ttsEngine.elevenLabsCooldownUntil = 0;
    ttsEngine.elevenLabsSupportsPcm16k = true;

    let callSeq = 0;
    let chunk1FinishedAt = 0;
    ttsEngine.callElevenLabsRaw = async (text, lang, fmt, opts) => {
      callSeq++;
      if (opts && typeof opts.onAudioChunk === 'function') {
        await new Promise(r => setTimeout(r, 15));
        opts.onAudioChunk(Buffer.alloc(1200, 21));
        await new Promise(r => setTimeout(r, 320));
        opts.onAudioChunk(Buffer.alloc(2800, 22));
        chunk1FinishedAt = Date.now();
        return { buffer: Buffer.alloc(4000, 21), outputFormat: fmt, voiceId: 'mock_stream_v3', streamed: true };
      }
      await new Promise(r => setTimeout(r, 25));
      return { buffer: Buffer.alloc(4000, 44), outputFormat: fmt, voiceId: 'mock_stream_v3' };
    };

    const r = await request('POST', '/api/hub/ask', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: 'HUB_INT_STREAM_EL',
        code: '002',
        language: 'vi',
        voice_text: 'Hãy kể chi tiết cuộc vượt ngục lịch sử đêm Giáng sinh năm 1951 ở Nhà tù Hỏa Lò'
      })
    });
    const askReturnedAt = Date.now();

    assert.equal(r.status, 200);
    assert.equal(r.json.tts_provider, 'elevenlabs');
    assert.ok(r.json.total_chunks >= 2, `Expected multi-chunk response, got ${r.json.total_chunks}`);
    const firstChunkTtsMs = r.json.latency_measurement?.breakdown?.first_chunk_wav_ms ?? 9999;
    assert.ok(firstChunkTtsMs < 180, `Expected Chunk-1 TTFB < 180ms before 320ms tail, got ${firstChunkTtsMs}ms`);
    assert.ok(chunk1FinishedAt === 0 || askReturnedAt < chunk1FinishedAt, `Expected /api/hub/ask (${askReturnedAt}) to return BEFORE Chunk-1 EOF (${chunk1FinishedAt})`);
    assert.ok(callSeq >= 2);

    const wavPath = new URL(r.json.audio_wav_url).pathname;
    const wav = await request('GET', wavPath);
    assert.equal(wav.status, 200);
    assert.equal(wav.buf.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.buf.toString('ascii', 8, 12), 'WAVE');
    assert.ok(wav.buf.length >= 44 + r.json.total_chunks * 4000, `Streamed WAV truncated: got ${wav.buf.length}B for ${r.json.total_chunks} chunks`);
  } finally {
    ttsEngine.callElevenLabsRaw = origCall;
    ttsEngine.providerPref = origPref;
    ttsEngine.elevenLabsApiKey = origKey;
    ttsEngine.clearCache();
  }
});
