"""
Blackbuck GPS telemetry integration — pure HTTP API.
No Playwright, no browser dependencies – uses persistent httpx client.
Per-user credentials, encrypted at rest.
Mock data fallback when no credentials are provided.
"""
from __future__ import annotations

import json
import asyncio
import httpx
from datetime import datetime
from typing import List, Optional, Dict
from pathlib import Path

from ..config import settings
from ..database import get_db
from .models import BlackbuckData, BlackbuckVehicle, TripHistoryResponse, TripPoint
from .crypto import decrypt_token

_credentials_cache: Dict[str, dict] = {}


async def _get_user_credentials(user_id: str) -> Optional[dict]:
    """Resolve credentials: cache → DB per-user only. NO shared fallback."""
    if user_id in _credentials_cache:
        return _credentials_cache[user_id]
    try:
        db = await get_db()
        cursor = await db.execute(
            "SELECT auth_token_encrypted, fleet_owner_id FROM blackbuck_credentials WHERE user_id = ?",
            (user_id,),
        )
        row = await cursor.fetchone()
        if row:
            token = decrypt_token(row[0])
            creds = {"auth_token": token, "fleet_owner_id": row[1]}
            _credentials_cache[user_id] = creds
            return creds
    except Exception:
        pass

    # No per-user credentials — return None (do NOT fall back to shared .env)
    return None


def clear_credentials_cache(user_id: Optional[str] = None):
    if user_id:
        _credentials_cache.pop(user_id, None)
    else:
        _credentials_cache.clear()


def _build_headers(token: str) -> dict:
    """Build headers with auth token for Blackbuck API."""
    return {
        "Accept": "application/json, text/plain, */*",
        "Authorization": f"Bearer {token}",
        "Origin": "https://boss.blackbuck.com",
        "Referer": "https://boss.blackbuck.com/gps",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    }


def _map_vehicle(raw: dict) -> BlackbuckVehicle:
    status_raw = raw.get("status", "UNKNOWN").upper()
    status = {
        "STOPPED": "stopped", "MOVING": "moving",
        "SIGNAL_LOST": "signal_lost", "WIRE_DISCONNECTED": "wire_disconnected",
    }.get(status_raw, "unknown")

    ts = raw.get("last_updated_on")
    if ts:
        try:
            last_updated = datetime.fromtimestamp(ts / 1000).strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            last_updated = raw.get("last_updated_on_format", "")
    else:
        last_updated = raw.get("last_updated_on_format", "")

    ign = raw.get("ignition_status", "").upper()
    engine_on = True if ign == "ON" else (False if ign == "OFF" else None)

    return BlackbuckVehicle(
        registration_number=raw.get("truck_no", ""),
        status=status,
        latitude=float(raw.get("latitude", 0.0) or 0.0),
        longitude=float(raw.get("longitude", 0.0) or 0.0),
        speed=float(raw.get("current_speed", 0.0) or 0.0),
        last_updated=last_updated,
        engine_on=engine_on,
        ignition_status=raw.get("ignition_status", "unknown"),
        ignition_lock=raw.get("ignition_lock_status"),
        signal=raw.get("signal", "unknown").replace("_", " ").title(),
        address=raw.get("address", ""),
    )


def _mock_blackbuck_data() -> BlackbuckData:
    """No credentials configured — return error prompting user to sign in."""
    return BlackbuckData(
        error="No Blackbuck credentials configured. Please sign in with your GPS account in GPS Settings to view live tracking data."
    )


async def fetch_blackbuck_telemetry(user_id: Optional[str] = None) -> BlackbuckData:
    """
    Fetch live GPS data from Blackbuck.
    Uses per-user credentials only — no shared .env fallback.
    Falls back to mock data if no credentials configured.
    """
    creds = None
    if user_id:
        creds = await _get_user_credentials(user_id)
    # No per-user credentials — return mock data for dev
    if not creds or not creds.get("auth_token"):
        return _mock_blackbuck_data()

    token = creds["auth_token"]
    fleet_id = creds["fleet_owner_id"]
    url = f"https://api-fms.blackbuck.com/fmsiot/api/v2/gps/tracking/details?fleet_owner_id={fleet_id}&status=All&truck_no=&map_view=true"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=_build_headers(token))
            
            if resp.status_code == 401:
                return BlackbuckData(error="Blackbuck token expired. Please update it in GPS Settings.")
            
            if resp.status_code != 200:
                return BlackbuckData(error=f"Blackbuck API error: {resp.status_code}")

            data = resp.json()
            raw_list = data.get("list", data.get("data", []))
            
            if not raw_list:
                return BlackbuckData(error="No vehicles found in Blackbuck account.")

            vehicles = [_map_vehicle(v) for v in raw_list if v.get("truck_no")]
            return BlackbuckData(vehicles=vehicles)

    except httpx.TimeoutException:
        return BlackbuckData(error="Connection to Blackbuck timed out.")
    except Exception as e:
        return BlackbuckData(error=f"GPS fetch failed: {str(e)}")


