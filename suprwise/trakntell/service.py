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

logger = logging.getLogger(__name__)
_credentials_cache: Dict[str, dict] = {}

# Trak N Tell API endpoint — returns JSON with all vehicle data + coordinates
TNT_API_URL = "https://mapsweb.trakmtell.com/tnt/servlet/tntServiceGetCurrentStatus"
TNT_DATA_URL = "https://mapsweb.trakmtell.com/tnt/servlet/tntWebCurrentStatus"


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

            # Log all field names from first vehicle so we can see what the API provides
            if raw_vehicles:
                logger.debug(f"Trak N Tell raw response keys: {sorted(raw_vehicles[0].keys())}")

            for v in raw_vehicles:
                # ── Coordinates ──────────────────────────────────────────────
                lat = float(v.get("currentLat") or v.get("latitude") or v.get("KNOWNLATITUDE") or 0)
                lng = float(v.get("currentLong") or v.get("longitude") or v.get("KNOWNLONGITUDE") or 0)

                # ── Speed ─────────────────────────────────────────────────────
                speed_str = v.get("speed") or v.get("currentSpeed") or "0"
                try:
                    speed = float(speed_str)
                except (ValueError, TypeError):
                    speed = 0.0

                # ── Ignition ──────────────────────────────────────────────────
                ignition_val = v.get("ignition_value") or v.get("ignition") or ""
                ignition_on = v.get("isIgnitionOn")
                ignition_off = v.get("isIgnitionOff")

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

                # ── Vehicle status ────────────────────────────────────────────
                if ignition_status == "on":
                    status = "moving"
                elif ignition_status == "off":
                    status = "stopped"
                elif speed > 0:
                    status = "moving"
                else:
                    status = "idle"

                # ── Address ───────────────────────────────────────────────────
                address = (
                    v.get("KNOWNLOCATION") or
                    v.get("address") or
                    v.get("location") or
                    v.get("currentLocationName") or
                    ""
                )

                # ── Timestamp ─────────────────────────────────────────────────
                last_updated = (
                    v.get("data_received_str") or
                    v.get("data_received_str_info_window") or
                    v.get("KNOWNCREATED") or
                    datetime.now().strftime("%b %d")
                )

                # ── Registration ──────────────────────────────────────────────
                reg_number = (
                    v.get("nick_name") or
                    v.get("vehicle_no") or
                    v.get("registration_number") or
                    v.get("vehicleid", "")[:16]
                )

                device_id = str(v.get("vehicleid") or v.get("device_id") or v.get("imei") or "")

                # ── Network / Signal ──────────────────────────────────────────
                gsm_signal = int(v.get("gsm_signal") or 0)
                is_gsm_working = not v.get("isGSMNotWorking", False)
                if gsm_signal == 0 or not is_gsm_working:
                    network_status = "lost"
                elif gsm_signal <= 9:
                    network_status = "weak"
                elif gsm_signal <= 14:
                    network_status = "fair"
                else:
                    network_status = "good"

                # ── GPS quality ───────────────────────────────────────────────
                def _safe_float(val) -> Optional[float]:
                    try:
                        return float(val) if val is not None and val != "" else None
                    except (ValueError, TypeError):
                        return None

                def _safe_int(val) -> Optional[int]:
                    try:
                        return int(val) if val is not None and val != "" else None
                    except (ValueError, TypeError):
                        return None

                heading = _safe_float(v.get("course") or v.get("heading") or v.get("direction"))
                altitude = _safe_float(v.get("altitude") or v.get("alt"))
                gps_satellites = _safe_int(
                    v.get("no_of_satellites") or v.get("satellites") or v.get("noOfSatellites") or v.get("gps_satellites")
                )
                hdop = _safe_float(v.get("hdop") or v.get("HDOP") or v.get("gps_accuracy"))

                # ── Device Health / Power ─────────────────────────────────────
                main_voltage = float(v.get("main_voltage") or 0)
                backup_voltage = float(v.get("backup_voltage") or 0)
                battery_charge = v.get("battery_charge_status") or v.get("bt_status") or "unknown"
                is_main_power_low = bool(v.get("isMainPowerLow"))
                
                # GPS status: Check if GPS is actually working based on multiple signals
                # Don't rely solely on isGPSNotWorking flag - also check if we have valid coords
                is_gps_not_working_flag = bool(v.get("isGPSNotWorking", False))
                has_valid_coords = (lat != 0 or lng != 0) and (
                    gps_satellites is not None and gps_satellites > 0 or
                    hdop is not None and hdop > 0
                )
                # GPS is working if we have valid coordinates, OR the device says it's working
                is_gps_working = has_valid_coords or not is_gps_not_working_flag

                # ── Distance & Engine Hours ───────────────────────────────────
                odometer = _safe_float(
                    v.get("odometer") or v.get("current_odometer") or v.get("totalKm") or v.get("total_km")
                )
                today_km = _safe_float(
                    v.get("today_kms") or v.get("todayKms") or v.get("today_distance") or v.get("todayDistance")
                )
                # API uses "engine_hour" (singular), not "engine_hours"
                engine_hours = _safe_float(
                    v.get("engine_hour") or v.get("engine_hours") or v.get("engineHours") or v.get("totalEngineHours")
                )
                today_engine_hours = _safe_float(
                    v.get("today_engine_hours") or v.get("todayEngineHours") or v.get("engineHoursToday")
                )
                idle_duration = v.get("idling_time") or v.get("idle_duration") or v.get("idleTime") or None
                stop_duration = v.get("stop_duration") or v.get("stoppedDuration") or v.get("stopped_duration") or None
                # Convert to string if numeric
                if isinstance(idle_duration, (int, float)):
                    idle_duration = f"{idle_duration} min"
                if isinstance(stop_duration, (int, float)):
                    stop_duration = f"{stop_duration} min"

                # ── Driver ────────────────────────────────────────────────────
                driver_name = v.get("driver_name") or v.get("driverName") or v.get("driver") or None
                driver_mobile = v.get("driver_mobile") or v.get("driverMobile") or v.get("driver_phone") or None
                if driver_name and str(driver_name).strip() in ("", "N/A", "NA", "null", "None"):
                    driver_name = None
                if driver_mobile and str(driver_mobile).strip() in ("", "N/A", "NA", "null", "None"):
                    driver_mobile = None

                # ── Fuel ──────────────────────────────────────────────────────
                fuel_percentage = _safe_float(
                    v.get("fuel_percentage") or v.get("fuelPercentage") or v.get("fuelLevel") or v.get("fuel_level")
                )
                fuel_litres = _safe_float(
                    v.get("fuel_litres") or v.get("fuelLitres") or v.get("fuel") or v.get("fuel_ltr")
                )

                # ── Alerts / Events ───────────────────────────────────────────
                def _safe_bool_alert(val) -> Optional[bool]:
                    if val is None:
                        return None
                    if isinstance(val, bool):
                        return val
                    s = str(val).lower()
                    if s in ("true", "1", "yes", "on"):
                        return True
                    if s in ("false", "0", "no", "off"):
                        return False
                    return None

                # API uses "isPanicButton" not "isPanicOn"; "isOverSpeed" not "isOverSpeeding"
                is_panic = _safe_bool_alert(v.get("isPanicButton") or v.get("isPanicOn") or v.get("panic_button"))
                is_towing = _safe_bool_alert(v.get("isTowingAlert") or v.get("towing_alert") or v.get("is_towing"))
                is_overspeeding = _safe_bool_alert(
                    v.get("isOverSpeed") or v.get("isOverSpeeding") or v.get("overspeeding")
                )
                is_harsh_braking = _safe_bool_alert(
                    v.get("isHarshBraking") or v.get("harsh_braking") or v.get("is_harsh_braking")
                )
                is_harsh_acceleration = _safe_bool_alert(
                    v.get("isHarshAcceleration") or v.get("harsh_acceleration") or v.get("is_harsh_acceleration")
                )
                is_inside_geofence = _safe_bool_alert(
                    v.get("isInsideGeofence") or v.get("geofence_status") or v.get("inside_geofence")
                )

                # ── Security ─────────────────────────────────────────────────
                immobilizer_raw = v.get("immobilizer_status") or v.get("immobilizer") or v.get("isImmobilizerOn")
                if immobilizer_raw is not None:
                    if isinstance(immobilizer_raw, bool):
                        immobilizer = "armed" if immobilizer_raw else "disarmed"
                    else:
                        s = str(immobilizer_raw).lower()
                        immobilizer = "armed" if s in ("armed", "on", "true", "1") else "disarmed"
                else:
                    immobilizer = None

                # ── Sensors ───────────────────────────────────────────────────
                temperature = _safe_float(
                    v.get("temperature") or v.get("temperature1") or v.get("temp1") or v.get("temp")
                )
                temperature2 = _safe_float(v.get("temperature2") or v.get("temp2"))
                door_status_raw = v.get("door_status") or v.get("doorStatus") or v.get("door")
                door_status = str(door_status_raw).lower() if door_status_raw is not None else None
                if door_status and door_status not in ("open", "closed"):
                    door_status = "open" if door_status in ("1", "true", "yes") else "closed"

                ac_raw = v.get("ac_status") or v.get("acStatus") or v.get("air_conditioner")
                ac_status = None
                if ac_raw is not None:
                    s = str(ac_raw).lower()
                    ac_status = "on" if s in ("on", "1", "true") else "off"

                rpm = _safe_int(v.get("rpm") or v.get("engine_rpm") or v.get("engineRpm"))

                # ── SLI Crane Sensors (Analog Inputs ain8–ain14) ─────────────
                sli_duty = _safe_float(v.get("ain8_value"))
                sli_angle = _safe_float(v.get("ain9_value"))
                sli_radius = _safe_float(v.get("ain10_value"))
                sli_length = _safe_float(v.get("ain11_value"))
                sli_load = _safe_float(v.get("ain12_value"))
                sli_swl = _safe_float(v.get("ain13_value"))
                sli_overload = _safe_float(v.get("ain14_value"))
                battery_charge_status = str(v.get("din4_value") or "").strip() or None
                sos_button = str(v.get("din7_value") or "").strip() or None

                # Generic ain parser: all ain{N} with a label
                ain_sensors = []
                for n in range(1, 25):
                    lbl = v.get(f"ain{n}_label")
                    if lbl and str(lbl).strip():
                        ain_sensors.append({
                            "label": str(lbl).strip(),
                            "value": v.get(f"ain{n}_value"),
                            "units": str(v.get(f"ain{n}_units") or "").strip(),
                        })

                # ── J1939 CAN Bus ─────────────────────────────────────────────
                j1939_hour_meter = _safe_float(v.get("j1939_hmr_value"))
                j1939_coolant_temp = _safe_float(v.get("j1939_ecp_value"))
                j1939_oil_pressure = _safe_float(v.get("j1939_eop_value"))
                j1939_fuel_level = _safe_float(v.get("j1939_fl_value"))
                j1939_engine_speed = _safe_int(v.get("j1939_rpm_value"))
                j1939_fuel_consumption = _safe_float(v.get("j1939_rtfc_value"))
                j1939_mil = _safe_bool_alert(v.get("j1939_mil_value"))
                j1939_stop_indicator = _safe_bool_alert(v.get("j1939_si_value"))
                j1939_battery_potential = _safe_float(v.get("j1939_sbp_value"))
                j1939_trans_oil_temp = _safe_float(v.get("j1939_tot_value"))
                j1939_urea_level = _safe_float(v.get("j1939_ul_value"))
                j1939_water_in_fuel = _safe_bool_alert(v.get("j1939_wif_value"))

                # ── Ignition / Parking state strings ─────────────────────────
                ignition_on_since = str(v.get("ignition_on_since") or "").strip() or None
                ignition_off_since = str(v.get("ignition_off_since") or "").strip() or None
                parked_since = str(v.get("parked_since") or "").strip() or None
                trip_distance = _safe_float(v.get("trip_distance"))
                trip_avg_speed = _safe_float(v.get("trip_avg_speed"))

                vehicles.append(TrakNTellVehicle(
                    registration_number=reg_number,
                    device_id=device_id,
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
                    # GPS quality
                    heading=heading,
                    altitude=altitude,
                    gps_satellites=gps_satellites,
                    hdop=hdop,
                    # Device health
                    main_voltage=main_voltage,
                    backup_voltage=backup_voltage,
                    battery_charge=battery_charge,
                    is_main_power_low=is_main_power_low,
                    is_gps_working=is_gps_working,
                    # Distance & hours
                    odometer=odometer,
                    today_km=today_km,
                    engine_hours=engine_hours,
                    today_engine_hours=today_engine_hours,
                    idle_duration=idle_duration,
                    stop_duration=stop_duration,
                    # Driver
                    driver_name=driver_name,
                    driver_mobile=driver_mobile,
                    # Fuel
                    fuel_percentage=fuel_percentage,
                    fuel_litres=fuel_litres,
                    # Alerts
                    is_panic=is_panic,
                    is_towing=is_towing,
                    is_overspeeding=is_overspeeding,
                    is_harsh_braking=is_harsh_braking,
                    is_harsh_acceleration=is_harsh_acceleration,
                    is_inside_geofence=is_inside_geofence,
                    # Security
                    immobilizer=immobilizer,
                    # Sensors
                    temperature=temperature,
                    temperature2=temperature2,
                    door_status=door_status,
                    ac_status=ac_status,
                    rpm=rpm,
                    # SLI crane sensors
                    sli_duty=sli_duty,
                    sli_angle=sli_angle,
                    sli_radius=sli_radius,
                    sli_length=sli_length,
                    sli_load=sli_load,
                    sli_swl=sli_swl,
                    sli_overload=sli_overload,
                    battery_charge_status=battery_charge_status,
                    sos_button=sos_button,
                    ain_sensors=ain_sensors,
                    # J1939 CAN bus
                    j1939_hour_meter=j1939_hour_meter,
                    j1939_coolant_temp=j1939_coolant_temp,
                    j1939_oil_pressure=j1939_oil_pressure,
                    j1939_fuel_level=j1939_fuel_level,
                    j1939_engine_speed=j1939_engine_speed,
                    j1939_fuel_consumption=j1939_fuel_consumption,
                    j1939_mil=j1939_mil,
                    j1939_stop_indicator=j1939_stop_indicator,
                    j1939_battery_potential=j1939_battery_potential,
                    j1939_trans_oil_temp=j1939_trans_oil_temp,
                    j1939_urea_level=j1939_urea_level,
                    j1939_water_in_fuel=j1939_water_in_fuel,
                    # Ignition/parking state + trip
                    ignition_on_since=ignition_on_since,
                    ignition_off_since=ignition_off_since,
                    parked_since=parked_since,
                    trip_distance=trip_distance,
                    trip_avg_speed=trip_avg_speed,
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


async def save_discovered_endpoints(user_id: str, reachable_endpoints: list) -> bool:
    """
    Persist the list of working endpoints discovered by /discover-endpoints.
    Stored as JSON so future fetches can try the known-good endpoint first.
    """
    import json
    db = await get_db()
    try:
        await db.execute(
            "UPDATE trakntell_credentials SET discovered_endpoints_json = ? WHERE user_id = ?",
            (json.dumps(reachable_endpoints), user_id),
        )
        await db.commit()
        clear_credentials_cache(user_id)
        return True
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to save discovered endpoints: {e}")
        return False
