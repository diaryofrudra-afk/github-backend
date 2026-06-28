from pydantic import BaseModel
from typing import Optional


class ComplianceUpsert(BaseModel):
    id: Optional[str] = None
    insurance_date: Optional[str] = None
    insurance_notes: str = ""
    fitness_date: Optional[str] = None
    fitness_notes: str = ""
