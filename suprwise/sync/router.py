import json
import uuid
from fastapi import APIRouter, Depends, HTTPException
from ..database import get_db
from ..auth.dependencies import get_current_user
from .models import AppStateImport

router = APIRouter(prefix="/api/sync", tags=["sync"])


def _enc(val):
    """Encode a value to JSON string if it's a list/dict, else return as-is."""
    if isinstance(val, (list, dict)):
        return json.dumps(val)
    return val


def _get(row: dict, key: str, default=None):
    return row.get(key, default)


# ── Import ────────────────────────────────────────────────────────────────────

@router.post("/import")
async def import_data(
    body: AppStateImport,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    tid = user["tenant_id"]

    # cranes
    for r in (body.cranes or []):
        await db.execute(
            """INSERT OR IGNORE INTO cranes
               (id, reg, type, make, model, capacity, year, rate, ot_rate,
                daily_limit, operator, site, status, notes, tenant_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                r.get("id") or str(uuid.uuid4()),
                r.get("reg", ""), r.get("type", ""), r.get("make", ""),
                r.get("model", ""), r.get("capacity", ""), r.get("year", ""),
                r.get("rate", 0), r.get("ot_rate"), r.get("daily_limit", 8),
                r.get("operator", ""), r.get("site", ""), r.get("status", ""),
                r.get("notes", ""), tid,
            ),
        )

    # operators
    for r in (body.operators or []):
        await db.execute(
            """INSERT OR IGNORE INTO operators
               (id, name, phone, license, aadhaar, assigned, status, tenant_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                r.get("id") or str(uuid.uuid4()),
                r.get("name", ""), r.get("phone", ""), r.get("license", ""),
                r.get("aadhaar", ""), r.get("assigned", ""), r.get("status", "active"),
                tid,
            ),
        )

    # fuelLogs — keyed by crane_reg
    for crane_reg, logs in (body.fuelLogs or {}).items():
        for r in (logs or []):
            await db.execute(
                """INSERT OR IGNORE INTO fuel_logs
                   (id, crane_reg, date, litres, cost, odometer, type, notes, tenant_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    r.get("id") or str(uuid.uuid4()),
                    r.get("crane_reg", crane_reg),
                    r.get("date", ""), r.get("litres", 0), r.get("cost", 0),
                    r.get("odometer"), r.get("type", "Diesel"),
                    r.get("notes", ""), tid,
                ),
            )

    # timesheets — keyed by operator_key
    for operator_key, sheets in (body.timesheets or {}).items():
        for r in (sheets or []):
            await db.execute(
                """INSERT OR IGNORE INTO timesheets
                   (id, crane_reg, operator_key, date, start_time, end_time,
                    hours_decimal, operator_id, notes, tenant_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    r.get("id") or str(uuid.uuid4()),
                    r.get("crane_reg", ""),
                    r.get("operator_key", operator_key),
                    r.get("date", ""), r.get("start_time", ""), r.get("end_time", ""),
                    r.get("hours_decimal", 0), r.get("operator_id"),
                    r.get("notes", ""), tid,
                ),
            )

    # files — keyed by owner_key
    for owner_key, file_list in (body.files or {}).items():
        for r in (file_list or []):
            await db.execute(
                """INSERT OR IGNORE INTO files
                   (id, owner_key, name, type, data, size, timestamp, tenant_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    r.get("id") or str(uuid.uuid4()),
                    r.get("owner_key", owner_key),
                    r.get("name", ""), r.get("type", ""),
                    r.get("data", ""), r.get("size", ""), r.get("timestamp", ""),
                    tid,
                ),
            )

    # cameras
    for r in (body.cameras or []):
        await db.execute(
            """INSERT OR IGNORE INTO cameras
               (id, reg, label, url, type, notes, tenant_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                r.get("id") or str(uuid.uuid4()),
                r.get("reg", ""), r.get("label", ""), r.get("url", ""),
                r.get("type", "embed"), r.get("notes", ""), tid,
            ),
        )

    # clients
    for r in (body.clients or []):
        await db.execute(
            """INSERT OR IGNORE INTO clients
               (id, name, gstin, address, city, state, phone, email,
                contact_person, tenant_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                r.get("id") or str(uuid.uuid4()),
                r.get("name", ""), r.get("gstin", ""), r.get("address", ""),
                r.get("city", ""), r.get("state", ""), r.get("phone", ""),
                r.get("email", ""), r.get("contact_person", ""), tid,
            ),
        )

    # invoices
    for r in (body.invoices or []):
        await db.execute(
            """INSERT OR IGNORE INTO invoices
               (id, number, date, due_date, client_id, asset_reg, items,
                subtotal, sgst, cgst, total, status, paid_amount, notes, tenant_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                r.get("id") or str(uuid.uuid4()),
                r.get("number", ""), r.get("date", ""), r.get("due_date"),
                r.get("client_id", ""), r.get("asset_reg", ""),
                _enc(r.get("items", [])),
                r.get("subtotal", 0), r.get("sgst", 0), r.get("cgst", 0),
                r.get("total", 0), r.get("status", "draft"),
                r.get("paid_amount", 0), r.get("notes", ""), tid,
            ),
        )

    # payments
    for r in (body.payments or []):
        await db.execute(
            """INSERT OR IGNORE INTO payments
               (id, invoice_id, date, amount, method, reference, tenant_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                r.get("id") or str(uuid.uuid4()),
                r.get("invoice_id", ""), r.get("date", ""),
                r.get("amount", 0), r.get("method", ""), r.get("reference", ""), tid,
            ),
        )

    # creditNotes
    for r in (body.creditNotes or []):
        await db.execute(
            """INSERT OR IGNORE INTO credit_notes
               (id, number, date, invoice_id, amount, reason, tenant_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                r.get("id") or str(uuid.uuid4()),
                r.get("number", ""), r.get("date", ""), r.get("invoice_id", ""),
                r.get("amount", 0), r.get("reason", ""), tid,
            ),
        )

    # quotations
    for r in (body.quotations or []):
        await db.execute(
            """INSERT OR IGNORE INTO quotations
               (id, number, date, valid_until, client_id, asset_reg, items,
                subtotal, sgst, cgst, total, status, notes, tenant_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                r.get("id") or str(uuid.uuid4()),
                r.get("number", ""), r.get("date", ""), r.get("valid_until"),
                r.get("client_id", ""), r.get("asset_reg", ""),
                _enc(r.get("items", [])),
                r.get("subtotal", 0), r.get("sgst", 0), r.get("cgst", 0),
                r.get("total", 0), r.get("status", "draft"),
                r.get("notes", ""), tid,
            ),
        )

    # proformas
    for r in (body.proformas or []):
        await db.execute(
            """INSERT OR IGNORE INTO proformas
               (id, number, date, client_id, asset_reg, items,
                subtotal, sgst, cgst, total, status, quotation_id, notes, tenant_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                r.get("id") or str(uuid.uuid4()),
                r.get("number", ""), r.get("date", ""),
                r.get("client_id", ""), r.get("asset_reg", ""),
                _enc(r.get("items", [])),
                r.get("subtotal", 0), r.get("sgst", 0), r.get("cgst", 0),
                r.get("total", 0), r.get("status", "draft"),
                r.get("quotation_id"), r.get("notes", ""), tid,
            ),
        )

    # challans
    for r in (body.challans or []):
        await db.execute(
            """INSERT OR IGNORE INTO challans
               (id, number, date, client_id, asset_reg, site, items, status, notes, tenant_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                r.get("id") or str(uuid.uuid4()),
                r.get("number", ""), r.get("date", ""),
                r.get("client_id", ""), r.get("asset_reg", ""),
                r.get("site", ""), _enc(r.get("items", [])),
                r.get("status", "dispatched"), r.get("notes", ""), tid,
            ),
        )

    # compliance — keyed by crane_reg, value is a dict
    for crane_reg, rec in (body.compliance or {}).items():
        record_id = rec.get("id") or str(uuid.uuid4())
        await db.execute(
            """INSERT OR IGNORE INTO compliance
               (id, crane_reg, insurance_date, insurance_notes,
                rto_date, rto_notes, fitness_date, fitness_notes, tenant_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                record_id, rec.get("crane_reg", crane_reg),
                rec.get("insurance_date"), rec.get("insurance_notes", ""),
                rec.get("rto_date"), rec.get("rto_notes", ""),
                rec.get("fitness_date"), rec.get("fitness_notes", ""),
                tid,
            ),
        )

    # maintenance — keyed by crane_reg
    for crane_reg, records in (body.maintenance or {}).items():
        for r in (records or []):
            await db.execute(
                """INSERT OR IGNORE INTO maintenance
                   (id, crane_reg, date, type, cost, notes, tenant_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    r.get("id") or str(uuid.uuid4()),
                    r.get("crane_reg", crane_reg),
                    r.get("date", ""), r.get("type", ""),
                    r.get("cost", 0), r.get("notes", ""), tid,
                ),
            )

    # notifications
    for r in (body.notifications or []):
        await db.execute(
            """INSERT OR IGNORE INTO notifications
               (id, user_key, message, type, timestamp, read, tenant_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                r.get("id") or str(uuid.uuid4()),
                r.get("user_key", ""), r.get("message", ""),
                r.get("type", "info"), r.get("timestamp", ""),
                r.get("read", 0), tid,
            ),
        )

    # attendance
    for r in (body.attendance or []):
        await db.execute(
            """INSERT OR REPLACE INTO attendance
               (id, operator_key, date, status, marked_by, tenant_id)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                r.get("id") or str(uuid.uuid4()),
                r.get("operator_key", ""), r.get("date", ""),
                r.get("status", "present"), r.get("marked_by", "owner"),
                tid,
            ),
        )

    # ownerProfile — update the existing owner_profile for this tenant
    if body.ownerProfile:
        op = body.ownerProfile
        cursor = await db.execute(
            "SELECT id FROM owner_profiles WHERE tenant_id = ?", (tid,)
        )
        existing = await cursor.fetchone()
        if existing:
            await db.execute(
                """UPDATE owner_profiles SET
                   name = COALESCE(?, name),
                   role_title = COALESCE(?, role_title),
                   phone = COALESCE(?, phone),
                   email = COALESCE(?, email),
                   company = COALESCE(?, company),
                   city = COALESCE(?, city),
                   state = COALESCE(?, state),
                   gst = COALESCE(?, gst),
                   website = COALESCE(?, website),
                   default_limit = COALESCE(?, default_limit)
                   WHERE tenant_id = ?""",
                (
                    op.get("name"), op.get("role_title"), op.get("phone"),
                    op.get("email"), op.get("company"), op.get("city"),
                    op.get("state"), op.get("gst"), op.get("website"),
                    op.get("default_limit"), tid,
                ),
            )

    # operatorProfiles - Update operators table directly
    for op_key, prof in (body.operatorProfiles or {}).items():
        await db.execute(
            """UPDATE operators SET
               salary = COALESCE(?, salary),
               working_days = COALESCE(?, working_days)
               WHERE (phone = ? OR id = ?) AND tenant_id = ?""",
            (
                prof.get("salary"), prof.get("workingDays"),
                op_key, op_key, tid,
            )
        )

    # advancePayments
    for op_key, advances in (body.advancePayments or {}).items():
        for r in (advances or []):
            await db.execute(
                """INSERT OR REPLACE INTO advance_payments
                   (id, operator_key, date, amount, notes, tenant_id)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    r.get("id") or str(uuid.uuid4()),
                    op_key, r.get("date", ""),
                    r.get("amount", 0), r.get("notes", ""),
                    tid,
                )
            )

    await db.commit()
    return {"ok": True}


