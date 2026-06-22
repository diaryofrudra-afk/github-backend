from pydantic import BaseModel
from typing import Optional, Any, Dict


class SLINotificationResp(BaseModel):
    level: str  # "warning" or "critical"
    message: str
    action: str


class SLIReading(BaseModel):
    """Safe Load Indicator reading with safety assessment"""
    boom_length_m: float
    boom_angle_deg: float
    load_ton: float
    radius_m: float
    max_safe_load_ton: float
    safety_level: str  # "safe", "warning", "critical"
    utilization_percent: float
    notification: Optional[SLINotificationResp] = None
    coolant_temp_c: Optional[float] = None
    battery_voltage_v: Optional[float] = None
    urea_level_pct: Optional[float] = None
    oil_pressure: Optional[float] = None
    engine_rpm: Optional[float] = None


class DiagnosticsUpsert(BaseModel):
    id: Optional[str] = None
    health: str = "offline"
    snapshot: Optional[Any] = None
    updated_at: Optional[str] = None
    # SLI-specific fields
    sli_boom_length: Optional[float] = None
    sli_boom_angle: Optional[float] = None
    sli_load: Optional[float] = None
    sli_coolant_temp_c: Optional[float] = None
    sli_battery_voltage_v: Optional[float] = None
    sli_urea_level_pct: Optional[float] = None
    sli_oil_pressure: Optional[float] = None
    sli_engine_rpm: Optional[float] = None
