const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Check if the issue is because we rerender the whole page on player updates!
    await page.addInitScript(() => {
        window.localStorage.setItem('playerId', 'testplayer');

        let updateCount = 0;

        window.dbMock = {
            callbacks: {},
            ref: function(path) {
                const self = this;
                return {
                    on: function(event, callback) {
                        self.callbacks[path] = self.callbacks[path] || [];
                        self.callbacks[path].push(callback);

                        if (path === 'campaña/jugadores/testplayer') {
                            callback({ exists: () => true, val: () => ({
                                characterName: 'Test Name',
                                activeActor: 'base',
                                actorId: null,
                                baseStats: { cuerpo: 1, mente: 1, alma: 1 }
                            }) });
                        } else if (path === 'campaña/actores') {
                            callback({ exists: () => true, val: () => ({
                                actor1: { tipo: 'Jugador', nombre: 'Actor 1', expresiones: [] },
                                actor2: { tipo: 'Jugador', nombre: 'Actor 2', expresiones: [] }
                            })});
                        }
                    },
                    once: async function(event) {
                        return { exists: () => true, val: () => ({}) };
                    },
                    update: async function(data) {
                        console.log("Mock update called for path:", path, "with data:", data);

                        if (path === 'campaña/jugadores/testplayer') {
                            updateCount++;
                            // Trigger callback synchronously as real firebase would
                            const updatedData = {
                                characterName: 'Test Name',
                                baseStats: { cuerpo: 1, mente: 1, alma: 1 },
                                ...data
                            };

                            setTimeout(() => {
                                if (self.callbacks[path]) {
                                    self.callbacks[path].forEach(cb => cb({ exists: () => true, val: () => updatedData }));
                                }
                            }, 50);
                        }
                    },
                    push: async function(data) {
                        return { key: 'newKey' };
                    }
                };
            }
        };

        window.db = window.dbMock;
        window.firebase = {
            initializeApp: () => ({
                database: () => window.dbMock
            }),
            database: () => window.dbMock
        };
    });

    await page.goto('file://' + process.cwd() + '/hoja_personaje.html', { waitUntil: 'load' });

    await page.waitForTimeout(1000);

    // Let's trigger actor select change directly
    console.log("Changing actor select using JS Event Dispatch");

    await page.evaluate(() => {
        const select = document.getElementById('player-actor-select');
        select.value = 'actor1';
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.waitForTimeout(500);

    // Check if input is disabled and its current text
    const disabled = await page.evaluate(() => document.getElementById('player-theatre-input').disabled);
    console.log("Input disabled?", disabled);

    await browser.close();
})();
