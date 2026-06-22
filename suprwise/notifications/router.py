import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from ..database import get_db
from ..auth.dependencies import get_current_user
from .models import NotificationCreate

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
async def get_notifications(
    user_key: str = Query(...),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM notifications WHERE tenant_id = ? AND user_key = ?",
        (user["tenant_id"], user_key),
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.post("")
async def create_notification(
    body: NotificationCreate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    notif_id = body.id or str(uuid.uuid4())
    await db.execute(
        """INSERT INTO notifications
           (id, user_key, message, type, timestamp, read, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            notif_id, body.user_key, body.message, body.type,
            body.timestamp, body.read, user["tenant_id"],
        ),
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM notifications WHERE id = ? AND tenant_id = ?",
        (notif_id, user["tenant_id"]),
    )
    row = await cursor.fetchone()
    return dict(row)


@router.put("/{notif_id}/read")
async def mark_read(
    notif_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT id FROM notifications WHERE id = ? AND tenant_id = ?",
        (notif_id, user["tenant_id"]),
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Notification not found")
    await db.execute(
        "UPDATE notifications SET read = 1 WHERE id = ? AND tenant_id = ?",
        (notif_id, user["tenant_id"]),
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM notifications WHERE id = ? AND tenant_id = ?",
        (notif_id, user["tenant_id"]),
    )
    row = await cursor.fetchone()
    return dict(row)


@router.delete("/clear")
async def clear_notifications(
    user_key: str = Query(...),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    await db.execute(
        "DELETE FROM notifications WHERE user_key = ? AND tenant_id = ?",
        (user_key, user["tenant_id"]),
    )
    await db.commit()
    return {"ok": True}
