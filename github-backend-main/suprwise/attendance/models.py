from typing import Optional
from pydantic import BaseModel


class AttendanceCreate(BaseModel):
    id: Optional[str] = None
    operator_key: str
    date: str
    status: str = "present"
    marked_by: str = "owner"


class AttendanceUpdate(BaseModel):
    status: Optional[str] = None
    marked_by: Optional[str] = None
