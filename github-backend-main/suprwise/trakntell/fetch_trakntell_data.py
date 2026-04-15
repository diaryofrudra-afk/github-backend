#!/usr/bin/env python3
"""
Trak N Tell Live Data Fetcher
Logs in, captures JSESSIONID, and fetches live vehicle tracking data.

This script uses Playwright to:
1. Navigate to Trak N Tell login page
2. Extract session cookies after authentication
3. Call the tracking API with the session
4. Return vehicle data in Suprwise format

Usage:
    python3 fetch_trakntell_data.py --user-id YOUR_USER_ID --orgid YOUR_ORGID
"""

import asyncio
import json
import argparse
import sys
from typing import Optional, List, Dict, Any
from datetime import datetime
from pathlib import Path

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("❌ Playwright not installed. Run: pip install playwright && playwright install")
    sys.exit(1)

import httpx


class TrakNTellFetcher:
    """Fetch live GPS data from Trak N Tell."""
    
    # Trak N Tell URLs
    LOGIN_URL = "https://mapsweb.TrakMTell.com/tnt/login"
    API_BASE = "https://mapsweb.TrakMTell.com/tnt/servlet"
    
    def __init__(self, user_id: str, orgid: str, user_id_encrypt: Optional[str] = None):
        self.user_id = user_id
        self.orgid = orgid
        self.user_id_encrypt = user_id_encrypt
        self.session_cookies: Dict[str, str] = {}
        self.jsessionid: Optional[str] = None
    
    async def login_and_capture_session(self, headless: bool = True) -> bool:
        """
        Login to Trak N Tell and capture session cookies.
        Returns True if successful.
        """
        print(f"🔐 Logging in to Trak N Tell...")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=headless)
            context = await browser.new_context(
                viewport={'width': 1280, 'height': 720},
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            )
            page = await context.new_page()
            
            try:
                # Navigate to login page
                await page.goto(self.LOGIN_URL, wait_until='networkidle', timeout=30000)
                print(f"✅ Login page loaded")
                
                # Wait for page to fully load and establish session
                await asyncio.sleep(3)
                
                # Get all cookies for Trak N Tell domain
                cookies = await context.cookies()
                trakntell_cookies = [c for c in cookies if 'trakmtell.com' in c.get('domain', '') or 'trakmtell.com' in c.get('url', '')]
                
                print(f"📦 Found {len(trakntell_cookies)} cookies")
                
                # Look for JSESSIONID
                for cookie in trakntell_cookies:
                    if cookie['name'] == 'JSESSIONID':
                        self.jsessionid = cookie['value']
                        print(f"✅ JSESSIONID captured: {self.jsessionid[:20]}...")
                    
                    self.session_cookies[cookie['name']] = cookie['value']
                
                if not self.jsessionid:
                    print("⚠️  JSESSIONID not found. Trying alternative method...")
                    # Try to get from localStorage or page context
                    self.jsessionid = await page.evaluate("""() => {
                        // Try to get session from page state
                        const cookies = document.cookie;
                        const match = cookies.match(/JSESSIONID=([^;]+)/);
                        return match ? match[1] : null;
                    }""")
                    if self.jsessionid:
                        print(f"✅ JSESSIONID captured from page: {self.jsessionid[:20]}...")
                
                await browser.close()
                return self.jsessionid is not None
                
            except Exception as e:
                print(f"❌ Login failed: {e}")
                await browser.close()
                return False
    
    def _build_headers(self) -> Dict[str, str]:
        """Build HTTP headers with session cookies."""
        headers = {
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Referer": "https://mapsweb.TrakMTell.com/tnt/servlet/tntWebCurrentStatus",
            "Origin": "https://mapsweb.TrakMTell.com",
        }
        
        if self.jsessionid:
            headers["Cookie"] = f"JSESSIONID={self.jsessionid}"
        
        return headers
    
    def _build_params(self) -> Dict[str, str]:
        """Build query parameters for API calls."""
        params = {
            "u": self.user_id,
            "orgid": self.orgid,
        }
        if self.user_id_encrypt:
            params["userIdEncrypt"] = self.user_id_encrypt
        return params
    
    async def fetch_vehicle_status(self) -> List[Dict[str, Any]]:
        """
        Fetch live vehicle tracking data.
        Returns list of vehicle objects.
        """
        if not self.jsessionid:
            print("❌ No JSESSIONID available. Run login_and_capture_session() first.")
            return []
        
        print(f"🚗 Fetching vehicle data...")
        
        # Try multiple API endpoints (Trak N Tell may use different endpoints)
        endpoints_to_try = [
            "/getVehicleStatus",
            "/getTrackingDetails",
            "/getFleetStatus",
            "/tntWebCurrentStatus",
        ]
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            for endpoint in endpoints_to_try:
                url = f"{self.API_BASE}{endpoint}"
                params = self._build_params()
                headers = self._build_headers()
                
                try:
                    print(f"  Trying: {endpoint}")
                    response = await client.get(url, headers=headers, params=params)
                    
                    if response.status_code == 200:
                        data = response.json()
                        print(f"  ✅ Success! Got {len(data) if isinstance(data, list) else 'object'} response")
                        
                        # Parse and normalize the response
                        vehicles = self._parse_vehicle_data(data)
                        return vehicles
                    
                    elif response.status_code == 401:
                        print(f"  ⚠️  Session expired (401)")
                        return []
                    
                    else:
                        print(f"  ⚠️  HTTP {response.status_code}")
                        
                except httpx.TimeoutException:
                    print(f"  ⚠️  Timeout on {endpoint}")
                except Exception as e:
                    print(f"  ⚠️  Error on {endpoint}: {e}")
        
        return []
    
    def _parse_vehicle_data(self, data: Any) -> List[Dict[str, Any]]:
        """Parse raw API response into normalized vehicle list."""
        vehicles = []
        
        # Handle different response formats
        raw_list = []
        if isinstance(data, list):
            raw_list = data
        elif isinstance(data, dict):
            # Try common field names
            raw_list = (
                data.get("vehicles") or
                data.get("data") or
                data.get("list") or
                data.get("trackingData") or
                data.get("fleetStatus") or
                []
            )
        
        for item in raw_list:
            if not isinstance(item, dict):
                continue
            
            vehicle = self._normalize_vehicle(item)
            if vehicle.get("registration_number"):
                vehicles.append(vehicle)
        
        print(f"✅ Parsed {len(vehicles)} vehicles")
        return vehicles
    
    def _normalize_vehicle(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize a single vehicle object."""
        # Extract registration number (try multiple field names)
        reg_number = (
            raw.get("vehicleNumber") or
            raw.get("registration_number") or
            raw.get("truck_no") or
            raw.get("vehicleNo") or
            raw.get("regNo") or
            raw.get("registrationNo") or
            ""
        )
        
        # Extract status
        status_raw = raw.get("status", "UNKNOWN").upper()
        status_map = {
            "MOVING": "moving",
            "STOPPED": "stopped",
            "IDLE": "stopped",
            "OFFLINE": "signal_lost",
            "UNKNOWN": "unknown",
        }
        status = status_map.get(status_raw, "unknown")
        
        # Extract coordinates
        latitude = float(raw.get("latitude") or raw.get("lat") or 0.0)
        longitude = float(raw.get("longitude") or raw.get("lng") or 0.0)
        
        # Extract speed
        speed = float(raw.get("speed") or raw.get("current_speed") or 0.0)
        
        # Extract timestamp
        last_updated = raw.get("lastUpdated") or raw.get("last_updated") or raw.get("timestamp") or ""
        if isinstance(last_updated, (int, float)):
            try:
                last_updated = datetime.fromtimestamp(last_updated / 1000).strftime("%Y-%m-%d %H:%M:%S")
            except Exception:
                last_updated = str(last_updated)
        
        # Extract address
        address = raw.get("address") or raw.get("location") or raw.get("currentLocation") or ""
        
        # Extract additional fields
        engine_on = None
        if "engineOn" in raw or "engine_on" in raw:
            engine_on = raw.get("engineOn") or raw.get("engine_on")
        
        signal = raw.get("signal") or raw.get("gpsSignal") or "unknown"
        if signal and signal != "unknown":
            signal = signal.replace("_", " ").title()
        
        return {
            "registration_number": str(reg_number),
            "status": status,
            "latitude": latitude,
            "longitude": longitude,
            "speed": speed,
            "last_updated": last_updated,
            "address": address,
            "engine_on": engine_on,
            "signal": signal,
            "raw_data": raw,  # Keep raw data for debugging
        }
    
    async def fetch_all(self) -> Dict[str, Any]:
        """
        Complete flow: login → capture session → fetch data.
        Returns unified response for Suprwise backend.
        """
        # Step 1: Login and capture session
        login_success = await self.login_and_capture_session(headless=True)
        
        if not login_success:
            return {
                "error": "Failed to login to Trak N Tell. Check credentials.",
                "vehicles": [],
            }
        
        # Step 2: Fetch vehicle data
        vehicles = await self.fetch_vehicle_status()
        
        if not vehicles:
            return {
                "error": "No vehicles found in Trak N Tell account.",
                "vehicles": [],
            }
        
        return {
            "vehicles": vehicles,
            "vehicle_count": len(vehicles),
            "session_captured": True,
            "fetched_at": datetime.now().isoformat(),
        }


async def main():
    parser = argparse.ArgumentParser(description="Fetch Trak N Tell GPS data")
    parser.add_argument("--user-id", required=True, help="Trak N Tell User ID (u param)")
    parser.add_argument("--orgid", required=True, help="Trak N Tell Organization ID")
    parser.add_argument("--user-id-encrypt", help="Trak N Tell Encrypted User ID (optional)")
    parser.add_argument("--output", help="Output file (JSON)")
    parser.add_argument("--headful", action="store_true", help="Show browser window (for debugging)")
    
    args = parser.parse_args()
    
    print("=" * 70)
    print("  Trak N Tell Live Data Fetcher")
    print("=" * 70)
    print()
    print(f"📋 Configuration:")
    print(f"   User ID: {args.user_id}")
    print(f"   Org ID: {args.orgid}")
    if args.user_id_encrypt:
        print(f"   User ID Encrypt: {args.user_id_encrypt[:20]}...")
    print()
    
    # Create fetcher
    fetcher = TrakNTellFetcher(
        user_id=args.user_id,
        orgid=args.orgid,
        user_id_encrypt=args.user_id_encrypt,
    )
    
    # Fetch data
    result = await fetcher.fetch_all()
    
    # Output results
    print()
    print("=" * 70)
    print("  Results")
    print("=" * 70)
    print()
    
    if result.get("error"):
        print(f"❌ Error: {result['error']}")
    else:
        print(f"✅ Successfully fetched {result['vehicle_count']} vehicles")
        print()
        for v in result["vehicles"]:
            print(f"  • {v['registration_number']}")
            print(f"    Status: {v['status']}")
            print(f"    Speed: {v['speed']} km/h")
            print(f"    Location: {v['latitude']:.4f}, {v['longitude']:.4f}")
            print(f"    Updated: {v['last_updated']}")
            print()
    
    # Save to file if requested
    if args.output:
        output_path = Path(args.output)
        output_path.write_text(json.dumps(result, indent=2, default=str))
        print(f"💾 Results saved to: {output_path}")
    
    print()
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
