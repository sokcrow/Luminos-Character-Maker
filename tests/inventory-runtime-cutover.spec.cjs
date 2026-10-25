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
const GOTHIC_CSS = path.join(ROOT, "css/inventory-gothic-art.css");
const REFERENCE_CSS = path.join(ROOT, "css/inventory-hud-reference.css");
const SHEET_CSS = path.join(ROOT, "hoja_personaje.css");

async function bootHarness(page) {
  // Exercise the production inventory DOM, never a second legacy detail sidebar.
  const sheet = fs.readFileSync(path.join(ROOT, "hoja_personaje.html"), "utf8");
  const start = sheet.indexOf("<!-- Inventory Modal -->");
  const end = sheet.indexOf("<!-- Toggle Button -->", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  await page.setContent('<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' +
    '<button type="button" id="btn-global-inventory">Inventory</button>' + sheet.slice(start, end) + '</body></html>');
  // Reproduce the production cascade: the old sheet still declares a 74px Active grid.
  const legacySheetCss = fs.readFileSync(SHEET_CSS, "utf8");
  const legacyActiveGridRule = legacySheetCss.match(/#inv-active-grid\s*\{[^}]*height:\s*74px;[^}]*\}/)?.[0];
  const legacyItemDisplayRule = legacySheetCss.match(/\.item-display\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*\}/)?.[0];
  expect(legacyActiveGridRule).toBeTruthy();
  expect(legacyItemDisplayRule).toBeTruthy();
  await page.addStyleTag({ content: legacyActiveGridRule + "\n" + legacyItemDisplayRule });
  await page.addStyleTag({ path: CSS });
  await page.addStyleTag({ path: GOTHIC_CSS });
  await page.addStyleTag({ path: REFERENCE_CSS });

  await page.evaluate(() => {
    const active = {
      blade_1: { instanceId: "blade_1", definitionId: "blade", nombre: "Test Workshop Blade", descripcion: "Instance presentation wins", category: "weapon", tier: 3, qualityTier: 3, condition: 90, conditionMax: 100, quantity: 1, valorBase: 120, installedModules: [{ definitionId: "serrated_edge", instanceId: "module_1" }] },
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
  await page.locator("#btn-global-inventory").click();
  await page.waitForFunction(() => window.LuminousInventoryHudV2?.state?.peer?.bound && document.querySelectorAll("#inv-active-grid [data-key]").length === 2);
}

test("HUD V2 uses gothic layout with 24 Active inventory slots", async ({ page }) => {
  await bootHarness(page);
  expect(await page.evaluate(() => typeof window.renderInventoryGrid)).toBe("undefined");
  await expect(page.locator(".inventory-v2-equipment")).toHaveCount(1);
  await expect(page.locator(".inventory-v2-equipment [data-equipment-slot]")).toHaveCount(8);
  await expect(page.locator('[data-equipment-slot="augment0"]')).toHaveCount(1);
  await expect(page.locator('[data-equipment-slot="augment1"]')).toHaveCount(1);
  await expect(page.locator("#inv-active-grid .inventory-v2-runtime-slot")).toHaveCount(24);
  await expect(page.locator("#inv-active-grid .inventory-v2-empty-slot")).toHaveCount(22);
  await expect(page.locator("#inventory-v2-carry-count")).toHaveText("02 / 24");
  await expect(page.locator("#inventory-v2-stash-count")).toContainText("01 / 80 SLOTS");
  const layout = await page.locator("#inv-active-grid").evaluate((el) => {
    const first = el.querySelector('[data-key="blade_1"]');
    return {
      columns: getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length,
      cardWidth: first?.getBoundingClientRect().width || 0,
    };
  });
  expect(layout.columns).toBeGreaterThanOrEqual(4);
  expect(layout.columns).toBeLessThanOrEqual(6);
  expect(layout.cardWidth).toBeGreaterThanOrEqual(65);
  expect(layout.cardWidth).toBeLessThan(160);

  const card = page.locator('#inv-active-grid [data-key="blade_1"]');
  const name = card.locator(".item-name");
  await expect(name).toHaveText("Test Workshop Blade");
  await expect(name).toBeHidden();
  await expect(card.locator(".tier")).toHaveText("III");
  await expect(card.locator(".inventory-v2-icon-holder")).toHaveCount(1);
  await expect(card.locator(".inventory-v2-card-meta")).toHaveCount(0);
  await expect(card.locator(".inventory-v2-card-value")).toHaveCount(0);
  await expect(card.locator(".inventory-v2-card-qty")).toHaveCount(0);
  await expect(card.locator(".item-quantity")).toHaveCount(0);
  await expect(card.locator(".inventory-v2-equip-marker")).toHaveCount(0);
  await expect(card.locator(".inventory-v2-item-state")).toHaveCount(0);

  const geometry = await card.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const icon = el.querySelector(".item-icon").getBoundingClientRect();
    const holder = el.querySelector(".inventory-v2-icon-holder").getBoundingClientRect();
    const name = el.querySelector(".item-name").getBoundingClientRect();
    return {
      cardWidth: box.width,
      cardHeight: box.height,
      iconWidth: icon.width,
      nameWidth: name.width,
      iconCentered: Math.abs((icon.left + icon.right) / 2 - (box.left + box.right) / 2) <= 4,
      holderCentered: Math.abs((holder.left + holder.right) / 2 - (box.left + box.right) / 2) <= 4,
      nameCentered: Math.abs((name.left + name.right) / 2 - (box.left + box.right) / 2) <= 4,
      nameBelowIcon: name.top >= icon.bottom - 2,
    };
  });
  expect(Math.abs(geometry.cardWidth - geometry.cardHeight)).toBeLessThanOrEqual(4);
  expect(geometry.iconWidth).toBeGreaterThanOrEqual(30);
  expect(geometry.nameWidth).toBe(0); // Design: reveal name only inside popup.
  expect(geometry.iconCentered).toBe(true);
  expect(geometry.holderCentered).toBe(true);
});

test("Pertenencias uses compact effect letters in the icon corner, never prices", async ({ page }) => {
  await bootHarness(page);
  await page.evaluate(() => {
    window.LuminousItemEffectIndicator = {
      indicators(item) {
        if (item.instanceId === "hybrid_1") return [
          { kind: "hp", tone: "hp", label: "HP +12", detail: "Restore 12 HP" },
          { kind: "hp_regen", tone: "hp", label: "HP REGEN +2", detail: "Regenerates HP" },
          { kind: "sp", tone: "sp", label: "SP +4", detail: "Restore 4 SP" },
          { kind: "cleanse", tone: "cleanse", label: "Bleeding", detail: "Cleanses Bleeding" },
        ];
        if (item.instanceId === "med_1") return [
          { kind: "hp", tone: "hp", label: "HP +8", detail: "Restore 8 HP" },
        ];
        return [];
      },
    };
    window.LuminousInventoryHudV2.state.unit.inventario_activo.hybrid_1 = {
      instanceId: "hybrid_1", definitionId: "hybrid", nombre: "Hybrid Restoration Ampoule",
      category: "consumable", tier: 4, quantity: 3, valorBase: 999,
    };
    window.LuminousInventoryHudV2.renderAll();
  });

  const hybrid = page.locator('#inv-active-grid [data-key="hybrid_1"]');
  await expect(hybrid.locator(".tier")).toHaveText("IV");
  await expect(hybrid.locator(".item-name")).toHaveText("Hybrid Restoration Ampoule");
  await expect(hybrid.locator(".inventory-v2-icon-effect")).toHaveText(["HP", "SP", "CUR"]);
  await expect(hybrid.locator(".inventory-v2-icon-effect-hp")).toHaveAttribute("title", /Restore 12 HP/);
  const hpMarker = hybrid.locator(".inventory-v2-icon-effect-hp");
  const hitTest = await hpMarker.evaluate((marker) => {
    const rect = marker.getBoundingClientRect();
    return document.elementFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2) === marker;
  });
  expect(hitTest).toBe(true);
  await hpMarker.click();
  await expect(page.locator("#detail-title")).toHaveText("Hybrid Restoration Ampoule");
  await expect(hybrid).toHaveAttribute("aria-label", /effects HP, SP, CUR/);
  await expect(hybrid.locator(".inventory-v2-card-meta, .inventory-v2-card-value, .inventory-v2-card-qty")).toHaveCount(0);
  await expect(hybrid.locator(".item-quantity")).toHaveText("x3");
  await expect(hybrid.locator(".inventory-v2-effect-rail")).toHaveCount(0);
  const stash = page.locator('#inv-stash-grid [data-key="med_1"]');
  await expect(stash.locator(".inventory-v2-effect-rail")).toHaveCount(1);
  await expect(stash.locator(".inventory-v2-icon-effects")).toHaveCount(0);

  for (const viewport of [
    { width: 1500, height: 950 },
    { width: 800, height: 700 },
    { width: 390, height: 800 },
    { width: 320, height: 700 },
    { width: 812, height: 375 },
  ]) {
    await page.setViewportSize(viewport);
    await page.locator("#inventory-v2-detail-close").click();
    const layout = await hybrid.evaluate((tile) => {
      const card = tile.getBoundingClientRect();
      const holder = tile.querySelector(".inventory-v2-icon-holder").getBoundingClientRect();
      const icon = tile.querySelector(".item-icon").getBoundingClientRect();
      const name = tile.querySelector(".item-name");
      const marker = tile.querySelector(".inventory-v2-icon-effect").getBoundingClientRect();
      const mid = (r) => (r.left + r.right) / 2;
      return {
        square: Math.abs(card.width - card.height),
        iconCenter: Math.abs(mid(card) - mid(icon)),
        nameHidden: getComputedStyle(name).display === "none",
        badgeNearTopRight: marker.right >= holder.right - 20 && marker.right <= holder.right + 8 &&
          marker.top >= holder.top - 8 && marker.top <= holder.top + 13,
      };
    });
    expect(layout.square, JSON.stringify(viewport)).toBeLessThanOrEqual(4);
    expect(layout.iconCenter, JSON.stringify(viewport)).toBeLessThanOrEqual(4);
    expect(layout.nameHidden, JSON.stringify(viewport)).toBe(true);
    expect(layout.badgeNearTopRight, JSON.stringify(viewport)).toBe(true);
    await hybrid.click();
    await expect(page.locator("#detail-title")).toHaveText("Hybrid Restoration Ampoule");
    await expect(page.locator("#detail-cost-val")).toHaveText("999");
  }
});

test("Desktop panels stay square and mobile keeps the character left of centered item icons", async ({ page }) => {
  await bootHarness(page);
  for (const viewport of [
    { width: 1500, height: 950 },
    { width: 1200, height: 720 },
    { width: 820, height: 850 },
    { width: 390, height: 800 },
    { width: 320, height: 700 },
    { width: 812, height: 375 },
  ]) {
    await page.setViewportSize(viewport);
    const geometry = await page.evaluate(() => {
      const measure = (selector) => {
        const el = document.querySelector(selector);
        const rect = el.getBoundingClientRect();
        return { width: rect.width, height: rect.height, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, centerX: (rect.left + rect.right) / 2 };
      };
      return {
        equipment: measure(".inventory-v2-equipment"),
        carry: measure(".inventory-v2-carry"),
        equipmentSlot: measure('[data-equipment-slot="mainHand"]'),
        itemCard: measure('#inv-active-grid [data-key="blade_1"]'),
        itemIcon: measure('#inv-active-grid [data-key="blade_1"] .item-icon'),
        itemName: measure('#inv-active-grid [data-key="blade_1"] .item-name'),
        gridHost: measure(".inventory-v2-grid-host"),
      };
    });

    for (const panel of [geometry.equipment, geometry.carry]) {
      expect(panel.width, JSON.stringify(viewport)).toBeGreaterThan(85);
      if (viewport.width > 1024) {
        expect(Math.abs(panel.width - panel.height), JSON.stringify(viewport)).toBeLessThanOrEqual(4);
      }
    }
    expect(geometry.equipment.right, JSON.stringify(viewport)).toBeLessThanOrEqual(geometry.carry.left + 2);
    expect(Math.abs(geometry.equipment.top - geometry.carry.top), JSON.stringify(viewport)).toBeLessThanOrEqual(8);
    expect(Math.abs(geometry.equipmentSlot.width - geometry.equipmentSlot.height), JSON.stringify(viewport)).toBeLessThanOrEqual(4);
    expect(Math.abs(geometry.itemCard.width - geometry.itemCard.height), JSON.stringify(viewport)).toBeLessThanOrEqual(4);
    expect(Math.abs(geometry.itemIcon.centerX - geometry.itemCard.centerX), JSON.stringify(viewport)).toBeLessThanOrEqual(4);
    expect(geometry.itemCard.top, JSON.stringify(viewport)).toBeGreaterThanOrEqual(geometry.gridHost.top - 1);
    await page.locator('#inv-active-grid [data-key="blade_1"]').click();
    await expect(page.locator("#detail-title")).toHaveText("Test Workshop Blade");
    await page.locator("#inventory-v2-detail-close").click();
  }
});

test("Active icons stay inside minimal tiles and names appear only in popup", async ({ page }) => {
  await bootHarness(page);
  // The complete legacy sheet includes item-slot flex rules missing from the minimal harness.
  await page.addStyleTag({ content: fs.readFileSync(SHEET_CSS, "utf8").replace(/@import[^;]+;/g, "") });
  await page.addStyleTag({ path: CSS });
  await page.addStyleTag({ path: GOTHIC_CSS });
  for (const viewport of [{ width: 1239, height: 694 }, { width: 1920, height: 1080 }, { width: 390, height: 800 }]) {
    await page.setViewportSize(viewport);
    const card = page.locator('#inv-active-grid [data-key="blade_1"]');
    await card.scrollIntoViewIfNeeded();
    const geometry = await card.evaluate(tile => {
      const outer = tile.getBoundingClientRect();
      const icon = tile.querySelector(".item-icon");
      const rect = icon.getBoundingClientRect();
      const name = tile.querySelector(".item-name");
      return {
        inside: rect.left >= outer.left && rect.right <= outer.right && rect.top >= outer.top && rect.bottom <= outer.bottom,
        iconWidth: rect.width,
        nameHidden: getComputedStyle(name).display === "none"
      };
    });
    expect(geometry.inside, JSON.stringify({ viewport })).toBe(true);
    expect(geometry.iconWidth).toBeGreaterThan(20);
    expect(geometry.nameHidden).toBe(true);
  }
});

test("Phone equipment keeps fourth row and vitals reachable in the left panel", async ({ page }) => {
  await bootHarness(page);
  for (const width of [320, 375, 390, 430, 475]) {
    await page.setViewportSize({ width, height: 800 });
    const measured = await page.evaluate(() => {
      const equipment = document.querySelector(".inventory-v2-equipment");
      const field = document.querySelector(".inventory-v2-equipment-field");
      const vitals = document.querySelector(".inventory-v2-vitals-strip");
      field.scrollTop = 0;
      const outer = equipment.getBoundingClientRect();
      const scrollArea = field.getBoundingClientRect();
      const status = vitals.getBoundingClientRect();
      return {
        panelWidth: outer.width,
        panelHeight: outer.height,
        fieldMinHeight: getComputedStyle(field).minHeight,
        fieldOverflow: getComputedStyle(field).overflowY,
        scrollHeight: field.scrollHeight,
        clientHeight: field.clientHeight,
        fieldBottom: scrollArea.bottom,
        vitalsTop: status.top,
        vitalsBottom: status.bottom,
        panelBottom: outer.bottom,
      };
    });

    expect(measured.fieldMinHeight, `phone width ${width}`).toBe("0px");
    expect(measured.fieldOverflow, `phone width ${width}`).toBe("auto");
    expect(measured.panelHeight, `phone width ${width}`).toBeGreaterThan(measured.panelWidth);
    expect(measured.clientHeight, `phone width ${width}`).toBeGreaterThan(10);
    expect(measured.scrollHeight, `phone width ${width}`).toBeGreaterThanOrEqual(measured.clientHeight);
    expect(measured.fieldBottom, `phone width ${width}`).toBeLessThanOrEqual(measured.vitalsTop + 2);
    expect(measured.vitalsBottom, `phone width ${width}`).toBeLessThanOrEqual(measured.panelBottom + 2);

    const lastSlot = page.locator('[data-equipment-slot="augment1"]');
    await lastSlot.evaluate((element) => {
      element.dataset.clicked = "false";
      element.addEventListener("click", () => { element.dataset.clicked = "true"; }, { once: true });
    });
    await lastSlot.click();
    await expect(lastSlot).toHaveAttribute("data-clicked", "true");
    const scrolled = await page.locator(".inventory-v2-equipment-field").evaluate((el) => el.scrollTop);
    if (measured.scrollHeight > measured.clientHeight + 1) {
      expect(scrolled, `phone width ${width}`).toBeGreaterThan(0);
    }
  }
});

test("Active inventory slots 1–5 remain reachable above the carry HUD", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 720 });
  await bootHarness(page);
  await page.evaluate(() => {
    const inventory = window.LuminousInventoryHudV2.state.unit.inventario_activo;
    for (let index = 3; index <= 5; index += 1) {
      inventory["slot_" + index] = {
        instanceId: "slot_" + index,
        definitionId: "testing_item",
        nombre: "Active Slot " + index,
        category: "tool",
        quantity: 1,
      };
    }
    window.LuminousInventoryHudV2.renderAll();
  });

  for (const viewport of [
    { width: 1200, height: 720 },
    { width: 800, height: 650 },
    { width: 390, height: 800 },
    { width: 812, height: 375 },
  ]) {
    await page.setViewportSize(viewport);
    const geometry = await page.locator("#inv-active-grid").evaluate((grid) => {
      const tiles = [...grid.querySelectorAll(".inventory-v2-runtime-slot")];
      const gridRect = grid.getBoundingClientRect();
      return {
        height: gridRect.height,
        lastTileBottom: tiles.at(-1).getBoundingClientRect().bottom - gridRect.top,
        firstTileTop: tiles[0].getBoundingClientRect().top - gridRect.top,
      };
    });
    expect(geometry.firstTileTop).toBeGreaterThanOrEqual(-1);
    // Tile borders may protrude by 1–2 CSS pixels without hiding interactive content.
    expect(geometry.lastTileBottom).toBeLessThanOrEqual(geometry.height + 3);

    for (const key of ["blade_1", "coat_1", "slot_3", "slot_4", "slot_5"]) {
      const tile = page.locator('#inv-active-grid [data-key="' + key + '"]');
      await tile.click();
      await expect(tile).toHaveClass(/active/);
      await expect(page.locator("#detail-title")).toHaveText(key === "blade_1" ? "Test Workshop Blade" : key === "coat_1" ? "Reinforced Coat" : "Active Slot " + key.slice(-1));
      await page.locator("#inventory-v2-detail-close").click();
    }
  }
});

