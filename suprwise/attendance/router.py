import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from ..database import get_db
from ..auth.dependencies import get_current_user
from .models import AttendanceCreate, AttendanceUpdate

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


@router.get("")
async def get_attendance(
    operator_key: Optional[str] = Query(default=None),
    date: Optional[str] = Query(default=None),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    base = "SELECT * FROM attendance WHERE tenant_id = ?"
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
async def mark_attendance(body: AttendanceCreate, user=Depends(get_current_user), db=Depends(get_db)):
    """
    Mark an operator present for a specific date. 
    If already exists, toggle or update.
    """
    record_id = body.id or str(uuid.uuid4())
    
    # Use UPSERT logic (INSERT ... ON CONFLICT)
    await db.execute(
        """INSERT INTO attendance (id, operator_key, date, status, marked_by, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(operator_key, date, tenant_id) DO UPDATE SET
           status = excluded.status,
           marked_by = excluded.marked_by""",
        (
            record_id, body.operator_key, body.date,
            body.status, body.marked_by, user["tenant_id"],
        ),
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM attendance WHERE operator_key = ? AND date = ? AND tenant_id = ?", 
        (body.operator_key, body.date, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.delete("")
async def unmark_attendance(
    operator_key: str = Query(...),
    date: str = Query(...),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Delete attendance record (unmark)."""
    await db.execute(
        "DELETE FROM attendance WHERE operator_key = ? AND date = ? AND tenant_id = ?",
        (operator_key, date, user["tenant_id"]),
    )
    await db.commit()
    return {"ok": True}
