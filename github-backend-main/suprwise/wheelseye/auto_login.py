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
WE_SEND_OTP_URL  = f"{WE_BASE}/shield/user/send-otp?newUser=false"
WE_VERIFY_OTP_URL = f"{WE_BASE}/shield/admin/v3/verifyOtp"

_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Origin": WE_BASE,
    "Referer": f"{WE_BASE}/node/login",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0",
    "source": "OPERATOR_WEB",
    "X-APP-VERSION": "18.4.0",
}

# WheelsEye POSTs use text/plain content-type even though the body is JSON
_POST_HEADERS = {**_HEADERS, "Content-Type": "text/plain;charset=UTF-8"}

# deviceId cookie that WheelsEye expects on every request (acts as a client fingerprint)
_DEVICE_ID_COOKIE = {"deviceId": "11c474e1-fa2f-46ab-a6f2-d317df13c00d"}


def _make_session_token(phone: str, cookies: dict) -> str:
    """Encode phone + cookies into a Fernet-encrypted session token."""
    from .crypto import encrypt_token
    payload = json.dumps({"phone": phone, "cookies": cookies, "exp": int(time.time()) + 600})
    return encrypt_token(payload)


def _decode_session_token(token: str) -> Optional[dict]:
    """Decrypt and validate a session token. Returns None if expired or invalid."""
    from .crypto import decrypt_token
    from cryptography.fernet import InvalidToken
    try:
        payload = json.loads(decrypt_token(token))
        if time.time() > payload.get("exp", 0):
            return None
        return payload
    except (InvalidToken, Exception):
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
                content=json.dumps({
                    "phoneNumber": phone,
                    "deviceId": _DEVICE_ID_COOKIE["deviceId"],
                    "source": "OPERATOR_WEB",
                    "appVersion": "18.4.0",
                    "newUser": False,
                }).encode("utf-8"),
                headers=_POST_HEADERS,
                cookies=_DEVICE_ID_COOKIE,
            )

        try:
            data = resp.json()
        except Exception:
            data = {}

        logger.info(f"[WheelsEye OTP] send-otp → {resp.status_code}: {data}")

        # WheelsEye returns HTTP 200 even for errors; check "success" field
        if not data.get("success", False):
            msg = data.get("message") or f"HTTP {resp.status_code}"
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
            "error": "OTP session expired or invalid. Please request a new OTP.",
        }

    phone = session["phone"]
    send_cookies = session.get("cookies", {})

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            # Replay cookies from step 1 so the server correlates the request
            resp = await client.post(
                WE_VERIFY_OTP_URL,
                content=json.dumps({
                    "phoneNumber": phone,
                    "otp": otp,
                    "deviceId": _DEVICE_ID_COOKIE["deviceId"],
                    "source": "OPERATOR_WEB",
                    "appVersion": "18.4.0",
                    "newUser": False,
                }).encode("utf-8"),
                headers=_POST_HEADERS,
                cookies=send_cookies,
            )

        try:
            data = resp.json()
        except Exception:
            data = {}

        logger.info(f"[WheelsEye OTP] verifyOtp → {resp.status_code}: {str(data)[:300]}")

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

        # Also capture cookies from the verify response — used for vehicle API calls
        verify_cookies = dict(resp.cookies)
        all_cookies = {**send_cookies, **verify_cookies}

        # Probe for the live vehicle API URL (pass fleet_id so we can try parameterised URLs)
        vehicles_api_url = await _probe_vehicle_api(auth_token, all_cookies, fleet_id=fleet_id)

        logger.info(
            f"[WheelsEye OTP] Login OK token_len={len(auth_token or '')} "
            f"fleet_id={fleet_id!r} vehicles_api={vehicles_api_url!r}"
        )

        return {
            "success": True,
            "auth_token": auth_token or "",
            "fleet_id": fleet_id,
            "vehicles_api_url": vehicles_api_url or "",
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


# Real API lives under /rest/argus/ — confirmed from network inspection.
# Fleet-ID-parameterised variants are appended dynamically inside _probe_vehicle_api.
_VEHICLE_API_CANDIDATES = [
    f"{WE_BASE}/rest/argus/vehicle/liveTracking",
    f"{WE_BASE}/rest/argus/vehicle/live",
    f"{WE_BASE}/rest/argus/vehicle/list",
    f"{WE_BASE}/rest/argus/vehicle/all",
    f"{WE_BASE}/rest/argus/vehicle/getAllVehicleDetails",
    f"{WE_BASE}/rest/argus/vehicle/getVehicleDetailsByFleetOwnerId",
    f"{WE_BASE}/rest/argus/vehicle/liveTrackingV2",
    f"{WE_BASE}/rest/argus/tracking/live",
    f"{WE_BASE}/rest/argus/tracking/liveTracking",
    f"{WE_BASE}/rest/cyborg/vehicle/liveTracking",
    f"{WE_BASE}/rest/cyborg/vehicle/live",
    f"{WE_BASE}/rest/cyborg/vehicle/list",
    f"{WE_BASE}/rest/cyborg/vehicle/getAllVehicleDetails",
    f"{WE_BASE}/rest/cyborg/tracking/live",
]


async def _probe_vehicle_api(
    auth_token: Optional[str],
    cookies: dict,
    fleet_id: str = "",
) -> Optional[str]:
    """
    Try each candidate vehicle-data URL and return the first that yields JSON
    with a non-empty vehicle list, or None if none work.

    When fleet_id is known, parameterised variants are tried first because
    many WheelsEye endpoints require a fleetOwnerId / userId query param.
    """
    if not auth_token and not cookies:
        return None

    # WheelsEye uses a bare `token` header, NOT Authorization: Bearer
    req_headers = {
        **_HEADERS,
        "Referer": f"{WE_BASE}/node/dashboard",
    }
    if auth_token:
        req_headers["token"] = auth_token

    # Build the URL list: parameterised first (if fleet_id known), then bare URLs
    urls_to_try: list[str] = []
    if fleet_id:
        for base in _VEHICLE_API_CANDIDATES:
            sep = "&" if "?" in base else "?"
            urls_to_try.append(f"{base}{sep}fleetOwnerId={fleet_id}")
            urls_to_try.append(f"{base}{sep}userId={fleet_id}")
            urls_to_try.append(f"{base}{sep}fleetId={fleet_id}")
    urls_to_try.extend(_VEHICLE_API_CANDIDATES)

    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        for url in urls_to_try:
            try:
                r = await client.get(url, headers=req_headers, cookies=cookies)
                if r.status_code not in (200, 201):
                    logger.debug(f"[WheelsEye] probe {url} → {r.status_code}")
                    continue
                text = r.text.strip()
                if text.startswith("<"):
                    continue  # HTML / redirect page
                data = r.json()
                if _has_vehicles(data):
                    logger.info(f"[WheelsEye] Vehicle API found: {url}")
                    return url
                logger.debug(f"[WheelsEye] probe {url} → 200 but no vehicles in response")
            except Exception as e:
                logger.debug(f"[WheelsEye] probe {url}: {e}")

    logger.warning("[WheelsEye] Could not discover vehicle API URL — telemetry will require manual config.")
    return None


def _has_vehicles(data, _depth: int = 0) -> bool:
    """Return True if the response looks like it contains vehicle records."""
    if isinstance(data, list) and data:
        return True
    if isinstance(data, dict) and _depth < 3:
        _VEHICLE_KEYS = ("data", "vehicles", "list", "result", "results",
                         "response", "vehicleList", "items", "trackingList",
                         "vehicleDetails", "vehicleData")
        for key in _VEHICLE_KEYS:
            val = data.get(key)
            if isinstance(val, list) and val:
                return True
            if isinstance(val, dict) and val:
                if _has_vehicles(val, _depth + 1):
                    return True
        # If no known key matched, recurse into all dict values one level
        if _depth == 0:
            for val in data.values():
                if _has_vehicles(val, _depth + 1):
                    return True
    return False
