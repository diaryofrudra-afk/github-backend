"""
Trak N Tell GPS integration — Direct API calls to tntServiceGetCurrentStatus.
Fetches vehicle data with live coordinates (latitude/longitude), address, speed, ignition status.
"""
from __future__ import annotations

import asyncio
import logging
import re
import json
import httpx
from typing import Optional, Dict, List, Any
from datetime import datetime

from ..config import settings
from ..database import get_db
from .models import TrakNTellData, TrakNTellVehicle
from .crypto import decrypt_token, encrypt_token
from ..gps.models import TripPoint, TripHistoryResponse

logger = logging.getLogger(__name__)
_credentials_cache: Dict[str, dict] = {}

# Trak N Tell API endpoint — returns JSON with all vehicle data + coordinates
TNT_API_URL = "https://mapsweb.trakmtell.com/tnt/servlet/tntServiceGetCurrentStatus"
TNT_DATA_URL = "https://mapsweb.trakmtell.com/tnt/servlet/tntWebCurrentStatus"
TNT_HISTORY_URL = "https://mapsweb.trakmtell.com/tnt/servlet/tntServiceGetHistory"


async def _get_user_credentials(user_id: str) -> Optional[dict]:
    """Resolve credentials: cache -> DB per-user only."""
    if user_id in _credentials_cache:
        return _credentials_cache[user_id]
    
    try:
        db = await get_db()
        cursor = await db.execute(
            "SELECT user_id_encrypted, user_id_encrypt_encrypted, orgid_encrypted, sessionid_encrypted, tnt_s_encrypted FROM trakntell_credentials WHERE user_id = ?",
            (user_id,),
        )
        row = await cursor.fetchone()
        if row:
            creds = {
                "user_id": decrypt_token(row[0]),
                "user_id_encrypt": decrypt_token(row[1]),
                "orgid": decrypt_token(row[2]),
                "sessionid": decrypt_token(row[3]) if row[3] else None,
                "tnt_s": decrypt_token(row[4]) if len(row) > 4 and row[4] else None,
            }
            _credentials_cache[user_id] = creds
            return creds
    except Exception as e:
        logger.error(f"Failed to get credentials for user {user_id}: {e}", exc_info=True)

    return None


def clear_credentials_cache(user_id: Optional[str] = None):
    if user_id:
        _credentials_cache.pop(user_id, None)
    else:
        _credentials_cache.clear()


