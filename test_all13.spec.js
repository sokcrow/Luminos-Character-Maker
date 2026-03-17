const { test, expect } = require('@playwright/test');

test('test advance timeout triggers', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    await page.goto('file://' + __dirname + '/pantalla_dm.html');
    await page.waitForFunction(() => typeof firebase !== 'undefined' && firebase.database);

    await page.evaluate(async () => {
        await firebase.database().ref('campaña/teatro').remove();
    });

    await page.waitForTimeout(500);

    await page.evaluate(async () => {
        // Redefine starting timeout for test to be very short so we don't wait 10s
        window.isTheatreContinuous = true;
        window.iniciarAvanceContinuo = function() {
            console.log("iniciarAvanceContinuo called");
            if (isTheatreContinuous) {
                if (continuousTimeout) clearTimeout(continuousTimeout);
                console.log("Setting timeout");
                continuousTimeout = setTimeout(() => {
                    console.log("Timeout fired, clicking...");
                    const btn = document.getElementById('btn-theatre-avanzar');
                    if (btn) btn.click();
                }, 500); // 0.5s instead of 10s for the test
            }
        };

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
        await colaRef.push({
            nombre: 'Narrador 2',
            mensaje: 'Mensaje de prueba numero 2',
            color_nombre: '#ff0000',
            timestamp: Date.now() + 1000
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

    // Auto advance should trigger Narrador 2
    await page.waitForFunction(() => {
        return document.getElementById('theatre-dialogue-text').textContent.includes('numero 2');
    }, { timeout: 10000 });

    const text = await page.locator('#theatre-dialogue-text').textContent();
    console.log("Final Text:", text);
});