test("inventory shows the combat sprite rather than the portrait, with a fallback", async ({ page }) => {
  await bootHarness(page);
  const hud = page.locator(".inventory-v2-combat-stage");
  await expect(hud).toHaveCount(1);
  await expect(page.locator(".inventory-v2-combat-sprite")).toHaveCount(1);
  await page.evaluate(() => {
    const inv = window.LuminousInventoryHudV2;
    inv.hydratePlayerVitals({
      combatSprite: "https://example.invalid/battle-sprite.png",
      icono_jugador: "https://example.invalid/hud-portrait.png",
      spriteX: 12, spriteY: -4, visualScale: 1.2,
    });
    inv.renderAll();
  });
  await expect(page.locator(".inventory-v2-combat-sprite")).toHaveAttribute("src", "https://example.invalid/battle-sprite.png");
  const result = await page.evaluate(() => window.LuminousInventoryHudV2.state.combatSprite);
  expect(result).toMatchObject({ src: "https://example.invalid/battle-sprite.png", x: 12, y: -4, scale: 1.2 });
  await page.evaluate(() => {
    window.LuminousInventoryHudV2.hydratePlayerVitals({ icono_jugador: "https://example.invalid/hud-portrait.png" });
    window.LuminousInventoryHudV2.renderAll();
  });
  await expect(page.locator(".inventory-v2-combat-sprite")).not.toHaveAttribute("src", /portrait/);
  await expect(page.locator(".inventory-v2-sprite-fallback")).toBeVisible();
});

