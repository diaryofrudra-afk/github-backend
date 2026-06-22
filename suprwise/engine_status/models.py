from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class EngineStatusRecord(BaseModel):
    id: str
    crane_reg: str
    engine_on: bool
    previous_status: Optional[bool] = None
    changed_at: datetime
    source: str = "gps"
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    speed: Optional[float] = None
    address: Optional[str] = None
    tenant_id: str


class EngineStatusLogRequest(BaseModel):
    crane_reg: str
    engine_on: bool
    source: str = "gps"
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    speed: Optional[float] = None
    address: Optional[str] = None


class EngineStatusChangeEvent(BaseModel):
    crane_reg: str
    previous_status: Optional[bool]
    new_status: bool
    changed_at: datetime
    duration_seconds: Optional[int] = None
