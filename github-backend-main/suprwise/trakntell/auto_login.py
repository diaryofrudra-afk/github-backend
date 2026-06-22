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

TNT_LOGIN_URL = "https://web.trakntell.com/tnt/jsp/login.jsp"
TNT_BASE_URL = "https://web.trakntell.com"
TNT_MAPSWEB_URL = "https://mapsweb.trakmtell.com"  # GPS tracking domain — JSESSIONID must be for this domain


# ── Helpers: diagnostics + iframe fallback ────────────────────────────────────

async def _wait_for_form_input(page, label: str = "TrakNTell") -> tuple[int, Optional[str]]:
    """
    Wait for at least one <input> to appear on the page.
    Returns (input_count, bot_error_or_None).
    Logs page URL, title, input count, and detects CAPTCHA/bot pages.
    """
    url = page.url
    title = await page.title()
    logger.info(f"[{label}] Page loaded: url={url}, title={title!r}")

    try:
        await page.wait_for_selector('input', timeout=15_000)
    except Exception as exc:
        logger.warning(f"[{label}] wait_for_selector('input') timed out: {exc}")

    # Count inputs in main frame
    input_count = await page.evaluate("() => document.querySelectorAll('input').length")
    logger.info(f"[{label}] Found {input_count} input(s) in main frame")

    # Detect CAPTCHA / bot-detection
    body_text = (await page.text_content("body") or "").lower()
    captcha_keywords = ["captcha", "cloudflare", "verify you are human", "checking your browser",
                        "just a moment", "bot detection", "access denied"]
    for kw in captcha_keywords:
        if kw in body_text:
            err = f"{label} login page returned a bot-detection challenge ({kw!r}). Headless login may be blocked."
            logger.error(f"[{label}] {err}")
            return input_count, err

    return input_count, None


async def _try_fill_in_frames(page, selectors: list[str], value: str, label: str, field_name: str) -> bool:
    """
    Fallback: try filling a field inside sub-frames (iframes) if main frame failed.
    Returns True if fill succeeded in any frame.
    """
    frames = page.frames
    if len(frames) <= 1:
        return False

    logger.info(f"[{label}] Trying {len(frames) - 1} sub-frame(s) for {field_name}…")
    for frame in frames[1:]:
        for sel in selectors:
            try:
                loc = frame.locator(sel).first
                if await loc.is_visible(timeout=1_000):
                    await loc.fill(value)
                    logger.info(f"[{label}] Filled {field_name} in iframe with selector: {sel}")
                    return True
            except Exception:
                continue
    return False


async def _screenshot_on_fail(page, provider: str) -> None:
    """Capture a debug screenshot on failure."""
    path = f"/tmp/{provider}_login_fail.png"
    try:
        await page.screenshot(path=path)
        logger.info(f"[{provider}] Debug screenshot saved to {path}")
    except Exception as e:
        logger.warning(f"[{provider}] Could not save debug screenshot: {e}")


async def _js_fill_input(page, input_index: int, value: str, label: str, field_name: str) -> bool:
    """
    Last-resort: fill the Nth visible non-hidden input via JS native setter.
    Works regardless of attribute names or framework wrappers.
    """
    try:
        result = await page.evaluate(
            """([idx, val]) => {
                const inputs = Array.from(document.querySelectorAll('input'))
                    .filter(i => i.offsetParent !== null && i.type !== 'hidden');
                const el = inputs[idx];
                if (!el) return false;
                el.focus();
                const setter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype, 'value'
                ).set;
                setter.call(el, val);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }""",
            [input_index, value],
        )
        if result:
            logger.info(f"[{label}] Filled {field_name} via JS fallback (input index {input_index})")
        return bool(result)
    except Exception as e:
        logger.warning(f"[{label}] JS fill fallback failed for {field_name}: {e}")
        return False


