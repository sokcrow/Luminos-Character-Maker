const { test, expect } = require('@playwright/test');

test('Verify Shop UI', async ({ page }) => {
  // We mock a little bit of the environment since this relies heavily on Firebase Auth/Realtime DB
  await page.route('**/firebase-*.js', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        window.firebase = {
          initializeApp: () => {},
          auth: () => ({
            onAuthStateChanged: (cb) => {
              cb({ uid: 'test-uid' });
            },
            signOut: () => Promise.resolve()
          }),
          database: () => ({
            ref: (path) => ({
              on: (event, cb) => {
                 if (path.includes('campaña/jugadores/TestPlayer')) {
                    cb({ val: () => ({ status: 'approved', uid: 'test-uid' }) });
                 }
              },
              once: (event, cb) => {
                 if (path.includes('transacciones')) {
                    cb({
                        forEach: (f) => {
                            f({ val: () => ({ monto: 500 }) });
                            f({ val: () => ({ monto: -100 }) });
                        }
                    });
                 } else if (path.includes('tiendas/tienda_1')) {
                    cb({ val: () => ({
                        nombre: "Test Shop",
                        items: [
                           {
                             nombre: "Healing Potion",
                             costo: 50,
                             tier: "2",
                             icono: "🧪",
                             stock_actual: 10,
                             descripcion: "Restores HP."
                           },
                           {
                             nombre: "Magic Sword",
                             costo: 300,
                             tier: "4",
                             icono: "https://example.com/sword.png",
                             stock_actual: -1,
                             descripcion: "A sharp sword."
                           }
                        ]
                    }) });
                 } else {
                    cb({ val: () => null });
                 }
              },
              push: () => Promise.resolve(),
              update: () => Promise.resolve()
            })
          })
        };
        window.db = window.firebase.database();
      `
    });
  });

  // Intercept the utility scripts so they don't crash without real firebase
  await page.route('**/js/auth.js', async route => route.fulfill({ body: '' }));

  // Navigate to local file
  await page.goto('file:///app/hoja_personaje.html');

  // Inject our player id
  await page.evaluate(() => {
     localStorage.setItem('playerId', 'TestPlayer');
     window.playerId = 'TestPlayer';
  });

  // Call the function directly to test the UI output
  await page.evaluate(() => {
     window.abrirTiendaDinamica('tienda_1');
  });

  // Wait for the overlay to be visible
  await expect(page.locator('#tienda-overlay')).toBeVisible();

  // Wait a moment for rendering
  await page.waitForTimeout(500);

  // Click the first item to populate the right panel
  await page.locator('.item-row').first().click();

  // Take screenshot
  await page.screenshot({ path: '/home/jules/verification/shop_verification.png' });
});