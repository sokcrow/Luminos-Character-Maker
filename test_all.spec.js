const { test, expect } = require('@playwright/test');

test('test', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    await page.goto('file://' + __dirname + '/pantalla_dm.html');

    await page.waitForFunction(() => typeof firebase !== 'undefined' && firebase.database);

    // clean everything up
    await page.evaluate(async () => {
        await firebase.database().ref('campaña/teatro').remove();
    });

    // Need to let it sync
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
    });

    await page.click('#btn-modo-director');
    await expect(page.locator('#dm-theatre-continuous')).toBeVisible();

    await page.evaluate(async () => {
        const colaRef = firebase.database().ref('campaña/teatro/cola');
        await colaRef.push({
            nombre: 'Narrador 1',
            mensaje: 'Mensaje de prueba numero 1',
            color_nombre: '#ff0000',
            timestamp: Date.now()
        });
    });

    await expect(page.locator('#dm-theatre-queue')).toContainText('Narrador 1', { timeout: 10000 });

    await page.locator('#dm-theatre-continuous').check();

    await page.click('#btn-theatre-avanzar');

    await expect(page.locator('#theatre-dialogue-text')).toContainText('Mensaje de prueba numero 1', { timeout: 5000 });

});
