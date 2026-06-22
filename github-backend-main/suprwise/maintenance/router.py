import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from ..database import get_db
from ..auth.dependencies import get_current_user
from .models import MaintenanceCreate, MaintenanceUpdate

router = APIRouter(prefix="/api/maintenance", tags=["maintenance"])


@router.get("")
async def get_maintenance(
    crane_reg: Optional[str] = Query(default=None),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    if crane_reg:
        cursor = await db.execute(
            "SELECT * FROM maintenance WHERE tenant_id = ? AND crane_reg = ?",
            (user["tenant_id"], crane_reg),
        )
        rows = await cursor.fetchall()
    else:
        cursor = await db.execute(
            "SELECT * FROM maintenance WHERE tenant_id = ?", (user["tenant_id"],)
        )
        rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.post("")
async def create_maintenance(
    body: MaintenanceCreate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    record_id = body.id or str(uuid.uuid4())
    await db.execute(
        """INSERT INTO maintenance
           (id, crane_reg, date, type, cost, notes, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            record_id, body.crane_reg, body.date, body.type,
            body.cost, body.notes, user["tenant_id"],
        ),
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM maintenance WHERE id = ? AND tenant_id = ?",
        (record_id, user["tenant_id"]),
    )
    row = await cursor.fetchone()
    return dict(row)


@router.put("/{record_id}")
async def update_maintenance(
    record_id: str,
    body: MaintenanceUpdate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM maintenance WHERE id = ? AND tenant_id = ?",
        (record_id, user["tenant_id"]),
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Maintenance record not found")

    fields = body.model_dump(exclude_none=True)
    if not fields:
        return dict(existing)

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [record_id, user["tenant_id"]]
    await db.execute(
        f"UPDATE maintenance SET {set_clause} WHERE id = ? AND tenant_id = ?", values
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM maintenance WHERE id = ? AND tenant_id = ?",
        (record_id, user["tenant_id"]),
    )
    row = await cursor.fetchone()
    return dict(row)


@router.delete("/{record_id}")
async def delete_maintenance(
    record_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT id FROM maintenance WHERE id = ? AND tenant_id = ?",
        (record_id, user["tenant_id"]),
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    await db.execute(
        "DELETE FROM maintenance WHERE id = ? AND tenant_id = ?",
        (record_id, user["tenant_id"]),
    )
    await db.commit()
    return {"ok": True}
