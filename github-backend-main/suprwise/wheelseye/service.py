"""
WheelsEye GPS telemetry integration — pure HTTP API.

After the headless OTP login (auto_login.py) captures the dashboard's vehicle-list
endpoint and bearer token, telemetry is fetched by replaying that endpoint with
plain httpx — no browser needed. Per-user credentials, encrypted at rest.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Dict, Optional

import httpx

from ..database import get_db
from .models import WheelsEyeData, WheelsEyeVehicle
from .crypto import decrypt_token

logger = logging.getLogger(__name__)

_credentials_cache: Dict[str, dict] = {}


async def _get_user_credentials(user_id: str) -> Optional[dict]:
    """Resolve credentials: cache → DB per-user only. NO shared fallback."""
    from cryptography.fernet import InvalidToken

    if user_id in _credentials_cache:
        return _credentials_cache[user_id]
    try:
        db = await get_db()
        cursor = await db.execute(
            "SELECT auth_token_encrypted, fleet_id, vehicles_api_url FROM wheelseye_credentials WHERE user_id = ?",
            (user_id,),
        )
        row = await cursor.fetchone()
        if row:
            try:
                token = decrypt_token(row[0])
                creds = {"auth_token": token, "fleet_id": row[1], "vehicles_api_url": row[2]}
                _credentials_cache[user_id] = creds
                return creds
            except InvalidToken:
                logger.warning(f"InvalidToken when decrypting WheelsEye credentials for user {user_id}. Secret may have changed.")
                return None
    except Exception as e:
        logger.error(f"Error fetching WheelsEye credentials for user {user_id}: {e}")
    return None


def clear_credentials_cache(user_id: Optional[str] = None):
    if user_id:
        _credentials_cache.pop(user_id, None)
    else:
        _credentials_cache.clear()


def _build_headers(token: str) -> dict:
    return {
        "Accept": "application/json, text/plain, */*",
        "token": token,          # WheelsEye uses a bare `token` header, not Authorization: Bearer
        "source": "OPERATOR_WEB",
        "X-APP-VERSION": "18.4.0",
        "Origin": "https://wheelseye.com",
        "Referer": "https://wheelseye.com/node/dashboard",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0",
    }


def _f(raw: dict, *keys, default=None):
    """Return the first present, non-None value among keys."""
    for k in keys:
        if k in raw and raw[k] is not None:
            return raw[k]
    return default


def _map_vehicle(raw: dict) -> Optional[WheelsEyeVehicle]:
    reg = _f(raw, "vehicleNumber", "vehicle_number", "regNo", "registrationNumber",
             "vehicleNo", "number", "name", default="")
    if not reg:
        return None

    lat = float(_f(raw, "latitude", "lat", default=0.0) or 0.0)
    lng = float(_f(raw, "longitude", "lng", "lon", "long", default=0.0) or 0.0)
    speed = float(_f(raw, "speed", "currentSpeed", default=0.0) or 0.0)

    ign_raw = str(_f(raw, "ignition", "ignitionStatus", "ignition_status", default="")).upper()
    if ign_raw in ("ON", "1", "TRUE"):
        ignition, engine_on = "on", True
    elif ign_raw in ("OFF", "0", "FALSE"):
        ignition, engine_on = "off", False
    else:
        ignition, engine_on = "unknown", None

    status_raw = str(_f(raw, "status", "vehicleStatus", "movementStatus", default="")).upper()
    if "MOV" in status_raw or "RUNN" in status_raw:
        status = "moving"
    elif "STOP" in status_raw or "PARK" in status_raw:
        status = "stopped"
    elif "IDLE" in status_raw:
        status = "idle"
    elif "LOST" in status_raw or "OFFLINE" in status_raw or "NO" in status_raw:
        status = "signal_lost"
    elif speed > 0 or ignition == "on":
        status = "moving"
    else:
        status = "stopped" if ignition == "off" else "unknown"

    ts = _f(raw, "lastUpdated", "last_updated", "gpsTime", "deviceTime", "timestamp", default="")
    last_updated = ""
    if isinstance(ts, (int, float)) and ts:
        try:
            seconds = ts / 1000 if ts > 1e12 else ts
            last_updated = datetime.fromtimestamp(seconds).strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            last_updated = str(ts)
    elif ts:
        last_updated = str(ts)

    return WheelsEyeVehicle(
        registration_number=str(reg),
        status=status,
        latitude=lat,
        longitude=lng,
        speed=speed,
        last_updated=last_updated,
        engine_on=engine_on,
        ignition_status=ignition,
        signal=str(_f(raw, "signal", "gsmSignal", "network", default="unknown")),
        address=str(_f(raw, "address", "location", "currentLocation", default="")),
    )


def _extract_list(data) -> list:
    """Pull the vehicle array out of various common response envelopes."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("data", "vehicles", "list", "result", "results", "response", "vehicleList"):
            val = data.get(key)
            if isinstance(val, list):
                return val
            if isinstance(val, dict):
                nested = _extract_list(val)
                if nested:
                    return nested
    return []


async def fetch_wheelseye_telemetry(user_id: Optional[str] = None) -> WheelsEyeData:
    """Fetch live GPS data from WheelsEye by replaying the captured vehicle-list API."""
    creds = await _get_user_credentials(user_id) if user_id else None
    if not creds or not creds.get("auth_token"):
        return WheelsEyeData(
            error="No WheelsEye credentials configured. Please sign in with your phone & OTP in GPS Settings to view live tracking data."
        )

    url = creds.get("vehicles_api_url")
    if not url:
        return WheelsEyeData(
            error="WheelsEye vehicle API endpoint was not captured during login. Please remove and re-connect WheelsEye in GPS Settings."
        )

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(
                url,
                headers=_build_headers(creds["auth_token"]),
                cookies={"deviceId": "11c474e1-fa2f-46ab-a6f2-d317df13c00d"},
            )

            if resp.status_code == 401:
                return WheelsEyeData(error="WheelsEye session expired. Please re-connect with phone & OTP in GPS Settings.")
            if resp.status_code != 200:
                return WheelsEyeData(error=f"WheelsEye API error: {resp.status_code}")

            raw_list = _extract_list(resp.json())
            if not raw_list:
                return WheelsEyeData(error="No vehicles found in WheelsEye account.")

            vehicles = [v for v in (_map_vehicle(r) for r in raw_list if isinstance(r, dict)) if v]
            return WheelsEyeData(vehicles=vehicles)

    except httpx.TimeoutException:
        return WheelsEyeData(error="Connection to WheelsEye timed out.")
    except Exception as e:
        return WheelsEyeData(error=f"WheelsEye fetch failed: {str(e)}")
