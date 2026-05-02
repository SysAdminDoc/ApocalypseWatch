# Changelog

All notable changes to ApocalypseWatch will be documented in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to semantic versioning.

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
