const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ITEM_RUNTIME = path.join(ROOT, "js/item-runtime-engine.js");
const INVENTORY_RUNTIME = path.join(ROOT, "js/item-inventory-runtime.js");
const PERSISTENCE_RUNTIME = path.join(ROOT, "js/item-persistence-runtime.js");
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
      blade_1: { instanceId: "blade_1", definitionId: "blade", nombre: "Test Workshop Blade", descripcion: "Instance presentation wins", category: "weapon", tier: 3, qualityTier: 3, condition: 90, conditionMax: 100, quantity: 1 },
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
      equipmentSchema: (item) => ({ ...(item?.equipment || {}), kind: item?.equipment?.kind || categoryOf(item), handCost: item?.equipment?.handCost ?? (categoryOf(item) === "weapon" ? 1 : 0) }),
      resolveItem: (item) => ({ definitionId: item.definitionId, displayName: item.definitionId }),
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

test("HUD V2 owns rendering and creates the canonical 5x4 Active grid", async ({ page }) => {
  await bootHarness(page);
  expect(await page.evaluate(() => typeof window.renderInventoryGrid)).toBe("undefined");
  await expect(page.locator(".inventory-v2-equipment")).toHaveCount(1);
  await expect(page.locator(".inventory-v2-equipment [data-equipment-slot]")).toHaveCount(8);
  await expect(page.locator('[data-equipment-slot="augment0"]')).toHaveCount(1);
  await expect(page.locator('[data-equipment-slot="augment1"]')).toHaveCount(1);
  await expect(page.locator("#inv-active-grid .inventory-v2-runtime-slot")).toHaveCount(20);
  await expect(page.locator("#inv-active-grid .inventory-v2-empty-slot")).toHaveCount(18);
  await expect(page.locator("#inventory-v2-carry-count")).toHaveText("02 / 20");
  await expect(page.locator("#inventory-v2-stash-count")).toContainText("01 / 80 SLOTS");
  const columns = await page.locator("#inv-active-grid").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length);
  expect(columns).toBe(5);
});

test("inventory runtime freezes 20/80 capacity and family stack limits", async ({ page }) => {
  await bootHarness(page);
  const result = await page.evaluate(() => {
    const inv = window.LuminousItemInventoryRuntime;
    return {
      activeSlots: inv.activeSlotLimit({}),
      stashSlots: inv.stashSlotLimit({}),
      weaponActive: inv.stackLimit({ category: "weapon" }, "active"),
      weaponStash: inv.stackLimit({ category: "weapon" }, "stash"),
      toolActive: inv.stackLimit({ category: "tool" }, "active"),
      ammoActive: inv.stackLimit({ category: "ammo" }, "active"),
      ammoStash: inv.stackLimit({ category: "ammo" }, "stash"),
      consumableActive: inv.stackLimit({ category: "consumable" }, "active"),
      ingredientActive: inv.stackLimit({ category: "ingredient", itemType: "material" }, "active"),
      upgradeActive: inv.stackLimit({ category: "upgrade" }, "active"),
    };
  });
  expect(result).toEqual({
    activeSlots: 20, stashSlots: 80,
    weaponActive: 1, weaponStash: 1, toolActive: 1,
    ammoActive: 20, ammoStash: 99, consumableActive: 5, ingredientActive: 10, upgradeActive: 5,
  });
});

test("strict stack identity keeps procedural variants separate", async ({ page }) => {
  await bootHarness(page);
  const result = await page.evaluate(() => {
    const inv = window.LuminousItemInventoryRuntime;
    const base = { definitionId: "meat_wolf", category: "ingredient", itemType: "material", quantity: 1, quality: "fine", size: "medium", lineageId: "wolf", affinityTarget: "athletics", affinityBranch: "str" };
    return {
      identical: inv.canStack({ ...base }, { ...base }),
      affinity: inv.canStack({ ...base }, { ...base, affinityTarget: "survival", affinityBranch: "wis" }),
      size: inv.canStack({ ...base }, { ...base, size: "large" }),
      lineage: inv.canStack({ ...base }, { ...base, lineageId: "dire_wolf" }),
      processed: inv.canStack({ ...base, processedForm: "dried" }, { ...base, processedForm: "smoked" }),
      grade: inv.canStack({ definitionId: "arrow", category: "ammo", quantity: 1, combatGrade: 1 }, { definitionId: "arrow", category: "ammo", quantity: 1, combatGrade: 2 }),
      nonStackable: inv.canStack({ ...base, stackable: false }, { ...base, stackable: false }),
    };
  });
  expect(result).toEqual({ identical: true, affinity: false, size: false, lineage: false, processed: false, grade: false, nonStackable: false });
});

