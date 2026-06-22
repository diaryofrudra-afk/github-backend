"""
Trak N Tell historical data fetching — GPS history, sensors, CAN, alerts, trips.
Uses the same JSESSIONID/tnt_s credentials as the live-tracking service.
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime
from typing import Optional

import httpx

from .service import _get_user_credentials

logger = logging.getLogger(__name__)

TNT_BASE = "https://mapsweb.trakmtell.com/tnt/servlet"

KNOWN_ENDPOINTS = {
    "history":  ["tntServiceGetHistoryData", "tntWebHistoryData", "tntServiceHistoryReport"],
    "sensors":  ["tntServiceGetSensorData", "tntWebSensorData", "tntServiceSensorReport"],
    "can":      ["tntServiceGetCANData", "tntWebCANData", "tntServiceCANReport"],
    "alerts":   ["tntServiceGetAlertData", "tntWebAlertData", "tntServiceAlertReport"],
    "trips":    ["tntServiceGetTripData", "tntWebTripData", "tntServiceTripReport"],
}


# ── Credential helper (public alias used by router) ───────────────────────────

async def _get_creds(user_id: str) -> Optional[dict]:
    """Return decrypted credentials dict for user_id, or None."""
    return await _get_user_credentials(user_id)


# ── Date formatting ───────────────────────────────────────────────────────────

def _fmt_date(d: date) -> str:
    return d.strftime("%Y-%m-%d")


def _fmt_date_alt(d: date) -> str:
    """Alternative date format used by some TnT servlet variants."""
    return d.strftime("%d/%m/%Y")


# ── Request helpers ───────────────────────────────────────────────────────────

def _build_cookies(creds: dict) -> dict:
    cookies = {"JSESSIONID": creds["sessionid"]}
    if creds.get("tnt_s"):
        cookies["tnt_s"] = creds["tnt_s"]
    return cookies


def _build_headers() -> dict:
    return {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": f"{TNT_BASE}/tntWebCurrentStatus",
        "Origin": "https://mapsweb.trakmtell.com",
    }


def _build_param_variants(creds: dict, vehicle_id: str, from_date: date, to_date: date) -> list[dict]:
    """
    Return multiple parameter combinations to try against a TnT servlet.
    Different TnT accounts / installations use different param key names.
    """
    base = {
        "u": creds["user_id"],
        "userIdEncrypt": creds["user_id_encrypt"],
        "orgid": creds["orgid"],
        "vehicleid": vehicle_id,
        "fromDate": _fmt_date(from_date),
        "toDate": _fmt_date(to_date),
    }
    alt = {
        **base,
        "from_date": _fmt_date_alt(from_date),
        "to_date": _fmt_date_alt(to_date),
        "vehicle_id": vehicle_id,
    }
    compact = {
        "u": creds["user_id"],
        "ue": creds["user_id_encrypt"],
        "o": creds["orgid"],
        "v": vehicle_id,
        "fd": _fmt_date(from_date),
        "td": _fmt_date(to_date),
    }
    return [base, alt, compact]


def _extract_records(data, endpoint_name: str = "") -> list:
    """Pull the record list out of various TnT response envelopes."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("response", "data", "records", "history", "alerts",
                    "trips", "sensors", "can", "result", "results"):
            val = data.get(key)
            if isinstance(val, list):
                return val
            if isinstance(val, dict):
                nested = _extract_records(val, endpoint_name)
                if nested:
                    return nested
    return []


