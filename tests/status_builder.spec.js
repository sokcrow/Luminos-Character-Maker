const { test, expect } = require('@playwright/test');

test('Status builder UI flow (Purged)', async ({ page }) => {
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
    await page.waitForSelector('#tab-btn-status');
    await page.click('#tab-btn-status');

    await page.evaluate(() => {
        loadStatusIntoBuilder('test_id', { name: 'Test Status', icon: '' });
    });

    const idInput = page.locator('#sb-status-id');
    await expect(idInput).toBeDisabled();
    await expect(idInput).toHaveValue('test_id');

    const nameInput = page.locator('#sb-status-name');
    await expect(nameInput).toBeDisabled();
    await expect(nameInput).toHaveValue('Test Status');

    await page.fill('#sb-status-icon', 'https://imgur.com/test.png');

    page.on('dialog', dialog => dialog.accept());
    await page.click('#btnSaveStatus');

    await page.waitForTimeout(500);

    expect(hasErrors).toBe(false);
});
