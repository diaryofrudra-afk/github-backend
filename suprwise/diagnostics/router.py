import json
import uuid
from fastapi import APIRouter, Depends
from ..database import get_db
from ..auth.dependencies import get_current_user
from .models import DiagnosticsUpsert

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
    snapshot = body.snapshot
    if snapshot is None:
        snapshot_str = "{}"
    elif isinstance(snapshot, (dict, list)):
        snapshot_str = json.dumps(snapshot)
    else:
        snapshot_str = str(snapshot)

    updated_at = body.updated_at or "datetime('now')"

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
