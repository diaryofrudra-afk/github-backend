from pydantic import BaseModel
from typing import Optional


class ClientCreate(BaseModel):
    id: Optional[str] = None
    name: str
    gstin: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    phone: str = ""
    email: str = ""
    contact_person: str = ""


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    contact_person: Optional[str] = None
