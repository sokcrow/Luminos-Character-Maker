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
  return raw.some((entry) => normalizeId(entry.classId || entry.parentClassId) === "barbarian"
    && normalizeId(entry.archetypeId || entry.subclassId || entry.id) === "path_of_the_zealot");
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
  resolveTraitGrants(character, grants = [], definitions = {}) {
    if (!isZealot(character)) return [];
    const level = barbarianLevel(character);
    return grants
      .filter((grant) => level >= Number(grant.atLevel || 0))
      .map((grant) => ({
        ...clone(definitions[grant.traitId]),
        source: { ...(definitions[grant.traitId]?.source || {}), ...(grant.source || {}) },
      }))
      .filter((trait) => trait.id);
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

await import("../js/trait-engine.js");
await import("../js/status-engine.js");

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
    if (!this.isDowned(unit) || this.isDead(unit)) return { changed: false, unit };
    const saves = this.ensureDeathState(unit);
    saves.successes += 1;
    if (saves.successes >= 3) {
      unit.lifeState = "alive";
      unit.isDowned = false;
      unit.hp = 5;
    }
    return { changed: true, unit, successes: saves.successes, failures: saves.failures };
  },
  rollDeathSave({ unit } = {}) {
    return { passed: Boolean(unit?.__nextDeathSavePass), total: unit?.__nextDeathSavePass ? 12 : 8, threshold: 10 };
  },
  resolveDeathSave(unit, options = {}) {
    const check = options.checkResult || this.rollDeathSave({ unit });
    const outcome = check.passed ? this.addSuccess(unit) : this.addFailure(unit, { reason: "death_save", check });
    return { resolved: true, unit, check, outcome };
  },
  resolveDeath(unit, options = {}) {
    unit.hp = 0;
    unit.lifeState = "dead";
    unit.isDead = true;
    unit.isDowned = false;
    unit.deathReason = options.reason || "death";
    unit.deathSaves = { successes: 0, failures: 0 };
    return { died: true, unit };
  },
  heal(unit, amount, options = {}) {
    if (this.isDead(unit) && !(options.revive || options.resurrection)) return { applied: 0, reason: "dead_requires_revival", unit };
    if (this.isDowned(unit) && Number(amount) > 0) {
      unit.lifeState = "alive";
      unit.isDowned = false;
      unit.hp = Number(amount);
      unit.deathSaves = { successes: 0, failures: 0 };
      return { applied: Number(amount), stabilized: true, unit };
    }
    unit.hp = Number(unit.hp || 0) + Number(amount || 0);
    return { applied: Number(amount || 0), unit };
  },
};
g.LuminousDeathSaveRuntime = deathApi;

g.CombatEngine = {
  __deathSaveRuntimeIntegrated: true,
  canUnitAct(unit) { return Boolean(unit && unit.hp > 0 && !unit.isDowned && !unit.isDead); },
  applyDamage(unit, amount, damageType = "directo", _isCritical = false, skillUsed = null) {
    if (unit.isDowned) {
      if (["status", "status_effect", "dot", "efecto_estado"].includes(normalizeId(damageType))) {
        return { hp: 0, deathSave: g.LuminousDeathSaveRuntime.addFailure(unit, { reason: "status_damage_while_downed" }) };
      }
      if (skillUsed) unit.__luminousDownedHitPending = true;
      return { hp: 0 };
    }
    unit.hp = Math.max(0, Number(unit.hp || 0) - Number(amount || 0));
    if (unit.hp <= 0) {
      unit.lifeState = "downed";
      unit.isDowned = true;
      unit.actionQueue = [];
      unit.deathSaves ||= { successes: 0, failures: 0 };
      return { hp: 0, downed: true };
    }
    return { hp: unit.hp };
  },
  applyHealing(unit, amount, options = {}) { return g.LuminousDeathSaveRuntime.heal(unit, amount, options); },
  reviveUnit(unit, amount = 1, options = {}) { return g.LuminousDeathSaveRuntime.heal(unit, amount, { ...options, revive: true }); },
  resolveDeathSave(unit, options = {}) { return g.LuminousDeathSaveRuntime.resolveDeathSave(unit, options); },
  triggerEvent(tag, context = {}, targetsHit = []) {
    if (tag === "[On Hit]") {
      (targetsHit.length ? targetsHit : [context.defender]).filter(Boolean).forEach((target) => {
        if (target.__luminousDownedHitPending || target.__luminousDownedAttackProxy) {
          g.LuminousDeathSaveRuntime.addFailure(target, { reason: "skill_hit_while_downed" });
          delete target.__luminousDownedHitPending;
        }
      });
    }
    return { tag };
  },
  triggerPhase(phaseTag, allUnits = []) {
    if (phaseTag === "[Round Start]") allUnits.forEach((unit) => { if (unit.isDowned) unit.actionQueue = []; });
    if (phaseTag === "[Round End]") allUnits.forEach((unit) => { if (unit.isDowned && !unit.isDead) g.LuminousDeathSaveRuntime.resolveDeathSave(unit); });
    return { phaseTag };
  },
  getAllAliveUnits() { return []; },
};

