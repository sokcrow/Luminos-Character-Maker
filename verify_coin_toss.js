const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Must setup playerId before navigation so the page doesn't redirect
    await context.addInitScript(() => {
        window.localStorage.setItem('playerId', 'test_player');
    });

    await page.goto(`file://${path.resolve(__dirname, 'hoja_personaje.html')}`);

    // Wait for page to initialize and inject mock DB functions
    await page.evaluate(() => {
        // Setup simple DB mocks
        window.db = {
            ref: (path) => ({
                on: (event, callback) => {
                    if (path.includes('jugadores')) {
                        callback({
                            exists: () => true,
                            val: () => ({
                                characterName: "Test Character",
                                modifiers: { skill_cardio: 5 },
                                combatStats: { sp_actual: 0 }
                            })
                        });
                    } else if (path.includes('actores')) {
                         callback({
                            exists: () => true,
                            val: () => ({
                                "test_actor": { tipo: "Jugador", nombre: "Test Actor" }
                            })
                        });
                    } else {
                        callback({ exists: () => false, val: () => null });
                    }
                },
                once: () => Promise.resolve({ val: () => null }),
                update: () => Promise.resolve(),
                set: () => Promise.resolve(),
                push: () => Promise.resolve()
            })
        };

        // Populate global state used by skills logic
        window.datosJugador = {
            characterName: "Test Character",
            modifiers: { skill_cardio: 5 }, // 5 skill mod
            combatStats: { sp_actual: 0 }
        };
        window.currentPlayerData = window.datosJugador;

        // Trigger initialization
        if (window.renderCharacterSheet) {
            window.renderCharacterSheet(window.datosJugador);
        }
    });

    await page.waitForTimeout(1000); // Give the sheet time to render

    // First go to skills tab
    const skillsTab = page.locator('button[name="act_tab_skills"]');
    if (await skillsTab.isVisible()) {
        await skillsTab.click();
        await page.waitForTimeout(500);
    }

    // Now click the cardio roll button
    // Wait for the panel to show up
    await page.evaluate(() => {
        document.querySelector('button[name="act_roll_skill_cardio"]').click();
    });

    // Wait for the panel to show up
    const tossPanel = page.locator('#coin-toss-panel');
    await tossPanel.waitFor({ state: 'visible' });

    // Ensure coins are generated
    await page.waitForTimeout(1000);

    // Save screenshot
    await page.screenshot({ path: '/home/jules/verification/verification.png' });

    await browser.close();
})();
