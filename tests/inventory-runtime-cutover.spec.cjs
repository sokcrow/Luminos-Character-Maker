const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INVENTORY_RUNTIME = path.join(ROOT, "js/item-inventory-runtime.js");
const REALTIME = path.join(ROOT, "js/item-realtime-sync.js");
const BRIDGE = path.join(ROOT, "js/item-equipment-bridge.js");
const HUD = path.join(ROOT, "js/inventory-hud-v2.js");
const CSS = path.join(ROOT, "css/inventory-hud-v2.css");

async function bootHarness(page) {
  await page.setContent(`<!doctype html><html><head></head><body>
    <button id="btn-global-inventory">Inventory</button>
    <div id="inventory-modal" class="inventory-modal"><div class="inventory-modal-content">
      <button id="inventory-modal-close">x</button>
      <div class="inventory-tabs">
        <button class="inv-tab-btn active" data-tab="inv-active">Inventario Activo</button>
        <button class="inv-tab-btn" data-tab="inv-stash">Stash/Alijo</button>
        <button class="inv-tab-btn" data-tab="inv-sintesis">SÍNTESIS</button>
      </div>
      <div class="inventory-body-wrapper">
        <div class="inventory-left-panel">
          <div class="inventory-tab-content active" id="inv-active"><div class="inv-grid" id="inv-active-grid"></div></div>
          <div class="inventory-tab-content" id="inv-stash">
            <input id="buscador-items-stash" />
            <div id="filtros-stash"><button class="inv-filter-btn active" data-filter="todo">Todo</button><button class="inv-filter-btn" data-filter="medical">Medical</button></div>
            <div class="inv-grid" id="inv-stash-grid"></div>
          </div>
          <div class="inventory-tab-content" id="inv-sintesis"><div class="limbus-synthesis-container">Synthesis preserved</div></div>
        </div>
        <div class="item-detail-card" id="item-detail-card">
          <img id="detail-icon" />
          <span id="detail-tier-val"></span><span id="detail-cost-val"></span>
          <div id="detail-title"></div><div id="detail-desc"></div><div id="detail-tags-val"></div>
        </div>
      </div>
    </div></div>
  </body></html>`);
  await page.addStyleTag({ path: CSS });

  await page.evaluate(() => {
    const active = {
      blade_1: { instanceId: "blade_1", definitionId: "blade", nombre: "Test Workshop Blade", category: "weapon", tier: 3, qualityTier: 3, condition: 90, conditionMax: 100, quantity: 1 },
      coat_1: { instanceId: "coat_1", definitionId: "coat", nombre: "Reinforced Coat", category: "armor", tier: 2, qualityTier: 2, condition: 100, conditionMax: 100, quantity: 1 },
    };
    const stash = {
      med_1: { instanceId: "med_1", definitionId: "med", nombre: "Medical Ampoule", category: "consumable", tags: ["medical"], tier: 1, quantity: 2, qualityTier: 2, condition: 100, conditionMax: 100 },
    };

    window.playerId = "player_test";
    window.__active = active;
    window.__stash = stash;
    window.__saves = [];

    const categoryOf = (item) => String(item?.category || item?.tipo_categoria || "item").toLowerCase();
    const itemId = (item) => String(item?.instanceId || item?.key || item?.definitionId || "");
    const definitionId = (item) => String(item?.definitionId || item?.id || item?.key || "");
    const quantityOf = (item) => Number(item?.quantity ?? item?.cantidad ?? 1);
    const setQuantity = (item, value) => { item.quantity = Math.max(0, Number(value) || 0); return item.quantity; };
    const findItem = (unit, ref) => {
      const wanted = typeof ref === "object" ? itemId(ref) : String(ref);
      for (const container of [unit.inventario_activo, unit.inventario_stash]) {
        for (const [key, item] of Object.entries(container || {})) {
          if (key === wanted || itemId(item) === wanted || definitionId(item) === wanted) return item;
        }
      }
      return null;
    };

    window.LuminousItemRuntime = {
      itemId,
      definitionId,
      categoryOf,
      quantityOf,
      setQuantity,
      findItem,
      normalizeId: (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      equipmentSchema: (item) => ({ kind: categoryOf(item), handCost: categoryOf(item) === "weapon" ? 1 : 0 }),
      resolveItem: (item) => ({ ...item, displayName: item.nombre || item.name || item.definitionId }),
      hydrateForEquipment: (item) => item,
      getConditionState: (item) => Number(item.condition ?? 100) <= 50 ? "damaged" : "good",
      hasFunction: (item, fn) => fn === "use" && categoryOf(item) === "consumable",
      useItem(unit, item) { if (quantityOf(item) <= 0) return { used: false, reason: "empty" }; setQuantity(item, quantityOf(item) - 1); return { used: true, item }; },
      equipItem(unit, item) { item.equipped = true; item.equippedPartIds = ["left_hand"]; return { equipped: true, item, assignment: { partIds: ["left_hand"] } }; },
      unequipItem(unit, item) { item.equipped = false; item.equippedPartIds = []; return { unequipped: true, item }; },
    };

    window.LuminousItemPersistenceRuntime = {
      applyInventoryState(unit, snapshot) {
        unit.inventario_activo = snapshot.inventario_activo || {};
        unit.inventario_stash = snapshot.inventario_stash || {};
        unit.equipment = { accessories: [] };
        const refs = snapshot.equipmentRefs || {};
        if (refs.mainHand) unit.equipment.mainHand = unit.inventario_activo[refs.mainHand];
        if (refs.offHand) unit.equipment.offHand = unit.inventario_activo[refs.offHand];
        if (refs.armor) unit.equipment.armor = unit.inventario_activo[refs.armor];
        if (refs.shield) unit.equipment.shield = unit.inventario_activo[refs.shield];
        unit.equipment.accessories = (refs.accessoryIds || []).map((id) => unit.inventario_activo[id]).filter(Boolean);
        return { applied: true };
      },
      subscribePlayerInventory(db, pid, callback) {
        queueMicrotask(() => callback({ schemaVersion: 2, inventario_activo: window.__active, inventario_stash: window.__stash, equipmentRefs: {}, attunedItemInstanceIds: [] }));
        return () => {};
      },
      async saveInventoryState(db, pid, unit) {
        window.__active = unit.inventario_activo;
        window.__stash = unit.inventario_stash;
        window.__saves.push({
          active: Object.keys(unit.inventario_activo || {}),
          stash: Object.keys(unit.inventario_stash || {}),
          mainHand: unit.equipment?.mainHand?.instanceId || null,
          armor: unit.equipment?.armor?.instanceId || null,
        });
        return { saved: true };
      },
      playerPaths(pid) { return { active: `campaña/jugadores/${pid}/inventario_activo`, stash: `campaña/jugadores/${pid}/inventario_stash` }; },
    };

    window.db = {
      ref(path) {
        return {
          on(event, handler) { if (path === "campaña/ajustes_globales/alijo_desbloqueado") queueMicrotask(() => handler({ val: () => true })); },
          off() {},
          set() { return Promise.resolve(); },
        };
      },
    };
  });

  await page.addScriptTag({ path: INVENTORY_RUNTIME });
  await page.addScriptTag({ path: REALTIME });
  await page.addScriptTag({ path: BRIDGE });
  await page.addScriptTag({ path: HUD });
  await page.waitForFunction(() => window.LuminousInventoryHudV2?.state?.peer?.bound && document.querySelectorAll("#inv-active-grid [data-key]").length === 2);
}

test("HUD V2 owns rendering and creates the canonical 5x2 Active grid", async ({ page }) => {
  await bootHarness(page);
  expect(await page.evaluate(() => typeof window.renderInventoryGrid)).toBe("undefined");
  await expect(page.locator(".inventory-v2-equipment")).toHaveCount(1);
  await expect(page.locator("#inv-active-grid .inventory-v2-runtime-slot")).toHaveCount(10);
  await expect(page.locator("#inv-active-grid .inventory-v2-empty-slot")).toHaveCount(8);
  const columns = await page.locator("#inv-active-grid").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length);
  expect(columns).toBe(5);
});

