import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from ..database import get_db
from ..auth.dependencies import get_current_user
from .models import VehicleDocumentCreate, VehicleDocumentUpdate
from .service import compute_status, add_one_month

router = APIRouter(prefix="/api/vehicle-documents", tags=["vehicle-documents"])


def _with_status(row) -> dict:
    d = dict(row)
    d["status"] = compute_status(d.get("expiry_date"))
    return d


@router.get("")
async def list_documents(
    crane_reg: Optional[str] = Query(default=None),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    if crane_reg:
        cursor = await db.execute(
            "SELECT * FROM vehicle_documents WHERE tenant_id = ? AND crane_reg = ? "
            "ORDER BY doc_type, expiry_date",
            (user["tenant_id"], crane_reg),
        )
    else:
        cursor = await db.execute(
            "SELECT * FROM vehicle_documents WHERE tenant_id = ? ORDER BY crane_reg, doc_type",
            (user["tenant_id"],),
        )
    rows = await cursor.fetchall()
    return [_with_status(row) for row in rows]


@router.post("")
async def create_document(
    body: VehicleDocumentCreate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    doc_id = body.id or str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    await db.execute(
        """INSERT INTO vehicle_documents
           (id, crane_reg, doc_type, title, doc_number, issue_date, expiry_date,
            amount, file_id, notes, created_at, updated_at, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            doc_id, body.crane_reg, body.doc_type, body.title, body.doc_number,
            body.issue_date, body.expiry_date, body.amount, body.file_id, body.notes,
            now, now, user["tenant_id"],
        ),
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM vehicle_documents WHERE id = ? AND tenant_id = ?",
        (doc_id, user["tenant_id"]),
    )
    row = await cursor.fetchone()
    return _with_status(row)


@router.put("/{doc_id}")
async def update_document(
    doc_id: str,
    body: VehicleDocumentUpdate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM vehicle_documents WHERE id = ? AND tenant_id = ?",
        (doc_id, user["tenant_id"]),
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found")

    fields = body.model_dump(exclude_none=True)
    fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [doc_id, user["tenant_id"]]
    await db.execute(
        f"UPDATE vehicle_documents SET {set_clause} WHERE id = ? AND tenant_id = ?",
        values,
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM vehicle_documents WHERE id = ? AND tenant_id = ?",
        (doc_id, user["tenant_id"]),
    )
    row = await cursor.fetchone()
    return _with_status(row)


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT file_id FROM vehicle_documents WHERE id = ? AND tenant_id = ?",
        (doc_id, user["tenant_id"]),
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found")
    # Remove the linked scan blob, if any.
    if existing["file_id"]:
        await db.execute(
            "DELETE FROM files WHERE id = ? AND tenant_id = ?",
            (existing["file_id"], user["tenant_id"]),
        )
    await db.execute(
        "DELETE FROM vehicle_documents WHERE id = ? AND tenant_id = ?",
        (doc_id, user["tenant_id"]),
    )
    await db.commit()
    return {"ok": True}


@router.post("/{doc_id}/emi-paid")
async def mark_emi_paid(
    doc_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Advance an EMI document's next due date (expiry_date) by one calendar month."""
    cursor = await db.execute(
        "SELECT * FROM vehicle_documents WHERE id = ? AND tenant_id = ?",
        (doc_id, user["tenant_id"]),
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found")
    next_due = add_one_month(existing["expiry_date"])
    if next_due is None:
        raise HTTPException(status_code=400, detail="Document has no valid due date to advance")
    now = datetime.now(timezone.utc).isoformat()
    await db.execute(
        "UPDATE vehicle_documents SET expiry_date = ?, last_reminded = NULL, updated_at = ? "
        "WHERE id = ? AND tenant_id = ?",
        (next_due, now, doc_id, user["tenant_id"]),
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM vehicle_documents WHERE id = ? AND tenant_id = ?",
        (doc_id, user["tenant_id"]),
    )
    row = await cursor.fetchone()
    return _with_status(row)
