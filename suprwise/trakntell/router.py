import json
import httpx
from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from ..auth.dependencies import get_current_user, require_owner
from ..database import get_db
from .service import (
    fetch_trakntell_iframe_url,
    fetch_trakntell_vehicle_data,
    store_credentials,
    get_credentials_status,
    delete_credentials,
    clear_credentials_cache,
    _get_user_credentials,
    TNT_API_URL,
    TNT_DATA_URL,
)
from .auto_login import trakntell_headless_login, discover_endpoints_via_browser

router = APIRouter(prefix="/api/gps/trakntell", tags=["gps", "trakntell"])


class TrakNTellCredentialsInput(BaseModel):
    user_id: str
    user_id_encrypt: str
    orgid: str
    sessionid: str = ""  # JSESSIONID cookie
    tnt_s: str = ""      # tnt_s cookie (session state)


@router.get("/vehicles")
async def get_trakntell_vehicles(user=Depends(get_current_user)):
    """Fetch live Trak N Tell vehicle data for this user."""
    return await fetch_trakntell_vehicle_data(user_id=user["user_id"])


@router.get("/iframe-url")
async def get_trakntell_iframe_url(user=Depends(get_current_user)):
    """Get the iframe URL for Trak N Tell GPS tracking."""
    return await fetch_trakntell_iframe_url(user_id=user["user_id"])


@router.get("/health")
async def trakntell_health_check(user=Depends(get_current_user), db=Depends(get_db)):
    """Check this user's Trak N Tell integration status."""
    from .models import TrakNTellStatus

    status = TrakNTellStatus()
    creds_status = await get_credentials_status(user["user_id"])

    if creds_status:
        status.configured = True
        status.user_id_preview = creds_status["user_id_preview"]
    else:
        status.configured = False

    return status