test("combat sprite sources accept relative paths and data images from the DM editor", async ({ page }) => {
  await bootHarness(page);
  const img = page.locator(".inventory-v2-combat-sprite");
  const sources = ["dm-custom.png", "./sprites/player.png", "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="];
  for (const src of sources) {
    await page.evaluate((url) => {
      const inv = window.LuminousInventoryHudV2;
      inv.hydratePlayerVitals({ combatSprite: url, icono_jugador: "portrait-only.png" });
      inv.renderAll();
    }, src);
    await expect(img).toHaveAttribute("src", src);
  }
  await expect(img).toBeVisible();
  await expect(page.locator(".inventory-v2-sprite-fallback")).toBeHidden();
});

test("inventory HUD respects explicitly disabled active capacity", async ({ page }) => {
  await bootHarness(page);
  await page.evaluate(() => {
    const hud = window.LuminousInventoryHudV2;
    hud.state.unit.inventoryRules = { activeSlotLimit: 0 };
    hud.state.unit.inventario_activo = {};
    hud.renderAll();
  });
  await expect(page.locator("#inventory-v2-carry-count")).toHaveText("00 / 0");
  await expect(page.locator("#inv-active-grid .inventory-v2-runtime-slot")).toHaveCount(0);
});

test("player item detail hides implementation metadata and only shows relevant state", async ({ page }) => {
  await bootHarness(page);
  await page.locator('#inv-active-grid [data-key="blade_1"]').click();

  const selectedGrid = await page.locator("#inv-active-grid").evaluate((el) => {
    const first = el.querySelector('[data-key="blade_1"]');
    return {
      columns: getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length,
      cardWidth: first?.getBoundingClientRect().width || 0,
    };
  });
  expect(selectedGrid.columns).toBeGreaterThanOrEqual(4);
  expect(selectedGrid.columns).toBeLessThanOrEqual(6);
  expect(selectedGrid.cardWidth).toBeGreaterThanOrEqual(65);
  expect(selectedGrid.cardWidth).toBeLessThan(160);

  await expect(page.locator("#detail-title")).toHaveText("Test Workshop Blade");
  await expect(page.locator("#detail-desc")).toHaveText("Instance presentation wins");
  await expect(page.locator(".inventory-v2-player-facts")).toContainText("CONDITION");
  await expect(page.locator(".inventory-v2-player-facts")).toContainText("90%");

  const technicalDetailKeys = ["category", "stack", "quality", "manufacturer", "product-line", "serial", "instance"];
  for (const key of technicalDetailKeys) {
    await expect(page.locator(`[data-v2-detail="${key}"]`)).toHaveCount(0);
  }
  await expect(page.locator(".inventory-v2-player-facts")).not.toContainText("[object Object]");
  await expect(page.locator('.inventory-v2-modules[data-v2-detail-section="modules"]')).toBeVisible();
  await expect(page.locator('[data-v2-detail="modules"]')).toContainText("Serrated Edge");
  await expect(page.locator(".inventory-v2-item-category")).toHaveCount(0);

  const geometry = await page.locator("#item-detail-card").evaluate((card) => {
    const left = card.querySelector(".detail-left").getBoundingClientRect();
    const right = card.querySelector(".detail-right").getBoundingClientRect();
    const extra = card.querySelector(".inventory-v2-detail-extra").getBoundingClientRect();
    const buttons = [...card.querySelectorAll(".inventory-v2-action")].map((button) => button.getBoundingClientRect());
    return {
      card: card.getBoundingClientRect().width,
      left: left.width,
      right: right.width,
      extra: extra.width,
      extraInsideRight: card.querySelector(".inventory-v2-detail-extra").parentElement.classList.contains("detail-right"),
      buttons: buttons.map((box) => box.width),
    };
  });
  expect(geometry.extraInsideRight).toBe(true);
  expect(geometry.right).toBeGreaterThan(220);
  expect(geometry.extra).toBeLessThanOrEqual(geometry.right + 1);
  expect(Math.max(...geometry.buttons)).toBeLessThan(geometry.right * 0.72);
});

