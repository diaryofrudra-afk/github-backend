import asyncio
import logging
import sys
import os

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from suprwise.gps.auto_login import blackbuck_request_otp

logging.basicConfig(level=logging.INFO)

async def main():
    print("Testing Blackbuck Playwright OTP...")
    res = await blackbuck_request_otp("9999999999")
    print("Result:", res)

if __name__ == "__main__":
    asyncio.run(main())
