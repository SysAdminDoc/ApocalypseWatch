#!/usr/bin/env python3
"""
Download ADSB.lol globe_history daily archive and extract heatmap files.

ADSB.lol publishes daily globe_history archives as GitHub releases under
ODbL 1.0 + CC0 dual license. The archives contain readsb-native binary
heatmap files in the same format as ADS-B Exchange globe_history.

Usage:
    python3 scripts/download_adsblol_history.py --date 2026-06-15
    python3 scripts/download_adsblol_history.py --date 2026-06-15 --extract-dir data/cache/adsblol

The extracted heatmap files are compatible with parse_heatmap.py.
"""

import argparse
import json
import os
import pathlib
import sys
import tarfile
import tempfile
import urllib.error
import urllib.request


ROOT_DIR = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_EXTRACT_DIR = ROOT_DIR / "data" / "cache" / "adsblol"

GITHUB_API = "https://api.github.com"
REPO = "adsblol/globe_history_2026"
USER_AGENT = "ApocalypseWatch/0.1 (github.com/SysAdminDoc/ApocalypseWatch)"


def parse_args():
    parser = argparse.ArgumentParser(description="Download ADSB.lol globe_history daily archive.")
    parser.add_argument("--date", required=True, help="Date to download (YYYY-MM-DD)")
    parser.add_argument(
        "--extract-dir",
        default=str(DEFAULT_EXTRACT_DIR),
        help="Directory to extract heatmap files into (default: data/cache/adsblol)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Show what would be downloaded without downloading")
    return parser.parse_args()


def find_release_for_date(date_str):
    """Find the GitHub release matching the given date."""
    url = f"{GITHUB_API}/repos/{REPO}/releases/tags/{date_str}"
    request = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "application/vnd.github+json",
    })
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def find_heatmap_asset(release):
    """Find the heatmap tar.gz asset in a release."""
    for asset in release.get("assets", []):
        name = asset.get("name", "")
        if "heatmap" in name.lower() and name.endswith((".tar.gz", ".tgz")):
            return asset
    for asset in release.get("assets", []):
        name = asset.get("name", "")
        if name.endswith((".tar.gz", ".tgz")):
            return asset
    return None


def download_asset(asset, dest_path):
    """Download a GitHub release asset to a local path."""
    url = asset["browser_download_url"]
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {asset['name']} ({asset['size'] / 1024 / 1024:.1f} MB)...")
    with urllib.request.urlopen(request, timeout=600) as response:
        dest_path.write_bytes(response.read())
    print(f"  saved to {dest_path}")


def extract_heatmap_files(archive_path, extract_dir, date_str):
    """Extract .bin.ttf heatmap files from the archive."""
    extract_dir = pathlib.Path(extract_dir)
    year, month, day = date_str.split("-")
    target_dir = extract_dir / year / month / day
    target_dir.mkdir(parents=True, exist_ok=True)

    extracted = 0
    with tarfile.open(archive_path, "r:gz") as tar:
        for member in tar.getmembers():
            if member.name.endswith(".bin.ttf") and member.isfile():
                basename = pathlib.Path(member.name).name
                dest = target_dir / basename
                source = tar.extractfile(member)
                if source:
                    dest.write_bytes(source.read())
                    extracted += 1

    print(f"  extracted {extracted} heatmap files to {target_dir}")
    return extracted


def main():
    args = parse_args()

    print(f"Looking up ADSB.lol globe_history release for {args.date}...")
    release = find_release_for_date(args.date)
    if not release:
        print(f"No release found for date {args.date}")
        print(f"Check available releases at: https://github.com/{REPO}/releases")
        sys.exit(1)

    print(f"  release: {release['tag_name']} — {release['name']}")
    print(f"  assets: {len(release.get('assets', []))}")

    asset = find_heatmap_asset(release)
    if not asset:
        print("No heatmap archive asset found in this release.")
        print("Available assets:", [a["name"] for a in release.get("assets", [])])
        sys.exit(1)

    print(f"  heatmap asset: {asset['name']} ({asset['size'] / 1024 / 1024:.1f} MB)")

    if args.dry_run:
        print("(dry run — skipping download)")
        return

    with tempfile.TemporaryDirectory() as tmpdir:
        archive_path = pathlib.Path(tmpdir) / asset["name"]
        download_asset(asset, archive_path)
        count = extract_heatmap_files(archive_path, args.extract_dir, args.date)

    if count == 0:
        print("Warning: no heatmap files found in archive")
        sys.exit(1)

    print(f"\nDone. {count} heatmap files ready for parse_heatmap.py in {args.extract_dir}")


if __name__ == "__main__":
    main()
