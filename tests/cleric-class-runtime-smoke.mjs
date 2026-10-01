import assert from "node:assert/strict";

for (const key of [
  "LuminousTraitEngine",
  "LuminousTraitCatalogCore",
  "LuminousCreatureTypeCatalog",
  "LuminousSpellcastingRuntime",
  "LuminousCasterSpellcastingTraitsRuntime",
  "LuminousClericClassRuntime",
]) delete globalThis[key];

await import("../js/trait-engine.js");
await import("../js/trait-catalog-core.js");
await import("../js/creature-type-catalog.js");
await import("../js/spellcasting-runtime.js");
await import("../js/caster-spellcasting-traits-runtime.js");
await import("../js/cleric-class-runtime.js");

const cleric = globalThis.LuminousClericClassRuntime;
const engine = globalThis.LuminousTraitEngine;
const catalog = globalThis.LuminousTraitCatalogCore;
const spellcasting = globalThis.LuminousSpellcastingRuntime;

assert.ok(cleric, "Cleric runtime should install");
assert.equal(cleric.TURN_UNDEAD_RANGE_FEET, 30);
assert.equal(spellcasting.getClassSpellcastingProfile("cleric").abilityId, "wis");
assert.equal(spellcasting.getClassSpellcastingProfile("cleric").progression, "full");

const makeCleric = (level) => ({
  id: "cleric_" + level,
  proficiency: Math.max(1, Math.ceil(level / 20)),
  stats: { sabiduria: 16 },
  classes: [{ id: "cleric", level }],
});

const lv1 = makeCleric(1);
assert.deepEqual(spellcasting.getClassSpellSlotTable(lv1, "cleric"), { 1: 2 });
let traits = engine.resolveTraitGrants(lv1, catalog.allGrants(), catalog.allDefinitions());
assert.ok(traits.some((trait) => trait.id === "spellcasting_ability_cleric"), "Shared caster runtime should grant Cleric Spellcasting");
assert.ok(!traits.some((trait) => trait.id === "divine_domain"), "Base Cleric trunk should not include Divine Domain until archetypes are implemented");
assert.ok(!traits.some((trait) => trait.id === "channel_divinity"));

assert.equal(cleric.channelDivinityMaximum(makeCleric(9)), 0);
assert.equal(cleric.channelDivinityMaximum(makeCleric(10)), 1);
assert.equal(cleric.channelDivinityMaximum(makeCleric(30)), 2);
assert.equal(cleric.channelDivinityMaximum(makeCleric(90)), 3);

const lv10 = makeCleric(10);
traits = engine.resolveTraitGrants(lv10, catalog.allGrants(), catalog.allDefinitions());
assert.ok(traits.some((trait) => trait.id === "channel_divinity"));
assert.ok(traits.some((trait) => trait.id === "turn_undead"));
assert.equal(cleric.destroyUndeadThreshold(lv10), null);

assert.deepEqual(cleric.channelDivinityPool(lv10), { current: 1, maximum: 1 });
assert.equal(cleric.spendChannelDivinity(lv10).success, true);
assert.deepEqual(cleric.channelDivinityPool(lv10), { current: 0, maximum: 1 });
assert.equal(cleric.spendChannelDivinity(lv10).success, false);
assert.equal(cleric.handleRest(lv10, "short_rest").channelDivinityRecovered, 1);
assert.deepEqual(cleric.channelDivinityPool(lv10), { current: 1, maximum: 1 });

const zombie = { id: "zombie", creatureType: "undead", challengeRating: 0.25, hp: 12 };
const skeleton = { id: "skeleton", creatureType: "undead", challengeRating: 1, hp: 15 };
const bandit = { id: "bandit", creatureType: "humanoid", hp: 20 };

let turn = cleric.resolveTurnUndead(lv10, [zombie, bandit], {
  saveResults: { zombie: false },
});
assert.equal(turn.success, true);
assert.equal(turn.outcomes[0].destroyed, false);
assert.equal(turn.outcomes[0].turned.active, true);
assert.equal(turn.outcomes[1].reason, "not_undead");
assert.equal(zombie.turnUndead.active, true);
assert.equal(cleric.onTurnedTargetDamaged(zombie).cleared, true);
assert.equal(zombie.turnUndead, undefined);

cleric.handleRest(lv10, "short_rest");
turn = cleric.resolveTurnUndead(lv10, [zombie], {
  saveResults: { zombie: true },
});
assert.equal(turn.outcomes[0].savePassed, true);
assert.equal(zombie.isDead, undefined);

// Real Trait activation path: Turn Undead must spend the shared Channel Divinity pool.
const trayCleric = makeCleric(10);
const trayZombie = { id: "tray_zombie", creatureType: "undead", challengeRating: 1, hp: 12, turnUndeadSavePassed: false };
const trayTraits = engine.resolveTraitGrants(trayCleric, catalog.allGrants(), catalog.allDefinitions());
const turnTrait = trayTraits.find((trait) => trait.id === "turn_undead");
assert.ok(turnTrait);
let activated = engine.activateTrait(turnTrait, {
  context: "combat",
  character: trayCleric,
  self: trayCleric,
  targets: [trayZombie],
});
assert.equal(activated.available, true);
assert.equal(activated.outcomes.some((outcome) => outcome.type === "cleric_turn_undead"), true);
assert.deepEqual(cleric.channelDivinityPool(trayCleric), { current: 0, maximum: 1 });
assert.equal(trayZombie.turnUndead?.active, true);

