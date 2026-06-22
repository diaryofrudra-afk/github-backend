from pydantic import BaseModel


class RegisterReq(BaseModel):
    phone: str
    email: str = ""
    password: str
    company_name: str = ""
    role: str = "owner"
    tenant_code: str = ""


class LoginReq(BaseModel):
    phone: str = ""
    email: str = ""
    password: str


class TokenResp(BaseModel):
    token: str
    user_id: str
    tenant_id: str
    role: str
    phone: str
    email: str = ""
    email_verified: bool = False


class ChangePasswordReq(BaseModel):
    old_password: str = ""
    new_password: str


class UserResp(BaseModel):
    user_id: str
    tenant_id: str
    role: str
    phone: str
    email: str = ""
    email_verified: bool = False


class SendLoginOtpReq(BaseModel):
    phone: str


class VerifyLoginOtpReq(BaseModel):
    phone: str
    otp: str


class RegisterWithOtpReq(BaseModel):
    phone: str
    name: str
    email: str = ""
    otp: str


class GoogleAuthReq(BaseModel):
    credential: str  # Google ID token


