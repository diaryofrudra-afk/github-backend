import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query
from ..database import get_db
from ..auth.dependencies import get_current_user
from .models import ComplianceUpsert

router = APIRouter(prefix="/api/compliance", tags=["compliance"])


@router.get("")
async def get_compliance(
    crane_reg: Optional[str] = Query(default=None),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    if crane_reg:
        cursor = await db.execute(
            "SELECT * FROM compliance WHERE tenant_id = ? AND crane_reg = ?",
            (user["tenant_id"], crane_reg),
        )
        rows = await cursor.fetchall()
    else:
        cursor = await db.execute(
            "SELECT * FROM compliance WHERE tenant_id = ?", (user["tenant_id"],)
        )
        rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.put("/{crane_reg}")
async def upsert_compliance(
    crane_reg: str,
    body: ComplianceUpsert,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT id FROM compliance WHERE crane_reg = ? AND tenant_id = ?",
        (crane_reg, user["tenant_id"]),
    )
    existing = await cursor.fetchone()

    if existing:
        await db.execute(
            """UPDATE compliance
               SET insurance_date = ?, insurance_notes = ?,
                   fitness_date = ?, fitness_notes = ?
               WHERE crane_reg = ? AND tenant_id = ?""",
            (
                body.insurance_date, body.insurance_notes,
                body.fitness_date, body.fitness_notes,
                crane_reg, user["tenant_id"],
            ),
        )
    else:
        record_id = body.id or str(uuid.uuid4())
        await db.execute(
            """INSERT INTO compliance
               (id, crane_reg, insurance_date, insurance_notes,
                fitness_date, fitness_notes, tenant_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                record_id, crane_reg,
                body.insurance_date, body.insurance_notes,
                body.fitness_date, body.fitness_notes,
                user["tenant_id"],
            ),
        )

    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM compliance WHERE crane_reg = ? AND tenant_id = ?",
        (crane_reg, user["tenant_id"]),
    )
    row = await cursor.fetchone()
    return dict(row)
