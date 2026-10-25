import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";

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
// Exercise the actual canonical registry and disk asset, not a placeholder icon.
const ORIGIN = "https://inventory.luminous.test";
// Isolate the actual inventory HTML from the production page. No duplicate
// handcrafted modal exists in tests: a broken live DOM fails this acceptance.
const sheet = await fs.readFile(asset("hoja_personaje.html"), "utf8");
const startMarkup = sheet.indexOf("<!-- Inventory Modal -->");
const endMarkup = sheet.indexOf("<!-- Toggle Button -->", startMarkup);
if (startMarkup < 0 || endMarkup <= startMarkup) {
  throw new Error("The production inventory markup could not be located");
}
const liveInventoryMarkup = sheet.slice(startMarkup, endMarkup);
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#0b0908"><button type="button" id="btn-global-inventory">Inventario</button>
${liveInventoryMarkup}</body></html>`

test("inventory keeps character left, real icons and item popups across desktop and mobile", async ({ browser }) => {
  test.setTimeout(120000);
  for (const { width, height, touch } of viewports) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
    // Serve the fixture and every canonical asset via Playwright interception:
    // no localhost server, Firebase credentials or external network dependency.
    await context.route("**/*", (route) => route.abort());
    await context.route(ORIGIN + "/**", async (route) => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
      if (pathname === "/") {
        return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
      }
      const file = path.resolve(root, "." + pathname);
      if (!file.startsWith(root + path.sep)) return route.fulfill({ status: 403 });
      try {
        const body = await fs.readFile(file);
        const ext = path.extname(file).toLowerCase();
        const contentType = ({ ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml",
          ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2", ".woff": "font/woff" })[ext]
          || "application/octet-stream";
        return route.fulfill({ status: 200, contentType, body });
      } catch (_) {
        return route.fulfill({ status: 404 });
      }
    });
    const page = await context.newPage();
    await page.goto(ORIGIN + "/");
    await page.addStyleTag({ path: asset("hoja_personaje.css") });
    await page.addStyleTag({ path: asset("css/inventory-hud-v2.css") });
    await page.addStyleTag({ path: asset("css/inventory-gothic-art.css") });
    await page.addStyleTag({ path: asset("css/inventory-hud-reference.css") });
    await page.addScriptTag({ path: asset("js/item-icon-registry.js") });
    await page.addScriptTag({ path: asset("js/inventory-hud-v2.js") });
    await page.evaluate(() => document.getElementById("btn-global-inventory").click());
    await page.evaluate(() => {
      const hud = window.LuminousInventoryHudV2;
      hud.state.unit = {
        level: 4, hp: 19, hp_max: 24,
        inventario_activo: {
          "healing-1": {
            id: "healing-1", displayName: "Poción de curación", category: "consumable",
            iconFamily: "medicine_vial", quantity: 3, priceAhn: 120,
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
    await expect(page.locator("#inv-active-grid .inventory-v2-item-image"))
      .toHaveAttribute("src", "Assets/Icons/items/consumable/medicine_vial.png");
    await expect.poll(() => page.locator("#inv-active-grid .inventory-v2-item-image")
      .evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(page.locator("#inv-active-grid .item-name")).toBeHidden();
    await expect(page.locator("#inventory-v2-detail-overlay")).toBeHidden();
    await page.locator('#inv-active-grid [data-key="healing-1"]').click();
    await expect(page.locator("#inventory-v2-detail-overlay")).toBeVisible();
    await expect(page.locator("#detail-title")).toHaveText("Poción de curación");
    await expect(page.locator("#detail-cost-val")).toHaveText("120");
    await expect(page.locator("#detail-desc")).toContainText("Restaura una pequeña");
    // Firebase-like replacement must preserve focus inside the modal actions.
    await page.evaluate(() => {
      const hud = window.LuminousInventoryHudV2;
      hud.state.stashUnlocked = true;
      hud.renderDetail();
    });
    await page.getByRole("button", { name: "STORE / GUARDAR" }).focus();
    await page.evaluate(() => window.LuminousInventoryHudV2.renderAll());
    await expect(page.getByRole("button", { name: "STORE / GUARDAR" })).toBeFocused();
    await expect(page.locator("#inventory-modal > .inventory-modal-content"))
      .toHaveJSProperty("inert", true);
    const overlay = await page.locator("#inventory-v2-detail-dialog").boundingBox();
    expect(overlay.x).toBeGreaterThanOrEqual(-1);
    expect(overlay.x + overlay.width).toBeLessThanOrEqual(width + 1);
    expect(overlay.y).toBeGreaterThanOrEqual(-1);
    expect(overlay.y + overlay.height).toBeLessThanOrEqual(height + 1);
    await page.locator("#inventory-v2-detail-close").click();
    await expect(page.locator("#inventory-v2-detail-overlay")).toBeHidden();
    await expect(page.locator("#inventory-modal > .inventory-modal-content"))
      .toHaveJSProperty("inert", false);
    await page.locator('#inv-active-grid [data-key="healing-1"]').click();
    await page.keyboard.press("Escape");
    await expect(page.locator("#inventory-v2-detail-overlay")).toBeHidden();
    await expect(page.locator("#inventory-modal")).toHaveClass(/active/);
    await context.close();
  }
});
