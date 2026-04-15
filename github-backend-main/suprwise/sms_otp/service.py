"""Fast2SMS SMS OTP service — generates OTP, stores in SQLite, sends via Fast2SMS API."""
from __future__ import annotations

import random
import string
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from ..config import settings
from ..database import get_db

logger = logging.getLogger(__name__)

FAST2SMS_URL = "https://www.fast2sms.com/dev/bulkV2"


def generate_otp(length: int = 6) -> str:
    """Generate a random numeric OTP."""
    return "".join(random.choices(string.digits, k=length))


async def send_sms_otp(phone: str, otp: str) -> bool:
    """
    Send OTP via Fast2SMS Quick SMS route (no DLT or verification needed).
    Uses route=q (Quick SMS) — costs ₹5/SMS but works immediately.
    Falls back to console logging if API key is not configured.
    """
    if not settings.FAST2SMS_API_KEY or settings.FAST2SMS_API_KEY == "your_fast2sms_api_key_here":
        # Dev mode: log OTP to console instead of sending SMS
        print(f"\n{'='*50}")
        print(f"  📱 DEV MODE — OTP for {phone}: {otp}")
        print(f"{'='*50}\n")
        logger.info(f"DEV MODE — OTP for {phone}: {otp}")
        return True

    # Fast2SMS requires a 10-digit number without country code
    clean_phone = phone.replace("+91", "").replace(" ", "").strip()
    if clean_phone.startswith("91") and len(clean_phone) == 12:
        clean_phone = clean_phone[2:]

    try:
        # Use Quick SMS route (route=q) — no DLT or website verification needed
        message = f"Your Suprwise OTP is: {otp}. Do not share this code."
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                FAST2SMS_URL,
                params={
                    "authorization": settings.FAST2SMS_API_KEY,
                    "route": "q",
                    "message": message,
                    "flash": "1",
                    "language": "english",
                    "numbers": clean_phone,
                },
            )
        data = response.json()
        if data.get("return") is True:
            logger.info(f"Fast2SMS OTP sent to {phone}")
            return True
        
        # Check for Fast2SMS specific error messages
        error_msg = data.get("message", "")
        if "complete one transaction" in error_msg or "status_code" in data:
            logger.warning(f"Fast2SMS account not activated: {error_msg}")
            print(f"\n{'='*50}")
            print(f"  ⚠️  Fast2SMS requires ₹100 recharge to send SMS")
            print(f"  📱 OTP for {phone}: {otp}")
            print(f"{'='*50}\n")
            return True  # Allow login with console OTP
        
        logger.error(f"Fast2SMS send failed: {data}")
        # Fallback: log OTP to console
        print(f"\n{'='*50}")
        print(f"  📱 Fast2SMS FAILED — OTP for {phone}: {otp}")
        print(f"{'='*50}\n")
        return True  # Return True so user can still test with console OTP
    except Exception as e:
        logger.error(f"Fast2SMS send error: {e}")
        # Fallback: log OTP to console
        print(f"\n{'='*50}")
        print(f"  📱 Fast2SMS ERROR — OTP for {phone}: {otp}")
        print(f"{'='*50}\n")
        return True  # Return True so user can still test with console OTP


async def create_and_send_sms_otp(phone: str, purpose: str = "registration") -> Optional[str]:
    """
    Generate OTP, store in SQLite, and send via Fast2SMS.
    If a valid (non-expired) OTP already exists for this phone+purpose, return it
    instead of generating a new one — prevents OTP churn on repeated clicks.

    Supported purposes: "registration", "login", "operator_registration", "password_reset"

    Returns OTP string on success, None on failure.
    """
    db = await get_db()

    # Check if there's already a valid OTP
    cursor = await db.execute(
        "SELECT otp, expires_at FROM sms_otps WHERE phone = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1",
        (phone, purpose),
    )
    row = await cursor.fetchone()
    if row:
        existing_otp, expires_at = row[0], row[1]
        try:
            expires_dt = datetime.fromisoformat(expires_at)
            if expires_dt > datetime.now(timezone.utc):
                # Valid OTP exists — reuse it, don't generate new one
                return existing_otp
        except (ValueError, TypeError):
            # Corrupted expires_at (e.g., ms timestamp) — ignore this record
            pass

    # No valid OTP — delete any stale rows for this phone+purpose and insert a fresh one.
    # Without this DELETE, old expired rows accumulate and ORDER BY created_at can pick
    # the wrong row (e.g. when created_at is NULL on rows predating the column migration).
    await db.execute("DELETE FROM sms_otps WHERE phone = ? AND purpose = ?", (phone, purpose))

    otp = generate_otp(settings.SMS_OTP_LENGTH)
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=settings.SMS_OTP_EXPIRY_MINUTES)).isoformat()
    otp_id = f"{phone}:{otp}:{int(datetime.now(timezone.utc).timestamp())}"

    await db.execute(
        "INSERT INTO sms_otps (id, phone, otp, purpose, expires_at) VALUES (?, ?, ?, ?, ?)",
        (otp_id, phone, otp, purpose, expires_at),
    )
    await db.commit()

    # Send via Fast2SMS
    sent = await send_sms_otp(phone, otp)
    return otp if sent else None


async def verify_sms_otp(phone: str, otp: str, purpose: str = "registration") -> bool:
    """
    Verify SMS OTP from SQLite.
    
    Returns True if valid and not expired.
    """
    db = await get_db()
    
    # Find latest OTP for this phone + purpose
    cursor = await db.execute(
        "SELECT otp, expires_at, attempts FROM sms_otps WHERE phone = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1",
        (phone, purpose),
    )
    row = await cursor.fetchone()
    
    if not row:
        return False

    stored_otp, expires_at, attempts = row[0], row[1], row[2]
    
    # Check expiry — also purge the stale row so it can't interfere on retry
    try:
        if datetime.fromisoformat(expires_at) < datetime.now(timezone.utc):
            await db.execute("DELETE FROM sms_otps WHERE phone = ? AND purpose = ?", (phone, purpose))
            await db.commit()
            return False
    except (ValueError, TypeError):
        await db.execute("DELETE FROM sms_otps WHERE phone = ? AND purpose = ?", (phone, purpose))
        await db.commit()
        return False  # Corrupted expires_at — treat as expired
    
    # Check max attempts
    if attempts >= settings.SMS_OTP_MAX_ATTEMPTS:
        return False
    
    # Check OTP match
    if stored_otp != otp:
        # Increment attempts using phone + purpose (id is not selected)
        await db.execute(
            "UPDATE sms_otps SET attempts = attempts + 1 WHERE phone = ? AND purpose = ?",
            (phone, purpose),
        )
        await db.commit()
        return False

    # Success — delete used OTP
    await db.execute("DELETE FROM sms_otps WHERE phone = ? AND purpose = ?", (phone, purpose))
    await db.commit()
    return True
