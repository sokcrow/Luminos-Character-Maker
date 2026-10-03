const { test, expect } = require("@playwright/test");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TAB_RUNTIME = path.join(ROOT, "js/dm-tab-runtime-v2.js");
const ITEM_MANAGER = path.join(ROOT, "js/dm-local-item-manager-v3.js");

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
    const snap = (key, value) => ({ key, val: () => value });

    function makeRef(refPath) {
      return {
        path: refPath,
        on(event, handler) {
          window.__listeners[refPath + ":" + event] = handler;
          if (refPath === "campaña/jugadores" && event === "child_added") {
            queueMicrotask(() => handler(snap("Alice", { nombre: "Alice" })));
          }
        },
        once() {
          return Promise.resolve({ val: () => ({}) });
        },
        child(key) {
          return makeRef(refPath + "/" + key);
        },
        transaction(updater) {
          const next = updater(null);
          window.__writes.push({ type: "transaction", path: refPath, value: next });
          return Promise.resolve({ committed: true, snapshot: { val: () => next } });
        },
        push() {
          const child = makeRef(refPath + "/new_1");
          child.key = "new_1";
          child.set = (value) => {
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
