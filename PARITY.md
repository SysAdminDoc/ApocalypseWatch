# Upstream Functional Parity

Reference source: https://github.com/kylemcdonald/ews

Reference commit audited: `d9d5d56`

## Result

ApocalypseWatch preserves the original data pipeline. The React client is redesigned, but the aircraft cohort, ADS-B ingestion, history generation, snapshot export, RSS export, Telegram alert path, SQLite schema, server dashboard contract, and GitHub Actions refresh/deploy workflows match upstream.

## Verified Matches

These paths were compared against the upstream reference and match byte-for-byte:

- `.github/`
- `config/`
- `server/`
- `schema.sql`
- `requirements.txt`
- `scripts/backfill_history.py`
- `scripts/evaluate_prediction_models.js`
- `scripts/evaluate_recent_model_error.js`
- `scripts/export_dashboard_snapshot.js`
- `scripts/import_faa_cohort.py`
- `scripts/parse_heatmap.py`
- `scripts/seed_demo_data.py`
- `scripts/send_telegram_alert.js`
- `scripts/update_latest_heatmap.py`
- `scripts/update_rss_feed.js`

## Data Source Behavior

- Local development reads the unchanged Express API at `/api/dashboard`.
- Production reads the original public R2 dashboard snapshot:
  `https://pub-49bb6a6f314c47be9b481c25e5f6ca9e.r2.dev/dashboard.json`
- The unchanged refresh workflows publish `dashboard.json` to the R2 public bucket, not to the Cloudflare Pages static bundle. The production client must therefore use the R2 URL unless the deployment adds an equivalent same-origin route.
- The live update path is unchanged: restore `data/ews.sqlite` from R2, run the ADS-B Exchange heatmap updater, export `tmp/dashboard.json`, send Telegram/RSS updates, persist SQLite back to R2, then publish the dashboard snapshot to the public R2 bucket.

## Production Requirements

To pull live plane data with the same behavior as upstream, the deployment needs equivalent workflow access:

- Cloudflare secrets: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`
- R2 buckets: `ews-state` for SQLite state, `ews-public` for `dashboard.json` and `rss.xml`
- Optional Telegram secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_CHANNEL`
- ADS-B Exchange source availability for the heatmap URLs used by `scripts/update_latest_heatmap.py` and historical backfill URLs used by `scripts/backfill_history.py`

## Expected Differences

- `client/` is intentionally different because it is the redesigned React dashboard.
- Root package metadata differs for the ApocalypseWatch project name and description.
- Client package metadata differs for the redesign dependencies and version.
- Local `data/ews.sqlite` is gitignored runtime state. Dataset parity in a real deployment depends on running the same import, backfill, and refresh commands with equivalent ADS-B Exchange access and Cloudflare R2 secrets.

## Verification Commands

```powershell
npm run lint
npm run build
npm run export:snapshot -- --output tmp/parity-dashboard.json
python -m py_compile scripts/import_faa_cohort.py scripts/update_latest_heatmap.py scripts/backfill_history.py scripts/parse_heatmap.py scripts/seed_demo_data.py
```
