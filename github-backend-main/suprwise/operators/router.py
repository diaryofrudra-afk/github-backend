import uuid
import secrets
from fastapi import APIRouter, Depends, HTTPException
from ..database import get_db
from ..auth.dependencies import get_current_user
from ..auth.service import hash_password
from .models import OperatorCreate, OperatorUpdate, OperatorProfileUpdate

router = APIRouter(prefix="/api/operators", tags=["operators"])


@router.get("")
async def get_operators(user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM operators WHERE tenant_id = ?", (user["tenant_id"],)
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@router.post("")
async def create_operator(body: OperatorCreate, user=Depends(get_current_user), db=Depends(get_db)):
    operator_id = body.id or str(uuid.uuid4())
    
    # Check phone not already registered as a user
    cursor2 = await db.execute("SELECT id FROM users WHERE phone = ?", (body.phone,))
    if await cursor2.fetchone():
        raise HTTPException(400, "Phone number already registered")
    
    # Check operator doesn't already exist
    cursor3 = await db.execute("SELECT id FROM operators WHERE phone = ? AND tenant_id = ?", (body.phone, user["tenant_id"]))
    if await cursor3.fetchone():
        raise HTTPException(400, "Operator with this phone number already exists")
    
    await db.execute(
        """INSERT INTO operators (id, name, phone, license, aadhaar, assigned, status, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            operator_id, body.name, body.phone, body.license,
            body.aadhaar, body.assigned, body.status, user["tenant_id"],
        ),
    )
    
    # Auto-create a user account with a random temp password — operator must use OTP login
    temp_password = secrets.token_urlsafe(16)
    user_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO users (id, phone, password_hash, role, tenant_id) VALUES (?, ?, ?, ?, ?)",
        (user_id, body.phone, hash_password(temp_password), "operator", user["tenant_id"]),
    )
    await db.commit()
    
    cursor = await db.execute(
        "SELECT * FROM operators WHERE id = ? AND tenant_id = ?", (operator_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    result = dict(row)
    result["temp_password"] = temp_password  # Return to owner so they can share with operator
    return result


@router.put("/{operator_id}")
async def update_operator(
    operator_id: str,
    body: OperatorUpdate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM operators WHERE id = ? AND tenant_id = ?", (operator_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Operator not found")

    fields = body.model_dump(exclude_none=True)
    if not fields:
        return dict(existing)

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [operator_id, user["tenant_id"]]
    await db.execute(
        f"UPDATE operators SET {set_clause} WHERE id = ? AND tenant_id = ?", values
    )
    await db.commit()
    cursor = await db.execute(
        "SELECT * FROM operators WHERE id = ? AND tenant_id = ?", (operator_id, user["tenant_id"])
    )
    row = await cursor.fetchone()
    return dict(row)


@router.delete("/{operator_id}")
async def delete_operator(operator_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT id FROM operators WHERE id = ? AND tenant_id = ?", (operator_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Operator not found")
    # Get phone before deleting
    cursor2 = await db.execute(
        "SELECT phone FROM operators WHERE id = ? AND tenant_id = ?", (operator_id, user["tenant_id"])
    )
    op_row = await cursor2.fetchone()
    await db.execute(
        "DELETE FROM operators WHERE id = ? AND tenant_id = ?", (operator_id, user["tenant_id"])
    )
    # Also remove their user account
    if op_row:
        await db.execute(
            "DELETE FROM users WHERE phone = ? AND role = 'operator' AND tenant_id = ?",
            (op_row["phone"], user["tenant_id"]),
        )
    await db.commit()
    return {"ok": True}


@router.get("/me/profile")
async def get_my_operator_profile(user=Depends(get_current_user), db=Depends(get_db)):
    """Operator fetches their own profile by phone number."""
    cursor = await db.execute(
        "SELECT id FROM operators WHERE phone = ? AND tenant_id = ?",
        (user["phone"], user["tenant_id"]),
    )
    op = await cursor.fetchone()
    if not op:
        raise HTTPException(404, "Operator not found")
    cursor = await db.execute(
        "SELECT * FROM operator_profiles WHERE operator_id = ? AND tenant_id = ?",
        (op["id"], user["tenant_id"]),
    )
    row = await cursor.fetchone()
    if not row:
        return {"operator_id": op["id"], "photo": "", "bank": "", "ifsc": "", "account": "", "address": ""}
    return dict(row)


@router.put("/me/profile")
async def update_my_operator_profile(
    body: OperatorProfileUpdate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Operator updates their own profile (photo, bank, etc.)."""
    cursor = await db.execute(
        "SELECT id FROM operators WHERE phone = ? AND tenant_id = ?",
        (user["phone"], user["tenant_id"]),
    )
    op = await cursor.fetchone()
    if not op:
        raise HTTPException(404, "Operator not found")
    operator_id = op["id"]
    cursor = await db.execute(
        "SELECT * FROM operator_profiles WHERE operator_id = ? AND tenant_id = ?",
        (operator_id, user["tenant_id"]),
    )
    profile = await cursor.fetchone()
    if profile:
        fields = body.model_dump(exclude_none=True)
        if fields:
            set_clause = ", ".join(f"{k} = ?" for k in fields)
            values = list(fields.values()) + [operator_id, user["tenant_id"]]
            await db.execute(
                f"UPDATE operator_profiles SET {set_clause} WHERE operator_id = ? AND tenant_id = ?",
                values,
            )
            await db.commit()
        cursor = await db.execute(
            "SELECT * FROM operator_profiles WHERE operator_id = ? AND tenant_id = ?",
            (operator_id, user["tenant_id"]),
        )
        return dict(await cursor.fetchone())
    else:
        profile_id = str(uuid.uuid4())
        data = body.model_dump()
        await db.execute(
            """INSERT INTO operator_profiles (id, operator_id, tenant_id, photo, bank, ifsc, account, address)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (profile_id, operator_id, user["tenant_id"],
             data.get("photo") or "", data.get("bank") or "",
             data.get("ifsc") or "", data.get("account") or "", data.get("address") or ""),
        )
        await db.commit()
        cursor = await db.execute("SELECT * FROM operator_profiles WHERE id = ?", (profile_id,))
        return dict(await cursor.fetchone())


@router.get("/{operator_id}/profile")
async def get_operator_profile(operator_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM operator_profiles WHERE operator_id = ? AND tenant_id = ?",
        (operator_id, user["tenant_id"]),
    )
    row = await cursor.fetchone()
    if not row:
        return {"operator_id": operator_id, "photo": "", "bank": "", "ifsc": "", "account": "", "address": ""}
    return dict(row)


@router.put("/{operator_id}/profile")
async def upsert_operator_profile(
    operator_id: str,
    body: OperatorProfileUpdate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    cursor = await db.execute(
        "SELECT id FROM operators WHERE id = ? AND tenant_id = ?", (operator_id, user["tenant_id"])
    )
    existing = await cursor.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Operator not found")

    cursor = await db.execute(
        "SELECT * FROM operator_profiles WHERE operator_id = ? AND tenant_id = ?",
        (operator_id, user["tenant_id"]),
    )
    profile = await cursor.fetchone()

    if profile:
        fields = body.model_dump(exclude_none=True)
        if fields:
            set_clause = ", ".join(f"{k} = ?" for k in fields)
            values = list(fields.values()) + [operator_id, user["tenant_id"]]
            await db.execute(
                f"UPDATE operator_profiles SET {set_clause} WHERE operator_id = ? AND tenant_id = ?",
                values,
            )
            await db.commit()
        cursor = await db.execute(
            "SELECT * FROM operator_profiles WHERE operator_id = ? AND tenant_id = ?",
            (operator_id, user["tenant_id"]),
        )
        row = await cursor.fetchone()
        return dict(row)
    else:
        profile_id = str(uuid.uuid4())
        data = body.model_dump()
        await db.execute(
            """INSERT INTO operator_profiles (id, operator_id, tenant_id, photo, bank, ifsc, account, address)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                profile_id, operator_id, user["tenant_id"],
                data.get("photo") or "",
                data.get("bank") or "",
                data.get("ifsc") or "",
                data.get("account") or "",
                data.get("address") or "",
            ),
        )
        await db.commit()
        cursor = await db.execute(
            "SELECT * FROM operator_profiles WHERE id = ?", (profile_id,)
        )
        row = await cursor.fetchone()
        return dict(row)