@router.put("/credentials")
async def set_trakntell_credentials(
    creds: TrakNTellCredentialsInput,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Store encrypted Trak N Tell credentials for THIS user only."""
    # Basic validation — check that the values look like valid Trak N Tell params
    if not creds.user_id or not creds.user_id_encrypt or not creds.orgid:
        raise HTTPException(status_code=400, detail="All fields are required.")

    # Validate user_id is numeric (Trak N Tell uses numeric user IDs)
    if not creds.user_id.isdigit():
        raise HTTPException(status_code=400, detail="user_id must be a numeric value.")

    success = await store_credentials(
        user_id=user["user_id"],
        tenant_id=user["tenant_id"],
        tnt_user_id=creds.user_id,
        tnt_user_id_encrypt=creds.user_id_encrypt,
        tnt_orgid=creds.orgid,
        tnt_sessionid=creds.sessionid or "",
        tnt_s=creds.tnt_s or "",
    )

    if success:
        return {"ok": True, "message": "Trak N Tell credentials saved successfully"}
    raise HTTPException(status_code=500, detail="Failed to save credentials")


@router.get("/credentials")
async def get_trakntell_credentials(
    user=Depends(get_current_user), db=Depends(get_db)
):
    """Get THIS user's credential status (no raw values exposed)."""
    creds_status = await get_credentials_status(user["user_id"])

    if creds_status:
        return creds_status
    return {"configured": False, "user_id_preview": "", "updated_at": ""}


@router.delete("/credentials")
async def delete_trakntell_credentials(
    user=Depends(get_current_user), db=Depends(get_db)
):
    """Delete THIS user's Trak N Tell credentials."""
    await delete_credentials(user["user_id"])
    return {"ok": True, "message": "Trak N Tell credentials removed"}


class TrakNTellAutoLoginReq(BaseModel):
    username: str   # TrakNTell login username / user ID
    password: str


@router.post("/auto-login")
async def trakntell_auto_login(
    req: TrakNTellAutoLoginReq,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Headless-browser auto-login to Trak N Tell.
    Extracts JSESSIONID, tnt_s cookie, and user params (user_id, user_id_encrypt, orgid),
    then stores them encrypted in the DB.
    """
    login_result = await trakntell_headless_login(req.username, req.password)

    if not login_result["success"]:
        raise HTTPException(status_code=400, detail=login_result.get("error", "Trak N Tell auto-login failed."))

    sessionid: str = login_result.get("sessionid") or ""
    if not sessionid:
        raise HTTPException(status_code=400, detail="Login succeeded but JSESSIONID not found.")

    user_id: str = login_result.get("user_id") or ""
    user_id_encrypt: str = login_result.get("user_id_encrypt") or ""
    orgid: str = login_result.get("orgid") or ""
    tnt_s: str = login_result.get("tnt_s") or ""

    if not user_id or not orgid:
        raise HTTPException(
            status_code=400,
            detail=(
                "Login succeeded and JSESSIONID extracted, but user_id / orgid could not be found automatically. "
                "Please enter them manually via PUT /api/gps/trakntell/credentials."
            ),
        )

    success = await store_credentials(
        user_id=user["user_id"],
        tenant_id=user["tenant_id"],
        tnt_user_id=user_id,
        tnt_user_id_encrypt=user_id_encrypt,
        tnt_orgid=orgid,
        tnt_sessionid=sessionid,
        tnt_s=tnt_s,
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to save Trak N Tell credentials")

    return {
        "ok": True,
        "message": "Trak N Tell credentials saved via auto-login",
        "user_id_preview": user_id[:4] + "..." if len(user_id) > 4 else user_id,
        "has_sessionid": bool(sessionid),
        "has_tnt_s": bool(tnt_s),
    }


@router.get("/debug-raw")
async def trakntell_debug_raw(user=Depends(require_owner)):
    """
    Owner-only: returns the raw, unparsed JSON response from Trak N Tell for the
    first vehicle. Useful for discovering which fields the API actually provides so
    we can expand data extraction.
    """
    creds = await _get_user_credentials(user["user_id"])
    if not creds:
        raise HTTPException(status_code=404, detail="No Trak N Tell credentials configured.")
    if not creds.get("sessionid"):
        raise HTTPException(status_code=400, detail="No JSESSIONID found — please re-login via GPS Settings.")

    params = {
        "f": "l",
        "u": creds["user_id"],
        "userIdEncrypt": creds["user_id_encrypt"],
        "orgid": creds["orgid"],
    }
    cookies = {"JSESSIONID": creds["sessionid"]}
    if creds.get("tnt_s"):
        cookies["tnt_s"] = creds["tnt_s"]

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": TNT_DATA_URL,
        "Origin": "https://mapsweb.trakmtell.com",
    }

    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(TNT_API_URL, params=params, cookies=cookies, headers=headers)

        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Trak N Tell returned HTTP {resp.status_code}")

        text = resp.text
        first_brace = text.find('{')
        last_brace = text.rfind('}')
        if first_brace < 0:
            raise HTTPException(status_code=502, detail="No JSON in response")

        raw = json.loads(text[first_brace:last_brace + 1])
        vehicles = raw.get("response", [])

        # Return first vehicle's raw fields + all field names across all vehicles
        all_keys: set = set()
        for v in vehicles:
            all_keys.update(v.keys())

        return {
            "total_vehicles": len(vehicles),
            "all_field_names": sorted(all_keys),
            "first_vehicle_raw": vehicles[0] if vehicles else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch raw data: {e}")


# ── Historical / sensor / CAN data ────────────────────────────────────────────

from .history_service import (
    fetch_vehicle_history,
    fetch_sensor_data,
    fetch_can_data,
    fetch_alert_history,
    fetch_trip_summary,
    probe_all_endpoints,
)


def _parse_date(s: Optional[str], default: date) -> date:
    if not s:
        return default
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    raise HTTPException(status_code=400, detail=f"Invalid date format: {s!r}. Use YYYY-MM-DD.")


from datetime import datetime


@router.get("/history/{vehicle_id}")
async def get_vehicle_history(
    vehicle_id: str,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    user=Depends(get_current_user),
):
    """
    GPS track history for a vehicle between two dates.
    Defaults to today if no dates provided.
    """
    today = date.today()
    fd = _parse_date(from_date, today)
    td = _parse_date(to_date, today)
    return await fetch_vehicle_history(user["user_id"], vehicle_id, fd, td)


@router.get("/sensors/{vehicle_id}")
async def get_sensor_data(
    vehicle_id: str,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    user=Depends(get_current_user),
):
    """
    Sensor data records (boom angle, boom length, analog inputs, custom sensors)
    for a vehicle between two dates.
    """
    today = date.today()
    fd = _parse_date(from_date, today)
    td = _parse_date(to_date, today)
    return await fetch_sensor_data(user["user_id"], vehicle_id, fd, td)


@router.get("/can/{vehicle_id}")
async def get_can_data(
    vehicle_id: str,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    user=Depends(get_current_user),
):
    """CAN bus / OBD-II data records for a vehicle between two dates."""
    today = date.today()
    fd = _parse_date(from_date, today)
    td = _parse_date(to_date, today)
    return await fetch_can_data(user["user_id"], vehicle_id, fd, td)


@router.get("/alerts/{vehicle_id}")
async def get_alert_history(
    vehicle_id: str,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    user=Depends(get_current_user),
):
    """Alert / event history for a vehicle between two dates."""
    today = date.today()
    fd = _parse_date(from_date, today)
    td = _parse_date(to_date, today)
    return await fetch_alert_history(user["user_id"], vehicle_id, fd, td)


@router.get("/trips/{vehicle_id}")
async def get_trip_summary(
    vehicle_id: str,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    user=Depends(get_current_user),
):
    """Trip summary report for a vehicle between two dates."""
    today = date.today()
    fd = _parse_date(from_date, today)
    td = _parse_date(to_date, today)
    return await fetch_trip_summary(user["user_id"], vehicle_id, fd, td)


@router.api_route("/probe-endpoints", methods=["GET", "POST"])
async def probe_tnt_endpoints(user=Depends(require_owner)):
    """
    Owner-only: probe all known Trak N Tell endpoint variants to discover which
    ones your account supports (history, sensors, CAN, alerts, trips).
    Accepts both GET and POST so cached frontend builds don't 405.
    """
    return await probe_all_endpoints(user["user_id"])


@router.post("/discover-endpoints")
async def discover_tnt_endpoints(user=Depends(require_owner)):
    """
    Owner-only: use a headless browser with the stored JSESSIONID to discover
    which TnT endpoint variants work for this account via same-origin fetch().
    More reliable than HTTP probing because the browser's own session cookies
    are applied automatically (no CORS, no header injection needed).
    Falls back to HTTP probing if Playwright fails.
    """
    from .history_service import _get_creds
    creds = await _get_creds(user["user_id"])
    if not creds or not creds.get("sessionid"):
        raise HTTPException(status_code=400, detail="No Trak N Tell credentials configured.")

    result = await discover_endpoints_via_browser(creds)
    if result.get("error") and not result.get("reachable_endpoints"):
        # Playwright failed — fall back to server-side HTTP probing
        fallback = await probe_all_endpoints(user["user_id"])
        fallback["playwright_error"] = result["error"]
        return fallback
    return result


class SaveDiscoveredEndpointsRequest(BaseModel):
    reachable_endpoints: list[str]


@router.post("/save-discovered-endpoints")
async def save_discovered_endpoints_route(
    req: SaveDiscoveredEndpointsRequest,
    user=Depends(get_current_user),
):
    """
    Save the list of working endpoints discovered by /discover-endpoints so
    they are used automatically on subsequent history/trip fetches.
    """
    from .service import save_discovered_endpoints
    await save_discovered_endpoints(user["user_id"], req.reachable_endpoints)
    return {"ok": True, "saved": len(req.reachable_endpoints)}


class CustomFetchRequest(BaseModel):
    endpoint_name: str     # e.g. "tntServiceGetHistoryData"
    vehicle_id: str        # TnT vehicleid (numeric)
    from_date: str         # YYYY-MM-DD
    to_date: str           # YYYY-MM-DD
    extra_params: dict = {}  # any extra params discovered from DevTools


@router.post("/custom-fetch")
async def custom_tnt_fetch(
    req: CustomFetchRequest,
    user=Depends(get_current_user),
):
    """
    Fetch data from a specific TnT endpoint URL discovered via Chrome DevTools.
    Use this when the auto-probe doesn't find the right endpoint:
      1. Open Chrome DevTools → Network tab on the Trak N Tell web app
      2. Navigate to History / Sensors for a vehicle
      3. Copy the servlet endpoint name from the request URL
      4. POST it here with the vehicleId and date range
    """
    from .history_service import _get_creds, _build_param_variants, _fmt_date_alt, _extract_records
    from datetime import date as date_type

    creds = await _get_creds(user["user_id"])
    if not creds or not creds.get("sessionid"):
        raise HTTPException(status_code=400, detail="No credentials configured")

    try:
        fd = datetime.strptime(req.from_date, "%Y-%m-%d").date()
        td = datetime.strptime(req.to_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be YYYY-MM-DD")

    url = f"https://mapsweb.trakmtell.com/tnt/servlet/{req.endpoint_name}"

    # Try the most common param combinations for the given endpoint
    param_variants = _build_param_variants(creds, req.vehicle_id, fd, td)
    # Also include any user-provided extra params
    if req.extra_params:
        param_variants = [{**p, **req.extra_params} for p in param_variants[:3]]

    cookies = {"JSESSIONID": creds["sessionid"]}
    if creds.get("tnt_s"):
        cookies["tnt_s"] = creds["tnt_s"]
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://mapsweb.trakmtell.com/tnt/servlet/tntWebCurrentStatus",
        "Origin": "https://mapsweb.trakmtell.com",
    }

    tried = []
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        for params in param_variants[:10]:
            try:
                resp = await client.get(url, params=params, cookies=cookies, headers=headers)
                tried.append({"status": resp.status_code, "params_keys": sorted(params.keys())})

                if resp.status_code not in (200,):
                    continue
                if "login" in str(resp.url).lower():
                    raise HTTPException(status_code=401, detail="TnT session expired — re-login")

                text = resp.text.strip()
                if "<html" in text[:200].lower():
                    continue

                first = text.find('{')
                last = text.rfind('}')
                if first < 0:
                    first, last = text.find('['), text.rfind(']')
                if first < 0:
                    continue

                data = json.loads(text[first:last + 1])
                records = _extract_records(data, req.endpoint_name)
                return {
                    "ok": True,
                    "endpoint": req.endpoint_name,
                    "params_used": params,
                    "records": records,
                    "count": len(records),
                    "raw_keys": list(data.keys()) if isinstance(data, dict) else [],
                }
            except HTTPException:
                raise
            except Exception as e:
                tried.append({"error": str(e)})

    raise HTTPException(
        status_code=404,
        detail={
            "message": f"Endpoint '{req.endpoint_name}' did not return data with any parameter combination tried.",
            "tried": tried[:5],
            "hint": "Check the exact URL and query parameters from Chrome DevTools Network tab.",
        }
    )
