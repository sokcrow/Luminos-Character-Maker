from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Intercept and block Firebase scripts to mock window.firebase
        def route_handler(route):
            route.fulfill(status=200, content_type="application/javascript", body="""
                window.firebase = {
                    initializeApp: function() {},
                    auth: function() {
                        return {
                            onAuthStateChanged: function(cb) {
                                cb({ uid: 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1' });
                                return function() {};
                            }
                        };
                    },
                    database: function() {
                        return {
                            ref: function(path) {
                                return {
                                    on: function(event, cb) {
                                        if (path === 'campaña/teatro/log') {
                                            cb({
                                                val: function() {
                                                    return {
                                                        "msg1": { "actor": "bolt", "mensaje": "Bolt Optimization Log Message 1" },
                                                        "msg2": { "actor": "jules", "mensaje": "Bolt Optimization Log Message 2" }
                                                    };
                                                }
                                            });
                                        } else if (path === 'campaña/actores') {
                                            cb({
                                                val: function() {
                                                    return {
                                                        "actor1": { "nombre": "Bolt", "icono": "bolt.png" },
                                                        "actor2": { "nombre": "Jules", "icono": "jules.png" }
                                                    };
                                                }
                                            });
                                        }
                                    },
                                    update: function() { return Promise.resolve(); },
                                    remove: function() { return Promise.resolve(); }
                                };
                            }
                        };
                    }
                };
            """)

        page.route("**/*firebase*", route_handler)

        page.goto("file:///app/pantalla_dm.html")

        # Hide loading overlay and show the log
        page.evaluate("""
            window.hideLoadingOverlay = function() {
                var overlay = document.getElementById('system-loading-overlay');
                if (overlay) overlay.style.display = 'none';
            };
            window.hideLoadingOverlay();

            var logContainer = document.getElementById('theatre-log-container');
            if (logContainer) {
                logContainer.style.setProperty('display', 'flex', 'important');
                logContainer.style.setProperty('visibility', 'visible', 'important');
                logContainer.style.setProperty('opacity', '1', 'important');
                logContainer.style.setProperty('z-index', '999999', 'important');
                logContainer.classList.add('open');
            }
        """)

        page.wait_for_timeout(2000)

        page.screenshot(path="/home/jules/verification/verification.png")
        print("Screenshot saved to /home/jules/verification/verification.png")
        browser.close()

if __name__ == "__main__":
    run()
