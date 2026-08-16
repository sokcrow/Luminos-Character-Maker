const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Intercept firebase scripts
  await page.route('**/*firebase*.js', route => route.fulfill({ body: '' }));

  await page.goto('file://' + process.cwd() + '/hoja_personaje.html');

  // Hide auth blocker and show modal
  await page.evaluate(() => {
    document.getElementById('auth-blocker').style.display = 'none';
    const modal = document.getElementById('modal-escritura-teatro');
    if (modal) {
      modal.style.display = 'flex';
      modal.style.opacity = '1';
      modal.style.visibility = 'visible';
    }
  });

  // Wait a moment for styles
  await page.waitForTimeout(1000);

  await page.screenshot({ path: '/home/jules/verification/screenshots/modal2.png' });
  await browser.close();
})();
