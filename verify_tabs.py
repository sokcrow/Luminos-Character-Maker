from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto('file:///app/pantalla_dm.html')

        page.screenshot(path='tabs_initial.png')
        print("Initial screenshot taken.")

        # Click on Botin tab
        page.click('button[data-tab="tab-loot"]')
        page.screenshot(path='tabs_loot.png')
        print("Botin tab screenshot taken.")

        # Click Modo Director
        page.click('#btn-modo-director')
        page.screenshot(path='tabs_modo_director.png')
        print("Modo Director screenshot taken.")

        browser.close()

if __name__ == '__main__':
    run()
