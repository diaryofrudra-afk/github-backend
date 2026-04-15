"""SMS OTP router — endpoints for sending and verifying SMS OTP via Fast2SMS."""
from fastapi import APIRouter, Depends

from ..database import get_db
from ..config import settings
from .models import SendSmsOtpReq, VerifySmsOtpReq, SmsOtpResp
from .service import create_and_send_sms_otp, verify_sms_otp

router = APIRouter(prefix="/api/sms-otp", tags=["sms-otp"])


@router.post("/send", response_model=SmsOtpResp)
async def send_sms_otp_endpoint(req: SendSmsOtpReq, db=Depends(get_db)):
    """
    Send OTP via SMS using Fast2SMS.
    
    - Validates phone number format
    - Generates 6-digit OTP
    - Stores OTP in SQLite with expiry
    - Sends OTP via Fast2SMS API
    """
    otp = await create_and_send_sms_otp(req.phone, req.purpose)
    
    if otp:
        return SmsOtpResp(
            success=True,
            message=f"OTP sent to {req.phone}",
            expires_in_minutes=settings.SMS_OTP_EXPIRY_MINUTES,
        )
    else:
        return SmsOtpResp(
            success=False,
            message="Failed to send OTP. Check Fast2SMS configuration.",
        )


@router.post("/verify", response_model=SmsOtpResp)
async def verify_sms_otp_endpoint(req: VerifySmsOtpReq, db=Depends(get_db)):
    """
    Verify SMS OTP from SQLite.
    
    - Validates OTP against local SQLite
    - Checks expiry and attempt limits
    - Deletes OTP on successful verification
    """
    valid = await verify_sms_otp(req.phone, req.otp, req.purpose)
    
    if valid:
        return SmsOtpResp(
            success=True,
            message="OTP verified successfully",
            phone=req.phone,
            purpose=req.purpose,
        )
    else:
        return SmsOtpResp(
            success=False,
            message="Invalid or expired OTP",
        )
