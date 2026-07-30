const { test, expect } = require('@playwright/test');

test('Status builder UI flow', async ({ page }) => {
    let hasErrors = false;
    page.on('pageerror', exception => {
        if (exception.message.includes('PERMISSION_DENIED')) return;
        console.error(`Uncaught exception: "${exception}"`);
        hasErrors = true;
    });
    page.on('console', msg => {
        if (msg.type() === 'error') {
            if (msg.text().includes('PERMISSION_DENIED')) return;
            console.error(`Console error: "${msg.text()}"`);
            hasErrors = true;
        }
    });

    await page.goto(`file://${process.cwd()}/dm-combat-creator.html`);
    // Wait for the tab to be available before clicking
    await page.waitForSelector('#tab-btn-status');
    await page.click('#tab-btn-status');

    await page.click('#btn-start-status-builder');

    await page.fill('#sb-status-name', 'Test Status');
    await page.fill('#sb-status-desc', 'A test status description.');
    await page.check('input[name="sb-status-mode"][value="double"]');
    await page.check('input[name="sb-status-tag"][value="positive"]');
    await page.check('input[name="sb-status-decay"][value="on_hit_dealt"]');
    await page.fill('#sb-status-base-value', '5');
    await page.fill('#sb-status-max-value', '10');

    page.on('dialog', dialog => dialog.accept());
    await page.click('#btnSaveStatus');

    await page.waitForTimeout(500);

    expect(hasErrors).toBe(false);
});
