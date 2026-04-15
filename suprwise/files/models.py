from pydantic import BaseModel
from typing import Optional


class FileCreate(BaseModel):
    id: Optional[str] = None
    owner_key: str
    name: str
    type: str = ""
    data: str = ""
    size: str = ""
    timestamp: str = ""
