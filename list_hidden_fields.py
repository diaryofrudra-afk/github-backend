import inspect
from suprwise.trakntell.models import TrakNTellVehicle

# Fields displayed in the UI (from my analysis of GPSPageNew.tsx)
UI_FIELDS = {
    "registration_number", "status", "last_updated", "address", "latitude", "longitude",
    "speed", "ignition", "sli_load", "sli_swl", "today_engine_hours", "j1939_hour_meter",
    "sli_angle", "sli_radius", "j1939_fuel_level", "fuel_percentage", "fuel_litres",
    "j1939_coolant_temp", "rpm", "j1939_engine_speed", "j1939_oil_pressure",
    "j1939_urea_level", "j1939_trans_oil_temp"
}

all_fields = TrakNTellVehicle.__fields__.keys()
hidden = [f for f in all_fields if f not in UI_FIELDS]

print("BACKGROUND DATA (Fetched but not shown in Suprwise UI):")
print("-" * 50)
for f in sorted(hidden):
    print(f"- {f}")
