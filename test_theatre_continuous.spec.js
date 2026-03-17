const { test, expect } = require('@playwright/test');

test.describe('Teatro Continuo', () => {

    test('El Modo Continuo funciona y actualiza el Log', async ({ page }) => {
        // Clear DB for test
        await page.goto('file://' + __dirname + '/pantalla_dm.html');

        // Force clear firebase DB just in case using evaluate
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

        // Activar modo director para que se muestre
        await page.click('#btn-modo-director');

        // Seleccionar modo continuo
        const checkboxContinuo = page.locator('#dm-theatre-continuous');
        await expect(checkboxContinuo).toBeVisible();

        // Enviar 2 mensajes a la cola directamente via evaluate para simular
        await page.waitForFunction(() => typeof firebase !== 'undefined' && firebase.database);
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

        // Verificar cola visual
        await expect(page.locator('#dm-theatre-queue')).toContainText('Narrador 1');
        await expect(page.locator('#dm-theatre-queue')).toContainText('Narrador 2');

        // Apretar "Entrar a Escena" (Avanzar) para procesar el primero
        // Make sure continuous mode is active visually and internally
        await page.locator('#dm-theatre-continuous').check();
        await page.click('#btn-theatre-avanzar');

        // Verificamos el Typewriter del primero
        await expect(page.locator('#theatre-dialogue-text')).toContainText('Mensaje de prueba numero 1', { timeout: 10000 });

        // Verificamos log
        await expect(page.locator('#theatre-log-container')).toContainText('Narrador 1: Mensaje de prueba numero 1');

        // Como está en modo continuo, esperamos ~10-12s y debería haber avanzado solo al Narrador 2.
        await expect(page.locator('#theatre-dialogue-text')).toContainText('Mensaje de prueba numero 2', { timeout: 25000 });
        await expect(page.locator('#theatre-log-container')).toContainText('Narrador 2: Mensaje de prueba numero 2', { timeout: 10000 });

        // Limpiamos test en Firebase
        await page.waitForFunction(() => typeof firebase !== 'undefined' && firebase.database);
        await page.evaluate(async () => {
            await firebase.database().ref('campaña/teatro').remove();
        });
    });

});