const { test, expect } = require('@playwright/test');

test('Combat HUD toggle and data rendering', async ({ page }) => {
    // Inject playerId to bypass redirects
    await page.addInitScript(() => {
        window.localStorage.setItem('playerId', 'test-player');
    });

    await page.goto(`file://${process.cwd()}/hoja_personaje.html`);

    // Mock Firebase data for renderCharacterSheet
    await page.evaluate(() => {
        window.renderCharacterSheet({
            characterName: 'Tester',
            combatStats: {
                hp_max: 100,
                hp_actual: 25,
                sp_actual: -10
            }
        });
    });

    // Check button exists
    const btn = page.locator('#btn-toggle-hud');
    await expect(btn).toBeVisible();

    // HUD should be hidden initially
    const hud = page.locator('#player-combat-hud');
    await expect(hud).toHaveCSS('display', 'none');

    // Click button to show HUD
    await btn.click();
    await expect(hud).toHaveCSS('display', 'flex');
    await expect(btn).toHaveText('[-] OCULTAR VITALES');

    // Check rendered values
    await expect(page.locator('#hud-hp-actual')).toHaveText('25');
    await expect(page.locator('#hud-hp-max')).toHaveText('100');

    // Since HP is 25 <= 30%, it should have the danger class
    const hpBar = page.locator('#hud-hp-bar');
    await expect(hpBar).toHaveClass(/hp-danger/);
    await expect(hpBar).toHaveCSS('width', '70px'); // 25% of 280px container, though exact px might vary depending on padding, let's just check the style property directly if possible, or skip exact px assert.

    // SP should be -10, red color
    const spText = page.locator('#hud-sp-text');
    await expect(spText).toHaveText('-10');
    await expect(spText).toHaveCSS('color', 'rgb(255, 68, 68)'); // #ff4444

    // Coin chance should be 50 - 10 = 40%
    const coinText = page.locator('#hud-coin-text');
    await expect(coinText).toHaveText('40%');
    await expect(coinText).toHaveCSS('color', 'rgb(255, 68, 68)'); // #ff4444

    // Second mock to test positive SP and safe HP
    await page.evaluate(() => {
        window.renderCharacterSheet({
            combatStats: {
                hp_max: 100,
                hp_actual: 80,
                sp_actual: 20
            }
        });
    });

    // Check new values
    await expect(page.locator('#hud-hp-actual')).toHaveText('80');
    await expect(hpBar).not.toHaveClass(/hp-danger/);

    await expect(spText).toHaveText('+20');
    await expect(spText).toHaveCSS('color', 'rgb(0, 255, 255)'); // #00ffff

    await expect(coinText).toHaveText('70%');
    await expect(coinText).toHaveCSS('color', 'rgb(0, 255, 255)');

    // Click button to hide HUD
    await btn.click();
    await expect(hud).toHaveCSS('display', 'none');
    await expect(btn).toHaveText('[+] REVISAR VITALES');
});
