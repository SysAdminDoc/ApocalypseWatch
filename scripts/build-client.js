const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

function buildClient(mode = 'local') {
  if (!['local', 'demo'].includes(mode)) throw new Error('Choose local or demo');
  const env = { ...process.env, VITE_BASE_PATH: '/', VITE_SITE_URL: 'http://localhost:3030/', VITE_RSS_URL: '' };
  env.VITE_DASHBOARD_URL = mode === 'local' ? '/api/dashboard' : './dashboard.json';
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build'], {
    cwd: path.join(root, 'client'), env, stdio: 'inherit', windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${mode} client build failed`);
}

if (require.main === module) {
  try { buildClient(process.argv[2]); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { buildClient };
