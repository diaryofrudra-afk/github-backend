from typing import List, Optional
from pydantic import BaseModel


class BlackbuckVehicle(BaseModel):
    registration_number: str
    status: str = "unknown"
    latitude: float = 0.0
    longitude: float = 0.0
    speed: float = 0.0
    last_updated: str = ""
    # Engine / ignition status
    engine_on: Optional[bool] = None
    ignition_status: str = "unknown"
    ignition_lock: Optional[bool] = None
    # Signal strength
    signal: str = "unknown"
    # Address
    address: str = ""


class BlackbuckData(BaseModel):
    vehicles: List[BlackbuckVehicle] = []
    error: Optional[str] = None
