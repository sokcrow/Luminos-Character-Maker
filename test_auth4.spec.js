const { test, expect } = require('@playwright/test');

test('Check character name modal appears via normal DOM loading', async ({ page }) => {
  await page.goto('http://localhost:3000/hoja_personaje.html');

  // Wait for the modal to be visible after the JS triggers
  const modal = page.locator('#character-name-modal');
  await expect(modal).toBeVisible({ timeout: 5000 });

  await page.screenshot({ path: 'verification.png' });
});
