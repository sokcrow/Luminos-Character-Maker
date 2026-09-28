import assert from "node:assert/strict";

const g = globalThis;
const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function barbarianLevel(character = {}) {
  const classes = Array.isArray(character.classes) ? character.classes : character.characterBuild?.classes || [];
  const found = classes.find((entry) => normalizeId(entry.id || entry.classId || entry.name) === "barbarian");
  return Number(found?.level ?? found?.levels ?? 0);
}

function isZealot(character = {}) {
  const raw = character.characterBuild?.archetypes || character.archetypes || [];
  return raw.some((entry) =>
    normalizeId(entry.classId || entry.parentClassId) === "barbarian"
    && normalizeId(entry.archetypeId || entry.subclassId || entry.id) === "path_of_the_zealot"
  );
}

g.LuminousArchetypeEngine = {
  getClassLevel(character, classId) {
    return normalizeId(classId) === "barbarian" ? barbarianLevel(character) : 0;
  },
  isSelected(character, archetypeId, classId) {
    return normalizeId(archetypeId) === "path_of_the_zealot"
      && normalizeId(classId) === "barbarian"
      && isZealot(character);
  },
};

g.LuminousArchetypeTraitCatalog = {
  ARCHETYPES: {},
  DEFINITIONS: {},
  GRANTS: [],
  allArchetypes() { return {}; },
  allDefinitions() { return {}; },
  allGrants() { return []; },
  getDefinition() { return null; },
  resolveTraitGrants() { return []; },
};

g.LuminousTraitCatalogCore = {
  allDefinitions() { return {}; },
  allGrants() { return []; },
  getDefinition() { return null; },
};

g.LuminousArchetypeRuntime = {
  syncArchetypeTraitsForUnit() { return []; },
};

g.STATUS_REGISTRY = {};
g.LuminousStatusEngine = {
  applyStatus(unit, statusId, input = {}) {
    unit.statusEffects ||= {};
    const id = normalizeId(statusId);
    const previous = unit.statusEffects[id];
    const mode = normalizeId(input.mode || "set");
    const count = Number(input.count ?? 1);
    const next = {
      id,
      name: statusId,
      count: mode === "gain" && previous ? Number(previous.count || 0) + count : count,
      potency: Number(input.potency || 0),
      duration: input.duration || "until_removed",
      data: { ...(previous?.data || {}), ...(input.data || {}) },
    };
    unit.statusEffects[id] = next;
    return next;
  },
  removeStatus(unit, statusId) {
    const id = normalizeId(statusId);
    const removed = Boolean(unit?.statusEffects?.[id]);
    if (removed) delete unit.statusEffects[id];
    return { removed };
  },
  hasStatus(unit, statusId) {
    return Boolean(unit?.statusEffects?.[normalizeId(statusId)]);
  },
  getStatus(unit, statusId) {
    return unit?.statusEffects?.[normalizeId(statusId)] || null;
  },
};

g.LuminousTraitEngine = {
  resolveTraitGrants() { return []; },
  createState() { return { usages: {} }; },
  activateTrait(trait, runtime = {}, state = { usages: {} }) {
    const cost = normalizeId(trait?.activation?.actionCost || "none");
    if (cost === "quick_action" && runtime.actionEconomy?.consume && !runtime.actionEconomy.consume("quick_action")) {
      return { available: false, reasons: ["No quick_action remaining."], trait, state, outcomes: [] };
    }
    const max = Number(trait?.activation?.uses?.max ?? 0);
    if (max > 0) {
      state.usages ||= {};
      state.usages[trait.id] ||= { used: 0, reset: trait.activation.uses.reset };
      if (state.usages[trait.id].used >= max) return { available: false, reasons: ["No uses remaining."], trait, state, outcomes: [] };
      state.usages[trait.id].used += 1;
    }
    return { available: true, scheduled: false, reasons: [], trait, state, outcomes: [] };
  },
};

g.LuminousConditionRuntime = {
  turnEnd(unit, options = {}) {
    if (!unit.__conditionRequest || typeof options.resolveCheck !== "function") return [];
    const result = options.resolveCheck(unit.__conditionRequest);
    return [{ ...unit.__conditionRequest, result }];
  },
};

