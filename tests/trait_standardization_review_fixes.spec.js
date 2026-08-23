const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const traitEngine = require("../js/trait-engine.js");
const statusEngine = require("../js/status-engine.js");
const modifiers = require("../js/universal-modifier-engine.js");
const racialCatalog = require("../js/racial-trait-catalog.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

function eventTarget(base = {}) {
  const listeners = new Map();
  return Object.assign(base, {
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    removeEventListener(type, handler) {
      const list = listeners.get(type) || [];
      listeners.set(type, list.filter((entry) => entry !== handler));
    },
    dispatchEvent(event) {
      (listeners.get(event.type) || []).forEach((handler) => handler.call(this, event));
      return true;
    },
    _listeners: listeners,
  });
}

function makeDocument() {
  const byId = new Map();
  const document = eventTarget({
    readyState: "complete",
    body: { classList: { contains: () => false, toggle() {}, add() {}, remove() {} } },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById(id) { return byId.get(id) || null; },
    createElement(tagName) {
      const element = eventTarget({
        tagName: String(tagName).toUpperCase(),
        dataset: {},
        style: {},
        children: [],
        setAttribute() {},
        appendChild(child) { this.children.push(child); return child; },
      });
      Object.defineProperty(element, "id", {
        get() { return this._id || ""; },
        set(value) { this._id = value; if (value) byId.set(value, this); },
      });
      return element;
    },
  });
  document.head = {
    appendChild(element) {
      if (element.id) byId.set(element.id, element);
      queueMicrotask(() => element.dispatchEvent({ type: "load" }));
      return element;
    },
  };
  document._byId = byId;
  return document;
}

function loadStandardizationRuntime(overrides = {}) {
  const document = overrides.document || makeDocument();
  const fakeWindow = eventTarget({
    document,
    LuminousTraitEngine: traitEngine,
    LuminousStatusEngine: statusEngine,
    LuminousUniversalModifiers: modifiers,
    LuminousPlayerTraitRuntime: overrides.playerRuntime || null,
    LuminousPlayerStats: overrides.playerStats || null,
    CombatEngine: overrides.combatEngine || null,
    datosJugador: overrides.datosJugador || null,
    firebase: overrides.firebase || null,
    combatData: overrides.combatData || null,
    slotTargets: overrides.slotTargets || null,
    STATUS_REGISTRY: overrides.STATUS_REGISTRY || null,
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
    },
    setInterval() { return 1; },
    setTimeout(handler) { handler(); return 1; },
    console,
  });
  const math = Object.create(Math);
  math.random = overrides.random || Math.random;
  const context = vm.createContext({
    window: fakeWindow,
    document,
    console,
    MutationObserver: overrides.MutationObserver || class { observe() {} disconnect() {} },
    CustomEvent: fakeWindow.CustomEvent,
    Math: math,
    Number,
    Object,
    Array,
    String,
    Boolean,
    JSON,
    Set,
    Map,
    Promise,
    queueMicrotask,
  });
  vm.runInContext(read("js/trait-standardization-runtime.js"), context, { filename: "trait-standardization-runtime.js" });
  return { window: fakeWindow, document, api: fakeWindow.LuminousTraitStandardizationRuntime };
}

test("production combat iframe loader injects player traits, standardization and speed runtimes into the iframe document", async () => {
  const parentDocument = makeDocument();
  const frameDocument = makeDocument();
  const frameWindow = { document: frameDocument };
  const window = { document: parentDocument, console, setTimeout, firebase: null };
  const context = vm.createContext({ window, document: parentDocument, console, Promise, Object, String, Boolean });
  vm.runInContext(read("js/instance-control.js"), context, { filename: "instance-control.js" });

  const combatView = { contentWindow: frameWindow, contentDocument: frameDocument };
  await window.LuminousInstanceControl.ensureCombatTraitRuntime(combatView);

  expect(frameDocument.getElementById("combat-player-trait-runtime-script")?.src).toBe("js/player-trait-runtime.js");
  expect(frameDocument.getElementById("combat-trait-standardization-runtime-script")?.src).toBe("js/trait-standardization-runtime.js");
  expect(frameDocument.getElementById("combat-universal-speed-runtime-script")?.src).toBe("js/universal-speed-runtime.js");
});

