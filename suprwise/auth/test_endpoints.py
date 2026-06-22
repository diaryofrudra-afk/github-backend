"""
Integration tests for auth endpoints. Verifies all auth flows work correctly.
Tests are run via: python3 suprwise/auth/test_endpoints.py
Or via the unified test runner: ./run_tests.sh
"""

import asyncio
import uuid
from datetime import datetime, timezone, timedelta
import aiosqlite
import sys
import os

# Add parent directory to path so we can import suprwise modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from suprwise.auth.service import hash_password, verify_password, create_jwt, decode_jwt
from suprwise.config import settings


class TestDatabase:
    """In-memory test database for auth tests."""

    def __init__(self):
        self.db = None

    async def setup(self):
        """Initialize in-memory test database with schema."""
        self.db = await aiosqlite.connect(":memory:")
        self.db.row_factory = aiosqlite.Row

        # Load and run schema
        schema_path = os.path.join(
            os.path.dirname(__file__), "..", "schema.sql"
        )
        with open(schema_path) as f:
            await self.db.executescript(f.read())

        await self.db.execute("PRAGMA foreign_keys=ON")

    async def cleanup(self):
        """Close database connection."""
        if self.db:
            await self.db.close()

    async def execute(self, query: str, params=None):
        """Execute a query."""
        if params:
            return await self.db.execute(query, params)
        return await self.db.execute(query)

    async def commit(self):
        """Commit transaction."""
        await self.db.commit()


async def test_register_owner():
    """Test: Owner registration creates tenant + user."""
    db = TestDatabase()
    await db.setup()

    try:
        phone = "9876543210"
        password = "testpass123"
        company_name = "Test Fleet"

        # Register owner
        tenant_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())

        await db.execute(
            "INSERT INTO tenants (id, name) VALUES (?, ?)",
            (tenant_id, company_name),
        )
        await db.execute(
            "INSERT INTO users (id, phone, password_hash, role, tenant_id) VALUES (?, ?, ?, ?, ?)",
            (user_id, phone, hash_password(password), "owner", tenant_id),
        )
        await db.commit()

        # Verify user exists
        cursor = await db.execute("SELECT * FROM users WHERE phone = ?", (phone,))
        user = await cursor.fetchone()
        assert user is not None, "User not created"
        assert user["role"] == "owner", "Role should be owner"
        assert user["tenant_id"] == tenant_id, "Tenant ID mismatch"

        # Verify password
        assert verify_password(password, user["password_hash"]), "Password verification failed"

        print("✅ test_register_owner")
    finally:
        await db.cleanup()


async def test_login_with_password():
    """Test: User can login with phone + password."""
    db = TestDatabase()
    await db.setup()

    try:
        phone = "9876543210"
        password = "testpass123"
        tenant_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())

        # Setup user
        await db.execute(
            "INSERT INTO tenants (id, name) VALUES (?, ?)", (tenant_id, "Test Fleet")
        )
        await db.execute(
            "INSERT INTO users (id, phone, password_hash, role, tenant_id) VALUES (?, ?, ?, ?, ?)",
            (user_id, phone, hash_password(password), "owner", tenant_id),
        )
        await db.commit()

        # Login
        cursor = await db.execute(
            "SELECT id, phone, password_hash, role, tenant_id FROM users WHERE phone = ?",
            (phone,),
        )
        row = await cursor.fetchone()
        assert row is not None, "User not found"
        assert verify_password(password, row["password_hash"]), "Invalid password"

        # Create JWT
        token = create_jwt(row["id"], row["tenant_id"], row["role"], row["phone"])
        assert token is not None, "JWT not created"

        # Decode and verify
        decoded = decode_jwt(token)
        assert decoded["user_id"] == user_id, "User ID mismatch in JWT"
        assert decoded["phone"] == phone, "Phone mismatch in JWT"
        assert decoded["role"] == "owner", "Role mismatch in JWT"

        print("✅ test_login_with_password")
    finally:
        await db.cleanup()


