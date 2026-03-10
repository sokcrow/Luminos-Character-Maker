const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 1000 });
  await page.goto('http://localhost:3000/hoja_personaje.html');
  await page.waitForTimeout(1000);

  // Click stats to see scroll
  await page.click('button[name="act_tab_stats"]');
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'screenshot_stats_current.png' });

  // Try to scroll down
  await page.mouse.wheel(0, 1000);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshot_stats_scrolled.png' });

  await browser.close();
})();
