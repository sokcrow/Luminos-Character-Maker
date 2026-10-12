const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  for (const key of [
    "LuminousCookingEngine", "LuminousCookingV2Engine", "LuminousCookingRecipeCatalog",
    "LuminousCookingRecipeResolver", "LuminousCookingEquipmentEngine",
    "LuminousCookingRuntime", "LuminousCookingUi", "LuminousInventoryHudV2",
    "LuminousCoinEngine"
  ]) delete globalThis[key];

  const unit = {
    level: 5, sp: 12, proficiencyBonus: 3,
    stats: { destreza: 16, inteligencia: 14, sabiduria: 12 },
    currentCookingStationId: "grill",
    inventario_activo: {
      cooks: { definitionId: "cooks_utensils", quantity: 1, category: "tool" },
      bread: { instanceId: "bread-a", itemId: "finished_flatbread_a", recipeId: "flatbread", family: "food", category: "food", quantity: 2 },
      meat: { instanceId: "meat-a", itemId: "meat_wolf", quantity: 2, tags: ["ingredient", "meat", "wolf"], flavorTags: ["savory"] },
      veg: { instanceId: "veg-a", itemId: "carrot", quantity: 2, recipeRoles: ["vegetable"], itemTags: ["ingredient", "vegetable"], flavorTags: ["fresh"] },
      sauce: { instanceId: "sauce-a", itemId: "processed_sauce_base", quantity: 2, family: "processed_food", processed: true, processedForm: "sauce_base", tags: ["sauce_base", "liquid", "base"] }
    },
    inventario_stash: {}
  };

  let saveCalls = 0;
  let renderCalls = 0;
  globalThis.LuminousInventoryHudV2 = {
    state: { unit, peer: { async save() { saveCalls++; } } },
    renderAll() { renderCalls++; }
  };
  globalThis.LuminousCoinEngine = {
    async runAnimatedRoll() { return { total: 20, heads: 5 }; }
  };

  const elements = {};
  function element(id) {
    return elements[id] ||= {
      id, hidden: false, innerHTML: "", dataset: {}, textContent: "", listeners: {},
      setAttribute() {}, focus() {}, scrollIntoView() {},
      addEventListener(type, fn) { this.listeners[type] = fn; },
      appendChild(node) { elements[node.id] = node; },
      querySelector(selector) {
        if (selector === "[data-cook-close]") return element("fake-close");
        if (selector === "#cooking-v2-coins") return element("cooking-v2-coins");
        if (selector === "#cooking-v2-roll-results") return element("cooking-v2-roll-results");
        return null;
      }
    };
  }
  for (const id of ["cooking-v2-categories", "cooking-v2-list",
    "cooking-v2-detail", "cooking-v2-status", "cooking-v2-coins",
    "cooking-v2-roll-results", "fake-close"]) element(id);
  const tabHost = element("tab-host");
  globalThis.document = {
    readyState: "loading",
    activeElement: { focus() {} },
    body: element("body"),
    getElementById(id) { return elements[id] || null; },
    querySelector(selector) { return selector === "#inventory-modal .inventory-tabs" ? tabHost : null; },
    createElement(tag) { return { ...element("new-" + tag + "-" + Object.keys(elements).length), tagName: tag.toUpperCase() }; },
    addEventListener() {}
  };

  for (const file of [
    "../js/item-cooking-engine.js",
    "../js/item-cooking-recipe-catalog.js",
    "../js/item-cooking-v2-engine.js",
    "../js/item-cooking-recipe-resolver.js",
    "../js/item-cooking-equipment-engine.js",
    "../js/item-cooking-runtime.js",
    "../js/item-cooking-ui.js"
  ]) await import(pathToFileURL(path.resolve(__dirname, file)).href);

  const ui = globalThis.LuminousCookingUi;
  const recipes = globalThis.LuminousCookingRecipeCatalog;
  const resolver = globalThis.LuminousCookingRecipeResolver;
  const runtime = globalThis.LuminousCookingRuntime;
  assert.equal(ui.VERSION, 2);
  assert.equal(ui.categoryFor(recipes.get("vegetable_soup")), "soups");
  assert.equal(ui.categoryFor(recipes.get("coffee_cookie")), "desserts");
  assert.equal(ui.categoryFor(recipes.get("pancakes")), "meals");
  assert.equal(ui.categoryFor(recipes.get("apple_pie")), "desserts");
  assert.equal(ui.abilityBase(unit, "dex"), 3);
  assert.equal(ui.headsChance(unit), 62);
  assert.equal(ui.maxQuantity(recipes.get("burger"), runtime.inventoryView(unit).rows), 2);
  assert.ok(ui.craftable().some(row => row.recipeId === "burger"));
  assert.equal(resolver.resolveRecipe("burger", runtime.inventoryView(unit).rows).valid, true);

  assert.equal(ui.boot(), true);
  assert.equal(ui.open(), true);
  const modal = elements["cooking-v1-modal"];
  assert.equal(modal.hidden, false);
  assert.match(modal.innerHTML, /cooking-book-index/);
  assert.match(modal.innerHTML, /cooking-book-detail/);
  assert.match(elements["cooking-v2-categories"].innerHTML, /COMIDAS/);
  assert.match(elements["cooking-v2-categories"].innerHTML, /POSTRES/);
  assert.doesNotMatch(elements["cooking-v2-detail"].innerHTML, /Cooking Check Result/);

  function click(selector, dataset = {}) {
    const target = {
      closest(probe) { return probe === selector ? { dataset } : null; }
    };
    modal.listeners.click({ target });
  }
  click("[data-cook-recipe]", { cookRecipe: "burger" });
  assert.match(elements["cooking-v2-detail"].innerHTML, /INGREDIENTES/);
  assert.match(elements["cooking-v2-detail"].innerHTML, /EFECTOS/);
  assert.match(elements["cooking-v2-detail"].innerHTML, /COCINAR/);
  assert.match(elements["cooking-v2-detail"].innerHTML, /1 \/ 1|2 \/ 1/);
  click("[data-cook-quantity]", { cookQuantity: "1" });
  assert.match(elements["cooking-v2-detail"].innerHTML, /<strong>2<\/strong>/);

  click("[data-cook-confirm]");
  await new Promise(resolve => setTimeout(resolve, 30));
  const produced = Object.values(unit.inventario_activo).filter(row => row.recipeId === "burger");
  assert.equal(produced.length, 2, "two portions must be created by the real cooking runtime");
  assert.equal(saveCalls, 1, "a batch saves inventory once");
  assert.equal(renderCalls, 1, "inventory HUD refreshes after cooking");
  assert.match(elements["cooking-v2-status"].textContent, /2 platos preparados/);
  assert.equal(ui.close(), true);

  console.log("Cooking recipe book UI smoke: OK (categories, inventory requirements, coin rolls, batch, save)");
})().catch(error => { console.error(error); process.exitCode = 1; });
