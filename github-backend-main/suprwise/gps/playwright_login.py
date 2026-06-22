"""
Auto-launch browser, wait for login, extract token automatically.
No interactive prompt needed — waits for URL change or 120 seconds.
"""

import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright

LOGIN_URL = "https://blackbuck.com/boss/sign-in"
GPS_URL = "https://blackbuck.com/boss/gps"

async def main():
    async with async_playwright() as p:
        print("[*] Launching Chromium (headed)...")
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        await page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        """)
        
        print(f"[*] Going to {LOGIN_URL} ...")
        await page.goto(LOGIN_URL, wait_until="domcontentloaded", timeout=30000)
        
        print("\n" + "="*60)
        print("  LOG IN IN THE BROWSER WINDOW")
        print("="*60)
        print("  The script will auto-detect when you're logged in")
        print("  and navigate to the GPS page (up to 2 minutes).")
        print("="*60)
        
        # Wait for URL to change away from sign-in (user logged in)
        max_wait = 120  # seconds
        start = asyncio.get_event_loop().time()
        logged_in = False
        
        while (asyncio.get_event_loop().time() - start) < max_wait:
            current = page.url
            if "sign-in" not in current and "sign_up" not in current:
                print(f"\n[+] Detected navigation away from login: {current}")
                logged_in = True
                break
            await asyncio.sleep(2)
        
        if not logged_in:
            print("[!] Timeout waiting for login. Trying GPS page anyway...")
            await page.goto(GPS_URL, wait_until="domcontentloaded", timeout=15000)
        
        await asyncio.sleep(2)
        current_url = page.url
        print(f"\n  Current URL: {current_url}")
        
        # Extract localStorage
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
        except:
            ss = {}
        
        # Cookies
        print("\n" + "="*60)
        print("  COOKIES")
        print("="*60)
        cookies = await context.cookies()
        bb_cookies = {}
        for c in cookies:
            if "blackbuck" in c.get("domain","").lower() or "blackbuck" in c.get("name","").lower():
                print(f"  {c['name']}: {c['value'][:120]}{'...' if len(c['value'])>120 else ''}")
                bb_cookies[c['name']] = c['value']
        
        # Auth tokens
        print("\n" + "="*60)
        print("  AUTH TOKENS")
        print("="*60)
        auth_kws = ["token", "auth", "access", "jwt", "bearer", "session", "key", "id_token", "refresh"]
        found = {}
        for k,v in {**ls, **ss}.items():
            if any(x in k.lower() for x in auth_kws):
                found[f"storage:{k}"] = v
        for k,v in bb_cookies.items():
            if any(x in k.lower() for x in auth_kws):
                found[f"cookie:{k}"] = v
        
        if found:
            for name, val in found.items():
                print(f"\n  [{name}]")
                print(f"  {val[:500]}{'...' if len(val)>500 else ''}")
        else:
            print("  No obvious tokens found. Full data saved to file.")
        
        # Also try to find API calls the page makes
        print("\n" + "="*60)
        print("  INTERCEPTING NETWORK REQUESTS (5 seconds)...")
        print("="*60)
        
        api_calls = []
        async def on_response(response):
            url = response.url
            if "blackbuck" in url.lower() and ("api" in url.lower() or "graphql" in url.lower()):
                try:
                    body = await response.text()
                    api_calls.append({"url": url, "status": response.status, "body_preview": body[:300]})
                except:
                    pass
        
        page.on("response", on_response)
        # Reload to capture API calls
        await page.reload(wait_until="domcontentloaded", timeout=15000)
        await asyncio.sleep(5)
        
        for call in api_calls:
            print(f"\n  {call['url']}")
            print(f"  Status: {call['status']}")
            print(f"  Body: {call['body_preview'][:200]}")
        
        # Save everything
        output = {
            "url": current_url,
            "localStorage": ls,
            "sessionStorage": ss,
            "cookies": bb_cookies,
            "auth_tokens": found,
            "api_calls": api_calls,
        }
        out_path = Path(__file__).parent / "blackbuck_token.json"
        with open(out_path, "w") as f:
            json.dump(output, f, indent=2)
        print(f"\n[+] Full data saved to: {out_path}")
        
        # Keep browser open for 30 more seconds so user can see results
        print("\n[*] Browser will close in 30 seconds...")
        await asyncio.sleep(30)
        await browser.close()

asyncio.run(main())
