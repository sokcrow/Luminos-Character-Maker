const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const EDITOR = path.join(ROOT, "js/dm-item-instance-editor.js");

async function bootDmHarness(page) {
  await page.setContent(`<!doctype html><html><head></head><body>
    <div id="modal-inventario-dm" class="modal-overlay" style="display:flex">
      <div class="modal-cyber">
        <div class="modal-header"><h3 id="modal-inv-titulo">Inventario de: player_test</h3></div>
        <div class="modal-body">
          <div id="modal-inv-lista-activos">
            <div class="legacy-row">
              <span>Sword</span>
              <button class="btn-inv-mod" data-action="to_stash" data-key="sword_1" data-list="activo">MOVE</button>
              <button class="btn-inv-mod" data-action="minus" data-key="sword_1" data-list="activo">-</button>
              <button class="btn-inv-mod" data-action="plus" data-key="sword_1" data-list="activo">+</button>
              <button class="btn-inv-mod" data-action="delete" data-key="sword_1" data-list="activo">DELETE</button>
            </div>
          </div>
          <div id="modal-inv-lista-stash">
            <div class="legacy-row">
              <span>Cell</span>
              <button class="btn-inv-mod" data-action="to_activo" data-key="cell_1" data-list="stash">MOVE</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </body></html>`);

  await page.evaluate(() => {
    const sword = {
      schemaVersion: 2,
      instanceId: "sword_1",
      definitionId: "sword",
      nombre: "Vesper Workshop Sword",
      quantity: 1,
      cantidad: 1,
      qualityTier: 2,
      quality: 2,
      condition: 90,
      conditionMax: 100,
      manufacturerId: "workshop:vesper",
      installedModuleIds: [],
      signatureTechnologyIds: [],
      chargesCurrent: 1,
      chargesMax: 3,
      equipped: true,
      equippedPartIds: ["right_hand"],
    };
    const cell = {
      schemaVersion: 2,
      instanceId: "cell_1",
      definitionId: "battery_cell",
      nombre: "Battery Cell",
      quantity: 2,
      cantidad: 2,
      qualityTier: 1,
      condition: 100,
      conditionMax: 100,
    };

    window.__source = {
      inventario_activo: { sword_1: sword },
      inventario_stash: { cell_1: cell },
      equipment: { mainHand: sword, accessories: [] },
    };
    window.__saves = [];
    window.__legacyCalls = 0;
    window.confirm = () => true;
    window.alert = () => {};

    document.querySelector("#modal-inventario-dm .modal-body").addEventListener("click", (event) => {
      if (event.target.closest(".btn-inv-mod")) window.__legacyCalls += 1;
    });

    const clone = (value) => JSON.parse(JSON.stringify(value));
    const itemId = (item) => String(item?.instanceId || item?.definitionId || item?.id || "");
    const quantityOf = (item) => Math.max(0, Number(item?.quantity ?? item?.cantidad ?? 1) || 0);
    const setQuantity = (item, value) => {
      const next = Math.max(0, Number(value) || 0);
      item.quantity = next;
      item.cantidad = next;
      return next;
    };

    window.LuminousItemRuntime = {
      itemId,
      quantityOf,
      setQuantity,
      resolveItem: (item) => ({ ...item, displayName: item.nombre || item.name || item.definitionId }),
    };

    function find(container, ref) {
      const wanted = String(ref || "");
      for (const [key, item] of Object.entries(container || {})) {
        if (key === wanted || itemId(item) === wanted) return { key, item };
      }
      return null;
    }

    function move(unit, ref, fromName, toName) {
      const from = unit[fromName] || (unit[fromName] = {});
      const to = unit[toName] || (unit[toName] = {});
      const found = find(from, ref);
      if (!found) return { moved: false, reason: "item_not_found" };
      if (toName === "inventario_activo" && !to[found.key] && Object.keys(to).length >= 10) return { moved: false, reason: "active_inventory_full" };
      delete from[found.key];
      to[found.key] = found.item;
      return { moved: true, instanceId: itemId(found.item), amount: quantityOf(found.item) };
    }

    window.LuminousItemInventoryRuntime = {
      schemaVersion: 2,
      stackLimit: (item, container) => String(container).includes("stash") ? 99 : 2,
      migrateLegacyItem(item, key, options = {}) {
        const next = clone(item);
        next.schemaVersion = 2;
        next.instanceId = next.instanceId || key;
        next.definitionId = next.definitionId || next.id || key;
        if (!next.currentOwnerId && options.currentOwnerId) next.currentOwnerId = options.currentOwnerId;
        return next;
      },
      setQualityTier(item, tier) { item.qualityTier = Math.max(1, Math.min(5, Number(tier) || 1)); item.quality = item.qualityTier; return item.qualityTier; },
      getConditionState(item) {
        const max = Math.max(1, Number(item.conditionMax ?? 100));
        const current = Math.max(0, Math.min(max, Number(item.condition ?? max)));
        const percent = current / max * 100;
        return { current, max, percent, id: percent <= 0 ? "broken" : percent <= 25 ? "critical" : percent <= 50 ? "damaged" : percent <= 75 ? "worn" : "good" };
      },
      getCharges(item) {
        return { current: item.chargesCurrent ?? null, max: item.chargesMax ?? null };
      },
      moveToStash(unit, ref) { return move(unit, ref, "inventario_activo", "inventario_stash"); },
      moveToActive(unit, ref) { return move(unit, ref, "inventario_stash", "inventario_activo"); },
    };

    window.LuminousItemPersistenceRuntime = {
      async loadPlayerInventory() {
        return {
          loaded: true,
          state: {
            inventario_activo: clone(window.__source.inventario_activo),
            inventario_stash: clone(window.__source.inventario_stash),
            equipmentRefs: { mainHand: "sword_1", accessoryIds: [] },
          },
        };
      },
      applyInventoryState(unit, snapshot) {
        unit.inventario_activo = clone(snapshot.inventario_activo || {});
        unit.inventario_stash = clone(snapshot.inventario_stash || {});
        unit.equipment = { accessories: [] };
        if (snapshot.equipmentRefs?.mainHand) unit.equipment.mainHand = unit.inventario_activo[snapshot.equipmentRefs.mainHand];
        return { applied: true };
      },
      async saveInventoryState() { return { saved: true }; },
    };

    window.LuminousItemRealtimeSync = {
      bindDmInventory(options) {
        options.unit.inventario_activo = clone(window.__source.inventario_activo);
        options.unit.inventario_stash = clone(window.__source.inventario_stash);
        options.unit.equipment = { mainHand: options.unit.inventario_activo.sword_1, accessories: [] };
        options.onInventory?.({ unit: options.unit, playerId: options.playerId, role: "dm", source: "firebase" });
        return {
          bound: true,
          async save(unit) {
            const snapshot = {
              active: clone(unit.inventario_activo || {}),
              stash: clone(unit.inventario_stash || {}),
              mainHand: unit.equipment?.mainHand?.instanceId || null,
            };
            window.__source.inventario_activo = clone(unit.inventario_activo || {});
            window.__source.inventario_stash = clone(unit.inventario_stash || {});
            window.__saves.push(snapshot);
            return { saved: true };
          },
          dispose() {},
        };
      },
    };

    window.db = { ref() { return {}; } };
  });

  await page.addScriptTag({ path: EDITOR });
  await page.waitForFunction(() => window.LuminousDmItemInstanceEditor?.state?.ready === true);
  await expect(page.locator('#modal-inv-lista-activos .dm-item-instance-edit[data-key="sword_1"]')).toHaveCount(1);
}

