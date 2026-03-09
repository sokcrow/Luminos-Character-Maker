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

        # Skip to phase 3 by directly simulating the end of phase 2 and purple intro
        page.evaluate("""
            window.startDialogue3 = function() {
                document.getElementById('phase-purple-intervention').classList.add('hidden');
                document.getElementById('phase3').classList.remove('hidden');
                // The function is bound to the module
                // We'll extract renderProfessions and run it.
            };
        """)

        # Click through phase intro
        page.wait_for_selector("#phase-intro", state="visible")
        for _ in range(5):
            page.click("#phase-intro")
            page.wait_for_timeout(100)
        page.type("#character-name-input", "Test")
        page.click("#confirm-name-btn")
        page.wait_for_timeout(100)
        page.click("#phase-intro")
        page.wait_for_timeout(100)
        page.click("#phase-intro")
        page.wait_for_timeout(2000)

        # We should be in Phase 1
        page.wait_for_selector("#phase1", state="visible")
        # Just to jump to phase 3 quickly... actually let's just edit HTML

        browser.close()

if __name__ == "__main__":
    run()
