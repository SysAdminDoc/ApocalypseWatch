# Changelog

All notable changes to ApocalypseWatch will be documented in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to semantic versioning.

## Unreleased

### Added
- GitHub Pages deployment workflow (`.github/workflows/deploy-github-pages.yml`) publishing the static client to `https://sysadmindoc.github.io/ApocalypseWatch/`. The deployed client points `VITE_DASHBOARD_URL` at the upstream public R2 snapshot (`pub-49bb6a6f314c47be9b481c25e5f6ca9e.r2.dev/dashboard.json`) and renders live cohort data refreshed by the upstream pipeline.
- `base` config in `client/vite.config.js` driven by `VITE_BASE_PATH` so the same client builds for both root-served and project-page deployments.

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
