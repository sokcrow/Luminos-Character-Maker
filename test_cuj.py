from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:3000/hoja_personaje.html")
    page.wait_for_timeout(2000)
    page.screenshot(path="/home/jules/verification/screenshots/verification5.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(record_video_dir="/home/jules/verification/videos")
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
