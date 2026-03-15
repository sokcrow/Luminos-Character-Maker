const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const filePath = path.join(__dirname, 'pantalla_dm.html');
  await page.goto(`file://${filePath}`);

  // Set initial time
  await page.fill('#dm-time-input', '12:00');
  await page.click('#btn-fijar-hora');

  // Wait a bit
  await page.waitForTimeout(500);

  // Read initial time
  let initialTime = await page.inputValue('#dm-time-input');
  console.log(`Initial time set to: ${initialTime}`);

  if (initialTime !== '12:00') {
    console.error('Failed to set initial time');
    process.exit(1);
  }

  // Click the +5 min button
  await page.click('#btn-avanzar-hora');

  // Wait a bit
  await page.waitForTimeout(500);

  // Read updated time
  let updatedTime = await page.inputValue('#dm-time-input');
  console.log(`Updated time is: ${updatedTime}`);

  if (updatedTime === '12:05') {
    console.log('SUCCESS: Time incremented exactly by 5 minutes.');
    await browser.close();
    process.exit(0);
  } else {
    console.error(`ERROR: Expected 12:05 but got ${updatedTime}`);
    await browser.close();
    process.exit(1);
  }
})();
