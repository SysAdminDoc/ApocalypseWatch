#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const DIST_DIR = path.resolve(__dirname, "..", "client", "dist");

function verify() {
  const errors = [];

  if (!fs.existsSync(DIST_DIR)) {
    console.error(`dist directory not found: ${DIST_DIR}`);
    process.exit(1);
  }

  const indexHtml = path.join(DIST_DIR, "index.html");
  if (!fs.existsSync(indexHtml)) {
    errors.push("index.html not found in dist");
  } else {
    const html = fs.readFileSync(indexHtml, "utf8");
    if (!html.includes('type="module"')) {
      errors.push("index.html missing module script tag");
    }
    if (!html.includes("og:title")) {
      errors.push("index.html missing Open Graph tags");
    }
  }

  const swPath = path.join(DIST_DIR, "sw.js");
  if (!fs.existsSync(swPath)) {
    errors.push("Service worker (sw.js) not found");
  }

  const assets = fs.readdirSync(path.join(DIST_DIR, "assets"));
  const hasJs = assets.some((f) => f.endsWith(".js"));
  const hasCss = assets.some((f) => f.endsWith(".css"));
  if (!hasJs) errors.push("No JS bundles in dist/assets");
  if (!hasCss) errors.push("No CSS bundles in dist/assets");

  const ogImage = path.join(DIST_DIR, "og-image.png");
  if (!fs.existsSync(ogImage)) {
    errors.push("og-image.png not found in dist");
  }

  const favicon = path.join(DIST_DIR, "favicon.svg");
  if (!fs.existsSync(favicon)) {
    errors.push("favicon.svg not found in dist");
  }

  if (errors.length > 0) {
    console.error("Bundle verification FAILED:");
    errors.forEach((e) => console.error(`  ✗ ${e}`));
    process.exit(1);
  }

  console.log("Bundle verification passed:");
  console.log(`  ✓ index.html with module scripts and OG tags`);
  console.log(`  ✓ Service worker present`);
  console.log(`  ✓ JS and CSS bundles in assets/`);
  console.log(`  ✓ OG image and favicon present`);
}

verify();
