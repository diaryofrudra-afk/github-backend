import re
import uuid
from fastapi import APIRouter, Depends, HTTPException
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from ..database import get_db
from .models import RegisterReq, LoginReq, ChangePasswordReq, TokenResp, UserResp, SendLoginOtpReq, VerifyLoginOtpReq, RegisterWithOtpReq, GoogleAuthReq
from .service import hash_password, verify_password, create_jwt
from .dependencies import get_current_user
from ..sms_otp.service import create_and_send_sms_otp, verify_sms_otp
from ..config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResp)
async def register(req: RegisterReq, db=Depends(get_db)):
    cursor = await db.execute(
        "SELECT id FROM users WHERE phone = ?", (req.phone,)
    )
    existing = await cursor.fetchone()
    if existing:
        raise HTTPException(400, "Phone number already registered")

    cursor = await db.execute(
        "SELECT id FROM users WHERE email = ?", (req.email,)
    )
    existing_email = await cursor.fetchone()
    if existing_email:
        raise HTTPException(400, "Email already registered")

    # Check if this phone was pre-added as an operator by an owner
    cursor = await db.execute(
        "SELECT id, tenant_id FROM operators WHERE phone = ?", (req.phone,)
    )
    operator_row = await cursor.fetchone()

    if operator_row:
        tenant_id = operator_row["tenant_id"]
        user_id = str(uuid.uuid4())
        await db.execute(
            "INSERT INTO users (id, phone, email, email_verified, password_hash, role, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (user_id, req.phone, req.email, 0, hash_password(req.password), "operator", tenant_id),
        )
        await db.commit()
        token = create_jwt(user_id, tenant_id, "operator", req.phone, email=req.email, email_verified=False)
        return TokenResp(token=token, user_id=user_id, tenant_id=tenant_id, role="operator", phone=req.phone, email=req.email, email_verified=False)

    tenant_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO tenants (id, name) VALUES (?, ?)",
        (tenant_id, req.company_name or "My Fleet"),
    )
    user_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO users (id, phone, email, email_verified, password_hash, role, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (user_id, req.phone, req.email, 0, hash_password(req.password), "owner", tenant_id),
    )
    profile_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO owner_profiles (id, user_id, tenant_id, company) VALUES (?, ?, ?, ?)",
        (profile_id, user_id, tenant_id, req.company_name or ""),
    )
    await db.commit()
    token = create_jwt(user_id, tenant_id, "owner", req.phone, email=req.email, email_verified=False)
    return TokenResp(token=token, user_id=user_id, tenant_id=tenant_id, role="owner", phone=req.phone, email=req.email, email_verified=False)


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
        "INSERT INTO users (id, phone, email, email_verified, password_hash, role, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (user_id, req.phone, req.email, 0, hash_password(req.password), "operator", user["tenant_id"]),
    )
    await db.commit()

    token = create_jwt(user_id, user["tenant_id"], "operator", req.phone)
    return TokenResp(token=token, user_id=user_id, tenant_id=user["tenant_id"], role="operator", phone=req.phone, email=req.email, email_verified=False)