test("slot limits reject new stacks but still allow merging into an existing full-container stack", async ({ page }) => {
  await bootHarness(page);
  const result = await page.evaluate(() => {
    const inv = window.LuminousItemInventoryRuntime;
    const make = (id, category = "material", quantity = 1) => ({ instanceId: id, definitionId: id, category, quantity, qualityTier: 1, condition: 100, conditionMax: 100 });

    const fullStash = { inventario_activo: { extra: make("extra") }, inventario_stash: {} };
    for (let i = 0; i < 80; i += 1) fullStash.inventario_stash[`stash_${i}`] = make(`stash_${i}`);
    const rejectStash = inv.moveToStash(fullStash, "extra");

    const mergeStash = { inventario_activo: { ammo_move: { ...make("ammo_move", "ammo", 5), definitionId: "arrow" } }, inventario_stash: {} };
    mergeStash.inventario_stash.ammo_existing = { ...make("ammo_existing", "ammo", 10), definitionId: "arrow" };
    for (let i = 1; i < 80; i += 1) mergeStash.inventario_stash[`fill_${i}`] = make(`fill_${i}`);
    const mergeResult = inv.moveToStash(mergeStash, "ammo_move");

    const fullActive = { inventario_activo: {}, inventario_stash: { incoming: make("incoming") } };
    for (let i = 0; i < 20; i += 1) fullActive.inventario_activo[`active_${i}`] = make(`active_${i}`);
    const rejectActive = inv.moveToActive(fullActive, "incoming");

    return {
      rejectStash: { moved: rejectStash.moved, reason: rejectStash.reason },
      mergeStash: { moved: mergeResult.moved, slots: Object.keys(mergeStash.inventario_stash).length, qty: mergeStash.inventario_stash.ammo_existing.quantity },
      rejectActive: { moved: rejectActive.moved, reason: rejectActive.reason },
    };
  });
  expect(result.rejectStash).toEqual({ moved: false, reason: "stash_inventory_full" });
  expect(result.mergeStash).toEqual({ moved: true, slots: 80, qty: 15 });
  expect(result.rejectActive).toEqual({ moved: false, reason: "active_inventory_full" });
});

test("variant metadata survives persistence schema v3 round-trip", async ({ page }) => {
  await page.setContent("<!doctype html><html><head></head><body></body></html>");
  await page.addScriptTag({ path: ITEM_RUNTIME });
  await page.addScriptTag({ path: INVENTORY_RUNTIME });
  await page.addScriptTag({ path: PERSISTENCE_RUNTIME });
  const result = await page.evaluate(() => {
    const unit = {
      inventario_activo: {
        meat_1: {
          schemaVersion: 3, instanceId: "meat_1", definitionId: "meat_wolf", quantity: 4, category: "ingredient", itemType: "material",
          quality: "fine", qualityTier: 4, size: "large", lineageId: "dire_wolf", lineageName: "Dire Wolf",
          affinityTarget: "survival", affinityBranch: "wis", culinaryProperties: [{ target: "survival", affinityBranch: "wis" }],
          stackPolicy: "identical_item_quality_size_lineage_affinity", sourceInstanceId: "wolf_corpse_17",
          condition: 100, conditionMax: 100,
        },
      },
      inventario_stash: {}, equipment: { accessories: [] },
    };
    const saved = window.LuminousItemPersistenceRuntime.serializeInventoryState(unit);
    const restored = window.LuminousItemPersistenceRuntime.deserializeInventoryState(saved);
    const item = restored.inventario_activo.meat_1;
    return { schemaVersion: saved.schemaVersion, itemSchema: item.schemaVersion, quality: item.quality, size: item.size, lineageId: item.lineageId, affinityTarget: item.affinityTarget, affinityBranch: item.affinityBranch, sourceInstanceId: item.sourceInstanceId, stackPolicy: item.stackPolicy, culinaryProperties: item.culinaryProperties };
  });
  expect(result.schemaVersion).toBe(3);
  expect(result.itemSchema).toBe(3);
  expect(result.quality).toBe("fine");
  expect(result.size).toBe("large");
  expect(result.lineageId).toBe("dire_wolf");
  expect(result.affinityTarget).toBe("survival");
  expect(result.affinityBranch).toBe("wis");
  expect(result.sourceInstanceId).toBe("wolf_corpse_17");
  expect(result.stackPolicy).toBe("identical_item_quality_size_lineage_affinity");
  expect(result.culinaryProperties).toEqual([{ target: "survival", affinityBranch: "wis" }]);
});

