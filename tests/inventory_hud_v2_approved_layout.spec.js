const { test, expect } = require("@playwright/test");
const path = require("path");

const BASE_CSS = path.resolve(__dirname, "../css/inventory-hud-v2.css");
const APPROVED_CSS = path.resolve(__dirname, "../css/inventory-hud-v2-approved-layout.css");
const APPROVED_JS = path.resolve(__dirname, "../js/inventory-hud-v2-approved-layout.js");

async function bootApprovedLayout(page) {
  await page.setContent(`<!doctype html><html><head></head><body>
    <div id="inventory-modal" class="inventory-modal inventory-v2-ready">
      <div class="inventory-modal-content">
        <div class="inventory-body-wrapper">
          <div class="inventory-left-panel">
            <div id="inv-active">
              <div id="equipment-panel" class="cyber-panel">
                <h3 class="cyber-panel-title">EQUIPAMIENTO TÁCTICO</h3>
                <div class="equipamiento-layout"><div class="equip-slot">VACÍO</div></div>
              </div>
              <div class="inventory-v2-active-stack">
                <section class="inventory-v2-equipment">
                  <header class="inventory-v2-equipment-header"><div><span>ANATOMY / EQUIPMENT MAP</span><strong>EQUIPPED LOADOUT</strong></div></header>
                  <div class="inventory-v2-equipment-field">
                    <div class="inventory-v2-body-silhouette"></div>
                    <button class="inventory-v2-eq-slot inv2-eq-main" data-equipment-slot="mainHand"><span class="inventory-v2-eq-label">MAIN HAND</span><span class="inventory-v2-eq-name">EMPTY</span><span class="inventory-v2-eq-hint">WEAPON</span></button>
                    <button class="inventory-v2-eq-slot inv2-eq-off" data-equipment-slot="offHand"><span class="inventory-v2-eq-label">OFF HAND</span><span class="inventory-v2-eq-name">EMPTY</span><span class="inventory-v2-eq-hint">WEAPON / SHIELD</span></button>
                    <button class="inventory-v2-eq-slot inv2-eq-armor" data-equipment-slot="armor"><span class="inventory-v2-eq-label">ARMOR</span><span class="inventory-v2-eq-name">EMPTY</span><span class="inventory-v2-eq-hint">BODY</span></button>
                    <button class="inventory-v2-eq-slot inv2-eq-shield" data-equipment-slot="shield"><span class="inventory-v2-eq-label">SHIELD</span><span class="inventory-v2-eq-name">EMPTY</span><span class="inventory-v2-eq-hint">DEFENSE</span></button>
                    <button class="inventory-v2-eq-slot inv2-eq-acc-a" data-equipment-slot="accessory0"><span class="inventory-v2-eq-label">ACCESSORY A</span><span class="inventory-v2-eq-name">EMPTY</span><span class="inventory-v2-eq-hint">ACCESSORY</span></button>
                    <button class="inventory-v2-eq-slot inv2-eq-acc-b" data-equipment-slot="accessory1"><span class="inventory-v2-eq-label">ACCESSORY B</span><span class="inventory-v2-eq-name">EMPTY</span><span class="inventory-v2-eq-hint">ACCESSORY</span></button>
                    <div id="inventory-v2-augment-summary"><span>AUGMENTS</span><strong>NO INSTALLED AUGMENTS</strong></div>
                  </div>
                </section>
                <section class="inventory-v2-carry">
                  <header class="inventory-v2-carry-header"><div><span>FIELD CARRY</span><strong>ACTIVE INVENTORY</strong></div></header>
                  <div class="inventory-v2-grid-host">
                    <div id="inv-active-grid" class="inv-grid">
                      ${Array.from({length:10},(_,i)=>`<div class="item-slot">${i+1}</div>`).join("")}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </body></html>`);
  await page.addStyleTag({ path: BASE_CSS });
  await page.addStyleTag({ path: APPROVED_CSS });
  await page.addScriptTag({ path: APPROVED_JS });
  await page.waitForFunction(() => window.LuminousInventoryApprovedLayout);
}

test("removes the visible legacy tactical equipment block", async ({ page }) => {
  await bootApprovedLayout(page);
  await expect(page.locator("#equipment-panel")).toBeHidden();
  await expect(page.locator("#equipment-panel")).toHaveAttribute("aria-hidden", "true");
});

test("uses the approved seven visible equipment targets without duplicate shield", async ({ page }) => {
  await bootApprovedLayout(page);
  await expect(page.locator('[data-equipment-slot="shield"]')).toHaveCount(0);
  await expect(page.locator('[data-equipment-slot="augment0"]')).toHaveCount(1);
  await expect(page.locator('[data-equipment-slot="augment1"]')).toHaveCount(1);
  await expect(page.locator(".inventory-v2-equipment-field [data-equipment-slot]")).toHaveCount(7);
});

test("keeps Active Inventory as the approved 5x2 grid below Equipment", async ({ page }) => {
  await bootApprovedLayout(page);
  const result = await page.locator("#inv-active-grid").evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      columns: style.gridTemplateColumns.split(" ").filter(Boolean).length,
      rows: style.gridTemplateRows.split(" ").filter(Boolean).length,
      belowEquipment: Boolean(el.closest(".inventory-v2-carry")?.previousElementSibling?.classList.contains("inventory-v2-equipment")),
    };
  });
  expect(result.columns).toBe(5);
  expect(result.rows).toBe(2);
  expect(result.belowEquipment).toBe(true);
});