async def _try_endpoints(
    user_id: str,
    vehicle_id: str,
    from_date: date,
    to_date: date,
    endpoint_group: str,
) -> dict:
    """Try all known endpoints for a data type and return the first that works."""
    creds = await _get_creds(user_id)
    if not creds or not creds.get("sessionid"):
        return {"error": "No Trak N Tell credentials configured.", "records": [], "count": 0}

    cookies = _build_cookies(creds)
    headers = _build_headers()
    param_variants = _build_param_variants(creds, vehicle_id, from_date, to_date)
    endpoints = KNOWN_ENDPOINTS.get(endpoint_group, [])

    tried: list[dict] = []
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        for ep in endpoints:
            url = f"{TNT_BASE}/{ep}"
            for params in param_variants:
                try:
                    resp = await client.get(url, params=params, cookies=cookies, headers=headers)
                    tried.append({"endpoint": ep, "status": resp.status_code})
                    if resp.status_code != 200:
                        continue
                    if "login" in str(resp.url).lower():
                        return {"error": "TnT session expired. Please re-login.", "records": [], "count": 0}

                    text = resp.text.strip()
                    if "<html" in text[:200].lower():
                        continue

                    first = text.find("{")
                    last = text.rfind("}")
                    if first < 0:
                        first, last = text.find("["), text.rfind("]")
                    if first < 0:
                        continue

                    data = json.loads(text[first : last + 1])
                    records = _extract_records(data, ep)
                    if records:
                        return {
                            "ok": True,
                            "endpoint": ep,
                            "records": records,
                            "count": len(records),
                        }
                except Exception as e:
                    tried.append({"endpoint": ep, "error": str(e)})

    return {
        "ok": False,
        "error": f"No working {endpoint_group} endpoint found for this account.",
        "tried": tried[:6],
        "records": [],
        "count": 0,
    }


# ── Public fetch functions ────────────────────────────────────────────────────

async def fetch_vehicle_history(
    user_id: str, vehicle_id: str, from_date: date, to_date: date
) -> dict:
    return await _try_endpoints(user_id, vehicle_id, from_date, to_date, "history")


async def fetch_sensor_data(
    user_id: str, vehicle_id: str, from_date: date, to_date: date
) -> dict:
    return await _try_endpoints(user_id, vehicle_id, from_date, to_date, "sensors")


async def fetch_can_data(
    user_id: str, vehicle_id: str, from_date: date, to_date: date
) -> dict:
    return await _try_endpoints(user_id, vehicle_id, from_date, to_date, "can")


async def fetch_alert_history(
    user_id: str, vehicle_id: str, from_date: date, to_date: date
) -> dict:
    return await _try_endpoints(user_id, vehicle_id, from_date, to_date, "alerts")


async def fetch_trip_summary(
    user_id: str, vehicle_id: str, from_date: date, to_date: date
) -> dict:
    return await _try_endpoints(user_id, vehicle_id, from_date, to_date, "trips")


# ── Endpoint probe ────────────────────────────────────────────────────────────

async def probe_all_endpoints(user_id: str) -> dict:
    """
    Probe all known TnT servlet endpoints and return which ones respond
    successfully. Useful for discovering which endpoints a given account supports.
    """
    creds = await _get_creds(user_id)
    if not creds or not creds.get("sessionid"):
        return {
            "ok": False,
            "error": "No Trak N Tell credentials configured.",
            "reachable_endpoints": [],
        }

    cookies = _build_cookies(creds)
    headers = _build_headers()

    # Use a dummy vehicle_id — we just want to see which endpoints exist.
    dummy_params = {
        "u": creds["user_id"],
        "userIdEncrypt": creds["user_id_encrypt"],
        "orgid": creds["orgid"],
        "vehicleid": "0",
        "fromDate": date.today().strftime("%Y-%m-%d"),
        "toDate": date.today().strftime("%Y-%m-%d"),
    }

    all_endpoints = [ep for eps in KNOWN_ENDPOINTS.values() for ep in eps]
    reachable: list[str] = []
    results: list[dict] = []

    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        for ep in all_endpoints:
            url = f"{TNT_BASE}/{ep}"
            try:
                resp = await client.get(url, params=dummy_params, cookies=cookies, headers=headers)
                status = resp.status_code
                is_html = "<html" in resp.text[:200].lower()
                is_login = "login" in str(resp.url).lower()
                reachable_ep = status == 200 and not is_html and not is_login
                if reachable_ep:
                    reachable.append(ep)
                results.append({"endpoint": ep, "status": status, "reachable": reachable_ep})
            except Exception as e:
                results.append({"endpoint": ep, "error": str(e), "reachable": False})

    return {
        "ok": True,
        "reachable_endpoints": reachable,
        "all_results": results,
    }