g.LuminousConditionCombatBridge = {
  rollCheck(_engine, unit, request = {}, options = {}) {
    const rng = typeof options.rng === "function" ? options.rng : Math.random;
    const headsChance = 50 + Number(unit.sp || 0);
    const tosses = Array.from({ length: 5 }, () => rng() * 100 < headsChance);
    const heads = tosses.filter(Boolean).length;
    const base = Number(request.base || 0);
    const coinPower = Number(request.coinPower || 4);
    const total = base + heads * coinPower;
    const threshold = Number(request.threshold || 10);
    return { ...request, tosses, heads, headsChance, coinPower, total, threshold, passed: total >= threshold, failed: total < threshold };
  },
};

g.LuminousBattleViewerDmConsole074 = {
  rollCheck(unit, _player, request = {}, random = Math.random) {
    const headsChance = 50 + Number(unit.sp || 0);
    const coins = Array.from({ length: 5 }, () => random() * 100 < headsChance);
    const heads = coins.filter(Boolean).length;
    const coinPower = Number(request.coinPower || 4);
    const total = Number(request.base || 0) + heads * coinPower;
    const threshold = Number(request.threshold || 10);
    return { ...request, coins, heads, headsChance, coinPower, total, threshold, passed: total >= threshold, failed: total < threshold };
  },
};

const deathApi = {
  ensureDeathState(unit) {
    unit.deathSaves ||= { successes: 0, failures: 0 };
    unit.lifeState ||= unit.isDowned ? "downed" : unit.isDead ? "dead" : "alive";
    return unit.deathSaves;
  },
  isDowned(unit) { this.ensureDeathState(unit); return unit.lifeState === "downed" || unit.isDowned === true; },
  isDead(unit) { this.ensureDeathState(unit); return unit.lifeState === "dead" || unit.isDead === true; },
  isRetreated(unit) { this.ensureDeathState(unit); return unit.lifeState === "retreated" || unit.isRetreated === true; },
  addFailure(unit, options = {}) {
    if (!this.isDowned(unit) || this.isDead(unit)) return { changed: false, unit };
    const saves = this.ensureDeathState(unit);
    saves.failures += 1;
    const result = { changed: true, unit, failures: saves.failures, successes: saves.successes, reason: options.reason || "failure" };
    if (saves.failures >= 3) result.death = this.resolveDeath(unit, { reason: result.reason });
    return result;
  },
  addSuccess(unit) {
    const saves = this.ensureDeathState(unit);
    saves.successes += 1;
    return { changed: true, unit, successes: saves.successes, failures: saves.failures };
  },
  rollDeathSave(options = {}) {
    const tosses = options.tosses || ["tail", "tail", "head", "tail", "head"];
    const heads = tosses.filter((side) => side === "head").length;
    const coinPower = 4;
    const total = heads * coinPower;
    return { kind: "death_save", checkType: "death_save", tosses: [...tosses], heads, headsChance: 50, coinPower, total, threshold: 10, deathSaveThreshold: 10, passed: total >= 10, failed: total < 10 };
  },
  resolveDeathSave(unit, options = {}) {
    const check = options.checkResult || this.rollDeathSave(options);
    const outcome = check.passed ? this.addSuccess(unit) : this.addFailure(unit, { reason: "death_save", check });
    return { resolved: true, unit, check, outcome };
  },
  resolveDeath(unit, options = {}) {
    unit.hp = 0;
    unit.lifeState = "dead";
    unit.isDead = true;
    unit.isDowned = false;
    unit.deathReason = options.reason || "death";
    return { died: true, unit };
  },
  heal(unit, amount, options = {}) {
    const revival = Boolean(options.revive || options.resurrection || ["revival", "resurrection"].includes(normalizeId(options.source || options.healSource)));
    if (this.isDead(unit) && !revival) return { applied: 0, reason: "dead_requires_revival", unit };
    unit.lifeState = "alive";
    unit.isDead = false;
    unit.isDowned = false;
    unit.hp = Number(amount || 0);
    unit.deathSaves = { successes: 0, failures: 0 };
    return { applied: Number(amount || 0), unit };
  },
  canAct(unit) {
    return Boolean(unit && unit.hp > 0 && !unit.isDowned && !unit.isDead);
  },
};
g.LuminousDeathSaveRuntime = deathApi;

