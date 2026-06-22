import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from ..database import get_db
from ..auth.dependencies import get_current_user
from .models import FuelLogCreate, FuelLogUpdate

router = APIRouter(prefix="/api/fuel-logs", tags=["fuel"])


@router.get("")
async def get_fuel_logs(
    crane_reg: Optional[str] = Query(default=None),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    if crane_reg:
        cursor = await db.execute(
            "SELECT * FROM fuel_logs WHERE tenant_id = ? AND crane_reg = ?",
            (user["tenant_id"], crane_reg),
        )
        rows = await cursor.fetchall()
    else:
        cursor = await db.execute(
            "SELECT * FROM fuel_logs WHERE tenant_id = ?", (user["tenant_id"],)
        )
        rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.post("")
async def create_fuel_log(body: FuelLogCreate, user=Depends(get_current_user), db=Depends(get_db)):
    log_id = body.id or str(uuid.uuid4())
    await db.execute(
        """INSERT INTO fuel_logs (id, crane_reg, date, litres, cost, odometer, type, notes, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            log_id, body.crane_reg, body.date, body.litres, body.cost,
            body.odometer, body.type, body.notes, user["tenant_id"],
        ),
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM fuel_logs WHERE id = ? AND tenant_id = ?", (log_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.put("/{log_id}")
async def update_fuel_log(
    log_id: str,
    body: FuelLogUpdate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM fuel_logs WHERE id = ? AND tenant_id = ?", (log_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Fuel log not found")

    fields = body.model_dump(exclude_none=True)
    if not fields:
        return dict(existing)

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [log_id, user["tenant_id"]]
    await db.execute(
        f"UPDATE fuel_logs SET {set_clause} WHERE id = ? AND tenant_id = ?", values
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM fuel_logs WHERE id = ? AND tenant_id = ?", (log_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.delete("/{log_id}")
async def delete_fuel_log(log_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT id FROM fuel_logs WHERE id = ? AND tenant_id = ?", (log_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Fuel log not found")
    await db.execute(
        "DELETE FROM fuel_logs WHERE id = ? AND tenant_id = ?", (log_id, user["tenant_id"])
    )
    await db.commit()
    return {"ok": True}
