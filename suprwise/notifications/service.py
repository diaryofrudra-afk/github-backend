import uuid
from datetime import datetime, timezone
from typing import Optional
import aiosqlite


async def create_notification(
    db: aiosqlite.Connection,
    tenant_id: str,
    user_key: str,
    message: str,
    type: str = "info",
    *,
    commit: bool = True,
) -> str:
    """
    Insert a notification row. Mirrors the INSERT used by the notifications router,
    but callable from background tasks (no request/dependency context).

    Returns the new notification id.
    """
    notif_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()
    await db.execute(
        """INSERT INTO notifications
           (id, user_key, message, type, timestamp, read, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (notif_id, user_key, message, type, timestamp, 0, tenant_id),
    )
    if commit:
        await db.commit()
    return notif_id


def engine_notification_text(reg: str, engine_on: bool, address: Optional[str] = None) -> str:
    """Build a human-readable engine ON/OFF notification message."""
    state = "🟢 ON" if engine_on else "🔴 OFF"
    msg = f"{reg} engine turned {state}"
    if address:
        msg += f" — {address[:80]}"
    return msg
