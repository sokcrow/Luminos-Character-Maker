from playwright.sync_api import sync_playwright

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(f"file://{__file__.replace('verification.py', 'pantalla_dm.html')}")

        # Take a screenshot to verify Zone A and Zone B rendering
        page.screenshot(path="pantalla_dm_verify.png", full_page=True)
        browser.close()

if __name__ == "__main__":
    verify()
