const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Log console messages
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err));

    await page.goto(`file://${process.cwd()}/index.html`);
    await page.click('#title-screen');
    await page.fill('#player-id-input', 'So');
    await page.click('#btn-login');

    // wait for redirect AND database call
    await page.waitForTimeout(5000);

    console.log("Current URL:", page.url());

    // Check if the DOM updated
    try {
        const cuerpo = await page.textContent('span[name="attr_cuerpo"]');
        console.log("Cuerpo:", cuerpo);

        const transList = await page.textContent('#lista-transacciones-banco');
        console.log("Trans list length:", transList.length);
        console.log("Trans list content:", transList);
    } catch(e) {
        console.log(e.message);
    }

    await browser.close();
})();
