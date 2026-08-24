const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const runtimeSource = read("js/player-archetype-runtime.js");
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

function loadRuntime({ grantedTraits = [] } = {}) {
  const document = makeDocument();
  const window = {
    document,
    console,
    localStorage: { getItem() { return ""; } },
    addEventListener() {},
    setInterval() {},
    alert() {},
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

function devilUnit(level, extra = {}) {
  return {
    name: extra.name || `Devil Unit ${level}`,
    hp: extra.hp ?? 100,
    maxHp: extra.maxHp ?? 100,
    shield: extra.shield ?? 0,
    stats: { fuerza: 18, constitucion: 14, ...(extra.stats || {}) },
    statusEffects: extra.statusEffects || {},
    characterBuild: {
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
  };
}

test("Battle Viewer bootstraps Archetype Runtime through Status Engine", () => {
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

  // Healing between the lethal event and next Turn Start must not cancel the stored trigger.
  unit.hp = 8;
  window.CombatEngine.triggerPhase("[Round Start]", [unit]);
  // CON 14 => Mod +2 => Max(14, 28)% Max HP = 28 HP.
  expect(unit.hp).toBe(36);
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