async def fetch_vehicles_via_api(
    user_id: str,
    user_id_encrypt: str,
    orgid: str,
    sessionid: str,
    tnt_s: Optional[str] = None
) -> List[TrakNTellVehicle]:
    """
    Fetch vehicle data directly from Trak N Tell API.
    Returns vehicles with coordinates (lat/lng), address, speed, ignition status.
    """
    vehicles = []

    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            cookies = {"JSESSIONID": sessionid}
            if tnt_s:
                cookies["tnt_s"] = tnt_s

            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": TNT_DATA_URL,
                "Origin": "https://mapsweb.trakmtell.com",
            }

            params = {
                "f": "l",
                "u": user_id,
                "userIdEncrypt": user_id_encrypt,
                "orgid": orgid,
            }

            logger.info(f"Fetching Trak N Tell vehicles from API...")
            resp = await client.get(TNT_API_URL, params=params, cookies=cookies, headers=headers)

            if resp.status_code in (401, 403) or (resp.status_code == 200 and "login" in str(resp.url).lower()):
                logger.error(f"Trak N Tell session expired or invalid (HTTP {resp.status_code}). Re-extract JSESSIONID from web.trakntell.com.")
                return vehicles
            if resp.status_code != 200:
                logger.error(f"Trak N Tell API returned HTTP {resp.status_code}")
                return vehicles

            # Parse JSON response (handle potentially truncated response)
            text = resp.text
            first_brace = text.find('{')
            last_brace = text.rfind('}')
            if first_brace < 0 or last_brace <= first_brace:
                logger.error("No JSON object found in Trak N Tell response")
                return vehicles

            json_str = text[first_brace:last_brace+1]
            try:
                data = json.loads(json_str)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse Trak N Tell API response: {e}")
                return vehicles

            raw_vehicles = data.get("response", [])
            if not raw_vehicles:
                logger.info("No vehicles found in Trak N Tell API response")
                return vehicles

            for v in raw_vehicles:
                # Extract coordinates
                lat = float(v.get("currentLat") or v.get("latitude") or v.get("KNOWNLATITUDE") or 0)
                lng = float(v.get("currentLong") or v.get("longitude") or v.get("KNOWNLONGITUDE") or 0)

                # Extract speed
                speed_str = v.get("speed") or v.get("currentSpeed") or "0"
                try:
                    speed = float(speed_str)
                except (ValueError, TypeError):
                    speed = 0.0

                # Extract ignition status — multiple fields to check (priority order)
                ignition_val = v.get("ignition_value") or v.get("ignition") or ""
                ignition_on = v.get("isIgnitionOn")
                ignition_off = v.get("isIgnitionOff")

                # Normalize to "on" or "off"
                if str(ignition_val).lower() in ("on", "1", "true"):
                    ignition_status = "on"
                elif str(ignition_val).lower() in ("off", "0", "false"):
                    ignition_status = "off"
                elif ignition_on is True:
                    ignition_status = "on"
                elif ignition_off is True:
                    ignition_status = "off"
                else:
                    ignition_status = "unknown"

                # Determine vehicle status based on ignition and speed
                if ignition_status == "on":
                    status = "moving"  # Engine ON
                elif ignition_status == "off":
                    status = "stopped"  # Engine OFF
                elif speed > 0:
                    status = "moving"
                else:
                    status = "idle"

                # Extract address/location
                address = (
                    v.get("KNOWNLOCATION") or
                    v.get("address") or
                    v.get("location") or
                    v.get("currentLocationName") or
                    ""
                )

                # Extract last updated timestamp
                last_updated = (
                    v.get("data_received_str") or
                    v.get("data_received_str_info_window") or
                    v.get("KNOWNCREATED") or
                    datetime.now().strftime("%b %d")
                )

                # Extract vehicle registration/number
                reg_number = (
                    v.get("nick_name") or
                    v.get("vehicle_no") or
                    v.get("registration_number") or
                    v.get("vehicleid", "")[:16]  # Fallback to truncated vehicle ID
                )
                
                vehicle_id = v.get("vehicleid", "")

                # ── Network / Signal ──
                gsm_signal = int(v.get("gsm_signal") or 0)

                # GSM signal quality: 0=lost, 1-9=weak, 10-14=fair, 15-19=good, 20-31=excellent
                is_gsm_working = not v.get("isGSMNotWorking", False)
                if gsm_signal == 0 or not is_gsm_working:
                    network_status = "lost"
                elif gsm_signal <= 9:
                    network_status = "weak"
                elif gsm_signal <= 14:
                    network_status = "fair"
                else:
                    network_status = "good"

                # ── Device Health ──
                main_voltage = float(v.get("main_voltage") or 0)
                backup_voltage = float(v.get("backup_voltage") or 0)
                battery_charge = v.get("battery_charge_status") or v.get("bt_status") or "unknown"
                is_main_power_low = bool(v.get("isMainPowerLow"))
                is_gps_working = not v.get("isGPSNotWorking", False)

                vehicles.append(TrakNTellVehicle(
                    registration_number=reg_number,
                    vehicle_id=vehicle_id,
                    status=status,
                    address=address,
                    latitude=lat,
                    longitude=lng,
                    speed=speed,
                    ignition=ignition_status,
                    last_updated=last_updated,
                    # Network
                    gsm_signal=gsm_signal,
                    network_status=network_status,
                    is_gsm_working=is_gsm_working,
                    # Device health
                    main_voltage=main_voltage,
                    backup_voltage=backup_voltage,
                    battery_charge=battery_charge,
                    is_main_power_low=is_main_power_low,
                    is_gps_working=is_gps_working,
                ))

            logger.info(f"✅ Fetched {len(vehicles)} vehicles from Trak N Tell API")
            for v in vehicles:
                logger.info(f"  • {v.registration_number} | Ignition: {v.ignition.upper()} | GSM: {v.gsm_signal} ({v.network_status}) | Power: {v.main_voltage}V | {v.address[:50]}")

    except httpx.RequestError as e:
        logger.error(f"Trak N Tell API request failed: {e}")
    except Exception as e:
        logger.error(f"Trak N Tell API fetch failed: {e}", exc_info=True)

    return vehicles


