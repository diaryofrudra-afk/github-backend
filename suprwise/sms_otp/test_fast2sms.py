"""Fast2SMS OTP test script — verifies API key, sends OTP, verifies full flow."""
from __future__ import annotations

import asyncio
import sys
import os

# Add suprwise to path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
SUPRWISE_DIR = os.path.join(PROJECT_ROOT, "suprwise")
sys.path.insert(0, SUPRWISE_DIR)

import httpx
from config import settings


# ============================================================
# Test 1: Check Fast2SMS API Key
# ============================================================
async def test_api_key():
    """Verify the Fast2SMS API key is valid and check balance."""
    print("\n" + "=" * 60)
    print("🔑 Test 1: Fast2SMS API Key Validation")
    print("=" * 60)

    if not settings.FAST2SMS_API_KEY:
        print("❌ FAIL: FAST2SMS_API_KEY not set in .env")
        print("\n📝 Setup instructions:")
        print("  1. Go to https://www.fast2sms.com")
        print("  2. Sign up (free ₹50 credit)")
        print("  3. Dashboard → Dev API → copy API key")
        print("  4. Add to .env: FAST2SMS_API_KEY=your_key")
        return False

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Check wallet balance
            response = await client.get(
                "https://www.fast2sms.com/user/balance",
                headers={"authorization": settings.FAST2SMS_API_KEY},
            )
            data = response.json()

            if data.get("return"):
                balance = data.get("balance", 0)
                print(f"✅ PASS: API key valid")
                print(f"💰 Wallet balance: ₹{balance}")
                
                if balance < 1:
                    print("⚠️  WARNING: Low balance. Recharge at fast2sms.com")
                return True
            else:
                print(f"❌ FAIL: Invalid API key or account issue")
                print(f"   Response: {data}")
                return False

    except Exception as e:
        print(f"❌ FAIL: {e}")
        return False


# ============================================================
# Test 2: Send OTP via Fast2SMS
# ============================================================
async def test_send_otp(phone: str):
    """Send a real OTP via Fast2SMS."""
    print("\n" + "=" * 60)
    print("📱 Test 2: Send OTP via Fast2SMS")
    print("=" * 60)

    from database import init_db, close_db
    from sms_otp.service import create_and_send_sms_otp

    await init_db()

    try:
        print(f"📤 Sending OTP to {phone}...")
        otp = await create_and_send_sms_otp(phone, "test")

        if otp:
            print(f"✅ PASS: OTP sent successfully")
            print(f"🔢 OTP (for testing): {otp}")
            return otp
        else:
            print("❌ FAIL: Failed to send OTP")
            return None

    finally:
        await close_db()


# ============================================================
# Test 3: Verify OTP (Local SQLite)
# ============================================================
async def test_verify_otp(phone: str, otp: str):
    """Verify the OTP against SQLite."""
    print("\n" + "=" * 60)
    print("✅ Test 3: Verify OTP (Local SQLite)")
    print("=" * 60)

    from database import init_db, close_db
    from sms_otp.service import verify_sms_otp

    await init_db()

    try:
        print(f"🔍 Verifying OTP for {phone}...")
        valid = await verify_sms_otp(phone, otp, "test")

        if valid:
            print("✅ PASS: OTP verified successfully")
            return True
        else:
            print("❌ FAIL: OTP verification failed")
            return False

    finally:
        await close_db()


# ============================================================
# Test 4: Full Flow (Send + Verify via API)
# ============================================================
async def test_full_flow(phone: str):
    """Test the complete /api/sms-otp/send and /verify flow."""
    print("\n" + "=" * 60)
    print("🔄 Test 4: Full API Flow (/send + /verify)")
    print("=" * 60)

    from database import init_db, close_db, get_db
    from sms_otp.service import create_and_send_sms_otp, verify_sms_otp

    await init_db()

    try:
        db = await get_db()
        
        # Step 1: Send OTP
        print(f"📤 Step 1: Sending OTP to {phone}...")
        otp = await create_and_send_sms_otp(phone, "registration")

        if not otp:
            print("❌ FAIL: Step 1 failed — OTP not sent")
            return False

        print(f"✅ Step 1 complete — OTP: {otp}")

        # Step 2: Verify OTP
        print(f"🔍 Step 2: Verifying OTP...")
        valid = await verify_sms_otp(phone, otp, "registration")

        if not valid:
            print("❌ FAIL: Step 2 failed — OTP not verified")
            return False

        print(f"✅ Step 2 complete — OTP verified")

        # Step 3: Verify OTP is deleted (one-time use)
        print(f"🗑️  Step 3: Checking OTP was deleted...")
        cursor = await db.execute(
            "SELECT otp FROM sms_otps WHERE phone = ?",
            (phone,),
        )
        row = await cursor.fetchone()

        if row:
            print("❌ FAIL: OTP still exists in database (should be deleted)")
            return False

        print(f"✅ Step 3 complete — OTP deleted after use")

        print("\n✅ ALL STEPS PASSED: Full flow working correctly")
        return True

    finally:
        await close_db()


