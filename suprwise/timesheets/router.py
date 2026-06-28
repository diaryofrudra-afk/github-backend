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
    
    # Auto-mark attendance
    attendance_id = str(uuid.uuid4())
    await db.execute(
        """INSERT INTO attendance (id, operator_key, date, status, marked_by, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(operator_key, date, tenant_id) DO UPDATE SET
           status = 'present',
           marked_by = 'operator'""",
        (
            attendance_id, body.operator_key, body.date,
            "present", "operator", user["tenant_id"],
        ),
    )

    # Notify the fleet owner that a logbook entry was submitted. Best-effort:
    # a notification failure must never block the timesheet write.
    try:
        await _notify_owner_of_logbook(
            db,
            tenant_id=user["tenant_id"],
            operator_key=body.operator_key,
            crane_reg=body.crane_reg,
            hours=body.hours_decimal,
        )
    except Exception:
        pass

    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM timesheets WHERE id = ? AND tenant_id = ?", (sheet_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


def _fmt_hours(hours) -> str:
    try:
        h = float(hours)
    except (TypeError, ValueError):
        return "0"
    return str(int(h)) if h == int(h) else f"{h:.1f}"


async def _notify_owner_of_logbook(db, *, tenant_id, operator_key, crane_reg, hours):
    """Create an owner-facing notification for a submitted logbook entry.

    Keyed on the tenant owner's user id (same key the GPS/engine notifications
    use), so it shows up in the owner's notification feed. Shares the caller's
    transaction (commit=False) — the create_timesheet commit persists it."""
    cursor = await db.execute(
        "SELECT id FROM users WHERE tenant_id = ? AND role = 'owner' LIMIT 1",
        (tenant_id,),
    )
    owner = await cursor.fetchone()
    if not owner:
        return
    owner_id = owner["id"]

    name = operator_key or "Operator"
    cursor = await db.execute(
        "SELECT name FROM operators WHERE (phone = ? OR id = ?) AND tenant_id = ? LIMIT 1",
        (operator_key, operator_key, tenant_id),
    )
    op_row = await cursor.fetchone()
    if op_row and op_row["name"]:
        name = op_row["name"]

    message = f"📋 {name} logged {_fmt_hours(hours)} hrs on {crane_reg}"

    from ..notifications.service import create_notification as _create_notification
    await _create_notification(db, tenant_id, owner_id, message, type="info", commit=False)


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
        "SELECT * FROM timesheets WHERE id = ? AND tenant_id = ?", (sheet_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Timesheet not found")

    op_key = existing["operator_key"]
    date = existing["date"]
    tenant = user["tenant_id"]

    await db.execute(
        "DELETE FROM timesheets WHERE id = ? AND tenant_id = ?", (sheet_id, tenant)
    )

    # If no other timesheets remain for this operator+date, remove auto-marked attendance
    cursor = await db.execute(
        "SELECT COUNT(*) as cnt FROM timesheets WHERE operator_key = ? AND date = ? AND tenant_id = ?",
        (op_key, date, tenant),
    )
    row = await cursor.fetchone()
    if row["cnt"] == 0:
        # Only remove if it was auto-marked by operator, not manually set by owner
        await db.execute(
            "DELETE FROM attendance WHERE operator_key = ? AND date = ? AND tenant_id = ? AND marked_by = 'operator'",
            (op_key, date, tenant),
        )

    await db.commit()
    return {"ok": True}
