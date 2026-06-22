import json
import uuid
from fastapi import APIRouter, Depends, HTTPException
from ..database import get_db
from ..auth.dependencies import get_current_user
from .models import DiagnosticsUpsert, SLIReading

router = APIRouter(prefix="/api/diagnostics", tags=["diagnostics"])


@router.get("")
async def get_diagnostics(user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM diagnostics WHERE tenant_id = ?", (user["tenant_id"],)
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.put("/{crane_reg}")
async def upsert_diagnostics(
    crane_reg: str,
    body: DiagnosticsUpsert,
    user=Depends(get_current_user),
    db=Depends(get_db),
):

    # Process SLI data if provided
    snapshot = body.snapshot or {}
    
    # If direct SLI fields are provided, create SLI reading
    if body.sli_boom_length is not None and body.sli_boom_angle is not None and body.sli_load is not None:
        # Import here to avoid circular imports
        from .sli_safety import EscortsF23SLISafety
        safety_calculator = EscortsF23SLISafety()
        
        reading = safety_calculator.evaluate_sli_reading(
            boom_length_m=body.sli_boom_length,
            boom_angle_deg=body.sli_boom_angle,
            load_ton=body.sli_load
        )
        
        # Add SLI reading to snapshot (manual dict construction for compatibility)
        snapshot["sli_reading"] = {
            "boom_length_m": reading.boom_length_m,
            "boom_angle_deg": reading.boom_angle_deg,
            "load_ton": reading.load_ton,
            "radius_m": reading.radius_m,
            "duty_percent": reading.duty_percent,
            "angle_status": reading.angle_status,
            "length_status": reading.length_status,
            "load_status": reading.load_status,
            "safety_level": reading.safety_level,
            "safe_load_limit": reading.safe_load_limit,
            "load_moment": reading.load_moment,
            "safe_load_moment": reading.safe_load_moment,
            "utilization_percent": reading.utilization_percent
        }
        
        # Generate safety notification if needed
        notification = safety_calculator.get_safety_notification(reading)
        if notification:
            snapshot["sli_notification"] = notification
            
        # Update overall health based on SLI safety level
        if body.health == "offline":  # Only override if not explicitly set
            health_mapping = {
                "safe": "online",
                "warning": "warning", 
                "danger": "critical",
                "critical": "critical"
            }
            body.health = health_mapping.get(reading.safety_level.value, "online")

    # Ensure we have a timestamp
    updated_at = body.updated_at or "datetime('now')"

    # Prepare snapshot for storage
    if snapshot is None:
        snapshot_str = "{}"
    elif isinstance(snapshot, (dict, list)):
        snapshot_str = json.dumps(snapshot)
    else:
        snapshot_str = str(snapshot)

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


@router.post("/sli-evaluate")
async def evaluate_sli_reading(
    boom_length: float,
    boom_angle: float,
    load_ton: float,
    user=Depends(get_current_user)
):
    """
    Evaluate an SLI reading and return safety assessment
    """
    from .sli_safety import EscortsF23SLISafety
    safety_calculator = EscortsF23SLISafety()
    
    reading = safety_calculator.evaluate_sli_reading(
        boom_length_m=boom_length,
        boom_angle_deg=boom_angle,
        load_ton=load_ton
    )
    
    notification = safety_calculator.get_safety_notification(reading)
    
    # Manual dict construction for compatibility
    reading_dict = {
        "boom_length_m": reading.boom_length_m,
        "boom_angle_deg": reading.boom_angle_deg,
        "load_ton": reading.load_ton,
        "radius_m": reading.radius_m,
        "duty_percent": reading.duty_percent,
        "angle_status": reading.angle_status,
        "length_status": reading.length_status,
        "load_status": reading.load_status,
        "safety_level": reading.safety_level,
        "safe_load_limit": reading.safe_load_limit,
        "load_moment": reading.load_moment,
        "safe_load_moment": reading.safe_load_moment,
        "utilization_percent": reading.utilization_percent
    }
    
    return {
        "sli_reading": reading_dict,
        "notification": notification
    }
