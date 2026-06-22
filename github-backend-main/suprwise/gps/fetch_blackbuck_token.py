"""
Extract Blackbuck token from your already-open Chrome session.
This connects via CDP to read localStorage from the blackbuck.com/boss/gps page.

IMPORTANT: You need to restart Chrome with --remote-debugging-port=9222 first.

Do this:
1. Fully quit Chrome (Cmd+Q)
2. Open Terminal and run:
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222
3. Wait for Chrome to open, then navigate to blackbuck.com/boss/gps and log in
4. Run this script: python3 fetch_blackbuck_token.py
"""

import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright

CDP_URL = "http://127.0.0.1:9222"
TARGET_URL = "https://blackbuck.com/boss/gps"

async def extract():
    async with async_playwright() as p:
        print("[*] Connecting to Chrome via CDP...")
        try:
            browser = await p.chromium.connect_over_cdp(CDP_URL)
        except Exception as e:
            print(f"[!] Cannot connect to Chrome at {CDP_URL}")
            print(f"    Error: {e}")
            print("\nMake sure Chrome is running with --remote-debugging-port=9222")
            sys.exit(1)
        
        print("[+] Connected!")
        
        # Get the default browser context
        contexts = browser.contexts
        if not contexts:
            print("[!] No browser contexts found.")
            sys.exit(1)
        
        ctx = contexts[0]
        
        # Find the blackbuck tab
        target_page = None
        for page in ctx.pages:
            url = page.url
            print(f"  Tab: {url}")
            if "blackbuck.com" in url:
                target_page = page
                break
        
        if not target_page:
            print("\n[!] No blackbuck.com tab found.")
            print("[*] Navigating to blackbuck.com/boss/gps...")
            target_page = await ctx.new_page()
            await target_page.goto(TARGET_URL, wait_until="domcontentloaded", timeout=30000)
            print(f"[+] Loaded: {target_page.url}")
        
        await asyncio.sleep(2)
        
        # ─── Extract localStorage ───
        print("\n" + "="*60)
        print("  LOCAL STORAGE")
        print("="*60)
        localStorage = await target_page.evaluate("() => JSON.stringify(localStorage)")
        ls_data = json.loads(localStorage)
        for key, val in ls_data.items():
            display = str(val)[:150]
            if len(str(val)) > 150:
                display += "..."
            print(f"  {key}: {display}")
        
        # ─── Extract sessionStorage ───
        print("\n" + "="*60)
        print("  SESSION STORAGE")
        print("="*60)
        try:
            sessionStorage = await target_page.evaluate("() => JSON.stringify(sessionStorage)")
            ss_data = json.loads(sessionStorage)
            for key, val in ss_data.items():
                display = str(val)[:150]
                if len(str(val)) > 150:
                    display += "..."
                print(f"  {key}: {display}")
        except Exception as e:
            print(f"  (none or error: {e})")
            ss_data = {}
        
        # ─── Extract cookies ───
        print("\n" + "="*60)
        print("  COOKIES")
        print("="*60)
        cookies = await ctx.cookies(["https://blackbuck.com"])
        for c in cookies:
            print(f"  {c['name']}: {c['value'][:100]}{'...' if len(c['value'])>100 else ''}")
        cookie_dict = {c['name']: c['value'] for c in cookies}
        
        # ─── Find auth token ───
        print("\n" + "="*60)
        print("  AUTH TOKEN IDENTIFICATION")
        print("="*60)
        
        auth_keywords = ["token", "auth", "access", "jwt", "bearer", "session", "key", "id_token", "refresh"]
        
        found = {}
        for key, val in {**ls_data, **ss_data}.items():
            if any(kw in key.lower() for kw in auth_keywords):
                found[f"storage:{key}"] = val
        
        for name, val in cookie_dict.items():
            if any(kw in name.lower() for kw in auth_keywords):
                found[f"cookie:{name}"] = val
        
        if found:
            for name, val in found.items():
                print(f"\n  [{name}]")
                print(f"  {val[:300]}{'...' if len(val)>300 else ''}")
        else:
            print("  No obvious auth tokens found by keyword.")
            print("  Checking page's JavaScript variables for auth data...")
        
        # ─── Check for common JS auth patterns ───
        print("\n" + "="*60)
        print("  PAGE AUTH STATE (from window object)")
        print("="*60)
        
        js_checks = [
            ("window.__NEXT_DATA__", "Next.js app data"),
            ("window.__initialState__", "Redux initial state"),
            ("window.AUTH_TOKEN", "Direct auth token variable"),
            ("window.token", "Token variable"),
            ("window.user", "User object"),
        ]
        
        for js_var, desc in js_checks:
            try:
                result = await target_page.evaluate(f"""
                    (() => {{
                        try {{
                            const val = {js_var};
                            if (val) return JSON.stringify(val);
                            return null;
                        }} catch(e) {{ return null; }}
                    }})()
                """)
                if result:
                    print(f"  {js_var} ({desc}): {result[:200]}")
            except:
                pass
        
        # ─── Identify API endpoints from Network ───
        print("\n" + "="*60)
        print("  SUGGESTED NEXT STEP")
        print("="*60)
        print("""
  The token has been extracted above. To use it with Suprwise:
  
  1. Copy the token value from the output above
  2. Add it to your .env file:
     BLACKBUCK_AUTH_TOKEN=<paste_token_here>
  
  3. The backend will now use this token to make API requests
     to Blackbuck instead of trying to automate login.
        """)
        
        # ─── Save all data ───
        output = {
            "localStorage": ls_data,
            "sessionStorage": ss_data,
            "cookies": cookie_dict,
            "identified_tokens": found,
            "page_url": target_page.url,
        }
        output_path = Path(__file__).parent / "extracted_blackbuck_data.json"
        with open(output_path, "w") as f:
            json.dump(output, f, indent=2, default=str)
        print(f"\n[+] Full data saved to: {output_path}")

if __name__ == "__main__":
    asyncio.run(extract())
