const { test, expect } = require('@playwright/test');

test('test attributes update', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

    // Mock localStorage and wait for init
    await page.addInitScript(() => {
        window.localStorage.setItem('playerId', 'player1');
    });

    await page.goto('file://' + __dirname + '/hoja_personaje.html');

    // Wait for the Firebase mock or real data
    await page.waitForTimeout(1000);

    // Inject data manually to simulate firebase triggering
    await page.evaluate(() => {
        window.renderCharacterSheet({
            characterName: 'Test Name',
            class: 'Test Class',
            race: 'Test Race',
            background: 'Test Background',
            identity: 'Test Identity',
            identity_notes: 'Test Notes',
            level: 5,
            xp: 100,
            xpMissing: 50,
            xpReward: 10,
            rank: 9,
            avatar_url: 'https://example.com/avatar.png'
        });
    });

    // We can then verify the UI values
    await expect(page.locator('input[name="attr_class"]')).toHaveValue('Test Class');
    await expect(page.locator('input[name="attr_race"]')).toHaveValue('Test Race');
    await expect(page.locator('input[name="attr_background"]')).toHaveValue('Test Background');
    await expect(page.locator('input[name="attr_identity"]')).toHaveValue('Test Identity');
    await expect(page.locator('textarea[name="attr_identity_notes"]')).toHaveValue('Test Notes');
    await expect(page.locator('input[name="attr_rank"]')).toHaveValue('9');
    await expect(page.locator('input[name="attr_avatar_url"]')).toHaveValue('https://example.com/avatar.png');
});
