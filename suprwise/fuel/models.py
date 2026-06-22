from pydantic import BaseModel
from typing import Optional


class FuelLogCreate(BaseModel):
    id: Optional[str] = None
    crane_reg: str
    date: str
    litres: float
    cost: float = 0
    odometer: Optional[float] = None
    type: str = "Diesel"
    notes: str = ""


class FuelLogUpdate(BaseModel):
    crane_reg: Optional[str] = None
    date: Optional[str] = None
    litres: Optional[float] = None
    cost: Optional[float] = None
    odometer: Optional[float] = None
    type: Optional[str] = None
    notes: Optional[str] = None
