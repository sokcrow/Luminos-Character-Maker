const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 375, height: 812 }
  });
  await page.goto('http://localhost:3000/hoja_personaje.html');
  await page.waitForTimeout(1000);

  // Click on Stats app
  await page.click('button[name="act_tab_stats"]');
  await page.waitForTimeout(1000);

  // Focus on stats tab
  await page.click('.sheet-tab-stats');

  // Attempt to scroll to the very bottom via keys
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'screenshot_pagedown.png' });
  await browser.close();
})();