g.__combatUnits = [];
g.CombatEngine = {
  canUnitAct(unit) { return Boolean(unit && unit.hp > 0 && !unit.isDowned && !unit.isDead); },
  applyDamage(unit, amount) {
    const before = Number(unit.hp || 0);
    unit.hp = Math.max(0, before - Number(amount || 0));
    const result = { damageTaken: Math.min(before, Number(amount || 0)), hp: unit.hp };
    if (unit.hp <= 0 && before > 0) {
      unit.lifeState = "downed";
      unit.isDowned = true;
      unit.isDead = false;
      unit.deathSaves ||= { successes: 0, failures: 0 };
      unit.actionQueue = [];
      result.downed = true;
    }
    return result;
  },
  reviveUnit(unit, amount = 1, options = {}) {
    return g.LuminousDeathSaveRuntime.heal(unit, amount, { ...options, revive: true });
  },
  triggerPhase(phaseTag, allUnits = []) {
    if (normalizeId(phaseTag).includes("turn_start")) {
      allUnits.forEach((unit) => { if (unit.isDowned) unit.actionQueue = []; });
    }
    return { phaseTag };
  },
  getAllAliveUnits() { return g.__combatUnits.filter((unit) => Number(unit.hp || 0) > 0); },
};

g.LuminousFixedDamageRuntime = {
  applyFixedDamage(unit, amount) {
    const before = Number(unit.hp || 0);
    unit.hp = Math.max(0, before - Number(amount || 0));
    return { applied: true, amount: Number(amount || 0), hpBefore: before, hpAfter: unit.hp };
  },
};

g.LuminousTraitStandardizationRuntime = {
  resolveCombatCheck(unit, request = {}) {
    const tosses = Array.isArray(request.tosses) ? [...request.tosses] : ["tail", "tail", "head", "tail", "head"];
    const heads = tosses.filter((side) => normalizeId(side) === "head").length;
    const coinPower = Number(request.coinPower || 4);
    const total = Number(request.base || 0) + heads * coinPower;
    const threshold = Number(request.threshold || 10);
    return { ...request, tosses, heads, headsChance: 50 + Number(unit.sp || 0), coinPower, total, threshold, passed: total >= threshold, failed: total < threshold };
  },
};

await import("../js/path-of-the-zealot-archetype-runtime.js");
const runtime = g.LuminousPathOfTheZealotArchetypeRuntime;

assert.ok(runtime, "Path of the Zealot runtime should install");
assert.equal(runtime.ARCHETYPE_ID, "path_of_the_zealot");
assert.equal(g.LuminousArchetypeTraitCatalog.allArchetypes().path_of_the_zealot.name, "Path of the Zealot");

const makeZealot = (level, extra = {}) => ({
  id: `zealot_${level}_${Math.random()}`,
  name: "Zealot",
  faction: "player",
  hp: 100,
  maxHp: 100,
  sp: 0,
  shield: 0,
  actionQueue: ["skill_a"],
  statusEffects: {},
  deathSaves: { successes: 0, failures: 0 },
  classes: [{ id: "barbarian", level }],
  characterBuild: {
    classes: [{ id: "barbarian", level }],
    archetypes: [{ classId: "barbarian", archetypeId: "path_of_the_zealot" }],
  },
  ...extra,
});

const traits15 = g.LuminousArchetypeTraitCatalog.resolveTraitGrants(makeZealot(15));
assert.deepEqual(traits15.map((trait) => trait.id).sort(), ["divine_fury", "warrior_of_the_gods"].sort());
assert.ok(g.LuminousArchetypeTraitCatalog.resolveTraitGrants(makeZealot(30)).some((trait) => trait.id === "fanatical_focus"));
assert.ok(g.LuminousArchetypeTraitCatalog.resolveTraitGrants(makeZealot(50)).some((trait) => trait.id === "zealous_presence"));
assert.equal(g.LuminousArchetypeTraitCatalog.resolveTraitGrants(makeZealot(70)).length, 5);

