#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { Resvg } = require('@resvg/resvg-js');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'client/public');
const fontDir = path.join(root, 'assets/fonts');
const font = {
  loadSystemFonts: false,
  fontFiles: ['InterDisplay-Regular.ttf', 'InterDisplay-SemiBold.ttf'].map(name => path.join(fontDir, name)),
  defaultFontFamily: 'Inter Display',
};
const { version } = require('../package.json');

function render(svg, width) {
  const renderer = new Resvg(svg, { font, fitTo: { mode: 'width', value: width } });
  const rendered = renderer.render();
  if (rendered.width !== width || !rendered.pixels.some(value => value !== 0)) throw new Error('Empty artwork render');
  return { png: rendered.asPng(), svg: renderer.toString(), width: rendered.width, height: rendered.height };
}

function buildBranding(outputDir = publicDir) {
  const icon = fs.readFileSync(path.join(publicDir, 'favicon.svg'), 'utf8');
  const mark = icon.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').replace(/<title>[\s\S]*?<\/title>/, '');
  const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" fill="none">
    <defs><radialGradient id="wash" cx="85%" cy="45%" r="70%"><stop stop-color="#14344b"/><stop offset="1" stop-color="#0a1320"/></radialGradient></defs>
    <rect width="1200" height="630" fill="url(#wash)"/>
    <path d="M72 64h1056" stroke="#274055"/>
    <g transform="translate(75 96) scale(.72)">${mark}</g>
    <text x="141" y="131" fill="#f4f8fb" font-family="Inter Display" font-size="34" font-weight="600">ApocalypseWatch</text>
    <text x="74" y="239" fill="#f4f8fb" font-family="Inter Display" font-size="66" font-weight="600" letter-spacing="-2">Flight activity.</text>
    <text x="74" y="319" fill="#73d0ed" font-family="Inter Display" font-size="66" font-weight="600" letter-spacing="-2">Evidence in view.</text>
    <text x="77" y="374" fill="#c0cddb" font-family="Inter Display" font-size="23">Explore the snapshot. Inspect the baseline.</text>
    <text x="77" y="408" fill="#c0cddb" font-family="Inter Display" font-size="23">Keep the data source and its limits visible.</text>
    <g transform="translate(852 176) scale(4)">${mark}</g>
    <path d="M76 478h1048" stroke="#274055"/>
    <text x="77" y="526" fill="#9ab1c2" font-family="Inter Display" font-size="18">Experimental activity signal. Not an emergency forecast.</text>
    <text x="77" y="573" fill="#73d0ed" font-family="Inter Display" font-size="18">github.com/SysAdminDoc/ApocalypseWatch</text>
    <text x="1124" y="573" text-anchor="end" fill="#9ab1c2" font-family="Inter Display" font-size="18">v${version}</text>
  </svg>`;
  for (const file of font.fontFiles) if (!fs.existsSync(file)) throw new Error('Missing bundled font: ' + path.basename(file));
  fs.mkdirSync(outputDir, { recursive: true });
  const results = [];
  for (const size of [16, 32, 48, 64, 128, 192, 256, 512, 1024]) {
    const image = render(icon, size);
    fs.writeFileSync(path.join(outputDir, `icon-${size}.png`), image.png);
    results.push({ name: `icon-${size}.png`, width: size, height: image.height, bytes: image.png.length });
  }
  fs.writeFileSync(path.join(outputDir, 'apple-touch-icon.png'), render(icon, 180).png);
  const preview = render(card, 1200);
  if (preview.height !== 630 || preview.png.length < 15000 || /<text\b/.test(preview.svg)) throw new Error('Share-card text did not render completely');
  fs.writeFileSync(path.join(outputDir, 'og-image.svg'), preview.svg);
  fs.writeFileSync(path.join(outputDir, 'og-image.png'), preview.png);
  results.push({ name: 'og-image.png', width: 1200, height: 630, bytes: preview.png.length });
  return results;
}

if (require.main === module) {
  try { console.log(JSON.stringify(buildBranding(), null, 2)); }
  catch (error) { console.error('Branding build failed:', error.message); process.exitCode = 1; }
}
module.exports = { buildBranding, render };