async def fetch_blackbuck_trip_history(user_id: str, truck_no: str, from_time: int, to_time: int) -> TripHistoryResponse:
    """
    Fetch historical trip GPS points for a single Blackbuck vehicle.
    Uses the /api/portal/getTimeline endpoint with correct parameter names.
    """
    creds = await _get_user_credentials(user_id)
    if not creds or not creds.get("auth_token"):
        return TripHistoryResponse(
            provider="blackbuck",
            vehicle=truck_no,
            error="No Blackbuck credentials configured."
        )

    token = creds["auth_token"]
    url = f"https://api-fms.blackbuck.com/fmsiot/api/portal/getTimeline?truck_number={truck_no}&from_timestamp={from_time}&to_timestamp={to_time}"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=_build_headers(token))
            
            if resp.status_code == 401:
                return TripHistoryResponse(provider="blackbuck", vehicle=truck_no, error="Blackbuck token expired. Please update your GPS credentials in Settings.")
            
            if resp.status_code == 403:
                return TripHistoryResponse(
                    provider="blackbuck", 
                    vehicle=truck_no, 
                    error="Trip History API not enabled. Contact Blackbuck Support (+91 8046481828) and request: 'Enable /api/portal/getTimeline access for fleet ID 5599426 to use trip history and playback features.'"
                )
            
            if resp.status_code != 200:
                error_msg = f"Blackbuck API error: {resp.status_code}"
                try:
                    err_data = resp.json()
                    if "error" in err_data and "message" in err_data["error"]:
                        error_msg = err_data["error"]["message"]
                except:
                    pass
                return TripHistoryResponse(provider="blackbuck", vehicle=truck_no, error=error_msg)

            data = resp.json()
            raw_list = data.get("list", data.get("data", []))
            
            points = []
            for item in raw_list:
                try:
                    lat = float(item.get("latitude", 0.0) or 0.0)
                    lng = float(item.get("longitude", 0.0) or 0.0)
                    if lat == 0.0 and lng == 0.0:
                        continue
                        
                    speed = float(item.get("current_speed", 0.0) or 0.0)
                    
                    ts = item.get("last_updated_on")
                    if ts:
                        try:
                            timestamp = datetime.fromtimestamp(ts / 1000).strftime("%Y-%m-%d %H:%M:%S")
                        except Exception:
                            timestamp = item.get("last_updated_on_format", "")
                    else:
                        timestamp = item.get("last_updated_on_format", "")
                        
                    address = item.get("address", "")
                    
                    points.append(TripPoint(lat=lat, lng=lng, speed=speed, timestamp=timestamp, address=address))
                except Exception:
                    pass

            return TripHistoryResponse(
                points=points,
                total=len(points),
                provider="blackbuck",
                vehicle=truck_no
            )

    except httpx.TimeoutException:
        return TripHistoryResponse(provider="blackbuck", vehicle=truck_no, error="Connection timed out.")
    except Exception as e:
        return TripHistoryResponse(provider="blackbuck", vehicle=truck_no, error=f"History fetch failed: {str(e)}")


async def fetch_trip_history(
    user_id: str,
    provider: str,
    vehicle_id: str,
    from_time: int = 0,
    to_time: int = 0,
    from_date: str = "",
    to_date: str = "",
) -> TripHistoryResponse:
    """
    Unified wrapper for fetching trip history from any GPS provider.
    Routes to the appropriate provider-specific function.
    """
    if provider.lower() == "blackbuck":
        return await fetch_blackbuck_trip_history(
            user_id=user_id,
            truck_no=vehicle_id,
            from_time=from_time,
            to_time=to_time,
        )
    elif provider.lower() == "trakntell":
        # Placeholder for Trak N Tell trip history
        # This would call a similar function for Trak N Tell when available
        return TripHistoryResponse(
            provider="trakntell",
            vehicle=vehicle_id,
            error="Trak N Tell trip history endpoint not yet implemented via unified wrapper.",
        )
    else:
        return TripHistoryResponse(
            provider=provider,
            vehicle=vehicle_id,
            error=f"Unknown GPS provider: {provider}",
        )