assert.equal(runtime.DEFINITIONS.divine_fury.description, "While having Rage, Radiance deals +1% Fixed Damage.");
assert.match(runtime.DEFINITIONS.warrior_of_the_gods.description, /gain Rage without spending a use/);
assert.match(runtime.DEFINITIONS.fanatical_focus.description, /re-toss all Coins that rolled Tails once/);
assert.match(runtime.DEFINITIONS.zealous_presence.description, /floor\(Class Level \/ 4\)/);
assert.match(runtime.DEFINITIONS.rage_beyond_death.description, /Death is delayed until Rage ends/);

const divineActor = makeZealot(15);
g.LuminousStatusEngine.applyStatus(divineActor, "rage", { mode: "set" });
const divineTarget = { id: "divine_target", faction: "enemy", hp: 500, statusEffects: {} };
g.LuminousStatusEngine.applyStatus(divineTarget, "radiance", { mode: "set", count: 2 });
g.__combatUnits = [divineActor, divineTarget];
g.CombatEngine.applyDamage(divineTarget, 200, "directo", false, null, { attacker: divineActor, units: g.__combatUnits });
assert.equal(divineTarget.hp, 298, "Divine Fury should add 1% of the 200 final hit as Fixed Damage");
const noRadianceTarget = { id: "no_radiance", faction: "enemy", hp: 500, statusEffects: {} };
g.CombatEngine.applyDamage(noRadianceTarget, 200, "directo", false, null, { attacker: divineActor, units: [divineActor, noRadianceTarget] });
assert.equal(noRadianceTarget.hp, 300, "Divine Fury should not trigger without Radiance");

const warrior = makeZealot(15, { hp: 10 });
const enemies = Array.from({ length: 4 }, (_, index) => ({ id: `enemy_${index}`, faction: "enemy", hp: 50, statusEffects: {} }));
g.__combatUnits = [warrior, ...enemies];
g.CombatEngine.applyDamage(warrior, 10, "directo", false, null, { attacker: enemies[0], units: g.__combatUnits, random: () => 0 });
const radianceTargets = enemies.filter((unit) => Number(unit.statusEffects.radiance?.count || 0) === 4);
assert.equal(radianceTargets.length, 3, "Warrior of the Gods should inflict 4 Radiance on 3 random enemies");

warrior.lifeState = "dead";
warrior.isDead = true;
warrior.isDowned = false;
warrior.hp = 0;
g.CombatEngine.reviveUnit(warrior, 5, { resurrection: true });
assert.equal(warrior.hp, 5);
assert.equal(g.LuminousStatusEngine.hasStatus(warrior, "rage"), true, "Revival should grant Rage without spending a Rage use");

const focus = makeZealot(30);
g.LuminousStatusEngine.applyStatus(focus, "rage", { mode: "set" });
const focusResult = g.LuminousConditionCombatBridge.rollCheck(
  g.CombatEngine,
  focus,
  { kind: "save", abilityId: "wis", threshold: 18, coinPower: 4 },
  { rng: () => 0.99 },
);
assert.equal(focusResult.failed, true);
assert.equal(focusResult.fanaticalFocus.triggered, true);
assert.equal(focusResult.fanaticalFocus.reTossed, 5, "All Tails should be re-tossed once");
assert.equal(focus.__zealotFanaticalConsumedThisRage, true);

const secondFocus = g.LuminousTraitStandardizationRuntime.resolveCombatCheck(focus, {
  kind: "ability",
  abilityId: "str",
  threshold: 18,
  tosses: ["tail", "tail", "tail", "tail", "tail"],
});
assert.equal(secondFocus.fanaticalFocus, undefined, "Fanatical Focus can only trigger once per Rage");

g.LuminousStatusEngine.removeStatus(focus, "rage");
g.LuminousStatusEngine.applyStatus(focus, "rage", { mode: "set" });
const rerolledToPass = g.LuminousTraitStandardizationRuntime.resolveCombatCheck(focus, {
  kind: "ability",
  abilityId: "str",
  threshold: 10,
  tosses: ["tail", "tail", "head", "tail", "head"],
});
assert.equal(rerolledToPass.fanaticalFocus.triggered, true, "A new Rage should re-arm Fanatical Focus");

