const { test, expect } = require('@playwright/test');

test('Test crafting page loads without syntax errors', async ({ page }) => {
    let errors = [];
    page.on('pageerror', error => errors.push(error.message));

    // Serve locally or just load the file
    await page.goto('file://' + __dirname + '/hoja_personaje.html');

    // We mock localStorage so it thinks it has a player
    await page.evaluate(() => {
        localStorage.setItem('playerId', 'TestPlayer');
    });

    await page.reload();

    // Just check if the file load and parsed JS without throwing syntax errors
    expect(errors.length).toBe(0);
});
