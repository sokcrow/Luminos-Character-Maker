import assert from "node:assert/strict";

globalThis.window = globalThis;

await import("../js/combat-action-schema.js");
await import("../js/loot-check-runtime.js");
await import("../js/loot-knowledge-runtime.js");
await import("../js/combat-analyze-check-contract.js");
await import("../js/combat-analyze-runtime.js");
await import("../js/combat-action-adapters.js");
await import("../js/battle-viewer-action-adapter-073.js");
await import("../js/combat-action-resolver.js");

const schema = globalThis.LuminousCombatAction;
const checks = globalThis.LuminousLootCheckRuntime;
const knowledge = globalThis.LuminousLootKnowledgeRuntime;
const contract = globalThis.LuminousCombatAnalyzeCheckContract;
const analyzeRuntime = globalThis.LuminousCombatAnalyzeRuntime;
const adapters = globalThis.LuminousCombatActionAdapters;
const viewer = globalThis.LuminousBattleViewerActionAdapter073;
const resolver = globalThis.LuminousCombatActionResolver;

assert.ok(schema);
assert.ok(checks);
assert.ok(knowledge);
assert.ok(contract);
assert.ok(analyzeRuntime);
assert.ok(adapters);
assert.ok(viewer);
assert.ok(resolver);

const actor = {
  id: "player_analyzer",
  playerId: "player_analyzer",
  controlled: "player",
  stats: { wis: 14 },
  proficiencyBonus: 2,
  skillProficiency: { perception: "proficient" },
  sp: 0,
};

const goblin = {
  id: "enemy_goblin_001",
  definitionId: "goblin",
  species: "goblin",
  controlled: "ai",
  mechanics: {
    speed: "2-4",
    skills: ["hidden_full_skill_a", "hidden_full_skill_b"],
  },
  scores: { str: 18, dex: 20, int: 16, wis: 9, cha: 15 },
  traits: [
    { id: "nimble_escape", visible: true },
    { id: "secret_trait", visible: false },
  ],
  observationKnown: [],
};

globalThis.combatData = {
  [actor.id]: actor,
  [goblin.id]: goblin,
};

const normalPlan = {
  type: "global",
  actionKey: "analyze",
  targetId: goblin.id,
  knowledgeVisibility: "private",
  data: {
    id: "analyze",
    actionKey: "analyze",
    name: "Analyse",
    kind: "global",
  },
};

const compiled = viewer.compilePlan(`${actor.id}_slot_0`, null, normalPlan);
assert.ok(compiled.action, compiled.reason || "Analyze should compile");
assert.equal(compiled.action.source.type, "universal");
assert.equal(compiled.action.source.id, "analyze");
assert.equal(compiled.action.resolution.type, "check");
assert.deepEqual(compiled.action.resolution.check, {
  stat: "wis",
  skill: "perception",
  threshold: 10,
});
assert.equal(compiled.action.targeting.mainTargetId, goblin.id);
assert.equal(compiled.action.metadata.analyzeBypass, false);
assert.equal(compiled.action.metadata.knowledgeVisibility, "private");

const local = knowledge.createCompendium(actor.playerId);
let updatedCompendium = null;
const resolved = resolver.resolveCombatAction(compiled.action, {
  phase: schema.PHASES.COMBAT_PHASE,
  units: [actor, goblin],
  random: () => 0,
  encounterId: "encounter_analyze_001",
  now: 5000,
  compendium: local,
  usedSkillIdsByTarget: {
    [goblin.id]: ["goblin_shortbow_shot"],
  },
  visibleTraitsByTarget: {
    [goblin.id]: ["nimble_escape"],
  },
  defenseInteractionsByTarget: {
    [goblin.id]: [
      { damageType: "piercing", observedResult: "resisted" },
      { damageType: "bludgeoning", observedResult: "weak" },
    ],
  },
  updateCompendium(payload) {
    updatedCompendium = payload.compendium;
  },
});

assert.equal(resolved.resolved, true);
assert.equal(resolved.resolution.type, "check");
assert.equal(resolved.resolution.success, true);
assert.equal(resolved.resolution.check.skill, "perception");
assert.equal(resolved.resolution.check.ability, "wis");
assert.equal(resolved.resolution.check.base, 4);
assert.equal(resolved.resolution.check.total, 24);
assert.equal(resolved.resolution.check.threshold, 10);
assert.equal(resolved.resolution.check.engine, "deterministic");

const factIds = resolved.resolution.facts.map((fact) => fact.id).sort();
assert.deepEqual(factIds, [
  "combat.observed_defense_interactions",
  "combat.observed_skills",
  "combat.observed_speed",
  "combat.visible_traits",
].sort());

const speedFact = resolved.resolution.facts.find((fact) => fact.id === "combat.observed_speed");
assert.deepEqual(speedFact.value, { min: 2, max: 4 });
const skillsFact = resolved.resolution.facts.find((fact) => fact.id === "combat.observed_skills");
assert.deepEqual(skillsFact.value, ["goblin_shortbow_shot"]);
assert.equal(skillsFact.value.includes("hidden_full_skill_a"), false, "Analyze must not read the target's full hidden skill loadout");
const traitFact = resolved.resolution.facts.find((fact) => fact.id === "combat.visible_traits");
assert.deepEqual(traitFact.value, ["nimble_escape"]);
assert.equal(traitFact.value.includes("secret_trait"), false);

