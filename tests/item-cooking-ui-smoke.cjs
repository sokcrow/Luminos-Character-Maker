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
  let throwSave = false;
  let onSave = null;
  let onRoll = null;
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
        assert.notEqual(savedUnit, inventoryState,
          "save a detached unit, not a mutated live HUD inventory");
        assert.notEqual(savedUnit.inventario_activo, inventoryState.inventario_activo,
          "save must keep active container staged until persistence succeeds");
        assert.notEqual(savedUnit.inventario_stash, inventoryState.inventario_stash,
          "save must keep stash staged until persistence succeeds");
        saveCalls++;
        if (onSave) await onSave(savedUnit);
        if (throwSave) throw new Error("firebase_write_failed");
        return {saved:!rejectSave, reason:rejectSave ? "offline" : null};
      }}
    },
    renderAll() { renderCalls++; }
  };
  // The unit smoke uses a stub peer; the real quarantined save is exercised
  // separately against the actual realtime-sync module.
  globalThis.LuminousInventoryHudV2.state.peer.saveConfirmed = function (snapshot) {
    return this.save(snapshot);
  };
  globalThis.LuminousCoinEngine = {
    async runAnimatedRoll() {
      return onRoll ? onRoll() : { total: 20, heads: 5 };
    }
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
  for (const id of ["cooking-v2-categories", "cooking-v2-list", "cooking-v2-count",
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
  // Cooking must use the same three Check channels as the normal player
  // ability Check, with no double-counting of character proficiency.
  const seenChecks = [];
  globalThis.LuminousTraitEngine = { testOnly:true };
  globalThis.LuminousSkillTraitBreakdownPatch = {
    resolvedDmTraits(player) {
      assert.equal(player,character);
      return [{id:"jack_of_all_trades"},{id:"remarkable_athlete"}];
    },
    checkPowerContributions(engine,traits,player,check) {
      assert.equal(engine,globalThis.LuminousTraitEngine);
      seenChecks.push({...check});
      return [{amount:2}];
    },
    finalPowerContributions(engine,traits,player,check) {
      seenChecks.push({...check});
      return [{amount:1}];
    },
    specialCheckContributions(traits,player,check) {
      seenChecks.push({...check});
      return check.proficiencyState === "none"
        ? [{amount:1}, {amount:1}] : [{amount:1}];
    }
  };
  assert.equal(ui.abilityBase(character,"dex"),9,
    "proficient DEX Check adds regular, final and Remarkable Athlete powers");
  const noProf = {...character,abilityProficiency:{dex:"none"}};
  globalThis.LuminousSkillTraitBreakdownPatch.resolvedDmTraits = () => [{id:"jack_of_all_trades"},{id:"remarkable_athlete"}];
  assert.equal(ui.abilityBase(noProf,"dex"),8,
    "unproficient DEX Check includes Jack of All Trades and Remarkable Athlete");
  assert.ok(seenChecks.every(check=>check.kind==="ability" && check.abilityId==="dex"));
  assert.ok(seenChecks.some(check=>check.proficiencyState==="none"));
  delete globalThis.LuminousSkillTraitBreakdownPatch;
  delete globalThis.LuminousTraitEngine;
  assert.equal(ui.maxQuantity(recipes.get("burger"), runtime.inventoryView(unit).rows), 2);
  assert.ok(ui.craftable().some(row => row.recipeId === "burger"));
  assert.equal(resolver.resolveRecipe("burger", runtime.inventoryView(unit).rows).valid, true);

  // Codex P2 regression: one onion matches curry vegetable AND aromatic roles,
  // but its one unit can only fulfill one requirement.
  const curry = recipes.get("curry");
  const curryStock = [
    { itemId:"onion", name:"Onion", quantity:1, tags:["vegetable","aromatic"] },
    { itemId:"curry_sauce", quantity:2, tags:["sauce_base"], processedForm:"sauce_base", processed:true },
    { itemId:"curry_spice", quantity:2, tags:["spice"] }
  ];
  const firstCurry = resolver.resolveRecipe(curry, curryStock);
  assert.equal(firstCurry.valid,false);
  assert.ok(firstCurry.missing.some(row => row.requirement === "aromatic"));
  const firstAvailability = ui.ingredientAvailability(curry,curryStock,1);
  const byRequirement = (results,requirement) => results.find(row => row.requirement === requirement);
  assert.equal(byRequirement(firstAvailability,"meat_or_vegetable").allocated,1);
  assert.equal(byRequirement(firstAvailability,"aromatic").allocated,0);
  assert.equal(byRequirement(firstAvailability,"aromatic").missing,true);
  assert.equal(byRequirement(firstAvailability,"sauce_base").missing,false);
  assert.equal(curryStock[0].quantity,1,"availability preview must not mutate actual inventory");

  const twoOnions = curryStock.map(row => ({...row, quantity:row.itemId === "onion" ? 2 : row.quantity}));
  const twoPortions = ui.ingredientAvailability(curry,twoOnions,2);
  assert.equal(byRequirement(twoPortions,"meat_or_vegetable").allocated,1);
  assert.equal(byRequirement(twoPortions,"aromatic").allocated,1);
  assert.equal(byRequirement(twoPortions,"meat_or_vegetable").required,2);
  assert.equal(byRequirement(twoPortions,"aromatic").required,2);
  assert.equal(byRequirement(twoPortions,"sauce_base").allocated,2,
    "other ingredients still count even when one portion is incomplete");
  assert.equal(byRequirement(twoPortions,"spice").allocated,2);
  assert.equal(twoOnions[0].quantity,2,"multi-portion preview must not consume actual stock");

  const fourOnions = curryStock.map(row => ({...row, quantity:row.itemId === "onion" ? 4 : row.quantity}));
  const completeBatch = ui.ingredientAvailability(curry,fourOnions,2);
  assert.equal(byRequirement(completeBatch,"meat_or_vegetable").allocated,2);
  assert.equal(byRequirement(completeBatch,"aromatic").allocated,2);
  assert.equal(completeBatch.some(row => row.missing),false);

  assert.equal(ui.boot(), true);
  assert.equal(ui.open(), true);
  const modal = elements["cooking-v1-modal"];
  assert.equal(modal.hidden, false);
  assert.match(modal.innerHTML, /cooking-book-index/);
  assert.match(modal.innerHTML, /cooking-book-detail/);
  assert.match(modal.innerHTML, /cooking-book-brand-ribbon/);
  assert.match(modal.innerHTML, /cook-art-meals/);
  assert.doesNotMatch(modal.innerHTML, /RESET DEMO INVENTORY|localStorage/);
  assert.match(elements["cooking-v2-categories"].innerHTML, /COMIDAS/);
  assert.match(elements["cooking-v2-categories"].innerHTML, /POSTRES/);
  assert.match(elements["cooking-v2-list"].innerHTML, /cooking-book-stars/);
  assert.match(elements["cooking-v2-list"].innerHTML, /Assets\/Icons\/items\/cooking_hud\//);
  assert.match(elements["cooking-v2-count"].textContent, /RECETAS DESCUBIERTAS/);
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
  assert.match(elements["cooking-v2-detail"].innerHTML, /2 \/ 2/,
    "ingredient stock should display amount owned vs selected batch requirements");

  click("[data-cook-confirm]");
  await new Promise(resolve => setTimeout(resolve, 30));
  const produced = Object.values(inventoryState.inventario_activo).filter(row => row.recipeId === "burger");
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
  Object.assign(inventoryState.inventario_stash, {
    bread2: {instanceId:"stash-bread", itemId:"finished_flatbread_s", recipeId:"flatbread",family:"food",quantity:1},
    meat2: {instanceId:"stash-meat",itemId:"meat_wolf",tags:["ingredient","meat","wolf"],quantity:1},
    veg2: {instanceId:"stash-veg",itemId:"carrot",recipeRoles:["vegetable"],itemTags:["ingredient","vegetable"],quantity:1},
    sauce2: {instanceId:"stash-sauce",itemId:"processed_sauce_base",family:"processed_food",processed:true,processedForm:"sauce_base",tags:["sauce_base","liquid","base"],quantity:1}
  });
  assert.equal(ui.craftable().some(row => row.recipeId === "burger"), false);
  globalThis.LuminousInventoryHudV2.state.stashUnlocked = true;
  assert.equal(ui.craftable().some(row => row.recipeId === "burger"), true);

  // A peer that returns {saved:false} must not publish either consumed
  // ingredients or phantom dishes into the canonical HUD containers.
  const beforeRejectedSave = JSON.parse(JSON.stringify({
    active:inventoryState.inventario_activo, stash:inventoryState.inventario_stash
  }));
  let stagedSaveSeen = false;
  onSave = async pending => {
    stagedSaveSeen = true;
    assert.ok(Object.values(pending.inventario_activo).some(row => row.recipeId === "burger"),
      "staged snapshot includes cooked result");
    assert.deepEqual({active:inventoryState.inventario_activo,stash:inventoryState.inventario_stash},
      beforeRejectedSave, "live HUD remains unchanged while saving");
  };
  rejectSave = true;
  assert.equal(ui.open(), true);
  click("[data-cook-recipe]", {cookRecipe:"burger"});
  click("[data-cook-confirm]");
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(stagedSaveSeen,true);
  assert.equal(elements["cooking-v2-status"].dataset.kind, "error");
  assert.doesNotMatch(elements["cooking-v2-status"].textContent, /guardados en el inventario/);
  assert.deepEqual({active:inventoryState.inventario_activo,stash:inventoryState.inventario_stash},
    beforeRejectedSave,"save returning false must never publish a phantom dish");
  assert.equal(ui.close(), true);
  onSave = null;

  // Tools in a locked stash may not satisfy required equipment or lower TH.
  delete inventoryState.inventario_activo.cooks;
  Object.assign(inventoryState.inventario_activo, {
    breadTest: {instanceId:"test-bread", itemId:"flatbread_test",recipeId:"flatbread",family:"food",quantity:1},
    meatTest: {instanceId:"test-meat",itemId:"meat_wolf",tags:["ingredient","meat","wolf"],quantity:1},
    vegTest: {instanceId:"test-veg",itemId:"carrot",recipeRoles:["vegetable"],itemTags:["ingredient","vegetable"],quantity:1},
    sauceTest: {instanceId:"test-sauce",itemId:"processed_sauce_base",family:"processed_food",processed:true,processedForm:"sauce_base",tags:["sauce_base","liquid","base"],quantity:1}
  });
  inventoryState.inventario_stash.cooksStash = {
    definitionId:"cooks_utensils", quantity:1, category:"tool"
  };
  globalThis.LuminousInventoryHudV2.state.stashUnlocked = false;
  assert.equal(ui.open(), true);
  click("[data-cook-recipe]", {cookRecipe:"burger"});
  const difficulty = () => {
    const result = elements["cooking-v2-detail"].innerHTML.match(/Dificultad (\d+)/);
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

  // The sheet normally has no persisted station. Declaring a real station in the
  // cookbook must immediately remove exactly the missing-station +3 TH penalty.
  delete character.currentCookingStationId;
  delete character.cookingStationId;
  assert.equal(ui.open(),true);
  click("[data-cook-recipe]", {cookRecipe:"burger"});
  assert.match(elements["cooking-v2-detail"].innerHTML, /data-cook-station/,
    "cooking station selector must be visible and usable");
  assert.equal(ui.currentStation(character),"");
  const withoutStationTh = difficulty();
  const selectStation = value => modal.listeners.change({
    target: {value, matches(selector){return selector === "[data-cook-station]";}}
  });
  selectStation("grill");
  assert.equal(ui.currentStation(character),"grill");
  assert.equal(difficulty(),withoutStationTh-3,
    "choosing a grill must remove the missing-station penalty");
  selectStation("imaginary_station");
  assert.equal(ui.currentStation(character),"grill",
    "unrecognized station IDs cannot be submitted");
  selectStation("");
  assert.equal(difficulty(),withoutStationTh,
    "clearing station must restore the actual penalty");
  assert.equal(ui.close(),true);
  assert.equal(ui.open(),true);
  assert.equal(ui.currentStation(character),"",
    "new cooking sessions must not retain an old declared station");
  assert.equal(ui.close(),true);

  // An 844x390 landscape phone must never inherit a 540px minimum book height.
  const css = require("node:fs").readFileSync(path.resolve(__dirname,"../css/item-cooking-ui.css"),"utf8");
  assert.match(css, /@media \(max-height: 540px\) and \(min-width: 691px\)/);
  const compact = css.split("@media (max-height: 540px) and (min-width: 691px)")[1];
  assert.match(compact, /#cooking-v1-modal \.cooking-book\s*\{[^}]*min-height:\s*0/);
  assert.match(compact, /height:\s*calc\(100dvh - 8px\)/);
  assert.match(css, /grid-template-columns:\s*minmax\(0,45fr\) minmax\(0,55fr\)/);
  assert.match(css, /cooking-book-brand-ribbon/);
  assert.match(css, /max-width:\s*920px/);
  for (const art of ["hero","grilled","tea","herbs","raw_meat"]) {
    assert.ok(require("node:fs").existsSync(
      path.resolve(__dirname,"../Assets/Icons/items/cooking_hud/" + art + ".webp")
    ),"HUD art must be a repository asset: " + art);
  }

  // Exercise the rendered menu, not just the availability helper.
  globalThis.LuminousInventoryHudV2.state.stashUnlocked = false;
  inventoryState.inventario_activo = {
    onion: { ...curryStock[0] },
    sauce: { ...curryStock[1] },
    spice: { ...curryStock[2] }
  };
  assert.equal(ui.open(),true);
  click("[data-cook-recipe]",{cookRecipe:"curry"});
  const limitedCurryHtml = elements["cooking-v2-detail"].innerHTML;
  assert.equal((limitedCurryHtml.match(/cooking-book-ingredient is-missing/g)||[]).length,1,
    "exactly the aromatic row must be highlighted when the only onion is reserved as vegetable");
  assert.match(limitedCurryHtml,/0 \/ 1/);
  assert.match(limitedCurryHtml,/Necesitas reunir los ingredientes señalados/);
  inventoryState.inventario_activo.onion.quantity = 4;
  ui.renderPreview();
  click("[data-cook-quantity]",{cookQuantity:"1"});
  const batchCurryHtml = elements["cooking-v2-detail"].innerHTML;
  assert.match(batchCurryHtml,/<strong>2<\/strong>/);
  assert.equal((batchCurryHtml.match(/cooking-book-ingredient is-missing/g)||[]).length,0,
    "two curry portions are fully assigned when there are four onions");
  assert.equal((batchCurryHtml.match(/2 \/ 2/g)||[]).length,4,
    "every recipe requirement must be resolved across both portions");
  assert.equal(ui.close(),true);

  // Real-time snapshot replaces the inventory while coin animation is pending.
  // Even a successful roll cannot commit stale results to the newly bound unit.
  rejectSave = false;
  function newBurgerInventory() {
    return {
      cooks:{definitionId:"cooks_utensils",quantity:1,category:"tool"},
      bread:{instanceId:"fresh-bread",itemId:"finished_flatbread_c",recipeId:"flatbread",family:"food",quantity:2},
      meat:{instanceId:"fresh-meat",itemId:"meat_wolf",tags:["ingredient","meat","wolf"],quantity:2},
      veg:{instanceId:"fresh-veg",itemId:"carrot",recipeRoles:["vegetable"],itemTags:["ingredient","vegetable"],quantity:2},
      sauce:{instanceId:"fresh-sauce",itemId:"processed_sauce_base",family:"processed_food",processed:true,processedForm:"sauce_base",tags:["sauce_base","liquid","base"],quantity:2}
    };
  }
  // A rejected promise also leaves every live inventory container untouched.
  inventoryState.inventario_activo = newBurgerInventory();
  globalThis.LuminousInventoryHudV2.state.stashUnlocked = false;
  const beforeThrownSave = JSON.parse(JSON.stringify({
    active:inventoryState.inventario_activo, stash:inventoryState.inventario_stash
  }));
  onSave = async pending => {
    assert.equal(Object.values(pending.inventario_activo).filter(row=>row.recipeId==="burger").length,1);
    assert.deepEqual({active:inventoryState.inventario_activo,stash:inventoryState.inventario_stash},
      beforeThrownSave,"live inventory is not exposed to unsaved recipe mutations");
  };
  rejectSave = false;
  throwSave = true;
  assert.equal(ui.open(),true);
  click("[data-cook-recipe]",{cookRecipe:"burger"});
  click("[data-cook-confirm]");
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(elements["cooking-v2-status"].dataset.kind,"error");
  assert.deepEqual({active:inventoryState.inventario_activo,stash:inventoryState.inventario_stash},
    beforeThrownSave,"a thrown save must not leak any staged items into future saves");
  assert.equal(ui.close(),true);
  throwSave = false;
  onSave = null;

  // A realtime update during persistence may replace the canonical inventory.
  // After success, the UI must not overwrite that authoritative snapshot.
  inventoryState.inventario_activo = newBurgerInventory();
  const latestFromFirebase = newBurgerInventory();
  latestFromFirebase.serverItem = {instanceId:"server_item",itemId:"apple",quantity:1};
  onSave = async pending => {
    assert.equal(Object.values(pending.inventario_activo).filter(row=>row.recipeId==="burger").length,1);
    inventoryState.inventario_activo = latestFromFirebase;
  };
  assert.equal(ui.open(),true);
  click("[data-cook-recipe]",{cookRecipe:"burger"});
  click("[data-cook-confirm]");
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(elements["cooking-v2-status"].dataset.kind,"success",
    "acknowledged remote save should not be reported as failed");
  assert.equal(inventoryState.inventario_activo,latestFromFirebase,
    "never overwrite a newer realtime snapshot while finishing the save");
  assert.equal(ui.close(),true);
  onSave = null;

  inventoryState.inventario_activo = newBurgerInventory();
  const saveCountBeforeConflict = saveCalls;
  const fresh = JSON.parse(JSON.stringify(inventoryState.inventario_activo));
  onRoll = async () => {
    inventoryState.inventario_activo = JSON.parse(JSON.stringify(fresh));
    return {total:20,heads:5};
  };
  assert.equal(ui.open(),true);
  click("[data-cook-recipe]",{cookRecipe:"burger"});
  click("[data-cook-confirm]");
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(saveCalls,saveCountBeforeConflict,"must not save stale inventory");
  assert.equal(elements["cooking-v2-status"].dataset.kind,"error");
  assert.match(elements["cooking-v2-status"].textContent,/inventario cambió/);
  assert.deepEqual(inventoryState.inventario_activo,fresh,
    "realtime snapshot must be preserved, with no lost ingredients or phantom dish");
  assert.equal(ui.close(),true);
  onRoll = null;

  // A refresh on roll two must also discard staged results from roll one.
  inventoryState.inventario_activo = newBurgerInventory();
  const freshSecond = JSON.parse(JSON.stringify(inventoryState.inventario_activo));
  let rollIndex = 0;
  onRoll = async () => {
    if (++rollIndex === 2) inventoryState.inventario_activo = JSON.parse(JSON.stringify(freshSecond));
    return {total:20,heads:5};
  };
  assert.equal(ui.open(),true);
  click("[data-cook-recipe]",{cookRecipe:"burger"});
  click("[data-cook-quantity]",{cookQuantity:"1"});
  click("[data-cook-confirm]");
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(rollIndex,2);
  assert.equal(saveCalls,saveCountBeforeConflict);
  assert.deepEqual(inventoryState.inventario_activo,freshSecond,
    "neither first nor second staged portion leaks across a realtime replacement");
  assert.match(elements["cooking-v2-status"].textContent,/inventario cambió/);
  assert.equal(ui.close(),true);
  onRoll = null;

  console.log("Cooking recipe book UI smoke: OK (staged save failures and success races, realtime rolls, Check traits, ingredients, station TH, responsive UI)");
})().catch(error => { console.error(error); process.exitCode = 1; });
