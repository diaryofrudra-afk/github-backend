import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth.dependencies import get_current_user
from ..database import get_db
from .service import fetch_wheelseye_telemetry, clear_credentials_cache
from .crypto import encrypt_token, decrypt_token
from .auto_login import wheelseye_request_otp, wheelseye_verify_otp
from .models import WheelsEyeStatus

router = APIRouter(prefix="/api/gps/wheelseye", tags=["gps", "wheelseye"])


class WheelsEyeRequestOtpReq(BaseModel):
    phone: str   # Phone number registered with WheelsEye (10 digits, no +91)


class WheelsEyeVerifyOtpReq(BaseModel):
    session_token: str
    otp: str


@router.post("/request-otp")
async def wheelseye_request_otp_endpoint(
    req: WheelsEyeRequestOtpReq,
    user=Depends(get_current_user),
):
    """Step 1: Navigate to WheelsEye, fill phone, click Send OTP. Returns session_token."""
    result = await wheelseye_request_otp(req.phone)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to send OTP"))
    return {"ok": True, "session_token": result["session_token"], "message": "OTP sent to your phone"}


@router.post("/verify-otp")
async def wheelseye_verify_otp_endpoint(
    req: WheelsEyeVerifyOtpReq,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Step 2: Enter OTP, complete WheelsEye login, store captured credentials."""
    login_result = await wheelseye_verify_otp(req.session_token, req.otp)
    if not login_result["success"]:
        raise HTTPException(status_code=400, detail=login_result.get("error", "OTP verification failed"))

    auth_token: str = login_result["auth_token"]
    fleet_id: str = login_result.get("fleet_id") or ""
    vehicles_api_url: str = login_result.get("vehicles_api_url") or ""

    encrypted = encrypt_token(auth_token)

    try:
        cursor = await db.execute(
            "SELECT id FROM wheelseye_credentials WHERE user_id = ?", (user["user_id"],)
        )
        existing = await cursor.fetchone()
    except Exception:
        existing = None

    if existing:
        await db.execute(
            "UPDATE wheelseye_credentials SET auth_token_encrypted = ?, fleet_id = ?, "
            "vehicles_api_url = ?, updated_at = datetime('now') WHERE user_id = ?",
            (encrypted, fleet_id, vehicles_api_url, user["user_id"]),
        )
    else:
        await db.execute(
            "INSERT INTO wheelseye_credentials (id, user_id, tenant_id, auth_token_encrypted, fleet_id, vehicles_api_url) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), user["user_id"], user["tenant_id"], encrypted, fleet_id, vehicles_api_url),
        )
    await db.commit()
    clear_credentials_cache(user["user_id"])

    return {
        "ok": True,
        "message": "WheelsEye credentials saved via OTP login",
        "vehicles_api_captured": bool(vehicles_api_url),
    }


@router.get("/vehicles")
async def get_wheelseye_vehicles(user=Depends(get_current_user)):
    """Fetch live WheelsEye GPS telemetry for this user only."""
    return await fetch_wheelseye_telemetry(user_id=user["user_id"])


@router.get("/health", response_model=WheelsEyeStatus)
async def wheelseye_health_check(user=Depends(get_current_user), db=Depends(get_db)):
    """Check this user's WheelsEye integration status."""
    status = WheelsEyeStatus()
    try:
        cursor = await db.execute(
            "SELECT auth_token_encrypted FROM wheelseye_credentials WHERE user_id = ?",
            (user["user_id"],),
        )
        row = await cursor.fetchone()
    except Exception:
        row = None

    if row:
        from cryptography.fernet import InvalidToken
        try:
            decrypt_token(row[0])
            status.configured = True
            try:
                data = await fetch_wheelseye_telemetry(user_id=user["user_id"])
                status.vehicle_count = len(data.vehicles)
                if data.error:
                    status.last_error = data.error
            except Exception as e:
                status.last_error = str(e)
        except InvalidToken:
            status.configured = False
            status.last_error = "Decryption failed (InvalidToken). Secret may have changed."
        except Exception as e:
            status.configured = False
            status.last_error = f"Configuration error: {str(e)}"

    return status


@router.get("/credentials")
async def get_wheelseye_credentials(user=Depends(get_current_user), db=Depends(get_db)):
    """Return THIS user's WheelsEye credential status (no raw token exposed)."""
    cursor = await db.execute(
        "SELECT vehicles_api_url, updated_at FROM wheelseye_credentials WHERE user_id = ?",
        (user["user_id"],),
    )
    row = await cursor.fetchone()
    if row:
        return {
            "configured": True,
            "token_preview": "(encrypted)",
            "has_vehicles_api": bool(row[0]),
            "updated_at": row[1],
        }
    return {"configured": False}


@router.delete("/credentials")
async def delete_wheelseye_credentials(user=Depends(get_current_user), db=Depends(get_db)):
    """Delete this user's WheelsEye credentials."""
    await db.execute("DELETE FROM wheelseye_credentials WHERE user_id = ?", (user["user_id"],))
    await db.commit()
    clear_credentials_cache(user["user_id"])
    return {"ok": True}
