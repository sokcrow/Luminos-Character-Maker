import {test, expect} from '@playwright/test';

const BASE = process.env.DM_VISUAL_BASE_URL || 'http://127.0.0.1:4173';
const screens = [
  {name: 'mobile-360-portrait', width: 360, height: 800},
  {name: 'mobile-390-portrait', width: 390, height: 844},
  {name: 'mobile-844-landscape', width: 844, height: 390},
  {name: 'tablet-768', width: 768, height: 1024},
  {name: 'desktop-1280', width: 1280, height: 720},
  {name: 'desktop-1920', width: 1920, height: 1080}
];

for (const size of screens) {
  test('target acknowledgement fits ' + size.name, async ({page}) => {
    await page.setViewportSize({width:size.width, height:size.height});
    // Isolate the real presentation module: the packed-engine contract test
    // independently verifies that a legitimate choosePlayerTarget triggers it.
    await page.route(BASE + '/target-feedback-preview', route => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1">
        <link rel="stylesheet" href="/css/combat-target-feedback-073.css">
        <body style="margin:0;background:#080605;color:white">
          <div id="game-container" data-viewer-role="player"></div>
          <img id="sprite-kobold" alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='60'%3E%3Crect width='40' height='60' fill='%238b5030'/%3E%3C/svg%3E">
          <button id="tap-through" style="position:fixed;top:85px;left:50%;z-index:1">Interact</button>
          <script src="/js/combat-target-feedback-073.js"></script>
        </body></html>`
    }));
    await page.goto(BASE + '/target-feedback-preview');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('luminous:combat073-target-selected', {
      detail: {targetId:'kobold', targetName:'Kobold', enemy:true, actionName:'Skill 1', slotIndex:0, clashPending:false}
    })));
    const banner = page.locator('#combat-target-feedback');
    await expect(banner).toBeVisible();
    await expect(banner.locator('.combat-target-feedback__title')).toHaveText('ENEMIGO SELECCIONADO');
    const rect = await banner.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(size.width + 1);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.y + rect.height).toBeLessThanOrEqual(size.height);
    // The confirmation belongs in the lower-left, not centered over Combat.
    const expectedLeft = size.width <= 520 ? 12 : 16;
    const expectedBottom = size.height <= 460 && size.width > size.height ? 8 : (size.width <= 520 ? 12 : 16);
    expect(rect.x).toBeGreaterThanOrEqual(expectedLeft - 1);
    expect(rect.x).toBeLessThanOrEqual(expectedLeft + 2);
    expect(size.height - (rect.y + rect.height)).toBeGreaterThanOrEqual(expectedBottom - 1);
    expect(size.height - (rect.y + rect.height)).toBeLessThanOrEqual(expectedBottom + 2);
    const styles = await banner.evaluate(el => ({
      pointerEvents:getComputedStyle(el).pointerEvents,
      overflowX:document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    expect(styles.pointerEvents).toBe('none');
    expect(styles.overflowX).toBeLessThanOrEqual(1);
    await page.locator('#tap-through').click();
  });
}
