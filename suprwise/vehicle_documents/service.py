"""
Shared helpers for the vehicle document vault:
 - compute_status(): derive valid/expiring/expired from an expiry (or EMI due) date
 - add_one_month(): advance an EMI due date by a calendar month
 - scan_document_expiries(): background reminder pass (called from gps_poller)
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone

from ..notifications.service import create_notification

logger = logging.getLogger("suprwise.vehicle_documents")

# How many days before expiry a document is considered "expiring soon".
EXPIRING_WINDOW_DAYS = 30
# Don't re-notify about the same document more than once per this many days.
REMINDER_COOLDOWN_DAYS = 7

DOC_TYPE_LABELS = {
    "rc": "RC",
    "insurance": "Insurance",
    "fitness": "Fitness",
    "pollution": "Pollution (PUC)",
    "permit": "Permit",
    "road_tax": "Road Tax",
    "emi": "EMI",
    "other": "Document",
}


def _parse_date(value):
    """Parse a 'YYYY-MM-DD' (or ISO) date string; return a date or None."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value)[:10]).date()
    except (ValueError, TypeError):
        return None


def compute_status(expiry_date, today: date | None = None) -> str:
    """Return 'valid' | 'expiring' | 'expired' for a document's expiry/due date.

    A document with no expiry date (e.g. a lifetime RC) is treated as 'valid'.
    """
    expiry = _parse_date(expiry_date)
    if expiry is None:
        return "valid"
    today = today or datetime.now(timezone.utc).date()
    days_left = (expiry - today).days
    if days_left < 0:
        return "expired"
    if days_left <= EXPIRING_WINDOW_DAYS:
        return "expiring"
    return "valid"


def add_one_month(value) -> str | None:
    """Advance a 'YYYY-MM-DD' date by one calendar month, clamping the day.

    e.g. 2026-01-31 -> 2026-02-28. Returns ISO date string, or None if unparseable.
    """
    d = _parse_date(value)
    if d is None:
        return None
    month = d.month + 1
    year = d.year + (month - 1) // 12
    month = (month - 1) % 12 + 1
    # Clamp the day to the last day of the target month.
    if month == 12:
        next_month_first = date(year + 1, 1, 1)
    else:
        next_month_first = date(year, month + 1, 1)
    from datetime import timedelta
    last_day = (next_month_first - timedelta(days=1)).day
    day = min(d.day, last_day)
    return date(year, month, day).isoformat()


async def scan_document_expiries(db) -> None:
    """Create in-app notifications for documents that are expiring soon or expired.

    Deduped per-document via the `last_reminded` column (REMINDER_COOLDOWN_DAYS).
    Notifications are addressed to the document's tenant owner(s) by user_key.
    """
    today = datetime.now(timezone.utc).date()
    cursor = await db.execute(
        "SELECT id, crane_reg, doc_type, expiry_date, last_reminded, tenant_id "
        "FROM vehicle_documents WHERE expiry_date IS NOT NULL AND expiry_date != ''"
    )
    rows = await cursor.fetchall()
    if not rows:
        return

    # Resolve the owner user id per tenant so notifications land in the right inbox.
    owner_by_tenant: dict[str, str] = {}

    sent = 0
    for row in rows:
        status = compute_status(row["expiry_date"], today)
        if status == "valid":
            continue
        # Cooldown check.
        last = _parse_date(row["last_reminded"])
        if last is not None and (today - last).days < REMINDER_COOLDOWN_DAYS:
            continue

        tenant_id = row["tenant_id"]
        if tenant_id not in owner_by_tenant:
            oc = await db.execute(
                "SELECT id FROM users WHERE tenant_id = ? AND role = 'owner' LIMIT 1",
                (tenant_id,),
            )
            orow = await oc.fetchone()
            owner_by_tenant[tenant_id] = orow["id"] if orow else ""
        user_key = owner_by_tenant[tenant_id]
        if not user_key:
            continue

        label = DOC_TYPE_LABELS.get(row["doc_type"], "Document")
        expiry = _parse_date(row["expiry_date"])
        days_left = (expiry - today).days if expiry else 0
        if status == "expired":
            message = f"🔴 {row['crane_reg']} {label} expired on {row['expiry_date']}"
            ntype = "error"
        else:
            day_word = "day" if days_left == 1 else "days"
            message = f"⚠️ {row['crane_reg']} {label} expires in {days_left} {day_word} ({row['expiry_date']})"
            ntype = "warning"

        await create_notification(
            db, tenant_id, user_key, message, type=ntype, commit=False
        )
        await db.execute(
            "UPDATE vehicle_documents SET last_reminded = ? WHERE id = ?",
            (today.isoformat(), row["id"]),
        )
        sent += 1

    if sent:
        await db.commit()
        logger.info("Document expiry scan: sent %d reminder(s)", sent)
