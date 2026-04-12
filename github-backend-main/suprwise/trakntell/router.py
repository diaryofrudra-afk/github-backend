from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from ..auth.dependencies import get_current_user
from ..database import get_db
from .service import (
    fetch_trakntell_iframe_url,
    fetch_trakntell_vehicle_data,
    store_credentials,
    get_credentials_status,
    delete_credentials,
    clear_credentials_cache,
)
from .auto_login import trakntell_headless_login

router = APIRouter(prefix="/api/gps/trakntell", tags=["gps", "trakntell"])


class TrakNTellCredentialsInput(BaseModel):
    user_id: str
    user_id_encrypt: str
    orgid: str
    sessionid: str = ""  # JSESSIONID cookie
    tnt_s: str = ""      # tnt_s cookie (session state)


@router.get("/vehicles")
async def get_trakntell_vehicles(user=Depends(get_current_user)):
    """Fetch live Trak N Tell vehicle data for this user."""
    return await fetch_trakntell_vehicle_data(user_id=user["user_id"])


@router.get("/iframe-url")
async def get_trakntell_iframe_url(user=Depends(get_current_user)):
    """Get the iframe URL for Trak N Tell GPS tracking."""
    return await fetch_trakntell_iframe_url(user_id=user["user_id"])


@router.get("/health")
async def trakntell_health_check(user=Depends(get_current_user), db=Depends(get_db)):
    """Check this user's Trak N Tell integration status."""
    from .models import TrakNTellStatus

    status = TrakNTellStatus()
    creds_status = await get_credentials_status(user["user_id"])

    if creds_status:
        status.configured = True
        status.user_id_preview = creds_status["user_id_preview"]
    else:
        status.configured = False

    return status


@router.put("/credentials")
async def set_trakntell_credentials(
    creds: TrakNTellCredentialsInput,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Store encrypted Trak N Tell credentials for THIS user only."""
    # Basic validation — check that the values look like valid Trak N Tell params
    if not creds.user_id or not creds.user_id_encrypt or not creds.orgid:
        raise HTTPException(status_code=400, detail="All fields are required.")

    # Validate user_id is numeric (Trak N Tell uses numeric user IDs)
    if not creds.user_id.isdigit():
        raise HTTPException(status_code=400, detail="user_id must be a numeric value.")

    success = await store_credentials(
        user_id=user["user_id"],
        tenant_id=user["tenant_id"],
        tnt_user_id=creds.user_id,
        tnt_user_id_encrypt=creds.user_id_encrypt,
        tnt_orgid=creds.orgid,
        tnt_sessionid=creds.sessionid or "",
        tnt_s=creds.tnt_s or "",
    )

    if success:
        return {"ok": True, "message": "Trak N Tell credentials saved successfully"}
    raise HTTPException(status_code=500, detail="Failed to save credentials")


@router.get("/credentials")
async def get_trakntell_credentials(
    user=Depends(get_current_user), db=Depends(get_db)
):
    """Get THIS user's credential status (no raw values exposed)."""
    creds_status = await get_credentials_status(user["user_id"])

    if creds_status:
        return creds_status
    return {"configured": False, "user_id_preview": "", "updated_at": ""}


@router.delete("/credentials")
async def delete_trakntell_credentials(
    user=Depends(get_current_user), db=Depends(get_db)
):
    """Delete THIS user's Trak N Tell credentials."""
    await delete_credentials(user["user_id"])
    return {"ok": True, "message": "Trak N Tell credentials removed"}


class TrakNTellAutoLoginReq(BaseModel):
    username: str   # TrakNTell login username / user ID
    password: str


@router.post("/auto-login")
async def trakntell_auto_login(
    req: TrakNTellAutoLoginReq,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Headless-browser auto-login to Trak N Tell.
    Extracts JSESSIONID, tnt_s cookie, and user params (user_id, user_id_encrypt, orgid),
    then stores them encrypted in the DB.
    """
    login_result = await trakntell_headless_login(req.username, req.password)

    if not login_result["success"]:
        raise HTTPException(status_code=400, detail=login_result.get("error", "Trak N Tell auto-login failed."))

    sessionid: str = login_result.get("sessionid") or ""
    if not sessionid:
        raise HTTPException(status_code=400, detail="Login succeeded but JSESSIONID not found.")

    user_id: str = login_result.get("user_id") or ""
    user_id_encrypt: str = login_result.get("user_id_encrypt") or ""
    orgid: str = login_result.get("orgid") or ""
    tnt_s: str = login_result.get("tnt_s") or ""

    if not user_id or not orgid:
        raise HTTPException(
            status_code=400,
            detail=(
                "Login succeeded and JSESSIONID extracted, but user_id / orgid could not be found automatically. "
                "Please enter them manually via PUT /api/gps/trakntell/credentials."
            ),
        )

    success = await store_credentials(
        user_id=user["user_id"],
        tenant_id=user["tenant_id"],
        tnt_user_id=user_id,
        tnt_user_id_encrypt=user_id_encrypt,
        tnt_orgid=orgid,
        tnt_sessionid=sessionid,
        tnt_s=tnt_s,
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to save Trak N Tell credentials")

    return {
        "ok": True,
        "message": "Trak N Tell credentials saved via auto-login",
        "user_id_preview": user_id[:4] + "..." if len(user_id) > 4 else user_id,
        "has_sessionid": bool(sessionid),
        "has_tnt_s": bool(tnt_s),
    }
