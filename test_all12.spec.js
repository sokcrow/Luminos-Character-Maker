const { test, expect } = require('@playwright/test');

test('test advance inner', async ({ page }) => {
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

    await page.evaluate(() => {
        document.getElementById('btn-theatre-avanzar').click();
    });

    await page.waitForFunction(() => {
        return document.getElementById('theatre-dialogue-text').textContent.includes('numero 1');
    }, { timeout: 10000 });

    const text = await page.locator('#theatre-dialogue-text').textContent();
    console.log("Current Text after click:", text);
});
