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
    console.log("Changing actor select using actual page.selectOption()");

    // Just click it using Playwright
    await page.selectOption('#player-actor-select', 'actor1');

    await page.waitForTimeout(500);

    console.log("Typing in input after change");
    try {
        await page.focus('#player-theatre-input');
        await page.keyboard.type('Hello', { delay: 50 });
        const val2 = await page.inputValue('#player-theatre-input');
        console.log("Input value after change:", val2);

        // Wait another bit and type
        await page.waitForTimeout(1000);
        await page.keyboard.type(' world!', { delay: 50 });
        const val3 = await page.inputValue('#player-theatre-input');
        console.log("Input value final:", val3);
    } catch (e) {
        console.error("Failed to type after change:", e);
    }

    await browser.close();
})();
