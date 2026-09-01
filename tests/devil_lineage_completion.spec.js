const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const traitEngine = require("../js/trait-engine.js");
const archetypeEngine = require("../js/archetype-engine.js");
const catalog = require("../js/archetype-trait-catalog.js");
const anatomy = require("../js/anatomy-equipment-engine.js");
const injuries = require("../js/injury-engine.js");

const runtimeSource = fs.readFileSync(path.join(__dirname, "..", "js", "archetype-combat-event-runtime.js"), "utf8");
const DEVIL = "path_of_the_devil_lineage";

function devilUnit(level, extra = {}) {
  return {
    id: extra.id || `devil_${level}`,
    hp: extra.hp ?? 100,
    maxHp: extra.maxHp ?? 100,
    faction: extra.faction ?? "player",
    stats: { fuerza: 18, constitucion: 14, ...(extra.stats || {}) },
    statusEffects: extra.statusEffects || {},
    characterBuild: extra.characterBuild || {
      classes: [{ classId: "barbarian", level }],
      archetypes: [{ classId: "barbarian", archetypeId: DEVIL, selectedAtClassLevel: 15 }],
    },
    ...extra,
  };
}

function combatSandbox(random = () => 0) {
  const math = Object.create(Math);
  math.random = random;
  const document = {};
  const window = {
    document,
    console,
    Math: math,
    STATUS_REGISTRY: {},
    setInterval() {},
    LuminousArchetypeRuntime: {
      devilLineageLevel(unit) {
        const build = unit?.characterBuild || {};
        const selected = (build.archetypes || []).some((entry) => entry.archetypeId === DEVIL && entry.classId === "barbarian");
        if (!selected) return 0;
        return Number((build.classes || []).find((entry) => entry.classId === "barbarian")?.level || 0);
      },
      syncArchetypeTraitsForUnit() {},
    },
    LuminousTraitStandardizationRuntime: { resolveTraitRuntimeResolutions() {} },
  };
  window.window = window;
  window.CombatEngine = {
    initializeUnitData() {},
    triggerEncounterStart() {},
    triggerPhase() {},
    triggerEvent(tag) {
      if (tag === "[On Crit]") window.critEvents = (window.critEvents || 0) + 1;
    },
    getAllAliveUnits() { return window.units || []; },
    applyDamage(unit, damage) { unit.hp = Math.max(0, unit.hp - damage); return { hp: unit.hp }; },
    resolveUnilateralWithCounter(attacker, skill, defender, counterSkill, options = {}) {
      const context = { attacker, defender, skill, targetsHit: [defender] };
      const coins = [...(skill.coins || [])];
      for (const coin of coins) {
        context.currentCoin = coin;
        this.triggerEvent("[Coin Start]", context, [defender]);
        let critRate = 0.05;
        Object.entries(defender.statusEffects || {}).forEach(([statusId, status]) => {
          const config = window.STATUS_REGISTRY[statusId];
          if (config?.crit_vulnerability_per_count) critRate += config.crit_vulnerability_per_count * Number(status?.count || 1);
        });
        const critical = window.Math.random() < critRate;
        this.applyDamage(defender, 1, "directo", critical, skill);
        this.triggerEvent("[On Hit]", context, [defender]);
        if (critical) this.triggerEvent("[On Crit]", context, [defender]);
        if (defender.hp <= 0) {
          this.triggerEvent("[On Kill]", context, [defender]);
          if (critical) this.triggerEvent("[On Crit Kill]", context, [defender]);
        }
        this.triggerEvent("[Current Coin Attack End]", context, [defender]);
      }
      this.triggerEvent("[Attack End]", context, [defender]);
      return { attackLogs: [], pendingActions: [] };
    },
  };
  vm.runInNewContext(runtimeSource, { window, console, WeakMap, Map, Set, Object, Array, Math: math }, { filename: "archetype-combat-event-runtime.js" });
  return window;
}

test("Devil Lineage catalog carries the corrected closed-rule mechanics", () => {
  const devilStrength = catalog.DEFINITIONS.devil_lineage_devil_strength;
  expect(devilStrength.mechanics.twoHandedAsOneHanded).toBe(true);

  const improved = catalog.DEFINITIONS.devil_lineage_improved_devil_strength;
  expect(improved.rules).toHaveLength(2);
  expect(improved.rules.every((rule) => rule.whileStatus === "rage")).toBe(true);

  const regeneration = catalog.DEFINITIONS.devil_lineage_demonic_regeneration;
  expect(regeneration.mechanics.bodyPartRegenerationHours).toBe(72);

  const endurance = catalog.DEFINITIONS.devil_lineage_supernatural_endurance;
  expect(endurance.effects[0].trigger).toBe("before_check");
  expect(endurance.effects[0].operations[0]).toMatchObject({ type: "modify", path: "check.deathSavePower", mode: "add", value: 2 });
});

test("Supernatural Endurance gives +2 Death Save Power through the real Trait Check channel", () => {
  const trait = catalog.DEFINITIONS.devil_lineage_supernatural_endurance;
  const unit = devilUnit(50, { hp: 0, lifeState: "downed", isDowned: true });
  const runtime = {
    context: "combat",
    character: unit,
    self: unit,
    sourceClassId: "barbarian",
    check: { kind: "death_save", deathSavePower: 0 },
  };
  traitEngine.dispatchTrait(trait, "before_check", runtime, traitEngine.createState());
  expect(runtime.check.deathSavePower).toBe(2);
});

