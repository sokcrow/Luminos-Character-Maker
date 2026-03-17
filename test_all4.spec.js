const { test, expect } = require('@playwright/test');

test('test queue length directly', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    await page.goto('file://' + __dirname + '/pantalla_dm.html');
    await page.waitForFunction(() => typeof firebase !== 'undefined' && firebase.database);

    await page.evaluate(async () => {
        await firebase.database().ref('campaña/teatro').remove();
    });

    await page.waitForTimeout(500);

    await page.evaluate(async () => {
        await firebase.database().ref('campaña/teatro').set({
            activo: true,
            continuo: true,
            max_sprites: 4,
            log: null,
            cola: null,
            estado_actual: null
        });
        const colaRef = firebase.database().ref('campaña/teatro/cola');
        await colaRef.push({
            nombre: 'Narrador 1',
            mensaje: 'Mensaje de prueba numero 1',
            color_nombre: '#ff0000',
            timestamp: Date.now()
        });
    });

    await page.click('#btn-modo-director');
    await expect(page.locator('#dm-theatre-queue')).toContainText('Narrador 1', { timeout: 10000 });

    const countBefore = await page.evaluate(() => queueItems.length);
    console.log("Before click queue len:", countBefore);

    await page.evaluate(() => {
        document.getElementById('btn-theatre-avanzar').click();
    });

    await page.waitForTimeout(2000);
    const countAfter = await page.evaluate(() => queueItems.length);
    console.log("After click queue len:", countAfter);

    const state = await page.evaluate(() => {
        return new Promise(resolve => {
            firebase.database().ref('campaña/teatro/estado_actual').once('value').then(s => resolve(s.val()));
        });
    });
    console.log("estado_actual:", state);
});
