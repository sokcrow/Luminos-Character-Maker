import assert from "node:assert/strict";

globalThis.window = globalThis;

await import("../js/item-inventory-runtime.js");
await import("../js/item-harvest-integrity-engine.js");
await import("../js/unit-loot-profile-contract.js");
await import("../js/loot-check-runtime.js");
await import("../js/corpse-harvest-runtime.js");
await import("../js/loot-instance-runtime.js");
await import("../js/loot-postcombat-runtime.js");

const inventory = globalThis.LuminousItemInventoryRuntime;
const harvestIntegrity = globalThis.LuminousItemHarvestIntegrityEngine;
const lootContract = globalThis.LuminousUnitLootProfileContract;
const checks = globalThis.LuminousLootCheckRuntime;
const lootInstances = globalThis.LuminousLootInstanceRuntime;
const postCombat = globalThis.LuminousLootPostCombatRuntime;

assert.ok(inventory);
assert.ok(harvestIntegrity);
assert.ok(lootContract);
assert.ok(checks);
assert.ok(lootInstances);
assert.ok(postCombat);

const catalog = {
  ration: { id: "ration", name: "Ration", category: "food", stackable: true },
  medkit: { id: "medkit", name: "Medkit", category: "medicine", stackable: true },
  scrap_bundle: { id: "scrap_bundle", name: "Scrap", category: "material", stackable: true },
};

const profiles = lootContract.createProfiles({
  bodyProfile: {
    kind: "mixed",
    sizeClass: "medium",
    materials: ["flesh", "blood", "metal"],
    resources: [
      { id: "meat", integrityFamily: "meat", sourceMaterial: "flesh" },
      { id: "internal_organs", integrityFamily: "organ_internal", sourceMaterial: "flesh" },
      { id: "metal_frame", integrityFamily: "hard_cover_structural", sourceMaterial: "metal" },
    ],
  },
  lootProfile: {
    carried: [
      { itemId: "ration", category: "food", rarity: "guaranteed", quantity: 1 },
      { itemId: "medkit", category: "medicine", rarity: "guaranteed", quantity: 1 },
      { itemId: "scrap_bundle", category: "material", rarity: "guaranteed", quantity: 1 },
    ],
    equipment: { source: "none" },
    currency: { currencyId: "ahn", min: 150, max: 150, zeroAllowed: true },
    harvest: { source: "body_profile" },
  },
}, { harvestEngine: harvestIntegrity });

const unit = {
  id: "mixed_test_unit",
  combatId: "enemy:mixed:001",
  species: "test",
  bodyProfile: profiles.bodyProfile,
  lootProfile: profiles.lootProfile,
  maxHp: 20,
};

const generated = lootInstances.generateLootInstance(unit, {
  encounterId: "encounter_postcombat",
  unitInstanceId: unit.combatId,
  corpseId: "corpse_postcombat_001",
  catalog,
  dmOverrides: {
    harvest: {
      setQuantity: {
        meat: 3,
        internal_organs: 2,
        metal_frame: 2,
      },
    },
  },
});

assert.equal(generated.locked, false);
assert.throws(
  () => postCombat.createInteractionState(generated),
  /LOOT_INSTANCE_MUST_BE_LOCKED_BEFORE_POST_COMBAT/,
  "player interactions must never initialize from an unlocked/rerollable loot source",
);

const locked = lootInstances.lockLootInstance(generated, { unit, now: 100 });
const state0 = postCombat.createInteractionState(locked, { now: 101 });
assert.equal(postCombat.validateState(state0).valid, true);
assert.equal(state0.carried.length, 3);
assert.equal(state0.currency.remaining, 150);
assert.equal(state0.harvest.resources.find((r) => r.resourceId === "meat").remaining, 3);
assert.equal(state0.harvest.resources.find((r) => r.resourceId === "internal_organs").remaining, 2);
assert.equal(state0.harvest.resources.find((r) => r.resourceId === "metal_frame").remaining, 2);