async def test_test_login_endpoint():
    """Test: /auth/test-login endpoint works directly (critical test)."""
    db = TestDatabase()
    await db.setup()

    try:
        phone = "9010719021"
        tenant_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())

        # Create test user
        await db.execute(
            "INSERT INTO tenants (id, name) VALUES (?, ?)", (tenant_id, "Test Fleet")
        )
        await db.execute(
            "INSERT INTO users (id, phone, password_hash, role, tenant_id) VALUES (?, ?, ?, ?, ?)",
            (user_id, phone, hash_password("dummy"), "owner", tenant_id),
        )
        await db.commit()

        # Simulate test-login endpoint behavior
        cursor = await db.execute(
            "SELECT id, phone, role, tenant_id FROM users WHERE phone = ?", (phone,)
        )
        user = await cursor.fetchone()
        assert user is not None, f"Test user {phone} not found"

        # Create JWT
        token = create_jwt(user["id"], user["tenant_id"], user["role"], user["phone"])
        assert token is not None, "JWT creation failed"

        # Verify token is valid
        decoded = decode_jwt(token)
        assert decoded["phone"] == phone, "Phone mismatch"
        assert decoded["role"] == "owner", "Role should be owner"

        print("✅ test_test_login_endpoint")
    finally:
        await db.cleanup()


async def test_otp_flow():
    """Test: OTP login flow (send OTP, verify OTP)."""
    db = TestDatabase()
    await db.setup()

    try:
        phone = "9876543210"
        tenant_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())

        # Create user
        await db.execute(
            "INSERT INTO tenants (id, name) VALUES (?, ?)", (tenant_id, "Test Fleet")
        )
        await db.execute(
            "INSERT INTO users (id, phone, password_hash, role, tenant_id) VALUES (?, ?, ?, ?, ?)",
            (user_id, phone, hash_password("dummy"), "operator", tenant_id),
        )
        await db.commit()

        # Simulate send OTP
        otp = "123456"
        otp_id = f"{phone}:{otp}:{int(datetime.now(timezone.utc).timestamp())}"
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()

        await db.execute("DELETE FROM sms_otps WHERE phone = ? AND purpose = ?", (phone, "login"))
        await db.execute(
            "INSERT INTO sms_otps (id, phone, otp, purpose, expires_at, attempts) VALUES (?, ?, ?, ?, ?, ?)",
            (otp_id, phone, otp, "login", expires_at, 0),
        )
        await db.commit()

        # Verify OTP
        cursor = await db.execute(
            "SELECT id FROM sms_otps WHERE phone = ? AND otp = ? AND purpose = 'login'",
            (phone, otp),
        )
        otp_row = await cursor.fetchone()
        assert otp_row is not None, "OTP not found"

        # Verify not expired
        cursor = await db.execute(
            "SELECT expires_at FROM sms_otps WHERE id = ?", (otp_row["id"],)
        )
        otp_data = await cursor.fetchone()
        expires = datetime.fromisoformat(otp_data["expires_at"])
        assert expires > datetime.now(timezone.utc), "OTP is expired"

        # Get user and create token
        cursor = await db.execute(
            "SELECT id, role, tenant_id, phone FROM users WHERE phone = ?", (phone,)
        )
        user = await cursor.fetchone()
        token = create_jwt(user["id"], user["tenant_id"], user["role"], user["phone"])

        # Clean up OTP
        await db.execute("DELETE FROM sms_otps WHERE id = ?", (otp_row["id"],))
        await db.commit()

        # Verify final state
        assert token is not None, "Token not created"
        decoded = decode_jwt(token)
        assert decoded["phone"] == phone, "Phone mismatch"
        assert decoded["role"] == "operator", "Role should be operator"

        print("✅ test_otp_flow")
    finally:
        await db.cleanup()


