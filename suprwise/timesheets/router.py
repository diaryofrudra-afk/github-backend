import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from ..database import get_db
from ..auth.dependencies import get_current_user
from .models import TimesheetCreate, TimesheetUpdate

router = APIRouter(prefix="/api/timesheets", tags=["timesheets"])


@router.get("")
async def get_timesheets(
    operator_key: Optional[str] = Query(default=None),
    date: Optional[str] = Query(default=None),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    base = "SELECT * FROM timesheets WHERE tenant_id = ?"
    params: list = [user["tenant_id"]]

    if operator_key:
        base += " AND operator_key = ?"
        params.append(operator_key)
    if date:
        base += " AND date = ?"
        params.append(date)

    cursor = await db.execute(base, params)
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.post("")
async def create_timesheet(body: TimesheetCreate, user=Depends(get_current_user), db=Depends(get_db)):
    sheet_id = body.id or str(uuid.uuid4())
    await db.execute(
        """INSERT INTO timesheets
           (id, crane_reg, operator_key, date, start_time, end_time, hours_decimal, operator_id, notes, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            sheet_id, body.crane_reg, body.operator_key, body.date,
            body.start_time, body.end_time, body.hours_decimal,
            body.operator_id, body.notes, user["tenant_id"],
        ),
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM timesheets WHERE id = ? AND tenant_id = ?", (sheet_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.put("/{sheet_id}")
async def update_timesheet(
    sheet_id: str,
    body: TimesheetUpdate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM timesheets WHERE id = ? AND tenant_id = ?", (sheet_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Timesheet not found")

    fields = body.model_dump(exclude_none=True)
    if not fields:
        return dict(existing)

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [sheet_id, user["tenant_id"]]
    await db.execute(
        f"UPDATE timesheets SET {set_clause} WHERE id = ? AND tenant_id = ?", values
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM timesheets WHERE id = ? AND tenant_id = ?", (sheet_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.delete("/{sheet_id}")
async def delete_timesheet(sheet_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT id FROM timesheets WHERE id = ? AND tenant_id = ?", (sheet_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    await db.execute(
        "DELETE FROM timesheets WHERE id = ? AND tenant_id = ?", (sheet_id, user["tenant_id"])
    )
    await db.commit()
    return {"ok": True}
