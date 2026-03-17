const { test, expect } = require('@playwright/test');
const path = require('path');

test('Equip UI renders', async ({ page }) => {
    const fileUrl = `file://${path.join(process.cwd(), 'hoja_personaje.html')}`;
    await page.addInitScript(() => {
        window.localStorage.setItem('playerId', 'TestPlayer');
    });

    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Open inventory
    await page.click('#btn-global-inventory');

    // Check if Equip tab exists (it won't initially, this will fail or timeout, which is expected before changes)
    const equipTab = page.locator('.inv-tab-btn[data-tab="inv-equip"]');
    await expect(equipTab).toBeVisible();

    await equipTab.click();
    await expect(page.locator('#inv-equip')).toBeVisible();

    // Verify slots exist
    await expect(page.locator('#equip-slot-torso')).toBeVisible();
    await expect(page.locator('#equip-slot-mainhand')).toBeVisible();
    await expect(page.locator('#equip-slot-offhand')).toBeVisible();
    await expect(page.locator('#equip-slot-acc1')).toBeVisible();
});
