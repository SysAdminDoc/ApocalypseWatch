#!/usr/bin/env python3
"""
Poll Airplanes.Live (or any ADSBx v2-compatible API) for tracked aircraft
and ingest observations into the same SQLite schema as the heatmap path.

Usage:
    python3 scripts/update_latest_from_api.py --db data/ews.sqlite
    python3 scripts/update_latest_from_api.py --api-base https://api.adsb.lol/v2

The script queries one hex at a time at 1 req/sec to respect rate limits.
For large cohorts (>500 aircraft), consider using the heatmap path instead.
"""

import argparse
import datetime as dt
import json
import pathlib
import sqlite3
import sys
import time
import urllib.error
import urllib.request


ROOT_DIR = pathlib.Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
DB_PATH = DATA_DIR / "ews.sqlite"
SCHEMA_PATH = ROOT_DIR / "schema.sql"
SOURCE = "api_v2"
OBSERVATION_RETENTION_HOURS = 72

DEFAULT_API_BASE = "https://api.airplanes.live/v2"
BATCH_SIZE = 100
REQUEST_DELAY = 1.0


def parse_args():
    parser = argparse.ArgumentParser(description="Ingest tracked aircraft from ADSBx v2-compatible API.")
    parser.add_argument("--db", default=str(DB_PATH), help="SQLite database path.")
    parser.add_argument("--api-base", default=DEFAULT_API_BASE, help="API base URL (default: Airplanes.Live)")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and print without writing to DB.")
    return parser.parse_args()


def open_db(path):
    pathlib.Path(path).parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.executescript(SCHEMA_PATH.read_text("utf8"))
    return connection


def load_tracked_hexes(connection):
    rows = connection.execute(
        "SELECT hex FROM tracked_aircraft WHERE source != 'demo' ORDER BY hex ASC"
    ).fetchall()
    return [row["hex"] for row in rows]


def fetch_by_hex(api_base, hex_codes, timeout=30):
    """Fetch aircraft data for a comma-separated list of hex codes."""
    hex_param = ",".join(hex_codes)
    url = f"{api_base}/hex/{hex_param}"
    request = urllib.request.Request(url, headers={
        "User-Agent": "ApocalypseWatch/0.1 (github.com/SysAdminDoc/ApocalypseWatch)",
        "Accept": "application/json",
    })
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = json.loads(response.read())
            return data.get("ac", [])
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code} for {len(hex_codes)} hex codes", file=sys.stderr)
        return []
    except Exception as e:
        print(f"  Error: {e}", file=sys.stderr)
        return []


def ingest_aircraft(connection, aircraft_list, now_iso):
    """Insert observations from v2 API response into the observations table."""
    inserted = 0
    for ac in aircraft_list:
        hex_code = ac.get("hex", "").strip().lower()
        if not hex_code:
            continue

        lat = ac.get("lat")
        lon = ac.get("lon")
        alt = ac.get("alt_baro")
        if isinstance(alt, str):
            alt = 0 if alt == "ground" else None
        speed = ac.get("gs")
        registration = ac.get("r", "")
        is_airborne = 1 if (alt is not None and alt > 0) else 0

        try:
            connection.execute(
                """
                INSERT INTO observations (observed_at, hex, registration, source, lat, lon, altitude_ft, ground_speed_kt, is_airborne)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (now_iso, hex_code, registration, SOURCE, lat, lon, alt, speed, is_airborne),
            )
            inserted += 1
        except sqlite3.IntegrityError:
            pass

    return inserted


def update_live_snapshot(connection, aircraft_list, now_iso):
    """Update the live_snapshot table with current positions."""
    for ac in aircraft_list:
        hex_code = ac.get("hex", "").strip().lower()
        if not hex_code:
            continue

        lat = ac.get("lat")
        lon = ac.get("lon")
        alt = ac.get("alt_baro")
        if isinstance(alt, str):
            alt = 0 if alt == "ground" else None
        speed = ac.get("gs")
        track = ac.get("track")
        registration = ac.get("r", "")
        label = ac.get("flight", "").strip()
        is_airborne = 1 if (alt is not None and alt > 0) else 0

        connection.execute(
            """
            INSERT INTO live_snapshot (hex, registration, label, observed_at, lat, lon, altitude_ft, ground_speed_kt, track, is_airborne, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(hex) DO UPDATE SET
              registration = excluded.registration,
              label = excluded.label,
              observed_at = excluded.observed_at,
              lat = excluded.lat,
              lon = excluded.lon,
              altitude_ft = excluded.altitude_ft,
              ground_speed_kt = excluded.ground_speed_kt,
              track = excluded.track,
              is_airborne = excluded.is_airborne,
              source = excluded.source
            """,
            (hex_code, registration, label, now_iso, lat, lon, alt, speed, track, is_airborne, SOURCE),
        )


def main():
    args = parse_args()
    connection = open_db(args.db)
    tracked = load_tracked_hexes(connection)

    if not tracked:
        print("No tracked aircraft found. Run import:faa first.")
        return

    print(f"Tracked aircraft: {len(tracked)}")
    print(f"API: {args.api_base}")

    now = dt.datetime.now(dt.timezone.utc)
    now_iso = now.isoformat()
    total_seen = 0
    total_airborne = 0
    total_inserted = 0

    batches = [tracked[i:i + BATCH_SIZE] for i in range(0, len(tracked), BATCH_SIZE)]

    for batch_idx, batch in enumerate(batches):
        if batch_idx > 0:
            time.sleep(REQUEST_DELAY)

        aircraft = fetch_by_hex(args.api_base, batch)
        seen = len(aircraft)
        airborne = sum(1 for a in aircraft if a.get("alt_baro") not in (None, "ground", 0))
        total_seen += seen
        total_airborne += airborne

        if not args.dry_run and aircraft:
            total_inserted += ingest_aircraft(connection, aircraft, now_iso)
            update_live_snapshot(connection, aircraft, now_iso)
            connection.commit()

        print(f"  Batch {batch_idx + 1}/{len(batches)}: {seen} seen, {airborne} airborne")

    print(f"\nTotal: {total_seen} aircraft seen, {total_airborne} airborne, {total_inserted} observations inserted")

    if args.dry_run:
        print("(dry run — no data written)")

    connection.close()


if __name__ == "__main__":
    main()
