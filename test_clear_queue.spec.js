const { test, expect } = require('@playwright/test');

test.describe('Botón Limpiar Cola', () => {

    test('Limpiar cola elimina los elementos', async ({ page }) => {
        await page.goto(`file://${__dirname}/pantalla_dm.html`);

        // We override the firebase function to detect if it was called
        await page.evaluate(() => {
            window.calledRemove = false;
            // Original `db` is already loaded from firebase scripts.
            // We just override the specific function locally without breaking the whole object if possible,
            // or just rely on overriding db for the button. The event listener uses global `db`.
            const originalRef = db.ref;
            db.ref = function(path) {
                if (path === 'campaña/teatro/cola') {
                    const refObj = originalRef.call(db, path);
                    const originalRemove = refObj.remove;
                    refObj.remove = function() {
                        window.calledRemove = true;
                        // Not calling actual remove to avoid touching real DB or mocking it entirely
                        return Promise.resolve();
                    };
                    return refObj;
                }
                return originalRef.call(db, path);
            };
        });

        const btn = page.locator('#btn-clear-queue');
        await btn.waitFor({ state: 'attached', timeout: 5000 });

        page.on('dialog', async dialog => {
            expect(dialog.message()).toBe('¿Estás seguro de que quieres limpiar toda la cola de actuación?');
            await dialog.accept();
        });

        await page.evaluate(() => {
           document.getElementById('btn-clear-queue').click();
        });

        const calledRemove = await page.evaluate(() => window.calledRemove);
        expect(calledRemove).toBe(true);
    });
});
