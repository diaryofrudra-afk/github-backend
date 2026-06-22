import uuid
from fastapi import APIRouter, Depends, HTTPException
from ..database import get_db
from ..auth.dependencies import get_current_user
from .models import CameraCreate, CameraUpdate

router = APIRouter(prefix="/api/cameras", tags=["cameras"])


@router.get("")
async def get_cameras(user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM cameras WHERE tenant_id = ?", (user["tenant_id"],)
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.post("")
async def create_camera(body: CameraCreate, user=Depends(get_current_user), db=Depends(get_db)):
    camera_id = body.id or str(uuid.uuid4())
    await db.execute(
        """INSERT INTO cameras (id, reg, label, url, type, notes, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (camera_id, body.reg, body.label, body.url, body.type, body.notes, user["tenant_id"]),
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM cameras WHERE id = ? AND tenant_id = ?", (camera_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.put("/{camera_id}")
async def update_camera(
    camera_id: str,
    body: CameraUpdate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM cameras WHERE id = ? AND tenant_id = ?", (camera_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Camera not found")

    fields = body.model_dump(exclude_none=True)
    if not fields:
        return dict(existing)

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [camera_id, user["tenant_id"]]
    await db.execute(
        f"UPDATE cameras SET {set_clause} WHERE id = ? AND tenant_id = ?", values
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM cameras WHERE id = ? AND tenant_id = ?", (camera_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.delete("/{camera_id}")
async def delete_camera(camera_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT id FROM cameras WHERE id = ? AND tenant_id = ?", (camera_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Camera not found")
    await db.execute(
        "DELETE FROM cameras WHERE id = ? AND tenant_id = ?", (camera_id, user["tenant_id"])
    )
    await db.commit()
    return {"ok": True}
