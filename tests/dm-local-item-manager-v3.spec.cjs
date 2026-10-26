const { test, expect } = require("@playwright/test");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TAB_RUNTIME = path.join(ROOT, "js/dm-tab-runtime-v2.js");
const SHOP_RUNTIME = path.join(ROOT, "js/shop-runtime.js");
const ITEM_MANAGER = path.join(ROOT, "js/dm-local-item-manager-v3.js");
const JEWELRY_CATALOG = path.join(ROOT, "js/item-catalog-jewelry-valuables.js");

async function boot(page, withFirebase = false) {
  await page.setContent(`<!doctype html><html><body>
    <nav>
      <button class="dm-tab-btn active" data-tab="tab-tiempo">Tiempo</button>
      <button class="dm-tab-btn" data-tab="tab-forja">Ítems / Mercado</button>
    </nav>
    <div id="tab-tiempo" class="dm-tab-pane active">TIME</div>
    <div id="tab-forja" class="dm-tab-pane">
      <div id="dm-content-registry-counts">Cargando directorio local...</div>
      <div id="panel-consumo-item">
        <h4 id="consumo-item-nombre">Selecciona un Ítem</h4>
        <div id="consumo-item-detalles"></div>
        <select id="otorgar-item-jugador"><option value="">Seleccionar Jugador Destino...</option></select>
        <input id="otorgar-item-cant" value="1">
        <button id="btn-otorgar-stash">AL ALIJO</button>
        <button id="btn-otorgar-activo">EQUIPAR</button>
        <div id="dm-inline-player-inventory">
          <div id="dm-inline-player-inventory-status">Sin jugador.</div>
          <div id="dm-inline-inventory-active"></div>
          <div id="dm-inline-inventory-stash"></div>
        </div>
      </div>
      <input id="buscador-items-dm">
      <div id="filtros-dm"><button class="dm-filter-btn active" data-filter="todo">Todo</button></div>
      <div id="dm-item-catalog-status">Cargando directorio local...</div>
      <div id="grid-items-globales"></div>
      <select id="loot-select-item"></select>
    </div>
  </body></html>`);

  await page.evaluate((enableFirebase) => {
    window.alert = () => {};
    window.LuminousWeaponCatalog = {
      ITEMS: [
        { id: "test_sword", name: "Test Sword", category: "weapon", itemType: "weapon", priceAhn: 1200, tier: "I", tags: ["weapon"] },
        { id: "test_dagger", name: "Test Dagger", category: "weapon", itemType: "weapon", priceAhn: 800, tier: "I", tags: ["weapon"] }
      ]
    };

    if (!enableFirebase) return;

    window.__writes = [];
    window.__listeners = {};
    window.__dbData = {
      "campaña/jugadores/Alice/inventario_activo": {
        sword_1: {
          instanceId: "sword_1",
          definitionId: "test_sword",
          nombre: "Owned Sword",
          category: "weapon",
          quantity: 2,
          cantidad: 2
        }
      },
      "campaña/jugadores/Alice/inventario_stash": {
        med_1: {
          instanceId: "med_1",
          definitionId: "med",
          nombre: "Med",
          category: "consumable",
          quantity: 3,
          cantidad: 3
        }
      },
      "campaña/jugadores/Alice/itemEquipmentRefs": {
        mainHand: "sword_1",
        offHand: null,
        armor: null,
        shield: null,
        accessoryIds: []
      },
      "campaña/jugadores/Alice/attunedItemInstanceIds": ["sword_1"]
    };
    window.confirm = () => true;
    const snap = (key, value) => ({ key, val: () => value });

    function parentPathOf(path) {
      const parts = path.split("/");
      return parts.slice(0, -1).join("/");
    }

    function notifyValue(path) {
      const handler = window.__listeners[path + ":value"];
      if (handler) queueMicrotask(() => handler(snap(path.split("/").pop(), window.__dbData[path] || null)));
    }

    function writeChild(path, value) {
      const parent = parentPathOf(path);
      const key = path.split("/").pop();
      const container = { ...(window.__dbData[parent] || {}) };
      if (value == null) delete container[key];
      else container[key] = value;
      window.__dbData[parent] = container;
      notifyValue(parent);
    }

    function makeRef(refPath) {
      return {
        path: refPath,
        on(event, handler) {
          window.__listeners[refPath + ":" + event] = handler;
          if (refPath === "campaña/jugadores" && event === "child_added") {
            queueMicrotask(() => handler(snap("Alice", { nombre: "Alice" })));
          } else if (event === "value") {
            queueMicrotask(() => handler(snap(refPath.split("/").pop(), window.__dbData[refPath] || null)));
          }
        },
        off(event, handler) {
          if (!event || window.__listeners[refPath + ":" + event] === handler) {
            delete window.__listeners[refPath + ":" + event];
          }
        },
        once() {
          if (Object.prototype.hasOwnProperty.call(window.__dbData, refPath)) {
            return Promise.resolve({ val: () => window.__dbData[refPath] });
          }
          const parent = parentPathOf(refPath);
          const key = refPath.split("/").pop();
          const value = window.__dbData[parent]?.[key] ?? null;
          return Promise.resolve({ val: () => value });
        },
        child(key) {
          return makeRef(refPath + "/" + key);
        },
        transaction(updater) {
          const hasDirect = Object.prototype.hasOwnProperty.call(window.__dbData, refPath);
          const parent = parentPathOf(refPath);
          const key = refPath.split("/").pop();
          const current = hasDirect ? window.__dbData[refPath] : (window.__dbData[parent]?.[key] ?? null);
          const next = updater(current == null ? null : JSON.parse(JSON.stringify(current)));
          if (next === undefined) {
            return Promise.resolve({ committed: false, snapshot: { val: () => current } });
          }
          if (hasDirect || refPath.endsWith("/itemEquipmentRefs") || refPath.endsWith("/attunedItemInstanceIds")) {
            window.__dbData[refPath] = next;
            notifyValue(refPath);
          } else {
            writeChild(refPath, next);
          }
          window.__writes.push({ type: "transaction", path: refPath, value: next });
          return Promise.resolve({ committed: true, snapshot: { val: () => next } });
        },
        remove() {
          writeChild(refPath, null);
          window.__writes.push({ type: "remove", path: refPath, value: null });
          return Promise.resolve();
        },
        push() {
          const child = makeRef(refPath + "/new_1");
          child.key = "new_1";
          child.set = (value) => {
            writeChild(child.path, value);
            window.__writes.push({ type: "set", path: child.path, value });
            return Promise.resolve();
          };
          return child;
        }
      };
    }

    window.firebase = {
      apps: [{}],
      database() {
        return { ref: makeRef };
      }
    };
  }, withFirebase);

  await page.addScriptTag({ path: TAB_RUNTIME });
  await page.addScriptTag({ path: SHOP_RUNTIME });
  await page.addScriptTag({ path: ITEM_MANAGER });
}

