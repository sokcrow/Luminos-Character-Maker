const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 375, height: 812 }
  });
  await page.goto('http://localhost:3000/hoja_personaje.html');
  // wait for it to render
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshot.png' });
  await browser.close();
})();
