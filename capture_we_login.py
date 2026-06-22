"""
Drive a visible Chromium to wheelseye.com/fo/login, let the USER enter phone + OTP,
and record the whole network exchange (incl. send-otp + verify-otp + cookie flow) to a HAR.

Run:  ./github-backend-main/venv/bin/python capture_we_login.py
"""
import json
from playwright.sync_api import sync_playwright

HAR_PATH = "/tmp/we_login.har"
LOGIN_URL = "https://wheelseye.com/fo/login"

# Endpoints we care about — printed live as they happen so we see verify-otp immediately.
WATCH = ("send-otp", "verify-otp", "verifyOtp", "/shield/", "login")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(record_har_path=HAR_PATH, record_har_mode="full")
        page = context.new_page()

        def on_response(resp):
            url = resp.url
            if any(w in url for w in WATCH) and "analytics" not in url and "google" not in url:
                try:
                    body = resp.text()[:400]
                except Exception:
                    body = "(unreadable)"
                print(f"\n>>> {resp.request.method} {url}\n    status={resp.status}\n    resp={body}", flush=True)
                if resp.request.method == "POST":
                    try:
                        print(f"    req_body={resp.request.post_data}", flush=True)
                    except Exception:
                        pass

        page.on("response", on_response)

        print(f"Opening {LOGIN_URL} ...", flush=True)
        page.goto(LOGIN_URL)
        print("\n================================================================", flush=True)
        print("  Please log in IN THE BROWSER: enter phone -> get OTP -> enter OTP.", flush=True)
        print("  Waiting up to 5 minutes for you to reach the dashboard...", flush=True)
        print("================================================================\n", flush=True)

        try:
            # Dashboard load = successful login. Adjust pattern broadly.
            page.wait_for_url("**/node/**", timeout=300000)
            print("\n*** Dashboard reached — login succeeded. ***", flush=True)
        except Exception as e:
            print(f"\n(Did not detect dashboard navigation: {e}). Saving whatever was captured.", flush=True)

        # Give late XHRs a moment, then flush the HAR by closing the context.
        page.wait_for_timeout(3000)
        context.close()
        browser.close()
        print(f"\nHAR written to {HAR_PATH}", flush=True)


if __name__ == "__main__":
    main()
