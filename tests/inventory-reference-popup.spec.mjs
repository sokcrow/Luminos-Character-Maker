import { test, expect } from "@playwright/test";
import path from "node:path";

const root = process.cwd();
const asset = (name) => path.join(root, name);
const viewports = [
  { width: 360, height: 800, touch: true },
  { width: 390, height: 844, touch: true },
  { width: 844, height: 390, touch: true },
  { width: 768, height: 1024, touch: true },
  { width: 1280, height: 720, touch: false },
  { width: 1920, height: 1080, touch: false },
];
const iconData = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#961c27"/><path d="M35 10h10v60H35z" fill="#fff"/></svg>');
const html = `<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#0b0908">
<button id="btn-global-inventory" type="button">Inventario</button>
<div id="inventory-modal" class="inventory-modal" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center">
  <div class="inventory-modal-content" style="display:flex;flex-direction:column;position:relative">
    <button id="inventory-modal-close" class="inventory-modal-close" type="button">×</button>
    <div class="inventory-tabs">
      <button type="button" class="inv-tab-btn active" data-tab="inv-active">Activos</button>
      <button type="button" class="inv-tab-btn" data-tab="inv-stash">Alijo</button>
      <button type="button" class="inv-tab-btn" data-tab="inv-sintesis">Síntesis</button>
    </div>
    <div class="inventory-body-wrapper" style="display:flex;flex:1;min-height:0">
      <div class="inventory-left-panel">
        <div id="inv-active" class="inventory-tab-content active"><div id="inv-active-grid" class="inv-grid"></div></div>
        <div id="inv-stash" class="inventory-tab-content"><div class="inventory-toolbar"><div id="filtros-stash"></div></div><div id="inv-stash-grid" class="inv-grid"></div></div>
        <div id="inv-sintesis" class="inventory-tab-content"></div>
      </div>
      <div id="inventory-v2-detail-overlay" class="inventory-v2-detail-overlay" hidden>
        <section id="inventory-v2-detail-dialog" class="inventory-v2-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="detail-title" tabindex="-1">
          <button type="button" id="inventory-v2-detail-close" class="inventory-v2-detail-close">×</button>
          <div id="item-detail-card" class="item-detail-card">
            <div class="detail-left"><div class="detail-icon-box"><img id="detail-icon" alt="" /></div></div>
            <div class="detail-right">
              <div id="detail-title" class="detail-title-badge"></div>
              <div class="inventory-v2-detail-meta"><span class="detail-tier">Tier <b id="detail-tier-val"></b></span><span class="detail-cost">Valor <span class="currency-symbol">₳</span><b id="detail-cost-val"></b></span></div>
              <div id="inventory-v2-detail-effects" hidden></div>
              <div id="detail-desc" class="detail-desc"></div><div id="detail-tags-val" hidden></div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</div></body></html>`;

test("inventory keeps character left, real icons and item popups across desktop and mobile", async ({ browser }) => {
  test.setTimeout(120000);
  for (const { width, height, touch } of viewports) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
    const page = await context.newPage();
    await page.setContent(html);
    await page.addStyleTag({ path: asset("hoja_personaje.css") });
    await page.addStyleTag({ path: asset("css/inventory-hud-v2.css") });
    await page.addStyleTag({ path: asset("css/inventory-gothic-art.css") });
    await page.addStyleTag({ path: asset("css/inventory-hud-reference.css") });
    await page.evaluate((src) => {
      window.LuminousItemIconRegistry = { resolveIcon: () => src };
    }, iconData);
    await page.addScriptTag({ path: asset("js/inventory-hud-v2.js") });
    await page.evaluate(() => {
      const hud = window.LuminousInventoryHudV2;
      hud.state.unit = {
        level: 4, hp: 19, hp_max: 24,
        inventario_activo: {
          "healing-1": {
            id: "healing-1", displayName: "Poción de curación", category: "consumable",
            iconFamily: "medicine_vial", quantity: 3, value: 120,
            description: "Restaura una pequeña cantidad de puntos de golpe."
          }
        },
        inventario_stash: {},
      };
      hud.renderAll();
    });
    const charPanel = await page.locator(".inventory-v2-equipment").boundingBox();
    const inventoryPanel = await page.locator(".inventory-v2-carry").boundingBox();
    expect(charPanel, `missing character panel at ${width}x${height}`).not.toBeNull();
    expect(inventoryPanel, `missing inventory panel at ${width}x${height}`).not.toBeNull();
    expect(charPanel.x + charPanel.width, `panels must be side by side at ${width}x${height}`).toBeLessThanOrEqual(inventoryPanel.x + 2);
    expect(Math.abs(charPanel.y - inventoryPanel.y)).toBeLessThan(8);
    await expect(page.locator("#inv-active-grid .inventory-v2-item-image")).toHaveCount(1);
    await expect(page.locator("#inv-active-grid .item-name")).toBeHidden();
    await expect(page.locator("#inventory-v2-detail-overlay")).toBeHidden();
    await page.locator('#inv-active-grid [data-key="healing-1"]').click();
    await expect(page.locator("#inventory-v2-detail-overlay")).toBeVisible();
    await expect(page.locator("#detail-title")).toHaveText("Poción de curación");
    await expect(page.locator("#detail-cost-val")).toHaveText("120");
    await expect(page.locator("#detail-desc")).toContainText("Restaura una pequeña");
    const overlay = await page.locator("#inventory-v2-detail-dialog").boundingBox();
    expect(overlay.x).toBeGreaterThanOrEqual(-1);
    expect(overlay.x + overlay.width).toBeLessThanOrEqual(width + 1);
    expect(overlay.y).toBeGreaterThanOrEqual(-1);
    expect(overlay.y + overlay.height).toBeLessThanOrEqual(height + 1);
    await page.locator("#inventory-v2-detail-close").click();
    await expect(page.locator("#inventory-v2-detail-overlay")).toBeHidden();
    await page.locator('#inv-active-grid [data-key="healing-1"]').click();
    await page.keyboard.press("Escape");
    await expect(page.locator("#inventory-v2-detail-overlay")).toBeHidden();
    await expect(page.locator("#inventory-modal")).toHaveClass(/active/);
    await context.close();
  }
});