test("DM tabs and local item directory work without Firebase or initializeDMApp", async ({ page }) => {
  await boot(page, false);

  await page.locator('[data-tab="tab-forja"]').click();
  await expect(page.locator("#tab-forja")).toHaveClass(/active/);
  await expect(page.locator("#grid-items-globales .card-item")).toHaveCount(2);
  await expect(page.locator("#dm-item-catalog-status")).toContainText("2 / 2 Items locales visibles");
  await expect(page.locator("#dm-content-registry-counts")).toContainText("Firebase no bloquea");
  await expect(page.locator("#loot-select-item option")).toHaveCount(3);
});

test("DM unified console renders selected Player Active and Stash inventories", async ({ page }) => {
  await boot(page, true);

  await expect(page.locator("#otorgar-item-jugador option")).toHaveCount(2);
  await page.locator("#otorgar-item-jugador").selectOption("Alice");

  await expect(page.locator("#dm-inline-player-inventory-status")).toContainText("Administrando: Alice");
  await expect(page.locator("#dm-inline-inventory-active [data-dm-inventory-key]")).toHaveCount(1);
  await expect(page.locator("#dm-inline-inventory-stash [data-dm-inventory-key]")).toHaveCount(1);
  await expect(page.locator("#dm-inline-inventory-active")).toContainText("Owned Sword");
  await expect(page.locator("#dm-inline-inventory-stash")).toContainText("Med");
});

test("DM unified console decrements only the selected stack", async ({ page }) => {
  await boot(page, true);
  await page.locator("#otorgar-item-jugador").selectOption("Alice");
  await expect(page.locator("#dm-inline-inventory-active")).toContainText("x2");

  await page.locator('#dm-inline-inventory-active [data-dm-inv-action="minus"]').click();
  await expect(page.locator("#dm-inline-inventory-active")).toContainText("x1");

  const result = await page.evaluate(() => ({
    item: window.__dbData["campaña/jugadores/Alice/inventario_activo"].sword_1,
    writes: window.__writes
  }));
  expect(result.item.quantity).toBe(1);
  expect(result.item.cantidad).toBe(1);
  expect(result.writes.filter((write) => write.path.includes("inventario_activo/sword_1"))).toHaveLength(1);
  expect(result.writes.some((write) => write.path.includes("inventario_stash/med_1"))).toBe(false);
});

test("DM unified console deletes a stack and clears equipment and attunement references", async ({ page }) => {
  await boot(page, true);
  await page.locator("#otorgar-item-jugador").selectOption("Alice");

  await page.locator('#dm-inline-inventory-active [data-dm-inv-action="delete"]').click();
  await expect(page.locator("#dm-inline-inventory-active")).toContainText("Vacío");

  const result = await page.evaluate(() => ({
    active: window.__dbData["campaña/jugadores/Alice/inventario_activo"],
    equipment: window.__dbData["campaña/jugadores/Alice/itemEquipmentRefs"],
    attuned: window.__dbData["campaña/jugadores/Alice/attunedItemInstanceIds"],
    writes: window.__writes
  }));
  expect(result.active.sword_1).toBeUndefined();
  expect(result.equipment.mainHand).toBeNull();
  expect(result.attuned).toEqual([]);
  expect(result.writes.some((write) => write.type === "remove" && write.path.endsWith("/inventario_activo/sword_1"))).toBe(true);
  expect(result.writes.some((write) => write.path.endsWith("/itemEquipmentRefs"))).toBe(true);
  expect(result.writes.some((write) => write.path.endsWith("/attunedItemInstanceIds"))).toBe(true);
});

