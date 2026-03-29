from typing import List, Optional
from pydantic import BaseModel


class BlackbuckVehicle(BaseModel):
    registration_number: str
    status: str = "unknown"
    latitude: float = 0.0
    longitude: float = 0.0
    speed: float = 0.0
    last_updated: str = ""


class BlackbuckData(BaseModel):
    vehicles: List[BlackbuckVehicle] = []
    error: Optional[str] = None