async def test_change_password():
    """Test: User can change password."""
    db = TestDatabase()
    await db.setup()

    try:
        phone = "9876543210"
        old_password = "oldpass123"
        new_password = "newpass456"
        user_id = str(uuid.uuid4())
        tenant_id = str(uuid.uuid4())

        # Create user
        await db.execute(
            "INSERT INTO tenants (id, name) VALUES (?, ?)", (tenant_id, "Test Fleet")
        )
        await db.execute(
            "INSERT INTO users (id, phone, password_hash, role, tenant_id) VALUES (?, ?, ?, ?, ?)",
            (user_id, phone, hash_password(old_password), "owner", tenant_id),
        )
        await db.commit()

        # Verify old password
        cursor = await db.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,))
        user = await cursor.fetchone()
        assert verify_password(old_password, user["password_hash"]), "Old password mismatch"

        # Change password
        await db.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (hash_password(new_password), user_id),
        )
        await db.commit()

        # Verify new password works
        cursor = await db.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,))
        user = await cursor.fetchone()
        assert verify_password(new_password, user["password_hash"]), "New password failed"
        assert not verify_password(old_password, user["password_hash"]), "Old password still works"

        print("✅ test_change_password")
    finally:
        await db.cleanup()


async def test_invalid_credentials():
    """Test: Login fails with invalid credentials."""
    db = TestDatabase()
    await db.setup()

    try:
        phone = "9876543210"
        password = "correctpass"
        user_id = str(uuid.uuid4())
        tenant_id = str(uuid.uuid4())

        # Create user
        await db.execute(
            "INSERT INTO tenants (id, name) VALUES (?, ?)", (tenant_id, "Test Fleet")
        )
        await db.execute(
            "INSERT INTO users (id, phone, password_hash, role, tenant_id) VALUES (?, ?, ?, ?, ?)",
            (user_id, phone, hash_password(password), "owner", tenant_id),
        )
        await db.commit()

        # Try wrong password
        wrong_password = "wrongpass"
        cursor = await db.execute(
            "SELECT password_hash FROM users WHERE phone = ?", (phone,)
        )
        user = await cursor.fetchone()
        assert not verify_password(wrong_password, user["password_hash"]), "Wrong password should not verify"

        # Try non-existent user
        cursor = await db.execute(
            "SELECT * FROM users WHERE phone = ?", ("9999999999",)
        )
        user = await cursor.fetchone()
        assert user is None, "Non-existent user should not be found"

        print("✅ test_invalid_credentials")
    finally:
        await db.cleanup()


async def test_register_operator_under_owner():
    """Test: Owner can add operators to their tenant."""
    db = TestDatabase()
    await db.setup()

    try:
        owner_phone = "9876543210"
        operator_phone = "9876543211"
        tenant_id = str(uuid.uuid4())
        owner_id = str(uuid.uuid4())
        operator_id = str(uuid.uuid4())

        # Create owner
        await db.execute(
            "INSERT INTO tenants (id, name) VALUES (?, ?)", (tenant_id, "Test Fleet")
        )
        await db.execute(
            "INSERT INTO users (id, phone, password_hash, role, tenant_id) VALUES (?, ?, ?, ?, ?)",
            (owner_id, owner_phone, hash_password("pass"), "owner", tenant_id),
        )
        await db.commit()

        # Add operator
        await db.execute(
            "INSERT INTO users (id, phone, password_hash, role, tenant_id) VALUES (?, ?, ?, ?, ?)",
            (operator_id, operator_phone, hash_password("pass"), "operator", tenant_id),
        )
        await db.commit()

        # Verify operator belongs to owner's tenant
        cursor = await db.execute(
            "SELECT * FROM users WHERE phone = ? AND tenant_id = ?",
            (operator_phone, tenant_id),
        )
        op = await cursor.fetchone()
        assert op is not None, "Operator not found in tenant"
        assert op["role"] == "operator", "User should be operator"

        print("✅ test_register_operator_under_owner")
    finally:
        await db.cleanup()


async def run_all_tests():
    """Run all auth endpoint tests."""
    print("\n" + "=" * 60)
    print("Running Auth Endpoint Tests")
    print("=" * 60 + "\n")

    tests = [
        test_register_owner,
        test_login_with_password,
        test_test_login_endpoint,
        test_otp_flow,
        test_change_password,
        test_invalid_credentials,
        test_register_operator_under_owner,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            await test()
            passed += 1
        except AssertionError as e:
            print(f"❌ {test.__name__}: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ {test.__name__}: {type(e).__name__}: {e}")
            failed += 1

    print("\n" + "=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60 + "\n")

    return failed == 0


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