test("Demonic Resistance cannot self-heal a Downed unit but still heals a living unit", () => {
  const trait = catalog.DEFINITIONS.devil_lineage_demonic_resistance;
  const downed = devilUnit(15, { hp: 0, maxHp: 100, lifeState: "downed", isDowned: true, proficiency: 2 });
  traitEngine.dispatchTrait(trait, "turn_start", { context: "combat", character: downed, self: downed, sourceClassId: "barbarian" }, traitEngine.createState());
  expect(downed.hp).toBe(0);

  const living = devilUnit(15, { hp: 50, maxHp: 100, lifeState: "alive", isDowned: false, proficiency: 2 });
  traitEngine.dispatchTrait(trait, "turn_start", { context: "combat", character: living, self: living, sourceClassId: "barbarian" }, traitEngine.createState());
  expect(living.hp).toBe(54);
});

test("Devil Strength bridges into the real hand-capacity engine", () => {
  global.LuminousArchetypeEngine = archetypeEngine;
  delete global.LuminousDevilLineageRuntime;
  const devilRuntime = require("../js/devil-lineage-runtime.js");
  const unit = devilUnit(15);
  devilRuntime.syncEquipmentRules(unit);

  const items = [
    { id: "greatsword", equipped: true, equipment: { kind: "weapon", handCost: 2 } },
    { id: "shield", equipped: true, equipment: { kind: "shield", handCost: 1 } },
  ];
  const result = anatomy.validateEquipment(unit, items);
  expect(result.valid).toBe(true);
  expect(result.assignments.find((entry) => entry.item.id === "greatsword").partIds).toHaveLength(1);
});

test("Demonic Regeneration requires 72 continuous hours at 1+ HP and restores structural loss", () => {
  global.LuminousArchetypeEngine = archetypeEngine;
  global.LuminousInjuryEngine = injuries;
  delete global.LuminousDevilLineageRuntime;
  delete require.cache[require.resolve("../js/devil-lineage-runtime.js")];
  const devilRuntime = require("../js/devil-lineage-runtime.js");
  const unit = devilUnit(70, { hp: 10, maxHp: 100, injuries: [] });
  const gained = injuries.gainInjury(unit, { ...injuries.definition("missing_hand"), affectedParts: ["left_hand"] }, { persist: false });
  const ref = gained.injury.instanceId;

  devilRuntime.advanceRegeneration(unit, 48, { persist: false });
  expect(injuries.activeInjuries(unit).find((entry) => entry.instanceId === ref).metadata.devilLineageRegenerationHours).toBe(48);

  devilRuntime.resetRegeneration(unit, { persist: false, reason: "downed" });
  devilRuntime.advanceRegeneration(unit, 24, { persist: false });
  expect(injuries.activeInjuries(unit).find((entry) => entry.instanceId === ref).metadata.devilLineageRegenerationHours).toBe(24);

  devilRuntime.advanceRegeneration(unit, 48, { persist: false });
  expect(injuries.activeInjuries(unit).some((entry) => entry.instanceId === ref)).toBe(false);
  expect(unit.anatomyRuntime.parts.left_hand.state).toBe("available");
});

test("Infernal Touch adds +10% Critical Chance at half HP or less", () => {
  const window = combatSandbox(() => 0.10);
  const attacker = devilUnit(30, { hp: 50, maxHp: 100 });
  const defender = { id: "target", hp: 10, maxHp: 10, faction: "enemy", statusEffects: {} };
  window.units = [attacker, defender];
  window.CombatEngine.resolveUnilateralWithCounter(attacker, { coinAmount: 1, coinType: "standard", coins: [{ status: "active", effects: [] }] }, defender, null, { combatants: window.units });
  expect(window.critEvents).toBe(1);
  expect(defender.statusEffects[window.LuminousArchetypeCombatEventRuntime.LOW_HP_CRIT_STATUS_ID]).toBeUndefined();
});

test("Infernal Touch executes the reused last Coin once per Turn for 2-3 Coin Skills", () => {
  const window = combatSandbox(() => 0);
  const attacker = devilUnit(30, { hp: 100, maxHp: 100 });
  const defender = { id: "target", hp: 10, maxHp: 10, faction: "enemy", statusEffects: {} };
  window.units = [attacker, defender];
  const skill = { coinAmount: 2, coinType: "standard", coins: [{ status: "active", effects: [] }, { status: "active", effects: [] }] };

  window.CombatEngine.resolveUnilateralWithCounter(attacker, skill, defender, null, { combatants: window.units });
  expect(defender.hp).toBe(7);

  window.CombatEngine.resolveUnilateralWithCounter(attacker, skill, defender, null, { combatants: window.units });
  expect(defender.hp).toBe(5);

  window.CombatEngine.triggerPhase("[Round Start]", window.units);
  window.CombatEngine.resolveUnilateralWithCounter(attacker, skill, defender, null, { combatants: window.units });
  expect(defender.hp).toBe(2);
});

test("Infernal Touch reuses a 1-Coin Skill on Critical Kill once per Turn", () => {
  const window = combatSandbox(() => 0);
  const attacker = devilUnit(30, { hp: 100, maxHp: 100 });
  const killed = { id: "killed", hp: 1, maxHp: 1, faction: "enemy", statusEffects: {} };
  const next = { id: "next", hp: 3, maxHp: 3, faction: "enemy", statusEffects: {} };
  window.units = [attacker, killed, next];
  const skill = { coinAmount: 1, coinType: "standard", coins: [{ status: "active", effects: [] }] };

  window.CombatEngine.resolveUnilateralWithCounter(attacker, skill, killed, null, { combatants: window.units });
  expect(killed.hp).toBe(0);
  expect(next.hp).toBe(2);
});
