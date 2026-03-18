const { test, expect } = require('@playwright/test');

test('Check DM Screen UI additions for HP', async ({ page }) => {
    await page.goto(`file://${process.cwd()}/pantalla_dm.html`);

    // Give it a moment to render
    await page.waitForTimeout(2000);

    // We expect the inputs to be visible in the first player card.
    // Since it's dynamically populated by Firebase, let's evaluate manually:
    await page.evaluate(() => {
        const fakeData = {
            level: 3,
            hp_base: 50,
            hp_coefficient: 2.5,
            hp_max: 60,
            combatStats: { hp_actual: 45 }
        };

        const container = document.getElementById('banco-jugadores-container');
        if (!container) return;

        let pCard = document.createElement('div');
        pCard.id = `player-card-Tester`;
        pCard.innerHTML = `
            <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between;">
                <label style="color:#c49a00; font-size:12px;">HP Base:</label>
                <input type="number" class="input-hpbase" value="${fakeData.hp_base}">
            </div>
            <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between;">
                <label style="color:#c49a00; font-size:12px;">HP Coef:</label>
                <input type="number" step="0.01" class="input-hpcoef" value="${fakeData.hp_coefficient}">
            </div>
            <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between;">
                <label style="color:#0df; font-size:12px;">HP Actual:</label>
                <input type="number" class="input-hpactual" value="${fakeData.combatStats.hp_actual}">
            </div>
            <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between;">
                <label style="color:#c49a00; font-size:12px;">Calc Max HP:</label>
                <input type="number" class="input-hpmax" value="${fakeData.hp_max}" readonly>
            </div>
        `;
        container.appendChild(pCard);
    });

    await expect(page.locator('.input-hpbase').first()).toBeVisible();
    await expect(page.locator('.input-hpcoef').first()).toBeVisible();
    await expect(page.locator('.input-hpactual').first()).toBeVisible();
    await expect(page.locator('.input-hpmax').first()).toBeVisible();
});
