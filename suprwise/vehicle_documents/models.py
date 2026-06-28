from pydantic import BaseModel
from typing import Optional


class VehicleDocumentCreate(BaseModel):
    id: Optional[str] = None
    crane_reg: str
    doc_type: str = "other"          # rc | insurance | fitness | pollution | permit | road_tax | emi | other
    title: str = ""
    doc_number: str = ""
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None  # for emi: next due date
    amount: Optional[float] = None     # for emi/road_tax: installment / fee
    file_id: Optional[str] = None      # FK to files.id (uploaded scan)
    notes: str = ""


class VehicleDocumentUpdate(BaseModel):
    crane_reg: Optional[str] = None
    doc_type: Optional[str] = None
    title: Optional[str] = None
    doc_number: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    amount: Optional[float] = None
    file_id: Optional[str] = None
    notes: Optional[str] = None
