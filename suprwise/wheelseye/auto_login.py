"""
WheelsEye OTP login via direct HTTP API calls — no Playwright/browser needed.

Discovered endpoints:
  Step 1 – Send OTP:   POST https://wheelseye.com/shield/user/send-otp?newUser=false
                       body: {"phoneNumber": "<10-digit>"}
  Step 2 – Verify OTP: POST https://wheelseye.com/shield/admin/v3/verifyOtp
                       body: {"phoneNumber": "<10-digit>", "otp": "<4-digit>"}

After verify, the response contains the auth token and the httpx cookie jar captures
any session cookies needed for subsequent vehicle-data API calls.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Session state is embedded in the token itself (Fernet-encrypted JSON) so it
# survives server restarts and works across multiple uvicorn workers.

WE_BASE = "https://wheelseye.com"
# NOTE: the path is /shield/user/send-otp (no /v1/). The /v1/ variant returns the
# HTML app shell with HTTP 200, which breaks JSON parsing. Verified against the live API.
WE_SEND_OTP_URL  = f"{WE_BASE}/shield/user/send-otp?newUser=false"
WE_VERIFY_OTP_URL = f"{WE_BASE}/shield/admin/v3/verifyOtp"

_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Origin": WE_BASE,
    "Referer": f"{WE_BASE}/node/login",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0",
    "source": "OPERATOR_WEB",
    "X-APP-VERSION": "18.4.0",
    "X-Requested-With": "XMLHttpRequest",
}

# WheelsEye POSTs use text/plain content-type even though the body is JSON
_POST_HEADERS = {**_HEADERS, "Content-Type": "text/plain;charset=UTF-8"}

# deviceId cookie that WheelsEye expects on every request (acts as a client fingerprint)
_DEVICE_ID_COOKIE = {"deviceId": "11c474e1-fa2f-46ab-a6f2-d317df13c00d"}


def _make_session_token(phone: str, cookies: dict) -> str:
    """Encode phone + cookies into a Fernet-encrypted session token."""
    from .crypto import encrypt_token
    # Filter cookies to keep only the essentials to reduce token size
    essential_cookies = {k: v for k, v in cookies.items() if k.lower() in ('jsessionid', 'deviceid', 'auth-token', 'token')}
    if not essential_cookies:
        essential_cookies = cookies # Fallback to all if none matched
        
    payload_dict = {"phone": phone, "cookies": essential_cookies, "exp": int(time.time()) + 1200}
    payload = json.dumps(payload_dict)
    token = encrypt_token(payload)
    logger.info(f"[WheelsEye OTP] Generated session_token for {phone}, len={len(token)}")
    return token


def _decode_session_token(token: str) -> Optional[dict]:
    """Decrypt and validate a session token. Returns None if expired or invalid."""
    from .crypto import decrypt_token
    from cryptography.fernet import InvalidToken
    try:
        decrypted = decrypt_token(token)
        payload = json.loads(decrypted)
        if time.time() > payload.get("exp", 0):
            logger.warning(f"[WheelsEye OTP] Session expired: {payload.get('exp')} vs {time.time()}")
            return None
        return payload
    except InvalidToken:
        logger.error("[WheelsEye OTP] Invalid session token (decryption failed)")
        return None
    except Exception as e:
        logger.error(f"[WheelsEye OTP] Session decode failed: {e}")
        return None


# ── Step 1: request OTP ───────────────────────────────────────────────────────

async def wheelseye_request_otp(phone: str) -> dict:
    """
    POST to WheelsEye's send-OTP API.  No browser required.

    Returns: { "success": bool, "session_token": str | None, "error": str | None }
    """
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.post(
                WE_SEND_OTP_URL,
                # Exact body the wheelseye.com/fo/login portal sends (verified from HAR).
                # `userType: "OPERATOR"` is required — without it the API returns "Invalid request".
                json={
                    "userType": "OPERATOR",
                    "serviceType": "",
                    "phoneNumber": phone,
                    "vNum": "",
                },
                headers={**_HEADERS, "Content-Type": "application/json"},
                cookies=_DEVICE_ID_COOKIE,
            )

        ct = resp.headers.get("content-type", "")
        try:
            data = resp.json()
        except Exception:
            data = {}

        logger.info(f"[WheelsEye OTP] send-otp → {resp.status_code} ({ct}): {str(data)[:300]}")

        # A non-JSON body (e.g. the HTML app shell) means we hit the wrong endpoint,
        # not a real OTP failure — surface that clearly instead of a bare "HTTP 200".
        if "application/json" not in ct and not data:
            logger.error(f"[WheelsEye OTP] send-otp returned non-JSON ({ct}); body starts: {resp.text[:120]!r}")
            return {"success": False, "session_token": None,
                    "error": "WheelsEye sign-in endpoint returned an unexpected response. Please try again."}

        # WheelsEye returns HTTP 200 even for errors; check "success" field
        if not data.get("success", False):
            msg = data.get("message") or f"HTTP {resp.status_code}"
            logger.error(f"[WheelsEye OTP] send-otp failed. Full response: {data}")
            return {"success": False, "session_token": None, "error": f"WheelsEye: {msg}"}

        # Embed phone + cookies into an encrypted, self-contained session token
        # Merge deviceId into the captured cookies so step 2 always sends it
        captured_cookies = {**_DEVICE_ID_COOKIE, **dict(resp.cookies)}
        session_token = _make_session_token(phone, captured_cookies)

        logger.info(f"[WheelsEye OTP] OTP dispatched to {phone}")
        return {"success": True, "session_token": session_token, "error": None}

    except Exception as e:
        logger.error(f"[WheelsEye OTP] request_otp failed: {e}", exc_info=True)
        return {"success": False, "session_token": None, "error": str(e)}


# ── Step 2: verify OTP ────────────────────────────────────────────────────────

async def wheelseye_verify_otp(session_token: str, otp: str) -> dict:
    """
    POST to WheelsEye's verifyOtp API, then probe the vehicle data API.

    Returns: {
        "success": bool,
        "auth_token": str | None,
        "fleet_id": str | None,
        "vehicles_api_url": str | None,
        "error": str | None,
    }
    """
    session = _decode_session_token(session_token)
    if not session:
        return {
            "success": False, "auth_token": None, "fleet_id": None,
            "vehicles_api_url": None,
            "error": "WheelsEye OTP session expired or invalid. Please request a new OTP.",
        }

    phone = session["phone"]
    send_cookies = session.get("cookies", {})

    # WheelsEye expects the OTP as a JSON number (verified from the /fo/login capture).
    try:
        otp_value: object = int(str(otp).strip())
    except (TypeError, ValueError):
        otp_value = str(otp).strip()

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            # Exact body the /fo/login portal sends to verifyOtp (verified from HAR):
            # field names are `userName` + `type` (not phoneNumber/source), application/json.
            resp = await client.post(
                WE_VERIFY_OTP_URL,
                json={
                    "serviceType": "",
                    "type": "OPERATOR",
                    "otp": otp_value,
                    "userName": phone,
                    "vNum": "",
                },
                headers={**_HEADERS, "Content-Type": "application/json"},
                cookies=send_cookies,
            )

        try:
            data = resp.json()
        except Exception:
            data = {}

        logger.info(f"[WheelsEye OTP] verifyOtp → {resp.status_code} {resp.url} ct={resp.headers.get('content-type')} body={resp.text[:400]}")

        if not data.get("success", False):
            msg = data.get("message") or f"HTTP {resp.status_code}"
            return {
                "success": False, "auth_token": None, "fleet_id": None,
                "vehicles_api_url": None,
                "error": f"OTP verification failed: {msg}",
            }

        # Extract auth token — WheelsEye may use "token", "authToken", "accessToken", or nested
        auth_token = (
            data.get("token")
            or data.get("authToken")
            or data.get("accessToken")
            or data.get("access_token")
            or _deep_find(data, ("token", "authToken", "accessToken", "access_token"))
        )

        fleet_id = str(
            data.get("fleetId") or data.get("fleet_id") or
            data.get("userId") or data.get("user_id") or
            _deep_find(data, ("fleetId", "fleet_id", "userId", "user_id")) or ""
        )

        # Also capture cookies from the verify response (JSESSIONID etc.) — these are
        # required, alongside the token, on every subsequent vehicle API call.
        verify_cookies = dict(resp.cookies)
        all_cookies = {**send_cookies, **verify_cookies}

        # The vehicle endpoints are fixed and known (see service.py); just confirm the
        # token+cookies actually authorise a data call so we fail fast on a bad login.
        vehicles_api_url = WE_STATIC_URL if await _token_works(auth_token, all_cookies) else ""

        logger.info(
            f"[WheelsEye OTP] Login OK token_len={len(auth_token or '')} "
            f"fleet_id={fleet_id!r} token_validated={bool(vehicles_api_url)}"
        )

        return {
            "success": True,
            "auth_token": auth_token or "",
            "fleet_id": fleet_id,
            "vehicles_api_url": vehicles_api_url or "",
            "cookies_raw": json.dumps(all_cookies),
            "error": None,
        }

    except Exception as e:
        logger.error(f"[WheelsEye OTP] verify_otp failed: {e}", exc_info=True)
        return {
            "success": False, "auth_token": None, "fleet_id": None,
            "vehicles_api_url": None, "error": str(e),
        }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _deep_find(obj, keys: tuple):
    """Recursively search a nested dict/list for the first key that has a non-empty value."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in keys and v:
                return v
        for v in obj.values():
            result = _deep_find(v, keys)
            if result:
                return result
    elif isinstance(obj, list):
        for item in obj:
            result = _deep_find(item, keys)
            if result:
                return result
    return None


# The live vehicle-list endpoint, used only to validate the freshly-issued token.
# (Telemetry fetching uses the same URL + /vehicles-dynamic; see wheelseye/service.py.)
WE_STATIC_URL = f"{WE_BASE}/rest/argus/app/vehicles/static"


async def _token_works(auth_token: Optional[str], cookies: dict) -> bool:
    """Confirm the token + session cookies authorise a real data call by hitting the
    vehicles/static endpoint once. Returns True on HTTP 200 with success:true."""
    if not auth_token and not cookies:
        return False
    req_headers = {**_HEADERS, "Referer": f"{WE_BASE}/node/dashboard"}
    if auth_token:
        req_headers["token"] = auth_token
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            r = await client.get(
                WE_STATIC_URL,
                params={"pageNo": 0, "size": 1},
                headers=req_headers,
                cookies=cookies,
            )
        if r.status_code != 200 or r.text.strip().startswith("<"):
            logger.debug(f"[WheelsEye] token validation → {r.status_code}")
            return False
        return bool((r.json() or {}).get("success", True))
    except Exception as e:
        logger.debug(f"[WheelsEye] token validation error: {e}")
        return False
