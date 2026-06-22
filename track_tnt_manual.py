import asyncio
from playwright.async_api import async_playwright
import time

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        print("\n" + "="*60)
        print(" TRAKNTELL COMMAND CAPTURE MODE")
        print("="*60)
        print("1. A browser window will open.")
        print("2. Log in to web.trakntell.com")
        print("3. Perform a LOCK or UNLOCK action.")
        print("4. I will capture the URL in the background.")
        print("="*60)

        async def handle_request(request):
            if "tntservice" in request.url.lower():
                print(f"\n[CAPTURED TNT API CALL]")
                print(f"URL: {request.url}")
                print(f"Method: {request.method}")
                if request.post_data:
                    print(f"Data: {request.post_data}")

        page.on("request", handle_request)
        await page.goto("https://web.trakntell.com")
        
        # Keep open for 5 minutes
        await asyncio.sleep(300)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
