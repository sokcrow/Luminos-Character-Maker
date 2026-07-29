const { test, expect } = require('@playwright/test');

test('Skill builder UI flow', async ({ page }) => {
    // 1. Iniciar manejadores para atrapar errores y romper la prueba si ocurre uno
    let hasErrors = false;
    page.on('pageerror', exception => {
        if (exception.message.includes('PERMISSION_DENIED')) {
            console.log('Ignorando error de permisos de Firebase (esperado en test)');
            return;
        }
        console.error(`Uncaught exception: "${exception}"`);
        hasErrors = true;
    });
    page.on('console', msg => {
        if (msg.type() === 'error') {
            if (msg.text().includes('PERMISSION_DENIED')) {
                console.log('Ignorando console error de permisos de Firebase');
                return;
            }
            console.error(`Console error: "${msg.text()}"`);
            hasErrors = true;
        }
    });

    // 2. Navegar a la página y cambiar de tab
    await page.goto(`file://${process.cwd()}/dm-combat-creator.html`);
    await page.click('#tab-btn-skills');

    // 3. Iniciar Constructor de Skills
    await page.click('#btn-start-skill-builder');

    // 1. Clic en los selectores visuales (Heptágono de Pecado y Tipo de Daño).
    await page.click('label[for="sin-wrath"]');
    await page.click('label[for="dmg-cortante"]');

    // 2. Llenado del nombre de habilidad en sb-name.
    await page.fill('#sb-name', 'Test Skill 1');

    // 3. Clic secuencial para agregar 3 monedas.
    const coinCountInput = page.locator('#sb-coin-count');
    await coinCountInput.fill('3');
    // Despachar el evento input para generar el DOM (ya que fill puede no dispararlo igual que el usuario)
    await coinCountInput.dispatchEvent('input');

    // Verificar que se agregaron 3 contenedores
    const coinBlocks = page.locator('.sb-coin-block');
    await expect(coinBlocks).toHaveCount(3);

    // 4. Clic en el botón de activadores de la primera y última moneda para abrir sus selectores de estado.
    // Agregar efecto a la moneda 1
    const coin1Btn = coinBlocks.nth(0).locator('.sb-btn-add-coin-effect');
    await coin1Btn.click();

    // Verificar que el efecto se agregó a la moneda 1
    const effect1 = coinBlocks.nth(0).locator('.effect-row');
    await expect(effect1).toHaveCount(1);

    // Interactuar con selectores del efecto 1
    await effect1.locator('.eff-trigger').selectOption('[Heads]');
    await effect1.locator('.eff-target').selectOption('self');
    await effect1.locator('.eff-potency').fill('2');

    // Agregar efecto a la moneda 3 (última moneda)
    const coin3Btn = coinBlocks.nth(2).locator('.sb-btn-add-coin-effect');
    await coin3Btn.click();

    // Verificar que el efecto se agregó a la moneda 3
    const effect3 = coinBlocks.nth(2).locator('.effect-row');
    await expect(effect3).toHaveCount(1);

    // Interactuar con selectores del efecto 3
    await effect3.locator('.eff-trigger').selectOption('[On Hit]');
    await effect3.locator('.eff-target').selectOption('target');
    // .eff-status is now a hidden input, select by clicking custom UI
    await effect3.locator('.eff-status-btn').click();
    await effect3.locator('.status-list-item[title="Bleed"]').click();

    // 5. Clic en [ GUARDAR HABILIDAD EN DB ].
    // Evitamos el alert/redirección en el guardado que podría romper la prueba de playwright, escuchamos la alerta de firebase mock
    // Ya que usamos db mockeada no podremos grabar, pero podemos darle clic al boton de guardar y ver si detona un error sincrono de nuestro codigo.
    page.on('dialog', dialog => dialog.accept());
    await page.click('#save-skill-db-btn');

    // Esperar un momento para ver si algo estalla de asincronía (aunque el test es de frontend, hay promesas de firebase)
    await page.waitForTimeout(500);

    expect(hasErrors).toBe(false);
});
