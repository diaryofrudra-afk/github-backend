#!/usr/bin/env python3
"""
Generate OTP for local testing.
Usage: python3 generate_otp.py <phone_number> [purpose]
Example: python3 generate_otp.py 9010719021 login
         python3 generate_otp.py 9437012013 registration
"""
import sys
import sqlite3
import random
import string
from datetime import datetime, timedelta, timezone

DB_PATH = "data/suprwise.db"
OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 10

def generate_otp(phone: str, purpose: str = "login") -> str:
    otp = "".join(random.choices(string.digits, k=OTP_LENGTH))
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)).isoformat()
    otp_id = f"{phone}:{otp}:{int(datetime.now(timezone.utc).timestamp())}"
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Delete any existing OTP for this phone + purpose
    cursor.execute("DELETE FROM sms_otps WHERE phone = ? AND purpose = ?", (phone, purpose))
    
    # Insert new OTP with correct ISO 8601 format including +00:00 offset
    cursor.execute(
        "INSERT INTO sms_otps (id, phone, otp, purpose, expires_at, attempts) VALUES (?, ?, ?, ?, ?, 0)",
        (otp_id, phone, otp, purpose, expires_at)
    )
    
    conn.commit()
    conn.close()
    
    return otp

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 generate_otp.py <phone> [purpose]")
        print("Example: python3 generate_otp.py 9010719021 login")
        sys.exit(1)
    
    phone = sys.argv[1]
    purpose = sys.argv[2] if len(sys.argv) > 2 else "login"
    
    otp = generate_otp(phone, purpose)
    print(f"✅ OTP for {phone} ({purpose}): {otp}")
    print(f"   Valid for {OTP_EXPIRY_MINUTES} minutes")
