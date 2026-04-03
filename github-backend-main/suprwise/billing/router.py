import json
import uuid
from fastapi import APIRouter, Depends, HTTPException
from ..database import get_db
from ..auth.dependencies import get_current_user
from .models import (
    InvoiceCreate, InvoiceUpdate,
    PaymentCreate, PaymentUpdate,
    CreditNoteCreate, CreditNoteUpdate,
    QuotationCreate, QuotationUpdate,
    ProformaCreate, ProformaUpdate,
    ChallanCreate, ChallanUpdate,
)

router = APIRouter(prefix="/api", tags=["billing"])


# ── Helpers ──────────────────────────────────────────────────────────────────

def _encode_items(items):
    """Convert list to JSON string for storage."""
    if items is None:
        return "[]"
    if isinstance(items, list):
        return json.dumps(items)
    return items


# ── Invoices ─────────────────────────────────────────────────────────────────

@router.get("/invoices")
async def get_invoices(user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM invoices WHERE tenant_id = ?", (user["tenant_id"],)
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.post("/invoices")
async def create_invoice(body: InvoiceCreate, user=Depends(get_current_user), db=Depends(get_db)):
    invoice_id = body.id or str(uuid.uuid4())
    await db.execute(
        """INSERT INTO invoices
           (id, number, date, due_date, client_id, asset_reg, items,
            subtotal, sgst, cgst, total, status, paid_amount, notes, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            invoice_id, body.number, body.date, body.due_date, body.client_id,
            body.asset_reg, _encode_items(body.items),
            body.subtotal, body.sgst, body.cgst, body.total,
            body.status, body.paid_amount, body.notes, user["tenant_id"],
        ),
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM invoices WHERE id = ? AND tenant_id = ?", (invoice_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.put("/invoices/{invoice_id}")
async def update_invoice(
    invoice_id: str,
    body: InvoiceUpdate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM invoices WHERE id = ? AND tenant_id = ?", (invoice_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Invoice not found")

    fields = body.model_dump(exclude_none=True)
    if "items" in fields:
        fields["items"] = _encode_items(fields["items"])
    if not fields:
        return dict(existing)

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [invoice_id, user["tenant_id"]]
    await db.execute(
        f"UPDATE invoices SET {set_clause} WHERE id = ? AND tenant_id = ?", values
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM invoices WHERE id = ? AND tenant_id = ?", (invoice_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT id FROM invoices WHERE id = ? AND tenant_id = ?", (invoice_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Invoice not found")
    await db.execute(
        "DELETE FROM invoices WHERE id = ? AND tenant_id = ?", (invoice_id, user["tenant_id"])
    )
    await db.commit()
    return {"ok": True}


# ── Payments ─────────────────────────────────────────────────────────────────

@router.get("/payments")
async def get_payments(user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM payments WHERE tenant_id = ?", (user["tenant_id"],)
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.post("/payments")
async def create_payment(body: PaymentCreate, user=Depends(get_current_user), db=Depends(get_db)):
    payment_id = body.id or str(uuid.uuid4())
    await db.execute(
        """INSERT INTO payments
           (id, invoice_id, date, amount, method, reference, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            payment_id, body.invoice_id, body.date, body.amount,
            body.method, body.reference, user["tenant_id"],
        ),
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM payments WHERE id = ? AND tenant_id = ?", (payment_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.put("/payments/{payment_id}")
async def update_payment(
    payment_id: str,
    body: PaymentUpdate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM payments WHERE id = ? AND tenant_id = ?", (payment_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Payment not found")

    fields = body.model_dump(exclude_none=True)
    if not fields:
        return dict(existing)

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [payment_id, user["tenant_id"]]
    await db.execute(
        f"UPDATE payments SET {set_clause} WHERE id = ? AND tenant_id = ?", values
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM payments WHERE id = ? AND tenant_id = ?", (payment_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.delete("/payments/{payment_id}")
async def delete_payment(payment_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT id FROM payments WHERE id = ? AND tenant_id = ?", (payment_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Payment not found")
    await db.execute(
        "DELETE FROM payments WHERE id = ? AND tenant_id = ?", (payment_id, user["tenant_id"])
    )
    await db.commit()
    return {"ok": True}


# ── Credit Notes ─────────────────────────────────────────────────────────────

@router.get("/credit-notes")
async def get_credit_notes(user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM credit_notes WHERE tenant_id = ?", (user["tenant_id"],)
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.post("/credit-notes")
async def create_credit_note(body: CreditNoteCreate, user=Depends(get_current_user), db=Depends(get_db)):
    cn_id = body.id or str(uuid.uuid4())
    await db.execute(
        """INSERT INTO credit_notes
           (id, number, date, invoice_id, amount, reason, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            cn_id, body.number, body.date, body.invoice_id,
            body.amount, body.reason, user["tenant_id"],
        ),
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM credit_notes WHERE id = ? AND tenant_id = ?", (cn_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.put("/credit-notes/{cn_id}")
async def update_credit_note(
    cn_id: str,
    body: CreditNoteUpdate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM credit_notes WHERE id = ? AND tenant_id = ?", (cn_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Credit note not found")

    fields = body.model_dump(exclude_none=True)
    if not fields:
        return dict(existing)

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [cn_id, user["tenant_id"]]
    await db.execute(
        f"UPDATE credit_notes SET {set_clause} WHERE id = ? AND tenant_id = ?", values
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM credit_notes WHERE id = ? AND tenant_id = ?", (cn_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.delete("/credit-notes/{cn_id}")
async def delete_credit_note(cn_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT id FROM credit_notes WHERE id = ? AND tenant_id = ?", (cn_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Credit note not found")
    await db.execute(
        "DELETE FROM credit_notes WHERE id = ? AND tenant_id = ?", (cn_id, user["tenant_id"])
    )
    await db.commit()
    return {"ok": True}


# ── Quotations ───────────────────────────────────────────────────────────────

@router.get("/quotations")
async def get_quotations(user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM quotations WHERE tenant_id = ?", (user["tenant_id"],)
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.post("/quotations")
async def create_quotation(body: QuotationCreate, user=Depends(get_current_user), db=Depends(get_db)):
    quot_id = body.id or str(uuid.uuid4())
    await db.execute(
        """INSERT INTO quotations
           (id, number, date, valid_until, client_id, asset_reg, items,
            subtotal, sgst, cgst, total, status, notes, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            quot_id, body.number, body.date, body.valid_until, body.client_id,
            body.asset_reg, _encode_items(body.items),
            body.subtotal, body.sgst, body.cgst, body.total,
            body.status, body.notes, user["tenant_id"],
        ),
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM quotations WHERE id = ? AND tenant_id = ?", (quot_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.put("/quotations/{quot_id}")
async def update_quotation(
    quot_id: str,
    body: QuotationUpdate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM quotations WHERE id = ? AND tenant_id = ?", (quot_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Quotation not found")

    fields = body.model_dump(exclude_none=True)
    if "items" in fields:
        fields["items"] = _encode_items(fields["items"])
    if not fields:
        return dict(existing)

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [quot_id, user["tenant_id"]]
    await db.execute(
        f"UPDATE quotations SET {set_clause} WHERE id = ? AND tenant_id = ?", values
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM quotations WHERE id = ? AND tenant_id = ?", (quot_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.delete("/quotations/{quot_id}")
async def delete_quotation(quot_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT id FROM quotations WHERE id = ? AND tenant_id = ?", (quot_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Quotation not found")
    await db.execute(
        "DELETE FROM quotations WHERE id = ? AND tenant_id = ?", (quot_id, user["tenant_id"])
    )
    await db.commit()
    return {"ok": True}


@router.post("/quotations/{quot_id}/convert")
async def convert_quotation(quot_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM quotations WHERE id = ? AND tenant_id = ?", (quot_id, user["tenant_id"])
    )
    quot = await cursor.fetchone()
    if not quot:
        raise HTTPException(status_code=404, detail="Quotation not found")

    quot = dict(quot)
    invoice_id = str(uuid.uuid4())
    await db.execute(
        """INSERT INTO invoices
           (id, number, date, due_date, client_id, asset_reg, items,
            subtotal, sgst, cgst, total, status, paid_amount, notes, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            invoice_id, quot["number"], quot["date"], None,
            quot["client_id"], quot["asset_reg"], quot["items"],
            quot["subtotal"], quot["sgst"], quot["cgst"], quot["total"],
            "draft", 0, quot["notes"], user["tenant_id"],
        ),
    )
    await db.execute(
        "UPDATE quotations SET status = ? WHERE id = ? AND tenant_id = ?",
        ("accepted", quot_id, user["tenant_id"]),
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM invoices WHERE id = ? AND tenant_id = ?", (invoice_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


# ── Proformas ────────────────────────────────────────────────────────────────

@router.get("/proformas")
async def get_proformas(user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM proformas WHERE tenant_id = ?", (user["tenant_id"],)
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.post("/proformas")
async def create_proforma(body: ProformaCreate, user=Depends(get_current_user), db=Depends(get_db)):
    proforma_id = body.id or str(uuid.uuid4())
    await db.execute(
        """INSERT INTO proformas
           (id, number, date, client_id, asset_reg, items,
            subtotal, sgst, cgst, total, status, quotation_id, notes, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            proforma_id, body.number, body.date, body.client_id,
            body.asset_reg, _encode_items(body.items),
            body.subtotal, body.sgst, body.cgst, body.total,
            body.status, body.quotation_id, body.notes, user["tenant_id"],
        ),
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM proformas WHERE id = ? AND tenant_id = ?", (proforma_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.put("/proformas/{proforma_id}")
async def update_proforma(
    proforma_id: str,
    body: ProformaUpdate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM proformas WHERE id = ? AND tenant_id = ?", (proforma_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Proforma not found")

    fields = body.model_dump(exclude_none=True)
    if "items" in fields:
        fields["items"] = _encode_items(fields["items"])
    if not fields:
        return dict(existing)

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [proforma_id, user["tenant_id"]]
    await db.execute(
        f"UPDATE proformas SET {set_clause} WHERE id = ? AND tenant_id = ?", values
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM proformas WHERE id = ? AND tenant_id = ?", (proforma_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.delete("/proformas/{proforma_id}")
async def delete_proforma(proforma_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT id FROM proformas WHERE id = ? AND tenant_id = ?", (proforma_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Proforma not found")
    await db.execute(
        "DELETE FROM proformas WHERE id = ? AND tenant_id = ?", (proforma_id, user["tenant_id"])
    )
    await db.commit()
    return {"ok": True}


@router.post("/proformas/{proforma_id}/convert")
async def convert_proforma(proforma_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM proformas WHERE id = ? AND tenant_id = ?", (proforma_id, user["tenant_id"])
    )
    proforma = await cursor.fetchone()
    if not proforma:
        raise HTTPException(status_code=404, detail="Proforma not found")

    proforma = dict(proforma)
    invoice_id = str(uuid.uuid4())
    await db.execute(
        """INSERT INTO invoices
           (id, number, date, due_date, client_id, asset_reg, items,
            subtotal, sgst, cgst, total, status, paid_amount, notes, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            invoice_id, proforma["number"], proforma["date"], None,
            proforma["client_id"], proforma["asset_reg"], proforma["items"],
            proforma["subtotal"], proforma["sgst"], proforma["cgst"], proforma["total"],
            "draft", 0, proforma["notes"], user["tenant_id"],
        ),
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM invoices WHERE id = ? AND tenant_id = ?", (invoice_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


# ── Challans ─────────────────────────────────────────────────────────────────

@router.get("/challans")
async def get_challans(user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM challans WHERE tenant_id = ?", (user["tenant_id"],)
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.post("/challans")
async def create_challan(body: ChallanCreate, user=Depends(get_current_user), db=Depends(get_db)):
    challan_id = body.id or str(uuid.uuid4())
    await db.execute(
        """INSERT INTO challans
           (id, number, date, client_id, asset_reg, site, items, status, notes, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            challan_id, body.number, body.date, body.client_id,
            body.asset_reg, body.site, _encode_items(body.items),
            body.status, body.notes, user["tenant_id"],
        ),
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM challans WHERE id = ? AND tenant_id = ?", (challan_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.put("/challans/{challan_id}")
async def update_challan(
    challan_id: str,
    body: ChallanUpdate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM challans WHERE id = ? AND tenant_id = ?", (challan_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Challan not found")

    fields = body.model_dump(exclude_none=True)
    if "items" in fields:
        fields["items"] = _encode_items(fields["items"])
    if not fields:
        return dict(existing)

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [challan_id, user["tenant_id"]]
    await db.execute(
        f"UPDATE challans SET {set_clause} WHERE id = ? AND tenant_id = ?", values
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM challans WHERE id = ? AND tenant_id = ?", (challan_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.delete("/challans/{challan_id}")
async def delete_challan(challan_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT id FROM challans WHERE id = ? AND tenant_id = ?", (challan_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Challan not found")
    await db.execute(
        "DELETE FROM challans WHERE id = ? AND tenant_id = ?", (challan_id, user["tenant_id"])
    )
    await db.commit()
    return {"ok": True}
