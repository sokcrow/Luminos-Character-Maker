const { test, expect } = require('@playwright/test');
const path = require('path');

test('Verify Player HUD elements', async ({ page }) => {
  const filePath = `file:///app/hoja_personaje.html`;

  // Block real Firebase and mock it BEFORE navigation
  await page.route('**/firebase-app.js', route => route.fulfill({ status: 200, body: 'window.firebase = { apps: [] };' }));
  await page.route('**/firebase-auth.js', route => route.fulfill({ status: 200, body: '' }));
  await page.route('**/firebase-database.js', route => route.fulfill({ status: 200, body: '' }));

  await page.addInitScript(() => {
    window.firebase = {
      initializeApp: () => {},
      auth: () => ({
        onAuthStateChanged: (cb) => {
          // Instantly login to prevent redirect
          localStorage.setItem('playerId', 'Test Character');
          cb({ uid: 'test_player' });
        },
        signOut: () => Promise.resolve()
      }),
      database: () => ({
        ref: () => ({
          on: () => {},
          once: () => Promise.resolve({ exists: () => true, val: () => ({}) }),
          update: () => Promise.resolve(),
          push: () => Promise.resolve(),
          set: () => Promise.resolve()
        })
      }),
      apps: [{}]
    };
  });

  await page.goto(filePath);
  await page.evaluate(() => { const el = document.getElementById('system-loading-overlay'); if (el) el.remove(); });

  // Mock Firebase data to trigger renderCharacterSheet with specific SP values
  await page.evaluate(() => {
    // Expose a way to inject mock data
    window.injectMockPlayerData = (spValue) => {
        window.datosJugador = {
            characterName: "Test Character",
            combatStats: {
                hp_actual: 50,
                hp_max: 100,
                sp_actual: spValue
            }
        };
        // Explicitly call the render function
        if (window.renderCharacterSheet) {
            window.renderCharacterSheet(window.datosJugador);
        }
    };
  });

  // Inject player data so that the HUD is shown
  await page.evaluate(() => window.injectMockPlayerData(0));

  // Verify elements are present first
  const hudToggle = page.locator('#btn-toggle-hud');
  await hudToggle.click(); // ensure HUD is visible

  const hpTrack = page.locator('.hp-track').first();
  await expect(hpTrack).toBeAttached();

  const spSphere = page.locator('.sp-sphere');
  await expect(spSphere).toBeAttached();

  // Test neutral SP
  await expect(spSphere).toHaveClass(/sp-sphere/);
  await expect(spSphere).not.toHaveClass(/sp-extreme-neg/);
  await expect(spSphere).not.toHaveClass(/sp-extreme-pos/);

  // Take screenshot for visual verification
  await page.screenshot({ path: '/home/jules/verification/verification.png', fullPage: true });

});