test("equipment compatibility follows equipment.kind instead of hardcoded item category", async ({ page }) => {
  await bootHarness(page);
  const result = await page.evaluate(() => window.LuminousItemEquipmentBridge.compatibleSlots({
    instanceId: "field_scanner_1",
    category: "tool",
    equipment: { kind: "accessory" },
  }));
  expect(result).toEqual(["accessory0", "accessory1"]);
});

test("stash filters derive from live item families", async ({ page }) => {
  await bootHarness(page);
  await page.evaluate(() => {
    window.LuminousInventoryHudV2.state.unit.inventario_stash.chem_1 = {
      instanceId: "chem_1", definitionId: "chemical_sample", nombre: "Chemical Sample",
      category: "chemical_processed", tier: 1, quantity: 3, qualityTier: 2, condition: 100, conditionMax: 100,
    };
    window.LuminousInventoryHudV2.renderAll();
  });
  await expect(page.locator('#filtros-stash .inv-filter-btn[data-filter="all"]')).toHaveCount(1);
  await expect(page.locator('#filtros-stash .inv-filter-btn[data-filter="consumable"]')).toHaveCount(1);
  await expect(page.locator('#filtros-stash .inv-filter-btn[data-filter="chemical_processed"]')).toHaveCount(1);
});

test("inventory becomes a two-column mobile grid without horizontal modal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await bootHarness(page);
  await page.locator("#inventory-modal").evaluate((el) => el.classList.add("active"));
  const columns = await page.locator("#inv-active-grid").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length);
  expect(columns).toBe(2);
  const overflow = await page.locator(".inventory-modal-content").evaluate((el) => ({ clientWidth: el.clientWidth, scrollWidth: el.scrollWidth }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  await expect(page.locator(".inventory-v2-equipment [data-equipment-slot]")).toHaveCount(8);
});

test("equips through the runtime bridge and persists equipment refs", async ({ page }) => {
  await bootHarness(page);
  await page.locator('#inv-active-grid [data-key="blade_1"]').click();
  await expect(page.locator("#detail-title")).toHaveText("Test Workshop Blade");
  await expect(page.locator("#detail-desc")).toHaveText("Instance presentation wins");
  await page.locator('[data-equipment-slot="mainHand"]').click();
  await page.waitForFunction(() => window.__saves.length > 0);
  expect((await page.evaluate(() => window.__saves.at(-1))).mainHand).toBe("blade_1");
  await expect(page.locator('[data-equipment-slot="mainHand"] .inventory-v2-eq-name')).toContainText("Test Workshop Blade");
  await expect(page.locator('#inv-active-grid [data-key="blade_1"]')).toHaveClass(/inventory-v2-equipped/);
});

