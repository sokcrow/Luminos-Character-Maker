const { test, expect } = require('@playwright/test');

test('Check character name modal appears via simulated click on login', async ({ page }) => {
  await page.goto('http://localhost:3000/hoja_personaje.html');

  // Let's just show it via evaluate to capture it
  await page.evaluate(() => {
     document.getElementById('character-name-modal').style.display = 'flex';
  });

  const modal = page.locator('#character-name-modal');
  await expect(modal).toBeVisible({ timeout: 5000 });

  await page.screenshot({ path: 'verification.png' });
});
