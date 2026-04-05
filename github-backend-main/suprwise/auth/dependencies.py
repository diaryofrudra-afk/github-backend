from fastapi import Depends, HTTPException, Header
from .service import decode_jwt


async def get_current_user(authorization: str = Header(...)) -> dict:
    try:
        token = authorization.replace("Bearer ", "")
        payload = decode_jwt(token)
        return {
            "user_id": payload["user_id"],
            "tenant_id": payload["tenant_id"],
            "role": payload["role"],
            "phone": payload["phone"],
            "email": payload.get("email", ""),
            "email_verified": payload.get("email_verified", False),
        }
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def require_owner(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")
    return user
