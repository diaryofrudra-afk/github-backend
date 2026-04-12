from pydantic import BaseModel
from typing import Optional, Any


class DiagnosticsUpsert(BaseModel):
    id: Optional[str] = None
    health: str = "offline"
    snapshot: Optional[Any] = None
    updated_at: Optional[str] = None
