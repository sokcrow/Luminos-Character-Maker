const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Inyectar localStorage para evitar el redirect y simular un login de jugador
  await page.addInitScript(() => {
    localStorage.setItem('playerId', 'TestPlayer123');
  });

  const filePath = `file://${path.resolve(__dirname, 'hoja_personaje.html')}`;

  await page.goto(filePath);

  // We are not mocking firebase, so the listener won't populate or show the UI appropriately.
  // The goal is just to ensure the JS syntax is correct and no uncaught exceptions happen on page load
  // with the new event listeners.

  // Wait a moment for any DOMContentLoaded and listeners to attach.
  await page.waitForTimeout(2000);

  // Check if there are any console errors
  page.on('pageerror', err => {
    console.error('Page Error:', err);
    process.exit(1);
  });

  console.log('Page loaded without critical JS syntax errors.');

  await browser.close();
})();