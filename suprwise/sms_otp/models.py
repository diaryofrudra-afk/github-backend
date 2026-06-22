"""SMS OTP models for request/response validation."""
from pydantic import BaseModel


class SendSmsOtpReq(BaseModel):
    """Request to send SMS OTP."""
    phone: str
    purpose: str = "registration"  # registration, login, password_reset


class VerifySmsOtpReq(BaseModel):
    """Request to verify SMS OTP."""
    phone: str
    otp: str
    purpose: str = "registration"


class SmsOtpResp(BaseModel):
    """Response for SMS OTP operations."""
    success: bool
    message: str
    otp_id: str = ""
    expires_in_minutes: int = 0
    phone: str = ""
    purpose: str = ""
