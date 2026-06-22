"""
Offline test for the WheelsEye telemetry parser.

Replays two real WheelsEye API response bodies captured from a live browser session
(a HAR export) through the join + mapping logic and asserts the 3 fleet vehicles are
parsed correctly. No network or credentials required — the captured token/JSESSIONID
are expired, so this validates the *parsing contract* only.

Run:  python3 suprwise/wheelseye/test_wheelseye_parse.py
"""
import json
import os
import sys

# Allow running as a standalone script from the repo root.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from suprwise.wheelseye.service import _vehicles_from_responses  # noqa: E402

_DATA_DIR = os.path.join(os.path.dirname(__file__), "testdata")


def _load(name):
    with open(os.path.join(_DATA_DIR, name)) as f:
        return json.load(f)


def main():
    static_json = _load("vehicles_static.json")
    dynamic_json = _load("vehicles_dynamic.json")

    vehicles = _vehicles_from_responses(static_json, dynamic_json)
    by_reg = {v.registration_number: v for v in vehicles}

    passed = 0

    def check(name, cond):
        nonlocal passed
        status = "PASS" if cond else "FAIL"
        print(f"  [{status}] {name}")
        assert cond, name
        passed += 1

    print("WheelsEye parser test (against captured HAR fixtures):")

    check("3 vehicles parsed", len(vehicles) == 3)
    check(
        "registration numbers match the captured fleet",
        set(by_reg) == {"OD02DQ4078", "OD02DL4206", "OR02AT0114"},
    )

    # OD02DL4206 had ignitionState "On" in the capture; the other two "Off".
    check("OD02DL4206 engine_on=True", by_reg["OD02DL4206"].engine_on is True)
    check("OD02DL4206 ignition_status='on'", by_reg["OD02DL4206"].ignition_status == "on")
    check("OD02DQ4078 engine_on=False", by_reg["OD02DQ4078"].engine_on is False)
    check("OR02AT0114 engine_on=False", by_reg["OR02AT0114"].engine_on is False)

    # All three were mode=STOPPAGE → status "stopped".
    check("all vehicles status='stopped'", all(v.status == "stopped" for v in vehicles))

    # Telemetry fields must be populated for every vehicle.
    check("all have non-zero coordinates", all(v.latitude != 0 and v.longitude != 0 for v in vehicles))
    check("all have an address", all(v.address for v in vehicles))
    check("all report GSM signal", all(v.signal and v.signal != "unknown" for v in vehicles))
    check("all have a last_updated timestamp", all(v.last_updated for v in vehicles))

    # Spot-check exact coordinate join (OD02DL4206 → vehicleId 4202848).
    v = by_reg["OD02DL4206"]
    check("OD02DL4206 latitude joined correctly", abs(v.latitude - 20.316288888888888) < 1e-6)

    print(f"\nAll {passed} assertions passed. Parsed vehicles:")
    for v in vehicles:
        print(
            f"  {v.registration_number}: status={v.status} engine_on={v.engine_on} "
            f"speed={v.speed} gsm={v.signal} @ ({v.latitude:.5f},{v.longitude:.5f})"
        )


if __name__ == "__main__":
    main()
