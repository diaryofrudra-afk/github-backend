"""
Headless Playwright-based TrakNTell auto-login.
Navigates to mapsweb.trakmtell.com, fills credentials, then extracts:
  - JSESSIONID cookie
  - tnt_s cookie
  - user_id, user_id_encrypt, orgid (from page URL or JS state)
"""
from __future__ import annotations

import asyncio
import logging
import re
from typing import Optional
from urllib.parse import urlparse, parse_qs

logger = logging.getLogger(__name__)

TNT_LOGIN_URL = "https://mapsweb.trakmtell.com/tnt/Login.jsp"
TNT_BASE_URL = "https://mapsweb.trakmtell.com"


async def trakntell_headless_login(username: str, password: str) -> dict:
    """
    Perform headless Playwright login to Trak N Tell.

    Returns:
        {
            "success": bool,
            "user_id": str | None,
            "user_id_encrypt": str | None,
            "orgid": str | None,
            "sessionid": str | None,     # JSESSIONID cookie
            "tnt_s": str | None,          # tnt_s cookie
            "error": str | None,
        }
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return {"success": False, "error": "playwright not installed. Run: pip install playwright && playwright install chromium"}

    result: dict = {
        "success": False,
        "user_id": None,
        "user_id_encrypt": None,
        "orgid": None,
        "sessionid": None,
        "tnt_s": None,
        "error": None,
    }

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            )
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()

            logger.info(f"[TrakNTell] Navigating to {TNT_LOGIN_URL}")
            try:
                await page.goto(TNT_LOGIN_URL, wait_until="domcontentloaded", timeout=30_000)
            except Exception:
                # Try base URL if Login.jsp is not found
                await page.goto(TNT_BASE_URL, wait_until="domcontentloaded", timeout=30_000)
            await asyncio.sleep(2)

            # ── Fill username ──
            user_selectors = [
                'input[name="userId"]',
                'input[id="userId"]',
                'input[name="username"]',
                'input[name="user"]',
                'input[type="text"]:first-of-type',
                'input[placeholder*="user" i]',
                'input[placeholder*="login" i]',
            ]
            filled_user = False
            for sel in user_selectors:
                try:
                    loc = page.locator(sel).first
                    if await loc.is_visible(timeout=2_000):
                        await loc.fill(username)
                        filled_user = True
                        logger.info(f"[TrakNTell] Filled username with selector: {sel}")
                        break
                except Exception:
                    continue

            if not filled_user:
                await browser.close()
                return {**result, "error": "Could not find username field on Trak N Tell login page."}

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
                        logger.info(f"[TrakNTell] Filled password with selector: {sel}")
                        break
                except Exception:
                    continue

            if not filled_pass:
                await browser.close()
                return {**result, "error": "Could not find password field on Trak N Tell login page."}

            # ── Submit ──
            submit_selectors = [
                'input[type="submit"]',
                'button[type="submit"]',
                'button:has-text("Login")',
                'button:has-text("Sign in")',
                'input[name="login"]',
                'input[value="Login"]',
            ]
            submitted = False
            for sel in submit_selectors:
                try:
                    loc = page.locator(sel).first
                    if await loc.is_visible(timeout=2_000):
                        await loc.click()
                        submitted = True
                        logger.info(f"[TrakNTell] Clicked submit with selector: {sel}")
                        break
                except Exception:
                    continue

            if not submitted:
                # Last resort: press Enter on the password field
                try:
                    await page.locator('input[type="password"]').press("Enter")
                    submitted = True
                    logger.info("[TrakNTell] Submitted via Enter key")
                except Exception:
                    pass

            if not submitted:
                await browser.close()
                return {**result, "error": "Could not find submit button on Trak N Tell login page."}

            # ── Wait for navigation away from Login.jsp ──
            try:
                await page.wait_for_url(
                    lambda url: "Login.jsp" not in url and "login" not in url.lower(),
                    timeout=20_000,
                )
                logger.info(f"[TrakNTell] Navigated to: {page.url}")
            except Exception:
                current_url = page.url
                body_text = await page.text_content("body") or ""
                if "invalid" in body_text.lower() or "incorrect" in body_text.lower() or "error" in body_text.lower():
                    await browser.close()
                    return {**result, "error": "Trak N Tell login failed: invalid credentials."}
                # May still be on login page — check if we have a session cookie
                cookies = await context.cookies()
                has_session = any(c["name"] == "JSESSIONID" for c in cookies)
                if not has_session:
                    await browser.close()
                    return {**result, "error": f"Trak N Tell login timed out. Current URL: {current_url}"}

            await asyncio.sleep(2)

            # ── Extract cookies ──
            cookies = await context.cookies()
            cookie_map = {c["name"]: c["value"] for c in cookies}
            jsessionid = cookie_map.get("JSESSIONID")
            tnt_s = cookie_map.get("tnt_s")
            logger.info(f"[TrakNTell] Cookies found: {list(cookie_map.keys())}")

            if not jsessionid:
                await browser.close()
                return {**result, "error": "JSESSIONID cookie not found after login. Login may have failed."}

            # ── Extract user_id, user_id_encrypt, orgid from current URL ──
            current_url = page.url
            user_id: Optional[str] = None
            user_id_encrypt: Optional[str] = None
            orgid: Optional[str] = None

            parsed = urlparse(current_url)
            qs = parse_qs(parsed.query)

            user_id = (qs.get("u") or qs.get("userId") or qs.get("user_id") or [None])[0]
            user_id_encrypt = (qs.get("userIdEncrypt") or qs.get("user_id_encrypt") or [None])[0]
            orgid = (qs.get("orgid") or qs.get("orgId") or [None])[0]

            logger.info(f"[TrakNTell] URL params — user_id={user_id}, orgid={orgid}")

            # ── If not in URL, try extracting from page JavaScript ──
            if not user_id:
                try:
                    js_vars = await page.evaluate("""
                        () => {
                            const vars = {};
                            const candidates = [
                                'userId', 'user_id', 'USER_ID', 'uid',
                                'userIdEncrypt', 'orgid', 'orgId', 'ORGID',
                            ];
                            for (const k of candidates) {
                                if (window[k]) vars[k] = window[k];
                            }
                            // Also try common meta tags
                            document.querySelectorAll('meta').forEach(m => {
                                if (m.name && m.content) vars['meta:' + m.name] = m.content;
                            });
                            // Try hidden inputs
                            document.querySelectorAll('input[type=hidden]').forEach(i => {
                                if (i.name && i.value) vars['hidden:' + i.name] = i.value;
                            });
                            return vars;
                        }
                    """)
                    logger.info(f"[TrakNTell] JS vars: {js_vars}")

                    user_id = (
                        js_vars.get("userId") or js_vars.get("user_id") or js_vars.get("USER_ID") or
                        js_vars.get("hidden:userId") or js_vars.get("hidden:u")
                    )
                    user_id_encrypt = (
                        js_vars.get("userIdEncrypt") or js_vars.get("hidden:userIdEncrypt")
                    )
                    orgid = (
                        js_vars.get("orgid") or js_vars.get("orgId") or js_vars.get("ORGID") or
                        js_vars.get("hidden:orgid") or js_vars.get("hidden:orgId")
                    )
                except Exception as e:
                    logger.warning(f"[TrakNTell] Could not extract JS vars: {e}")

            # ── Intercept a GPS API call to get params if still missing ──
            if not user_id or not orgid:
                logger.info("[TrakNTell] Intercepting network calls to find user params...")
                captured: dict = {}

                async def on_request(req):
                    url = req.url
                    if "tntServiceGetCurrentStatus" in url or "tntWebCurrentStatus" in url:
                        qs2 = parse_qs(urlparse(url).query)
                        captured["user_id"] = (qs2.get("u") or [None])[0]
                        captured["user_id_encrypt"] = (qs2.get("userIdEncrypt") or [None])[0]
                        captured["orgid"] = (qs2.get("orgid") or [None])[0]

                page.on("request", on_request)

                # Reload or navigate to trigger the GPS API call
                try:
                    await page.reload(wait_until="domcontentloaded", timeout=15_000)
                    await asyncio.sleep(3)
                except Exception:
                    pass

                if captured.get("user_id"):
                    user_id = captured["user_id"]
                    user_id_encrypt = captured.get("user_id_encrypt")
                    orgid = captured["orgid"]
                    logger.info(f"[TrakNTell] Got params from intercepted API call: user_id={user_id}, orgid={orgid}")

            await browser.close()

            result = {
                "success": True,
                "user_id": user_id,
                "user_id_encrypt": user_id_encrypt,
                "orgid": orgid,
                "sessionid": jsessionid,
                "tnt_s": tnt_s,
                "error": None,
            }

    except Exception as e:
        logger.error(f"[TrakNTell] Auto-login failed: {e}", exc_info=True)
        result = {**result, "success": False, "error": str(e)}

    return result