test("equips through the runtime bridge and persists equipment refs", async ({ page }) => {
  await bootHarness(page);
  await page.locator('#inv-active-grid [data-key="blade_1"]').click();
  await page.locator('[data-equipment-slot="mainHand"]').click();
  await page.waitForFunction(() => window.__saves.length > 0);
  expect((await page.evaluate(() => window.__saves.at(-1))).mainHand).toBe("blade_1");
  await expect(page.locator('[data-equipment-slot="mainHand"] .inventory-v2-eq-name')).toContainText("Test Workshop Blade");
  await expect(page.locator('#inv-active-grid [data-key="blade_1"]')).toHaveClass(/inventory-v2-equipped/);
});

test("moves Active to Stash through ItemInventoryRuntime and realtime persistence", async ({ page }) => {
  await bootHarness(page);
  await page.locator('#inv-active-grid [data-key="coat_1"]').click();
  const store = page.locator("#inventory-v2-actions .inventory-v2-action", { hasText: "STORE / GUARDAR" });
  await expect(store).toBeEnabled();
  await store.click();
  await page.waitForFunction(() => window.__saves.length > 0 && window.__saves.at(-1).stash.includes("coat_1"));
  const saved = await page.evaluate(() => window.__saves.at(-1));
  expect(saved.active).not.toContain("coat_1");
  expect(saved.stash).toContain("coat_1");
  await expect(page.locator('#inv-stash-grid [data-key="coat_1"]')).toHaveCount(1);
});

test("player source no longer contains the removed inventory implementation", async () => {
  const js = fs.readFileSync(path.join(ROOT, "hoja_personaje.js"), "utf8");
  const html = fs.readFileSync(path.join(ROOT, "hoja_personaje.html"), "utf8");
  for (const forbidden of ["window.renderInventoryGrid = function", "item-move-action", "item-load-action", "playerInventoryListenerActive"]) {
    expect(js).not.toContain(forbidden);
  }
  expect(html).not.toContain('id="equipment-panel"');
  expect(html).not.toContain('id="detail-equip-btn-container"');
  expect(html).toContain('id="inv-active-grid"');
  expect(html).toContain('id="inv-stash-grid"');
  expect(html).toContain('id="inv-sintesis"');
});
