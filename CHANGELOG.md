# Changelog

All notable changes to ApocalypseWatch will be documented in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to semantic versioning.

## Unreleased

### Fixed
- OG image meta tags use absolute URLs via `VITE_SITE_URL` env var for correct social preview rendering on GitHub Pages
- SSE `/api/stream` endpoint adds `X-Accel-Buffering: no` header and `retry: 5000` field for proxy compatibility (Nginx, Cloudflare)
- SSE connections capped at 200 (configurable via `MAX_SSE_CLIENTS`); excess connections get 503 with `Retry-After` header
- Unit tests for sigma calculation, emergency level, gauge, RLE encoder, and archive compaction (`npm test` — 26 tests via Node.js built-in test runner)
- Chart `aria-label` auto-generated summary with range, min, max, and latest values for screen readers
- Discord webhook URL validated against expected `discord.com/api/webhooks/` pattern; malformed URLs log a warning and disable alerts
- Recharts `responsive` prop replaces `ResponsiveContainer` wrapper for cleaner resize behavior
- ADSB.lol globe_history download script: `python3 scripts/download_adsblol_history.py --date YYYY-MM-DD` fetches daily heatmap archives (ODbL licensed, same binary format as ADSBx) as secondary data source
- SVG severity pattern definitions (horizontal lines, dots, diagonal, crosshatch) for color-blind-safe level encoding alongside hue (WCAG 2.2 SC 1.4.1)

### Added
- Public evidence packet card with current dial, data age, archive validation, UTC/local timestamps, source links, JSON download, and plain-text clipboard export
- 365-day data coverage calendar with daily complete, partial, missing, delayed, and malformed archive states plus slot-level coverage totals
- GitHub Pages deployment workflow (`.github/workflows/deploy-github-pages.yml`) publishing the static client to `https://sysadmindoc.github.io/ApocalypseWatch/`. The deployed client points `VITE_DASHBOARD_URL` at the upstream public R2 snapshot (`pub-49bb6a6f314c47be9b481c25e5f6ca9e.r2.dev/dashboard.json`) and renders live cohort data refreshed by the upstream pipeline.
- `base` config in `client/vite.config.js` driven by `VITE_BASE_PATH` so the same client builds for both root-served and project-page deployments.
- Open Graph and Twitter Card meta tags for rich social sharing previews
- PWA raster icons (192×192, 512×512 PNG) and `apple-touch-icon` for home screen install; `start_url` set from `VITE_BASE_PATH` for GitHub Pages compatibility
- SSE event `id:` field for Last-Event-ID reconnection recovery
- Shareable URLs via `?range=` query param synced to the chart time-range tab
- High-contrast (`prefers-contrast: more`) and forced-colors (`forced-colors: active`) CSS support
- `npm audit --audit-level=high` gate in GitHub Pages CI workflow
- Level transition log: `level_transitions` table in SQLite, `/api/events` endpoint, and `LevelHistory` client component showing when emergency levels changed
- Accessible chart data table toggle: "Table" button on the chart header reveals a tabular view of the data for screen readers
- Server-side archive date filtering: `GET /api/dashboard?range=24h` returns only the requested time slice
- Data coverage audit script: `python3 scripts/audit_recent_history_coverage.py` reports missing half-hour slots
- Dependabot configuration for npm, GitHub Actions, and pip dependency updates
- Database schema migration system: numbered SQL files in `migrations/`, tracked in `schema_migrations` table, run automatically on startup
- Deployment bundle verification (`scripts/verify_dashboard_bundle.js`) and post-deploy smoke test (`scripts/smoke_live_site.js`) in CI
- Event annotations on archive chart: level transitions appear as dashed vertical lines with level labels
- Dashboard state export button: downloads a JSON evidence packet with current emergency level, signal data, and source attribution
- Airplanes.Live fallback data source: `scripts/update_latest_from_api.py` polls any ADSBx v2-compatible API (Airplanes.Live, ADSB.lol, ADS-B One, adsb.fi) as alternative to ADS-B Exchange heatmaps. Run via `npm run update:api`
- Healthchecks.io dead-man's-switch: CI refresh workflows ping `HEALTHCHECK_PING_URL` secret on success (configure via repository secrets)
- Embeddable status widget: append `?embed` to the dashboard URL for a compact emergency-level badge suitable for iframing
- Signal provenance drawer: collapsible "Signal calculation" panel below the gauge showing all inputs to the emergency level computation

