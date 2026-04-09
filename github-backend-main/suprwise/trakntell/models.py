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


class TrakNTellData(BaseModel):
    vehicles: List[TrakNTellVehicle] = []
    error: Optional[str] = None
    iframe_url: Optional[str] = None
