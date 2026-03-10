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

  // Attempt to scroll the app body
  await page.evaluate(() => {
    const els = document.querySelectorAll('.sheet-app-body');
    for (const el of els) {
      el.scrollTop = el.scrollHeight;
    }
    const elsScroll = document.querySelectorAll('.sheet-app-body-scroll');
    for (const el of elsScroll) {
      el.scrollTop = el.scrollHeight;
    }
  });
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'screenshot_scrolled_body.png' });
  await browser.close();
})();