const investigator = {
  id: "player_investigator",
  stats: { inteligencia: 14, sabiduria: 10 },
  proficiencyBonus: 2,
  skillProficiency: { investigation: "proficient" },
  sp: 0,
};
const expert = {
  id: "player_expert",
  stats: { inteligencia: 16, sabiduria: 12 },
  proficiencyBonus: 2,
  skillProficiency: { investigation: "expertise" },
  sp: 0,
};
const survivalist = {
  id: "player_survivalist",
  scores: { wis: 14 },
  proficiencyBonus: 2,
  proficiencies: { skills: { survival: "proficient" } },
  sp: 0,
};
const medic = {
  id: "player_medic",
  dndStats: { wis: 16 },
  proficiencyBonus: 2,
  dndSkills: { medicine: { proficiency: "expertise" } },
  sp: 0,
};
const salvager = {
  id: "player_salvager",
  dndStats: { int: 14 },
  proficiencyBonus: 2,
  dndSkillProficiency: { investigation: "half" },
  sp: 0,
};

assert.equal(checks.skillMath(investigator, "investigation").base, 4);
assert.equal(checks.skillMath(expert, "investigation").base, 7);
assert.equal(checks.skillMath(survivalist, "survival").base, 4);
assert.equal(checks.skillMath(medic, "medicine").base, 7);
assert.equal(checks.skillMath(salvager, "investigation").base, 3);

const searchDef = postCombat.checkDefinition(investigator, "search");
const harvestDef = postCombat.checkDefinition(survivalist, "harvest");
const extractDef = postCombat.checkDefinition(medic, "extract");
const salvageDef = postCombat.checkDefinition(salvager, "salvage");

assert.equal(searchDef.skill, "investigation");
assert.equal(searchDef.ability, "int");
assert.equal(searchDef.threshold, 10);
assert.equal(harvestDef.skill, "survival");
assert.equal(harvestDef.ability, "wis");
assert.equal(extractDef.skill, "medicine");
assert.equal(extractDef.ability, "wis");
assert.equal(extractDef.threshold, 12);
assert.equal(salvageDef.skill, "investigation");
assert.equal(salvageDef.ability, "int");

const allTails = () => 0.99;
const allHeads = () => 0.0;

const failedSearch = postCombat.performAction(state0, investigator, "search", { rng: allTails });
assert.equal(failedSearch.result.check.success, false);
assert.equal(failedSearch.result.recovery.items.length, 0);
assert.equal(failedSearch.result.recovery.currency, null);
assert.equal(failedSearch.state.carried.filter((entry) => entry.remaining > 0).length, 3);
assert.equal(failedSearch.state.currency.remaining, 150);

assert.throws(
  () => postCombat.performAction(failedSearch.state, investigator, "search", { rng: allHeads }),
  /POST_COMBAT_ATTEMPT_ALREADY_USED/,
  "same actor cannot spam the same general Search until it succeeds",
);

const successfulSearch = postCombat.performAction(failedSearch.state, expert, "search", { rng: allHeads });
assert.equal(successfulSearch.result.check.success, true);
assert.equal(successfulSearch.result.check.total, 27);
assert.equal(successfulSearch.result.check.margin, 17);
assert.equal(successfulSearch.result.recovery.items.length, 3);
assert.equal(successfulSearch.result.recovery.currency.amount, 150);
assert.equal(successfulSearch.state.carried.filter((entry) => entry.remaining > 0).length, 0);
assert.equal(successfulSearch.state.currency.remaining, 0);

for (const item of successfulSearch.result.recovery.items) {
  assert.equal(item.schemaVersion, inventory.schemaVersion);
  assert.equal(item.provenance.acquisitionMethod, "search");
  assert.equal(item.provenance.acquiredByActorId, "player_expert");
  assert.equal(item.provenance.corpseId, "corpse_postcombat_001");
}

