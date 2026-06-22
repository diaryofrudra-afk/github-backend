from fastapi import APIRouter, Depends, HTTPException
from ..database import get_db
from ..auth.dependencies import get_current_user
from .models import TenantUpdate

router = APIRouter(prefix="/api/tenants", tags=["tenants"])


@router.get("/me")
async def get_tenant(user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM tenants WHERE id = ?", (user["tenant_id"],)
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return dict(row)


@router.put("/me")
async def update_tenant(
    body: TenantUpdate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM tenants WHERE id = ?", (user["tenant_id"],)
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Tenant not found")

    fields = body.model_dump(exclude_none=True)
    if not fields:
        return dict(existing)

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [user["tenant_id"]]
    await db.execute(
        f"UPDATE tenants SET {set_clause} WHERE id = ?", values
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM tenants WHERE id = ?", (user["tenant_id"],)
    )
    row = await cursor.fetchone()
    return dict(row)
