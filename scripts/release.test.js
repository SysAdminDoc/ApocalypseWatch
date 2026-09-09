const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { sourceAllowed } = require('./package-release');
const { buildBranding } = require('./generate_og_image');

test('source package excludes runtime data, credentials and local working notes', () => {
  for (const name of ['data/ews.sqlite', 'data/ews.sqlite-wal', 'tmp/export.json', '.env', '.env.local', 'client/.env.local', 'config/watchlist.json', 'config/opensky.credentials.json', 'release/test.zip', '.git/config', 'CLAUDE.md', 'node_modules/x/index.js', 'private.pem', '../private.txt', '.github/workflows/build.yml']) assert.equal(sourceAllowed(name), false, name);
  for (const name of ['README.md', 'LICENSE', 'client/.env.production', 'assets/concepts/2026-09-09-marketing/original-source-fbb0ad7.zip', 'server/demo-data.js']) assert.equal(sourceAllowed(name), true, name);
});

test('all native artwork exports reproduce current public assets', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apocalypsewatch-brand-'));
  try {
    buildBranding(dir);
    for (const name of fs.readdirSync(dir)) assert.deepEqual(fs.readFileSync(path.join(dir, name)), fs.readFileSync(path.join(__dirname, '../client/public', name)), name);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('dependency-free demo is read-only, local and synthetic', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apocalypsewatch-demo-'));
  fs.copyFileSync(path.join(__dirname, 'demo-server.cjs'), path.join(dir, 'serve.cjs'));
  fs.copyFileSync(path.join(__dirname, '../server/demo-data.js'), path.join(dir, 'demo-data.cjs'));
  fs.mkdirSync(path.join(dir, 'web')); fs.writeFileSync(path.join(dir, 'web/index.html'), '<title>Test</title>');
  const server = require(path.join(dir, 'serve.cjs')).createDemoServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(url + '/dashboard.json');
    const data = await response.json();
    assert.equal(data.mode, 'demo'); assert.equal(data.cohort.trackedCount, 6);
    assert.equal(data.liveStatus.lastAttemptAt, null); assert.match(data.warning, /No actual flight/);
    assert.equal((await fetch(url + '/')).status, 200);
    assert.equal((await fetch(url + '/dashboard.json', { method: 'POST' })).status, 405);
    const hostStatus = await new Promise((resolve, reject) => {
      http.get(url + '/', { headers: { Host: 'not-local.example' } }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject);
    });
    assert.equal(hostStatus, 403);
    assert.equal((await fetch(url + '/%2e%2e%2fserve.cjs')).status, 404);
    assert.equal((await fetch(url + '/.env')).status, 404);
    assert.deepEqual(fs.readdirSync(dir).sort(), ['demo-data.cjs', 'serve.cjs', 'web']);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(dir, { recursive: true, force: true }); }
});
