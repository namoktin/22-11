const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

// Cấu hình môi trường Production strict TRƯỚC khi nạp server.js
process.env.NODE_ENV = 'production';
process.env.KIEMTHU_IN_PROCESS = 'true';
process.env.ALLOWED_ORIGINS = 'https://trusted-museum.vn';
process.env.RATE_LIMIT_ADMIN = '25';
process.env.RATE_LIMIT_GENERAL = '200';
delete process.env.ADMIN_API_KEY;
delete process.env.GROQ_API_KEY;

const { server, rateLimiter, deviceAuth } = require('../server');

let baseUrl = '';

function request(method, reqPath, { headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(baseUrl + reqPath);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      headers
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    req.on('error', reject);
    if (body !== null) req.write(body);
    req.end();
  });
}

test.before(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
});

test('Security 1: OWASP HTTP security headers present and NO wildcard CORS in production', async () => {
  const r = await request('GET', '/health', { headers: { Origin: 'https://evil-attacker.com' } });
  assert.equal(r.status, 200);
  assert.equal(r.headers['access-control-allow-origin'], undefined, 'Must NOT allow untrusted Origin or wildcard *');
  assert.equal(r.headers['x-content-type-options'], 'nosniff');
  assert.equal(r.headers['x-frame-options'], 'DENY');
  assert.ok(r.headers['content-security-policy']);
  assert.ok(r.headers['strict-transport-security']);

  // Disallowed origin on /api/* MUST be rejected 403
  const blocked = await request('GET', '/api/beacons', { headers: { Origin: 'https://evil-attacker.com' } });
  assert.equal(blocked.status, 403);

  // Trusted origin receives exact echoed origin (not *)
  const allowed = await request('GET', '/api/beacons', { headers: { Origin: 'https://trusted-museum.vn' } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers['access-control-allow-origin'], 'https://trusted-museum.vn');
});

test('Security 2: Fail-Closed Admin APIs reject when ADMIN_API_KEY missing or invalid', async () => {
  delete process.env.ADMIN_API_KEY;
  const rMissing = await request('POST', '/api/beacons/update', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: '001', artifact_name: 'Hacked' })
  });
  assert.equal(rMissing.status, 503, 'Admin API must fail-closed (503) when ADMIN_API_KEY is unset');

  process.env.ADMIN_API_KEY = 'SuperStrongMuseumAdminKey_2026!';
  const rWrong = await request('POST', '/api/beacons/update', {
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'wrong_key' },
    body: JSON.stringify({ code: '001', artifact_name: 'Hacked' })
  });
  assert.equal(rWrong.status, 401);

  const rInvalidMac = await request('POST', '/api/beacons/update', {
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': process.env.ADMIN_API_KEY },
    body: JSON.stringify({ code: '001', mac: 'NOT_A_MAC' })
  });
  assert.equal(rInvalidMac.status, 400);
});

test('Security 3: ESP32 Device Authentication RBAC (issue -> verify -> reject wrong -> revoke)', async () => {
  process.env.ADMIN_API_KEY = 'SuperStrongMuseumAdminKey_2026!';
  const devId = 'ESP32_SEC_TEST_01';

  const issued = await request('POST', '/api/devices/issue-key', {
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': process.env.ADMIN_API_KEY },
    body: JSON.stringify({ device_id: devId })
  });
  assert.equal(issued.status, 200);
  assert.ok(issued.json.token.startsWith('esp_'));

  // Missing token for registered device -> 401
  const noTok = await request('POST', '/api/devices/heartbeat', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: devId })
  });
  assert.equal(noTok.status, 401);

  // Valid token -> 200
  const okTok = await request('POST', '/api/devices/heartbeat', {
    headers: { 'Content-Type': 'application/json', 'X-Device-Token': issued.json.token },
    body: JSON.stringify({ device_id: devId, firmware_version: '3.0.0-prod', wifi_rssi: -55, free_heap: 140000 })
  });
  assert.equal(okTok.status, 200);

  // Revoke device -> previously valid token MUST now fail 401!
  const rev = await request('POST', '/api/devices/revoke', {
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': process.env.ADMIN_API_KEY },
    body: JSON.stringify({ device_id: devId, reason: 'stolen_unit' })
  });
  assert.equal(rev.status, 200);

  const afterRevoke = await request('POST', '/api/devices/heartbeat', {
    headers: { 'Content-Type': 'application/json', 'X-Device-Token': issued.json.token },
    body: JSON.stringify({ device_id: devId })
  });
  assert.equal(afterRevoke.status, 401);

  // Clean up test key from registry
  delete deviceAuth.state.keys[devId];
  deviceAuth.state.revoked = deviceAuth.state.revoked.filter(r => r.deviceId !== devId);
  deviceAuth.store.writeSync(deviceAuth.state);
});

test('Security 4: Reject spoofed non-audio file disguised as audio/wav (415) & oversized JSON (413)', async () => {
  const spoofedScript = Buffer.from('<!DOCTYPE html><html><script>alert("xss")</script>01234567890123456789</html>');
  const rSpoof = await request('POST', '/api/hub/ask', {
    headers: { 'Content-Type': 'audio/wav', 'X-Device-Id': 'SEC_GUEST' },
    body: spoofedScript
  });
  assert.equal(rSpoof.status, 415);

  // Oversized JSON (> 64KB) -> 413
  const bigJson = JSON.stringify({ voice_text: 'A'.repeat(75 * 1024) });
  const rBig = await request('POST', '/api/hub/ask', {
    headers: { 'Content-Type': 'application/json', 'X-Device-Id': 'SEC_GUEST' },
    body: bigJson
  });
  assert.equal(rBig.status, 413);
});

test('Security 5: Rate limiting actively blocks flood with HTTP 429 + Retry-After', async () => {
  rateLimiter.reset();
  process.env.RATE_LIMIT_ADMIN = '5';
  let saw429 = false;
  for (let i = 0; i < 8; i++) {
    const r = await request('POST', '/api/beacons/update', {
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'wrong' },
      body: '{}'
    });
    if (r.status === 429) {
      saw429 = true;
      assert.ok(r.headers['retry-after']);
      break;
    }
  }
  assert.equal(saw429, true, 'Rate limiter must return 429 when limit exceeded');
  process.env.RATE_LIMIT_ADMIN = '30';
  rateLimiter.reset();
});

test('Security 6: Error responses do NOT leak stack traces or internal file paths', async () => {
  const badJson = await request('POST', '/api/feedback', {
    headers: { 'Content-Type': 'application/json' },
    body: '{broken json'
  });
  assert.equal(badJson.status, 400);
  assert.ok(!badJson.text.includes('C:\\Users'));
  assert.ok(!badJson.text.includes('at IncomingMessage'));
});
