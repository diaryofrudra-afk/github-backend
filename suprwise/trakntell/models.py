"""
Pydantic models for Trak N Tell GPS integration.
"""
from pydantic import BaseModel, Field
from typing import List, Optional


class TrakNTellCredentials(BaseModel):
    user_id: str           # The 'u' param from iframe URL (e.g. "7008693400")
    user_id_encrypt: str   # The encrypted userId (userIdEncrypt param)
    orgid: str             # The orgid param from iframe URL


class TrakNTellStatus(BaseModel):
    configured: bool = False
    user_id_preview: str = ""
    vehicle_count: int = 0
    last_error: str = ""


class TrakNTellVehicle(BaseModel):
    registration_number: str
    status: str = "unknown"          # moving / stopped / idle
    ignition: str = "unknown"        # on / off / unknown — ENGINE status
    latitude: float = 0.0
    longitude: float = 0.0
    speed: float = 0.0
    last_updated: str = ""
    address: str = ""

    # ── Device identification ────────────────────────────────────
    device_id: str = ""              # vehicleid / device_id from API

    # ── Network / Signal ─────────────────────────────────────────
    gsm_signal: int = 0              # GSM signal strength (0–31)
    network_status: str = "unknown"  # good / fair / weak / lost
    is_gsm_working: bool = True
    is_gps_working: bool = True

    # ── GPS quality ───────────────────────────────────────────────
    heading: Optional[float] = None       # Course/heading in degrees (0–360)
    altitude: Optional[float] = None      # Altitude in metres
    gps_satellites: Optional[int] = None  # Number of satellites locked
    hdop: Optional[float] = None          # Horizontal dilution of precision

    # ── Device health / power ────────────────────────────────────
    main_voltage: float = 0.0
    backup_voltage: float = 0.0
    battery_charge: str = "unknown"
    is_main_power_low: bool = False

    # ── Distance & engine hours ──────────────────────────────────
    odometer: Optional[float] = None           # Total odometer (km)
    today_km: Optional[float] = None           # Distance driven today (km)
    engine_hours: Optional[float] = None       # Total engine hours
    today_engine_hours: Optional[float] = None # Engine hours today
    idle_duration: Optional[str] = None        # Current idle duration string
    stop_duration: Optional[str] = None        # Current stop duration string

    # ── Driver ────────────────────────────────────────────────────
    driver_name: Optional[str] = None
    driver_mobile: Optional[str] = None

    # ── Fuel ─────────────────────────────────────────────────────
    fuel_percentage: Optional[float] = None
    fuel_litres: Optional[float] = None

    # ── Alerts / events ──────────────────────────────────────────
    is_panic: Optional[bool] = None
    is_towing: Optional[bool] = None
    is_overspeeding: Optional[bool] = None
    is_harsh_braking: Optional[bool] = None
    is_harsh_acceleration: Optional[bool] = None
    is_inside_geofence: Optional[bool] = None

    # ── Security ─────────────────────────────────────────────────
    immobilizer: Optional[str] = None     # "armed" / "disarmed"

    # ── Sensors ──────────────────────────────────────────────────
    temperature: Optional[float] = None   # Primary temperature sensor (°C)
    temperature2: Optional[float] = None  # Secondary temperature sensor (°C)
    door_status: Optional[str] = None     # "open" / "closed"
    ac_status: Optional[str] = None       # "on" / "off"
    rpm: Optional[int] = None             # Engine RPM

    # ── SLI Crane Sensors (Analog Inputs ain8–ain14) ─────────────
    sli_duty: Optional[float] = None          # ain8_value — SLI Duty (%)
    sli_angle: Optional[float] = None         # ain9_value — Boom Angle (deg)
    sli_radius: Optional[float] = None        # ain10_value — Boom Radius (m)
    sli_length: Optional[float] = None        # ain11_value — Boom Length (m)
    sli_load: Optional[float] = None          # ain12_value — Actual Load (ton)
    sli_swl: Optional[float] = None           # ain13_value — Safe Working Load (ton)
    sli_overload: Optional[float] = None      # ain14_value — Overload Indicator
    battery_charge_status: Optional[str] = None  # din4_value e.g. "Not Charging"
    sos_button: Optional[str] = None          # din7_value e.g. "Not Pressed"
    ain_sensors: List[dict] = Field(default_factory=list)  # [{label, value, units}] all configured ain

    # ── J1939 CAN Bus ─────────────────────────────────────────────
    j1939_hour_meter: Optional[float] = None       # j1939_hmr_value (hours)
    j1939_coolant_temp: Optional[float] = None     # j1939_ecp_value (°C)
    j1939_oil_pressure: Optional[float] = None     # j1939_eop_value
    j1939_fuel_level: Optional[float] = None       # j1939_fl_value
    j1939_engine_speed: Optional[int] = None       # j1939_rpm_value (RPM)
    j1939_fuel_consumption: Optional[float] = None # j1939_rtfc_value
    j1939_mil: Optional[bool] = None               # j1939_mil_value — Malfunction Indicator Lamp
    j1939_stop_indicator: Optional[bool] = None    # j1939_si_value
    j1939_battery_potential: Optional[float] = None # j1939_sbp_value (V)
    j1939_trans_oil_temp: Optional[float] = None   # j1939_tot_value (°C)
    j1939_urea_level: Optional[float] = None       # j1939_ul_value (%)
    j1939_water_in_fuel: Optional[bool] = None     # j1939_wif_value

    # ── Ignition / Parking state strings ─────────────────────────
    ignition_on_since: Optional[str] = None   # e.g. "4h 56m"
    ignition_off_since: Optional[str] = None  # e.g. "4h 5m"
    parked_since: Optional[str] = None        # e.g. "11:03am"
    trip_distance: Optional[float] = None     # km since trip start
    trip_avg_speed: Optional[float] = None    # km/h average for trip


class TrakNTellData(BaseModel):
    vehicles: List[TrakNTellVehicle] = []
    error: Optional[str] = None
    iframe_url: Optional[str] = None
