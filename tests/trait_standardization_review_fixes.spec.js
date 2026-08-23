const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const traitEngine = require("../js/trait-engine.js");
const statusEngine = require("../js/status-engine.js");
const modifiers = require("../js/universal-modifier-engine.js");

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
    CombatEngine: overrides.combatEngine || null,
    datosJugador: overrides.datosJugador || null,
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
      // Deliberately mirrors the legacy factory bug: skillRange is not copied.
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