test("DM rows expose the canonical ItemInstance editor", async ({ page }) => {
  await bootDmHarness(page);
  await page.locator('#modal-inv-lista-activos .dm-item-instance-edit[data-key="sword_1"]').click();
  await expect(page.locator("#dm-item-instance-editor")).toHaveClass(/active/);
  await expect(page.locator("#dm-item-editor-title")).toHaveText("Vesper Workshop Sword");
  await expect(page.locator("#dm-item-field-instance")).toHaveValue("sword_1");
  await expect(page.locator("#dm-item-field-definition")).toHaveValue("sword");
  await expect(page.locator("#dm-item-field-quality")).toHaveValue("2");
});

test("legacy DM quantity buttons are intercepted and persisted by the runtime bridge", async ({ page }) => {
  await bootDmHarness(page);
  await page.locator('.btn-inv-mod[data-action="plus"][data-key="sword_1"]').click();
  await page.waitForFunction(() => window.__saves.length === 1);
  const result = await page.evaluate(() => ({ save: window.__saves[0], legacyCalls: window.__legacyCalls }));
  expect(result.legacyCalls).toBe(0);
  expect(result.save.active.sword_1.quantity).toBe(2);
  expect(result.save.active.sword_1.cantidad).toBe(2);
});

test("DM edits canonical quality, condition, charges, provenance and technology", async ({ page }) => {
  await bootDmHarness(page);
  await page.locator('#modal-inv-lista-activos .dm-item-instance-edit[data-key="sword_1"]').click();
  await page.locator("#dm-item-field-quality").selectOption("4");
  await page.locator("#dm-item-field-condition").fill("42");
  await page.locator("#dm-item-field-manufacturer").fill("workshop:hana");
  await page.locator("#dm-item-field-product-line").fill("hana:field_line");
  await page.locator("#dm-item-field-charges").fill("2");
  await page.locator("#dm-item-field-charges-max").fill("5");
  await page.locator("#dm-item-field-recharge-resource").fill("battery_cell");
  await page.locator("#dm-item-field-recharge-cost").fill("2");
  await page.locator("#dm-item-field-modules").fill("module_a, module_b");
  await page.locator("#dm-item-field-signature-tech").fill("structural_alpha");
  await page.locator("#dm-item-field-stolen").check();
  await page.locator("#dm-item-editor-save").click();
  await page.waitForFunction(() => window.__saves.length === 1);

  const item = await page.evaluate(() => window.__saves[0].active.sword_1);
  expect(item.schemaVersion).toBe(2);
  expect(item.instanceId).toBe("sword_1");
  expect(item.qualityTier).toBe(4);
  expect(item.condition).toBe(42);
  expect(item.manufacturerId).toBe("workshop:hana");
  expect(item.productLineId).toBe("hana:field_line");
  expect(item.chargesCurrent).toBe(2);
  expect(item.chargesMax).toBe(5);
  expect(item.rechargeRule.resourceDefinitionId).toBe("battery_cell");
  expect(item.rechargeRule.resourceAmount).toBe(2);
  expect(item.installedModuleIds).toEqual(["module_a", "module_b"]);
  expect(item.signatureTechnologyIds).toEqual(["structural_alpha"]);
  expect(item.stolen).toBe(true);
});

test("moving an equipped DM item to Stash clears equipment references", async ({ page }) => {
  await bootDmHarness(page);
  await page.locator('.btn-inv-mod[data-action="to_stash"][data-key="sword_1"]').click();
  await page.waitForFunction(() => window.__saves.length === 1);
  const saved = await page.evaluate(() => window.__saves[0]);
  expect(saved.active.sword_1).toBeUndefined();
  expect(saved.stash.sword_1.instanceId).toBe("sword_1");
  expect(saved.stash.sword_1.equipped).toBe(false);
  expect(saved.mainHand).toBeNull();
  expect(await page.evaluate(() => window.__legacyCalls)).toBe(0);
});

test("DM bootstrap loads the ItemInstance editor assets", async () => {
  const hotfix = fs.readFileSync(path.join(ROOT, "js/dm-player-dnd-studio-hotfix.js"), "utf8");
  expect(hotfix).toContain("dm-item-instance-editor-stylesheet");
  expect(hotfix).toContain("css/dm-item-instance-editor.css");
  expect(hotfix).toContain("dm-item-instance-editor-script");
  expect(hotfix).toContain("js/dm-item-instance-editor.js");
});
