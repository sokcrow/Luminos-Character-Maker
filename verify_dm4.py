from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Mock Firebase
        page.route("**/firebase-*.js", lambda route: route.fulfill(body="console.log('Firebase mocked');"))
        page.add_init_script("""
            window.firebase = {
                apps: [{name: '[DEFAULT]'}],
                initializeApp: function() { return this; },
                auth: function() {
                    return {
                        onAuthStateChanged: function(cb) {
                            cb({ uid: 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1' });
                        },
                        currentUser: { uid: 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1' }
                    };
                },
                database: function() {
                    return {
                        ref: function(path) {
                            return {
                                on: function(event, cb) {
                                    if (path === 'campaña/estado_mundo') {
                                        cb({ val: () => ({ dia_actual: 1, mes_actual: 'Jan', año_actual: 2024, hora_actual: '12:00' }) });
                                    } else if (path === 'campaña/jugadores') {
                                        cb({ val: () => ({
                                            "TestPlayer": {
                                                status: "approved",
                                                hp_max: 10, hp_actual: 10,
                                                sp_actual: 5, sp_max: 5,
                                                icono_jugador: "url",
                                                splash_art: "url2",
                                                resistencias: { "Cortante": 1, "Fuego": 0.5 }
                                            }
                                        }) });
                                    } else if (path === 'campaña/actores') {
                                        cb({ val: () => ({}) });
                                    } else {
                                        cb({ val: () => null });
                                    }
                                },
                                once: function(event) {
                                    if (path === 'campaña/actores') {
                                        return Promise.resolve({ val: () => ({}) });
                                    }
                                    return Promise.resolve({ val: () => null });
                                },
                                update: function() { return Promise.resolve(); },
                                set: function() { return Promise.resolve(); },
                                push: function() { return { key: 'newKey' }; }
                            };
                        }
                    };
                }
            };
        """)

        page.goto("file:///app/pantalla_dm.html", wait_until="networkidle")

        # Hide loading overlay
        page.evaluate("() => { const el = document.getElementById('system-loading-overlay'); if(el) el.style.display='none'; }")

        # Open the player edit modal
        page.evaluate("() => { if(typeof window.abrirModalEdicionCombateJugador === 'function') window.abrirModalEdicionCombateJugador('TestPlayer', 'TestPlayer', 10, 10, 5, 5, 'url'); }")

        page.wait_for_timeout(1000)

        # Take screenshot of the modal
        modal = page.locator('#dm-combat-modal')
        if modal.is_visible():
            modal.screenshot(path="/tmp/dm_modal4.png")
            print("Modal screenshot saved to /tmp/dm_modal4.png")
        else:
            page.screenshot(path="/tmp/dm_full4.png")
            print("Modal not visible. Full page screenshot saved to /tmp/dm_full4.png")

        browser.close()

if __name__ == "__main__":
    run()
