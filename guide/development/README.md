# Build and operate ApocalypseWatch v0.2.1

[Overview](../../README.md) · [User guide](../README.md)

## Local development

Use Node.js 24 or newer. Run package commands from the repository root, where the workspace lockfile lives.

```sh
npm ci
npm run dev
```

The development client listens on localhost:5173 and proxies `/api` to localhost:3030. A new checkout creates `data/ews.sqlite`. With no imported cohort, the server supplies synthetic data and leaves live collection and notifications inactive.

The SQLite dependency includes a native module. If your platform doesn't have a compatible prebuilt binary, install the normal C++ build toolchain and rebuild it. Don't substitute an unrelated binary.

## Production client

```sh
npm test
npm run lint
npm run build
```

The Vite output is `client/dist`. The checked-in production configuration points to the upstream public snapshot. For a self-hosted build, set `VITE_DASHBOARD_URL` to `/api/dashboard` before building, then run `npm start`. Vite's development proxy isn't part of a production bundle.

For that self-hosted configuration without shell-specific environment syntax, run `npm run build:local`, then `npm start`. `npm run build:demo` produces the frontend used by the separate synthetic demonstration.

`PORT` selects the Node server port. Set `HOST=127.0.0.1` to bind it only to loopback during local testing.

Relevant build-time settings:

| Setting | Purpose |
| --- | --- |
| `VITE_DASHBOARD_URL` | JSON snapshot URL. Use `/api/dashboard` for the included Node server. |
| `VITE_BASE_PATH` | Public path prefix, such as `/ApocalypseWatch/` for this project's Pages site. |
| `VITE_SITE_URL` | Absolute site URL ending in `/`, used by social-image metadata. |
| `VITE_RSS_URL` | Optional public RSS URL. With a static snapshot, no RSS link is assumed. |

These values become public browser code. Never put credentials in a `VITE_` value or a public source URL.

The project has no build, test or deployment workflows. Build locally. A prebuilt Pages site can be served from a branch publishing folder with `.nojekyll`; a static site needs a reachable JSON source and cannot run the Node API itself.

The existing Pages deployment has not been refreshed for v0.2.1. The release downloads and current repository are the verified delivery paths.

## Release packages

From a Git checkout with dependencies installed, run `npm run build:branding`, `npm test`, `npm run lint`, then `npm run package`. The command replaces only the repository's `release/` build-output folder. Don't store personal files there.

The demonstration ZIP contains a prebuilt frontend and a dependency-free, loopback-only Node server. It generates synthetic samples without opening SQLite, making provider requests or enabling notification integrations. No `npm install` is needed to run that download. It does not include the real collection backend.

The source ZIP contains the working source and concept archive. It excludes runtime databases, local credentials and installed dependencies. Install its locked dependencies before building. `SHA256SUMS.txt` records both download hashes; these are integrity checks, not a code-signing certificate.

The package command leaves `client/dist` built for the included local API server. The ZIPs are ordinary web/source packages, not signed native installers. Third-party notices are included in the demonstration.

## Data sources

The public snapshot endpoint currently configured in `client/.env.production` is operated by the upstream project. This repository does not operate that feed. It may change its model or become unavailable.

For your own local collection, install the Python requirements and inspect the import scripts before running them:

```sh
python -m pip install -r requirements.txt
npm run import:faa
npm run backfill
npm run update:daily
```

The Python commands in the package scripts use `python3`. If your Windows installation exposes only `python`, run the matching file directly, such as `python scripts/import_faa_cohort.py`.

Import and backfill operations write to the local database. A year's heatmap backfill can be large. Review provider access and usage terms first. `npm run update:api` is a separate compatible-API ingestion path; the primary running-server refresher still uses heatmaps.

Once the database is configured, restarting the server enables refreshes. Preserve your database and any credentials outside source packages. Don't copy a running SQLite database without accounting for its WAL files.

## Notifications and endpoints

Telegram, Discord and ntfy integrations require explicit environment configuration. A running configured server may send alerts following a successful data refresh. None is needed for the synthetic demonstration. Review the corresponding `server/*-alert.js` module before enabling it.

The included Node server exposes:

- `/api/dashboard`, optionally with `range=24h`, `7d`, `30d` or `1y`.
- `/api/stream` for server-sent snapshots. The client requests an initial snapshot and falls back to polling if the stream fails.
- `/api/events` for recorded level changes and `/api/health` for operational status.
- `/rss.xml` and `/feed.xml` for the server's recorded alert feed.

The server sends the latest available snapshot when an event stream connects. It doesn't replay a stored sequence of missed SSE messages. History is a separate endpoint.

Default server headers block framing. Put any public deployment behind an appropriate TLS reverse proxy and review allowed origins, rate limits and provider access. A running browser frontend isn't a substitute for those controls.

## Branding and reproducible assets

The favicon SVG is the source of truth for the app icon. `npm run build:branding` renders it and the share image with the pinned SVG renderer and the included Inter Display font files. Errors stop the command; stale raster files must not pass as a successful export.

The font files retain their own license in `assets/fonts/LICENSE.txt`. The project software remains MIT licensed. Source files and comparison renders are preserved in the concept archive; only the selected assets belong in `client/public`.

## Verification limits

Local synthetic checks don't validate paid provider access, a real FAA backfill, notification delivery or a continuously running collection service. The browser shell can cache its assets, but the public snapshot path has no general offline-data guarantee. Always inspect data age and mode.
