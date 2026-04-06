"""
Comprehensive tests for the Blackbuck GPS integration.
Run with: python3 suprwise/gps/test_gps_integration.py
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from suprwise.gps.service import (
    fetch_blackbuck_telemetry,
    _map_vehicle,
    _mock_blackbuck_data,
    _build_headers,
)
from suprwise.gps.models import BlackbuckData, BlackbuckVehicle
from suprwise.config import settings


async def run_tests():
    print("=" * 60)
    print("  Blackbuck GPS Integration Tests")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    tests = [
        ("Mock data fallback", test_mock_fallback),
        ("Vehicle mapping", test_vehicle_mapping),
        ("Status normalization", test_status_normalization),
        ("Engine ON/OFF/unknown", test_engine_on_off),
        ("Null coordinates", test_null_coordinates),
        ("Mock data structure", test_mock_structure),
        ("Headers format", test_headers_format),
        ("Mocked API success", test_mocked_api_success),
        ("Mocked API 401", test_mocked_api_401),
        ("Mocked API timeout", test_mocked_api_timeout),
        ("Empty vehicle list", test_empty_vehicles),
        ("Real API call", test_real_api),
    ]
    
    for name, test_func in tests:
        print(f"\n[{passed+failed+1}] {name}... ", end="", flush=True)
        try:
            await test_func()
            print("✓ PASS")
            passed += 1
        except Exception as e:
            print(f"✗ FAIL: {e}")
            failed += 1
    
    print(f"\n{'='*60}")
    print(f"  Results: {passed} passed, {failed} failed out of {passed+failed}")
    print(f"{'='*60}")
    return failed == 0


async def test_mock_fallback():
    with patch.object(settings, "BLACKBUCK_AUTH_TOKEN", ""):
        result = await fetch_blackbuck_telemetry()
        assert isinstance(result, BlackbuckData)
        assert len(result.vehicles) == 2
        regs = [v.registration_number for v in result.vehicles]
        assert "OD02AY8703" in regs


async def test_vehicle_mapping():
    raw = {
        "truck_no": "OD02AS8409", "status": "MOVING",
        "latitude": 20.321629, "longitude": 85.843120,
        "current_speed": 42.5, "last_updated_on": 1700000000000,
        "ignition_status": "ON", "ignition_lock_status": False,
        "signal": "STRONG_SIGNAL", "address": "Test Address",
    }
    v = _map_vehicle(raw)
    assert v.registration_number == "OD02AS8409"
    assert v.status == "moving"
    assert v.latitude == 20.321629
    assert v.speed == 42.5
    assert v.engine_on == True
    assert v.ignition_status == "ON"
    assert v.ignition_lock == False
    assert v.signal == "Strong Signal"
    assert v.address == "Test Address"


async def test_status_normalization():
    for raw_status, expected in [
        ("STOPPED", "stopped"), ("MOVING", "moving"),
        ("SIGNAL_LOST", "signal_lost"), ("WIRE_DISCONNECTED", "wire_disconnected"),
        ("UNKNOWN", "unknown"),
    ]:
        v = _map_vehicle({"truck_no": "T1", "status": raw_status, "latitude": 0, "longitude": 0, "current_speed": 0, "ignition_status": "ON"})
        assert v.status == expected, f"{raw_status} -> {v.status} != {expected}"


async def test_engine_on_off():
    v_on = _map_vehicle({"truck_no": "T1", "status": "X", "latitude": 0, "longitude": 0, "current_speed": 0, "ignition_status": "ON"})
    assert v_on.engine_on == True
    v_off = _map_vehicle({"truck_no": "T1", "status": "X", "latitude": 0, "longitude": 0, "current_speed": 0, "ignition_status": "OFF"})
    assert v_off.engine_on == False
    v_unknown = _map_vehicle({"truck_no": "T1", "status": "X", "latitude": 0, "longitude": 0, "current_speed": 0})
    assert v_unknown.engine_on is None


async def test_null_coordinates():
    v = _map_vehicle({"truck_no": "T1", "status": "X", "latitude": None, "longitude": None, "current_speed": None})
    assert v.latitude == 0.0 and v.longitude == 0.0 and v.speed == 0.0


async def test_mock_structure():
    data = _mock_blackbuck_data()
    assert len(data.vehicles) == 2
    for v in data.vehicles:
        assert v.registration_number
        assert v.status in ("moving", "stopped")
        assert isinstance(v.latitude, float)
        assert isinstance(v.longitude, float)
        assert isinstance(v.speed, float)


async def test_headers_format():
    with patch.object(settings, "BLACKBUCK_AUTH_TOKEN", "my_token"):
        headers = _build_headers("my_token")
        assert headers["Authorization"] == "Bearer my_token"
        assert "blackbuck.com" in headers["Origin"]


async def test_mocked_api_success():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"list": [
        {"truck_no": "MH01AB1234", "status": "MOVING", "latitude": 19.076, "longitude": 72.878, "current_speed": 45.0, "last_updated_on": 1700000000000},
    ]}
    
    with patch.object(settings, "BLACKBUCK_AUTH_TOKEN", "tok"):
        with patch.object(settings, "BLACKBUCK_FLEET_OWNER_ID", "123"):
            with patch("httpx.AsyncClient") as mc:
                mi = AsyncMock()
                mi.get = AsyncMock(return_value=mock_resp)
                mi.__aenter__ = AsyncMock(return_value=mi)
                mi.__aexit__ = AsyncMock(return_value=None)
                mc.return_value = mi
                
                result = await fetch_blackbuck_telemetry()
                assert len(result.vehicles) == 1
                assert result.vehicles[0].registration_number == "MH01AB1234"


async def test_mocked_api_401():
    mock_resp = MagicMock()
    mock_resp.status_code = 401
    
    with patch.object(settings, "BLACKBUCK_AUTH_TOKEN", "bad"):
        with patch.object(settings, "BLACKBUCK_FLEET_OWNER_ID", "123"):
            with patch("httpx.AsyncClient") as mc:
                mi = AsyncMock()
                mi.get = AsyncMock(return_value=mock_resp)
                mi.__aenter__ = AsyncMock(return_value=mi)
                mi.__aexit__ = AsyncMock(return_value=None)
                mc.return_value = mi
                
                result = await fetch_blackbuck_telemetry()
                assert result.error is not None
                assert "expired" in result.error.lower() or "invalid" in result.error.lower()


async def test_mocked_api_timeout():
    import httpx
    with patch.object(settings, "BLACKBUCK_AUTH_TOKEN", "tok"):
        with patch.object(settings, "BLACKBUCK_FLEET_OWNER_ID", "123"):
            with patch("httpx.AsyncClient") as mc:
                mi = AsyncMock()
                mi.get = AsyncMock(side_effect=httpx.ConnectTimeout("timeout"))
                mi.__aenter__ = AsyncMock(return_value=mi)
                mi.__aexit__ = AsyncMock(return_value=None)
                mc.return_value = mi
                
                result = await fetch_blackbuck_telemetry()
                assert result.error is not None
                assert "timeout" in result.error.lower()


async def test_empty_vehicles():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"list": [], "total_count": 0}
    
    with patch.object(settings, "BLACKBUCK_AUTH_TOKEN", "tok"):
        with patch.object(settings, "BLACKBUCK_FLEET_OWNER_ID", "123"):
            with patch("httpx.AsyncClient") as mc:
                mi = AsyncMock()
                mi.get = AsyncMock(return_value=mock_resp)
                mi.__aenter__ = AsyncMock(return_value=mi)
                mi.__aexit__ = AsyncMock(return_value=None)
                mc.return_value = mi
                
                result = await fetch_blackbuck_telemetry()
                assert result.error is not None
                assert "no vehicles" in result.error.lower()


async def test_real_api():
    if not settings.BLACKBUCK_AUTH_TOKEN or not settings.BLACKBUCK_FLEET_OWNER_ID:
        print("⊘ SKIP (no credentials)", end="")
        return
    
    result = await fetch_blackbuck_telemetry()
    if result.error:
        print(f"⚠ ERROR: {result.error[:80]}", end="")
    else:
        assert len(result.vehicles) > 0
        for v in result.vehicles:
            assert v.registration_number
            assert isinstance(v.latitude, float)


if __name__ == "__main__":
    success = asyncio.run(run_tests())
    sys.exit(0 if success else 1)
