from pydantic import BaseModel
from typing import Optional


class OwnerProfileUpdate(BaseModel):
    name: Optional[str] = None
    role_title: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    company: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    gst: Optional[str] = None
    website: Optional[str] = None
    default_limit: Optional[str] = None
