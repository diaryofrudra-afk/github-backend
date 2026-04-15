"""
Trak N Tell historical data service.

Fetches date-wise data from the TnT platform:
  - GPS history / trip track
  - Sensor data records (boom angle, boom length, analog inputs, CAN bus params)
  - Alert history
  - Trip summary

All endpoints follow the same auth pattern as tntServiceGetCurrentStatus.
The exact endpoint paths were discovered via trakntell_discover.py.
We probe multiple known path variants and return whichever one responds.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, date, timedelta
from typing import Any, Optional
from urllib.parse import urlencode

import httpx

from .crypto import decrypt_token
from ..database import get_db

logger = logging.getLogger(__name__)

TNT_BASE = "https://mapsweb.trakmtell.com/tnt/servlet"

# ── Known endpoint variants (in priority order) ───────────────────────────────
# TnT uses different endpoint names depending on platform version / account type.
# We try each in order and return the first successful response.

HISTORY_ENDPOINTS = [
    "getVehicleHistory",
    "getGPSHistoryData",
    "tntServiceGetTrackData",
    "tntServiceGetCurrentStatusHistory",
    "getHistoryData",
    "tntServiceGetHistoryData",
    "tntServiceGetVehicleHistory",
    "tntServiceGetTripData",
    "tntServiceGetTrackHistory",
    "tntWebVehicleHistory",
    "tntServiceGetHistoryReport",
    "tntServiceGetVehicleHistoryReport",
    "tntServiceGetReportData",
    "tntServiceGetRouteHistory",
    "tntServiceGetPositionHistory",
    "tntServiceGetGPSHistory",
    "tntServiceGetDailyHistory",
]

SENSOR_ENDPOINTS = [
    "getSensorHistoryData",
    "getSensorData",
    "tntServiceGetCurrentSensorData",
    "tntServiceGetSensorData",
    "tntServiceGetSensorReport",
    "tntServiceGetCustomSensorData",
    "tntServiceGetAnalogInputData",
    "tntServiceGetInputData",
    "tntServiceGetSensorHistory",
    "tntServiceGetAINData",
    "tntServiceGetAnalogData",
    "tntServiceGetCustomReport",
]

CAN_ENDPOINTS = [
    "getCANHistoryData",
    "getCANData",
    "tntServiceGetCurrentCANData",
    "tntServiceGetCANData",
    "tntServiceGetCanReport",
    "tntServiceGetOBDData",
    "tntServiceGetDTCData",
    "tntServiceGetEngineData",
    "tntServiceGetJ1939Data",
    "tntServiceGetCanBusData",
    "tntServiceGetEngineReport",
    "tntServiceGetOBDReport",
]

ALERT_ENDPOINTS = [
    "getAlertHistoryData",
    "getAlertData",
    "tntServiceGetCurrentAlerts",
    "tntServiceGetAlertReport",
    "tntServiceGetAlertData",
    "tntServiceGetEventReport",
    "tntServiceGetAlertHistory",
    "tntServiceGetEventHistory",
    "tntServiceGetAlertList",
]

TRIP_ENDPOINTS = [
    "getTripHistoryData",
    "getTripData",
    "tntServiceGetCurrentTrip",
    "tntServiceGetTripReport",
    "tntServiceGetTripSummary",
    "tntServiceGetJourneyReport",
    "tntServiceGetTripHistory",
    "tntServiceGetJourneyData",
    "tntServiceGetDailyTrip",
]


# ── Credential helper (same pattern as service.py) ────────────────────────────

async def _get_creds(user_id: str) -> Optional[dict]:
    try:
        db = await get_db()
        cur = await db.execute(
            "SELECT user_id_encrypted, user_id_encrypt_encrypted, orgid_encrypted, "
            "sessionid_encrypted, tnt_s_encrypted, discovered_endpoints_json "
            "FROM trakntell_credentials WHERE user_id = ?",
            (user_id,),
        )
        row = await cur.fetchone()
    except Exception as e:
        logger.error(f"DB error fetching TNT creds: {e}")
        return None

    if not row:
        return None

    discovered: list[str] = []
    if len(row) > 5 and row[5]:
        try:
            discovered = json.loads(row[5])
        except Exception:
            pass

    return {
        "user_id":              decrypt_token(row[0]),
        "user_id_encrypt":      decrypt_token(row[1]),
        "orgid":                decrypt_token(row[2]),
        "sessionid":            decrypt_token(row[3]) if row[3] else None,
        "tnt_s":                decrypt_token(row[4]) if len(row) > 4 and row[4] else None,
        "discovered_endpoints": discovered,  # flat list of known-good endpoint names
    }


# ── Generic probe ─────────────────────────────────────────────────────────────

def _build_param_variants(creds: dict, vehicle_id: str, from_date: date, to_date: date) -> list[dict]:
    """
    Build the 4 most-likely parameter combinations TnT actually uses.
    (Deliberately small — the old 60-variant approach caused multi-minute hangs.)
    """
    from_dd  = _fmt_date(from_date)       # DD/MM/YYYY  — what TnT web app sends
    from_iso = _fmt_date_alt(from_date)   # YYYY-MM-DD  — alternate format some versions use
    to_dd    = _fmt_date(to_date)
    to_iso   = _fmt_date_alt(to_date)

    base = {
        "f": "l",
        "u": creds["user_id"],
        "userIdEncrypt": creds["user_id_encrypt"],
        "orgid": creds["orgid"],
    }

    return [
        {**base, "vehicleId": vehicle_id, "fromDate": from_dd,  "toDate": to_dd},   # most common
        {**base, "vehicleId": vehicle_id, "fromDate": from_iso, "toDate": to_iso},  # ISO dates
        {**base, "vehicleId": vehicle_id, "startDate": from_dd, "endDate": to_dd},  # alternate keys
        {**base, "vehicleId": vehicle_id, "sdate":     from_dd, "edate":  to_dd},   # short keys
    ]


async def _try_one_endpoint(
    client: httpx.AsyncClient,
    name: str,
    param_variants: list[dict],
    cookies: dict,
    headers: dict,
) -> tuple[Optional[str], Optional[Any]]:
    """Try a single endpoint with each param variant; return first JSON success."""
    url = f"{TNT_BASE}/{name}"
    for params in param_variants:
        try:
            resp = await client.get(url, params=params, cookies=cookies, headers=headers)

            if resp.status_code == 401:
                logger.warning(f"TNT {name}: session expired")
                return None, None  # session dead — no point trying other variants

            if resp.status_code not in (200,):
                logger.debug(f"TNT {name}: HTTP {resp.status_code}")
                continue

            if "login" in str(resp.url).lower():
                logger.warning(f"TNT {name}: redirected to login")
                return None, None

            text = resp.text.strip()
            if not text or "<html" in text[:200].lower():
                logger.debug(f"TNT {name}: HTML/empty response")
                continue

            first = text.find('{')
            last  = text.rfind('}')
            if first < 0:
                first = text.find('[')
                last  = text.rfind(']')
            if first < 0:
                continue

            data = json.loads(text[first:last + 1])
            logger.info(f"TNT {name}: ✅ success")
            return name, data

        except (json.JSONDecodeError, ValueError):
            logger.debug(f"TNT {name}: non-JSON response")
        except httpx.RequestError as e:
            logger.debug(f"TNT {name}: request error — {e}")
            break
        except Exception as e:
            logger.warning(f"TNT {name}: unexpected error — {e}")

    return None, None


async def _probe_endpoints(
    endpoint_names: list[str],
    creds: dict,
    extra_params: dict,
    timeout: int = 6,           # per-request timeout (seconds) — was 20
    vehicle_id: str = "",
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    overall_timeout: int = 25,  # wall-clock cap for the entire probe
) -> tuple[Optional[str], Optional[Any]]:
    """
    Try all endpoints CONCURRENTLY and return the first JSON success.

    Old approach: 9 endpoints × 60 param variants × 20s = up to 10 800s sequential.
    New approach: all endpoints fire in parallel; first success wins and cancels the rest.
    Overall wall-clock cap: 25 s regardless of how many endpoints / variants exist.
    """
    import asyncio

    if vehicle_id and from_date and to_date:
        param_variants = _build_param_variants(creds, vehicle_id, from_date, to_date)
    else:
        param_variants = [{
            "f": "l",
            "u": creds["user_id"],
            "userIdEncrypt": creds["user_id_encrypt"],
            "orgid": creds["orgid"],
            **extra_params,
        }]

    cookies: dict = {}
    if creds.get("tnt_s"):
        cookies["tnt_s"] = creds["tnt_s"]
    cookies["JSESSIONID"] = creds["sessionid"]

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": f"{TNT_BASE}/tntWebCurrentStatus",
        "Origin": "https://mapsweb.trakmtell.com",
    }

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(timeout, connect=4),
        follow_redirects=True,
    ) as client:
        tasks = [
            asyncio.create_task(_try_one_endpoint(client, name, param_variants, cookies, headers))
            for name in endpoint_names
        ]

        # Yield results as they come in; return on first success, cancel the rest
        try:
            for coro in asyncio.as_completed(tasks, timeout=overall_timeout):
                try:
                    name, data = await coro
                    if name is not None:
                        for t in tasks:
                            t.cancel()
                        return name, data
                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    logger.debug(f"TNT probe task error: {e}")
        except asyncio.TimeoutError:
            logger.warning(f"TNT probe timed out after {overall_timeout}s")
        finally:
            for t in tasks:
                if not t.done():
                    t.cancel()

    return None, None


# ── Date formatting helpers ───────────────────────────────────────────────────

def _fmt_date(d: date) -> str:
    """Format date as TnT expects: DD/MM/YYYY"""
    return d.strftime("%d/%m/%Y")


def _fmt_date_alt(d: date) -> str:
    """Alternative format some TnT versions use: YYYY-MM-DD"""
    return d.strftime("%Y-%m-%d")


# ── Sensor / CAN response parser ──────────────────────────────────────────────

_BOOM_KEYS = re.compile(r"boom|angle|length|luff|jib|radius|load|capacity|moment", re.IGNORECASE)
_CAN_KEYS  = re.compile(r"can_|canbus|obd|dtc|engine_|coolant|fuel_rate|throttle|torque|rpm", re.IGNORECASE)


def _classify_fields(fields: list[str]) -> dict[str, list[str]]:
    """Bucket field names into categories for the frontend."""
    buckets: dict[str, list[str]] = {
        "boom_crane": [],
        "can_engine":  [],
        "sensors":     [],
        "other":       [],
    }
    for f in fields:
        if _BOOM_KEYS.search(f):
            buckets["boom_crane"].append(f)
        elif _CAN_KEYS.search(f):
            buckets["can_engine"].append(f)
        elif any(k in f.lower() for k in ("sensor", "input", "analog", "temp", "humidity", "pressure")):
            buckets["sensors"].append(f)
        else:
            buckets["other"].append(f)
    return buckets


def _extract_records(raw: Any, endpoint_name: str) -> list[dict]:
    """
    Normalise whatever TnT returns into a flat list of dicts.
    TnT uses wildly different structures across versions.
    """
    if isinstance(raw, list):
        return raw

    if isinstance(raw, dict):
        # Common wrappers
        for key in ("response", "data", "records", "history", "alerts",
                    "trips", "sensorData", "canData", "list", "result"):
            v = raw.get(key)
            if isinstance(v, list):
                return v
            if isinstance(v, dict):
                return [v]

    return []


# ── Endpoint prioritization ───────────────────────────────────────────────────

def _prioritized(candidates: list[str], discovered: list[str]) -> list[str]:
    """
    Build the endpoint list to probe, giving priority to previously-discovered
    names.  Crucially, discovered names that are NOT in the static candidates
    list are prepended too — this is how intercepted-but-unknown endpoint names
    (from discover_endpoints_via_browser) get tried without being in TRIP_ENDPOINTS
    etc.

    Order: discovered-first, then remainder of candidates list.
    Excludes purely status/page endpoints that never return history data.
    """
    _STATUS_ONLY = {"tntServiceGetCurrentStatus", "tntWebCurrentStatus"}
    known_good = [e for e in discovered if e not in _STATUS_ONLY]
    rest = [e for e in candidates if e not in known_good]
    return known_good + rest


# ── Public fetch functions ────────────────────────────────────────────────────

async def fetch_vehicle_history(
    user_id: str,
    vehicle_id: str,
    from_date: date,
    to_date: date,
) -> dict:
    """GPS track points for a vehicle between two dates."""
    creds = await _get_creds(user_id)
    if not creds or not creds.get("sessionid"):
        return {"error": "Not configured", "records": []}

    name, raw = await _probe_endpoints(
        _prioritized(HISTORY_ENDPOINTS, creds.get("discovered_endpoints", [])),
        creds, {},
        vehicle_id=vehicle_id, from_date=from_date, to_date=to_date,
    )

    if raw is None:
        return {
            "error": "No endpoint responded. Click '🔍 Auto-detect' to discover your "
                     "account's endpoints automatically, then try Fetch again.",
            "records": [],
        }

    records = _extract_records(raw, name or "")
    return {"endpoint": name, "records": records, "count": len(records)}


async def fetch_sensor_data(
    user_id: str,
    vehicle_id: str,
    from_date: date,
    to_date: date,
) -> dict:
    """
    Sensor readings (boom angle, boom length, analog inputs, custom sensors)
    for a vehicle between two dates.
    """
    creds = await _get_creds(user_id)
    if not creds or not creds.get("sessionid"):
        return {"error": "Not configured", "records": [], "field_categories": {}}

    name, raw = await _probe_endpoints(
        _prioritized(SENSOR_ENDPOINTS, creds.get("discovered_endpoints", [])),
        creds, {},
        vehicle_id=vehicle_id, from_date=from_date, to_date=to_date,
    )

    if raw is None:
        return {
            "error": "No endpoint responded. Click '🔍 Auto-detect' to discover your "
                     "account's endpoints automatically, then try Fetch again.",
            "records": [],
            "field_categories": {},
        }

    records = _extract_records(raw, name or "")
    all_fields: set[str] = set()
    for r in records:
        if isinstance(r, dict):
            all_fields.update(r.keys())

    categories = _classify_fields(sorted(all_fields))

    return {
        "endpoint": name,
        "records": records,
        "count": len(records),
        "all_fields": sorted(all_fields),
        "field_categories": categories,
    }


async def fetch_can_data(
    user_id: str,
    vehicle_id: str,
    from_date: date,
    to_date: date,
) -> dict:
    """CAN bus / OBD-II data records."""
    creds = await _get_creds(user_id)
    if not creds or not creds.get("sessionid"):
        return {"error": "Not configured", "records": [], "field_categories": {}}

    name, raw = await _probe_endpoints(
        _prioritized(CAN_ENDPOINTS, creds.get("discovered_endpoints", [])),
        creds, {},
        vehicle_id=vehicle_id, from_date=from_date, to_date=to_date,
    )

    if raw is None:
        return {
            "error": "No endpoint responded. Click '🔍 Auto-detect' to discover your "
                     "account's endpoints automatically, then try Fetch again.",
            "records": [],
            "field_categories": {},
        }

    records = _extract_records(raw, name or "")
    all_fields: set[str] = set()
    for r in records:
        if isinstance(r, dict):
            all_fields.update(r.keys())

    categories = _classify_fields(sorted(all_fields))

    return {
        "endpoint": name,
        "records": records,
        "count": len(records),
        "all_fields": sorted(all_fields),
        "field_categories": categories,
    }


async def fetch_alert_history(
    user_id: str,
    vehicle_id: str,
    from_date: date,
    to_date: date,
) -> dict:
    """Alert / event history."""
    creds = await _get_creds(user_id)
    if not creds or not creds.get("sessionid"):
        return {"error": "Not configured", "records": []}

    name, raw = await _probe_endpoints(
        _prioritized(ALERT_ENDPOINTS, creds.get("discovered_endpoints", [])),
        creds, {},
        vehicle_id=vehicle_id, from_date=from_date, to_date=to_date,
    )

    if raw is None:
        return {
            "error": "No endpoint responded. Click '🔍 Auto-detect' to discover your "
                     "account's endpoints automatically, then try Fetch again.",
            "records": [],
        }

    records = _extract_records(raw, name or "")
    return {"endpoint": name, "records": records, "count": len(records)}


async def fetch_trip_summary(
    user_id: str,
    vehicle_id: str,
    from_date: date,
    to_date: date,
) -> dict:
    """Trip summary report."""
    creds = await _get_creds(user_id)
    if not creds or not creds.get("sessionid"):
        return {"error": "Not configured", "records": []}

    name, raw = await _probe_endpoints(
        _prioritized(TRIP_ENDPOINTS, creds.get("discovered_endpoints", [])),
        creds, {},
        vehicle_id=vehicle_id, from_date=from_date, to_date=to_date,
    )

    if raw is None:
        return {
            "error": "No endpoint responded. Click '🔍 Auto-detect' to discover your "
                     "account's endpoints automatically, then try Fetch again.",
            "records": [],
        }

    records = _extract_records(raw, name or "")
    return {"endpoint": name, "records": records, "count": len(records)}


async def probe_all_endpoints(user_id: str) -> dict:
    """
    Try every known endpoint variant with a 7-day window and report which ones
    actually respond.  Used by the /probe-endpoints router endpoint so the owner
    can see what their TnT account supports.
    """
    creds = await _get_creds(user_id)
    if not creds or not creds.get("sessionid"):
        return {"error": "Not configured", "results": {}}

    today = date.today()
    week_ago = today - timedelta(days=7)
    extra = {
        "vehicleId":  "1",   # dummy — most endpoints need a vehicleId even for probing
        "fromDate":   _fmt_date(week_ago),
        "toDate":     _fmt_date(today),
    }

    all_names = (
        HISTORY_ENDPOINTS + SENSOR_ENDPOINTS + CAN_ENDPOINTS +
        ALERT_ENDPOINTS + TRIP_ENDPOINTS
    )

    results = {}
    cookies = {"JSESSIONID": creds["sessionid"]}
    if creds.get("tnt_s"):
        cookies["tnt_s"] = creds["tnt_s"]
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": f"{TNT_BASE}/tntWebCurrentStatus",
    }
    base_params = {
        "f": "l",
        "u": creds["user_id"],
        "userIdEncrypt": creds["user_id_encrypt"],
        "orgid": creds["orgid"],
        **extra,
    }

    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        for name in all_names:
            url = f"{TNT_BASE}/{name}"
            try:
                resp = await client.get(url, params=base_params, cookies=cookies, headers=headers)
                ct = resp.headers.get("content-type", "")
                is_json = "json" in ct or "javascript" in ct
                text = resp.text[:200]
                results[name] = {
                    "http_status": resp.status_code,
                    "content_type": ct,
                    "has_json": is_json,
                    "response_preview": text,
                    "reachable": resp.status_code == 200 and not ("login" in str(resp.url).lower()),
                }
            except Exception as e:
                results[name] = {"error": str(e), "reachable": False}

    reachable = [k for k, v in results.items() if v.get("reachable")]
    return {
        "reachable_endpoints": reachable,
        "all_results": results,
    }
