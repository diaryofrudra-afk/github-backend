from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class VehicleRTOResponse(BaseModel):
    """Normalized Indian vehicle / RTO fields for fleet + compliance autofill."""

    reg: str
    make: str = ""
    model: str = ""
    year: str = ""
    vehicle_class: str = Field("", description="Vehicle category / body type from RTO")
    fuel_type: str = ""
    insurance_valid_upto: Optional[str] = None
    insurance_company: str = ""
    fitness_valid_upto: Optional[str] = None
    tax_valid_upto: Optional[str] = None
    pucc_valid_upto: Optional[str] = None
    owner_name: str = ""
    chassis_masked: str = ""
    raw: Dict[str, Any] = Field(default_factory=dict)
