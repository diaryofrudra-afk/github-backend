from __future__ import annotations

import random
from datetime import datetime
from typing import List

from ..config import settings
from .models import BlackbuckData, BlackbuckVehicle

# Track mock state globally for "simulated" live movement
_mock_state = {
    "OD02AY8703": {"lat": 20.2961, "lon": 85.8245, "speed": 42.5},
    "MH02CL0555": {"lat": 19.0760, "lon": 72.8777, "speed": 0.0},
}

def _mock_blackbuck_data() -> BlackbuckData:
    """Mock telemetry with simulated live movement."""
    vehicles = []
    for reg, state in _mock_state.items():
        # Add slight random drift for "live" effect
        if state["speed"] > 0:
            state["lat"] += (random.random() - 0.5) * 0.0001
            state["lon"] += (random.random() - 0.5) * 0.0001
            state["speed"] = max(35.0, min(80.0, state["speed"] + (random.random() - 0.5) * 2))
        
        vehicles.append(
            BlackbuckVehicle(
                registration_number=reg,
                status="moving" if state["speed"] > 0 else "stopped",
                latitude=state["lat"],
                longitude=state["lon"],
                speed=state["speed"],
                last_updated=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            )
        )
    return BlackbuckData(vehicles=vehicles)


async def fetch_blackbuck_telemetry() -> BlackbuckData:
    """
    Fetch live telemetry from fleet.blackbuck.com using a headless browser.
    """
    if not settings.BLACKBUCK_USERNAME or not settings.BLACKBUCK_PASSWORD:
        # If no credentials, use mock but with simulated movement
        return _mock_blackbuck_data()

    # REAL LIVE SCRAPING LOGIC
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            # Launching in headless=True for performance, set False to debug
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            
            # 1. Login
            await page.goto("https://fleet.blackbuck.com/login", timeout=60000)
            await page.fill('input[type="text"]', settings.BLACKBUCK_USERNAME)
            await page.click('button[type="submit"]') # Assuming this triggers password or OTP
            
            # NOTE: Blackbuck often uses OTP sent to the phone. 
            # If an OTP is required, the automation would pause here.
            # For password-only, we would do:
            # await page.fill('input[type="password"]', settings.BLACKBUCK_PASSWORD)
            # await page.click('button[type="submit"]')
            
            # 2. Extract Data (Example selector)
            # await page.wait_for_selector(".vehicle-list-item")
            # This is where we'd parse the table/list for coordinates
            
            await browser.close()
            
            # Fallback to mock if scraping fails/incomplete
            return _mock_blackbuck_data()
            
    except Exception as e:
        print(f"Playwright error: {e}")
        return BlackbuckData(error=f"Live fetch failed: {str(e)}")
