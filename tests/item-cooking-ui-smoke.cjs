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
  let rejectSave = false;
  const character = {
    playerId:"alice", level:5, sp:12, proficiencyBonus:3,
    stats:{destreza:16,inteligencia:14,sabiduria:12},
    currentCookingStationId:"grill", abilityProficiency:{dex:"proficient"}
  };
  const inventoryState = {
    inventario_activo: unit.inventario_activo,
    inventario_stash: unit.inventario_stash,
    level:5, sp:12
  };
  globalThis.datosJugador = character;
  globalThis.LuminousInventoryHudV2 = {
    state: {
      playerId:"alice", unit:inventoryState, stashUnlocked:false,
      peer:{bound:true, async save(savedUnit) {
        assert.equal(savedUnit, inventoryState, "must save canonical inventory unit");
        saveCalls++;
        return {saved:!rejectSave, reason:rejectSave ? "offline" : null};
      }}
    },
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
  assert.equal(ui.abilityBase(character, "dex"), 5,
    "ability check includes proficiency even when its helper runtime is not loaded");
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
  assert.match(elements["cooking-v2-detail"].innerHTML, /Grill/,
    "station must be sourced from the full character, not the inventory-only snapshot");
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
  let stopped=0, blocked=0;
  modal.listeners.keydown({
    key:"Escape", preventDefault(){blocked++;},
    stopPropagation(){stopped++;}, stopImmediatePropagation(){stopped++;}
  });
  assert.equal(blocked,1);
  assert.equal(stopped,2);
  assert.equal(modal.hidden,true,"Escape closes only the cookbook");
  assert.equal(ui.open(),true);
  character.cookingKnowledge={apple_pie:true};
  click("[data-cook-recipe]", {cookRecipe:"burger"});
  assert.match(elements["cooking-v2-detail"].innerHTML,/Todavía no has aprendido esta receta/);
  assert.doesNotMatch(elements["cooking-v2-detail"].innerHTML,/Dificultad 12/);
  assert.equal(ui.craftable().some(row=>row.recipeId==="burger"), false);
  assert.equal(ui.close(), true);

  // Locked stash cannot supply ingredients, even when the player owns them.
  delete character.cookingKnowledge;
  Object.assign(unit.inventario_stash, {
    bread2: {instanceId:"stash-bread", itemId:"finished_flatbread_s", recipeId:"flatbread",family:"food",quantity:1},
    meat2: {instanceId:"stash-meat",itemId:"meat_wolf",tags:["ingredient","meat","wolf"],quantity:1},
    veg2: {instanceId:"stash-veg",itemId:"carrot",recipeRoles:["vegetable"],itemTags:["ingredient","vegetable"],quantity:1},
    sauce2: {instanceId:"stash-sauce",itemId:"processed_sauce_base",family:"processed_food",processed:true,processedForm:"sauce_base",tags:["sauce_base","liquid","base"],quantity:1}
  });
  assert.equal(ui.craftable().some(row => row.recipeId === "burger"), false);
  globalThis.LuminousInventoryHudV2.state.stashUnlocked = true;
  assert.equal(ui.craftable().some(row => row.recipeId === "burger"), true);

  // A peer that answers {saved:false} must never display a success message.
  rejectSave = true;
  assert.equal(ui.open(), true);
  click("[data-cook-recipe]", {cookRecipe:"burger"});
  click("[data-cook-confirm]");
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(elements["cooking-v2-status"].dataset.kind, "error");
  assert.doesNotMatch(elements["cooking-v2-status"].textContent, /guardados en el inventario/);
  assert.equal(ui.close(), true);

  // Tools in a locked stash may not satisfy required equipment or lower TH.
  delete inventoryState.inventario_activo.cooks;
  Object.assign(inventoryState.inventario_activo, {
    breadTest: {...unit.inventario_stash.bread2, instanceId:"test-bread"},
    meatTest: {...unit.inventario_stash.meat2, instanceId:"test-meat"},
    vegTest: {...unit.inventario_stash.veg2, instanceId:"test-veg"},
    sauceTest: {...unit.inventario_stash.sauce2, instanceId:"test-sauce"}
  });
  inventoryState.inventario_stash.cooksStash = {
    definitionId:"cooks_utensils", quantity:1, category:"tool"
  };
  globalThis.LuminousInventoryHudV2.state.stashUnlocked = false;
  assert.equal(ui.open(), true);
  click("[data-cook-recipe]", {cookRecipe:"burger"});
  const difficulty = () => {
    const result = elements["cooking-v2-detail"].innerHTML.match(/Dificultad (\\d+)/);
    assert.ok(result,"recipe must display the effective TH");
    return Number(result[1]);
  };
  const lockedTh = difficulty();
  globalThis.LuminousInventoryHudV2.state.stashUnlocked = true;
  ui.renderPreview();
  const unlockedTh = difficulty();
  assert.ok(lockedTh > unlockedTh,
    "stash-only Cook's Utensils must not improve checks while stash is locked");
  assert.equal(ui.close(),true);

  console.log("Cooking recipe book UI smoke: OK (full sheet, locked recipes, Escape, stash tools, coins, batch, save rejection)");
})().catch(error => { console.error(error); process.exitCode = 1; });
