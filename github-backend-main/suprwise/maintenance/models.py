from pydantic import BaseModel
from typing import Optional


class MaintenanceCreate(BaseModel):
    id: Optional[str] = None
    crane_reg: str
    date: str
    type: str = ""
    cost: float = 0
    notes: str = ""


class MaintenanceUpdate(BaseModel):
    crane_reg: Optional[str] = None
    date: Optional[str] = None
    type: Optional[str] = None
    cost: Optional[float] = None
    notes: Optional[str] = None
