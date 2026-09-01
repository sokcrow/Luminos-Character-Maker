const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const traitEngine = require("../js/trait-engine.js");
const archetypeCatalog = require("../js/archetype-trait-catalog.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const runtimeSource = read("js/player-archetype-runtime.js");
const combatEventSource = read("js/archetype-combat-event-runtime.js");
const statusSource = read("js/status-engine.js");
const battleViewer = read("Battle-viewer.html");

const DEVIL = "path_of_the_devil_lineage";

function classLevel(character, classId) {
  const build = character?.characterBuild || {};
  const classes = Array.isArray(build.classes) ? build.classes : [];
  const found = classes.find((entry) => String(entry.classId || entry.id).toLowerCase() === classId);
  return Number(found?.level ?? found?.levels ?? 0) || 0;
}

function isSelected(character, archetypeId, classId) {
  const list = character?.characterBuild?.archetypes || [];
  return Array.isArray(list) && list.some((entry) =>
    String(entry.classId || "").toLowerCase() === classId &&
    String(entry.archetypeId || "").toLowerCase() === archetypeId
  );
}

function makeDocument() {
  const appended = [];
  return {
    appended,
    querySelector() { return null; },
    getElementById() { return null; },
    createElement(tag) {
      return {
        tagName: String(tag).toUpperCase(),
        dataset: {},
        addEventListener() {},
        setAttribute() {},
      };
    },
    head: {
      appendChild(node) { appended.push(node); },
    },
  };
}

function loadRuntime({ grantedTraits = [], traitEngineApi = null, playerTraitRuntime = null } = {}) {
  const document = makeDocument();
  const window = {
    document,
    console,
    localStorage: { getItem() { return ""; } },
    addEventListener() {},
    setInterval() {},
    alert() {},
    LuminousTraitEngine: traitEngineApi || undefined,
    LuminousPlayerTraitRuntime: playerTraitRuntime || undefined,
    LuminousTraitStandardizationRuntime: {
      registerCombatUnit() {},
      resolveTraitRuntimeResolutions() {},
    },
    LuminousArchetypeEngine: {
      isSelected,
      getClassLevel: classLevel,
      classEntries(character) {
        return (character?.characterBuild?.classes || []).map((entry) => ({
          classId: String(entry.classId || entry.id || "").toLowerCase(),
          levels: Number(entry.level ?? entry.levels ?? 0) || 0,
        }));
      },
      selectedForClass() { return null; },
      groupTraitsByArchetype() { return []; },
    },
    LuminousArchetypeTraitCatalog: {
      resolveTraitGrants(character) {
        return isSelected(character, DEVIL, "barbarian") ? grantedTraits.map((trait) => ({ ...trait })) : [];
      },
      allArchetypes() { return {}; },
      allDefinitions() { return {}; },
      allGrants() { return []; },
    },
  };
  window.window = window;
  vm.runInNewContext(runtimeSource, { window, console, Promise }, { filename: "player-archetype-runtime.js" });
  return { window, document, api: window.LuminousArchetypeRuntime };
}

function loadCombatEventRuntime(window) {
  vm.runInNewContext(combatEventSource, { window, console, WeakMap, Map }, { filename: "archetype-combat-event-runtime.js" });
  return window.LuminousArchetypeCombatEventRuntime;
}

function devilUnit(level, extra = {}) {
  return {
    id: extra.id,
    name: extra.name || `Devil Unit ${level}`,
    hp: extra.hp ?? 100,
    maxHp: extra.maxHp ?? 100,
    shield: extra.shield ?? 0,
    stats: { fuerza: 18, constitucion: 14, ...(extra.stats || {}) },
    statusEffects: extra.statusEffects || {},
    characterBuild: extra.characterBuild || {
      classes: [{ classId: "barbarian", level }],
      archetypes: [{ classId: "barbarian", archetypeId: DEVIL, selectedAtClassLevel: 15 }],
    },
  };
}

function baseCombatEngine({ coinDamage } = {}) {
  return {
    initializeUnitData(unit) { unit.initialized = true; return unit; },
    calculateCoinDamage(attacker, defender) {
      return typeof coinDamage === "function" ? coinDamage(attacker, defender) : 100;
    },
    applyDamage(unit, damage) {
      let remaining = Number(damage) || 0;
      if (unit.shield > 0) {
        const blocked = Math.min(unit.shield, remaining);
        unit.shield -= blocked;
        remaining -= blocked;
      }
      unit.hp = Math.max(0, unit.hp - remaining);
      return { hp: unit.hp, shield: unit.shield };
    },
    processStatusEffects(unit, triggerKey) {
      if (triggerKey === "burn_tick" && unit.statusEffects?.burn) {
        this.applyDamage(unit, Number(unit.statusEffects.burn.potency) || 0, "efecto_estado");
      }
    },
    triggerEncounterStart() {},
    triggerPhase() {},
    triggerEvent() {},
  };
}

test("Battle Viewer bootstraps both Archetype runtimes through Status Engine", () => {
  const statusIndex = battleViewer.indexOf('src="js/status-engine.js"');
  const combatIndex = battleViewer.indexOf('src="js/combatEngine.js"');
  expect(statusIndex).toBeGreaterThan(-1);
  expect(combatIndex).toBeGreaterThan(statusIndex);

  const document = makeDocument();
  const window = { document };
  window.window = window;
  vm.runInNewContext(statusSource, { window }, { filename: "status-engine.js" });
  const scripts = document.appended.map((node) => node.src).filter(Boolean);
  expect(scripts).toContain("js/player-archetype-runtime.js");
  expect(scripts).toContain("js/archetype-combat-event-runtime.js");
});

test("JACKPOT reconoce Ammo canónico en skill.ammo.cost aunque la Coin no tenga metadata de Ammo", () => {
  const { window, api } = loadRuntime();
  window.CombatEngine = baseCombatEngine();
  expect(api.patchCombatEngine()).toBe(true);

  const attacker = devilUnit(15);
  const defender = { physRes: 1, hp: 100, maxHp: 100, shield: 0, statusEffects: {} };
  const context = { currentCoin: { type: "standard" } };
  expect(api.coinSpendsAmmo({ ammo: { resourceId: "ammo", cost: 1 } }, context)).toBe(true);
  const damage = window.CombatEngine.calculateCoinDamage(
    attacker,
    defender,
    { ammo: { resourceId: "ammo", cost: 1 } },
    10,
    false,
    0,
    context,
  );
  expect(damage).toBe(140);
});

test("Infernal Touch normaliza Resistance sólo durante el cálculo y restaura al objetivo", () => {
  const { window, api } = loadRuntime();
  window.CombatEngine = baseCombatEngine({ coinDamage: (_attacker, defender) => defender.physRes * 100 });
  api.patchCombatEngine();

  const attacker = devilUnit(30, { statusEffects: { rage: { count: 1 } } });
  const defender = { physRes: 0.5, hp: 100, maxHp: 100, shield: 0, statusEffects: {} };
  const damage = window.CombatEngine.calculateCoinDamage(attacker, defender, { attackType: "Slash" }, 10, false, 0, { currentCoin: {} });
  expect(damage).toBe(100);
  expect(defender.physRes).toBe(0.5);
});

test("Demonic Resistance reduce Burn para cualquier combatant con el Archetype, no sólo el player sheet", () => {
  const { window, api } = loadRuntime();
  window.CombatEngine = baseCombatEngine();
  api.patchCombatEngine();

  const unit = devilUnit(15, { hp: 100, statusEffects: { burn: { potency: 10, count: 2 } } });
  window.CombatEngine.processStatusEffects(unit, "burn_tick", {});
  expect(unit.hp).toBe(95);
  expect(unit.statusEffects.burn.potency).toBe(10);
});

test("Cursed Juggernaut funciona para combatants arbitrarios y conserva la recuperación pendiente", () => {
  const { window, api } = loadRuntime();
  window.CombatEngine = baseCombatEngine();
  api.patchCombatEngine();

  const unit = devilUnit(70, { hp: 10, statusEffects: { rage: { count: 1 } } });
  window.CombatEngine.applyDamage(unit, 100, "directo");
  expect(unit.hp).toBe(1);

  unit.hp = 8;
  window.CombatEngine.triggerPhase("[Round Start]", [unit]);
  expect(unit.hp).toBe(36);
});

test("Cursed Juggernaut conserva pending y used cuando Firebase reconstruye el objeto del combatant", () => {
  const { window, api } = loadRuntime();
  window.CombatEngine = baseCombatEngine();
  api.patchCombatEngine();

  const firstSnapshot = devilUnit(70, { id: "ally_42", hp: 10, statusEffects: { rage: { count: 1 } } });
  window.CombatEngine.applyDamage(firstSnapshot, 100, "directo");
  expect(firstSnapshot.hp).toBe(1);

  const secondSnapshot = devilUnit(70, { id: "ally_42", hp: 8, statusEffects: { rage: { count: 1 } } });
  window.CombatEngine.triggerPhase("[Round Start]", [secondSnapshot]);
  expect(secondSnapshot.hp).toBe(36);

  const thirdSnapshot = devilUnit(70, { id: "ally_42", hp: 10, statusEffects: { rage: { count: 1 } } });
  window.CombatEngine.applyDamage(thirdSnapshot, 100, "directo");
  expect(thirdSnapshot.hp).toBe(1);
  const fourthSnapshot = devilUnit(70, { id: "ally_42", hp: 1, statusEffects: { rage: { count: 1 } } });
  window.CombatEngine.triggerPhase("[Round Start]", [fourthSnapshot]);
  expect(fourthSnapshot.hp).toBe(1);
});

test("combat initialization attaches granted Archetype Traits to non-current-player units", () => {
  const trait = { id: "devil_lineage_infernal_speed", source: { type: "archetype", archetypeId: DEVIL } };
  const { window, api } = loadRuntime({ grantedTraits: [trait] });
  window.CombatEngine = baseCombatEngine();
  api.patchCombatEngine();

  const unit = devilUnit(15);
  window.CombatEngine.initializeUnitData(unit);
  expect(unit.traitDefinitions?.map((entry) => entry.id)).toContain("devil_lineage_infernal_speed");
});

test("universal Archetype bridge dispatches Turn Start for every arbitrary combatant", () => {
  const definition = archetypeCatalog.DEFINITIONS.devil_lineage_demonic_resistance;
  const { window, api } = loadRuntime({ grantedTraits: [definition], traitEngineApi: traitEngine });
  window.CombatEngine = baseCombatEngine();
  api.patchCombatEngine();
  loadCombatEventRuntime(window).patchCombatEngine();

  const a = devilUnit(15, { id: "ally_a", hp: 50, maxHp: 100 });
  const b = devilUnit(15, { id: "ally_b", hp: 40, maxHp: 100 });
  window.CombatEngine.triggerPhase("[Round Start]", [a, b]);
  expect(a.hp).toBe(52);
  expect(b.hp).toBe(42);
});

test("universal Archetype bridge dispatches On Hit and On Crit to the concrete target", () => {
  const improved = archetypeCatalog.DEFINITIONS.devil_lineage_improved_devil_strength;
  const calls = [];
  const engine = {
    createState: traitEngine.createState,
    resetStateScope: traitEngine.resetStateScope,
    dispatchTrait(trait, trigger, runtime, state) {
      calls.push({ trait: trait.id, trigger, self: runtime.self?.id, target: runtime.target?.id, sourceClassId: runtime.sourceClassId });
      return { trait, state, runtime, outcomes: [] };
    },
  };
  const { window, api } = loadRuntime({ grantedTraits: [improved], traitEngineApi: engine });
  window.CombatEngine = baseCombatEngine();
  api.patchCombatEngine();
  loadCombatEventRuntime(window).patchCombatEngine();

  const attacker = devilUnit(50, { id: "attacker" });
  const target = { id: "target", hp: 100, maxHp: 100, statusEffects: {} };
  const context = { attacker, defender: target, skill: { coinAmount: 2 }, currentCoin: {} };
  window.CombatEngine.triggerEvent("[On Hit]", context, [target]);
  window.CombatEngine.triggerEvent("[On Crit]", context, [target]);

  expect(calls.some((call) => call.trigger === "on_hit" && call.self === "attacker" && call.target === "target")).toBe(true);
  expect(calls.some((call) => call.trigger === "on_crit" && call.self === "attacker" && call.target === "target")).toBe(true);
});

test("universal Archetype bridge dispatches AoE On Hit once for each unique target", () => {
  const improved = archetypeCatalog.DEFINITIONS.devil_lineage_improved_devil_strength;
  const hitTargets = [];
  const engine = {
    createState: traitEngine.createState,
    resetStateScope: traitEngine.resetStateScope,
    dispatchTrait(trait, trigger, runtime, state) {
      if (trigger === "on_hit") hitTargets.push(runtime.target?.id);
      return { trait, state, runtime, outcomes: [] };
    },
  };
  const { window, api } = loadRuntime({ grantedTraits: [improved], traitEngineApi: engine });
  window.CombatEngine = baseCombatEngine();
  api.patchCombatEngine();
  loadCombatEventRuntime(window).patchCombatEngine();

  const attacker = devilUnit(50, { id: "aoe_attacker" });
  const a = { id: "target_a" };
  const b = { id: "target_b" };
  window.CombatEngine.triggerEvent("[On Hit]", { attacker, defender: a, skill: {}, currentCoin: {} }, [a, b, a]);
  expect(hitTargets).toEqual(["target_a", "target_b"]);
});

test("universal bridge delegates the locally managed player to PlayerTraitRuntime to prevent double dispatch", () => {
  const local = devilUnit(50, { id: "local_player" });
  let dispatchCount = 0;
  const engine = {
    createState: traitEngine.createState,
    resetStateScope: traitEngine.resetStateScope,
    dispatchTrait(trait, trigger, runtime, state) {
      dispatchCount += 1;
      return { trait, state, runtime, outcomes: [] };
    },
  };
  const playerTraitRuntime = { getCharacter: () => local, dispatchCombatEvent() {} };
  const improved = archetypeCatalog.DEFINITIONS.devil_lineage_improved_devil_strength;
  const { window, api } = loadRuntime({ grantedTraits: [improved], traitEngineApi: engine, playerTraitRuntime });
  window.CombatEngine = baseCombatEngine();
  api.patchCombatEngine();
  const bridge = loadCombatEventRuntime(window);
  bridge.patchCombatEngine();

  const target = { id: "target" };
  window.CombatEngine.triggerEvent("[On Hit]", { attacker: local, defender: target, skill: {}, currentCoin: {} }, [target]);
  expect(dispatchCount).toBe(0);
});

test("universal bridge passes each Archetype Trait sourceClassId for multiclass ClassLevel formulas", () => {
  const testTrait = {
    schemaVersion: 1,
    id: "test_wizard_archetype_class_level",
    name: "Class Level Test",
    source: { type: "archetype", archetypeId: DEVIL, classId: "wizard" },
    contexts: ["combat"],
    activation: { type: "automatic", actionCost: "none" },
    effects: [{
      id: "heal_by_class_level",
      contexts: ["combat"],
      trigger: "turn_start",
      conditions: [],
      operations: [{ type: "heal_hp", path: "self.hp", maxPath: "self.maxHp", formula: "ClassLevel" }],
    }],
    rules: [],
  };
  const build = {
    classes: [{ classId: "barbarian", level: 70 }, { classId: "wizard", level: 3 }],
    archetypes: [{ classId: "barbarian", archetypeId: DEVIL, selectedAtClassLevel: 15 }],
  };
  const { window, api } = loadRuntime({ grantedTraits: [testTrait], traitEngineApi: traitEngine });
  window.CombatEngine = baseCombatEngine();
  api.patchCombatEngine();
  loadCombatEventRuntime(window).patchCombatEngine();

  const unit = devilUnit(70, { id: "multiclass", hp: 50, maxHp: 100, characterBuild: build });
  window.CombatEngine.triggerPhase("[Round Start]", [unit]);
  expect(unit.hp).toBe(53);
});
