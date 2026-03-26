from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Mock Firebase for Player
        page.route("**/firebase-*.js", lambda route: route.fulfill(body="console.log('Firebase mocked');"))
        page.add_init_script("""
            window.firebase = {
                apps: [{name: '[DEFAULT]'}],
                initializeApp: function() { return this; },
                auth: function() {
                    return {
                        onAuthStateChanged: function(cb) {
                            cb({ uid: 'player123' });
                        },
                        currentUser: { uid: 'player123' }
                    };
                },
                database: function() {
                    return {
                        ref: function(path) {
                            return {
                                once: function(event) {
                                    if (path === 'campaña/jugadores') {
                                        return Promise.resolve({
                                            val: () => ({
                                                "TestPlayer": { uid: "player123", status: "approved" }
                                            })
                                        });
                                    }
                                    return Promise.resolve({ val: () => null });
                                },
                                on: function(event, cb) {
                                    if (path === 'campaña/jugadores/TestPlayer') {
                                        cb({
                                            val: () => ({
                                                hp_max: 10, hp_actual: 10,
                                                sp_actual: 5, sp_max: 5,
                                                icono_jugador: "url",
                                                splash_art: "https://via.placeholder.com/600x800.png?text=Splash+Art",
                                                resistencias: { "Cortante": 0.5, "Fuego": 2, "Mental": 1.5 }
                                            })
                                        });
                                    } else if (path === 'campaña/jugadores') {
                                        cb({ val: () => ({ "TestPlayer": { status: "approved" } }) });
                                    } else {
                                        cb({ val: () => null });
                                    }
                                },
                                update: function() { return Promise.resolve(); },
                                set: function() { return Promise.resolve(); },
                                push: function() { return { key: 'newKey' }; }
                            };
                        }
                    };
                }
            };
            localStorage.setItem('playerId', 'TestPlayer');
        """)

        page.goto("file:///app/hoja_personaje.html", wait_until="networkidle")

        # Hide loading overlay
        page.evaluate("() => { if(typeof window.hideLoadingOverlay === 'function') window.hideLoadingOverlay(); else { const el = document.getElementById('system-loading-overlay'); if(el) el.style.display='none'; } }")

        page.wait_for_timeout(1000)

        # Click the Player HUD button
        btn = page.locator('#btn-player-hud')
        if btn.is_visible():
            btn.click()
            page.wait_for_timeout(1000)

            # Take screenshot of the HUD overlay
            hud = page.locator('.limbus-hud-overlay')
            if hud.is_visible():
                hud.screenshot(path="/tmp/player_hud.png")
                print("Player HUD screenshot saved to /tmp/player_hud.png")
            else:
                page.screenshot(path="/tmp/player_full.png")
                print("HUD not visible. Full page screenshot saved to /tmp/player_full.png")
        else:
            page.screenshot(path="/tmp/player_full_nobtn.png")
            print("Button not visible. Full page screenshot saved to /tmp/player_full_nobtn.png")

        browser.close()

if __name__ == "__main__":
    run()
