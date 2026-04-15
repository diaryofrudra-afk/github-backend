import uuid
from fastapi import APIRouter, Depends, HTTPException
from ..database import get_db
from ..auth.dependencies import get_current_user
from .models import CraneCreate, CraneUpdate

router = APIRouter(prefix="/api/cranes", tags=["cranes"])


@router.get("")
async def get_cranes(user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM cranes WHERE tenant_id = ?", (user["tenant_id"],)
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.post("")
async def create_crane(body: CraneCreate, user=Depends(get_current_user), db=Depends(get_db)):
    crane_id = body.id or str(uuid.uuid4())
    await db.execute(
        """INSERT INTO cranes
           (id, reg, type, make, model, capacity, year, rate, ot_rate, daily_limit,
            operator, site, status, notes, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            crane_id, body.reg, body.type, body.make, body.model, body.capacity,
            body.year, body.rate, body.ot_rate, body.daily_limit,
            body.operator, body.site, body.status, body.notes, user["tenant_id"],
        ),
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM cranes WHERE id = ? AND tenant_id = ?", (crane_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.put("/{crane_id}")
async def update_crane(
    crane_id: str,
    body: CraneUpdate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM cranes WHERE id = ? AND tenant_id = ?", (crane_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Crane not found")

    fields = body.model_dump(exclude_none=True)
    if not fields:
        return dict(existing)

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [crane_id, user["tenant_id"]]
    await db.execute(
        f"UPDATE cranes SET {set_clause} WHERE id = ? AND tenant_id = ?", values
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM cranes WHERE id = ? AND tenant_id = ?", (crane_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.delete("/{crane_id}")
async def delete_crane(crane_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT id FROM cranes WHERE id = ? AND tenant_id = ?", (crane_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Crane not found")
    await db.execute(
        "DELETE FROM cranes WHERE id = ? AND tenant_id = ?", (crane_id, user["tenant_id"])
    )
    await db.commit()
    return {"ok": True}
