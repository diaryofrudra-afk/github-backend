"""
Navigate to Blackbuck login, let user log in, then extract token.
"""

import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://127.0.0.1:9222"
LOGIN_URL = "https://blackbuck.com/boss/sign-in"
GPS_URL = "https://blackbuck.com/boss/gps"

async def main():
    async with async_playwright() as p:
        print("[*] Connecting to Chrome...")
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0]
        pages = ctx.pages
        page = pages[0] if pages else await ctx.new_page()
        
        print(f"[*] Current page: {page.url}")
        
        # Navigate to login
        print(f"[*] Going to {LOGIN_URL} ...")
        try:
            await page.goto(LOGIN_URL, wait_until="domcontentloaded", timeout=30000)
            print(f"[+] Loaded: {page.url}")
        except Exception as e:
            print(f"[!] Navigation error: {e}")
        
        print("\n" + "="*60)
        print("  PLEASE LOG IN MANUALLY IN THE CHROME WINDOW")
        print("="*60)
        print("  Enter your Blackbuck credentials and complete")
        print("  login (including OTP if required).")
        print()
        print("  Once you're on the GPS dashboard page, press ENTER")
        print("  here to extract the token...")
        print("="*60)
        
        # Wait for user to press enter
        await asyncio.get_event_loop().run_in_executor(None, input, "\n  Press ENTER when logged in: ")
        
        print("\n[*] Extracting data...")
        await asyncio.sleep(1)
        
        # Current URL
        current_url = page.url
        print(f"\n  Current URL: {current_url}")
        
        # localStorage
        print("\n" + "="*60)
        print("  LOCAL STORAGE")
        print("="*60)
        ls = await page.evaluate("() => { const d={}; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);d[k]=localStorage.getItem(k);} return d; }")
        for k,v in ls.items():
            display = str(v)[:200]
            if len(str(v)) > 200: display += "..."
            print(f"  {k}: {display}")
        
        # sessionStorage
        print("\n" + "="*60)
        print("  SESSION STORAGE")
        print("="*60)
        try:
            ss = await page.evaluate("() => { const d={}; for(let i=0;i<sessionStorage.length;i++){const k=sessionStorage.key(i);d[k]=sessionStorage.getItem(k);} return d; }")
            for k,v in ss.items():
                display = str(v)[:200]
                if len(str(v)) > 200: display += "..."
                print(f"  {k}: {display}")
        except: ss = {}
        
        # Cookies
        print("\n" + "="*60)
        print("  COOKIES (blackbuck.com)")
        print("="*60)
        cookies = await ctx.cookies(["https://blackbuck.com"])
        for c in cookies:
            print(f"  {c['name']}: {c['value'][:120]}{'...' if len(c['value'])>120 else ''}")
        cookie_dict = {c['name']: c['value'] for c in cookies}
        
        # Identify auth tokens
        print("\n" + "="*60)
        print("  AUTH TOKENS")
        print("="*60)
        auth_kws = ["token", "auth", "access", "jwt", "bearer", "session", "key", "id_token"]
        found = {}
        for k,v in {**ls, **ss}.items():
            if any(x in k.lower() for x in auth_kws):
                found[f"storage:{k}"] = v
        for k,v in cookie_dict.items():
            if any(x in k.lower() for x in auth_kws):
                found[f"cookie:{k}"] = v
        
        if found:
            for name, val in found.items():
                print(f"\n  [{name}]")
                print(f"  {val[:400]}{'...' if len(val)>400 else ''}")
        else:
            print("  No tokens found by keyword. Check full output above.")
        
        # Save
        output = {"url": current_url, "localStorage": ls, "sessionStorage": ss, "cookies": cookie_dict, "tokens": found}
        out_path = Path(__file__).parent / "blackbuck_token.json"
        with open(out_path, "w") as f:
            json.dump(output, f, indent=2)
        print(f"\n[+] Saved to: {out_path}")

asyncio.run(main())