// Future Domain Channel Divinity features only declare a cost; the base runtime owns the pool.
const domainCleric = makeCleric(30);
const domainChannelProbe = {
  schemaVersion: 1,
  id: "domain_channel_probe",
  name: "Domain Channel Probe",
  source: { type: "class", id: "cleric", classId: "cleric" },
  contexts: ["combat"],
  activation: { type: "manual", actionCost: "none" },
  effects: [],
  rules: [],
  mechanics: { channelDivinityCost: 1 },
};
assert.deepEqual(cleric.channelDivinityPool(domainCleric), { current: 2, maximum: 2 });
const domainProbeResult = engine.activateTrait(domainChannelProbe, {
  context: "combat",
  character: domainCleric,
  self: domainCleric,
});
assert.equal(domainProbeResult.available, true);
assert.equal(domainProbeResult.outcomes.some((outcome) => outcome.type === "cleric_channel_divinity_spent"), true);
assert.deepEqual(cleric.channelDivinityPool(domainCleric), { current: 1, maximum: 2 });

const lv25 = makeCleric(25);
assert.equal(cleric.destroyUndeadThreshold(lv25), 0.5);
turn = cleric.resolveTurnUndead(lv25, [zombie, skeleton], {
  saveResults: { zombie: false, skeleton: false },
});
assert.equal(turn.outcomes[0].destroyed, true, "CR 1/4 Undead should be destroyed at Cleric Level 25");
assert.equal(zombie.isDead, true);
assert.equal(turn.outcomes[1].destroyed, false, "CR 1 Undead should not be destroyed until Cleric Level 40");
assert.equal(skeleton.turnUndead.active, true);

assert.equal(cleric.destroyUndeadThreshold(makeCleric(40)), 1);
assert.equal(cleric.destroyUndeadThreshold(makeCleric(55)), 2);
assert.equal(cleric.destroyUndeadThreshold(makeCleric(70)), 3);
assert.equal(cleric.destroyUndeadThreshold(makeCleric(85)), 4);

const lv50 = makeCleric(50);
traits = engine.resolveTraitGrants(lv50, catalog.allGrants(), catalog.allDefinitions());
assert.ok(traits.some((trait) => trait.id === "divine_intervention"));
assert.equal(cleric.divineInterventionChance(lv50), 10);

let intervention = cleric.attemptDivineIntervention(lv50, { roll: 99, request: "Save the party" });
assert.equal(intervention.intervened, false);
assert.equal(cleric.canAttemptDivineIntervention(lv50).reason, "divine_intervention_failed_until_long_rest");
cleric.handleRest(lv50, "long_rest");
assert.equal(cleric.canAttemptDivineIntervention(lv50).available, true);

intervention = cleric.attemptDivineIntervention(lv50, { roll: 5, request: "Save the party" });
assert.equal(intervention.intervened, true);
assert.equal(intervention.dmResolutionRequired, true);
assert.equal(cleric.divineInterventionState(lv50).cooldownDays, 7);
assert.equal(cleric.canAttemptDivineIntervention(lv50).reason, "divine_intervention_cooldown");
assert.deepEqual(cleric.handleDayStart(lv50), { before: 7, after: 6, reduced: 1 });

// Divine Intervention must also execute through the generic Trait action path.
const trayDivine = makeCleric(50);
const divineTraits = engine.resolveTraitGrants(trayDivine, catalog.allGrants(), catalog.allDefinitions());
const divineTrait = divineTraits.find((trait) => trait.id === "divine_intervention");
assert.ok(divineTrait);
let registeredDivineRequest = null;
activated = engine.activateTrait(divineTrait, {
  context: "combat",
  character: trayDivine,
  self: trayDivine,
  divineInterventionRoll: 1,
  request: "Protect the party",
  registerDmEffect: (descriptor) => {
    registeredDivineRequest = descriptor;
    return { id: "dm_divine_intervention", ...descriptor };
  },
});
assert.equal(activated.available, true);
const divineOutcome = activated.outcomes.find((outcome) => outcome.type === "cleric_divine_intervention");
assert.equal(divineOutcome?.intervened, true);
assert.equal(divineOutcome?.dmResolutionRequired, true);
assert.equal(registeredDivineRequest?.kind, "request");
assert.equal(registeredDivineRequest?.sourceTraitId, "divine_intervention");
assert.equal(cleric.divineInterventionState(trayDivine).cooldownDays, 7);

assert.equal(cleric.divineInterventionChance(makeCleric(95)), 19);
const lv100 = makeCleric(100);
assert.equal(cleric.divineInterventionChance(lv100), 100);
intervention = cleric.attemptDivineIntervention(lv100, { request: "Miracle" });
assert.equal(intervention.intervened, true);
assert.equal(intervention.automatic, true);
assert.equal(intervention.roll, null);
traits = engine.resolveTraitGrants(lv100, catalog.allGrants(), catalog.allDefinitions());
assert.ok(traits.some((trait) => trait.id === "divine_intervention_improvement"));

assert.equal(catalog.validateAll(engine).valid, true, "Expanded Cleric catalog should validate");

const clericPersistenceWrites = [];
const persistentCleric = makeCleric(10);
globalThis.LuminousPlayerTraitRuntime = { getCharacter: () => persistentCleric };
globalThis.localStorage = { getItem: (key) => key === "playerId" ? "cleric_smoke_player" : null };
globalThis.firebase = {
  database: () => ({
    ref: (path) => ({
      set: (value) => {
        clericPersistenceWrites.push({ path, value });
        return Promise.resolve();
      },
    }),
  }),
};
cleric.channelDivinityPool(persistentCleric);
cleric.spendChannelDivinity(persistentCleric, 1);
assert.equal(clericPersistenceWrites.at(-1)?.path, "campaña/jugadores/cleric_smoke_player/classResources/cleric");
assert.equal(clericPersistenceWrites.at(-1)?.value?.channelDivinity?.current, 0);

console.log("Cleric class runtime smoke passed: spellcasting, Channel Divinity, Turn/Destroy Undead, and Divine Intervention verified.");
