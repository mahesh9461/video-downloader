#!/usr/bin/env python3
"""
Live Smoke Test Script for SaveIt Video Downloader
Usage:
    python scripts/smoke_test.py [--api-url http://127.0.0.1:8000]
"""

import sys
import json
import argparse
import httpx

TEST_YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
TEST_TIKTOK_URL = "https://www.tiktok.com/@tiktok/video/7106594312292453678"
TEST_INSTAGRAM_URL = "https://www.instagram.com/reel/C3bXYZ123/"


def run_smoke_tests(base_url: str):
    base_url = base_url.rstrip("/")
    print(f"=== Starting Live Smoke Tests against {base_url} ===")

    with httpx.Client(timeout=30.0) as client:
        # Step 1: Health Check
        print("\n[Step 1] GET /health & GET /")
        try:
            r_root = client.get(f"{base_url}/")
            r_health = client.get(f"{base_url}/health")
            if r_root.status_code == 200 and r_health.status_code == 200:
                print(f"  PASS: / => {r_root.json()}, /health => {r_health.json()}")
            else:
                print(f"  FAIL: / => {r_root.status_code}, /health => {r_health.status_code}")
        except Exception as e:
            print(f"  FAIL: Could not connect to API server: {e}")
            return

        # Step 2: YouTube Metadata
        print(f"\n[Step 2] POST /api/metadata (YouTube: {TEST_YOUTUBE_URL})")
        yt_meta = None
        try:
            r = client.post(f"{base_url}/api/metadata", json={"url": TEST_YOUTUBE_URL})
            if r.status_code == 200:
                yt_meta = r.json()
                print(f"  PASS: Retrieved title: '{yt_meta.get('title')}'")
                print(f"        downloads_available: {yt_meta.get('downloads_available')}")
                print(f"        formats count: {len(yt_meta.get('formats', []))}")
                if yt_meta.get("notice"):
                    print(f"        notice: {yt_meta.get('notice')}")
            else:
                print(f"  FAIL: HTTP {r.status_code}: {r.text[:200]}")
        except Exception as e:
            print(f"  FAIL: {e}")

        # Step 3: TikTok Metadata
        print(f"\n[Step 3] POST /api/metadata (TikTok: {TEST_TIKTOK_URL})")
        tiktok_meta = None
        try:
            r = client.post(f"{base_url}/api/metadata", json={"url": TEST_TIKTOK_URL})
            if r.status_code == 200:
                tiktok_meta = r.json()
                print(f"  PASS: Retrieved title: '{tiktok_meta.get('title')}'")
                print(f"        formats count: {len(tiktok_meta.get('formats', []))}")
            else:
                print(f"  FAIL: HTTP {r.status_code}: {r.text[:200]}")
        except Exception as e:
            print(f"  FAIL: {e}")

        # Step 4: YouTube Download (if formats available)
        print("\n[Step 4] POST /api/download (YouTube)")
        if yt_meta and yt_meta.get("formats"):
            format_id = yt_meta["formats"][0]["format_id"]
            try:
                with client.stream("POST", f"{base_url}/api/download", json={"url": TEST_YOUTUBE_URL, "format_id": format_id}) as stream:
                    last_event = None
                    for line in stream.iter_lines():
                        if line.startswith("data: "):
                            last_event = json.loads(line[6:])
                    if last_event and last_event.get("status") == "complete":
                        print(f"  PASS: YouTube download complete => {last_event.get('filename')}")
                    else:
                        print(f"  FAIL: Final event: {last_event}")
            except Exception as e:
                print(f"  FAIL: {e}")
        else:
            print("  SKIP/INFO: YouTube formats unavailable (Preview/oEmbed active due to datacenter IP restriction).")

        # Step 5: TikTok Download
        print("\n[Step 5] POST /api/download (TikTok)")
        if tiktok_meta and tiktok_meta.get("formats"):
            format_id = tiktok_meta["formats"][0]["format_id"]
            try:
                with client.stream("POST", f"{base_url}/api/download", json={"url": TEST_TIKTOK_URL, "format_id": format_id}) as stream:
                    last_event = None
                    for line in stream.iter_lines():
                        if line.startswith("data: "):
                            last_event = json.loads(line[6:])
                    if last_event and last_event.get("status") == "complete":
                        print(f"  PASS: TikTok download complete => {last_event.get('filename')}")
                    else:
                        print(f"  FAIL: Final event: {last_event}")
            except Exception as e:
                print(f"  FAIL: {e}")
        else:
            print("  SKIP: TikTok formats not retrieved.")

        # Step 6: Instagram Metadata
        print(f"\n[Step 6] POST /api/metadata (Instagram: {TEST_INSTAGRAM_URL})")
        try:
            r = client.post(f"{base_url}/api/metadata", json={"url": TEST_INSTAGRAM_URL})
            if r.status_code == 200:
                ig_meta = r.json()
                print(f"  PASS: Retrieved title: '{ig_meta.get('title')}'")
                print(f"        formats count: {len(ig_meta.get('formats', []))}")
            else:
                print(f"  FAIL: HTTP {r.status_code}: {r.text[:200]}")
        except Exception as e:
            print(f"  FAIL: {e}")

    print("\n=== Smoke Tests Finished ===")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-url", default="http://127.0.0.1:8000", help="Base API URL")
    args = parser.parse_args()
    run_smoke_tests(args.api_url)

