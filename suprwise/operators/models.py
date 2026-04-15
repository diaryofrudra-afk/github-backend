from pydantic import BaseModel
from typing import Optional


class OperatorCreate(BaseModel):
    id: Optional[str] = None
    name: str
    phone: str
    license: str = ""
    aadhaar: str = ""
    assigned: str = ""
    status: str = "active"


class OperatorUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    license: Optional[str] = None
    aadhaar: Optional[str] = None
    assigned: Optional[str] = None
    status: Optional[str] = None


class OperatorProfileUpdate(BaseModel):
    photo: Optional[str] = None
    bank: Optional[str] = None
    ifsc: Optional[str] = None
    account: Optional[str] = None
    address: Optional[str] = None
