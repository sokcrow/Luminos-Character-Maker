const { test, expect } = require('@playwright/test');

test('test', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    await page.goto('file://' + __dirname + '/pantalla_dm.html');

    await page.waitForFunction(() => typeof firebase !== 'undefined' && firebase.database);

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
        await colaRef.push({
            nombre: 'Narrador 2',
            mensaje: 'Mensaje de prueba numero 2',
            color_nombre: '#00ff00',
            timestamp: Date.now() + 1000
        });
    });

    await expect(page.locator('#dm-theatre-queue')).toContainText('Narrador 1', { timeout: 10000 });

    await page.locator('#dm-theatre-continuous').check();
    await page.click('#btn-theatre-avanzar');

    console.log("Checking text...");
    await expect(page.locator('#theatre-dialogue-text')).toContainText('Mensaje de prueba numero 1', { timeout: 10000 });
    console.log("Checking log...");
    await expect(page.locator('#theatre-log-container')).toContainText('Narrador 1: Mensaje de prueba numero 1', { timeout: 10000 });

    console.log("Waiting for auto advance...");
    await expect(page.locator('#theatre-dialogue-text')).toContainText('Mensaje de prueba numero 2', { timeout: 25000 });
    await expect(page.locator('#theatre-log-container')).toContainText('Narrador 2: Mensaje de prueba numero 2', { timeout: 10000 });

});
