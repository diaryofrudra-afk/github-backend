import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        print("\n" + "="*60)
        print(" TRAKNTELL COMMAND CAPTURE MODE - ACTIVE")
        print("="*60)
        print("1. Login to Trak N Tell.")
        print("2. Click the Immobilize/Lock/Unlock button.")
        print("3. Watch this terminal for the secret URL.")
        print("="*60)

        async def handle_request(request):
            # Sniff for any request containing 'Immobilize' or 'SetStatus'
            url = request.url.lower()
            if "tntservice" in url or "immobilize" in url or "lock" in url or "command" in url:
                print(f"\n[DETECTED API CALL]")
                print(f"URL: {request.url}")
                print(f"Method: {request.method}")
                if request.post_data:
                    print(f"Post Data: {request.post_data}")

        page.on("request", handle_request)
        await page.goto("https://web.trakntell.com")
        
        # Keep open for 10 minutes
        await asyncio.sleep(600)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
