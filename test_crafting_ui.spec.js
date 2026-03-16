const { test, expect } = require('@playwright/test');
const path = require('path');

test('Crafting Search and Slots Work Correctly', async ({ page }) => {
    // Navigate to the local file
    const fileUrl = `file://${path.join(process.cwd(), 'hoja_personaje.html')}`;

    // Setup before page load to prevent redirects
    await page.addInitScript(() => {
        window.localStorage.setItem('playerId', 'TestPlayer');
    });

    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    await page.evaluate(() => {
        window.dbItemsCacheGlobal = {
            'item_madera': { nombre: 'Madera', icono: 'http://example.com/madera.png', costo: 10, tipo: 'Material' },
            'item_piedra': { nombre: 'Piedra', icono: 'http://example.com/piedra.png', costo: 15, tipo: 'Material' }
        };

        window.datosJugador = {
            characterName: 'TestPlayer',
            ahn: 100,
            inventario_stash: {
                'inv_1': { id: 'item_madera', nombre: 'Madera', cantidad: 5, tier: 1 }
            },
            inventario_activo: {
                'inv_2': { id: 'item_piedra', nombre: 'Piedra', cantidad: 2, tier: 1 }
            },
            recetas_descubiertas: {}
        };

                window.recetasCache = {
            'receta_1': {
                nombre: 'Tabla de Madera',
                ingredientes: [
                    { id_item: 'item_madera', cantidad: 1 }
                ],
                resultado: { id_item: 'item_tabla', cantidad: 1 }
            }
        };

        // Force character name input
        const nameInput = document.querySelector('input[name="attr_character_name"]');
        if (nameInput) {
            nameInput.value = 'TestPlayer';
        }

        // Render lists
        if(typeof window.renderRecetasCrafteo === 'function') {
            window.renderRecetasCrafteo();
        }

        // Force the whole container logic to be visible (all parent nodes)
        document.getElementById('inventory-modal').classList.add('active');
        document.getElementById('inv-crafting').style.display = 'block';
    });

    const searchInput = page.locator('#craft-search');
    await expect(searchInput).toBeVisible();

    // Switch to Stash subtab
    const stashTab = page.locator('.crafteo-subtab-btn[data-subtab="craft-alijo"]');
    await stashTab.click();

    const alijoList = page.locator('#craft-alijo');
    await expect(alijoList).toBeVisible();

    const maderaItem = alijoList.locator('div').filter({ hasText: 'Madera' }).first();
    await expect(maderaItem).toBeVisible();

    // Search test
    await searchInput.fill('Piedra');
    await expect(maderaItem).toBeHidden();

    await searchInput.fill('');
    await expect(maderaItem).toBeVisible();

    // Click item to fill slot
    await maderaItem.click();

    const slot1 = page.locator('#craft-slot-1');
    await expect(slot1).toHaveClass(/has-item/);

    const fabricarBtn = page.locator('#btn-craft-fabricar');
    // It should now be enabled due to our JS modifications
    await expect(fabricarBtn).toBeEnabled();

    // Click slot to clear
    await slot1.click();
    await expect(slot1).not.toHaveClass(/has-item/);
    await expect(fabricarBtn).toBeDisabled();
});
