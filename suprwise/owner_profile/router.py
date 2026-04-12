from fastapi import APIRouter, Depends, HTTPException
from ..database import get_db
from ..auth.dependencies import get_current_user
from .models import OwnerProfileUpdate

router = APIRouter(prefix="/api/owner-profile", tags=["owner_profile"])


@router.get("")
async def get_owner_profile(user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM owner_profiles WHERE tenant_id = ?", (user["tenant_id"],)
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Owner profile not found")
    return dict(row)


@router.put("")
async def update_owner_profile(
    body: OwnerProfileUpdate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM owner_profiles WHERE tenant_id = ?", (user["tenant_id"],)
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Owner profile not found")

    fields = body.model_dump(exclude_none=True)
    if not fields:
        return dict(existing)

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [user["tenant_id"]]
    await db.execute(
        f"UPDATE owner_profiles SET {set_clause} WHERE tenant_id = ?", values
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM owner_profiles WHERE tenant_id = ?", (user["tenant_id"],)
    )
    row = await cursor.fetchone()
    return dict(row)