test("active declarative spell restriction blocks Spell Skills without class-specific CombatEngine logic", () => {
  const rageRestrictionTrait = {
    id: "test_rage_restriction",
    name: "Test Rage Restriction",
    contexts: ["combat"],
    activation: { type: "passive", actionCost: "none" },
    effects: [],
    rules: [{
      id: "test_no_spells",
      type: "restriction",
      trigger: "passive",
      target: "self",
      restriction: "spell_skills",
      whileStatus: "rage",
    }],
  };
  const unit = {
    statusEffects: { rage: { id: "rage", count: 1, potency: 0 } },
    traitDefinitions: [rageRestrictionTrait],
  };
  const { api } = loadStandardizationRuntime();

  expect(api.canUseSkillByTraits(unit, { type: "Spell" })).toMatchObject({
    usable: false,
    restriction: "spell_skills",
  });
  expect(api.canUseSkillByTraits(unit, { type: "Normal", skillRange: 1 })).toMatchObject({ usable: true });

  delete unit.statusEffects.rage;
  expect(api.canUseSkillByTraits(unit, { type: "Spell" })).toMatchObject({ usable: true });
});

test("wrapped CombatEngine.createSkill preserves legacy skillRange before Attack/Melee/Ranged normalization", () => {
  const combatEngine = {
    createSkill(config = {}) {
      return { type: config.type || "Normal", coinAmount: config.coinAmount || 1, coins: [{ type: "standard", status: "active" }] };
    },
    applyPassiveModifiers() { return {}; },
    initializeUnitData() {},
  };
  const { api } = loadStandardizationRuntime({ combatEngine });
  api.installAll();

  const ranged = combatEngine.createSkill({ type: "Normal", skillRange: 5 });
  const melee = combatEngine.createSkill({ type: "Normal", skillRange: 1 });

  expect(ranged.skillRange).toBe(5);
  expect(ranged.skillFamily).toBe("attack");
  expect(ranged.attackMode).toBe("ranged");
  expect(ranged.isRanged).toBe(true);
  expect(melee.attackMode).toBe("melee");
});

test("production combatants Firebase lifecycle dispatches encounter_start once per encounter to the registered player unit", () => {
  let combatantsListener = null;
  const firebase = {
    apps: [{}],
    database() {
      return {
        ref(pathName) {
          expect(pathName).toBe("campaña/combate/combatants");
          return {
            on(type, handler) {
              expect(type).toBe("value");
              combatantsListener = handler;
            },
          };
        },
      };
    },
  };
  const dispatched = [];
  const playerCharacter = { id: "player_1", name: "Player One" };
  const playerRuntime = {
    getCharacter() { return playerCharacter; },
    getTraits() { return []; },
    dispatchCombatEvent(trigger, input) {
      dispatched.push({ trigger, input });
      return { runtime: input, state: traitEngine.createState(), outcomes: [] };
    },
  };
  const combatEngine = {
    initializeUnitData(unit) { unit.initialized = true; },
    applyPassiveModifiers() { return {}; },
  };
  const { api } = loadStandardizationRuntime({ playerRuntime, combatEngine, firebase, datosJugador: playerCharacter });
  api.installAll();

  const playerUnit = { id: "player_1", name: "Player One", speed: 2 };
  combatEngine.initializeUnitData(playerUnit);
  combatantsListener({ val: () => ({ player_1: { id: "player_1" }, enemy_1: { id: "enemy_1" } }) });

  expect(dispatched).toHaveLength(1);
  expect(dispatched[0].trigger).toBe("encounter_start");
  expect(dispatched[0].input.self).toBe(playerUnit);

  combatantsListener({ val: () => ({ player_1: { id: "player_1", hp: 80 }, enemy_1: { id: "enemy_1" } }) });
  expect(dispatched).toHaveLength(1);

  combatantsListener({ val: () => ({}) });
  const nextPlayerUnit = { id: "player_1", name: "Player One", speed: 3 };
  combatEngine.initializeUnitData(nextPlayerUnit);
  combatantsListener({ val: () => ({ player_1: { id: "player_1" } }) });
  expect(dispatched).toHaveLength(2);
  expect(dispatched[1].input.self).toBe(nextPlayerUnit);
});