def _mock_trakntell_data() -> TrakNTellData:
    """No credentials configured."""
    return TrakNTellData(
        error="No Trak N Tell credentials configured. Please configure your GPS account in GPS Settings."
    )


async def fetch_trakntell_vehicle_data(user_id: Optional[str] = None) -> TrakNTellData:
    """
    Fetch live vehicle data from Trak N Tell using direct API call.
    Much faster and more reliable than Playwright scraping.
    """
    creds = None
    if user_id:
        creds = await _get_user_credentials(user_id)

    if not creds:
        return _mock_trakntell_data()

    if not creds.get("sessionid"):
        return TrakNTellData(
            error="No JSESSIONID found. Please login to Trak N Tell in your browser and save the JSESSIONID cookie."
        )

    # Fetch vehicles via direct API call
    vehicles = await fetch_vehicles_via_api(
        user_id=creds["user_id"],
        user_id_encrypt=creds["user_id_encrypt"],
        orgid=creds["orgid"],
        sessionid=creds["sessionid"],
        tnt_s=creds.get("tnt_s"),
    )

    if not vehicles:
        return TrakNTellData(
            vehicles=[],
            error="No vehicles found. Your Trak N Tell session may have expired — re-extract JSESSIONID from web.trakntell.com (Chrome DevTools → Application → Cookies) and update via GPS Settings.",
        )

    return TrakNTellData(vehicles=vehicles)


async def fetch_trakntell_iframe_url(user_id: Optional[str] = None) -> TrakNTellData:
    """Get the iframe URL for Trak N Tell."""
    creds = None
    if user_id:
        creds = await _get_user_credentials(user_id)

    if not creds:
        return _mock_trakntell_data()

    from urllib.parse import quote
    params = (
        f"f=l"
        f"&u={creds['user_id']}"
        f"&userIdEncrypt={quote(creds['user_id_encrypt'])}"
        f"&orgid={quote(creds['orgid'])}"
    )
    iframe_url = f"{TNT_DATA_URL}?{params}"
    return TrakNTellData(iframe_url=iframe_url)


