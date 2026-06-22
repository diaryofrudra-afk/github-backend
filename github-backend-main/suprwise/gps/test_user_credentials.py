"""
Tests for per-user Blackbuck credential storage and isolation.
Run: python3 suprwise/gps/test_user_credentials.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from suprwise.gps.crypto import encrypt_token, decrypt_token
from suprwise.gps.service import (
    _get_user_credentials,
    clear_credentials_cache,
    fetch_blackbuck_telemetry,
    _credentials_cache,
)


async def run_tests():
    print("=" * 60)
    print("  Per-User Credential Tests")
    print("=" * 60)

    passed = 0
    failed = 0

    tests = [
        ("Encryption roundtrip", test_encryption_roundtrip),
        ("Different keys produce different ciphertexts", test_different_ciphertexts),
        ("Credential cache isolation", test_cache_isolation),
        ("Clear specific user cache", test_clear_specific_cache),
        ("Fetch with .env fallback", test_env_fallback),
        ("Fetch with no credentials returns mock", test_no_creds_returns_mock),
    ]

    for name, fn in tests:
        print(f"\n[{passed+failed+1}] {name}... ", end="", flush=True)
        try:
            await fn()
            print("✓ PASS")
            passed += 1
        except Exception as e:
            print(f"✗ FAIL: {e}")
            failed += 1

    print(f"\n{'='*60}")
    print(f"  Results: {passed} passed, {failed} failed")
    print(f"{'='*60}")
    return failed == 0


async def test_encryption_roundtrip():
    token = "my_secret_token_12345"
    encrypted = encrypt_token(token)
    decrypted = decrypt_token(encrypted)
    assert decrypted == token, f"Decrypted '{decrypted}' != original '{token}'"
    assert encrypted != token, "Encrypted should differ from plaintext"


async def test_different_ciphertexts():
    """Same plaintext encrypted twice should produce different ciphertexts (Fernet uses random IV)."""
    token = "same_token"
    enc1 = encrypt_token(token)
    enc2 = encrypt_token(token)
    assert enc1 != enc2, "Same token should produce different ciphertexts each time"
    assert decrypt_token(enc1) == token
    assert decrypt_token(enc2) == token


async def test_cache_isolation():
    """Credentials for user A should not be visible to user B."""
    clear_credentials_cache()
    
    # Manually inject credentials for two users in cache
    _credentials_cache["user_A"] = {"auth_token": "token_A", "fleet_owner_id": "111"}
    _credentials_cache["user_B"] = {"auth_token": "token_B", "fleet_owner_id": "222"}
    
    # Each user sees their own credentials
    creds_a = await _get_user_credentials("user_A")
    creds_b = await _get_user_credentials("user_B")
    
    assert creds_a["auth_token"] == "token_A", f"User A got wrong token: {creds_a['auth_token']}"
    assert creds_b["auth_token"] == "token_B", f"User B got wrong token: {creds_b['auth_token']}"
    assert creds_a["fleet_owner_id"] == "111"
    assert creds_b["fleet_owner_id"] == "222"
    
    # Unknown user gets .env fallback or None
    clear_credentials_cache()


async def test_clear_specific_cache():
    """Clearing cache for user A should not affect user B."""
    clear_credentials_cache()
    
    _credentials_cache["user_A"] = {"auth_token": "token_A", "fleet_owner_id": "111"}
    _credentials_cache["user_B"] = {"auth_token": "token_B", "fleet_owner_id": "222"}
    
    clear_credentials_cache("user_A")
    
    assert "user_A" not in _credentials_cache, "User A should be cleared"
    assert "user_B" in _credentials_cache, "User B should still be cached"
    
    clear_credentials_cache()


async def test_env_fallback():
    """When no user-specific creds exist, should fall back to .env settings."""
    clear_credentials_cache()
    
    from suprwise.config import settings
    if settings.BLACKBUCK_AUTH_TOKEN and settings.BLACKBUCK_FLEET_OWNER_ID:
        creds = await _get_user_credentials("unknown_user")
        assert creds is not None
        assert creds["auth_token"] == settings.BLACKBUCK_AUTH_TOKEN
        assert creds["fleet_owner_id"] == settings.BLACKBUCK_FLEET_OWNER_ID
    else:
        # No .env credentials either — should return None
        creds = await _get_user_credentials("unknown_user")
        assert creds is None


async def test_no_creds_returns_mock():
    """With no credentials anywhere, should return mock data."""
    clear_credentials_cache()
    
    # Temporarily clear .env creds
    from suprwise.config import settings
    orig_token = settings.BLACKBUCK_AUTH_TOKEN
    orig_fleet = settings.BLACKBUCK_FLEET_OWNER_ID
    settings.BLACKBUCK_AUTH_TOKEN = ""
    settings.BLACKBUCK_FLEET_OWNER_ID = ""
    
    try:
        result = await fetch_blackbuck_telemetry(user_id="test_user")
        assert len(result.vehicles) > 0, "Should return mock vehicles"
        assert result.error is None
    finally:
        settings.BLACKBUCK_AUTH_TOKEN = orig_token
        settings.BLACKBUCK_FLEET_OWNER_ID = orig_fleet


if __name__ == "__main__":
    success = asyncio.run(run_tests())
    sys.exit(0 if success else 1)
