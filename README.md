# ApocalypseWatch

[![Live](https://img.shields.io/badge/live-sysadmindoc.github.io%2FApocalypseWatch-f5c2e7?style=flat-square)](https://sysadmindoc.github.io/ApocalypseWatch/)
[![Version](https://img.shields.io/badge/version-0.1.0-89b4fa?style=flat-square)](https://github.com/SysAdminDoc/ApocalypseWatch)
[![License](https://img.shields.io/badge/license-MIT-94e2d5?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-web-f9e2af?style=flat-square)](#)

**Live site:** https://sysadmindoc.github.io/ApocalypseWatch/

A premium realtime dashboard for monitoring a curated cohort of business jets against a rolling 24-hour baseline. If a meaningful number of those aircraft suddenly take to the skies, the dial moves toward 5.

This is an **independent UI redesign** of [kylemcdonald/ews](https://github.com/kylemcdonald/ews). The data pipeline (Node/Express server, ADS-B Exchange ingestion, FAA cohort importer, snapshot/RSS exporters) is reused unchanged so it stays compatible with Kyle McDonald's original deployment model. The frontend is rewritten from scratch.

## What's different

- **Dark, glass-first design system** — Catppuccin-inspired tokens, glassmorphism cards, accent color that shifts with the emergency level (cyan → teal → amber → orange → crimson)
- **Real radial gauge** — replaces the flat header dial with a 5-segment SVG arc, animated needle, and color-coded ticks
- **Better map** — Natural Earth projection, gradient ocean, faint graticule, glowing aircraft markers with rotation
- **Modern charts** — recharts area chart with 24h / 7d / 30d / 1y range tabs and an expected-baseline reference line
- **Live aircraft list** — sortable callsign / model / altitude / speed
- **Componentized client** — one giant `App.jsx` was split into `components/`, `hooks/`, `lib/`, `styles/` for sane maintenance
- **No background image dependency** — animated CSS-only radial gradient + drifting starfield
- **Reduced motion respected** — `prefers-reduced-motion` disables animations

The backend, scripts, schema, deployment workflows, and demo data path are unchanged from the original.

## Quick start

```bash
npm install
npm run dev
```

The API runs on `http://localhost:3030` and the Vite client on `http://localhost:5173`. With no cohort imported, the dashboard serves synthetic demo data automatically.

## Real cohort setup

```bash
npm run import:faa     # build the FAA-derived business-jet cohort
npm run backfill       # 365-day historical backfill
npm run update:daily   # nightly 1-day refresh
```

The default backfill reads tracked aircraft directly from SQLite — no separate watchlist file required.

## Useful commands

```bash
npm run dev              # API + Vite client (concurrently)
npm run build            # production client bundle
npm run preview          # serve the built client
npm run lint             # ESLint over the client workspace
npm run import:faa       # import FAA cohort
npm run seed:demo        # seed synthetic data
npm run backfill         # 365-day backfill
npm run update:daily     # 1-day refresh
npm run export:snapshot  # static dashboard.json for Pages/R2
npm run rss:update       # update emergency RSS feed
npm run telegram:alert   # post Telegram emergency alert
```

## Project layout

```
ApocalypseWatch/
├── client/              Vite + React 19 dashboard (rewritten)
│   └── src/
│       ├── components/  Hero, EmergencyGauge, GlobalMap, ArchiveChart, AircraftList, AboutCard, StatusBanner
│       ├── hooks/       useDashboard
│       ├── lib/         constants, format
│       └── styles/      theme.css, global.css, components.css
├── server/              Node/Express + better-sqlite3 (unchanged)
├── scripts/             Python ADS-B/FAA ingestion, JS snapshot/RSS/Telegram (unchanged)
├── config/              R2 CORS, watchlist example
├── .github/workflows/   scheduled refresh + Pages deploy
├── schema.sql
└── requirements.txt
```

## API contract

The client consumes a single endpoint:

```
GET /api/dashboard
```

Returns a snapshot:

```jsonc
{
  "mode": "demo" | "live",
  "warning": "...",                  // present in demo / unconfigured mode
  "cohort":   { "trackedCount": ... },
  "current":  { "asOf": "...", "concurrentCount": ..., "baselineMean": ... },
  "signals":  { "composite": { "actualConcurrentCount", "expectedConcurrentCount", "sigmaShift", "emergencyLevel" } },
  "trends":   { "archive": { "v": 1, "t0": "...", "tr": [[1800000, n], ...], "c": [...], "p": [...], "s": [...] } },
  "liveAircraft": [{ "hex", "registration", "label", "lat", "lon", "altitudeFt", "groundSpeedKt", "track", ... }],
  "liveStatus":   { "providerLabel", "latestSampledAt", "lastError", "nextRefreshAt" }
}
```

The client polls every 60 seconds.

## Theming

Emergency level is set on `<html data-emergency="N">`. The `--accent` token re-resolves automatically and ripples through gauge, hero pulse, chart line, map markers, and background fx.

To force a level for design QA:

```js
document.documentElement.dataset.emergency = '5'
```

## Public deployment

Two paths are wired up:

- **GitHub Pages mirror** — Live at https://sysadmindoc.github.io/ApocalypseWatch/. The static client is published by `.github/workflows/deploy-github-pages.yml` and reads the upstream public R2 snapshot directly, so it tracks the same live cohort and refresh cadence as the upstream site without running a parallel pipeline.
- **Self-hosted (Cloudflare model)** — Same as the original: Cloudflare Pages (static client) + R2 (`dashboard.json` snapshot + `data/ews.sqlite`) + GitHub Actions for scheduled refresh. See `.github/workflows/refresh-live-data.yml`, `refresh-daily-history.yml`, `deploy-pages.yml` and the original ews README's "Public deployment" section for credentials and secrets.

## Credits

- Original concept, data pipeline, FAA importer, ADS-B Exchange heatmap parsing, deployment model: **[Kyle McDonald](https://github.com/kylemcdonald/ews)**
- Frontend redesign: **SysAdminDoc**

## License

MIT — see [LICENSE](LICENSE).
