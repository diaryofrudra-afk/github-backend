"""
Headless Playwright-based Blackbuck auto-login.
Navigates to blackbuck.com/boss/sign-in, fills credentials, extracts accessToken
and fleet_owner_id, then returns them for DB storage.
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Optional

logger = logging.getLogger(__name__)

# In-memory OTP sessions: session_token → { playwright, browser, page }
# Cleaned up after 10 minutes or on successful verification.
_otp_sessions: dict[str, dict] = {}

BLACKBUCK_LOGIN_URL = "https://blackbuck.com/boss/sign-in"
BLACKBUCK_GPS_URL = "https://blackbuck.com/boss/gps"
BLACKBUCK_PROFILE_API = "https://api-fms.blackbuck.com/fms/api/freight_supply/userProfile/v1"


# ── Helpers: diagnostics + iframe fallback ────────────────────────────────────

async def _js_fill_input(page, input_index: int, value: str, label: str, field_name: str) -> bool:
    """
    Last-resort: fill the Nth visible non-hidden input via JS native setter.
    Works regardless of attribute names or Ant Design wrapper divs.
    Uses native input value setter + synthetic React events so onChange fires.
    """
    try:
        result = await page.evaluate(
            """([idx, val]) => {
                const inputs = Array.from(document.querySelectorAll('input'))
                    .filter(i => i.offsetParent !== null && i.type !== 'hidden');
                const el = inputs[idx];
                if (!el) return false;
                el.focus();
                // React-compatible: native setter + synthetic events
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


async def _wait_for_form_input(page, label: str = "Blackbuck") -> tuple[int, Optional[str]]:
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


# ── Main login functions ──────────────────────────────────────────────────────

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
            resp = await page.goto(BLACKBUCK_LOGIN_URL, wait_until="networkidle", timeout=30_000)
            if resp:
                logger.info(f"[Blackbuck] HTTP response status: {resp.status}, url: {resp.url}")
            await asyncio.sleep(2)

            # Wait for JS-rendered form (React SPA)
            input_count, bot_err = await _wait_for_form_input(page, "Blackbuck")
            if bot_err:
                await _screenshot_on_fail(page, "blackbuck")
                await browser.close()
                return {**result, "error": bot_err}

            # Click 'Login with password' to render the password input
            # Try multiple text variants and wait up to 5s for the link to appear
            login_with_pw_clicked = False
            for pw_link_text in ["Login with password", "login with password", "Use Password", "Password Login"]:
                try:
                    loc = page.get_by_text(pw_link_text, exact=False).first
                    if await loc.is_visible(timeout=2_000):
                        await loc.click()
                        login_with_pw_clicked = True
                        logger.info(f"[Blackbuck] Clicked '{pw_link_text}' link")
                        break
                except Exception:
                    continue
            if not login_with_pw_clicked:
                logger.info("[Blackbuck] 'Login with password' link not found — assuming password form already visible")
            await asyncio.sleep(3)  # Give the password form time to render

            # ── Fill phone / username ──
            phone_selectors = [
                'input.number-input',
            ]
            filled_phone = False
            for sel in phone_selectors:
                try:
                    loc = page.locator(sel).first
                    if await loc.is_visible(timeout=2_000):
                        await loc.click()
                        await loc.fill(username)
                        filled_phone = True
                        logger.info(f"[Blackbuck] Filled phone with selector: {sel}")
                        break
                except Exception:
                    continue

            # Iframe fallback
            if not filled_phone:
                filled_phone = await _try_fill_in_frames(page, phone_selectors, username, "Blackbuck", "phone")

            # JS fallback: fill first visible input by position
            if not filled_phone:
                filled_phone = await _js_fill_input(page, 0, username, "Blackbuck", "phone")

            if not filled_phone:
                await _screenshot_on_fail(page, "blackbuck")
                await browser.close()
                return {"success": False, "error": f"Could not find phone/username field on Blackbuck login page. url={page.url}, inputs_found={input_count}"}

            await asyncio.sleep(1)

            # ── Fill password ──
            pass_selectors = [
                'input[type="password"]',
                'input.password-input',
            ]
            filled_pass = False
            for sel in pass_selectors:
                try:
                    loc = page.locator(sel).first
                    if await loc.is_visible(timeout=2_000):
                        await loc.click()
                        await loc.fill(password)
                        filled_pass = True
                        logger.info(f"[Blackbuck] Filled password with selector: {sel}")
                        break
                except Exception:
                    continue

            # Iframe fallback
            if not filled_pass:
                filled_pass = await _try_fill_in_frames(page, pass_selectors, password, "Blackbuck", "password")

            # JS fallback: fill second visible input by position (or first password input)
            if not filled_pass:
                # Try password type first, then fall back to second input
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
                        // fallback: second visible input
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
                    logger.info("[Blackbuck] Filled password via JS fallback")

            if not filled_pass:
                await _screenshot_on_fail(page, "blackbuck")
                await browser.close()
                return {"success": False, "error": f"Could not find password field on Blackbuck login page. url={page.url}, inputs_found={input_count}"}

            await asyncio.sleep(1)

            # ── Submit ──
            submit_selectors = [
                'button.continue-btn',
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

            # Last resort: press Enter on the password field
            if not submitted:
                try:
                    pw_loc = page.locator('input[type="password"]').first
                    if await pw_loc.is_visible(timeout=1_000):
                        await pw_loc.press("Enter")
                        submitted = True
                        logger.info("[Blackbuck] Submitted via Enter key on password field")
                except Exception:
                    pass

            if not submitted:
                await _screenshot_on_fail(page, "blackbuck")
                await browser.close()
                return {"success": False, "error": f"Could not find submit button on Blackbuck login page. url={page.url}"}

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
                await _screenshot_on_fail(page, "blackbuck")
                await browser.close()
                return {"success": False, "error": f"Blackbuck login timed out. url={page.url}. Check credentials."}

            await asyncio.sleep(2)

            # ── Navigate to GPS page to ensure localStorage is populated ──
            if BLACKBUCK_GPS_URL not in page.url:
                gps_resp = await page.goto(BLACKBUCK_GPS_URL, wait_until="networkidle", timeout=20_000)
                if gps_resp:
                    logger.info(f"[Blackbuck] GPS page status: {gps_resp.status}")
                await asyncio.sleep(2)

            # ── Extract accessToken from localStorage (poll up to 10s) ──
            # The React SPA may not have written the token to localStorage immediately
            # after navigation — poll with short sleeps before giving up.
            raw_token = None
            for _ in range(5):
                raw_token = await page.evaluate("() => localStorage.getItem('accessToken')")
                if raw_token:
                    break
                await asyncio.sleep(2)

            if not raw_token:
                await _screenshot_on_fail(page, "blackbuck")
                await browser.close()
                return {"success": False, "error": "accessToken not found in localStorage after Blackbuck login."}

            # Token may be a JSON string like '"eyJ..."' — unwrap it
            try:
                auth_token = json.loads(raw_token)
            except (json.JSONDecodeError, TypeError):
                auth_token = raw_token

            logger.info(f"[Blackbuck] Extracted accessToken (len={len(auth_token)})")

            # ── Fetch fleet_owner_id: localStorage first, then profile API ──
            # localStorage.fleetOwnerID is populated by the React SPA after login
            # and is more reliable than the profile API (which may be blocked by CORS).
            fleet_owner_id: Optional[str] = None
            try:
                raw_fleet_id = await page.evaluate(
                    "() => localStorage.getItem('fleetOwnerID') || localStorage.getItem('fleet_owner_id') || localStorage.getItem('userFleetId') || ''"
                )
                if raw_fleet_id:
                    fleet_owner_id = raw_fleet_id.strip().strip('"')
                    logger.info(f"[Blackbuck] Got fleet_owner_id from localStorage: {fleet_owner_id}")
            except Exception as e:
                logger.warning(f"[Blackbuck] Could not read fleet_owner_id from localStorage: {e}")

            # Fallback: profile API (pass token safely as argument — no f-string injection)
            if not fleet_owner_id:
                try:
                    api_result = await page.evaluate(
                        """async (profileUrl, token) => {
                            try {
                                const resp = await fetch(profileUrl, {
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': 'Bearer ' + token,
                                    }
                                });
                                const body = await resp.text();
                                return { status: resp.status, body };
                            } catch (e) {
                                return { status: 0, body: '', error: e.message };
                            }
                        }""",
                        BLACKBUCK_PROFILE_API,
                        auth_token,
                    )
                    if api_result.get("status") == 200:
                        profile = json.loads(api_result["body"])
                        fleet_owner_id = str(profile.get("fleet_owner_id", ""))
                        logger.info(f"[Blackbuck] Got fleet_owner_id from profile API: {fleet_owner_id}")
                    else:
                        logger.warning(f"[Blackbuck] Profile API returned {api_result.get('status')}: {api_result.get('error', '')}")
                except Exception as e:
                    logger.warning(f"[Blackbuck] Could not fetch fleet_owner_id from profile API: {e}")

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


async def _cleanup_otp_session(session_token: str, delay: int = 600) -> None:
    """Remove a pending OTP session after a delay (default 10 min)."""
    await asyncio.sleep(delay)
    session = _otp_sessions.pop(session_token, None)
    if session:
        try:
            await session["browser"].close()
            await session["playwright"].stop()
        except Exception:
            pass
        logger.info(f"[Blackbuck OTP] Session {session_token[:8]}… timed out and was cleaned up")


async def blackbuck_request_otp(phone: str) -> dict:
    """
    Step 1 of OTP login: navigate to Blackbuck sign-in, fill the phone number,
    click Send OTP, and park the Playwright session for step 2.

    Returns:
        { "success": bool, "session_token": str | None, "error": str | None }
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return {"success": False, "session_token": None,
                "error": "playwright not installed. Run: pip install playwright && playwright install chromium"}

    try:
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        await context.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => undefined })")
        page = await context.new_page()

        logger.info(f"[Blackbuck OTP] Navigating to {BLACKBUCK_LOGIN_URL}")
        resp = await page.goto(BLACKBUCK_LOGIN_URL, wait_until="networkidle", timeout=30_000)
        if resp:
            logger.info(f"[Blackbuck OTP] HTTP response status: {resp.status}, url: {resp.url}")
        await asyncio.sleep(2)

        # Wait for JS-rendered form (React SPA)
        input_count, bot_err = await _wait_for_form_input(page, "Blackbuck OTP")
        if bot_err:
            await _screenshot_on_fail(page, "blackbuck_otp")
            await browser.close()
            await playwright.stop()
            return {"success": False, "session_token": None, "error": bot_err}

        # Fill phone number
        phone_selectors = [
            'input.number-input',
        ]
        filled = False
        for sel in phone_selectors:
            try:
                loc = page.locator(sel).first
                if await loc.is_visible(timeout=2_000):
                    await loc.click()
                    await loc.fill(phone)
                    filled = True
                    logger.info(f"[Blackbuck OTP] Filled phone with selector: {sel}")
                    break
            except Exception:
                continue

        # Iframe fallback
        if not filled:
            filled = await _try_fill_in_frames(page, phone_selectors, phone, "Blackbuck OTP", "phone")

        # JS fallback: fill first visible input by position
        if not filled:
            filled = await _js_fill_input(page, 0, phone, "Blackbuck OTP", "phone")

        if not filled:
            await _screenshot_on_fail(page, "blackbuck_otp")
            await browser.close()
            await playwright.stop()
            return {"success": False, "session_token": None,
                    "error": f"Could not find phone field on Blackbuck login page. url={page.url}, inputs_found={input_count}"}

        # Click Send OTP button
        otp_btn_selectors = [
            'button.continue-btn',
        ]
        clicked = False
        for sel in otp_btn_selectors:
            try:
                loc = page.locator(sel).first
                if await loc.is_visible(timeout=2_000):
                    await loc.click()
                    clicked = True
                    logger.info(f"[Blackbuck OTP] Clicked OTP button: {sel}")
                    break
            except Exception:
                continue

        # Last resort: press Enter on the phone field
        if not clicked:
            try:
                loc = page.locator('input').first
                if await loc.is_visible(timeout=1_000):
                    await loc.press("Enter")
                    clicked = True
                    logger.info("[Blackbuck OTP] Submitted via Enter key")
            except Exception:
                pass

        if not clicked:
            await _screenshot_on_fail(page, "blackbuck_otp")
            await browser.close()
            await playwright.stop()
            return {"success": False, "session_token": None,
                    "error": f"Could not find Send OTP button on Blackbuck login page. url={page.url}"}

        await asyncio.sleep(2)

        session_token = str(uuid.uuid4())
        _otp_sessions[session_token] = {
            "playwright": playwright,
            "browser": browser,
            "context": context,
            "page": page,
        }
        # Auto-cleanup after 10 minutes
        asyncio.create_task(_cleanup_otp_session(session_token, delay=600))

        logger.info(f"[Blackbuck OTP] Session created: {session_token[:8]}…")
        return {"success": True, "session_token": session_token, "error": None}

    except Exception as e:
        logger.error(f"[Blackbuck OTP] request_otp failed: {e}", exc_info=True)
        return {"success": False, "session_token": None, "error": str(e)}


async def blackbuck_verify_otp(session_token: str, otp: str) -> dict:
    """
    Step 2 of OTP login: enter the OTP, complete login, extract accessToken.

    Returns:
        { "success": bool, "auth_token": str | None, "fleet_owner_id": str | None, "error": str | None }
    """
    session = _otp_sessions.get(session_token)
    if not session:
        return {"success": False, "auth_token": None, "fleet_owner_id": None,
                "error": "OTP session expired or not found. Please request a new OTP."}

    page = session["page"]
    browser = session["browser"]
    playwright = session["playwright"]

    try:
        # Log input count for diagnostics
        input_count = await page.evaluate("() => document.querySelectorAll('input').length")
        logger.info(f"[Blackbuck OTP] OTP page has {input_count} input(s)")

        # Fill OTP field
        otp_selectors = [
            'input[name="otp"]',
            'input[name="OTP"]',
            'input[placeholder*="otp" i]',
            'input[placeholder*="enter otp" i]',
            'input[placeholder*="verification" i]',
            'input[maxlength="6"]',
            'input[maxlength="4"]',
            'input[type="tel"]',
            'input[type="number"]',
            # Ant Design selectors
            'input.ant-input',
            '.ant-input-affix-wrapper input',
            # Blackbuck un-named inputs
            'input.number-input',
            'input.password-input',
            # Original fallback
            'input.otp-number-input',
        ]
        filled = False
        for sel in otp_selectors:
            try:
                loc = page.locator(sel).first
                if await loc.is_visible(timeout=2_000):
                    await loc.fill(otp)
                    filled = True
                    logger.info(f"[Blackbuck OTP] Filled OTP with selector: {sel}")
                    break
            except Exception:
                continue

        # Iframe fallback
        if not filled:
            filled = await _try_fill_in_frames(page, otp_selectors, otp, "Blackbuck OTP", "otp")

        # JS fallback — the OTP page has 2 inputs: index 0 may be phone (already filled),
        # index 1 is typically the OTP. Try index 1 first, then index 0 as last resort.
        if not filled:
            for idx in [1, 0]:
                filled = await _js_fill_input(page, idx, otp, "Blackbuck OTP", f"otp(idx={idx})")
                if filled:
                    break

        if not filled:
            await _screenshot_on_fail(page, "blackbuck_otp_verify")
            return {"success": False, "auth_token": None, "fleet_owner_id": None,
                    "error": f"Could not find OTP input field. url={page.url}, inputs_found={input_count}. The OTP page may not have loaded yet."}

        await asyncio.sleep(1)

        # Click Verify / Login button
        verify_selectors = [
            'button.continue-btn',
            'button:has-text("LOG IN")',
            'button:has-text("Verify")',
            'button:has-text("Login")',
            'button:has-text("Log in")',
            'button:has-text("Sign in")',
            'button:has-text("Submit")',
            'button:has-text("Confirm")',
            'button[type="submit"]',
            'button[type="button"]',
        ]
        submitted = False
        for sel in verify_selectors:
            try:
                loc = page.locator(sel).first
                if await loc.is_visible(timeout=2_000):
                    await loc.click()
                    submitted = True
                    logger.info(f"[Blackbuck OTP] Clicked verify with selector: {sel}")
                    break
            except Exception:
                continue

        # Last resort: press Enter on whichever input was filled
        if not submitted:
            try:
                all_inputs = page.locator('input').all()
                for inp in all_inputs:
                    if await inp.is_visible(timeout=500):
                        await inp.press("Enter")
                        submitted = True
                        logger.info("[Blackbuck OTP] Submitted via Enter key")
                        break
            except Exception:
                pass

        if not submitted:
            await _screenshot_on_fail(page, "blackbuck_otp_verify")
            return {"success": False, "auth_token": None, "fleet_owner_id": None,
                    "error": f"Could not find Verify button on Blackbuck login page. url={page.url}"}

        # Wait for navigation away from sign-in
        try:
            await page.wait_for_url(
                lambda url: "sign-in" not in url and "sign_up" not in url,
                timeout=30_000,
            )
            logger.info(f"[Blackbuck OTP] Navigated to: {page.url}")
        except Exception:
            error_text = await page.text_content("body") or ""
            for kw in ("incorrect", "invalid", "wrong", "expired"):
                if kw in error_text.lower():
                    return {"success": False, "auth_token": None, "fleet_owner_id": None,
                            "error": "OTP verification failed: invalid or expired OTP."}
            await _screenshot_on_fail(page, "blackbuck_otp_verify")
            return {"success": False, "auth_token": None, "fleet_owner_id": None,
                    "error": f"Blackbuck login timed out after OTP entry. url={page.url}. Please try again."}

        await asyncio.sleep(2)

        # Navigate to GPS page to populate localStorage
        if BLACKBUCK_GPS_URL not in page.url:
            gps_resp = await page.goto(BLACKBUCK_GPS_URL, wait_until="networkidle", timeout=20_000)
            if gps_resp:
                logger.info(f"[Blackbuck OTP] GPS page status: {gps_resp.status}")
            await asyncio.sleep(2)

        # Extract accessToken (poll up to 10s — SPA may not write it immediately)
        raw_token = None
        for _ in range(5):
            raw_token = await page.evaluate("() => localStorage.getItem('accessToken')")
            if raw_token:
                break
            await asyncio.sleep(2)

        if not raw_token:
            await _screenshot_on_fail(page, "blackbuck_otp_verify")
            return {"success": False, "auth_token": None, "fleet_owner_id": None,
                    "error": "accessToken not found in localStorage after Blackbuck OTP login."}

        try:
            auth_token = json.loads(raw_token)
        except (json.JSONDecodeError, TypeError):
            auth_token = raw_token

        logger.info(f"[Blackbuck OTP] Extracted accessToken (len={len(auth_token)})")

        # Fetch fleet_owner_id: localStorage first (more reliable), then profile API
        fleet_owner_id: Optional[str] = None
        try:
            raw_fleet_id = await page.evaluate(
                "() => localStorage.getItem('fleetOwnerID') || localStorage.getItem('fleet_owner_id') || localStorage.getItem('userFleetId') || ''"
            )
            if raw_fleet_id:
                fleet_owner_id = raw_fleet_id.strip().strip('"')
                logger.info(f"[Blackbuck OTP] Got fleet_owner_id from localStorage: {fleet_owner_id}")
        except Exception as e:
            logger.warning(f"[Blackbuck OTP] Could not read fleet_owner_id from localStorage: {e}")

        if not fleet_owner_id:
            try:
                api_result = await page.evaluate(
                    """async (profileUrl, token) => {
                        try {
                            const resp = await fetch(profileUrl, {
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': 'Bearer ' + token,
                                }
                            });
                            const body = await resp.text();
                            return { status: resp.status, body };
                        } catch (e) {
                            return { status: 0, body: '', error: e.message };
                        }
                    }""",
                    BLACKBUCK_PROFILE_API,
                    auth_token,
                )
                if api_result.get("status") == 200:
                    profile = json.loads(api_result["body"])
                    fleet_owner_id = str(profile.get("fleet_owner_id", ""))
                    logger.info(f"[Blackbuck OTP] Got fleet_owner_id from profile API: {fleet_owner_id}")
                else:
                    logger.warning(f"[Blackbuck OTP] Profile API returned {api_result.get('status')}: {api_result.get('error', '')}")
            except Exception as e:
                logger.warning(f"[Blackbuck OTP] Could not fetch fleet_owner_id from profile API: {e}")

        return {
            "success": True,
            "auth_token": auth_token,
            "fleet_owner_id": fleet_owner_id,
            "error": None,
        }

    except Exception as e:
        logger.error(f"[Blackbuck OTP] verify_otp failed: {e}", exc_info=True)
        return {"success": False, "auth_token": None, "fleet_owner_id": None, "error": str(e)}
    finally:
        _otp_sessions.pop(session_token, None)
        try:
            await browser.close()
            await playwright.stop()
        except Exception:
            pass