test("DM grant writes only the affected inventory child", async ({ page }) => {
  await boot(page, true);

  await expect(page.locator("#otorgar-item-jugador option")).toHaveCount(2);
  await page.locator("#grid-items-globales .card-item").filter({ hasText: "Test Sword" }).click();
  await page.locator("#otorgar-item-jugador").selectOption("Alice");
  await page.locator("#otorgar-item-cant").fill("3");
  await page.locator("#btn-otorgar-stash").click();

  await page.waitForFunction(() => window.__writes.length === 1);
  const writes = await page.evaluate(() => window.__writes);
  expect(writes).toHaveLength(1);
  expect(writes[0].type).toBe("set");
  expect(writes[0].path).toBe("campaña/jugadores/Alice/inventario_stash/new_1");
  expect(writes[0].value.definitionId).toBe("test_sword");
  expect(writes[0].value.quantity).toBe(3);
  expect(writes[0].value.cantidad).toBe(3);
});

test("DM Valuable grant requires a real loot variant and preserves its canonical value", async ({ page }) => {
  await boot(page, true);
  await page.addScriptTag({ path: JEWELRY_CATALOG });
  await page.evaluate(() => window.LuminousDmLocalItemManagerV3.refreshLocal());

  const goblet = page.locator("#grid-items-globales .card-item").filter({ hasText: "Goblet" }).first();
  await expect(goblet).toContainText("₳ 420,000");
  await expect(goblet).toContainText("₳ 780,000");
  await goblet.click();

  await expect(page.locator("#dm-item-config-valuable-variant")).toHaveValue("gold");
  await expect(page.locator("#dm-item-economic-preview")).toContainText("Gold Goblet");
  await expect(page.locator("#dm-item-economic-preview")).toContainText("420,000");

  await page.locator("#dm-item-config-valuable-variant").selectOption("gems");
  await expect(page.locator("#dm-item-economic-preview")).toContainText("Gem-Inlaid Goblet");
  await expect(page.locator("#dm-item-economic-preview")).toContainText("780,000");

  await page.locator("#otorgar-item-jugador").selectOption("Alice");
  await page.locator("#btn-otorgar-stash").click();
  await page.waitForFunction(() => window.__writes.length === 1);

  const granted = await page.evaluate(() => window.__writes[0].value);
  expect(granted.definitionId).toBe("goblet");
  expect(granted.valuableVariant).toBe("gems");
  expect(granted.variantSignature).toBe("goblet:gems");
  expect(granted.productionValueAhn).toBe(780000);
  expect(granted.costo).toBe(780000);
  expect(granted.valorBase).toBe(780000);
});

test("DM zero-value component grant materializes the catalog reference composition", async ({ page }) => {
  await boot(page, true);

  await page.evaluate(() => {
    window.LuminousArmorComponentCatalog = {
      COMPONENTS: [{
        id: "armor_plate",
        name: "Armor Plate",
        family: "armor_components",
        category: "component",
        itemType: "armor_component",
        tier: "I",
        stackable: true,
        price: 0,
        costo: 0,
        valorBase: 0
      }],
      resolveReferenceComponent(id) {
        if (id !== "armor_plate") return null;
        return {
          valid: true,
          componentId: id,
          name: "Armor Plate",
          quality: "standard",
          composition: [{ materialId: "iron", quantity: 4 }],
          productionValueAhn: 156000
        };
      }
    };
    window.LuminousDmLocalItemManagerV3.refreshLocal();
  });

  const plate = page.locator("#grid-items-globales .card-item").filter({ hasText: "Armor Plate" }).first();
  await expect(plate).toContainText("CONFIGURAR");
  await plate.click();

  await expect(page.locator("#dm-item-economic-config")).toContainText("COMPOSICIÓN DE REFERENCIA");
  await expect(page.locator("#dm-item-economic-preview")).toContainText("156,000");
  await expect(page.locator("#btn-otorgar-stash")).toBeEnabled();

  await page.locator("#otorgar-item-jugador").selectOption("Alice");
  await page.locator("#btn-otorgar-stash").click();
  await page.waitForFunction(() => window.__writes.length === 1);

  const granted = await page.evaluate(() => window.__writes[0].value);
  expect(granted.definitionId).toBe("armor_plate");
  expect(granted.productionValueAhn).toBe(156000);
  expect(granted.costo).toBe(156000);
  expect(granted.valorBase).toBe(156000);
  expect(granted.composition).toEqual([{ materialId: "iron", quantity: 4 }]);
});
