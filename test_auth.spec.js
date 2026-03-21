const { test, expect } = require('@playwright/test');

test('Check character name modal appears', async ({ page }) => {
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.route('**/*firebase*.js', (route) => route.fulfill({ status: 200, body: '' }));

  await page.addInitScript(() => {
    localStorage.removeItem('playerId');
    window.firebase = {
        apps: [],
        initializeApp: () => { window.firebase.apps.push('mock'); },
        auth: () => ({
            onAuthStateChanged: (cb) => {
                console.log("MOCK AUTH TRIGGERED");
                setTimeout(() => cb({ uid: 'mock_uid_123', email: 'test@test.com' }), 500);
            },
            signOut: () => Promise.resolve()
        }),
        database: () => ({
            ref: (path) => ({
                on: () => {},
                once: async () => ({ exists: () => false, val: () => null }),
                update: async () => {},
                set: async () => {},
                child: () => ({
                    onDisconnect: () => ({ set: () => {} })
                })
            }),
            ServerValue: { TIMESTAMP: 123 }
        })
    };
  });

  await page.goto('http://localhost:3000/hoja_personaje.html', { waitUntil: 'networkidle' });

  // The modal should appear
  const modal = page.locator('#character-name-modal');
  await expect(modal).toBeVisible({ timeout: 5000 });

  // Enter a name
  const input = page.locator('#character-name-input');
  await input.fill('Jules Character');

  // Take screenshot
  await page.screenshot({ path: 'verification.png' });

  // Click confirm
  const btn = page.locator('#btn-confirm-character-name');
  await btn.click();

  // Verify it disappears
  await expect(modal).toBeHidden();
});