test("Stone's Endurance reduces production incoming damage before HP is deducted", () => {
  const stone = racialCatalog.getDefinition("goliath_stone_endurance");
  const playerCharacter = { id: "goliath_1", level: 20, stats: { constitucion: 16 } };
  const traitState = traitEngine.createState();
  const playerRuntime = {
    getCharacter() { return playerCharacter; },
    getTraits() { return [stone]; },
    dispatchCombatEvent(trigger, input) {
      return traitEngine.dispatchCombatEvent(trigger, {
        character: playerCharacter,
        traits: [stone],
        state: traitState,
        ...input,
      });
    },
  };
  const combatEngine = {
    initializeUnitData() {},
    applyPassiveModifiers() { return {}; },
    applyDamage(unit, damage) {
      unit.hp = Math.max(0, unit.hp - damage);
      return { hp: unit.hp, shield: unit.shield || 0 };
    },
  };
  const { api } = loadStandardizationRuntime({ combatEngine, playerRuntime, datosJugador: playerCharacter });
  api.installAll();

  const unit = { id: "goliath_1", hp: 100, maxHp: 100, stats: { constitucion: 16 } };
  combatEngine.initializeUnitData(unit);
  combatEngine.applyDamage(unit, 10, "directo", false, { type: "Normal" });

  expect(unit.hp).toBe(93);
});

test("damage history feeds Undae previous-Turn Fire and Acid conditions", () => {
  const playerCharacter = { id: "undae_1", level: 20 };
  const playerRuntime = {
    getCharacter() { return playerCharacter; },
    getTraits() { return []; },
    dispatchCombatEvent(_trigger, input) {
      return { runtime: input, state: traitEngine.createState(), outcomes: [] };
    },
  };
  const combatEngine = {
    initializeUnitData() {},
    applyPassiveModifiers() { return {}; },
    applyDamage(unit, damage) {
      unit.hp = Math.max(0, unit.hp - damage);
      return { hp: unit.hp };
    },
    triggerPhase() {},
  };
  const { api } = loadStandardizationRuntime({ combatEngine, playerRuntime, datosJugador: playerCharacter });
  api.installAll();

  const unit = { id: "undae_1", hp: 100, maxHp: 100 };
  combatEngine.initializeUnitData(unit);
  combatEngine.applyDamage(unit, 5, "Fire", false, { damageType: "Fire" });
  expect(unit.damageTakenThisTurnTypes).toEqual(["Fire"]);
  combatEngine.triggerPhase("[Round End]", [unit]);
  expect(unit.damageTakenPreviousTurnTypes).toEqual(["Fire"]);
  expect(unit.damageTakenThisTurnTypes).toEqual([]);

  api.recordDamageTypes(unit, ["Acid"]);
  api.advanceDamageHistory(unit);
  expect(unit.damageTakenPreviousTurnTypes).toEqual(["Acid"]);
});

