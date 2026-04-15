import asyncio
import logging
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from suprwise.gps.auto_login import blackbuck_request_otp, blackbuck_verify_otp, blackbuck_headless_login

logging.basicConfig(level=logging.INFO)

async def main():
    print("=== Testing requests OTP ===")
    res1 = await blackbuck_request_otp("9999999999")
    print("OTP Result:", res1)
    
    if res1.get("success"):
        session = res1["session_token"]
        print("=== Testing verify OTP ===")
        res2 = await blackbuck_verify_otp(session, "123456")
        print("Verify OTP Result:", res2)
        
    print("=== Testing password login ===")
    res3 = await blackbuck_headless_login("9999999999", "password")
    print("Password Login Result:", res3)

if __name__ == "__main__":
    asyncio.run(main())