test("inventory runtime freezes 24/80 capacity and family stack limits", async ({ page }) => {
  await bootHarness(page);
  const result = await page.evaluate(() => {
    const inv = window.LuminousItemInventoryRuntime;
    return {
      activeSlots: inv.activeSlotLimit({}),
      legacySlots: inv.activeSlotLimit({ activeSlotLimit: 20 }),
      legacyNestedSlots: inv.activeSlotLimit({ inventoryRules: { activeSlotLimit: 20 } }),
      dmDisabledSlots: inv.activeSlotLimit({ inventoryRules: { activeSlotLimit: 0 } }),
      dmRestrictedSlots: inv.activeSlotLimit({ activeSlotLimit: 12 }),
      expandedSlots: inv.activeSlotLimit({ activeSlotLimit: 30 }),
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
    activeSlots: 24, legacySlots: 24, legacyNestedSlots: 24, dmDisabledSlots: 0, dmRestrictedSlots: 12, expandedSlots: 30, stashSlots: 80,
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
    for (let i = 0; i < 24; i += 1) fullActive.inventario_activo[`active_${i}`] = make(`active_${i}`);
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

test("gothic inventory preserves two readable mobile columns without horizontal modal overflow", async ({ page }) => {
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
  // The inventory surface is inert behind a modal. Equip through its action.
  await page.locator("#inventory-v2-actions .inventory-v2-action", { hasText: "EQUIP" }).click();
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

  await page.locator("#inventory-v2-detail-close").click();
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

test("player item details compare identified Enchantments without revealing unidentified magic", async ({page}) => {
  await bootHarness(page);
  await page.evaluate(() => {
    const hud=window.LuminousInventoryHudV2;
    const unit=hud.state.unit;
    const original=unit.inventario_activo.blade_1;
    const candidate=unit.inventario_activo.coat_1;
    candidate.category="weapon";
    candidate.itemType="weapon";
    original.magic={enabled:true,enchantments:[{definitionId:"flamebound",rank:1}]};
    candidate.magic={enabled:true,enchantments:[{definitionId:"frostbound",rank:1}]};
    unit.equipment.mainHand=original;
    window.LuminousItemMagicRuntime={isMagicItem:item=>Boolean(item?.magic)};
    window.LuminousItemMagicKnowledgeRuntime={
      presentation(viewer,item) {
        const identified=item.instanceId==="blade_1" || item.instanceId==="coat_1";
        const name=item.instanceId==="blade_1"?"Flamebound I":"Frostbound I";
        return {
          displayName:item.nombre,magical:true,magicDetected:true,identified,
          inscriptionGlowing:true,enchantmentLines:[{known:identified,text:name}],
          curseLines:[],difficulty:null,magicalDurability:null,
        };
      },
    };
    hud.state.selectedContainer="active";
    hud.state.selected={key:"coat_1",item:candidate};
    hud.renderDetail();
  });
  const facts=page.locator('[data-v2-detail="facts"]');
  await expect(facts).toContainText("VS EQUIPPED MAGIC");
  await expect(facts).toContainText("+ Frostbound I");
  await expect(facts).toContainText("− Flamebound I");
  await page.evaluate(() => {
    const knowledge=window.LuminousItemMagicKnowledgeRuntime;
    knowledge.presentation=(viewer,item)=>({
      displayName:item.nombre,magical:true,magicDetected:true,identified:false,
      inscriptionGlowing:true,enchantmentLines:[{known:false,text:"ᚠᛉᚻ"}],
      curseLines:[],difficulty:null,magicalDurability:null,
    });
    window.LuminousInventoryHudV2.renderDetail();
  });
  await expect(facts).not.toContainText("VS EQUIPPED MAGIC");
  await expect(facts).toContainText("Magia sin identificar");
  await expect(facts).not.toContainText("Flamebound I");
});


test("rejected Firebase Arcana save restores spent SP and both learned and previous knowledge", async ({ page }) => {
  await bootHarness(page);
  await page.locator('#inv-active-grid [data-key="blade_1"]').click();
  await page.evaluate(() => {
    const hud=window.LuminousInventoryHudV2;
    const unit=hud.state.unit;
    unit.sp=3;
    unit.itemMagicKnowledge={blade_1:{magicDetected:true,updatedAt:1234},coat_1:{difficultyKnown:true}};
    unit.inventario_activo.blade_1.magic={enabled:true,enchantments:[{definitionId:"flamebound",rank:1}]};
    hud.state.vitalsReady=true;
    window.__arcanaSaveCalls=0;
    hud.state.db={ref(path){ return {async update(patch){
      window.__arcanaSaveCalls++;
      window.__arcanaAttempted=JSON.parse(JSON.stringify(patch));
      throw Error("permission_denied");
    }};}};
    window.LuminousItemPersistenceRuntime.serializeInventoryState=()=>({
      schemaVersion:3,inventario_activo:unit.inventario_activo,
      inventario_stash:unit.inventario_stash,equipmentRefs:{},attunedItemInstanceIds:[],
    });
    window.LuminousPlayerVitalsHud={persistencePatch:viewer=>({
      sp:viewer.sp,combatStats:{sp_actual:viewer.sp},
    })};
    window.LuminousItemMagicRuntime={isMagicItem:item=>!!item.magic};
    window.LuminousItemMagicKnowledgeRuntime={
      presentation:()=>({magical:true,magicDetected:true,identified:false,
        displayName:"Enchanted Test Workshop Blade",enchantmentLines:[],curseLines:[]}),
      studyArcana(viewer,item){
        viewer.sp-=1;
        viewer.itemMagicKnowledge[item.instanceId]={
          magicDetected:true,enchantmentIdentified:true,updatedAt:9999,
        };
        return {studied:true,success:true,total:30,target:22,spSpent:1};
      },
    };
    hud.renderAll();
  });
  await expect(page.locator('#inventory-v2-actions button',{hasText:"STUDY ARCANA"})).toHaveCount(1);
  await page.locator("#inventory-v2-actions button", {hasText:"STUDY ARCANA"}).click();
  await expect.poll(()=>page.evaluate(()=>window.__arcanaSaveCalls)).toBe(1);
  await expect(page.locator("#inventory-v2-action-status")).toContainText("ARCANA NO GUARDADA");
  const state=await page.evaluate(()=>{
    const unit=window.LuminousInventoryHudV2.state.unit;
    return {sp:unit.sp,knowledge:unit.itemMagicKnowledge,
      attemptedSp:window.__arcanaAttempted.sp,
      attemptedKnowledge:window.__arcanaAttempted.itemMagicKnowledge,
      pending:window.LuminousInventoryHudV2.state.arcanaStudyPending};
  });
  expect(state.sp).toBe(3);
  expect(state.knowledge).toEqual({
    blade_1:{magicDetected:true,updatedAt:1234},
    coat_1:{difficultyKnown:true},
  });
  expect(state.attemptedSp).toBe(2);
  expect(state.attemptedKnowledge.blade_1.enchantmentIdentified).toBe(true);
  expect(state.pending).toBe(false);
});

test("successful Arcana save spends one SP and retains its learned knowledge",async ({page})=>{
  await bootHarness(page);
  await page.locator('#inv-active-grid [data-key="blade_1"]').click();
  await page.evaluate(()=>{
    const hud=window.LuminousInventoryHudV2;
    const unit=hud.state.unit;
    unit.sp=3;
    delete unit.itemMagicKnowledge;
    unit.inventario_activo.blade_1.magic={enabled:true,enchantments:[{definitionId:"flamebound",rank:1}]};
    hud.state.vitalsReady=true;
    window.__arcanaSaveCalls=0;
    hud.state.db={ref(){return {async update(){
      window.__arcanaSaveCalls++;
    }}}};
    window.LuminousItemPersistenceRuntime.serializeInventoryState=()=>({
      schemaVersion:3,inventario_activo:unit.inventario_activo,
      inventario_stash:unit.inventario_stash,equipmentRefs:{},attunedItemInstanceIds:[],
    });
    window.LuminousPlayerVitalsHud={persistencePatch:viewer=>({sp:viewer.sp})};
    window.LuminousItemMagicRuntime={isMagicItem:item=>!!item.magic};
    window.LuminousItemMagicKnowledgeRuntime={
      presentation:()=>({magical:true,magicDetected:true,identified:false,
        displayName:"Enchanted Sword",enchantmentLines:[],curseLines:[]}),
      studyArcana(viewer,item){
        viewer.sp-=1;
        viewer.itemMagicKnowledge||={};
        viewer.itemMagicKnowledge[item.instanceId]={enchantmentIdentified:true};
        return {studied:true,success:true,total:28,target:22};
      },
    };
    hud.renderAll();
  });
  await page.locator("#inventory-v2-actions button",{hasText:"STUDY ARCANA"}).click();
  await expect.poll(()=>page.evaluate(()=>window.__arcanaSaveCalls)).toBe(1);
  expect(await page.evaluate(()=>{
    const u=window.LuminousInventoryHudV2.state.unit;
    return {sp:u.sp,knowledge:u.itemMagicKnowledge,pending:window.LuminousInventoryHudV2.state.arcanaStudyPending};
  })).toEqual({sp:2,knowledge:{blade_1:{enchantmentIdentified:true}},pending:false});
});
