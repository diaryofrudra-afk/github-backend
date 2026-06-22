"""
Fast2SMS Integration Test
==========================
Tests API key validity, wallet balance, and live SMS OTP delivery.

Usage:
    python3 test_fast2sms.py +919876543210
    python3 test_fast2sms.py 9876543210        # +91 prepended automatically
"""

import asyncio
import sys
from pathlib import Path

# ── Load .env ──────────────────────────────────────────────────────────────────
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_path)

import os
import httpx

FAST2SMS_API_KEY   = os.getenv("FAST2SMS_API_KEY", "")
OTP_EXPIRY_MINUTES = int(os.getenv("SMS_OTP_EXPIRY_MINUTES", "10"))
OTP_LENGTH         = int(os.getenv("SMS_OTP_LENGTH", "6"))

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
WARN = "\033[93m⚠\033[0m"
INFO = "\033[94mℹ\033[0m"


def section(title: str):
    print(f"\n{'─' * 50}")
    print(f"  {title}")
    print(f"{'─' * 50}")


def check(label: str, ok: bool, detail: str = ""):
    icon = PASS if ok else FAIL
    msg = f"  {icon}  {label}"
    if detail:
        msg += f"  →  {detail}"
    print(msg)
    return ok


# ── Test 1: Key present ────────────────────────────────────────────────────────
def test_key_present() -> bool:
    section("1. API Key")
    ok = bool(FAST2SMS_API_KEY)
    check("FAST2SMS_API_KEY set", ok, FAST2SMS_API_KEY[:8] + "…" if ok else "MISSING — add to .env")
    return ok


# ── Test 2: Wallet balance (proves key is valid) ───────────────────────────────
async def test_wallet() -> bool:
    section("2. Wallet / API Key Validity")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://www.fast2sms.com/dev/wallet",
                params={"authorization": FAST2SMS_API_KEY},
            )
        data = resp.json()
        if data.get("return") is True:
            balance = data.get("wallet", "unknown")
            check("API key valid", True)
            check("Wallet balance", True, f"₹{balance}")
            if float(balance) < 5:
                print(f"  {WARN}  Low balance — recharge at fast2sms.com to send SMS")
            return True
        check("API key valid", False, str(data))
        return False
    except Exception as e:
        check("API key valid", False, str(e))
        return False


# ── Test 3: Send OTP SMS ───────────────────────────────────────────────────────
async def test_send_otp(phone: str):
    """Sends OTP via the OTP route. Returns the OTP string if sent, else None."""
    section("3. Send OTP via Fast2SMS")

    # Normalise to 10-digit
    clean = phone.strip()
    if clean.startswith("+91"):
        clean = clean[3:]
    elif clean.startswith("91") and len(clean) == 12:
        clean = clean[2:]

    import random, string
    otp = "".join(random.choices(string.digits, k=OTP_LENGTH))

    print(f"  {INFO}  Sending {OTP_LENGTH}-digit OTP to {phone} (number: {clean}) …")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://www.fast2sms.com/dev/bulkV2",
                params={
                    "authorization": FAST2SMS_API_KEY,
                    "route": "otp",
                    "variables_values": otp,
                    "flash": "1",
                    "numbers": clean,
                },
            )
        data = resp.json()
        print(f"  {INFO}  Fast2SMS response: {data}")

        if data.get("return") is True:
            check("OTP SMS sent", True, f"OTP = {otp}")
            return otp

        status_code = data.get("status_code")
        if status_code == 996:
            print(f"  {WARN}  OTP route not yet verified on Fast2SMS account.")
            return None

        check("OTP SMS sent", False, str(data.get("message", data)))
        return None

    except Exception as e:
        check("OTP SMS sent", False, str(e))
        return None


async def test_send_quick_sms(clean_phone: str, otp: str):
    """Fallback: send OTP as a plain Quick SMS message."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://www.fast2sms.com/dev/bulk",
                headers={"authorization": FAST2SMS_API_KEY},
                json={
                    "route": "q",
                    "sender_id": "FSTSMS",
                    "language": "english",
                    "numbers": clean_phone,
                    "message": f"Your Suprwise OTP is {otp}. Valid for {OTP_EXPIRY_MINUTES} minutes. Do not share.",
                },
            )
        data = resp.json()
        print(f"  {INFO}  Quick SMS response: {data}")
        if data.get("return") is True:
            check("OTP sent via Quick SMS fallback", True, f"OTP = {otp}")
            return otp
        check("Quick SMS fallback", False, str(data.get("message", data)))
        return None
    except Exception as e:
        check("Quick SMS fallback", False, str(e))
        return None


# ── Test 4: Manual verify (checks OTP value, not DB) ──────────────────────────
def test_verify_manual(sent_otp: str) -> bool:
    section("4. OTP Verification Check")
    entered = input(f"  Enter the OTP you received on your phone (or 'skip'): ").strip()
    if entered.lower() == "skip":
        print(f"  {WARN}  Verification skipped")
        return True
    ok = entered == sent_otp
    check("OTP matches", ok, "Correct!" if ok else f"Expected {sent_otp}, got {entered}")
    return ok


# ── Summary ───────────────────────────────────────────────────────────────────
def print_summary(results: dict):
    section("Summary")
    for label, ok in results.items():
        print(f"  {PASS if ok else FAIL}  {label}")
    if all(results.values()):
        print(f"\n  {PASS}  Fast2SMS is fully configured and working!")
    else:
        print(f"\n  {WARN}  Fix the failing checks above, then re-run.")


# ── Main ──────────────────────────────────────────────────────────────────────
async def main():
    print("\n╔════════════════════════════════════════════════╗")
    print("║     Suprwise — Fast2SMS Integration Test      ║")
    print("╚════════════════════════════════════════════════╝")

    if len(sys.argv) > 1:
        phone = sys.argv[1]
    else:
        phone = input("\nEnter phone number (e.g. +919876543210): ").strip()

    if not phone.startswith("+"):
        print(f"  {WARN}  Prepending +91 …")
        phone = "+91" + phone.lstrip("0")

    print(f"\n  Target: {phone}")

    results = {}

    results["API key present"] = test_key_present()
    if not results["API key present"]:
        print_summary(results)
        return

    results["API key valid / wallet readable"] = await test_wallet()
    if not results["API key valid / wallet readable"]:
        print_summary(results)
        return

    sent_otp = await test_send_otp(phone)
    results["OTP SMS delivered"] = sent_otp is not None

    if sent_otp:
        results["OTP value correct"] = test_verify_manual(sent_otp)

    print_summary(results)


if __name__ == "__main__":
    asyncio.run(main())