@router.post("/login", response_model=TokenResp)
async def login(req: LoginReq, db=Depends(get_db)):
    if not req.phone and not req.email:
        raise HTTPException(400, "Phone or email is required")
    # Allow login by phone OR email — but prioritize phone when provided
    # (legacy users may have empty email, so we don't require both to match)
    if req.phone:
        cursor = await db.execute(
            "SELECT id, phone, email, email_verified, password_hash, role, tenant_id FROM users WHERE phone = ?",
            (req.phone,),
        )
    else:
        cursor = await db.execute(
            "SELECT id, phone, email, email_verified, password_hash, role, tenant_id FROM users WHERE email = ?",
            (req.email,),
        )

    row = await cursor.fetchone()
    if not row:
        raise HTTPException(401, "Credentials not found")

    # Verify password
    pw_hash = row["password_hash"]
    if pw_hash:
        if not verify_password(req.password, pw_hash):
            raise HTTPException(401, "Incorrect password")

    user_id = row["id"]
    tenant_id = row["tenant_id"]
    role = row["role"]
    phone = row["phone"]
    email = row["email"]
    email_verified = bool(row["email_verified"])

    return TokenResp(
        token=create_jwt(user_id, tenant_id, role, phone, email=email, email_verified=email_verified),
        user_id=user_id,
        tenant_id=tenant_id,
        role=role,
        phone=phone,
        email=email,
        email_verified=email_verified,
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


@router.post("/register-with-otp", response_model=TokenResp)
async def register_with_otp(req: RegisterWithOtpReq, db=Depends(get_db)):
    """
    Register a new user via OTP (no password required).
    - Verifies OTP
    - Creates tenant and user
    - Returns JWT token
    """
    # Verify OTP first
    valid = await verify_sms_otp(req.phone, req.otp, "registration")
    if not valid:
        raise HTTPException(401, "Invalid or expired OTP")

    # Check phone already registered
    cursor = await db.execute(
        "SELECT id FROM users WHERE phone = ?", (req.phone,)
    )
    existing = await cursor.fetchone()
    if existing:
        raise HTTPException(400, "Phone number already registered")

    # Check email already registered
    if req.email:
        cursor = await db.execute(
            "SELECT id FROM users WHERE email = ?", (req.email,)
        )
        existing_email = await cursor.fetchone()
        if existing_email:
            raise HTTPException(400, "Email already registered")

    # Check if this phone was pre-added as an operator
    cursor = await db.execute(
        "SELECT id, tenant_id FROM operators WHERE phone = ?", (req.phone,)
    )
    operator_row = await cursor.fetchone()

    if operator_row:
        tenant_id = operator_row["tenant_id"]
        user_id = str(uuid.uuid4())
        await db.execute(
            "INSERT INTO users (id, phone, email, email_verified, password_hash, role, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (user_id, req.phone, req.email, 1, "", "operator", tenant_id),
        )
        await db.commit()
        token = create_jwt(user_id, tenant_id, "operator", req.phone, email=req.email, email_verified=True)
        return TokenResp(token=token, user_id=user_id, tenant_id=tenant_id, role="operator", phone=req.phone, email=req.email, email_verified=True)

    # Create new owner
    tenant_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO tenants (id, name) VALUES (?, ?)",
        (tenant_id, req.name or "My Fleet"),
    )
    user_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO users (id, phone, email, email_verified, password_hash, role, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (user_id, req.phone, req.email, 1, "", "owner", tenant_id),
    )
    profile_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO owner_profiles (id, user_id, tenant_id, company) VALUES (?, ?, ?, ?)",
        (profile_id, user_id, tenant_id, req.name or ""),
    )
    await db.commit()
    token = create_jwt(user_id, tenant_id, "owner", req.phone, email=req.email, email_verified=True)
    return TokenResp(token=token, user_id=user_id, tenant_id=tenant_id, role="owner", phone=req.phone, email=req.email, email_verified=True)