# ── Main login function ──────────────────────────────────────────────────────

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
            # Suppress webdriver flag to avoid bot-detection
            await context.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', { get: () => undefined })"
            )
            page = await context.new_page()

            logger.info(f"[TrakNTell] Navigating to {TNT_LOGIN_URL}")
            resp = await page.goto(TNT_LOGIN_URL, wait_until="networkidle", timeout=30_000)
            if resp:
                logger.info(f"[TrakNTell] HTTP response status: {resp.status}, url: {resp.url}")
            await asyncio.sleep(2)

            # Wait for JS-rendered form
            input_count, bot_err = await _wait_for_form_input(page, "TrakNTell")
            if bot_err:
                await _screenshot_on_fail(page, "trakntell")
                await browser.close()
                return {**result, "error": bot_err}

            # ── Set up network interceptor EARLY — before any navigation ──
            # This captures user_id / orgid from tntServiceGetCurrentStatus calls
            # that fire during post-login redirect or on mapsweb page load.
            captured: dict = {}

            async def on_request(req):
                url = req.url
                if "tntServiceGetCurrentStatus" in url or "tntWebCurrentStatus" in url:
                    qs2 = parse_qs(urlparse(url).query)
                    if not captured.get("user_id"):
                        captured["user_id"] = (qs2.get("u") or [None])[0]
                        captured["user_id_encrypt"] = (qs2.get("userIdEncrypt") or [None])[0]
                        captured["orgid"] = (qs2.get("orgid") or [None])[0]
                        logger.info(f"[TrakNTell] Intercepted API call: user_id={captured.get('user_id')}, orgid={captured.get('orgid')}")

            page.on("request", on_request)

            # ── Fill username / phone ──
            user_selectors = [
                'input[placeholder="User ID*"]',
                'input[name="userId"]',
                'input[id="userId"]',
                'input[name="username"]',
                'input[name="user"]',
                'input[placeholder*="user" i]',
                'input[placeholder*="login" i]',
                'input[placeholder*="phone" i]',
                'input[placeholder*="mobile" i]',
                'input[type="tel"]',
                'input[name="phone"]',
                'input[name="mobile"]',
                'input[type="text"]',
            ]
            filled_user = False
            for sel in user_selectors:
                try:
                    loc = page.locator(sel).first
                    if await loc.is_visible(timeout=2_000):
                        await loc.click()
                        await loc.fill(username)
                        filled_user = True
                        logger.info(f"[TrakNTell] Filled username with selector: {sel}")
                        break
                except Exception:
                    continue

            # Iframe fallback
            if not filled_user:
                filled_user = await _try_fill_in_frames(page, user_selectors, username, "TrakNTell", "username")

            # JS fallback: fill first visible input by position
            if not filled_user:
                filled_user = await _js_fill_input(page, 0, username, "TrakNTell", "username")

            if not filled_user:
                await _screenshot_on_fail(page, "trakntell")
                await browser.close()
                return {**result, "error": f"Could not find username field on Trak N Tell login page. url={page.url}, inputs_found={input_count}"}

            await asyncio.sleep(1)

            # ── Fill password ──
            pass_selectors = [
                'input[placeholder="Password*"]',
                'input[type="password"]',
                'input[name="password"]',
                'input[name="pass"]',
                'input[id="password"]',
            ]
            filled_pass = False
            for sel in pass_selectors:
                try:
                    loc = page.locator(sel).first
                    if await loc.is_visible(timeout=2_000):
                        await loc.click()
                        await loc.fill(password)
                        filled_pass = True
                        logger.info(f"[TrakNTell] Filled password with selector: {sel}")
                        break
                except Exception:
                    continue

            # Iframe fallback
            if not filled_pass:
                filled_pass = await _try_fill_in_frames(page, pass_selectors, password, "TrakNTell", "password")

            # JS fallback: fill first password input or second visible input
            if not filled_pass:
                filled_pass = await page.evaluate(
                    """(val) => {
                        const pwInput = document.querySelector('input[type="password"]');
                        if (pwInput && pwInput.offsetParent !== null) {
                            pwInput.focus();
                            const setter = Object.getOwnPropertyDescriptor(
                                window.HTMLInputElement.prototype, 'value'
                            ).set;
                            setter.call(pwInput, val);
                            pwInput.dispatchEvent(new Event('input', { bubbles: true }));
                            pwInput.dispatchEvent(new Event('change', { bubbles: true }));
                            return true;
                        }
                        const inputs = Array.from(document.querySelectorAll('input'))
                            .filter(i => i.offsetParent !== null && i.type !== 'hidden');
                        const el = inputs[1];
                        if (!el) return false;
                        el.focus();
                        const setter = Object.getOwnPropertyDescriptor(
                            window.HTMLInputElement.prototype, 'value'
                        ).set;
                        setter.call(el, val);
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        return true;
                    }""",
                    password,
                )
                if filled_pass:
                    logger.info("[TrakNTell] Filled password via JS fallback")

            if not filled_pass:
                await _screenshot_on_fail(page, "trakntell")
                await browser.close()
                return {**result, "error": f"Could not find password field on Trak N Tell login page. url={page.url}, inputs_found={input_count}"}

            await asyncio.sleep(1)

            # ── Submit ──
            submit_selectors = [
                'input[value="LOGIN"]',
                'input[value="Login"]',
                'input[type="submit"]',
                'button[type="submit"]',
                'button:has-text("Login")',
                'button:has-text("Sign in")',
                'button:has-text("LOG IN")',
                'input[name="login"]',
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
                    pw_loc = page.locator('input[type="password"]').first
                    if await pw_loc.is_visible(timeout=1_000):
                        await pw_loc.press("Enter")
                        submitted = True
                        logger.info("[TrakNTell] Submitted via Enter key on password field")
                except Exception:
                    pass

            if not submitted:
                await _screenshot_on_fail(page, "trakntell")
                await browser.close()
                return {**result, "error": f"Could not find submit button on Trak N Tell login page. url={page.url}"}

            # ── Wait for navigation away from login page ──
            login_url_snapshot = page.url
            try:
                await page.wait_for_url(
                    lambda url: url != login_url_snapshot and "login.jsp" not in url.lower(),
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
                    await _screenshot_on_fail(page, "trakntell")
                    await browser.close()
                    return {**result, "error": f"Trak N Tell login timed out. url={current_url}, inputs_found={input_count}"}

            # ── Extract URL params immediately after login redirect ──
            # The post-login redirect URL may contain u=, userIdEncrypt=, orgid= params.
            # Capture these BEFORE any further navigation that might strip them.
            post_login_url = page.url
            if not captured.get("user_id"):
                parsed_post = urlparse(post_login_url)
                qs_post = parse_qs(parsed_post.query)
                user_id_from_url = (qs_post.get("u") or qs_post.get("userId") or qs_post.get("user_id") or [None])[0]
                if user_id_from_url:
                    captured["user_id"] = user_id_from_url
                    captured["user_id_encrypt"] = (qs_post.get("userIdEncrypt") or qs_post.get("user_id_encrypt") or [None])[0]
                    captured["orgid"] = (qs_post.get("orgid") or qs_post.get("orgId") or [None])[0]
                    logger.info(f"[TrakNTell] Got params from post-login URL: user_id={captured.get('user_id')}, orgid={captured.get('orgid')}")

            await asyncio.sleep(2)

            # ── Navigate to mapsweb.trakmtell.com ──
            # The service.py API URL is on mapsweb.trakmtell.com, so the JSESSIONID
            # must come from that domain (cookies are host-scoped). After login on
            # web.trakntell.com the app redirects here; we navigate explicitly to
            # ensure mapsweb sets its own JSESSIONID and the interceptor fires.
            if "mapsweb.trakmtell.com" not in page.url:
                try:
                    await page.goto(TNT_MAPSWEB_URL, wait_until="networkidle", timeout=20_000)
                    await asyncio.sleep(3)
                    logger.info(f"[TrakNTell] Navigated to mapsweb: {page.url}")
                except Exception as e:
                    logger.warning(f"[TrakNTell] Could not navigate to mapsweb: {e}")

            # ── Extract cookies — prefer mapsweb.trakmtell.com JSESSIONID ──
            cookies = await context.cookies()
            logger.info(f"[TrakNTell] All cookies: {[(c['name'], c.get('domain', '')) for c in cookies]}")

            # JSESSIONID must be scoped to mapsweb.trakmtell.com (the API domain)
            jsessionid = next(
                (c["value"] for c in cookies if c["name"] == "JSESSIONID" and "trakmtell.com" in c.get("domain", "")),
                None,
            )
            if not jsessionid:
                jsessionid = next((c["value"] for c in cookies if c["name"] == "JSESSIONID"), None)

            tnt_s = next((c["value"] for c in cookies if c["name"] == "tnt_s"), None)
            logger.info(f"[TrakNTell] JSESSIONID found: {bool(jsessionid)}, tnt_s found: {bool(tnt_s)}")

            if not jsessionid:
                await _screenshot_on_fail(page, "trakntell")
                await browser.close()
                return {**result, "error": f"JSESSIONID cookie not found after navigating to mapsweb.trakmtell.com. url={page.url}. Login may have failed."}

            # ── Resolve user_id / orgid (intercepted > URL params > JS vars) ──
            user_id: Optional[str] = captured.get("user_id")
            user_id_encrypt: Optional[str] = captured.get("user_id_encrypt")
            orgid: Optional[str] = captured.get("orgid")

            if not user_id:
                current_url = page.url
                parsed = urlparse(current_url)
                qs = parse_qs(parsed.query)
                user_id = (qs.get("u") or qs.get("userId") or qs.get("user_id") or [None])[0]
                user_id_encrypt = (qs.get("userIdEncrypt") or qs.get("user_id_encrypt") or [None])[0]
                orgid = (qs.get("orgid") or qs.get("orgId") or [None])[0]
                logger.info(f"[TrakNTell] URL params — user_id={user_id}, orgid={orgid}")

            if not user_id:
                try:
                    js_vars = await page.evaluate("""
                        () => {
                            const vars = {};
                            const candidates = ['userId', 'user_id', 'USER_ID', 'uid',
                                                'userIdEncrypt', 'orgid', 'orgId', 'ORGID'];
                            for (const k of candidates) {
                                if (window[k]) vars[k] = window[k];
                            }
                            document.querySelectorAll('meta').forEach(m => {
                                if (m.name && m.content) vars['meta:' + m.name] = m.content;
                            });
                            document.querySelectorAll('input[type=hidden]').forEach(i => {
                                if (i.name && i.value) vars['hidden:' + i.name] = i.value;
                            });
                            // Scan sessionStorage (JSP apps often store session data there)
                            try {
                                for (let i = 0; i < sessionStorage.length; i++) {
                                    const k = sessionStorage.key(i);
                                    const v = sessionStorage.getItem(k);
                                    if (v) vars['ss:' + k] = v;
                                }
                            } catch(e) {}
                            return vars;
                        }
                    """)
                    logger.info(f"[TrakNTell] JS vars: {js_vars}")
                    user_id = (js_vars.get("userId") or js_vars.get("user_id") or
                               js_vars.get("USER_ID") or js_vars.get("hidden:userId") or
                               js_vars.get("hidden:u") or js_vars.get("ss:userId") or
                               js_vars.get("ss:u") or js_vars.get("ss:user_id"))
                    user_id_encrypt = (js_vars.get("userIdEncrypt") or js_vars.get("hidden:userIdEncrypt") or
                                       js_vars.get("ss:userIdEncrypt"))
                    orgid = (js_vars.get("orgid") or js_vars.get("orgId") or
                             js_vars.get("ORGID") or js_vars.get("hidden:orgid") or
                             js_vars.get("hidden:orgId") or js_vars.get("ss:orgid") or
                             js_vars.get("ss:orgId"))
                except Exception as e:
                    logger.warning(f"[TrakNTell] Could not extract JS vars: {e}")

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
