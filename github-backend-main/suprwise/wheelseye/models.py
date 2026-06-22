from typing import List, Optional
from pydantic import BaseModel


class WheelsEyeVehicle(BaseModel):
    registration_number: str
    status: str = "unknown"          # stopped | moving | idle | signal_lost | unknown
    latitude: float = 0.0
    longitude: float = 0.0
    speed: float = 0.0
    last_updated: str = ""
    # Engine / ignition status
    engine_on: Optional[bool] = None
    ignition_status: str = "unknown"  # on | off | unknown
    # Signal strength
    signal: str = "unknown"
    # Address
    address: str = ""


class WheelsEyeData(BaseModel):
    vehicles: List[WheelsEyeVehicle] = []
    error: Optional[str] = None


class WheelsEyeStatus(BaseModel):
    configured: bool = False
    phone_preview: str = ""
    vehicle_count: int = 0
    last_error: str = ""
