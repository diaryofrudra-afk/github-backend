"""
WheelsEye GPS telemetry integration — pure HTTP API.

After the headless OTP login (auto_login.py) captures the dashboard's vehicle-list
endpoint and bearer token, telemetry is fetched by replaying that endpoint with
plain httpx — no browser needed. Per-user credentials, encrypted at rest.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Dict, Optional

import httpx

from ..database import get_db
from .models import WheelsEyeData, WheelsEyeVehicle
from .crypto import decrypt_token

logger = logging.getLogger(__name__)

# Real dashboard endpoints (verified against a live WheelsEye browser capture).
WE_BASE = "https://wheelseye.com"
WE_STATIC_URL = f"{WE_BASE}/rest/argus/app/vehicles/static"      # GET  → vehicleId ↔ registration
WE_DYNAMIC_URL = f"{WE_BASE}/rest/argus/app/vehicles-dynamic"    # POST → live telemetry by vehicleId
_DEVICE_ID = "11c474e1-fa2f-46ab-a6f2-d317df13c00d"

_credentials_cache: Dict[str, dict] = {}
# Global cache for vehicle telemetry partitioned by user_id
# Format: {user_id: (timestamp, data)}
_vehicles_cache: Dict[str, tuple[float, WheelsEyeData]] = {}


def clear_vehicles_cache(user_id: Optional[str] = None):
    if user_id:
        _vehicles_cache.pop(user_id, None)
    else:
        _vehicles_cache.clear()


async def _get_user_credentials(user_id: str) -> Optional[dict]:
    """Resolve credentials: cache → DB per-user only. NO shared fallback."""
    from cryptography.fernet import InvalidToken

    if user_id in _credentials_cache:
        return _credentials_cache[user_id]
    try:
        db = await get_db()
        cursor = await db.execute(
            "SELECT auth_token_encrypted, fleet_id, vehicles_api_url, cookies_encrypted FROM wheelseye_credentials WHERE user_id = ?",
            (user_id,),
        )
        row = await cursor.fetchone()
        if row:
            try:
                token = decrypt_token(row[0])
                cookies_dict = {}
                if len(row) > 3 and row[3]:
                    try:
                        cookies_dict = json.loads(decrypt_token(row[3]))
                    except Exception:
                        pass
                creds = {
                    "auth_token": token,
                    "fleet_id": row[1],
                    "vehicles_api_url": row[2],
                    "cookies_dict": cookies_dict
                }
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
        clear_vehicles_cache(user_id)
    else:
        _credentials_cache.clear()
        clear_vehicles_cache()


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


def _to_float(v, default=0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _map_vehicle(static: dict, tele: dict) -> Optional[WheelsEyeVehicle]:
    """Join a static vehicle record (registration, driver) with its live telemetry
    record from /vehicles-dynamic into a WheelsEyeVehicle. Field names verified
    against a real WheelsEye browser capture (HAR)."""
    tele = tele or {}
    reg = _f(static, "vehicleNumber", "vehicle_number", "regNo", "registrationNumber", default="")
    if not reg:
        return None

    lat = _to_float(_f(tele, "latitude", "lat", default=0.0))
    lng = _to_float(_f(tele, "longitude", "lng", "lon", default=0.0))
    speed = _to_float(_f(tele, "speed", "currentSpeed", default=0.0))

    ign_raw = str(_f(tele, "ignitionState", "ignition", "ignitionStatus", default="")).upper()
    if ign_raw in ("ON", "1", "TRUE"):
        ignition, engine_on = "on", True
    elif ign_raw in ("OFF", "0", "FALSE"):
        ignition, engine_on = "off", False
    else:
        ignition, engine_on = "unknown", None

    # WheelsEye reports movement via `mode`/`lMode` (STOPPAGE/RUNNING/IDLE/NO_INFO) and `moving`.
    mode_raw = str(_f(tele, "mode", "lMode", "lmode", default="")).upper()
    moving_flag = _f(tele, "moving", default=None)
    if moving_flag is True or "RUNN" in mode_raw or "MOV" in mode_raw:
        status = "moving"
    elif "STOP" in mode_raw or "PARK" in mode_raw:
        status = "stopped"
    elif "IDLE" in mode_raw:
        status = "idle"
    elif "NO_INFO" in mode_raw or "NOINFO" in mode_raw or "OFFLINE" in mode_raw or "LOST" in mode_raw:
        status = "signal_lost"
    elif speed > 0 or ignition == "on":
        status = "moving"
    elif ignition == "off":
        status = "stopped"
    else:
        status = "unknown"

    # `time` is unix seconds; fall back to the human-readable `displayTime`.
    ts = _f(tele, "time", "lastUpdated", "gpsTime", "deviceTime", "timestamp", default=None)
    last_updated = ""
    if isinstance(ts, (int, float)) and ts:
        try:
            seconds = ts / 1000 if ts > 1e12 else ts
            last_updated = datetime.fromtimestamp(seconds).strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            last_updated = str(ts)
    if not last_updated:
        last_updated = str(_f(tele, "displayTime", default="") or "")

    return WheelsEyeVehicle(
        registration_number=str(reg),
        status=status,
        latitude=lat,
        longitude=lng,
        speed=speed,
        last_updated=last_updated,
        engine_on=engine_on,
        ignition_status=ignition,
        signal=str(_f(tele, "gsm", "signal", "gsmSignal", "network", default="unknown")),
        address=str(_f(tele, "addr", "address", "location", default="")),
        driver_name=_f(static, "driverName", "driver_name", "driver", default=None),
    )


def _vehicles_from_responses(static_json: dict, dynamic_json: dict) -> list[WheelsEyeVehicle]:
    """Pure transform: join the /vehicles/static list with the /vehicles-dynamic map
    (keyed by vehicleId) into WheelsEyeVehicle records. Kept separate from HTTP so it
    can be unit-tested against captured fixtures."""
    static_list = ((static_json or {}).get("data") or {}).get("list") or []
    dyn_map = (dynamic_json or {}).get("data") or {}
    vehicles: list[WheelsEyeVehicle] = []
    for s in static_list:
        if not isinstance(s, dict):
            continue
        vid = s.get("vehicleId")
        tele = dyn_map.get(str(vid)) or dyn_map.get(vid) or {}
        mapped = _map_vehicle(s, tele)
        if mapped:
            vehicles.append(mapped)
    return vehicles


async def fetch_wheelseye_telemetry(user_id: Optional[str] = None, bypass_cache: bool = False) -> WheelsEyeData:
    """Fetch live GPS data from WheelsEye via its real two-step dashboard API:
      1. GET  /rest/argus/app/vehicles/static   → vehicleId ↔ registration (paginated)
      2. POST /rest/argus/app/vehicles-dynamic  → live telemetry keyed by vehicleId
    Both calls send the bare `token` header plus the captured JSESSIONID/deviceId cookies."""
    import time
    now = time.time()
    if user_id and not bypass_cache and user_id in _vehicles_cache:
        cached_time, cached_data = _vehicles_cache[user_id]
        if now - cached_time < 5.0:
            return cached_data

    creds = await _get_user_credentials(user_id) if user_id else None
    if not creds or not creds.get("auth_token"):
        return WheelsEyeData(
            error="No WheelsEye credentials configured. Please sign in with your phone & OTP in GPS Settings to view live tracking data."
        )

    headers = _build_headers(creds["auth_token"])
    send_cookies = creds.get("cookies_dict") or {"deviceId": _DEVICE_ID}

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            # ── Step 1: paginate the static vehicle list ──
            static_list: list = []
            page_no, page_size = 0, 100
            while True:
                resp = await client.get(
                    WE_STATIC_URL,
                    params={"pageNo": page_no, "size": page_size},
                    headers=headers,
                    cookies=send_cookies,
                )
                if resp.status_code == 401:
                    return WheelsEyeData(error="WheelsEye session expired. Please re-connect with phone & OTP in GPS Settings.")
                if resp.status_code != 200:
                    return WheelsEyeData(error=f"WheelsEye API error: {resp.status_code}")
                data = (resp.json() or {}).get("data") or {}
                page = data.get("list") or []
                static_list.extend(page)
                total = data.get("totalCount", len(static_list))
                page_no += 1
                if not page or len(static_list) >= total or page_no > 50:
                    break

            if not static_list:
                return WheelsEyeData(error="No vehicles found in WheelsEye account.")

            # ── Step 2: live telemetry for those vehicle ids ──
            ids = [s.get("vehicleId") for s in static_list if isinstance(s, dict) and s.get("vehicleId") is not None]
            dynamic_json = {}
            if ids:
                dyn_resp = await client.post(
                    WE_DYNAMIC_URL,
                    json={"vehicleIds": ids},
                    headers={**headers, "Content-Type": "application/json"},
                    cookies=send_cookies,
                )
                if dyn_resp.status_code == 401:
                    return WheelsEyeData(error="WheelsEye session expired. Please re-connect with phone & OTP in GPS Settings.")
                if dyn_resp.status_code == 200:
                    dynamic_json = dyn_resp.json() or {}
                else:
                    logger.warning(f"[WheelsEye] vehicles-dynamic → {dyn_resp.status_code}; returning positions without live telemetry")

            vehicles = _vehicles_from_responses({"data": {"list": static_list}}, dynamic_json)
            res = WheelsEyeData(vehicles=vehicles)

    except httpx.TimeoutException:
        res = WheelsEyeData(error="Connection to WheelsEye timed out.")
    except Exception as e:
        res = WheelsEyeData(error=f"WheelsEye fetch failed: {str(e)}")

    if user_id and not res.error:
        _vehicles_cache[user_id] = (now, res)
    return res
