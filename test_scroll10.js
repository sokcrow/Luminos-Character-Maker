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

  // Focus and attempt to scroll down more
  await page.evaluate(() => {
    const el = document.querySelector('.sheet-tab-stats');
    if (el) el.scrollTop = 1000;
  });
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'screenshot_scrolled_tabstats1000.png' });
  await browser.close();
})();
