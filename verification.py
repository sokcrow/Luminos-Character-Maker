from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.goto("http://localhost:8000/pantalla_dm.html")
    # Take screenshot of the dm screen
    page.screenshot(path="pantalla_dm_verify.png", full_page=True)
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
