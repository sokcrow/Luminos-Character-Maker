const { test, expect } = require('@playwright/test');
const path = require('path');

test('Verify Player HUD elements', async ({ page }) => {
  // We need to inject a playerId to pass the initial check
  await page.addInitScript(() => {
    localStorage.setItem('playerId', 'test_player');
  });

  const filePath = `file://${path.resolve(__dirname, '../hoja_personaje.html')}`;
  await page.goto(filePath);

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

  // Verify elements are present first
  const hudToggle = page.locator('#btn-toggle-hud');
  await hudToggle.click(); // ensure HUD is visible

  const hpTrack = page.locator('.hp-track').first();
  await expect(hpTrack).toBeAttached();

  const spSphere = page.locator('.sp-sphere');
  await expect(spSphere).toBeVisible();

  // Test neutral SP
  await page.evaluate(() => window.injectMockPlayerData(0));
  await expect(spSphere).toHaveClass(/sp-sphere/);
  await expect(spSphere).not.toHaveClass(/sp-extreme-neg/);
  await expect(spSphere).not.toHaveClass(/sp-extreme-pos/);

});