assert.equal(resolved.resolution.facts.some((fact) => fact.section === "stats"), false);
assert.equal(JSON.stringify(resolved.resolution.facts).includes('"str":18'), false);
assert.equal(JSON.stringify(resolved.resolution.facts).includes('"dex":20'), false);
assert.equal(JSON.stringify(resolved.resolution.facts).includes('"int":16'), false);

assert.ok(Array.isArray(goblin.observationKnown));
assert.equal(goblin.observationKnown.length, 4);
for (const entry of goblin.observationKnown) {
  assert.equal(entry.discoveredBy, actor.playerId);
  assert.equal(entry.visibility, "private");
}
assert.ok(updatedCompendium);
assert.ok(updatedCompendium.units.goblin);
assert.ok(updatedCompendium.units.goblin.facts["combat.observed_speed"]);
assert.equal(updatedCompendium.units.goblin.facts["combat.observed_speed"].visibility, "private");

const failedTarget = {
  id: "enemy_goblin_002",
  definitionId: "goblin",
  species: "goblin",
  mechanics: { speed: "3-5" },
  observationKnown: [],
};
const failedAction = adapters.compileUniversalAction(actor, "analyse", {
  targetId: failedTarget.id,
  targetUnitId: failedTarget.id,
  target: failedTarget,
});
const failed = resolver.resolveCombatAction(failedAction, {
  phase: schema.PHASES.COMBAT_PHASE,
  units: [actor, failedTarget],
  random: () => 0.99,
  usedSkillIdsByTarget: { [failedTarget.id]: ["some_seen_skill"] },
});
assert.equal(failed.resolved, true);
assert.equal(failed.resolution.success, false);
assert.equal(failed.resolution.facts.length, 0);
assert.equal(failedTarget.observationKnown.length, 0);

const wolf = {
  id: "enemy_wolf_001",
  definitionId: "wolf",
  species: "wolf",
  mechanics: { speed: "3-5" },
  observationKnown: [],
};
globalThis.combatData[wolf.id] = wolf;

const originalRanger = globalThis.LuminousRangerClassRuntime;
globalThis.LuminousRangerClassRuntime = {
  resolveAnalyse(_actor, target) {
    return target?.species === "wolf"
      ? { bypassCheck: true, automaticSuccess: true, sourceTraitId: "favored_enemy" }
      : { bypassCheck: false };
  },
};

const rangerPlan = {
  type: "global",
  actionKey: "analyze",
  targetId: wolf.id,
  knowledgeVisibility: "shared",
  data: { id: "analyze", actionKey: "analyze", name: "Analyse", kind: "global" },
};
const rangerCompiled = viewer.compilePlan(`${actor.id}_slot_1`, null, rangerPlan);
assert.equal(rangerCompiled.action.resolution.type, "automatic");
assert.equal(rangerCompiled.action.metadata.analyzeBypass, true);
assert.equal(rangerCompiled.action.metadata.analyzeSource, "ranger_favored_enemy");

const rangerResolved = resolver.resolveCombatAction(rangerCompiled.action, {
  phase: schema.PHASES.COMBAT_PHASE,
  units: [actor, wolf],
  encounterId: "encounter_analyze_002",
  observedSpeedByTarget: { [wolf.id]: { min: 3, max: 5 } },
  usedSkillIdsByTarget: { [wolf.id]: ["wolf_bite"] },
});
assert.equal(rangerResolved.resolved, true);
assert.equal(rangerResolved.resolution.type, "automatic_analyze");
assert.equal(rangerResolved.resolution.success, true);
assert.equal(rangerResolved.resolution.check.engine, "automatic_bypass");
assert.equal(rangerResolved.resolution.source, "ranger_favored_enemy");
assert.equal(rangerResolved.resolution.visibility, "shared");
assert.ok(wolf.observationKnown.some((entry) => entry.id === "combat.observed_speed"));
assert.ok(wolf.observationKnown.every((entry) => entry.visibility === "shared"));

const originalBattleMaster = globalThis.LuminousBattleMasterArchetypeRuntime;
globalThis.LuminousBattleMasterArchetypeRuntime = {
  knowYourEnemyRequest(_actor, turnNumber, enemyType) {
    return Number(turnNumber) >= 10 && enemyType === "goblin"
      ? {
          type: "analyse_feature_unlock",
          sourceTraitId: "know_your_enemy",
          enemyType,
          unlockFeatures: 1,
          bypassAnalyseCheck: true,
          advanceObservationLevel: true,
          useExistingObservationTarget: true,
        }
      : null;
  },
};

const bmTarget = {
  id: "enemy_goblin_bm",
  definitionId: "goblin",
  species: "goblin",
  mechanics: { speed: "2-4" },
  observationKnown: [],
};
const bmAction = adapters.compileUniversalAction(actor, "analyze", {
  targetId: bmTarget.id,
  targetUnitId: bmTarget.id,
  target: bmTarget,
  turnNumber: 10,
  observedEnemyType: "goblin",
});
assert.equal(bmAction.resolution.type, "automatic");
assert.equal(bmAction.metadata.analyzeSource, "battle_master_know_your_enemy");

const bmResolved = resolver.resolveCombatAction(bmAction, {
  phase: schema.PHASES.COMBAT_PHASE,
  units: [actor, bmTarget],
  turnNumber: 10,
  observedEnemyType: "goblin",
});
assert.equal(bmResolved.resolution.success, true);
assert.equal(bmResolved.resolution.source, "battle_master_know_your_enemy");

globalThis.LuminousRangerClassRuntime = originalRanger;
globalThis.LuminousBattleMasterArchetypeRuntime = originalBattleMaster;

console.log("Battle Analyze end-to-end smoke passed.");
