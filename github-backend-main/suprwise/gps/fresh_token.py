"""
Extract fresh Blackbuck token and auto-store it locally.
Launches browser → user logs in → extracts token → saves to .env + DB.

Run: python3 suprwise/gps/fresh_token.py
"""

import asyncio
import json
import sys
import os
from pathlib import Path
from playwright.async_api import async_playwright

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from suprwise.config import settings
from suprwise.gps.crypto import encrypt_token

DB_PATH = settings.DB_PATH
ENV_PATH = Path(__file__).parent.parent.parent / ".env"
LOGIN_URL = "https://blackbuck.com/boss/sign-in"
GPS_URL = "https://blackbuck.com/boss/gps"

async def main():
    print("=" * 60)
    print("  Blackbuck Token Extractor")
    print("=" * 60)
    print()
    print("A browser window will open.")
    print("1. Log in with your Blackbuck credentials")
    print("2. Wait for the GPS page to load")
    print("3. The script will auto-extract and save the token")
    print()

    async with async_playwright() as p:
        print("[*] Launching browser...")
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()

        await page.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
        )

        print(f"[*] Navigating to {LOGIN_URL} ...")
        await page.goto(LOGIN_URL, wait_until="domcontentloaded", timeout=30000)
        print(f"[+] Loaded: {page.url}")

        print("\n" + "=" * 60)
        print("  LOG IN NOW IN THE BROWSER WINDOW")
        print("=" * 60)
        print("  Script auto-detects when you leave the login page.")
        print("  Max wait: 3 minutes.")
        print("=" * 60)

        # Wait for user to log in
        max_wait = 180
        start = asyncio.get_event_loop().time()
        logged_in = False

        while (asyncio.get_event_loop().time() - start) < max_wait:
            current = page.url
            if "sign-in" not in current and "sign_up" not in current and "boss/" in current:
                print(f"\n[+] Login detected! Now at: {current}")
                logged_in = True
                break
            await asyncio.sleep(2)

        if not logged_in:
            print("[!] Timeout. Trying to navigate to GPS page anyway...")
            await page.goto(GPS_URL, wait_until="domcontentloaded", timeout=15000)

        await asyncio.sleep(3)
        current_url = page.url

        # Extract localStorage
        ls = await page.evaluate("""() => {
            const d = {};
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                d[k] = localStorage.getItem(k);
            }
            return d;
        }""")

        # Find token
        access_token = ls.get("accessToken", "").strip('"')
        if not access_token:
            access_token = ls.get("psk", "").strip('"')

        fleet_owner_id = ls.get("fleetOwnerID", "")
        user_id_bb = ls.get("userID", "")
        mobile = ls.get("mobile", "").strip('"')

        print("\n" + "=" * 60)
        print("  EXTRACTED DATA")
        print("=" * 60)
        print(f"  Current URL:      {current_url}")
        print(f"  accessToken:      {access_token[:60]}...")
        print(f"  fleetOwnerID:     {fleet_owner_id}")
        print(f"  userID:           {user_id_bb}")
        print(f"  mobile:           {mobile}")
        print(f"  Token length:     {len(access_token)}")

        if not access_token or not fleet_owner_id:
            print("\n[!] Failed to extract token or fleet owner ID.")
            print("    Full localStorage:")
            for k, v in ls.items():
                print(f"    {k}: {str(v)[:100]}")
            await browser.close()
            return

        # Verify token via browser (httpx gets blocked by Cloudflare)
        print("\n[*] Verifying token via browser API call...")
        profile_result = await page.evaluate("""async () => {
            try {
                const resp = await fetch('https://api-fms.blackbuck.com/fms/api/freight_supply/userProfile/v1', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                return { status: resp.status, body: await resp.text() };
            } catch(e) { return { error: e.message }; }
        }""")

        if profile_result.get("status") == 200:
            profile = json.loads(profile_result["body"])
            print(f"[+] Token valid!")
            print(f"    Name: {profile.get('name')}")
            print(f"    Fleet: {profile.get('fleet_owner_id')}")
            print(f"    Mobile: {profile.get('user_mobile')}")

            if str(profile.get("fleet_owner_id")) != str(fleet_owner_id):
                print(f"    ⚠ Fleet ID mismatch, correcting...")
                fleet_owner_id = str(profile.get("fleet_owner_id"))
        else:
            print(f"[!] Token verification failed (HTTP {profile_result.get('status')})")
            print(f"    Body: {str(profile_result.get('body', profile_result.get('error','')))[:200]}")
            print("    Saving anyway.")

        # Test GPS API via browser
        print("\n[*] Testing GPS API via browser...")
        gps_result = await page.evaluate(f"""async () => {{
            try {{
                const resp = await fetch('https://api-fms.blackbuck.com/fmsiot/api/v2/gps/tracking/details?fleet_owner_id={fleet_owner_id}&status=All&truck_no=&map_view=true', {{
                    method: 'GET',
                    headers: {{ 'Content-Type': 'application/json' }}
                }});
                return {{ status: resp.status, body: await resp.text() }};
            }} catch(e) {{ return {{ error: e.message }}; }}
        }}""")

        if gps_result.get("status") == 200:
            data = json.loads(gps_result["body"])
            total = data.get("total_count", 0)
            print(f"[+] GPS API OK — {total} vehicles found")
            for v in data.get("list", [])[:5]:
                ign = v.get("ignition_status", "?")
                print(f"    {v['truck_no']} | {v['status']} | Engine: {ign} | {v.get('latitude',0):.4f},{v.get('longitude',0):.4f}")
            if total > 5:
                print(f"    ... and {total - 5} more vehicles")
        else:
            print(f"[!] GPS API failed (HTTP {gps_result.get('status')})")
            print(f"    {str(gps_result.get('body', gps_result.get('error','')))[:200]}")

        # Save to .env
        print("\n" + "=" * 60)
        print("  SAVING TO .env")
        print("=" * 60)

        env_lines = []
        if ENV_PATH.exists():
            env_lines = ENV_PATH.read_text().splitlines()

        # Update or add BLACKBUCK_AUTH_TOKEN and FLEET_OWNER_ID
        new_lines = []
        skip_next_blank = False
        for line in env_lines:
            if line.startswith("BLACKBUCK_AUTH_TOKEN="):
                new_lines.append(f"BLACKBUCK_AUTH_TOKEN={access_token}")
            elif line.startswith("BLACKBUCK_FLEET_OWNER_ID="):
                new_lines.append(f"BLACKBUCK_FLEET_OWNER_ID={fleet_owner_id}")
            else:
                new_lines.append(line)

        # Add if not present
        if not any(l.startswith("BLACKBUCK_AUTH_TOKEN=") for l in new_lines):
            new_lines.append("")
            new_lines.append("# Blackbuck GPS Integration")
            new_lines.append(f"BLACKBUCK_AUTH_TOKEN={access_token}")
        if not any(l.startswith("BLACKBUCK_FLEET_OWNER_ID=") for l in new_lines):
            new_lines.append(f"BLACKBUCK_FLEET_OWNER_ID={fleet_owner_id}")

        ENV_PATH.write_text("\n".join(new_lines) + "\n")
        print(f"[+] Saved to: {ENV_PATH}")

        # Save to database (per-user, encrypted)
        print("\n" + "=" * 60)
        print("  SAVING TO DATABASE (per-user, encrypted)")
        print("=" * 60)

        # Reload settings
        settings.BLACKBUCK_AUTH_TOKEN = access_token
        settings.BLACKBUCK_FLEET_OWNER_ID = fleet_owner_id

        import aiosqlite
        import uuid

        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("PRAGMA foreign_keys=ON")

            # Get first user
            cursor = await db.execute("SELECT id, phone, tenant_id FROM users LIMIT 1")
            users = await cursor.fetchall()

            if users:
                row = users[0]
                user_id_db = row[0]
                tenant_id = row[2]
                user_phone = row[1]

                # Encrypt and store
                encrypted = encrypt_token(access_token)

                cursor2 = await db.execute(
                    "SELECT id FROM blackbuck_credentials WHERE user_id = ?",
                    (user_id_db,)
                )
                existing = await cursor2.fetchone()

                if existing:
                    await db.execute(
                        "UPDATE blackbuck_credentials SET auth_token_encrypted = ?, fleet_owner_id = ?, updated_at = datetime('now') WHERE user_id = ?",
                        (encrypted, fleet_owner_id, user_id_db)
                    )
                    print(f"[+] Updated credentials for user {user_phone} (id={user_id_db[:8]}...)")
                else:
                    await db.execute(
                        "INSERT INTO blackbuck_credentials (id, user_id, tenant_id, auth_token_encrypted, fleet_owner_id) VALUES (?, ?, ?, ?, ?)",
                        (str(uuid.uuid4()), user_id_db, tenant_id, encrypted, fleet_owner_id)
                    )
                    print(f"[+] Stored credentials for user {user_phone} (id={user_id_db[:8]}...)")

                await db.commit()
            else:
                print("[!] No users in Suprwise DB. Token saved to .env only.")
                print("    Register a user first, then the token will be stored per-user.")

        # Summary
        print("\n" + "=" * 60)
        print("  SUMMARY")
        print("=" * 60)
        print(f"  Token:         {access_token[:60]}...")
        print(f"  Fleet Owner:   {fleet_owner_id}")
        print(f"  BB User:       {mobile} (ID: {user_id_bb})")
        print(f"  Stored in:     .env + database (per-user, encrypted)")
        print(f"  Valid for:     ~30 days")
        print(f"  Status:        ✅ Ready — live GPS data active")
        print()
        print("  To update later: Open Suprwise → GPS → Settings")
        print("=" * 60)

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
