from pydantic import BaseModel
from typing import Optional, List, Any


# ── Invoices ────────────────────────────────────────────────────────────────

class InvoiceCreate(BaseModel):
    id: Optional[str] = None
    number: str
    date: str
    due_date: Optional[str] = None
    client_id: str
    asset_reg: str = ""
    items: Optional[List[Any]] = None
    subtotal: float = 0
    sgst: float = 0
    cgst: float = 0
    total: float = 0
    status: str = "draft"
    paid_amount: float = 0
    notes: str = ""


class InvoiceUpdate(BaseModel):
    number: Optional[str] = None
    date: Optional[str] = None
    due_date: Optional[str] = None
    client_id: Optional[str] = None
    asset_reg: Optional[str] = None
    items: Optional[List[Any]] = None
    subtotal: Optional[float] = None
    sgst: Optional[float] = None
    cgst: Optional[float] = None
    total: Optional[float] = None
    status: Optional[str] = None
    paid_amount: Optional[float] = None
    notes: Optional[str] = None


# ── Payments ─────────────────────────────────────────────────────────────────

class PaymentCreate(BaseModel):
    id: Optional[str] = None
    invoice_id: str
    date: str
    amount: float
    method: str = ""
    reference: str = ""


class PaymentUpdate(BaseModel):
    invoice_id: Optional[str] = None
    date: Optional[str] = None
    amount: Optional[float] = None
    method: Optional[str] = None
    reference: Optional[str] = None


# ── Credit Notes ─────────────────────────────────────────────────────────────

class CreditNoteCreate(BaseModel):
    id: Optional[str] = None
    number: str
    date: str
    invoice_id: str
    amount: float
    reason: str = ""


class CreditNoteUpdate(BaseModel):
    number: Optional[str] = None
    date: Optional[str] = None
    invoice_id: Optional[str] = None
    amount: Optional[float] = None
    reason: Optional[str] = None


# ── Quotations ───────────────────────────────────────────────────────────────

class QuotationCreate(BaseModel):
    id: Optional[str] = None
    number: str
    date: str
    valid_until: Optional[str] = None
    client_id: str
    asset_reg: str = ""
    items: Optional[List[Any]] = None
    subtotal: float = 0
    sgst: float = 0
    cgst: float = 0
    total: float = 0
    status: str = "draft"
    notes: str = ""


class QuotationUpdate(BaseModel):
    number: Optional[str] = None
    date: Optional[str] = None
    valid_until: Optional[str] = None
    client_id: Optional[str] = None
    asset_reg: Optional[str] = None
    items: Optional[List[Any]] = None
    subtotal: Optional[float] = None
    sgst: Optional[float] = None
    cgst: Optional[float] = None
    total: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None


# ── Proformas ────────────────────────────────────────────────────────────────

class ProformaCreate(BaseModel):
    id: Optional[str] = None
    number: str
    date: str
    client_id: str
    asset_reg: str = ""
    items: Optional[List[Any]] = None
    subtotal: float = 0
    sgst: float = 0
    cgst: float = 0
    total: float = 0
    status: str = "draft"
    quotation_id: Optional[str] = None
    notes: str = ""


class ProformaUpdate(BaseModel):
    number: Optional[str] = None
    date: Optional[str] = None
    client_id: Optional[str] = None
    asset_reg: Optional[str] = None
    items: Optional[List[Any]] = None
    subtotal: Optional[float] = None
    sgst: Optional[float] = None
    cgst: Optional[float] = None
    total: Optional[float] = None
    status: Optional[str] = None
    quotation_id: Optional[str] = None
    notes: Optional[str] = None


# ── Challans ─────────────────────────────────────────────────────────────────

class ChallanCreate(BaseModel):
    id: Optional[str] = None
    number: str
    date: str
    client_id: str
    asset_reg: str = ""
    site: str = ""
    items: Optional[List[Any]] = None
    status: str = "dispatched"
    notes: str = ""


class ChallanUpdate(BaseModel):
    number: Optional[str] = None
    date: Optional[str] = None
    client_id: Optional[str] = None
    asset_reg: Optional[str] = None
    site: Optional[str] = None
    items: Optional[List[Any]] = None
    status: Optional[str] = None
    notes: Optional[str] = None
