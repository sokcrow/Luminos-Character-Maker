from playwright.sync_api import Page, expect, sync_playwright
import time

def test_loading_screen(page: Page):
    # Go to the local file
    page.goto("file:///app/hoja_personaje.html")

    # Wait for the overlay to be visible
    overlay = page.locator("#system-loading-overlay")
    expect(overlay).to_be_visible()

    # Wait for the indicator
    indicator = page.locator("#system-loading-indicator")
    expect(indicator).to_be_visible()
    expect(indicator).to_have_text("ESTABLECIENDO VÍNCULO DE ALMAS...")

    # Take a screenshot
    page.screenshot(path="verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_loading_screen(page)
        finally:
            browser.close()
