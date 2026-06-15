#!/usr/bin/env node

const TIMEOUT_MS = 30_000;
const DEFAULT_URL = "https://sysadmindoc.github.io/ApocalypseWatch/";

async function smoke(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    console.log(`Smoke testing: ${url}`);

    const htmlRes = await fetch(url, { signal: controller.signal });
    if (!htmlRes.ok) {
      throw new Error(`HTML fetch failed: ${htmlRes.status} ${htmlRes.statusText}`);
    }
    const html = await htmlRes.text();
    if (!html.includes("ApocalypseWatch") && !html.includes("Apocalypse Watch")) {
      throw new Error("HTML does not contain expected app title");
    }
    console.log("  ✓ HTML page loads and contains app title");

    const faviconRes = await fetch(new URL("favicon.svg", url).href, { signal: controller.signal });
    if (!faviconRes.ok) {
      throw new Error(`Favicon fetch failed: ${faviconRes.status}`);
    }
    console.log("  ✓ Favicon accessible");

    const ogRes = await fetch(new URL("og-image.png", url).href, { signal: controller.signal });
    if (!ogRes.ok) {
      console.log("  ⚠ OG image not found (non-blocking)");
    } else {
      console.log("  ✓ OG image accessible");
    }

    console.log("\nSmoke test PASSED");
  } catch (err) {
    if (err.name === "AbortError") {
      console.error(`Smoke test FAILED: timed out after ${TIMEOUT_MS}ms`);
    } else {
      console.error(`Smoke test FAILED: ${err.message}`);
    }
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
}

const url = process.argv[2] || process.env.SMOKE_URL || DEFAULT_URL;
smoke(url);
