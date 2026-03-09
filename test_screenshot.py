from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # We use a desktop viewport this time to see more
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()
        page.goto("file:///app/creacion_personaje.html")
        page.evaluate("localStorage.setItem('sok_hasSeenPurpleIntro', 'true');")
        page.goto("file:///app/creacion_personaje.html")

        # Skip to phase 3
        page.evaluate("""
            document.getElementById('phase-intro').classList.add('hidden');
            document.getElementById('phase3').classList.remove('hidden');
            renderProfessions();
        """)

        page.wait_for_selector("#phase3", state="visible")
        page.wait_for_timeout(2000)

        # Let's take a screenshot of just the first card
        card = page.locator(".profession-card").first
        card.screenshot(path="card_screenshot.png")

        # Take a screenshot of the whole page
        page.screenshot(path="full_page_screenshot.png")

        browser.close()

if __name__ == "__main__":
    run()
