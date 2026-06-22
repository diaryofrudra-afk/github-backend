import json
import uuid
from fastapi import APIRouter, Depends
from ..database import get_db
from ..auth.dependencies import get_current_user
from .models import DiagnosticsUpsert, SLIReading
from .sli_safety import EscortsF23SLISafety

router = APIRouter(prefix="/api/diagnostics", tags=["diagnostics"])


@router.get("")
async def get_diagnostics(user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM diagnostics WHERE tenant_id = ?", (user["tenant_id"],)
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.post("/sli-evaluate", response_model=SLIReading)
async def evaluate_sli(
    boom_length: float,
    boom_angle: float,
    load_ton: float,
    coolant_temp_c: float = None,
    battery_voltage_v: float = None,
    urea_level_pct: float = None,
    oil_pressure: float = None,
    fuel_rate_lph: float = None,
    trans_oil_temp_c: float = None,
    hour_meter_h: float = None,
    engine_rpm: float = None,
):
    """
    Evaluate SLI (Safe Load Indicator) reading for Escorts F23 crane
    
    Parameters:
    - boom_length: Boom length in meters (0-16.6)
    - boom_angle: Boom angle in degrees (0-87)
    - load_ton: Current load in tonnes
    - coolant_temp_c: Coolant temperature (optional)
    - battery_voltage_v: Battery voltage (optional)
    - urea_level_pct: Urea level % (optional)
    - oil_pressure: Oil pressure psi (optional)
    - engine_rpm: Engine RPM (optional)
    
    Returns:
    - SLI reading with safety level (safe/warning/critical)
    - Utilization percentage
    - Safety notification if applicable
    """
    result = EscortsF23SLISafety.evaluate_sli_reading(
        boom_length_m=boom_length,
        boom_angle_deg=boom_angle,
        load_ton=load_ton,
        coolant_temp_c=coolant_temp_c,
        battery_voltage_v=battery_voltage_v,
        urea_level_pct=urea_level_pct,
        oil_pressure=oil_pressure,
        fuel_rate_lph=fuel_rate_lph,
        trans_oil_temp_c=trans_oil_temp_c,
        hour_meter_h=hour_meter_h,
        engine_rpm=engine_rpm,
    )
    
    # Convert notification dict to SLINotificationResp if present
    if result.get("notification"):
        result["notification"] = dict(result["notification"])
    
    return SLIReading(**result)


@router.put("/{crane_reg}")
async def upsert_diagnostics(
    crane_reg: str,
    body: DiagnosticsUpsert,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    # If SLI fields are provided, calculate and store as snapshot
    if any([
        body.sli_boom_length is not None,
        body.sli_boom_angle is not None,
        body.sli_load is not None,
    ]):
        sli_reading = EscortsF23SLISafety.evaluate_sli_reading(
            boom_length_m=body.sli_boom_length or 0,
            boom_angle_deg=body.sli_boom_angle or 0,
            load_ton=body.sli_load or 0,
            coolant_temp_c=body.sli_coolant_temp_c,
            battery_voltage_v=body.sli_battery_voltage_v,
            urea_level_pct=body.sli_urea_level_pct,
            oil_pressure=body.sli_oil_pressure,
            engine_rpm=body.sli_engine_rpm,
        )
        
        # Store as snapshot
        snapshot_data = {
            "sli_reading": sli_reading,
            "sli_updated_at": body.updated_at or None,
        }
        if body.snapshot:
            if isinstance(body.snapshot, dict):
                snapshot_data.update(body.snapshot)
        snapshot = snapshot_data
    else:
        snapshot = body.snapshot
    
    if snapshot is None:
        snapshot_str = "{}"
    elif isinstance(snapshot, (dict, list)):
        snapshot_str = json.dumps(snapshot)
    else:
        snapshot_str = str(snapshot)

    updated_at = body.updated_at or "datetime('now')"

    cursor = await db.execute(
        "SELECT id FROM diagnostics WHERE crane_reg = ? AND tenant_id = ?",
        (crane_reg, user["tenant_id"]),
    )
    existing = await cursor.fetchone()

    if existing:
        await db.execute(
            """UPDATE diagnostics
               SET health = ?, snapshot = ?, updated_at = COALESCE(?, datetime('now'))
               WHERE crane_reg = ? AND tenant_id = ?""",
            (body.health, snapshot_str, body.updated_at, crane_reg, user["tenant_id"]),
        )
    else:
        record_id = body.id or str(uuid.uuid4())
        await db.execute(
            """INSERT INTO diagnostics (id, crane_reg, health, snapshot, updated_at, tenant_id)
               VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')), ?)""",
            (record_id, crane_reg, body.health, snapshot_str, body.updated_at, user["tenant_id"]),
        )

    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM diagnostics WHERE crane_reg = ? AND tenant_id = ?",
        (crane_reg, user["tenant_id"]),
    )
    row = await cursor.fetchone()
    return dict(row)
