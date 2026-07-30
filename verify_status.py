from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto(f"file://{__import__('os').getcwd()}/dm-combat-creator.html")
    page.wait_for_timeout(500)

    # Show module
    page.evaluate("document.getElementById('module-status').style.display = 'flex';")
    page.evaluate("document.getElementById('status-builder-container').style.display = 'block';")
    page.wait_for_timeout(500)

    # Fill basic details
    page.fill('#sb-status-id', 'test_tremor')
    page.fill('#sb-status-name', 'Test Tremor')
    page.select_option('#sb-status-mode', 'double')
    page.select_option('#sb-status-tag', 'negative')
    page.wait_for_timeout(500)

    # Add rules
    page.click('button:has-text("[ + AÑADIR REGLA ]")')
    page.wait_for_timeout(500)

    # Configure Rule 1
    blocks = page.locator('.sb-rule-block')
    rule1 = blocks.nth(0)
    rule1.locator('.rule-trigger').select_option('on_tremor_burst')
    rule1.locator('.rule-cond-type').select_option('potency')
    rule1.locator('.rule-operation').select_option('add')
    rule1.locator('.rule-affectation').select_option('stagger_threshold')
    rule1.locator('.rule-decay').select_option('sub_count_1')
    page.wait_for_timeout(500)

    # Take screenshot at the key moment
    page.screenshot(path="/home/jules/verification/screenshots/verification2.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