g.LuminousStatusEngine.removeStatus(focus, "rage");
g.LuminousStatusEngine.applyStatus(focus, "rage", { mode: "set" });
focus.__conditionRequest = { type: "save_check", unit: focus, check: { kind: "save", threshold: 18, coinPower: 4 } };
const conditionOut = g.LuminousConditionRuntime.turnEnd(focus, {
  random: () => 0,
  resolveCheck(request) {
    return { ...request.check, tosses: [false, false, true, false, true], heads: 2, headsChance: 50, coinPower: 4, total: 8, threshold: 18, passed: false, failed: true };
  },
});
assert.equal(conditionOut[0].result.fanaticalFocus.triggered, true, "Condition saves should route through Fanatical Focus");

const presence = makeZealot(50);
const ally = { id: "ally", faction: "player", hp: 50, sp: 0, shield: 0, statusEffects: {} };
const enemy = { id: "enemy", faction: "enemy", hp: 50, sp: 0, shield: 0, statusEffects: {} };
g.__combatUnits = [presence, ally, enemy];
g.CombatEngine.triggerPhase("[Turn Start]", g.__combatUnits);
assert.equal(ally.shield, 12, "Level 50 Zealous Presence should grant floor(50/4)=12 Shield");
assert.equal(ally.sp, 4);
assert.equal(enemy.shield, 0);

const economy = {
  quick_action: 1,
  consume(cost) {
    if (cost !== "quick_action" || this.quick_action <= 0) return false;
    this.quick_action -= 1;
    return true;
  },
};
const traitState = g.LuminousTraitEngine.createState();
const activated = g.LuminousTraitEngine.activateTrait(
  runtime.DEFINITIONS.zealous_presence,
  { context: "combat", self: presence, character: presence, actionEconomy: economy },
  traitState,
);
assert.equal(activated.available, true);
assert.equal(economy.quick_action, 0);
g.CombatEngine.triggerPhase("[Turn Start]", g.__combatUnits);
assert.equal(ally.shield, 48, "Empowered pulse should add 36 Shield, not 12+36");
assert.equal(ally.sp, 16, "Empowered pulse should recover 12 SP");
g.CombatEngine.triggerPhase("[Turn Start]", g.__combatUnits);
assert.equal(ally.shield, 60, "Following pulse should return to the normal +12 Shield");
assert.equal(ally.sp, 20);

const beyond = makeZealot(70, { hp: 0, lifeState: "downed", isDowned: true, isDead: false, deathSaves: { successes: 0, failures: 2 }, actionQueue: ["skill_a"] });
g.LuminousStatusEngine.applyStatus(beyond, "rage", { mode: "set" });
assert.equal(g.CombatEngine.canUnitAct(beyond), true, "Rage Beyond Death should allow acting while Downed");
const third = g.LuminousDeathSaveRuntime.addFailure(beyond, { reason: "test_third_failure" });
assert.equal(third.deathDeferred, true);
assert.equal(beyond.isDead, false);
assert.equal(beyond.deathSaves.failures, 3);
g.LuminousStatusEngine.removeStatus(beyond, "rage");
assert.equal(beyond.isDead, true, "Ending Rage at 0 HP after deferred Death should kill the Unit");

const healedBeyond = makeZealot(70, { hp: 0, lifeState: "downed", isDowned: true, isDead: false, deathSaves: { successes: 0, failures: 2 } });
g.LuminousStatusEngine.applyStatus(healedBeyond, "rage", { mode: "set" });
g.LuminousDeathSaveRuntime.addFailure(healedBeyond, { reason: "test_third_failure" });
g.LuminousDeathSaveRuntime.heal(healedBeyond, 5, { source: "external" });
assert.equal(healedBeyond.hp, 5);
g.LuminousStatusEngine.removeStatus(healedBeyond, "rage");
assert.equal(healedBeyond.isDead, false, "Valid Healing before Rage ends should prevent deferred Death");

console.log("Path of the Zealot approved-traits smoke passed.");
