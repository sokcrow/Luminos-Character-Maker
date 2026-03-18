const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.addInitScript(() => {
    window.localStorage.setItem('playerId', 'test_player_1');
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('PAGE ERROR LOG:', msg.text(), msg.location());
    }
  });
  page.on('pageerror', err => {
    console.log('PAGE UNCAUGHT ERROR:', err.message);
    console.log(err.stack);
  });

  await page.goto(`file://${__dirname}/hoja_personaje.html`);
  await page.waitForTimeout(2000);
  await browser.close();
})();
