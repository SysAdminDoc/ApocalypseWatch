#!/usr/bin/env python3
"""Audit rolling_metrics for missing half-hour slots over the last N days."""

import argparse
import os
import sqlite3
import sys
from datetime import datetime, timedelta, timezone

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "ews.sqlite")
SLOT_INTERVAL = timedelta(minutes=30)


def parse_args():
    parser = argparse.ArgumentParser(description="Audit heatmap data coverage")
    parser.add_argument("--db", default=DB_PATH, help="Path to SQLite database")
    parser.add_argument("--days", type=int, default=30, help="Number of days to audit (default: 30)")
    return parser.parse_args()


def audit_coverage(db_path, days):
    if not os.path.exists(db_path):
        print(f"Database not found: {db_path}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)

    cursor.execute(
        "SELECT sampled_at FROM rolling_metrics WHERE sampled_at >= ? ORDER BY sampled_at ASC",
        (start.isoformat(),),
    )
    rows = cursor.fetchall()
    conn.close()

    existing = set()
    for (sampled_at,) in rows:
        try:
            dt = datetime.fromisoformat(sampled_at.replace("Z", "+00:00"))
            slot = dt.replace(minute=(dt.minute // 30) * 30, second=0, microsecond=0)
            existing.add(slot)
        except (ValueError, AttributeError):
            pass

    expected_slots = []
    slot = start.replace(minute=(start.minute // 30) * 30, second=0, microsecond=0)
    while slot <= now:
        expected_slots.append(slot)
        slot += SLOT_INTERVAL

    missing = [s for s in expected_slots if s not in existing]
    total = len(expected_slots)
    present = total - len(missing)

    print(f"Coverage audit: {days} days ({start.strftime('%Y-%m-%d')} to {now.strftime('%Y-%m-%d')})")
    print(f"  Expected slots: {total}")
    print(f"  Present:        {present}")
    print(f"  Missing:        {len(missing)}")
    if total > 0:
        print(f"  Coverage:       {present / total * 100:.1f}%")

    if missing:
        print(f"\nMissing slots ({len(missing)}):")
        gap_start = missing[0]
        gap_end = missing[0]
        for m in missing[1:]:
            if m - gap_end <= SLOT_INTERVAL:
                gap_end = m
            else:
                if gap_start == gap_end:
                    print(f"  {gap_start.strftime('%Y-%m-%d %H:%M')} UTC")
                else:
                    count = int((gap_end - gap_start) / SLOT_INTERVAL) + 1
                    print(f"  {gap_start.strftime('%Y-%m-%d %H:%M')} — {gap_end.strftime('%Y-%m-%d %H:%M')} UTC ({count} slots)")
                gap_start = m
                gap_end = m
        if gap_start == gap_end:
            print(f"  {gap_start.strftime('%Y-%m-%d %H:%M')} UTC")
        else:
            count = int((gap_end - gap_start) / SLOT_INTERVAL) + 1
            print(f"  {gap_start.strftime('%Y-%m-%d %H:%M')} — {gap_end.strftime('%Y-%m-%d %H:%M')} UTC ({count} slots)")
    else:
        print("\nNo gaps found — full coverage.")

    return 0 if not missing else 1


if __name__ == "__main__":
    args = parse_args()
    sys.exit(audit_coverage(args.db, args.days))
