import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from ..database import get_db
from ..auth.dependencies import get_current_user
from .models import FileCreate

router = APIRouter(prefix="/api/files", tags=["files"])


@router.get("")
async def get_files(
    owner_key: str = Query(...),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM files WHERE tenant_id = ? AND owner_key = ?",
        (user["tenant_id"], owner_key),
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.post("")
async def create_file(
    body: FileCreate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    file_id = body.id or str(uuid.uuid4())
    await db.execute(
        """INSERT INTO files
           (id, owner_key, name, type, data, size, timestamp, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            file_id, body.owner_key, body.name, body.type,
            body.data, body.size, body.timestamp, user["tenant_id"],
        ),
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM files WHERE id = ? AND tenant_id = ?", (file_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.delete("/{file_id}")
async def delete_file(
    file_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT id FROM files WHERE id = ? AND tenant_id = ?", (file_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="File not found")
    await db.execute(
        "DELETE FROM files WHERE id = ? AND tenant_id = ?", (file_id, user["tenant_id"])
    )
    await db.commit()
    return {"ok": True}