@router.post("/login-with-otp")
async def login_with_otp(req: SendLoginOtpReq, db=Depends(get_db)):
    """
    Send OTP for passwordless login.
    - Validates phone number exists in users table
    - Generates and sends 6-digit OTP via SMS
    """
    cursor = await db.execute(
        "SELECT id, phone, email, email_verified, role, tenant_id FROM users WHERE phone = ?",
        (req.phone,),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(404, "Phone number not registered")

    otp = await create_and_send_sms_otp(req.phone, "login")
    if not otp:
        raise HTTPException(500, "Failed to send OTP. Check SMS configuration.")

    return {"success": True, "message": f"OTP sent to {req.phone}", "expires_in_minutes": 10}


@router.post("/verify-login-otp", response_model=TokenResp)
async def verify_login_otp(req: VerifyLoginOtpReq, db=Depends(get_db)):
    """
    Verify OTP and return JWT token for passwordless login.
    - Validates OTP against stored value
    - Returns JWT token on successful verification
    """
    valid = await verify_sms_otp(req.phone, req.otp, "login")
    if not valid:
        raise HTTPException(401, "Invalid or expired OTP")

    # Fetch user details
    cursor = await db.execute(
        "SELECT id, phone, email, email_verified, role, tenant_id FROM users WHERE phone = ?",
        (req.phone,),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(404, "User not found")

    user_id = row["id"]
    tenant_id = row["tenant_id"]
    role = row["role"]
    phone = row["phone"]
    email = row["email"]
    email_verified = bool(row["email_verified"])

    token = create_jwt(user_id, tenant_id, role, phone, email=email, email_verified=email_verified)
    return TokenResp(
        token=token,
        user_id=user_id,
        tenant_id=tenant_id,
        role=role,
        phone=phone,
        email=email,
        email_verified=email_verified,
    )


@router.get("/me", response_model=UserResp)
async def me(user=Depends(get_current_user)):
    return UserResp(
        user_id=user["user_id"],
        tenant_id=user["tenant_id"],
        role=user["role"],
        phone=user["phone"],
        email=user.get("email", ""),
        email_verified=bool(user.get("email_verified", 0)),
    )

@router.post("/test-login", response_model=TokenResp)
async def test_login(db=Depends(get_db)):
    """Developer bypass endpoint to immediately login as 9010719021."""
    phone = "9010719021"
    cursor = await db.execute(
        "SELECT id, phone, email, email_verified, role, tenant_id FROM users WHERE phone = ?",
        (phone,),
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(404, "Test user 9010719021 not found in database. Please register this phone number first.")

    user_id = row["id"]
    tenant_id = row["tenant_id"]
    role = row["role"]
    email = row["email"]
    email_verified = bool(row["email_verified"])

    token = create_jwt(user_id, tenant_id, role, phone, email=email, email_verified=email_verified)
    return TokenResp(
        token=token,
        user_id=user_id,
        tenant_id=tenant_id,
        role=role,
        phone=phone,
        email=email,
        email_verified=email_verified,
    )


@router.post("/google", response_model=TokenResp)
async def google_auth(req: GoogleAuthReq, db=Depends(get_db)):
    """
    Google OAuth login/registration.
    - Verifies Google ID token
    - If email exists, logs in user (no OTP required)
    - If email doesn't exist, creates new owner account
    - Returns JWT token
    """
    try:
        # Verify Google ID token
        idinfo = id_token.verify_oauth2_token(
            req.credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID
        )
        
        google_email = idinfo.get("email", "")
        google_name = idinfo.get("name", "")
        google_picture = idinfo.get("picture", "")
        email_verified = idinfo.get("email_verified", False)
        
        if not google_email:
            raise HTTPException(400, "Email not provided by Google")
        
        # Check if user exists by email
        cursor = await db.execute(
            "SELECT id, phone, email, email_verified, password_hash, role, tenant_id FROM users WHERE email = ?",
            (google_email,),
        )
        existing_user = await cursor.fetchone()
        
        if existing_user:
            # User exists - log them in (no OTP required)
            user_id = existing_user["id"]
            tenant_id = existing_user["tenant_id"]
            role = existing_user["role"]
            phone = existing_user["phone"] or ""
            email_verified_db = bool(existing_user["email_verified"])
            
            # Update email_verified if not already
            if email_verified and not email_verified_db:
                await db.execute(
                    "UPDATE users SET email_verified = 1 WHERE id = ?",
                    (user_id,),
                )
                await db.commit()
            
            token = create_jwt(
                user_id, tenant_id, role, phone,
                email=google_email,
                email_verified=email_verified or email_verified_db
            )
            return TokenResp(
                token=token,
                user_id=user_id,
                tenant_id=tenant_id,
                role=role,
                phone=phone,
                email=google_email,
                email_verified=email_verified or email_verified_db,
            )
        else:
            # New user - create owner account
            tenant_id = str(uuid.uuid4())
            await db.execute(
                "INSERT INTO tenants (id, name) VALUES (?, ?)",
                (tenant_id, google_name or "My Fleet"),
            )
            user_id = str(uuid.uuid4())
            await db.execute(
                "INSERT INTO users (id, phone, email, email_verified, password_hash, role, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (user_id, "", google_email, 1 if email_verified else 0, "", "owner", tenant_id),
            )
            profile_id = str(uuid.uuid4())
            await db.execute(
                "INSERT INTO owner_profiles (id, user_id, tenant_id, company) VALUES (?, ?, ?, ?)",
                (profile_id, user_id, tenant_id, google_name or ""),
            )
            await db.commit()
            
            token = create_jwt(
                user_id, tenant_id, "owner", "",
                email=google_email,
                email_verified=email_verified
            )
            return TokenResp(
                token=token,
                user_id=user_id,
                tenant_id=tenant_id,
                role="owner",
                phone="",
                email=google_email,
                email_verified=email_verified,
            )
    except ValueError as e:
        raise HTTPException(401, f"Invalid Google token: {str(e)}")
    except Exception as e:
        raise HTTPException(500, f"Google authentication failed: {str(e)}")


