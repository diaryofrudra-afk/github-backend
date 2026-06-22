from datetime import datetime, timedelta, timezone
import bcrypt
import jwt
from ..config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_jwt(user_id: str, tenant_id: str, role: str, phone: str, email: str = "", email_verified: bool = False) -> str:
    payload = {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "role": role,
        "phone": phone,
        "email": email,
        "email_verified": email_verified,
        "exp": datetime.now(timezone.utc) + timedelta(days=settings.JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decode_jwt(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
