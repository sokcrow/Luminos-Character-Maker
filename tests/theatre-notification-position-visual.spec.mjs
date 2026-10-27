import { test, expect } from '@playwright/test';

const BASE = process.env.DM_VISUAL_BASE_URL || 'http://127.0.0.1:4173';
const screens = [
  {name: 'mobile-360', width: 360, height: 800},
  {name: 'mobile-390', width: 390, height: 844},
  {name: 'tablet', width: 768, height: 1024},
  {name: 'desktop-large', width: 1920, height: 1080},
  {name: 'mobile-landscape', width: 844, height: 390},
  {name: 'desktop', width: 1280, height: 720}
];

for (const screen of screens) {
  test('Theatre passive notices use upper-left safe corner: ' + screen.name, async ({page}) => {
    await page.setViewportSize({width: screen.width, height: screen.height});
    await page.route(BASE + '/theatre-popup-preview', route => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html><html lang="es"><head>
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
        <link rel="stylesheet" href="/css/theatre-check-coordinator.css">
        <link rel="stylesheet" href="/css/theatre-opposed-checks.css">
        </head><body class="on-game-dashboard" style="margin:0;background:#070707;color:white">
          <div id="theatre-check-front-layer" class="theatre-check-front-layer">
            <div class="theatre-check-dm-toast"><strong>SOLICITUD DE CHECK</strong><span>Check Director</span></div>
          </div>
        </body></html>`
    }));
    await page.goto(BASE + '/theatre-popup-preview');
    const dmToast = page.locator('.theatre-check-dm-toast');
    const rect = await dmToast.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect.x).toBeGreaterThanOrEqual(15);
    expect(rect.x).toBeLessThanOrEqual(18);
    expect(rect.y).toBeGreaterThanOrEqual(15);
    expect(rect.y).toBeLessThanOrEqual(18);
    expect(rect.x + rect.width).toBeLessThanOrEqual(screen.width + 1);
    expect(rect.y + rect.height).toBeLessThanOrEqual(screen.height);
    await expect(dmToast).toHaveCSS('pointer-events', 'none');

    await page.evaluate(() => {
      document.body.className = 'player-instance-theatre';
      document.querySelector('#theatre-check-front-layer').innerHTML =
        '<div class="theatre-check-player-notice"><strong>CHECK</strong><span>Resultado disponible</span></div>' +
        '<div class="theatre-opposed-result-notice">Resultado opuesto</div>';
    });
    const player = await page.locator('.theatre-check-player-notice').boundingBox();
    const opposed = await page.locator('.theatre-opposed-result-notice').boundingBox();
    expect(player).not.toBeNull();
    expect(opposed).not.toBeNull();
    expect(player.x).toBeGreaterThanOrEqual(15);
    expect(player.x).toBeLessThanOrEqual(18);
    expect(player.y).toBeGreaterThanOrEqual(111);
    expect(opposed.x).toBeGreaterThanOrEqual(15);
    expect(opposed.x).toBeLessThanOrEqual(18);
    expect(opposed.y).toBeGreaterThanOrEqual(player.y + player.height + 7);
    expect(opposed.y).toBeGreaterThanOrEqual(player.y + player.height);
    expect(player.x + player.width).toBeLessThanOrEqual(screen.width + 1);
    expect(opposed.x + opposed.width).toBeLessThanOrEqual(screen.width + 1);
    expect(opposed.y + opposed.height).toBeLessThanOrEqual(screen.height);
    await expect(page.locator('.theatre-check-player-notice')).toHaveCSS('pointer-events', 'none');
    // Real multiline errors must push the second notice down by their height.
    await page.locator('.theatre-check-player-notice span').evaluate(el => {
      el.textContent = 'No se pudo sincronizar la solicitud. '.repeat(25);
    });
    const longPlayer = await page.locator('.theatre-check-player-notice').boundingBox();
    const below = await page.locator('.theatre-opposed-result-notice').boundingBox();
    expect(longPlayer.height).toBeGreaterThan(player.height);
    expect(below.y).toBeGreaterThanOrEqual(longPlayer.y + longPlayer.height + 7);
    expect(below.y + below.height).toBeLessThanOrEqual(screen.height - 15);
    // Removing the first notice must not leave a hard-coded vertical gap.
    await page.locator('.theatre-check-player-notice').evaluate(el => el.remove());
    const alone = await page.locator('.theatre-opposed-result-notice').boundingBox();
    expect(alone.y).toBeGreaterThanOrEqual(111);
    expect(alone.y).toBeLessThanOrEqual(114);
  });
}
