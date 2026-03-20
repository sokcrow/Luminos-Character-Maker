const { test, expect } = require("@playwright/test");
const path = require("path");

test("Verify Player HUD elements", async ({ page }) => {
  // We need to inject a playerId to pass the initial check
  await page.addInitScript(() => {
    localStorage.setItem("playerId", "test_player");
  });

  const filePath = `http://localhost:3000/hoja_personaje.html`;
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
          sp_actual: spValue,
        },
      };
      // Explicitly call the render function
      if (window.renderCharacterSheet) {
        window.renderCharacterSheet(window.datosJugador);
      }
    };
  });

  // Verify elements are present first
  const hudToggle = page.locator("#btn-toggle-hud");
  await hudToggle.click(); // ensure HUD is visible

  const hpTrack = page.locator(".hud-hp-track");
  await expect(hpTrack).toBeVisible();

  // Verify background image has svg on the new ekg line element
  const ekgLine = page.locator("#hud-ekg-line");
  await expect(ekgLine).toBeAttached();
  const ekgLineStyle = await ekgLine.evaluate(
    (el) => window.getComputedStyle(el).backgroundImage,
  );
  expect(ekgLineStyle).toContain("data:image/svg+xml");

  const hpBar = page.locator("#hud-hp-bar");
  // It may not be visible in some test runs, so we ensure we wait for it or just check opacity
  const hpBarStyle = await hpBar.evaluate(
    (el) => window.getComputedStyle(el).opacity,
  );
  expect(parseFloat(hpBarStyle)).toBeCloseTo(0.85, 2);

  const spSphere = page.locator("#hud-sp-sphere");
  await expect(spSphere).toBeVisible();

  // Test neutral SP
  await page.evaluate(() => window.injectMockPlayerData(0));
  await expect(spSphere).toHaveClass(/hud-sp-sphere/);
  await expect(spSphere).not.toHaveClass(/sp-extreme-neg/);
  await expect(spSphere).not.toHaveClass(/sp-extreme-pos/);

  // Test Max SP
  await page.evaluate(() => window.injectMockPlayerData(45));
  await expect(spSphere).toHaveClass(/sp-extreme-pos/);
  await expect(spSphere).not.toHaveClass(/sp-extreme-neg/);

  // Test Min SP
  await page.evaluate(() => window.injectMockPlayerData(-45));
  await expect(spSphere).toHaveClass(/sp-extreme-neg/);
  await expect(spSphere).not.toHaveClass(/sp-extreme-pos/);
});
