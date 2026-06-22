from pydantic import BaseModel
from typing import Optional


class TimesheetCreate(BaseModel):
    id: Optional[str] = None
    crane_reg: str = ""
    operator_key: str
    date: str
    start_time: str
    end_time: str
    hours_decimal: float
    operator_id: Optional[str] = None
    notes: str = ""


class TimesheetUpdate(BaseModel):
    crane_reg: Optional[str] = None
    operator_key: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    hours_decimal: Optional[float] = None
    operator_id: Optional[str] = None
    notes: Optional[str] = None
