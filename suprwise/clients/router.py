import uuid
from fastapi import APIRouter, Depends, HTTPException
from ..database import get_db
from ..auth.dependencies import get_current_user
from .models import ClientCreate, ClientUpdate

router = APIRouter(prefix="/api/clients", tags=["clients"])


@router.get("")
async def get_clients(user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM clients WHERE tenant_id = ?", (user["tenant_id"],)
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.post("")
async def create_client(body: ClientCreate, user=Depends(get_current_user), db=Depends(get_db)):
    client_id = body.id or str(uuid.uuid4())
    await db.execute(
        """INSERT INTO clients
           (id, name, gstin, address, city, state, phone, email, contact_person, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            client_id, body.name, body.gstin, body.address, body.city,
            body.state, body.phone, body.email, body.contact_person, user["tenant_id"],
        ),
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM clients WHERE id = ? AND tenant_id = ?", (client_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.put("/{client_id}")
async def update_client(
    client_id: str,
    body: ClientUpdate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM clients WHERE id = ? AND tenant_id = ?", (client_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Client not found")

    fields = body.model_dump(exclude_none=True)
    if not fields:
        return dict(existing)

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [client_id, user["tenant_id"]]
    await db.execute(
        f"UPDATE clients SET {set_clause} WHERE id = ? AND tenant_id = ?", values
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM clients WHERE id = ? AND tenant_id = ?", (client_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.delete("/{client_id}")
async def delete_client(client_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT id FROM clients WHERE id = ? AND tenant_id = ?", (client_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Client not found")
    await db.execute(
        "DELETE FROM clients WHERE id = ? AND tenant_id = ?", (client_id, user["tenant_id"])
    )
    await db.commit()
    return {"ok": True}
