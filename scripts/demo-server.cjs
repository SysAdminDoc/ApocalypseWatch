const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { getDemoDashboard } = require('./demo-data.cjs');
const root = path.join(__dirname, 'web');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

function createDemoServer() {
  return http.createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    const host = req.headers.host || '';
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) { res.writeHead(403); res.end('Local requests only.'); return; }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end('Read-only demonstration.'); return; }
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname === '/dashboard.json') {
        const snapshot = getDemoDashboard();
        snapshot.warning = 'Synthetic demonstration. No actual flight data is collected.';
        res.setHeader('Content-Type', 'application/json');
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify(snapshot));
        return;
      }
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root + path.sep) || pathname.split('/').some(x => x.startsWith('.')) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404); res.end('File not found.'); return;
      }
      res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
      if (req.method === 'HEAD') res.end();
      else fs.createReadStream(file).on('error', error => { console.error(error.message); res.destroy(error); }).pipe(res);
    } catch (error) { console.error(error.message); res.writeHead(400); res.end('Invalid request.'); }
  });
}

if (require.main === module) {
  const port = process.env.PORT === undefined ? 3030 : Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535) { console.error('PORT must be a number from 0 to 65535.'); process.exitCode = 1; }
  else {
    const server = createDemoServer();
    server.on('error', error => { console.error(`Cannot start demonstration: ${error.message}`); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => console.log(`ApocalypseWatch synthetic demonstration: http://127.0.0.1:${server.address().port}/`));
  }
}
module.exports = { createDemoServer };
