from typing import Optional

from fastapi import Depends, HTTPException, Header, Query
from .service import decode_jwt


async def get_current_user(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
) -> dict:
    if not authorization and not token:
        raise HTTPException(status_code=401, detail="Missing Authorization header or token query parameter")
    try:
        jwt_token = token if token else authorization.replace("Bearer ", "")
        # Temporary: allow fake token for testing
        if jwt_token == "fake-token":
            return {
                "user_id": "test_user",
                "tenant_id": "test_tenant",
                "role": "owner",
                "phone": "9010719021",
                "email": "test@example.com",
                "email_verified": False,
            }
        payload = decode_jwt(jwt_token)
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
