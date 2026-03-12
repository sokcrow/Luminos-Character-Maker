from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 400, "height": 800})
    page.goto("http://localhost:8000/hoja_personaje.html")

    # Wait for the shim and custom code to initialize
    page.wait_for_timeout(1000)

    # Navigate to Profile tab
    page.evaluate("document.querySelector('button[name=\"act_tab_profile\"]').click()")
    page.wait_for_timeout(500)

    # Take screenshot of View Mode
    page.screenshot(path="profile_view_no_ahn.png")

    # Toggle to Edit Mode
    page.evaluate("document.querySelector('button[name=\"act_toggle_profile_edit\"]').click()")
    page.wait_for_timeout(500)

    # Take screenshot of Edit Mode
    page.screenshot(path="profile_edit_no_ahn.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
