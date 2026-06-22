from pydantic import BaseModel
from typing import Optional, List, Any, Dict


class AppStateImport(BaseModel):
    cranes: Optional[List[Dict[str, Any]]] = None
    operators: Optional[List[Dict[str, Any]]] = None
    fuelLogs: Optional[Dict[str, List[Dict[str, Any]]]] = None
    timesheets: Optional[Dict[str, List[Dict[str, Any]]]] = None
    files: Optional[Dict[str, List[Dict[str, Any]]]] = None
    cameras: Optional[List[Dict[str, Any]]] = None
    clients: Optional[List[Dict[str, Any]]] = None
    invoices: Optional[List[Dict[str, Any]]] = None
    payments: Optional[List[Dict[str, Any]]] = None
    creditNotes: Optional[List[Dict[str, Any]]] = None
    quotations: Optional[List[Dict[str, Any]]] = None
    proformas: Optional[List[Dict[str, Any]]] = None
    challans: Optional[List[Dict[str, Any]]] = None
    compliance: Optional[Dict[str, Dict[str, Any]]] = None
    maintenance: Optional[Dict[str, List[Dict[str, Any]]]] = None
    notifications: Optional[List[Dict[str, Any]]] = None
    attendance: Optional[List[Dict[str, Any]]] = None
    ownerProfile: Optional[Dict[str, Any]] = None
    operatorProfiles: Optional[Dict[str, Dict[str, Any]]] = None
    advancePayments: Optional[Dict[str, List[Dict[str, Any]]]] = None