# ── Export ────────────────────────────────────────────────────────────────────

@router.get("/export")
async def export_data(user=Depends(get_current_user), db=Depends(get_db)):
    tid = user["tenant_id"]

    async def fetch_all(table):
        cursor = await db.execute(
            f"SELECT * FROM {table} WHERE tenant_id = ?", (tid,)
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    cranes = await fetch_all("cranes")
    operators = await fetch_all("operators")
    cameras = await fetch_all("cameras")
    clients = await fetch_all("clients")
    invoices = await fetch_all("invoices")
    payments = await fetch_all("payments")
    credit_notes = await fetch_all("credit_notes")
    quotations = await fetch_all("quotations")
    proformas = await fetch_all("proformas")
    challans = await fetch_all("challans")
    notifications = await fetch_all("notifications")
    attendance_records = await fetch_all("attendance")

    # fuel_logs → fuelLogs keyed by crane_reg
    fuel_rows = await fetch_all("fuel_logs")
    fuel_logs: dict = {}
    for r in fuel_rows:
        key = r.get("crane_reg", "")
        fuel_logs.setdefault(key, []).append(r)

    # timesheets → keyed by operator_key
    timesheet_rows = await fetch_all("timesheets")
    timesheets: dict = {}
    for r in timesheet_rows:
        key = r.get("operator_key", "")
        timesheets.setdefault(key, []).append(r)

    # files → keyed by owner_key
    file_rows = await fetch_all("files")
    files: dict = {}
    for r in file_rows:
        key = r.get("owner_key", "")
        files.setdefault(key, []).append(r)

    # compliance → keyed by crane_reg
    compliance_rows = await fetch_all("compliance")
    compliance: dict = {}
    for r in compliance_rows:
        key = r.get("crane_reg", "")
        compliance[key] = r

    # maintenance → keyed by crane_reg
    maintenance_rows = await fetch_all("maintenance")
    maintenance: dict = {}
    for r in maintenance_rows:
        key = r.get("crane_reg", "")
        maintenance.setdefault(key, []).append(r)

    # ownerProfile
    cursor = await db.execute(
        "SELECT * FROM owner_profiles WHERE tenant_id = ?", (tid,)
    )
    op_row = await cursor.fetchone()
    owner_profile = dict(op_row) if op_row else {}

    # operatorProfiles
    operator_profiles: dict = {}
    for r in operators:
        op_key = r.get("phone") or r.get("id")
        if op_key:
            operator_profiles[op_key] = {
                "salary": float(r.get("salary", 0) or 0),
                "workingDays": float(r.get("working_days", 26) or 26)
            }

    # advancePayments
    adv_rows = await fetch_all("advance_payments")
    advance_payments: dict = {}
    for r in adv_rows:
        key = r.get("operator_key", "")
        adv = {
            "id": r.get("id"),
            "date": r.get("date"),
            "amount": float(r.get("amount", 0) or 0),
            "notes": r.get("notes") or ""
        }
        advance_payments.setdefault(key, []).append(adv)

    return {
        "cranes": cranes,
        "operators": operators,
        "fuelLogs": fuel_logs,
        "timesheets": timesheets,
        "files": files,
        "cameras": cameras,
        "clients": clients,
        "invoices": invoices,
        "payments": payments,
        "creditNotes": credit_notes,
        "quotations": quotations,
        "proformas": proformas,
        "challans": challans,
        "compliance": compliance,
        "maintenance": maintenance,
        "notifications": notifications,
        "attendance": attendance_records,
        "ownerProfile": owner_profile,
        "operatorProfiles": operator_profiles,
        "advancePayments": advance_payments,
    }
