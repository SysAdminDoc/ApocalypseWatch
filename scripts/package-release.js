const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { zipSync } = require('fflate');
const { buildClient } = require('./build-client');
const root = path.resolve(__dirname, '..');
const { version } = require('../package.json');
const output = path.join(root, 'release');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

function sourceAllowed(name) {
  return !/(^|\/)(node_modules|data|tmp|release|\.git|\.claude|\.codex|\.github\/workflows)(\/|$)/i.test(name)
    && !/(^|\/)(CLAUDE\.md|CODEX_CHANGELOG\.md|AGENTS\.md|watchlist\.json|opensky\.credentials\.json)$/i.test(name)
    && !/(^|\/)\.env($|\.)/.test(name.replace('client/.env.production', 'public-build-config'))
    && !/\.(pem|key|keystore|sqlite|sqlite-wal|sqlite-shm|log)$/i.test(name)
    && !name.split('/').some(part => part === '..') && !path.isAbsolute(name);
}

function filesIn(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.isSymbolicLink()) throw new Error(`Symlink not packaged: ${entry.name}`);
    const name = prefix + entry.name;
    return entry.isDirectory() ? filesIn(path.join(dir, entry.name), name + '/') : [name];
  });
}

function makeZip(name, dir, names = filesIn(dir)) {
  const entries = {};
  const records = [];
  for (const file of [...new Set(names)].sort()) {
    const local = path.join(dir, file);
    if (fs.lstatSync(local).isSymbolicLink()) throw new Error(`Symlink not packaged: ${file}`);
    const bytes = fs.readFileSync(local);
    entries[file] = [bytes, { mtime: new Date('2026-01-01T00:00:00Z') }];
    records.push({ path: file, bytes: bytes.length, sha256: sha(bytes) });
  }
  const bytes = zipSync(entries, { level: 9 });
  fs.writeFileSync(path.join(output, name), bytes);
  return { name, bytes: bytes.length, sha256: sha(bytes), files: records };
}

function collectLicenses() {
  const modules = path.join(root, 'node_modules');
  const packages = [];
  for (const entry of fs.readdirSync(modules)) {
    if (entry.startsWith('.')) continue;
    if (entry.startsWith('@')) for (const child of fs.readdirSync(path.join(modules, entry))) packages.push(entry + '/' + child);
    else packages.push(entry);
  }
  return packages.sort().flatMap(name => {
    const dir = path.join(modules, name);
    if (!fs.statSync(dir).isDirectory() || fs.lstatSync(dir).isSymbolicLink()) return [];
    const manifest = path.join(dir, 'package.json');
    if (!fs.existsSync(manifest)) return [];
    const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    const licenses = fs.readdirSync(dir).filter(file => /^(LICENSE|LICENCE|COPYING|NOTICE)(\.|$)/i.test(file) && fs.statSync(path.join(dir, file)).isFile());
    if (!licenses.length) return [];
    return [`${pkg.name} ${pkg.version}\n${licenses.map(file => fs.readFileSync(path.join(dir, file), 'utf8')).join('\n')}\n`];
  }).join('\n');
}

function packageRelease() {
  if (require('../client/package.json').version !== version) throw new Error('Workspace versions differ');
  // Delete only this repository's known build-output directory, never a computed parent.
  if (path.dirname(output) !== root || path.basename(output) !== 'release') throw new Error('Unsafe output path');
  if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) throw new Error('Output cannot be a symlink');
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output);
  const demo = path.join(output, 'demo'); fs.mkdirSync(demo);
  buildClient('demo');
  fs.cpSync(path.join(root, 'client/dist'), path.join(demo, 'web'), { recursive: true });
  for (const [src, dst] of [['scripts/demo-server.cjs','serve.cjs'], ['server/demo-data.js','demo-data.cjs'], ['scripts/demo-README.txt','README.txt'], ['LICENSE','LICENSE'], ['NOTICE','NOTICE']]) fs.copyFileSync(path.join(root, src), path.join(demo, dst));
  fs.writeFileSync(path.join(demo, 'THIRD_PARTY_LICENSES.txt'), collectLicenses());
  fs.cpSync(path.join(root, 'assets/fonts/LICENSE.txt'), path.join(demo, 'Inter-LICENSE.txt'));
  const demoRecord = makeZip(`ApocalypseWatch-v${version}-demo.zip`, demo);
  const listing = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (listing.status !== 0) throw new Error('A Git checkout is required for the source package');
  const names = listing.stdout.split('\0').filter(Boolean).filter(sourceAllowed).filter(name => fs.existsSync(path.join(root, name)));
  const sourceRecord = makeZip(`ApocalypseWatch-v${version}-source.zip`, root, names);
  fs.writeFileSync(path.join(output, 'SHA256SUMS.txt'), [demoRecord, sourceRecord].map(record => `${record.sha256}  ${record.name}\n`).join(''));
  fs.writeFileSync(path.join(output, 'package-manifest.json'), JSON.stringify({ version, packages: [demoRecord, sourceRecord] }, null, 2) + '\n');
  // Leave the normal reloadable production output ready for the included API server.
  buildClient('local');
  console.log(JSON.stringify({ version, packages: [demoRecord, sourceRecord].map(({ files, ...record }) => ({ ...record, fileCount: files.length })) }, null, 2));
}
if (require.main === module) {
  try { packageRelease(); } catch (error) { console.error(error); process.exitCode = 1; }
}
module.exports = { sourceAllowed, makeZip, collectLicenses };
