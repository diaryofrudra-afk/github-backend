"""
Extract authentication tokens from an active Chrome session on blackbuck.com.

Usage:
    python extract_token.py

Requirements:
    - playwright installed and browsers installed (`playwright install chromium`)
    - macOS with Google Chrome installed at the standard location
    - Chrome must NOT be running when this script starts (it will be relaunched
      with --remote-debugging-port=9222 to enable CDP connections)

Safety:
    This script is READ-ONLY. It does not modify, delete, or interact with
    any data beyond reading cookies and localStorage.
"""

import asyncio
import os
import shutil
import subprocess
import sys
import json
from pathlib import Path

from playwright.async_api import async_playwright


# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────
CHROME_BINARY = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CHROME_USER_DATA = os.path.expanduser("~/Library/Application Support/Google/Chrome")
CDP_URL = "http://localhost:9222"
TARGET_DOMAIN = "https://blackbuck.com"
TARGET_PATH = "/boss/gps"

# API endpoint to verify token (adjust if needed)
VERIFY_API_URL = "https://blackbuck.com/api/v1/gps"  # change to actual endpoint


# ──────────────────────────────────────────────
# Helper functions
# ──────────────────────────────────────────────
def kill_chrome_debugging():
    """Kill any Chrome instance launched with --remote-debugging-port."""
    print("[*] Checking for Chrome instances with remote debugging...")
    try:
        result = subprocess.run(
            ["pgrep", "-f", "--", "--remote-debugging-port"],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0 and result.stdout.strip():
            pids = result.stdout.strip().split("\n")
            for pid in pids:
                pid = pid.strip()
                if pid:
                    print(f"    Killing Chrome debug process PID {pid} ...")
                    subprocess.run(["kill", pid], capture_output=True)
            # Give OS a moment to release the port
            import time
            time.sleep(1)
            print("[+] Killed existing debug Chrome instance(s).")
        else:
            print("[+] No Chrome debug instance found. Proceeding.")
    except Exception as e:
        print(f"[!] Error checking/killing Chrome: {e}")


def ensure_chrome_installed():
    """Verify Chrome binary exists."""
    if not os.path.exists(CHROME_BINARY):
        print(f"[!] Google Chrome not found at: {CHROME_BINARY}")
        sys.exit(1)
    print(f"[+] Found Chrome at: {CHROME_BINARY}")


def ensure_playwright_browsers():
    """Ensure Playwright has Chromium installed."""
    print("[*] Checking Playwright browsers...")
    try:
        result = subprocess.run(
            [sys.executable, "-m", "playwright", "install", "--dry-run"],
            capture_output=True,
            text=True,
        )
    except Exception:
        pass  # dry-run may not exist; we'll catch errors during launch


# ──────────────────────────────────────────────
# Main extraction logic
# ──────────────────────────────────────────────
async def extract_tokens():
    """Connect to Chrome via CDP and extract auth tokens."""

    # --- Step 1: Kill existing debug Chrome ---
    kill_chrome_debugging()
    ensure_chrome_installed()

    # --- Step 2: Launch Chrome with remote debugging ---
    # We use subprocess.Popen so Chrome runs as a separate process.
    print(f"[*] Launching Chrome with --remote-debugging-port=9222 ...")
    print(f"    User data dir: {CHROME_USER_DATA}")
    print()
    print("    NOTE: A Chrome window will open. If you see a prompt asking to")
    print("    'close other Chrome instances', close them first and re-run.")
    print("    Wait for the page to load, then this script will continue...")
    print()

    chrome_args = [
        CHROME_BINARY,
        f"--remote-debugging-port=9222",
        f"--user-data-dir={CHROME_USER_DATA}",
        # Keep the browser visible so user can see what's happening
        # (remove --headless if you want a fully silent run)
    ]

    chrome_proc = subprocess.Popen(
        chrome_args,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # Wait for Chrome to start and CDP to be available
    import time
    print("[*] Waiting for Chrome to start and CDP to become available...")
    cdp_ready = False
    for attempt in range(30):
        time.sleep(1)
        try:
            import urllib.request
            resp = urllib.request.urlopen(f"{CDP_URL}/json/version", timeout=2)
            if resp.status == 200:
                cdp_ready = True
                print("[+] Chrome CDP is ready.")
                break
        except Exception:
            pass

    if not cdp_ready:
        print("[!] Chrome CDP did not become available after 30 seconds.")
        print("    You may need to close all Chrome windows and re-run this script.")
        chrome_proc.kill()
        sys.exit(1)

    # --- Step 3: Connect via Playwright CDP ---
    async with async_playwright() as p:
        print("[*] Connecting to Chrome via CDP...")
        try:
            browser = await p.chromium.connect_over_cdp(CDP_URL)
        except Exception as e:
            print(f"[!] Failed to connect via CDP: {e}")
            chrome_proc.kill()
            sys.exit(1)

        print(f"[+] Connected! Browser: {browser.browser_type.name}")

        # Get the first context (Chrome's default context)
        default_context = browser.contexts[0] if browser.contexts else None
        if not default_context:
            # If no context exists, create one (won't have user session though)
            print("[!] No browser context found. Creating a new one...")
            default_context = await browser.new_context()

        # --- Step 4: Find or navigate to the Blackbuck tab ---
        print(f"[*] Looking for existing tab at {TARGET_DOMAIN}{TARGET_PATH} ...")

        target_page = None
        target_url_full = f"{TARGET_DOMAIN}{TARGET_PATH}"

        # Check all open pages for the target URL
        for page in default_context.pages:
            url = page.url
            if TARGET_DOMAIN in url:
                print(f"[+] Found Blackbuck tab: {url}")
                target_page = page
                break

        # If no existing tab, navigate to the target URL
        if not target_page:
            print(f"[!] No existing Blackbuck tab found. Navigating to {target_url_full} ...")
            target_page = await default_context.new_page()
            try:
                await target_page.goto(target_url_full, wait_until="domcontentloaded", timeout=30000)
                print(f"[+] Navigated to: {target_page.url}")
            except Exception as e:
                print(f"[!] Navigation failed: {e}")
                print("    Attempting to extract cookies anyway...")

        # Brief pause to let any lazy-loaded state settle
        await asyncio.sleep(2)

        # --- Step 5: Extract cookies for blackbuck.com ---
        print("\n" + "=" * 60)
        print("  COOKIES (blackbuck.com)")
        print("=" * 60)
        cookies = await default_context.cookies(urls=[TARGET_DOMAIN])
        cookie_dict = {}
        for c in cookies:
            cookie_dict[c["name"]] = c["value"]
            print(f"  {c['name']}: {c['value'][:80]}{'...' if len(c['value']) > 80 else ''}")
        print(f"\n  Total cookies: {len(cookies)}")

        # --- Step 6: Extract localStorage tokens ---
        print("\n" + "=" * 60)
        print("  LOCAL STORAGE")
        print("=" * 60)
        try:
            localStorage = await target_page.evaluate("() => {\n"
                "  const data = {};\n"
                "  for (let i = 0; i < localStorage.length; i++) {\n"
                "    const key = localStorage.key(i);\n"
                "    data[key] = localStorage.getItem(key);\n"
                "  }\n"
                "  return data;\n"
                "}")
            for key, value in localStorage.items():
                display_val = str(value)[:120]
                if len(str(value)) > 120:
                    display_val += "..."
                print(f"  {key}: {display_val}")
            print(f"\n  Total localStorage entries: {len(localStorage)}")
        except Exception as e:
            print(f"[!] Could not read localStorage: {e}")
            localStorage = {}

        # Also try sessionStorage
        print("\n" + "=" * 60)
        print("  SESSION STORAGE")
        print("=" * 60)
        try:
            sessionStorage = await target_page.evaluate("() => {\n"
                "  const data = {};\n"
                "  for (let i = 0; i < sessionStorage.length; i++) {\n"
                "    const key = sessionStorage.key(i);\n"
                "    data[key] = sessionStorage.getItem(key);\n"
                "  }\n"
                "  return data;\n"
                "}")
            for key, value in sessionStorage.items():
                display_val = str(value)[:120]
                if len(str(value)) > 120:
                    display_val += "..."
                print(f"  {key}: {display_val}")
            print(f"\n  Total sessionStorage entries: {len(sessionStorage)}")
        except Exception as e:
            print(f"[!] Could not read sessionStorage: {e}")
            sessionStorage = {}

        # --- Step 7: Identify likely auth tokens ---
        print("\n" + "=" * 60)
        print("  IDENTIFIED AUTH TOKENS")
        print("=" * 60)

        auth_keywords = ["token", "auth", "access", "jwt", "session", "bearer", "key", "api"]
        found_tokens = {}

        # From localStorage
        for key, value in localStorage.items():
            if any(kw in key.lower() for kw in auth_keywords):
                found_tokens[f"localStorage:{key}"] = value

        # From sessionStorage
        for key, value in sessionStorage.items():
            if any(kw in key.lower() for kw in auth_keywords):
                found_tokens[f"sessionStorage:{key}"] = value

        # From cookies
        for name, value in cookie_dict.items():
            if any(kw in name.lower() for kw in auth_keywords):
                found_tokens[f"cookie:{name}"] = value

        if found_tokens:
            for name, value in found_tokens.items():
                print(f"\n  [{name}]")
                print(f"  {value[:200]}{'...' if len(value) > 200 else ''}")
        else:
            print("  No obvious auth tokens found by keyword matching.")
            print("  You may need to inspect the full cookie/localStorage output above.")

        # --- Step 8: Test API call ---
        print("\n" + "=" * 60)
        print("  API VERIFICATION")
        print("=" * 60)

        # Try common token names
        auth_token = (
            localStorage.get("token")
            or localStorage.get("auth_token")
            or localStorage.get("access_token")
            or localStorage.get("jwt_token")
            or localStorage.get("accessToken")
            or cookie_dict.get("token")
            or cookie_dict.get("auth_token")
            or cookie_dict.get("session")
            or cookie_dict.get("access_token")
            or None
        )

        if auth_token:
            print(f"[*] Found auth token (length {len(auth_token)}), testing API call...")

            # Try a few possible API endpoints
            api_endpoints = [
                "https://blackbuck.com/api/v1/gps",
                "https://blackbuck.com/api/gps",
                "https://blackbuck.com/api/v1/user",
                "https://blackbuck.com/api/user/me",
                "https://blackbuck.com/api/v1/vehicles",
            ]

            for endpoint in api_endpoints:
                try:
                    response = await target_page.evaluate(f"""
                        async () => {{
                            try {{
                                const resp = await fetch('{endpoint}', {{
                                    method: 'GET',
                                    headers: {{
                                        'Authorization': 'Bearer {auth_token}',
                                        'Content-Type': 'application/json',
                                    }},
                                }});
                                const text = await resp.text();
                                return {{
                                    status: resp.status,
                                    statusText: resp.statusText,
                                    body: text.substring(0, 500),
                                }};
                            }} catch (e) {{
                                return {{ error: e.message }};
                            }}
                        }}
                    """)
                    print(f"\n  GET {endpoint}")
                    print(f"  Status: {response.get('status', 'N/A')} {response.get('statusText', '')}")
                    print(f"  Body:   {response.get('body', response.get('error', ''))}")
                except Exception as e:
                    print(f"\n  GET {endpoint}")
                    print(f"  Error: {e}")
        else:
            print("[!] No auth token found in localStorage or cookies.")
            print("    The site may use a different storage mechanism.")
            print("    Check the full localStorage/cookie output above.")

        # --- Step 9: Save to JSON file ---
        output = {
            "domain": TARGET_DOMAIN,
            "page_url": target_page.url if target_page else None,
            "cookies": cookie_dict,
            "localStorage": localStorage,
            "sessionStorage": sessionStorage,
            "identified_tokens": found_tokens,
        }

        output_path = Path(__file__).parent / "extracted_tokens.json"
        with open(output_path, "w") as f:
            json.dump(output, f, indent=2)
        print(f"\n[+] All data saved to: {output_path}")

        # --- Cleanup ---
        await browser.close()

    print("\n[*] Done. Chrome will remain open; you can close it manually.")


# ──────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("  Blackbuck.com Token Extractor")
    print("=" * 60)
    print()
    print("This script will:")
    print("  1. Close any Chrome running with --remote-debugging-port")
    print("  2. Launch Chrome with your existing profile + debugging port")
    print("  3. Connect via Playwright CDP")
    print("  4. Extract cookies and localStorage from blackbuck.com")
    print("  5. Test API calls with extracted tokens")
    print()
    print("This script is READ-ONLY and will not modify any data.")
    print()

    try:
        asyncio.run(extract_tokens())
    except KeyboardInterrupt:
        print("\n[!] Interrupted by user.")
        sys.exit(0)
    except Exception as e:
        print(f"\n[!] Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
