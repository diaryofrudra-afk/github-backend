from pydantic import BaseModel
from typing import Optional


class TenantUpdate(BaseModel):
    name: Optional[str] = None
