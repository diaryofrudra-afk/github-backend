"""
Headless Playwright-based Blackbuck auto-login.
Navigates to blackbuck.com/boss/sign-in, fills credentials, extracts accessToken
and fleet_owner_id, then returns them for DB storage.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

BLACKBUCK_LOGIN_URL = "https://blackbuck.com/boss/sign-in"
BLACKBUCK_GPS_URL = "https://blackbuck.com/boss/gps"
BLACKBUCK_PROFILE_API = "https://api-fms.blackbuck.com/fms/api/freight_supply/userProfile/v1"


async def blackbuck_headless_login(username: str, password: str) -> dict:
    """
    Perform headless Playwright login to Blackbuck.

    Returns:
        {
            "success": bool,
            "auth_token": str | None,
            "fleet_owner_id": str | None,
            "error": str | None,
        }
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return {"success": False, "error": "playwright not installed. Run: pip install playwright && playwright install chromium"}

    result: dict = {"success": False, "auth_token": None, "fleet_owner_id": None, "error": None}

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            )
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            # Anti-bot: suppress webdriver flag
            await context.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => undefined })")

            page = await context.new_page()

            logger.info(f"[Blackbuck] Navigating to {BLACKBUCK_LOGIN_URL}")
            await page.goto(BLACKBUCK_LOGIN_URL, wait_until="domcontentloaded", timeout=30_000)
            await asyncio.sleep(2)

            # ── Fill phone / username ──
            phone_selectors = [
                'input[type="tel"]',
                'input[name="phone"]',
                'input[name="username"]',
                'input[name="mobile"]',
                'input[placeholder*="phone" i]',
                'input[placeholder*="mobile" i]',
                'input[placeholder*="number" i]',
            ]
            filled_phone = False
            for sel in phone_selectors:
                try:
                    loc = page.locator(sel).first
                    if await loc.is_visible(timeout=2_000):
                        await loc.fill(username)
                        filled_phone = True
                        logger.info(f"[Blackbuck] Filled phone with selector: {sel}")
                        break
                except Exception:
                    continue

            if not filled_phone:
                await browser.close()
                return {"success": False, "error": "Could not find phone/username field on Blackbuck login page."}

            # ── Fill password ──
            pass_selectors = [
                'input[type="password"]',
                'input[name="password"]',
                'input[name="pass"]',
            ]
            filled_pass = False
            for sel in pass_selectors:
                try:
                    loc = page.locator(sel).first
                    if await loc.is_visible(timeout=2_000):
                        await loc.fill(password)
                        filled_pass = True
                        logger.info(f"[Blackbuck] Filled password with selector: {sel}")
                        break
                except Exception:
                    continue

            if not filled_pass:
                await browser.close()
                return {"success": False, "error": "Could not find password field on Blackbuck login page."}

            # ── Submit ──
            submit_selectors = [
                'button[type="submit"]',
                'button:has-text("Sign in")',
                'button:has-text("Login")',
                'button:has-text("Log in")',
                'input[type="submit"]',
            ]
            submitted = False
            for sel in submit_selectors:
                try:
                    loc = page.locator(sel).first
                    if await loc.is_visible(timeout=2_000):
                        await loc.click()
                        submitted = True
                        logger.info(f"[Blackbuck] Clicked submit with selector: {sel}")
                        break
                except Exception:
                    continue

            if not submitted:
                await browser.close()
                return {"success": False, "error": "Could not find submit button on Blackbuck login page."}

            # ── Wait for navigation away from sign-in ──
            try:
                await page.wait_for_url(
                    lambda url: "sign-in" not in url and "sign_up" not in url,
                    timeout=30_000,
                )
                logger.info(f"[Blackbuck] Navigated to: {page.url}")
            except Exception:
                # Check for error messages on the page
                error_text = await page.text_content("body") or ""
                if "incorrect" in error_text.lower() or "invalid" in error_text.lower() or "wrong" in error_text.lower():
                    await browser.close()
                    return {"success": False, "error": "Blackbuck login failed: invalid credentials."}
                await browser.close()
                return {"success": False, "error": "Blackbuck login timed out. Check credentials."}

            await asyncio.sleep(2)

            # ── Navigate to GPS page to ensure localStorage is populated ──
            if BLACKBUCK_GPS_URL not in page.url:
                await page.goto(BLACKBUCK_GPS_URL, wait_until="domcontentloaded", timeout=20_000)
                await asyncio.sleep(2)

            # ── Extract accessToken from localStorage ──
            raw_token = await page.evaluate(
                "() => localStorage.getItem('accessToken')"
            )
            if not raw_token:
                await browser.close()
                return {"success": False, "error": "accessToken not found in localStorage after Blackbuck login."}

            # Token may be a JSON string like '"eyJ..."' — unwrap it
            try:
                auth_token = json.loads(raw_token)
            except (json.JSONDecodeError, TypeError):
                auth_token = raw_token

            logger.info(f"[Blackbuck] Extracted accessToken (len={len(auth_token)})")

            # ── Fetch fleet_owner_id from profile API ──
            fleet_owner_id: Optional[str] = None
            try:
                api_result = await page.evaluate(f"""
                    async () => {{
                        const resp = await fetch('{BLACKBUCK_PROFILE_API}', {{
                            headers: {{
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer {{}}'.replace('{{}}', '{auth_token}')
                            }}
                        }});
                        const body = await resp.text();
                        return {{ status: resp.status, body }};
                    }}
                """)
                if api_result.get("status") == 200:
                    profile = json.loads(api_result["body"])
                    fleet_owner_id = str(profile.get("fleet_owner_id", ""))
                    logger.info(f"[Blackbuck] Got fleet_owner_id: {fleet_owner_id}")
                else:
                    logger.warning(f"[Blackbuck] Profile API returned {api_result.get('status')}")
            except Exception as e:
                logger.warning(f"[Blackbuck] Could not fetch fleet_owner_id: {e}")

            await browser.close()

            result = {
                "success": True,
                "auth_token": auth_token,
                "fleet_owner_id": fleet_owner_id,
                "error": None,
            }

    except Exception as e:
        logger.error(f"[Blackbuck] Auto-login failed: {e}", exc_info=True)
        result = {"success": False, "error": str(e), "auth_token": None, "fleet_owner_id": None}

    return result