# ============================================================
# Test 5: Invalid OTP Rejection
# ============================================================
async def test_invalid_otp(phone: str):
    """Verify that invalid OTPs are rejected."""
    print("\n" + "=" * 60)
    print("🚫 Test 5: Invalid OTP Rejection")
    print("=" * 60)

    from database import init_db, close_db
    from sms_otp.service import create_and_send_sms_otp, verify_sms_otp

    await init_db()

    try:
        # Send real OTP
        otp = await create_and_send_sms_otp(phone, "test_invalid")
        if not otp:
            print("❌ FAIL: Could not send OTP for invalid test")
            return False

        # Try wrong OTP
        wrong_otp = "999999"
        print(f"🔍 Testing wrong OTP ({wrong_otp})...")
        valid = await verify_sms_otp(phone, wrong_otp, "test_invalid")

        if valid:
            print("❌ FAIL: Wrong OTP was accepted (should be rejected)")
            return False

        print("✅ PASS: Wrong OTP correctly rejected")

        # Now verify with correct OTP
        print(f"🔍 Testing correct OTP ({otp})...")
        valid = await verify_sms_otp(phone, otp, "test_invalid")

        if not valid:
            print("❌ FAIL: Correct OTP was rejected")
            return False

        print("✅ PASS: Correct OTP accepted")
        return True

    finally:
        await close_db()


# ============================================================
# Test Runner
# ============================================================
async def run_tests():
    """Run all Fast2SMS tests."""
    print("\n" + "=" * 70)
    print("🧪 Fast2SMS OTP Test Suite")
    print("=" * 70)

    # Test 1: API Key
    api_valid = await test_api_key()

    if not api_valid:
        print("\n❌ Cannot continue without valid API key")
        print("   Please configure FAST2SMS_API_KEY in .env")
        return False

    # Get phone number
    print("\n" + "-" * 60)
    phone = input("📱 Enter phone number (10 digits, e.g., 9876543210): ").strip()
    
    if not phone.isdigit() or len(phone) != 10:
        print("❌ Invalid phone number. Must be 10 digits.")
        return False

    phone = "+91" + phone
    print(f"   Using: {phone}")

    # Test 2: Send OTP
    otp = await test_send_otp(phone)

    if not otp:
        print("\n❌ Cannot continue without sending OTP")
        return False

    # Test 3: Verify OTP
    print(f"\n💬 Check your phone for the OTP code...")
    input("🔢 Press Enter after you receive the OTP (or just press Enter to use the test OTP)...")

    valid = await test_verify_otp(phone, otp)

    if not valid:
        print("\n❌ OTP verification failed")
        return False

    # Test 4: Full Flow
    full_flow = await test_full_flow(phone)

    # Test 5: Invalid OTP
    invalid_rejected = await test_invalid_otp(phone)

    # Summary
    print("\n" + "=" * 70)
    print("📊 Test Summary")
    print("=" * 70)
    print(f"  1. API Key Validation:    {'✅ PASS' if api_valid else '❌ FAIL'}")
    print(f"  2. Send OTP:              {'✅ PASS' if otp else '❌ FAIL'}")
    print(f"  3. Verify OTP:            {'✅ PASS' if valid else '❌ FAIL'}")
    print(f"  4. Full API Flow:         {'✅ PASS' if full_flow else '❌ FAIL'}")
    print(f"  5. Invalid OTP Rejection: {'✅ PASS' if invalid_rejected else '❌ FAIL'}")
    print("=" * 70)

    all_passed = all([api_valid, otp, valid, full_flow, invalid_rejected])

    if all_passed:
        print("\n🎉 All tests passed! Fast2SMS integration is working correctly.")
    else:
        print("\n❌ Some tests failed. Check the output above for details.")

    return all_passed


if __name__ == "__main__":
    success = asyncio.run(run_tests())
    sys.exit(0 if success else 1)
