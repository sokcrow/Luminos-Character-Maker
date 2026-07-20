from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:3000/pantalla_dm.html")
    page.wait_for_timeout(4000)

    # Hide loading overlay explicitly to prevent blocking
    page.evaluate("if(document.getElementById('system-loading-overlay')) { document.getElementById('system-loading-overlay').remove(); }")
    page.wait_for_timeout(1000)

    page.evaluate("if(document.querySelector('button[data-tab=\"tab-forja\"]')) { document.querySelector('button[data-tab=\"tab-forja\"]').click(); }")
    page.wait_for_timeout(1000)

    # Take screenshot at the key moment for DM Panel
    page.screenshot(path="/home/jules/verification/screenshots/dm_panel.png")
    page.wait_for_timeout(1000)

    # Go to player page
    page.goto("http://localhost:3000/hoja_personaje.html")
    page.wait_for_timeout(4000)

    # Hide loading overlay
    page.evaluate("if(document.getElementById('system-loading-overlay')) { document.getElementById('system-loading-overlay').remove(); }")
    page.wait_for_timeout(1000)

    # Click on cell phone toggle to show UI
    page.evaluate("if(document.getElementById('btn-toggle-phone')) { document.getElementById('btn-toggle-phone').click(); }")
    page.wait_for_timeout(1000)

    # Make sure tab forja is visible
    page.evaluate("document.querySelectorAll('.sheet-tab-content').forEach(el => el.style.setProperty('display', 'none', 'important'));")
    page.evaluate("const f = document.querySelector('.sheet-tab-forja'); if(f) f.style.setProperty('display', 'flex', 'important');")
    page.wait_for_timeout(1000)

    # Take screenshot at the key moment for Player Forja
    page.screenshot(path="/home/jules/verification/screenshots/player_forja.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={"width": 1280, "height": 800}
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()  # MUST close context to save the video
            browser.close()