async def store_credentials(
    user_id: str,
    tenant_id: str,
    tnt_user_id: str,
    tnt_user_id_encrypt: str,
    tnt_orgid: str,
    tnt_sessionid: str = "",
    tnt_s: str = "",
) -> bool:
    """Store encrypted Trak N Tell credentials."""
    encrypted_uid = encrypt_token(tnt_user_id)
    encrypted_uid_encrypt = encrypt_token(tnt_user_id_encrypt)
    encrypted_orgid = encrypt_token(tnt_orgid)
    encrypted_sessionid = encrypt_token(tnt_sessionid) if tnt_sessionid else None
    encrypted_tnt_s = encrypt_token(tnt_s) if tnt_s else None

    db = await get_db()

    try:
        cursor = await db.execute(
            "SELECT id FROM trakntell_credentials WHERE user_id = ?", (user_id,)
        )
        existing = await cursor.fetchone()
    except Exception:
        existing = None

    import uuid

    if existing:
        await db.execute(
            """UPDATE trakntell_credentials 
               SET user_id_encrypted = ?, 
                   user_id_encrypt_encrypted = ?, 
                   orgid_encrypted = ?, 
                   sessionid_encrypted = ?,
                   tnt_s_encrypted = ?,
                   updated_at = datetime('now') 
               WHERE user_id = ?""",
            (encrypted_uid, encrypted_uid_encrypt, encrypted_orgid, 
             encrypted_sessionid, encrypted_tnt_s, user_id),
        )
    else:
        await db.execute(
            """INSERT INTO trakntell_credentials 
               (id, user_id, tenant_id, user_id_encrypted, user_id_encrypt_encrypted, 
                orgid_encrypted, sessionid_encrypted, tnt_s_encrypted) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (str(uuid.uuid4()), user_id, tenant_id,
             encrypted_uid, encrypted_uid_encrypt, encrypted_orgid,
             encrypted_sessionid, encrypted_tnt_s),
        )
    await db.commit()
    clear_credentials_cache(user_id)
    return True


async def get_credentials_status(user_id: str) -> Optional[dict]:
    """Get credential status."""
    try:
        db = await get_db()
        cursor = await db.execute(
            "SELECT user_id_encrypted, sessionid_encrypted, updated_at FROM trakntell_credentials WHERE user_id = ?",
            (user_id,),
        )
        row = await cursor.fetchone()
    except Exception:
        return None

    if row:
        decrypted_uid = decrypt_token(row[0])
        preview = decrypted_uid[:4] + "..." + decrypted_uid[-4:] if len(decrypted_uid) > 8 else "(hidden)"
        return {
            "configured": True,
            "user_id_preview": preview,
            "has_sessionid": row[1] is not None,
            "updated_at": row[2],
        }
    return None


async def delete_credentials(user_id: str) -> bool:
    """Delete credentials."""
    db = await get_db()
    await db.execute("DELETE FROM trakntell_credentials WHERE user_id = ?", (user_id,))
    await db.commit()
    clear_credentials_cache(user_id)
    return True

async def fetch_trakntell_trip_history(user_id: str, vehicle_id: str, from_date: str, to_date: str) -> TripHistoryResponse:
    """
    Fetch historical trip GPS points for a single Trak N Tell vehicle.
    from_date and to_date formatted as "dd/MM/yyyy HH:mm"
    """
    creds = await _get_user_credentials(user_id)
    if not creds or not creds.get("sessionid"):
        return TripHistoryResponse(
            provider="trakntell",
            vehicle=vehicle_id,
            error="No Trak N Tell credentials configured or missing session cookie."
        )

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
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

            params = {
                "vehicleid": vehicle_id,
                "u": creds["user_id"],
                "userIdEncrypt": creds["user_id_encrypt"],
                "orgid": creds["orgid"],
                "fromDate": from_date,
                "toDate": to_date
            }

            resp = await client.get(TNT_HISTORY_URL, params=params, cookies=cookies, headers=headers)
            
            if resp.status_code in (401, 403) or (resp.status_code == 200 and "login" in str(resp.url).lower()):
                return TripHistoryResponse(provider="trakntell", vehicle=vehicle_id, error="Trak N Tell session expired.")
            
            if resp.status_code != 200:
                return TripHistoryResponse(provider="trakntell", vehicle=vehicle_id, error=f"Trak N Tell API error: {resp.status_code}")

            text = resp.text
            first_brace = text.find('{')
            last_brace = text.rfind('}')
            if first_brace < 0 or last_brace <= first_brace:
                return TripHistoryResponse(provider="trakntell", vehicle=vehicle_id, error="Invalid JSON response from Trak N Tell.")

            json_str = text[first_brace:last_brace+1]
            try:
                data = json.loads(json_str)
            except json.JSONDecodeError as e:
                return TripHistoryResponse(provider="trakntell", vehicle=vehicle_id, error=f"Failed to parse history JSON: {str(e)}")

            raw_history = data.get("response", [])
            points = []
            
            for item in raw_history:
                try:
                    lat = float(item.get("currentLat") or item.get("latitude") or item.get("KNOWNLATITUDE") or 0.0)
                    lng = float(item.get("currentLong") or item.get("longitude") or item.get("KNOWNLONGITUDE") or 0.0)
                    if lat == 0.0 and lng == 0.0:
                        continue
                        
                    speed_str = item.get("speed") or item.get("currentSpeed") or "0"
                    try:
                        speed = float(speed_str)
                    except ValueError:
                        speed = 0.0
                        
                    timestamp = item.get("data_received_str") or item.get("KNOWNCREATED") or ""
                    address = item.get("KNOWNLOCATION") or item.get("address") or item.get("location") or ""
                    
                    points.append(TripPoint(lat=lat, lng=lng, speed=speed, timestamp=timestamp, address=address))
                except Exception:
                    pass

            return TripHistoryResponse(
                points=points,
                total=len(points),
                provider="trakntell",
                vehicle=vehicle_id
            )

    except httpx.TimeoutException:
        return TripHistoryResponse(provider="trakntell", vehicle=vehicle_id, error="Connection timed out.")
    except Exception as e:
        return TripHistoryResponse(provider="trakntell", vehicle=vehicle_id, error=f"History fetch failed: {str(e)}")
