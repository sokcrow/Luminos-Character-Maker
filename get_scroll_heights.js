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

  // Check heights of elements
  const heights = await page.evaluate(() => {
    return {
      window: { innerHeight: window.innerHeight },
      wrapper: {
        el: '.sheet-phone-wrapper',
        height: document.querySelector('.sheet-phone-wrapper').clientHeight,
        scrollHeight: document.querySelector('.sheet-phone-wrapper').scrollHeight
      },
      screen: {
        el: '.sheet-phone-screen',
        height: document.querySelector('.sheet-phone-screen').clientHeight,
        scrollHeight: document.querySelector('.sheet-phone-screen').scrollHeight
      },
      tabStats: {
        el: '.sheet-tab-stats',
        height: document.querySelector('.sheet-tab-stats').clientHeight,
        scrollHeight: document.querySelector('.sheet-tab-stats').scrollHeight
      }
    };
  });
  console.log(heights);
  await browser.close();
})();
