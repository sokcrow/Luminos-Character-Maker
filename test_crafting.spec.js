const { test, expect } = require('@playwright/test');

test('Test crafting page loads without syntax errors', async ({ page }) => {
    let errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.addInitScript(() => {
        window.localStorage.setItem('playerId', 'TestPlayer');
        // Define missing variables expected on load
        window.db = { ref: () => ({ on: () => {} }) };
        window.dbItemsCacheGlobal = {};
    });

    await page.goto('file://' + __dirname + '/hoja_personaje.html');

    console.log("Errors: ", errors);
    // Just check if the file load and parsed JS without throwing syntax errors
    expect(errors.length).toBe(0);
});
