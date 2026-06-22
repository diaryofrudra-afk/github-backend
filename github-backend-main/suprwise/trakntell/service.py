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
# Global cache for vehicle telemetry partitioned by user_id
# Format: {user_id: (timestamp, data)}
_vehicles_cache: Dict[str, tuple[float, TrakNTellData]] = {}


def clear_vehicles_cache(user_id: Optional[str] = None):
    if user_id:
        _vehicles_cache.pop(user_id, None)
    else:
        _vehicles_cache.clear()


# Trak N Tell API endpoint — returns JSON with all vehicle data + coordinates
TNT_API_URL = "https://mapsweb.trakmtell.com/tnt/servlet/tntServiceGetCurrentStatus"
TNT_DATA_URL = "https://mapsweb.trakmtell.com/tnt/servlet/tntWebCurrentStatus"


async def _get_user_credentials(user_id: str, bypass_cache: bool = False) -> Optional[dict]:
    """Resolve credentials: cache -> DB per-user only."""
    if not bypass_cache and user_id in _credentials_cache:
        return _credentials_cache[user_id]

    try:
        db = await get_db()
        cursor = await db.execute(
            "SELECT user_id_encrypted, user_id_encrypt_encrypted, orgid_encrypted, sessionid_encrypted, tnt_s_encrypted, username_encrypted, password_encrypted FROM trakntell_credentials WHERE user_id = ?",
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
                "username": decrypt_token(row[5]) if len(row) > 5 and row[5] else None,
                "password": decrypt_token(row[6]) if len(row) > 6 and row[6] else None,
            }
            _credentials_cache[user_id] = creds
            return creds
    except Exception as e:
        logger.error(f"Failed to get credentials for user {user_id}: {e}", exc_info=True)

    return None


def clear_credentials_cache(user_id: Optional[str] = None):
    if user_id:
        _credentials_cache.pop(user_id, None)
        clear_vehicles_cache(user_id)
    else:
        _credentials_cache.clear()
        clear_vehicles_cache()


async def _auto_refresh_session(app_user_id: str) -> bool:
    """
    Try to get a fresh JSESSIONID using stored username/password via headless login.
    Returns True if session was refreshed successfully.
    """
    creds = await _get_user_credentials(app_user_id, bypass_cache=True)
    if not creds or not creds.get("username") or not creds.get("password"):
        logger.info(f"No stored username/password for user {app_user_id} — cannot auto-refresh TnT session")
        return False

    logger.info(f"Auto-refreshing Trak N Tell session for user {app_user_id}...")
    try:
        from .auto_login import trakntell_headless_login
        login_result = await trakntell_headless_login(creds["username"], creds["password"])
    except Exception as e:
        logger.error(f"Auto-refresh login failed for user {app_user_id}: {e}")
        return False

    if not login_result.get("success") or not login_result.get("sessionid"):
        logger.warning(f"Auto-refresh login did not produce a JSESSIONID for user {app_user_id}: {login_result.get('error')}")
        return False

    # Persist fresh session to DB
    try:
        db = await get_db()
        await db.execute(
            """UPDATE trakntell_credentials
               SET sessionid_encrypted = ?,
                   tnt_s_encrypted = ?,
                   updated_at = datetime('now')
               WHERE user_id = ?""",
            (
                encrypt_token(login_result["sessionid"]),
                encrypt_token(login_result["tnt_s"]) if login_result.get("tnt_s") else None,
                app_user_id,
            ),
        )
        await db.commit()
    except Exception as e:
        logger.error(f"Failed to persist refreshed TnT session for user {app_user_id}: {e}")
        return False

    clear_credentials_cache(app_user_id)
    logger.info(f"✅ TnT session auto-refreshed for user {app_user_id}")
    return True