## v0.1.0 — 2026-05-02

Initial public release. Independent ground-up frontend redesign of [kylemcdonald/ews](https://github.com/kylemcdonald/ews). Backend, ADS-B Exchange ingestion pipeline, FAA cohort importer, snapshot/RSS exporters, and GitHub Actions workflows are reused unchanged.

### Added
- Dark glassmorphism design system (`theme.css`, `global.css`, `components.css`) with Catppuccin-derived tokens and an emergency-level-driven accent ramp (cyan → teal → amber → orange → crimson)
- `Hero` panel with animated airplane visual, eyebrow pulse, gradient title, and credit row
- `EmergencyGauge` — 5-segment SVG radial gauge with animated needle, tick numerals, and per-segment color
- `GlobalMap` — Natural Earth projection (d3-geo + topojson + world-atlas), gradient ocean, faint graticule, glowing rotated aircraft markers with hover tooltips
- `ArchiveChart` — recharts AreaChart with 24h / 7d / 30d / 1y range tabs and a baseline reference line; correctly decodes the RLE archive shape (`{v, t0, tr, c, p, s}`)
- `AircraftList` — sortable cohort live-aircraft table (callsign, model, altitude, speed)
- `AboutCard` with collapsible technical detail
- `StatusBanner` for demo / configuration / refresh-error notices
- `useDashboard` hook polling `/api/dashboard` every 60s
- Animated CSS-only background (radial gradients + drifting starfield) replacing the original cartoon-tile wallpaper
- `prefers-reduced-motion` honored across animations

### Notes
- Default state is **demo mode** with synthetic data — useful for development and design QA without needing a real cohort
- Production build emits a single chunk warning (~680 kB pre-gzip, ~217 kB gzipped) due to the bundled map + chart stack — same trade-off as the original

## Roadmap archive — 2026-08-10 — ROADMAP.md

<details>
<summary>Original roadmap snapshot</summary>

```markdown
# ApocalypseWatch Feature Backlog

| Feature | Description | Why it matters | Effort | API/server changes required | Risks / dependencies |
| --- | --- | --- | --- | --- | --- |
| Data gap calendar | Show a 365-day miniature coverage grid for missing, delayed, or malformed half-hour samples. | Long-term readers can distinguish real calm periods from blind spots in the feed. | M | Client-only if archive timestamps remain enough to infer gaps. | RLE decode must stay cheap and avoid chart-bundle regressions. |
| Public evidence packet | Generate a shareable current-state packet with dial value, data age, key counts, archive validation, and source links. | Analysts and journalists can cite the state of the dashboard without copying raw UI text by hand. | M | Client-only for JSON/text export; server change only if hosted permalink storage is needed. | Must avoid screenshots and ensure timestamps/timezones are explicit. |
| Sensitivity sandbox | Let users preview how the current and historical archive would score under alternate sigma thresholds without changing production behavior. | Makes the model's assumptions transparent and helps calibrate false-positive concerns. | M | Client-only, preferable; uses existing archive and signal fields. | Could confuse users if sandbox state looks like the live emergency level. |

## Research-Driven Additions (June 15 2026)

### P3 — Under consideration

- [ ] P3 — Dynamic OG image generation
  Why: Static OG images show a fixed preview regardless of current emergency level. A dynamically generated OG image (updated on each snapshot export) showing the current level, count, and timestamp would make social shares immediately informative.
  Evidence: Vercel OG (Satori-based edge rendering), Puppeteer screenshot approaches. ShadowBroker and RADAR both generate preview images.
  Touches: Rewrite `scripts/generate_og_image.js` to use Satori + @resvg/resvg-js (~50ms, no Puppeteer). `.github/workflows/refresh-live-data.yml` (regenerate after snapshot export). `client/public/og-image.png` (overwritten each cycle)
  Acceptance: Sharing the dashboard URL on social media shows the current emergency level and timestamp in the preview card
  Complexity: M
```

</details>