test("Pack Tactics is scoped to the current target and never mutates a reusable Skill", () => {
  const attacker = { id: "kobold", faction: "player", combatStats: { maxSpeed: 6 } };
  const ally = { id: "ally", faction: "player" };
  const targetA = { id: "enemy_a", faction: "enemy", speed: 3 };
  const targetB = { id: "enemy_b", faction: "enemy", speed: 3 };
  const combatData = { kobold: attacker, ally, enemy_a: targetA, enemy_b: targetB };
  const slotTargets = { kobold_slot_0: "enemy_a_slot_0", ally_slot_0: "enemy_a_slot_0" };
  const pack = racialCatalog.getDefinition("pack_tactics");
  const playerRuntime = { getCharacter() { return attacker; }, getTraits() { return [pack]; } };
  const combatEngine = {
    applyPassiveModifiers() { return {}; },
    resolveUnilateralWithCounter(unitAttacker, attackSkill) {
      const passive = this.applyPassiveModifiers(unitAttacker, { skill: attackSkill });
      return { finalPower: (attackSkill.basePower || 0) + (passive.final_power || 0) };
    },
  };
  const { api } = loadStandardizationRuntime({ combatEngine, playerRuntime, combatData, slotTargets, datosJugador: attacker });
  api.installAll();
  const skill = { type: "Normal", basePower: 10 };
  expect(combatEngine.resolveUnilateralWithCounter(attacker, skill, targetA, null).finalPower).toBe(11);
  slotTargets.kobold_slot_0 = "enemy_b_slot_0";
  expect(combatEngine.resolveUnilateralWithCounter(attacker, skill, targetB, null).finalPower).toBe(10);
  slotTargets.kobold_slot_0 = "enemy_a_slot_0";
  expect(combatEngine.resolveUnilateralWithCounter(attacker, skill, targetA, null).finalPower).toBe(11);
  expect(skill.finalPower).toBeUndefined();
  expect(skill.final_power).toBeUndefined();
});

test("production clash resolution receives universal Clash Power from target-scoped racial Traits", () => {
  const attacker = { id: "hunter", faction: "player", combatStats: { maxSpeed: 6 } };
  const target = { id: "enemy", faction: "enemy", speed: 3 };
  const skilled = racialCatalog.getDefinition("half_dragon_skilled_hunter");
  const playerRuntime = { getCharacter() { return attacker; }, getTraits() { return [skilled]; } };
  const combatEngine = {
    applyPassiveModifiers() { return {}; },
    resolveStandardClash(unitA, skillA) {
      return { clashPower: this.applyPassiveModifiers(unitA, { skill: skillA }).clash_power || 0 };
    },
  };
  const { api } = loadStandardizationRuntime({ combatEngine, playerRuntime, datosJugador: attacker });
  api.installAll();
  expect(combatEngine.resolveStandardClash(attacker, { type: "Normal" }, target, { type: "Normal" }).clashPower).toBe(2);
});

test("legacy sheet Coin roller can re-toss the last failed Strength Check without LuminousCoinEngine", () => {
  const totalNode = { textContent: "10" };
  const coinImages = [
    { src: "https://imgur.com/yshLPnQ.png", dataset: {}, alt: "" },
    { src: "https://imgur.com/XDx0ICt.png", dataset: {}, alt: "" },
  ];
  const coinItems = coinImages.map((img) => ({ dataset: { stopped: "true" }, querySelector: () => img }));
  const container = {
    querySelector() { return null; },
    querySelectorAll(selector) { return selector === ".coin-toss-item" ? coinItems : []; },
  };
  const playerRuntime = {
    dispatch(trigger, runtime) {
      expect(trigger).toBe("check_coin_fail");
      expect(runtime.check).toMatchObject({ abilityId: "str", kind: "skill", failedCoinIndex: 1 });
      return { runtime: { check: { reTossLastCoin: 1 } } };
    },
  };
  const { api } = loadStandardizationRuntime({ playerRuntime, random: () => 0 });
  const result = api.applyCheckRetosses({
    coins: [
      { index: 0, side: "head", src: "https://imgur.com/yshLPnQ.png" },
      { index: 1, side: "tail", src: "https://imgur.com/XDx0ICt.png" },
    ],
    headsChance: 50,
    headBonus: 4,
    total: 10,
  }, { container, totalNode }, { abilityId: "str", kind: "skill", skillId: "athletics" });

  expect(result.coins[1].side).toBe("head");
  expect(result.total).toBe(14);
  expect(result.reTosses).toEqual({ coinIndex: 1, attempted: 1, maximum: 1 });
  expect(coinImages[1].src).toBe("https://imgur.com/yshLPnQ.png");
  expect(totalNode.textContent).toBe("14");
});

