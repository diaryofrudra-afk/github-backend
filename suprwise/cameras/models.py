from pydantic import BaseModel
from typing import Optional


class CameraCreate(BaseModel):
    id: Optional[str] = None
    reg: str = ""
    label: str
    url: str = ""
    type: str = "embed"
    notes: str = ""


class CameraUpdate(BaseModel):
    reg: Optional[str] = None
    label: Optional[str] = None
    url: Optional[str] = None
    type: Optional[str] = None
    notes: Optional[str] = None
