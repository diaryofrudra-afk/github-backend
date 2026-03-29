from pydantic import BaseModel


class RegisterReq(BaseModel):
    phone: str
    password: str
    company_name: str = ""
    role: str = "owner"
    tenant_code: str = ""


class LoginReq(BaseModel):
    phone: str
    password: str


class TokenResp(BaseModel):
    token: str
    user_id: str
    tenant_id: str
    role: str
    phone: str


class ChangePasswordReq(BaseModel):
    old_password: str = ""
    new_password: str


class UserResp(BaseModel):
    user_id: str
    tenant_id: str
    role: str
    phone: str
