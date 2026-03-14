const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    console.log('Navigating to index.html...');
    await page.goto('file:///app/index.html');

    console.log('Clicking title screen...');
    await page.click('#title-screen');
    await page.waitForTimeout(1000);

    console.log('Taking screenshot of login modal...');
    await page.screenshot({ path: 'login_modal.png' });

    console.log('Typing ID...');
    await page.fill('#player-id-input', 'TestUser123');
    await page.click('#btn-login');

    await page.waitForTimeout(2000);

    console.log('Taking screenshot after login click...');
    await page.screenshot({ path: 'after_login.png' });

    const url = page.url();
    console.log('Current URL after login:', url);

    await browser.close();
})();
