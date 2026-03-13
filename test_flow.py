from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 720})
    page = context.new_page()

    print("Navigating to DM Screen...")
    page.goto('file:///app/pantalla_dm.html')

    # Enable Director Mode
    page.click('#btn-modo-director')
    page.wait_for_timeout(500)

    # Set Location
    page.fill('#dm-theatre-location', 'L-Corp Main Office')
    page.click('#btn-update-location')
    page.wait_for_timeout(500)

    # Take screenshot of DM view
    page.screenshot(path='/app/flow_dm_view.png')
    print("Screenshot saved to /app/flow_dm_view.png")

    context.close()
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
