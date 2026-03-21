import time
from playwright.sync_api import sync_playwright

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Just mock a 200 for Firebase Auth to let the page load completely but simulate state loading
        page.route("**/firebase-auth.js", lambda route: route.fulfill(body="", status=200))
        page.route("**/*.js", lambda route: route.continue_()) # Make sure other JS loads

        # Load the page, wait until network is mostly idle to prevent timeouts
        page.goto("file:///app/index.html", wait_until="networkidle", timeout=10000)

        # Wait a bit for JS to execute
        page.wait_for_timeout(1000)

        # Take screenshot of the loading overlay
        page.screenshot(path="/app/verification.png")

        browser.close()

if __name__ == "__main__":
    try:
        verify()
    except Exception as e:
        print(f"Error: {e}")
