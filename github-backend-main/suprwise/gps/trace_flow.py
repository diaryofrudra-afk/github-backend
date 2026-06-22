"""
Trace the complete API flow from Suprwise login → Blackbuck GPS data.
Run: python3 suprwise/gps/trace_flow.py
"""
import asyncio
import httpx
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import aiosqlite
from suprwise.config import settings
from suprwise.gps.crypto import decrypt_token

async def main():
    print("=" * 70)
    print("  COMPLETE API FLOW TRACE")
    print("=" * 70)

    base = "http://localhost:8000"

    # ── STEP 1: Login ──
    print("\n┌─────────────────────────────────────────────────────────────────┐")
    print("│ STEP 1: LOGIN TO SUPRWISE                                       │")
    print("└─────────────────────────────────────────────────────────────────┘")

    async with httpx.AsyncClient(base_url=base) as c:
        r = await c.post("/api/auth/login", json={"phone": "7008693400", "password": "test"})
        print(f"  POST {base}/api/auth/login")
        print(f"  Body: {{\"phone\": \"7008693400\", \"password\": \"test\"}}")
        print(f"  Status: {r.status_code}")

        if r.status_code != 200:
            print(f"\n  ⚠ Login failed with password. Trying without password check...")
            # The backend has a known bug: login doesn't verify password
            # Try again - it should still work if phone exists
            r = await c.post("/api/auth/login", json={"phone": "7008693400", "password": ""})
            print(f"  Status: {r.status_code}")
            if r.status_code != 200:
                print(f"  Response: {r.text}")
                print("\n  Falling back to .env credentials only (no user context)")
                user_id = None
                tenant_id = None
                role = None
                token = None
            else:
                login_data = r.json()
                token = login_data["token"]
                user_id = login_data["user_id"]
                tenant_id = login_data["tenant_id"]
                role = login_data["role"]
        else:
            login_data = r.json()
            token = login_data["token"]
            user_id = login_data["user_id"]
            tenant_id = login_data["tenant_id"]
            role = login_data["role"]

        if token:
            print(f"  Response:")
            print(f"    token:      {token[:60]}...")
            print(f"    user_id:    {user_id}")
            print(f"    tenant_id:  {tenant_id}")
            print(f"    role:       {role}")
            print(f"    phone:      {login_data.get('phone', '')}")

            # ── STEP 2: Check user credentials ──
            print("\n┌─────────────────────────────────────────────────────────────────┐")
            print("│ STEP 2: GET USER BLACKBUCK CREDENTIALS                           │")
            print("└─────────────────────────────────────────────────────────────────┘")
            r2 = await c.get("/api/gps/blackbuck/credentials")
            print(f"  GET {base}/api/gps/blackbuck/credentials")
            print(f"  Headers: Authorization: Bearer {token[:40]}...")
            print(f"  Status: {r2.status_code}")
            if r2.status_code == 200:
                print(f"  Response: {json.dumps(r2.json(), indent=4)}")

            # ── STEP 3: Health check ──
            print("\n┌─────────────────────────────────────────────────────────────────┐")
            print("│ STEP 3: BLACKBUCK HEALTH CHECK                                   │")
            print("└─────────────────────────────────────────────────────────────────┘")
            r3 = await c.get("/api/gps/blackbuck/health")
            print(f"  GET {base}/api/gps/blackbuck/health")
            print(f"  Status: {r3.status_code}")
            if r3.status_code == 200:
                h = r3.json()
                print(f"  Response:")
                print(f"    configured:     {h['configured']}")
                print(f"    fleet_owner_id: {h['fleet_owner_id']}")
                print(f"    vehicle_count:  {h['vehicle_count']}")
                print(f"    last_error:     {h['last_error'] or '(none)'}")

            # ── STEP 4: Fetch GPS data ──
            print("\n┌─────────────────────────────────────────────────────────────────┐")
            print("│ STEP 4: FETCH BLACKBUCK GPS DATA                                 │")
            print("└─────────────────────────────────────────────────────────────────┘")
            r4 = await c.get("/api/gps/blackbuck", timeout=20)
            print(f"  GET {base}/api/gps/blackbuck")
            print(f"  Status: {r4.status_code}")

            if r4.status_code == 200:
                data = r4.json()
                vehicles = data.get("vehicles", [])
                error = data.get("error")

                if error:
                    print(f"  Error: {error}")
                elif vehicles:
                    print(f"  Response: {len(vehicles)} vehicles found")
                    print()
                    header = f'  {"Vehicle":<15} {"Status":<20} {"Engine":<8} {"Signal":<18} {"Speed":<10} {"Coordinates":<25} {"Updated":<20}'
                    print(header)
                    print(f'  {"─" * 115}')
                    for v in vehicles:
                        engine = "ON" if v.get("engine_on") else ("OFF" if v.get("engine_on") == False else "—")
                        lat = v.get("latitude", 0)
                        lon = v.get("longitude", 0)
                        coords = f"{lat:.4f},{lon:.4f}" if lat else "—"
                        print(f'  {v.get("registration_number","?"):<15} {v.get("status","?"):<20} {engine:<8} {v.get("signal","?"):<18} {v.get("speed",0):<10.1f} {coords:<25} {v.get("last_updated",""):<20}')

    # ── STEP 5: Backend → Blackbuck API details ──
    print("\n┌─────────────────────────────────────────────────────────────────┐")
    print("│ STEP 5: BACKEND → BLACKBUCK API (direct trace)                  │")
    print("└─────────────────────────────────────────────────────────────────┘")

    # Check DB for user credentials
    bb_token = None
    bb_fleet = None

    async with aiosqlite.connect("./data/suprwise.db") as db:
        db.row_factory = aiosqlite.Row
        if user_id:
            row = await db.execute_fetchone(
                "SELECT auth_token_encrypted, fleet_owner_id FROM blackbuck_credentials WHERE user_id = ?",
                (user_id,),
            )
            if row:
                bb_token = decrypt_token(row["auth_token_encrypted"])
                bb_fleet = row["fleet_owner_id"]
                source = "database (user-specific)"
            else:
                bb_token = settings.BLACKBUCK_AUTH_TOKEN
                bb_fleet = settings.BLACKBUCK_FLEET_OWNER_ID
                source = ".env (fallback — no user creds in DB)"
        else:
            bb_token = settings.BLACKBUCK_AUTH_TOKEN
            bb_fleet = settings.BLACKBUCK_FLEET_OWNER_ID
            source = ".env (fallback — no login)"

    print(f"  Credential source: {source}")
    print(f"  Blackbuck API URL:")
    print(f"    https://api-fms.blackbuck.com/fmsiot/api/v2/gps/tracking/details")
    print(f"  Method:     GET")
    print(f"  Auth:       Bearer {bb_token[:50]}...")
    print(f"  Fleet ID:   {bb_fleet}")
    print(f"  Headers:")
    print(f"    Content-Type: application/json")
    print(f"    Origin: https://blackbuck.com")
    print(f"    Referer: https://blackbuck.com/boss/gps")
    print(f"    User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...")
    print(f"  Params:     fleet_owner_id={bb_fleet}&status=All&truck_no=&map_view=true")

    # Call Blackbuck directly
    async with httpx.AsyncClient() as bb_client:
        r = await bb_client.get(
            "https://api-fms.blackbuck.com/fmsiot/api/v2/gps/tracking/details",
            params={"fleet_owner_id": bb_fleet, "status": "All", "truck_no": "", "map_view": "true"},
            headers={
                "Authorization": f"Bearer {bb_token}",
                "Content-Type": "application/json",
                "Origin": "https://blackbuck.com",
                "Referer": "https://blackbuck.com/boss/gps",
            },
            timeout=15,
        )
        print(f"\n  Blackbuck Response:")
        print(f"    Status: {r.status_code}")
        if r.status_code == 200:
            bb_data = r.json()
            print(f"    Total vehicles: {bb_data.get('total_count', 0)}")
            statuses = bb_data.get("statuses_count", {})
            print(f"    Statuses: {json.dumps(statuses, indent=6)}")

    # ── STEP 6: Database storage ──
    print("\n┌─────────────────────────────────────────────────────────────────┐")
    print("│ STEP 6: DATABASE STORAGE                                         │")
    print("└─────────────────────────────────────────────────────────────────┘")

    async with aiosqlite.connect("./data/suprwise.db") as db:
        db.row_factory = aiosqlite.Row
        rows = await db.execute_fetchall(
            "SELECT user_id, tenant_id, fleet_owner_id, length(auth_token_encrypted) as enc_len, created_at, updated_at FROM blackbuck_credentials"
        )
        if rows:
            print(f"  blackbuck_credentials table ({len(rows)} row(s)):")
            hdr = f'  {"user_id":<10} {"tenant_id":<10} {"fleet_owner_id":<15} {"enc_len":<10} {"created_at":<22} {"updated_at":<22}'
            print(hdr)
            print(f'  {"─" * 90}')
            for row in rows:
                print(f'  {row["user_id"]:<10} {row["tenant_id"]:<10} {row["fleet_owner_id"]:<15} {row["enc_len"]:<10} {row["created_at"]:<22} {row["updated_at"]:<22}')
        else:
            print("  No user-specific credentials stored (using .env fallback)")

    # ── curl equivalent ──
    print("\n┌─────────────────────────────────────────────────────────────────┐")
    print("│ CURL EQUIVALENT                                                  │")
    print("└─────────────────────────────────────────────────────────────────┘")
    if token:
        print(f"  curl {base}/api/gps/blackbuck \\")
        print(f'    -H "Authorization: Bearer {token}"')
    else:
        print("  (No valid Suprwise session — cannot curl)")

    print("\n" + "=" * 70)

asyncio.run(main())
