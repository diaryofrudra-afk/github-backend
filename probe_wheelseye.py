"""
WheelsEye vehicle API discovery script.

Usage:
    python3 probe_wheelseye.py <token>

where <token> is the value of the `token` header from your browser's network tab
(e.g.  2d126823-eb2b-4207-ad78-86c0971c1ccc)
"""
import sys
import json
import httpx

TOKEN = sys.argv[1] if len(sys.argv) > 1 else ""
if not TOKEN:
    print("Usage: python3 probe_wheelseye.py <token>")
    sys.exit(1)

BASE = "https://wheelseye.com"

HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "token": TOKEN,
    "source": "OPERATOR_WEB",
    "X-APP-VERSION": "18.4.0",
    "Origin": BASE,
    "Referer": f"{BASE}/node/dashboard",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0",
}

COOKIES = {
    "deviceId": "11c474e1-fa2f-46ab-a6f2-d317df13c00d",
    "JSESSIONID": "AF9254E783FC18BBF33CF3EBD2C01B91"
}

CANDIDATES = [
    f"{BASE}/rest/argus/app/vehicles/static",
    f"{BASE}/rest/argus/app/vehicles-dynamic",
    f"{BASE}/vehicle/aggregatedMapDataForDashboard",
    f"{BASE}/rest/shield/documents/expiry-summary",
    f"{BASE}/rest/argus/vehicle/liveTracking",
    f"{BASE}/rest/argus/vehicle/live",
    f"{BASE}/rest/argus/vehicle/list",
    f"{BASE}/rest/argus/vehicle/all",
    f"{BASE}/rest/argus/vehicle/getAllVehicleDetails",
    f"{BASE}/rest/argus/vehicle/getVehicleDetailsByFleetOwnerId",
    f"{BASE}/rest/argus/vehicle/liveTrackingV2",
    f"{BASE}/rest/argus/tracking/live",
    f"{BASE}/rest/argus/tracking/liveTracking",
    f"{BASE}/rest/argus/dashboard/vehicleList",
    f"{BASE}/rest/argus/fleet/vehicleList",
    f"{BASE}/rest/argus/fleet/live",
    f"{BASE}/rest/cyborg/vehicle/liveTracking",
    f"{BASE}/rest/cyborg/vehicle/live",
    f"{BASE}/rest/cyborg/vehicle/list",
    f"{BASE}/rest/cyborg/vehicle/getAllVehicleDetails",
    f"{BASE}/rest/cyborg/tracking/live",
    f"{BASE}/rest/cyborg/dashboard/vehicleList",
]

print(f"\nProbing WheelsEye with token={TOKEN[:8]}...\n{'─'*70}")

found = []
with httpx.Client(timeout=10, follow_redirects=True) as client:
    for url in CANDIDATES:
        try:
            method = "POST" if "vehicles-dynamic" in url else "GET"
            payload = {"vehicleIds": [4202840,4202848, 4202849]} if method == "POST" else None
            
            if method == "POST":
                r = client.post(url, headers=HEADERS, cookies=COOKIES, json=payload)
            else:
                r = client.get(url, headers=HEADERS, cookies=COOKIES)
                
            body = r.text.strip()
            is_json = not body.startswith("<")
            preview = ""
            if is_json:
                try:
                    data = r.json()
                    preview = json.dumps(data)[:120]
                except Exception:
                    preview = body[:120]
            else:
                preview = "(HTML/redirect)"

            marker = "✓ " if r.status_code == 200 and is_json else "  "
            print(f"{marker}{r.status_code}  {url}")
            if r.status_code == 200 and is_json:
                print(f"     {preview}")
                found.append((url, r.json()))
        except Exception as e:
            print(f"  ERR {url}  → {e}")

print(f"\n{'─'*70}")
if found:
    print(f"\n✓ {len(found)} URL(s) returned JSON. First one:\n")
    url, data = found[0]
    print(f"  URL: {url}")
    print(f"  Response: {json.dumps(data, indent=2)[:800]}")
else:
    print("\nNo working URL found. Share the full output above so we can dig further.")
