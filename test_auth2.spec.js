const { test, expect } = require('@playwright/test');

test('Check character name modal appears via normal DOM loading', async ({ page }) => {
  await page.goto('http://localhost:3000/hoja_personaje.html');

  // Simply execute JS to show it, the logic is purely frontend JS that we altered
  // Let's actually test if the JS we wrote works
  await page.evaluate(() => {
     localStorage.removeItem('playerId');
     // trigger the auth state changed logic manually
     auth.onAuthStateChanged({ uid: 'mock', email: 'test@test.com' });
  });

  const modal = page.locator('#character-name-modal');
  await expect(modal).toBeVisible({ timeout: 5000 });

  await page.screenshot({ path: 'verification.png' });
});
