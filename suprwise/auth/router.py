import uuid
from fastapi import APIRouter, Depends, HTTPException
from ..database import get_db
from .models import RegisterReq, LoginReq, ChangePasswordReq, TokenResp, UserResp
from .service import hash_password, verify_password, create_jwt
from .dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResp)
async def register(req: RegisterReq, db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT id FROM users WHERE phone = ?", (req.phone,)
    )
    existing = await cursor.fetchone()
    if existing:
        raise HTTPException(400, "Phone number already registered")

    # Check if this phone was pre-added as an operator by an owner
    cursor = await db.execute(
        "SELECT id, tenant_id FROM operators WHERE phone = ?", (req.phone,)
    )
    operator_row = await cursor.fetchone()

    if operator_row:
        # Phone exists in operators table — register as operator under that tenant
        tenant_id = operator_row["tenant_id"]
        user_id = str(uuid.uuid4())
        await db.execute(
            "INSERT INTO users (id, phone, password_hash, role, tenant_id) VALUES (?, ?, ?, ?, ?)",
            (user_id, req.phone, hash_password(req.password), "operator", tenant_id),
        )
        await db.commit()
        token = create_jwt(user_id, tenant_id, "operator", req.phone)
        return TokenResp(token=token, user_id=user_id, tenant_id=tenant_id, role="operator", phone=req.phone)

    # Otherwise, register as a new owner with a new tenant
    tenant_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO tenants (id, name) VALUES (?, ?)",
        (tenant_id, req.company_name or "My Fleet"),
    )
    user_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO users (id, phone, password_hash, role, tenant_id) VALUES (?, ?, ?, ?, ?)",
        (user_id, req.phone, hash_password(req.password), "owner", tenant_id),
    )
    profile_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO owner_profiles (id, user_id, tenant_id, company) VALUES (?, ?, ?, ?)",
        (profile_id, user_id, tenant_id, req.company_name or ""),
    )
    await db.commit()
    token = create_jwt(user_id, tenant_id, "owner", req.phone)
    return TokenResp(token=token, user_id=user_id, tenant_id=tenant_id, role="owner", phone=req.phone)


@router.post("/register-operator", response_model=TokenResp)
async def register_operator(req: RegisterReq, user=Depends(get_current_user), db=Depends(get_db)):
    if user["role"] != "owner":
        raise HTTPException(403, "Only owners can add operators")

    cursor = await db.execute(
        "SELECT id FROM users WHERE phone = ?", (req.phone,)
    )
    existing = await cursor.fetchone()
    if existing:
        raise HTTPException(400, "Phone number already registered")

    user_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO users (id, phone, password_hash, role, tenant_id) VALUES (?, ?, ?, ?, ?)",
        (user_id, req.phone, hash_password(req.password), "operator", user["tenant_id"]),
    )
    await db.commit()

    token = create_jwt(user_id, user["tenant_id"], "operator", req.phone)
    return TokenResp(token=token, user_id=user_id, tenant_id=user["tenant_id"], role="operator", phone=req.phone)


@router.post("/login", response_model=TokenResp)
async def login(req: LoginReq, db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT id, phone, password_hash, role, tenant_id FROM users WHERE phone = ?",
        (req.phone,),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(401, "Phone number not found")

    token = create_jwt(row["id"], row["tenant_id"], row["role"], row["phone"])
    return TokenResp(
        token=token, user_id=row["id"], tenant_id=row["tenant_id"],
        role=row["role"], phone=row["phone"],
    )


@router.put("/change-password")
async def change_password(req: ChangePasswordReq, user=Depends(get_current_user), db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT password_hash FROM users WHERE id = ?", (user["user_id"],)
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(404, "User not found")
    if row["password_hash"] and req.old_password:
        if not verify_password(req.old_password, row["password_hash"]):
            raise HTTPException(400, "Current password is incorrect")
    await db.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        (hash_password(req.new_password), user["user_id"]),
    )
    await db.commit()
    return {"message": "Password updated"}


@router.get("/me", response_model=UserResp)
async def me(user=Depends(get_current_user)):
    return UserResp(**user)