test("legacy re-toss writes the adjusted total through the HUD suppression API instead of retriggering proficiency bonus", () => {
  const totalNode = { textContent: "12" };
  const writes = [];
  const playerStats = {
    setRollTotalWithoutAdjustment(value, node) {
      writes.push(value);
      node.textContent = String(value);
      return true;
    },
  };
  const playerRuntime = {
    dispatch() { return { runtime: { check: { reTossLastCoin: 1 } } }; },
  };
  const { api } = loadStandardizationRuntime({ playerRuntime, playerStats, random: () => 0 });
  const result = api.applyCheckRetosses({
    coins: [{ index: 0, side: "tail", src: "https://imgur.com/XDx0ICt.png" }],
    headsChance: 50,
    headBonus: 4,
    total: 12,
  }, { container: { querySelector() { return null; }, querySelectorAll() { return []; } }, totalNode }, { abilityId: "str", kind: "skill", skillId: "athletics" });

  expect(result.total).toBe(16);
  expect(writes).toEqual([16]);
  expect(totalNode.textContent).toBe("16");
  expect(read("js/player-stats-ability-bar.js")).toContain("setRollTotalWithoutAdjustment");
});

test("legacy Check bridge is wired to the actual sheet roll selector and excludes Saving Throws", () => {
  const source = read("js/trait-standardization-runtime.js");
  const productionRoller = read("hoja_personaje.js");
  expect(productionRoller).toContain('.sheet-roll-skill-btn');
  expect(productionRoller).toContain('coinWrapper.dataset.stopped = "true"');
  expect(source).toContain('.sheet-roll-skill-btn');
  expect(source).toContain('new MutationObserver(tryResolve)');
  expect(source).toContain('["ability", "skill"].includes');
  expect(source).toContain('saving[\\s_-]*throw|save|salvaci[oó]n');
  expect(source).toContain('installLegacyCheckBridge();');
});

test("player Trait runtime resolves manual combat activations against the live CombatEngine Unit", () => {
  const document = makeDocument();
  const snapshot = { id: "aasimar_live", hp: 2, maxHp: 20, stats: { constitucion: 10 }, characterBuild: { raceId: "aasimar", calculatedAtLevel: 20 } };
  const liveUnit = { id: "aasimar_live", hp: 5, maxHp: 20, stats: { constitucion: 10 } };
  const fakeWindow = eventTarget({
    document,
    LuminousGameContext: "combat",
    LuminousTraitEngine: traitEngine,
    LuminousTraitCatalogCore: { allDefinitions: () => ({}), allGrants: () => [] },
    LuminousRacialTraitCatalog: racialCatalog,
    LuminousClassMilestones: { resolveSelectedGeneralTraits: () => [] },
    LuminousTraitPlayerTray: { mount: () => null },
    LuminousTheatreRolls: null,
    CombatEngine: null,
    datosJugador: snapshot,
    combatData: { aasimar_live: liveUnit },
    firebase: null,
    localStorage: { getItem: () => null },
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    setInterval() { return 1; },
    setTimeout(handler) { handler(); return 1; },
    console,
  });
  const context = vm.createContext({ window: fakeWindow, document, console, CustomEvent: fakeWindow.CustomEvent, setInterval: fakeWindow.setInterval, setTimeout: fakeWindow.setTimeout });
  vm.runInContext(read("js/player-trait-runtime.js"), context, { filename: "player-trait-runtime.js" });
  const runtime = fakeWindow.LuminousPlayerTraitRuntime.getRuntime();
  expect(runtime.context).toBe("combat");
  expect(runtime.self).toBe(liveUnit);
  expect(runtime.character).toBe(snapshot);
  expect(runtime.level).toBe(20);
  traitEngine.activateTrait(racialCatalog.getDefinition("aasimar_healing_hands"), runtime, traitEngine.createState());
  expect(liveUnit.hp).toBe(15);
  expect(snapshot.hp).toBe(2);
});
