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

  // Check overflow properties
  const overflowProps = await page.evaluate(() => {
    return {
      body: window.getComputedStyle(document.body).overflow,
      html: window.getComputedStyle(document.documentElement).overflow,
      wrapper: window.getComputedStyle(document.querySelector('.sheet-phone-wrapper')).overflow,
      screen: window.getComputedStyle(document.querySelector('.sheet-phone-screen')).overflow,
      tabStats: window.getComputedStyle(document.querySelector('.sheet-tab-stats')).overflow,
    };
  });
  console.log(overflowProps);

  // Attempt to scroll body
  await page.evaluate(() => {
    window.scrollTo(0, 500);
  });
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'screenshot_scrolled_window500.png' });
  await browser.close();
})();
