from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, Literal
from datetime import datetime


class SLIReading(BaseModel):
    """SLI (Safe Load Indicator) reading from crane"""
    boom_length_m: float = Field(..., description="Boom length in meters")
    boom_angle_deg: float = Field(..., description="Boom angle from horizontal in degrees")
    load_ton: float = Field(..., description="Load weight in tonnes")
    radius_m: float = Field(..., description="Horizontal radius in meters")
    duty_percent: Optional[float] = Field(None, description="Duty cycle percentage")
    angle_status: str = Field(..., description="Boom angle status")
    length_status: str = Field(..., description="Boom extension status")
    load_status: str = Field(..., description="Load level status")
    safety_level: Literal["safe", "warning", "danger", "critical"] = Field(..., description="Overall safety level")
    safe_load_limit: float = Field(..., description="Maximum safe load for current configuration (tonnes)")
    load_moment: float = Field(..., description="Actual load moment (tonne-meters)")
    safe_load_moment: float = Field(..., description="Maximum safe load moment (tonne-meters)")
    utilization_percent: float = Field(..., description="Utilization percentage of safe capacity")


class DiagnosticsUpsert(BaseModel):
    id: Optional[str] = None
    health: str = Field(default="offline", description="Overall equipment health status")
    snapshot: Optional[Dict[str, Any]] = Field(None, description="Detailed diagnostic data including SLI readings")
    updated_at: Optional[str] = Field(None, description="Timestamp of last update")
    
    # Optional direct SLI fields for simplified updates
    sli_boom_length: Optional[float] = Field(None, description="Boom length in meters")
    sli_boom_angle: Optional[float] = Field(None, description="Boom angle in degrees")
    sli_load: Optional[float] = Field(None, description="Load in tonnes")
