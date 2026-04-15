#!/usr/bin/env python3
"""
Trak N Tell API Endpoint Discovery Tool
========================================
Uses Playwright to log into the TnT web app and passively capture every
API (XHR / fetch) request the browser makes.  Navigate around the site —
click on a vehicle, open the history tab, sensor tab, CAN data, reports — and
this script will print every URL hit, including ones we haven't wired up yet
(history, sensors, CAN bus, boom angle/length, etc.).

Usage:
    # Uses credentials already stored in suprwise.db
    python3 trakntell_discover.py

    # Capture for 120 seconds and save to a JSON file
    python3 trakntell_discover.py --duration 120 --output discovered_endpoints.json

    # Show browser window (so you can navigate manually)
    python3 trakntell_discover.py --headful --duration 180
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import hashlib
import json
import sqlite3
import sys
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse, parse_qs

try:
    from cryptography.fernet import Fernet
except ImportError:
    print("❌  pip install cryptography playwright")
    sys.exit(1)

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("❌  pip install playwright && playwright install chromium")
    sys.exit(1)

# ── Credential helpers ─────────────────────────────────────────────────────────

DB_PATH = "./data/suprwise.db"
JWT_SECRET_DEFAULT = "dev-secret-key-change-in-production-to-a-60-char-random-string"


def _fernet_key(secret: str) -> bytes:
    digest = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(digest)


def _decrypt(ciphertext: Optional[str], secret: str) -> Optional[str]:
    if not ciphertext:
        return None
    return Fernet(_fernet_key(secret)).decrypt(ciphertext.encode()).decode()


def load_credentials(jwt_secret: str = JWT_SECRET_DEFAULT) -> Optional[dict]:
    try:
        db = sqlite3.connect(DB_PATH)
        row = db.execute(
            "SELECT user_id_encrypted, user_id_encrypt_encrypted, orgid_encrypted, "
            "sessionid_encrypted, tnt_s_encrypted FROM trakntell_credentials LIMIT 1"
        ).fetchone()
        db.close()
    except Exception as e:
        print(f"❌  Cannot read DB ({DB_PATH}): {e}")
        return None

    if not row:
        print("❌  No Trak N Tell credentials in database. Connect via the web app first.")
        return None

    return {
        "user_id":         _decrypt(row[0], jwt_secret),
        "user_id_encrypt": _decrypt(row[1], jwt_secret),
        "orgid":           _decrypt(row[2], jwt_secret),
        "sessionid":       _decrypt(row[3], jwt_secret),
        "tnt_s":           _decrypt(row[4], jwt_secret) if len(row) > 4 else None,
    }


# ── Discovery ──────────────────────────────────────────────────────────────────

TNT_HOME = "https://mapsweb.trakmtell.com/tnt/servlet/tntWebCurrentStatus"
TNT_API_BASE = "mapsweb.trakmtell.com/tnt/servlet/"

INTERESTING_PATTERNS = [
    "tntService",
    "servlet/",
    "/tnt/",
    "getHistory",
    "getSensor",
    "getCAN",
    "getAlert",
    "getTrip",
    "getReport",
    "getVehicle",
    "getFleet",
    "getDTC",
    "getIdling",
    "getStopage",
    "getExcess",
    "getBoom",
    "getAngle",
    "getLoad",
]


async def discover(creds: dict, duration: int = 90, headful: bool = False) -> list[dict]:
    """
    Open the TnT web app with saved session cookies, let the user (or auto-navigation)
    trigger various views, and record every interesting API call made.
    """
    discovered: dict[str, dict] = {}   # keyed by base URL (no query string)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=not headful,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
        )

        # Inject session cookies so we bypass the login page
        await context.add_cookies([
            {"name": "JSESSIONID", "value": creds["sessionid"],
             "domain": "mapsweb.trakmtell.com", "path": "/"},
        ])
        if creds.get("tnt_s"):
            await context.add_cookies([
                {"name": "tnt_s", "value": creds["tnt_s"],
                 "domain": "mapsweb.trakmtell.com", "path": "/"},
            ])

        page = await context.new_page()

        # ── Intercept every request ───────────────────────────────────────────

        async def on_request(req):
            url = req.url
            if not any(p in url for p in INTERESTING_PATTERNS):
                return
            parsed = urlparse(url)
            base_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            params = parse_qs(parsed.query)
            key = base_url
            if key not in discovered:
                discovered[key] = {
                    "url": base_url,
                    "full_url": url,
                    "method": req.method,
                    "query_params": params,
                    "seen_at": datetime.now().isoformat(),
                    "count": 0,
                }
                print(f"\n  🔗  NEW ENDPOINT: {base_url}")
                # print every param key (but hide sensitive values)
                for k, v in params.items():
                    if k in ("u", "userIdEncrypt", "orgid", "JSESSIONID"):
                        print(f"        {k} = [auth]")
                    else:
                        print(f"        {k} = {v[0][:80] if v else ''}")
            discovered[key]["count"] += 1

        async def on_response(resp):
            url = resp.url
            if not any(p in url for p in INTERESTING_PATTERNS):
                return
            parsed = urlparse(url)
            base_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            if base_url in discovered and "response_keys" not in discovered[base_url]:
                try:
                    ct = resp.headers.get("content-type", "")
                    if "json" in ct or "javascript" in ct:
                        body = await resp.json()
                        # Collect all unique keys from the first item in any list
                        def extract_keys(obj, prefix="") -> list[str]:
                            keys = []
                            if isinstance(obj, dict):
                                for k, v in obj.items():
                                    full = f"{prefix}.{k}" if prefix else k
                                    keys.append(full)
                                    if isinstance(v, list) and v:
                                        keys += extract_keys(v[0], full + "[0]")
                                    elif isinstance(v, dict):
                                        keys += extract_keys(v, full)
                            return keys
                        discovered[base_url]["response_keys"] = extract_keys(body)
                        discovered[base_url]["response_sample"] = (
                            json.dumps(body)[:2000] if body else None
                        )
                        print(f"     ↩  Response keys: {discovered[base_url]['response_keys'][:30]}")
                except Exception:
                    pass

        page.on("request", on_request)
        page.on("response", on_response)

        # ── Navigate to the TnT app ───────────────────────────────────────────
        url_with_params = (
            f"{TNT_HOME}?f=l&u={creds['user_id']}"
            f"&userIdEncrypt={creds['user_id_encrypt']}&orgid={creds['orgid']}"
        )
        print(f"\n🌐  Opening TnT web app...")
        try:
            await page.goto(url_with_params, wait_until="networkidle", timeout=30_000)
        except Exception as e:
            print(f"⚠️   Navigation warning (continuing): {e}")

        if headful:
            print(f"\n👆  Browser is open. Navigate the TnT site — click vehicles,")
            print(f"    open history, sensors, CAN data, reports, etc.")
            print(f"    Waiting {duration}s for you to explore...")
        else:
            print(f"\n⏳  Headless mode: auto-navigating for {duration}s...")
            # Try to trigger common views automatically
            await asyncio.sleep(5)
            # Click first vehicle if any markers appear
            try:
                await page.click('.vehicle-marker, .leaflet-marker-icon, [class*="marker"]',
                                 timeout=5_000)
                await asyncio.sleep(3)
            except Exception:
                pass
            # Try navigating to common history/report URLs
            for path in [
                "/tnt/servlet/tntServiceGetHistoryData",
                "/tnt/servlet/tntServiceGetSensorData",
                "/tnt/servlet/tntServiceGetCANData",
                "/tnt/servlet/tntServiceGetAlertReport",
                "/tnt/servlet/tntServiceGetTripReport",
            ]:
                try:
                    params = (
                        f"?f=l&u={creds['user_id']}"
                        f"&userIdEncrypt={creds['user_id_encrypt']}&orgid={creds['orgid']}"
                        f"&vehicleId=1&fromDate=01/04/2026&toDate=14/04/2026"
                    )
                    probe_url = f"https://mapsweb.trakmtell.com{path}{params}"
                    print(f"  🔍  Probing: {path}")
                    await page.goto(probe_url, wait_until="domcontentloaded", timeout=10_000)
                    await asyncio.sleep(2)
                    await page.goto(url_with_params, wait_until="domcontentloaded", timeout=10_000)
                    await asyncio.sleep(2)
                except Exception as e:
                    print(f"      ↩  {e}")

        await asyncio.sleep(max(0, duration - 30))
        await browser.close()

    return list(discovered.values())


# ── Main ───────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(
        description="Discover all Trak N Tell API endpoints by intercepting browser network traffic."
    )
    parser.add_argument("--duration", type=int, default=90, help="Seconds to capture (default: 90)")
    parser.add_argument("--headful", action="store_true", help="Show browser window for manual navigation")
    parser.add_argument("--output", default="trakntell_discovered_endpoints.json",
                        help="Output JSON file (default: trakntell_discovered_endpoints.json)")
    parser.add_argument("--jwt-secret", default=JWT_SECRET_DEFAULT,
                        help="JWT_SECRET used to decrypt DB credentials")
    args = parser.parse_args()

    print("=" * 70)
    print("  Trak N Tell API Endpoint Discovery")
    print("=" * 70)

    creds = load_credentials(args.jwt_secret)
    if not creds or not creds.get("sessionid"):
        print("❌  No valid session. Login via the Suprwise GPS Settings first.")
        sys.exit(1)

    print(f"✅  Credentials loaded (user_id: {creds['user_id'][:6]}...)")
    print(f"    Capturing for {args.duration}s ({'headful' if args.headful else 'headless'})")

    endpoints = await discover(creds, duration=args.duration, headful=args.headful)

    print("\n" + "=" * 70)
    print(f"  DISCOVERED {len(endpoints)} ENDPOINT(S)")
    print("=" * 70)

    for ep in sorted(endpoints, key=lambda x: x["url"]):
        print(f"\n  {ep['url']}")
        print(f"     Method : {ep['method']}")
        print(f"     Hits   : {ep['count']}")
        if ep.get("response_keys"):
            print(f"     Keys   : {ep['response_keys'][:20]}")

    with open(args.output, "w") as f:
        json.dump(endpoints, f, indent=2, default=str)
    print(f"\n💾  Full report saved to: {args.output}")
    print("\nTip: Run with --headful --duration 180 and manually click through")
    print("     vehicle history, sensor graphs, CAN data, and reports to capture")
    print("     every endpoint the TnT app uses.")


if __name__ == "__main__":
    asyncio.run(main())
