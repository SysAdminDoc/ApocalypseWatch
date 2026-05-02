# Task: Review and improve the ApocalypseWatch dashboard

You are a senior frontend engineer + product designer. You have full filesystem access to the project at `~/repos/ApocalypseWatch/`. Read it before acting — do not assume.

## What this project is

ApocalypseWatch is an independent UI redesign of https://github.com/kylemcdonald/ews (live at https://ews.kylemcdonald.net/). It tracks a curated FAA-derived cohort of business jets against a rolling 24-hour baseline. If a meaningful number of those aircraft suddenly take to the skies, an emergency dial moves toward 5 (the premise: people with private-jet access tend to leave city centers fast in a crisis).

The original repo's data pipeline (Node/Express + better-sqlite3 server, Python ADS-B Exchange ingestion, FAA cohort importer, snapshot/RSS/Telegram exporters, Cloudflare Pages + R2 + GitHub Actions deployment) is reused **unchanged**. Only the React client at `client/` was rewritten.

## Current state — read these to ground yourself

- `README.md` — project overview, build commands, API contract
- `CLAUDE.md` — architecture notes, key paths, gotchas, version history
- `CHANGELOG.md` — what shipped in v0.1.0 (2026-05-02)
- `client/src/App.jsx` — composition root, polling loop, emergency-level routing
- `client/src/components/` — Hero, EmergencyGauge, GlobalMap, ArchiveChart, AircraftList, AboutCard, StatusBanner
- `client/src/hooks/useDashboard.js` — `/api/dashboard` poller (60s)
- `client/src/lib/` — constants, format helpers
- `client/src/styles/{theme,global,components}.css` — Catppuccin-derived dark glassmorphism, emergency-level accent ramp (cyan → teal → amber → orange → crimson), animated CSS-only background
- `server/` and `scripts/` — **do not modify, do not refactor**. Treat as black-box upstream.

The current production build is **green at 682 kB / 217 kB gzipped, zero console errors**, with demo mode rendering all panels (Hero, gauge, world map with 6 demo aircraft, recharts area chart, aircraft list, about card).

## Your job — three passes, in order

### Pass 1: Critical review (write to `REVIEW.md` at the repo root)

Read the actual code and produce a concrete review covering:

- **Visual/UX**: hierarchy, spacing rhythm, typography pairings, color contrast (WCAG AA at minimum, AAA where reasonable), motion polish, empty/error/loading states, mobile (320–768px) and ultra-wide (1920+) behavior, dark→light theme parity. Compare against high-bar reference dashboards: Linear, Vercel Observability, Stripe Atlas, Tailscale admin, Cloudflare Analytics. Be specific — name the file and the rule that needs to change.
- **Code quality**: component boundaries, prop shapes, dead code, accessibility (aria, focus management, keyboard nav, semantic landmarks), data-fetching robustness (no AbortController on `useDashboard`, no exponential backoff on errors, no retry budget), `prefers-reduced-motion` coverage.
- **Performance**: 217 kB gzipped is heavy for a single-page dashboard — diagnose and propose route-splitting / dynamic import for `GlobalMap` (d3-geo + topojson + world-atlas) and `ArchiveChart` (recharts). Target **<100 kB gzipped initial bundle**. Flag any obvious re-render hotspots.
- **Robustness**: what happens with `liveStatus.lastError`, with stale `latestSampledAt`, with `archive.v !== 1`, with malformed `lat`/`lon`, with the Telegram channel offline? Trace each path and note gaps.

Format the review as a punch list grouped by area, each entry with: severity (P0/P1/P2), file:line, problem, proposed fix. No prose paragraphs — just the list.

### Pass 2: Implement the fixes (P0 + P1 only)

Apply the P0/P1 items from your own review directly to the code. Constraints:

- **Preserve the API contract.** The client reads only `/api/dashboard`. Do not add backend endpoints. Do not change any field names — `lat`, `lon`, `altitudeFt`, `groundSpeedKt`, `track`, `hex`, `registration`, `label` are fixed by upstream.
- **Preserve the archive RLE shape** `{v: 1, t0: ISO, tr: [[deltaMs, count], ...], c: [...], p: [...], s: [...]}`.
- **Preserve the emergency-level accent system** — components must continue to read `var(--accent)` / `var(--accent-glow)`, never hardcode level colors.
- **Preserve `prefers-reduced-motion`** semantics.
- **Surgical edits only.** No drive-by refactors of unrelated files. No new dependencies unless the size budget is unaffected (justify in a one-liner if you do add one).
- After every logical change: `npm run build` must stay green. The dashboard must continue to render demo mode end-to-end with zero console errors.

### Pass 3: Propose net-new capabilities (write to `ROADMAP.md` at the repo root)

Suggest 8–15 features that would meaningfully push this dashboard beyond the current baseline. Each entry must include:

- One-sentence description
- Why it matters (user value, not engineering ego)
- Rough effort (S/M/L)
- API/server changes required (vs. client-only) — mark client-only items as preferable since the backend is frozen
- Any risk / dependency concerns

Lean toward additions that **cannot be done by reading the existing site**. Examples to seed your thinking, not to copy verbatim:
- Per-region sigma heatmap (which countries drove the spike?)
- Aircraft trail playback for the last N hours
- Audio cue + browser notification at level transitions (opt-in)
- Anomaly explainer drawer (which specific tail numbers tipped the dial?)
- WebGL globe variant (MapLibre + Globe view)
- Sparklines per aircraft tail in the live list
- Historical compare slider (today vs. same hour last week / last year)
- Public embed mode (`?embed=gauge&size=sm`)
- Keyboard command palette
- Light theme polish + system-preference auto-switch
- Locale + tz toggle for international viewers
- Stress-test mode (force level 5 for design QA)

Push past these — find ones I haven't thought of.

## Deliverables

1. `REVIEW.md` — punch list (Pass 1)
2. Code changes implementing P0 + P1 items (Pass 2), committed as logical commits with good "why" messages
3. `ROADMAP.md` — net-new feature backlog (Pass 3)
4. End-of-session report:
   - What you changed and why (top 5)
   - Bundle size before/after (run `npm run build` and quote the numbers)
   - Anything you could not safely fix and why

## Hard constraints

- **No** changes to `server/`, `scripts/`, `config/`, `schema.sql`, `requirements.txt`, root `package.json` server dependencies, or `.github/workflows/`.
- **No** AI-attribution anywhere — no `Co-Authored-By`, no "generated by Codex" lines, no AI mentions in commit messages, READMEs, or comments.
- **No** new tests unless explicitly justified — this project doesn't have a test harness yet, and adding one is its own task.
- **No** screenshots or marketing copy changes — focus is engineering and design polish.
- If you encounter a blocker (missing credential, ambiguous requirement, mutually exclusive design fork), stop and write the question to `BLOCKERS.md`. Do not guess.

Begin with Pass 1.
