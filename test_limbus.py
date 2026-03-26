from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content("""
        <html>
        <head>
        <link rel="stylesheet" href="file:///app/hoja_personaje.css">
        </head>
        <body>
<div id="limbus-hud-overlay" class="limbus-hud-overlay" style="display: flex;">
    <div class="limbus-hud-container">
        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; border: 1px solid #D32F2F; pointer-events: none; z-index: 2;"></div>
        <button id="btn-close-limbus-hud" class="btn-close-limbus">CERRAR</button>

        <div class="limbus-left-panel">
            <div class="limbus-splash-container">
                <img id="hud-player-splash" src="https://via.placeholder.com/600x800.png?text=Splash+Art" alt="Splash Art" style="width: 100%; height: 100%; object-fit: cover; object-position: top center; opacity: 0.9;">
            </div>
            <div class="limbus-resistances" id="hud-player-resistances-container">
                <div class="res-item" style="text-align: center;">
                    <div class="res-icon" style="font-size: 24px;">🗡️</div>
                    <div class="res-val" style="font-weight: bold; color: #d8cdb8;">x1</div>
                    <div class="res-name" style="font-size: 10px; color: #a09585; text-transform: uppercase;">Cortante</div>
                </div>
            </div>
        </div>
        <div class="limbus-right-panel">
            <h2 style="color: #FFD700; border-bottom: 1px solid #3E2723; padding-bottom: 10px; font-family: 'Courier New', Courier, monospace; text-transform: uppercase;">Detalles del Pecador</h2>
        </div>
    </div>
</div>
        </body>
        </html>
        """)

        page.wait_for_timeout(1000)
        page.screenshot(path="/tmp/limbus_pure.png")
        print("Pure HTML/CSS screenshot saved.")
        browser.close()

if __name__ == "__main__":
    run()