async def fetch_vehicles_via_api(
    user_id: str,
    user_id_encrypt: str,
    orgid: str,
    sessionid: str,
    tnt_s: Optional[str] = None,
    app_user_id: Optional[str] = None,
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
                logger.error(f"Trak N Tell session expired or invalid (HTTP {resp.status_code}). Clearing stale cache.")
                if app_user_id:
                    clear_credentials_cache(app_user_id)
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
                # TnT often sends 'data_received' as a millisecond timestamp
                raw_ts = v.get("data_received")
                last_updated = ""
                if raw_ts and isinstance(raw_ts, (int, float)):
                    try:
                        # Convert ms to seconds if needed
                        ts_val = raw_ts / 1000 if raw_ts > 1e11 else raw_ts
                        dt_obj = datetime.fromtimestamp(ts_val)
                        last_updated = dt_obj.strftime("%d %b, %I:%M %p")
                    except Exception:
                        pass
                
                if not last_updated:
                    last_updated = (
                        v.get("data_received_str") or
                        v.get("data_received_str_info_window") or
                        v.get("KNOWNCREATED") or
                        datetime.now().strftime("%d %b, %I:%M %p")
                    )

                # ── Registration ──────────────────────────────────────────────
                reg_number = (
                    v.get("vehicle_no") or
                    v.get("registration_number") or
                    v.get("nick_name") or
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

                def _first(*keys):
                    """Return first non-None, non-empty value — correctly handles 0 and False."""
                    for k in keys:
                        val = v.get(k)
                        if val is not None and str(val).strip() != "":
                            return val
                    return None

                heading = _safe_float(_first("course", "heading", "direction"))
                altitude = _safe_float(_first("altitude", "alt"))
                gps_satellites = _safe_int(_first("no_of_satellites", "satellites", "noOfSatellites", "gps_satellites"))
                hdop = _safe_float(_first("hdop", "HDOP", "gps_accuracy"))

                # ── Device Health / Power ─────────────────────────────────────
                main_voltage = float(v.get("main_voltage") or 0)
                backup_voltage = float(v.get("backup_voltage") or 0)
                battery_charge = v.get("battery_charge_status") or v.get("bt_status") or "unknown"
                is_main_power_low = bool(v.get("isMainPowerLow"))

                has_valid_coords = (lat != 0 and lng != 0)
                is_gps_not_working_flag = bool(v.get("isGPSNotWorking", False))
                is_gps_working = has_valid_coords or not is_gps_not_working_flag

                # ── Distance & Engine Hours ───────────────────────────────────
                # Use _first() so a value of 0 is not skipped as falsy
                odometer = _safe_float(_first("odometer", "current_odometer", "totalKm", "total_km"))
                today_km = _safe_float(_first("today_kms", "todayKms", "today_distance", "todayDistance"))
                # TnT API uses "engine_hour" (singular) for total hours
                engine_hours = _safe_float(_first("engine_hour", "engine_hours", "engineHours", "totalEngineHours"))
                today_engine_hours = _safe_float(_first("today_engine_hours", "todayEngineHours", "engineHoursToday"))
                idle_duration = _first("idling_time", "idle_duration", "idleTime")
                stop_duration = _first("stop_duration", "stoppedDuration", "stopped_duration")
                if isinstance(idle_duration, (int, float)):
                    idle_duration = f"{idle_duration} min"
                if isinstance(stop_duration, (int, float)):
                    stop_duration = f"{stop_duration} min"

                # ── Driver ────────────────────────────────────────────────────
                driver_name = _first("driver_name", "driverName", "driver")
                driver_mobile = _first("driver_mobile", "driverMobile", "driver_phone")
                if driver_name and str(driver_name).strip() in ("", "N/A", "NA", "null", "None"):
                    driver_name = None
                if driver_mobile and str(driver_mobile).strip() in ("", "N/A", "NA", "null", "None"):
                    driver_mobile = None

                # ── Fuel ──────────────────────────────────────────────────────
                # Prioritize J1939 CAN bus data; raw value needs ÷2 correction
                raw_j1939_fl = _safe_float(v.get("j1939_fl_value"))
                j1939_fl = (raw_j1939_fl * 0.5) if raw_j1939_fl is not None else None

                fuel_percentage = j1939_fl if j1939_fl is not None else _safe_float(
                    _first("fuel_percentage", "fuelPercentage", "fuelLevel", "fuel_level")
                )
                fuel_litres = _safe_float(_first("fuel_litres", "fuelLitres", "fuel", "fuel_ltr"))

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
                is_panic = _safe_bool_alert(_first("isPanicButton", "isPanicOn", "panic_button"))
                is_towing = _safe_bool_alert(_first("isTowingAlert", "towing_alert", "is_towing"))
                is_overspeeding = _safe_bool_alert(_first("isOverSpeed", "isOverSpeeding", "overspeeding"))
                is_harsh_braking = _safe_bool_alert(_first("isHarshBraking", "harsh_braking", "is_harsh_braking"))
                is_harsh_acceleration = _safe_bool_alert(_first("isHarshAcceleration", "harsh_acceleration", "is_harsh_acceleration"))
                is_inside_geofence = _safe_bool_alert(_first("isInsideGeofence", "geofence_status", "inside_geofence"))

                # ── Security ──────────────────────────────────────────────────
                immobilizer_raw = _first("immobilizer_status", "immobilizer", "isImmobilizerOn")
                if immobilizer_raw is not None:
                    if isinstance(immobilizer_raw, bool):
                        immobilizer = "armed" if immobilizer_raw else "disarmed"
                    else:
                        s = str(immobilizer_raw).lower()
                        immobilizer = "armed" if s in ("armed", "on", "true", "1") else "disarmed"
                else:
                    immobilizer = None

                # Force-enable for specific vehicle as requested
                if reg_number == "ECE02205CS0070719":
                    v["immobilizer_enabled"] = "y"

                # ── Sensors ───────────────────────────────────────────────────
                temperature = _safe_float(_first("temperature", "temperature1", "temp1", "temp"))
                temperature2 = _safe_float(_first("temperature2", "temp2"))
                door_status_raw = _first("door_status", "doorStatus", "door")
                door_status = str(door_status_raw).lower() if door_status_raw is not None else None
                if door_status and door_status not in ("open", "closed"):
                    door_status = "open" if door_status in ("1", "true", "yes") else "closed"

                ac_raw = _first("ac_status", "acStatus", "air_conditioner")
                ac_status = None
                if ac_raw is not None:
                    s = str(ac_raw).lower()
                    ac_status = "on" if s in ("on", "1", "true") else "off"

                rpm = _safe_int(_first("rpm", "engine_rpm", "engineRpm"))

                # ── Generic ain parser: all ain{N} with a label (runs first) ──
                ain_sensors = []
                for n in range(1, 25):
                    lbl = v.get(f"ain{n}_label")
                    if lbl and str(lbl).strip():
                        ain_sensors.append({
                            "label": str(lbl).strip(),
                            "value": v.get(f"ain{n}_value"),
                            "units": str(v.get(f"ain{n}_units") or "").strip(),
                        })

                # ── SLI Crane Sensors ─────────────────────────────────────────
                # Primary: hardcoded ain8–ain14 channel mapping used by most TnT SLI installs
                sli_duty    = _safe_float(v.get("ain8_value"))
                sli_angle   = _safe_float(v.get("ain9_value"))
                sli_radius  = _safe_float(v.get("ain10_value"))
                sli_length  = _safe_float(v.get("ain11_value"))
                sli_load    = _safe_float(v.get("ain12_value"))
                sli_swl     = _safe_float(v.get("ain13_value"))
                sli_overload = _safe_float(v.get("ain14_value"))
                battery_charge_status = str(v.get("din4_value") or "").strip() or None
                sos_button = str(v.get("din7_value") or "").strip() or None

                # Fallback: scan labeled ain_sensors for SLI fields by keyword
                # (handles devices where SLI is wired to different ain channels)
                for _s in ain_sensors:
                    lbl_lower = _s["label"].lower()
                    val = _safe_float(_s["value"])
                    if val is None:
                        continue
                    if sli_duty is None and any(x in lbl_lower for x in ("duty",)):
                        sli_duty = val
                    elif sli_angle is None and any(x in lbl_lower for x in ("angle", "boom angle")):
                        sli_angle = val
                    elif sli_radius is None and any(x in lbl_lower for x in ("radius", "boom radius")):
                        sli_radius = val
                    elif sli_length is None and any(x in lbl_lower for x in ("length", "boom length")):
                        sli_length = val
                    elif sli_load is None and any(x in lbl_lower for x in ("load", "hook", "actual load", "load on hook")):
                        sli_load = val
                    elif sli_swl is None and any(x in lbl_lower for x in ("swl", "safe working", "safe load")):
                        sli_swl = val
                    elif sli_overload is None and any(x in lbl_lower for x in ("overload",)):
                        sli_overload = val
                    # Engine hours from a labeled ain channel
                    elif today_engine_hours is None and any(x in lbl_lower for x in ("engine hour", "engine hrs", "hour meter", "run hour")):
                        today_engine_hours = val
                    elif engine_hours is None and any(x in lbl_lower for x in ("total hour", "odometer hour", "cumulative hour")):
                        engine_hours = val

                # ── J1939 CAN Bus ─────────────────────────────────────────────
                j1939_hour_meter = _safe_float(v.get("j1939_hmr_value"))
                j1939_coolant_temp = _safe_float(v.get("j1939_ecp_value"))
                j1939_oil_pressure = _safe_float(v.get("j1939_eop_value"))
                # j1939_fl already computed above (with ÷2 correction) for fuel_percentage
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
                    j1939_fuel_level=j1939_fl,
                    j1939_engine_speed=j1939_engine_speed,
                    j1939_fuel_consumption=j1939_fuel_consumption,
                    j1939_mil=j1939_mil,
                    j1939_stop_indicator=j1939_stop_indicator,
                    j1939_battery_potential=j1939_battery_potential,
                    j1939_trans_oil_temp=j1939_trans_oil_temp,
                    j1939_urea_level=j1939_urea_level,
                    j1939_water_in_fuel=j1939_water_in_fuel,
                    raw_fuel=raw_j1939_fl,
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


async def fetch_trakntell_vehicle_data(user_id: Optional[str] = None, bypass_cache: bool = False) -> TrakNTellData:
    """
    Fetch live vehicle data from Trak N Tell using direct API call.
    Much faster and more reliable than Playwright scraping.
    """
    import time
    now = time.time()
    if user_id and not bypass_cache and user_id in _vehicles_cache:
        cached_time, cached_data = _vehicles_cache[user_id]
        if now - cached_time < 5.0:
            return cached_data

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
        app_user_id=user_id,
    )

    original_creds = creds
    if not vehicles:
        # Session may have expired — try auto-refresh if stored credentials exist
        refreshed = await _auto_refresh_session(user_id)
        if refreshed:
            fresh_creds = await _get_user_credentials(user_id)
            if fresh_creds and fresh_creds.get("sessionid"):
                creds = fresh_creds
                vehicles = await fetch_vehicles_via_api(
                    user_id=creds["user_id"],
                    user_id_encrypt=creds["user_id_encrypt"],
                    orgid=creds["orgid"],
                    sessionid=creds["sessionid"],
                    tnt_s=creds.get("tnt_s"),
                    app_user_id=user_id,
                )

    if not vehicles:
        has_stored_creds = bool(
            (creds or original_creds or {}).get("username") and
            (creds or original_creds or {}).get("password")
        )
        if has_stored_creds:
            hint = "Auto-refresh was attempted but failed — check your Trak N Tell credentials in GPS Settings."
        else:
            hint = "Re-extract JSESSIONID from web.trakntell.com (Chrome DevTools → Application → Cookies) and update via GPS Settings, or save your username+password for automatic refresh."
        res = TrakNTellData(
            vehicles=[],
            error=f"No vehicles found. Your Trak N Tell session may have expired — {hint}",
        )
    else:
        res = TrakNTellData(vehicles=vehicles)

    if user_id and not res.error:
        _vehicles_cache[user_id] = (now, res)
    return res


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
    tnt_username: str = "",
    tnt_password: str = "",
) -> bool:
    """Store encrypted Trak N Tell credentials."""
    encrypted_uid = encrypt_token(tnt_user_id)
    encrypted_uid_encrypt = encrypt_token(tnt_user_id_encrypt)
    encrypted_orgid = encrypt_token(tnt_orgid)
    encrypted_sessionid = encrypt_token(tnt_sessionid) if tnt_sessionid else None
    encrypted_tnt_s = encrypt_token(tnt_s) if tnt_s else None
    encrypted_username = encrypt_token(tnt_username) if tnt_username else None
    encrypted_password = encrypt_token(tnt_password) if tnt_password else None

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
                   username_encrypted = COALESCE(?, username_encrypted),
                   password_encrypted = COALESCE(?, password_encrypted),
                   updated_at = datetime('now')
               WHERE user_id = ?""",
            (encrypted_uid, encrypted_uid_encrypt, encrypted_orgid,
             encrypted_sessionid, encrypted_tnt_s,
             encrypted_username, encrypted_password,
             user_id),
        )
    else:
        await db.execute(
            """INSERT INTO trakntell_credentials
               (id, user_id, tenant_id, user_id_encrypted, user_id_encrypt_encrypted,
                orgid_encrypted, sessionid_encrypted, tnt_s_encrypted,
                username_encrypted, password_encrypted)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (str(uuid.uuid4()), user_id, tenant_id,
             encrypted_uid, encrypted_uid_encrypt, encrypted_orgid,
             encrypted_sessionid, encrypted_tnt_s,
             encrypted_username, encrypted_password),
        )
    await db.commit()
    clear_credentials_cache(user_id)
    return True


async def get_credentials_status(user_id: str) -> Optional[dict]:
    """Get credential status."""
    try:
        db = await get_db()
        cursor = await db.execute(
            "SELECT user_id_encrypted, sessionid_encrypted, updated_at, username_encrypted FROM trakntell_credentials WHERE user_id = ?",
            (user_id,),
        )
        row = await cursor.fetchone()
    except Exception:
        return None

    if row:
        try:
            decrypted_uid = decrypt_token(row[0])
            preview = decrypted_uid[:4] + "..." + decrypted_uid[-4:] if len(decrypted_uid) > 8 else "(hidden)"
            return {
                "configured": True,
                "user_id_preview": preview,
                "has_sessionid": row[1] is not None,
                "updated_at": row[2],
                "auto_refresh_enabled": bool(len(row) > 3 and row[3]),
            }
        except Exception:
            return {
                "configured": True,
                "decryption_failed": True,
                "user_id_preview": "(decryption failed)",
                "has_sessionid": False,
                "updated_at": row[2],
                "auto_refresh_enabled": False,
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