const impossibleTarget = postCombat.performAction(state0, { ...expert, id: "player_targeter" }, "search", {
  rng: allHeads,
  targetItemId: "diamond_that_does_not_exist",
});
assert.equal(impossibleTarget.result.check.success, true);
assert.equal(impossibleTarget.result.recovery.items.length, 0);
assert.equal(impossibleTarget.result.recovery.currency, null);
assert.equal(impossibleTarget.state.carried.filter((entry) => entry.remaining > 0).length, 3, "high roll must not create a requested Item that was never in the locked source");

assert.equal(postCombat.resourceAction({ integrityFamily: "meat", sourceMaterial: "flesh" }, "mixed"), "harvest");
assert.equal(postCombat.resourceAction({ integrityFamily: "organ_internal", sourceMaterial: "flesh" }, "mixed"), "extract");
assert.equal(postCombat.resourceAction({ integrityFamily: "hard_cover_structural", sourceMaterial: "metal" }, "mixed"), "salvage");

const harvested = postCombat.performAction(successfulSearch.state, survivalist, "harvest", {
  rng: allHeads,
  targetResourceId: "meat",
});
assert.equal(harvested.result.check.success, true);
assert.equal(harvested.result.recovery.resources.length, 1);
assert.equal(harvested.result.recovery.resources[0].resourceId, "meat");
assert.equal(harvested.result.recovery.resources[0].quantity, 3);
assert.equal(harvested.state.harvest.resources.find((r) => r.resourceId === "meat").remaining, 0);
assert.equal(harvested.result.recovery.resources[0].provenance.acquisitionMethod, "harvest");

const extracted = postCombat.performAction(harvested.state, medic, "extract", {
  rng: allHeads,
  targetResourceId: "internal_organs",
});
assert.equal(extracted.result.check.success, true);
assert.equal(extracted.result.recovery.resources[0].quantity, 2);
assert.equal(extracted.state.harvest.resources.find((r) => r.resourceId === "internal_organs").remaining, 0);
assert.equal(extracted.result.recovery.resources[0].provenance.acquisitionMethod, "extract");

const salvaged = postCombat.performAction(extracted.state, salvager, "salvage", {
  rng: allHeads,
  targetResourceId: "metal_frame",
});
assert.equal(salvaged.result.check.success, true);
assert.equal(salvaged.result.recovery.resources[0].quantity, 2);
assert.equal(salvaged.state.harvest.resources.find((r) => r.resourceId === "metal_frame").remaining, 0);
assert.equal(salvaged.result.recovery.resources[0].provenance.acquisitionMethod, "salvage");

const secondSalvager = { ...salvager, id: "player_salvager_2" };
const noDuplicate = postCombat.performAction(salvaged.state, secondSalvager, "salvage", {
  rng: allHeads,
  targetResourceId: "metal_frame",
});
assert.equal(noDuplicate.result.check.success, true);
assert.equal(noDuplicate.result.recovery.resources.length, 0, "another player cannot independently extract an already depleted finite resource");
assert.equal(noDuplicate.state.harvest.resources.find((r) => r.resourceId === "metal_frame").remaining, 0);

const freshForCoin = postCombat.createInteractionState(locked);
let coinEngineCall = null;
const fakeCoinEngine = {
  async runAnimatedRoll(options) {
    coinEngineCall = { base: options.base, headsChance: options.headsChance, coinCount: options.coinCount };
    return {
      base: options.base,
      total: options.base + 20,
      heads: 5,
      coinCount: 5,
      headBonus: 4,
      headsChance: options.headsChance,
      coins: Array.from({ length: 5 }, (_, index) => ({ index, side: "head" })),
    };
  },
};

const animated = await postCombat.performActionWithCoinEngine(freshForCoin, expert, "search", {
  coinEngine: fakeCoinEngine,
  container: {},
});
assert.deepEqual(coinEngineCall, { base: 7, headsChance: 50, coinCount: 5 });
assert.equal(animated.result.check.engine, "luminous_coin_engine");
assert.equal(animated.result.check.total, 27);
assert.equal(animated.result.check.success, true);

console.log("Post-combat Loot interactions + D&D checks smoke passed.");
