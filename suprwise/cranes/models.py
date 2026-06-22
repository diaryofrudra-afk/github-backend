from pydantic import BaseModel
from typing import Optional


class CraneCreate(BaseModel):
    id: Optional[str] = None
    reg: str
    type: str = ""
    make: str = ""
    model: str = ""
    capacity: str = ""
    year: str = ""
    rate: float = 0
    ot_rate: Optional[float] = None
    daily_limit: Optional[float] = 8
    operator: str = ""
    site: str = ""
    status: str = ""
    notes: str = ""
    emi: float = 0.0
    fixed_expenses: float = 0.0


class CraneUpdate(BaseModel):
    reg: Optional[str] = None
    type: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    capacity: Optional[str] = None
    year: Optional[str] = None
    rate: Optional[float] = None
    ot_rate: Optional[float] = None
    daily_limit: Optional[float] = None
    operator: Optional[str] = None
    site: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    emi: Optional[float] = None
    fixed_expenses: Optional[float] = None
