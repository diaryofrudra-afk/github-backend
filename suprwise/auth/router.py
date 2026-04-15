import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from ..database import get_db
from .models import RegisterReq, LoginReq, ChangePasswordReq, TokenResp, UserResp, SendLoginOtpReq, VerifyLoginOtpReq
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

    if not verify_password(req.password, row["password_hash"]):
        raise HTTPException(401, "Invalid credentials")

    token = create_jwt(row["id"], row["tenant_id"], row["role"], row["phone"])
    return TokenResp(
        token=token, user_id=row["id"], tenant_id=row["tenant_id"],
        role=row["role"], phone=row["phone"],
    )


@router.post("/login-with-otp")
async def send_login_otp(req: SendLoginOtpReq, db=Depends(get_db)):
    # Check if user exists
    cursor = await db.execute(
        "SELECT id FROM users WHERE phone = ?", (req.phone,)
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(404, "Not Found")

    # Generate OTP
    import random, string
    otp = "".join(random.choices(string.digits, k=6))
    otp_id = f"{req.phone}:{otp}:{int(datetime.now(timezone.utc).timestamp())}"
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()

    # Store OTP
    await db.execute("DELETE FROM sms_otps WHERE phone = ? AND purpose = ?", (req.phone, "login"))
    await db.execute(
        "INSERT INTO sms_otps (id, phone, otp, purpose, expires_at, attempts) VALUES (?, ?, ?, ?, ?, 0)",
        (otp_id, req.phone, otp, "login", expires_at),
    )
    await db.commit()

    print(f"\n========================================\n  LOGIN OTP for {req.phone}: {otp}\n========================================\n")
    return {"success": True, "message": "OTP sent successfully", "expires_in_minutes": 10}


@router.post("/verify-login-otp", response_model=TokenResp)
async def verify_login_otp(req: VerifyLoginOtpReq, db=Depends(get_db)):
    # Debug logging
    print(f"🔍 Verify OTP request: phone={req.phone}, otp={req.otp}")
    
    # Check all OTPs for this phone
    debug_cursor = await db.execute(
        "SELECT phone, otp, purpose, expires_at FROM sms_otps WHERE phone = ?", (req.phone,)
    )
    all_otps = await debug_cursor.fetchall()
    print(f"📋 All OTPs in DB for {req.phone}: {[(r['otp'], r['purpose'], r['expires_at']) for r in all_otps]}")
    
    cursor = await db.execute(
        "SELECT id, phone, expires_at FROM sms_otps WHERE phone = ? AND otp = ? AND purpose = 'login'",
        (req.phone, req.otp),
    )
    row = await cursor.fetchone()
    print(f"🔑 Query result: {row}")
    
    if not row:
        print(f"❌ No matching OTP found. Requested: phone={req.phone}, otp={req.otp}")
        raise HTTPException(401, "Invalid OTP")

    expires = row["expires_at"]
    print(f"⏰ OTP expires at: {expires}, now: {datetime.now(timezone.utc)}, expired: {datetime.fromisoformat(expires) < datetime.now(timezone.utc)}")
    
    if datetime.fromisoformat(expires) < datetime.now(timezone.utc):
        raise HTTPException(401, "OTP expired")

    # Get user
    cursor = await db.execute(
        "SELECT id, phone, role, tenant_id FROM users WHERE phone = ?", (req.phone,)
    )
    user = await cursor.fetchone()
    if not user:
        raise HTTPException(404, "User not found")

    # Delete used OTP
    await db.execute("DELETE FROM sms_otps WHERE id = ?", (row["id"],))
    await db.commit()

    token = create_jwt(user["id"], user["tenant_id"], user["role"], user["phone"])
    return TokenResp(
        token=token, user_id=user["id"], tenant_id=user["tenant_id"],
        role=user["role"], phone=user["phone"],
    )


@router.post("/test-login")
async def test_login(db=Depends(get_db)):
    """Direct login for test user 9010719021 — no OTP required."""
    cursor = await db.execute(
        "SELECT id, phone, role, tenant_id FROM users WHERE phone = ?", ("9010719021",)
    )
    user = await cursor.fetchone()
    if not user:
        raise HTTPException(404, "Test user not found in database")

    token = create_jwt(user["id"], user["tenant_id"], user["role"], user["phone"])
    return TokenResp(
        token=token, user_id=user["id"], tenant_id=user["tenant_id"],
        role=user["role"], phone=user["phone"],
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
