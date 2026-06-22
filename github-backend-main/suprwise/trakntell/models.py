"""
Pydantic models for Trak N Tell GPS integration.
"""
from pydantic import BaseModel
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
    vehicle_id: str = ""
    status: str = "unknown"          # moving / stopped / idle
    ignition: str = "unknown"        # on / off / unknown — ENGINE status
    latitude: float = 0.0
    longitude: float = 0.0
    speed: float = 0.0
    last_updated: str = ""
    address: str = ""
    # Network / Signal
    gsm_signal: int = 0              # GSM signal strength (0-31)
    network_status: str = "unknown"  # good / weak / lost
    # Device Health
    main_voltage: float = 0.0        # Main battery voltage
    backup_voltage: float = 0.0      # Backup battery voltage
    battery_charge: str = "unknown"  # Battery charge status
    is_main_power_low: bool = False
    is_gsm_working: bool = True
    is_gps_working: bool = True
    
    # ── SLI Crane Sensors ──
    sli_duty: Optional[float] = None
    sli_angle: Optional[float] = None
    sli_radius: Optional[float] = None
    sli_length: Optional[float] = None
    sli_load: Optional[float] = None
    sli_swl: Optional[float] = None
    sli_overload: Optional[float] = None
    battery_charge_status: Optional[str] = None
    sos_button: Optional[str] = None
    
    # ── Analog Input Sensors ──
    ain_sensors: List[dict] = []
    
    # ── J1939 CAN Bus ──
    j1939_hour_meter: Optional[float] = None
    j1939_coolant_temp: Optional[float] = None
    j1939_oil_pressure: Optional[float] = None
    j1939_fuel_level: Optional[float] = None
    j1939_engine_speed: Optional[float] = None
    j1939_fuel_consumption: Optional[float] = None
    j1939_mil: Optional[bool] = None
    j1939_stop_indicator: Optional[bool] = None
    j1939_battery_potential: Optional[float] = None
    j1939_trans_oil_temp: Optional[float] = None
    j1939_urea_level: Optional[float] = None
    j1939_water_in_fuel: Optional[bool] = None
    
    # ── Other Sensors ──
    temperature: Optional[float] = None
    temperature2: Optional[float] = None
    rpm: Optional[float] = None
    fuel_percentage: Optional[float] = None
    fuel_litres: Optional[float] = None
    
    # ── GPS Quality ──
    heading: Optional[float] = None
    altitude: Optional[float] = None
    gps_satellites: Optional[int] = None
    hdop: Optional[float] = None


class TrakNTellData(BaseModel):
    vehicles: List[TrakNTellVehicle] = []
    error: Optional[str] = None
    iframe_url: Optional[str] = None
