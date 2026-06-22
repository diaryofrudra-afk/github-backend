from pydantic import BaseModel
from typing import Optional


class NotificationCreate(BaseModel):
    id: Optional[str] = None
    user_key: str
    message: str
    type: str = "info"
    timestamp: str
    read: int = 0