g.LuminousFixedDamageRuntime = {
  applyFixedDamage(unit, amount) {
    const before = Number(unit.hp || 0);
    unit.hp = Math.max(0, before - Number(amount || 0));
    return { applied: true, amount, hpBefore: before, hpAfter: unit.hp };
  },
};

g.LuminousTraitStandardizationRuntime = {
  resolveTraitRuntimeResolutions() { return []; },
  resolveCombatCheck(_unit, request = {}) {
    const total = Number(request.total ?? 8);
    const threshold = Number(request.threshold ?? 10);
    return { ...request, total, threshold, passed: total >= threshold, failed: total < threshold };
  },
  liveCombatUnits(runtime = {}) { return runtime.units || []; },
};

await import("../js/path-of-the-zealot-archetype-runtime.js");
const runtime = g.LuminousPathOfTheZealotArchetypeRuntime;
assert.ok(runtime, "Path of the Zealot runtime should install");
assert.equal(runtime.ARCHETYPE_ID, "path_of_the_zealot");
assert.equal(runtime.CLASS_ID, "barbarian");
assert.equal(g.LuminousArchetypeTraitCatalog.allArchetypes().path_of_the_zealot.name, "Path of the Zealot");

const makeZealot = (level, extra = {}) => ({
  id: `zealot_${level}_${Math.random()}`,
  name: "Zealot",
  faction: "player",
  hp: 100,
  maxHp: 100,
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
const traits70 = g.LuminousArchetypeTraitCatalog.resolveTraitGrants(makeZealot(70));
assert.equal(traits70.length, 5);
assert.equal(g.LuminousTraitCatalogCore.allGrants().length, 0, "Archetype grants must not leak through Core grants");

const divineActor = makeZealot(15);
g.LuminousStatusEngine.applyStatus(divineActor, "rage", { mode: "set" });
runtime.setDivineFuryDamageType(divineActor, "Necrotic");
const divineTarget = { id: "target", faction: "enemy", hp: 100, maxHp: 100, statusEffects: {} };
const divineResult = { outcomes: [] };
g.LuminousTraitStandardizationRuntime.resolveTraitRuntimeResolutions(
  [runtime.DEFINITIONS.divine_fury],
  "on_hit",
  { self: divineActor, attacker: divineActor, target: divineTarget, defender: divineTarget, damageDealt: 50 },
  divineResult,
);
assert.equal(runtime.divineFuryPercent(divineActor), 6);
assert.equal(divineTarget.hp, 97, "Divine Fury should deal 6% of 50 as 3 Fixed Damage");
assert.equal(divineResult.outcomes.at(-1).damageType, "Necrotic");
g.LuminousTraitStandardizationRuntime.resolveTraitRuntimeResolutions(
  [runtime.DEFINITIONS.divine_fury],
  "on_hit",
  { self: divineActor, target: divineTarget, damageDealt: 50 },
  { outcomes: [] },
);
assert.equal(divineTarget.hp, 97, "Divine Fury only applies to the first hit each Turn");
runtime.resetTurnState(divineActor);
g.LuminousTraitStandardizationRuntime.resolveTraitRuntimeResolutions(
  [runtime.DEFINITIONS.divine_fury],
  "on_hit",
  { self: divineActor, target: divineTarget, damageDealt: 50 },
  { outcomes: [] },
);
assert.equal(divineTarget.hp, 94, "Divine Fury resets on the next Turn");

const focusActor = makeZealot(30);
g.LuminousStatusEngine.applyStatus(focusActor, "rage", { mode: "set" });
assert.equal(g.LuminousStatusEngine.hasStatus(focusActor, runtime.FANATICAL_READY_STATUS), true, "Rage should arm Fanatical Focus");
const focusCheck = { kind: "save", abilityId: "wis", reTossLastCoin: 0 };
const focusState = g.LuminousTraitEngine.createState();
const focusResult = g.LuminousTraitEngine.dispatchTrait(
  runtime.DEFINITIONS.fanatical_focus,
  "check_coin_fail",
  { context: "theatre", character: focusActor, self: focusActor, check: focusCheck },
  focusState,
);
assert.ok(focusResult.outcomes.length > 0);
assert.equal(focusCheck.reTossLastCoin, 1, "Fanatical Focus should request one real Coin re-toss");
assert.equal(g.LuminousStatusEngine.hasStatus(focusActor, runtime.FANATICAL_READY_STATUS), false, "Fanatical Focus is consumed once per Rage");
g.LuminousStatusEngine.removeStatus(focusActor, "rage", { from: "self", ignoreProtection: true });
g.LuminousStatusEngine.applyStatus(focusActor, "rage", { mode: "set" });
assert.equal(g.LuminousStatusEngine.hasStatus(focusActor, runtime.FANATICAL_READY_STATUS), true, "A new Rage should re-arm Fanatical Focus");

const presenceActor = makeZealot(50);
const ally = { id: "ally", faction: "player", hp: 50, statusEffects: {} };
const enemy = { id: "enemy", faction: "enemy", hp: 50, statusEffects: {} };
const economy = { quick_action: 1, consume(cost) { if (cost !== "quick_action" || this.quick_action <= 0) return false; this.quick_action -= 1; return true; } };
const presenceState = g.LuminousTraitEngine.createState();
const presenceActivation = g.LuminousTraitEngine.activateTrait(
  runtime.DEFINITIONS.zealous_presence,
  { context: "combat", character: presenceActor, self: presenceActor, units: [presenceActor, ally, enemy], actionEconomy: economy },
  presenceState,
);
assert.equal(presenceActivation.available, true);
assert.equal(economy.quick_action, 0);
assert.equal(g.LuminousStatusEngine.hasStatus(presenceActor, runtime.ZEALOUS_PRESENCE_STATUS), true);
assert.equal(g.LuminousStatusEngine.hasStatus(ally, runtime.ZEALOUS_PRESENCE_STATUS), true);
assert.equal(g.LuminousStatusEngine.hasStatus(enemy, runtime.ZEALOUS_PRESENCE_STATUS), false);
const saveWithPresence = g.LuminousTraitStandardizationRuntime.resolveCombatCheck(ally, { kind: "save", total: 8, threshold: 10 });
assert.equal(saveWithPresence.total, 10);
assert.equal(saveWithPresence.passed, true, "Zealous Presence should add +2 to Saving Throws");

const rbd = makeZealot(70, { hp: 0, lifeState: "downed", isDowned: true, deathSaves: { successes: 0, failures: 2 }, actionQueue: ["skill_a"] });
g.LuminousStatusEngine.applyStatus(rbd, "rage", { mode: "set" });
assert.equal(g.CombatEngine.canUnitAct(rbd), true, "Rage Beyond Death should permit acting while Downed");
const thirdFailure = g.LuminousDeathSaveRuntime.addFailure(rbd, { reason: "test_third_failure" });
assert.equal(thirdFailure.deathDeferred, true);
assert.equal(rbd.lifeState, "downed");
assert.equal(rbd.isDead, undefined);
assert.equal(rbd.deathSaves.failures, 3);
assert.ok(rbd.__zealotDeferredDeath);
g.LuminousStatusEngine.removeStatus(rbd, "rage", { from: "self", ignoreProtection: true });
assert.equal(rbd.lifeState, "dead", "Deferred Death should resolve when Rage ends at 0 HP");

const healedRbd = makeZealot(70, { hp: 0, lifeState: "downed", isDowned: true, deathSaves: { successes: 0, failures: 2 } });
g.LuminousStatusEngine.applyStatus(healedRbd, "rage", { mode: "set" });
g.LuminousDeathSaveRuntime.addFailure(healedRbd, { reason: "test_third_failure" });
assert.ok(healedRbd.__zealotDeferredDeath);
g.CombatEngine.applyHealing(healedRbd, 12, { source: "external" });
assert.equal(healedRbd.hp, 12);
assert.equal(healedRbd.lifeState, "alive");
assert.equal(Boolean(healedRbd.__zealotDeferredDeath), false, "Valid Healing should clear deferred Death");

const roundEndRbd = makeZealot(70, { hp: 0, lifeState: "downed", isDowned: true, deathSaves: { successes: 0, failures: 2 }, __nextDeathSavePass: false });
g.LuminousStatusEngine.applyStatus(roundEndRbd, "rage", { mode: "set" });
g.CombatEngine.triggerPhase("[Round End]", [roundEndRbd]);
assert.equal(roundEndRbd.lifeState, "downed");
assert.equal(roundEndRbd.deathSaves.failures, 3);
assert.ok(roundEndRbd.__zealotDeferredDeath, "Round End Death Save must defer the third Failure instead of double-resolving it");

const hitRbd = makeZealot(70, { hp: 0, lifeState: "downed", isDowned: true, deathSaves: { successes: 0, failures: 2 }, __luminousDownedHitPending: true });
g.LuminousStatusEngine.applyStatus(hitRbd, "rage", { mode: "set" });
g.CombatEngine.triggerEvent("[On Hit]", { skill: { id: "test_skill" }, defender: hitRbd }, [hitRbd]);
assert.equal(hitRbd.lifeState, "downed");
assert.equal(hitRbd.deathSaves.failures, 3);
assert.ok(hitRbd.__zealotDeferredDeath, "A Skill hit while Downed must defer the third Failure");

const warrior = makeZealot(15);
const revivalOptions = runtime.revivalOptionsFor(warrior, { source: "resurrection" });
assert.equal(revivalOptions.waiveMaterialCost, true);
assert.equal(revivalOptions.waiveRevivalResourceCost, true);
assert.equal(revivalOptions.revivalCostMultiplier, 0);

console.log("Path of the Zealot archetype smoke passed.");