test("reload consumes resources only from Active Inventory", async ({ page }) => {
  await bootHarness(page);
  await page.evaluate(() => {
    const state = window.LuminousInventoryHudV2.state;
    state.unit.inventario_activo.loader = {
      instanceId: "loader", definitionId: "loader", nombre: "Test Loader", category: "tool", quantity: 1, qualityTier: 2, condition: 100, conditionMax: 100,
      chargesCurrent: 0, chargesMax: 1, rechargeRule: { resourceDefinitionId: "battery_cell", resourceAmount: 1, amount: 1 },
    };
    state.unit.inventario_stash.battery_stash = { instanceId: "battery_stash", definitionId: "battery_cell", nombre: "Battery Cell", category: "ammo", quantity: 5, qualityTier: 2, condition: 100, conditionMax: 100 };
    window.LuminousInventoryHudV2.renderAll();
  });
  await page.locator('#inv-active-grid [data-key="loader"]').click();
  await page.locator("#inventory-v2-actions .inventory-v2-action", { hasText: "RELOAD" }).click();
  await expect(page.locator("#inventory-v2-action-status")).toContainText("MISSING RESOURCE");
  expect(await page.evaluate(() => window.LuminousInventoryHudV2.state.unit.inventario_stash.battery_stash.quantity)).toBe(5);

  await page.evaluate(() => {
    const state = window.LuminousInventoryHudV2.state;
    state.unit.inventario_activo.battery_active = { instanceId: "battery_active", definitionId: "battery_cell", nombre: "Battery Cell", category: "ammo", quantity: 2, qualityTier: 2, condition: 100, conditionMax: 100 };
    window.LuminousInventoryHudV2.renderAll();
  });
  await page.locator('#inv-active-grid [data-key="loader"]').click();
  await page.locator("#inventory-v2-actions .inventory-v2-action", { hasText: "RELOAD" }).click();
  await page.waitForFunction(() => window.__saves.length > 0);
  expect(await page.evaluate(() => window.LuminousInventoryHudV2.state.unit.inventario_activo.battery_active.quantity)).toBe(1);
  expect(await page.evaluate(() => window.LuminousInventoryHudV2.state.unit.inventario_stash.battery_stash.quantity)).toBe(5);
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

test("canonical persistence mirrors keep Synthesis and legacy charge readers alive", async ({ page }) => {
  await page.setContent("<!doctype html><html><head></head><body></body></html>");
  await page.addScriptTag({ path: ITEM_RUNTIME });
  await page.addScriptTag({ path: INVENTORY_RUNTIME });
  await page.addScriptTag({ path: PERSISTENCE_RUNTIME });

  const result = await page.evaluate(() => {
    const raw = {
      legacy_key: {
        id: "battery_tool",
        nombre: "Battery Tool",
        cantidad: 3,
        icono: "battery.png",
        valorBase: 125,
        carga_actual: 2,
        vinculo_item: "battery_cell",
        vinculo_cantidad: 2,
        vinculo_stacks_max: 5,
      },
    };
    const state = window.LuminousItemPersistenceRuntime.deserializeInventoryState({ inventario_activo: raw });
    const item = Object.values(state.inventario_activo)[0];
    const loaded = {
      quantity: item.quantity,
      chargesCurrent: item.chargesCurrent,
      chargesMax: item.chargesMax,
      rechargeResource: item.rechargeRule?.resourceDefinitionId || null,
    };
    item.quantity = 2;
    item.chargesCurrent = 3;
    const saved = window.LuminousItemPersistenceRuntime.serializeContainer({ [item.instanceId]: item });
    return { loaded, saved: saved[item.instanceId] };
  });

  expect(result.loaded.quantity).toBe(3);
  expect(result.loaded.chargesCurrent).toBe(2);
  expect(result.loaded.chargesMax).toBe(5);
  expect(result.loaded.rechargeResource).toBe("battery_cell");
  expect(result.saved.quantity).toBe(2);
  expect(result.saved.cantidad).toBe(2);
  expect(result.saved.chargesCurrent).toBe(3);
  expect(result.saved.carga_actual).toBe(3);
  expect(result.saved.carga_maxima).toBe(5);
  expect(result.saved.vinculo_item).toBe("battery_cell");
  expect(result.saved.vinculo_cantidad).toBe(2);
  expect(result.saved.icono).toBe("battery.png");
  expect(result.saved.valorBase).toBe(125);
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
