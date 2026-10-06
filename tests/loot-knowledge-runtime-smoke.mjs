import assert from "node:assert/strict";

globalThis.window = globalThis;

await import("../js/item-inventory-runtime.js");
await import("../js/item-harvest-integrity-engine.js");
await import("../js/unit-loot-profile-contract.js");
await import("../js/loot-check-runtime.js");
await import("../js/corpse-harvest-runtime.js");
await import("../js/loot-instance-runtime.js");
await import("../js/loot-knowledge-runtime.js");
await import("../js/loot-postcombat-runtime.js");

const inventory = globalThis.LuminousItemInventoryRuntime;
const harvest = globalThis.LuminousItemHarvestIntegrityEngine;
const lootContract = globalThis.LuminousUnitLootProfileContract;
const lootInstances = globalThis.LuminousLootInstanceRuntime;
const knowledge = globalThis.LuminousLootKnowledgeRuntime;
const postCombat = globalThis.LuminousLootPostCombatRuntime;

assert.ok(inventory);
assert.ok(harvest);
assert.ok(lootContract);
assert.ok(knowledge);
assert.ok(postCombat);

const catalog = {
  ration: { id: "ration", name: "Ration", category: "food", stackable: true },
  shortbow: { id: "shortbow", name: "Shortbow", category: "weapon", itemType: "weapon" },
};

const profiles = lootContract.createProfiles({
  bodyProfile: {
    kind: "organic",
    sizeClass: "small",
    materials: ["flesh", "blood", "bone"],
    edible: false,
    resources: [
      { id: "flesh", integrityFamily: "meat", sourceMaterial: "flesh" },
      { id: "bones", integrityFamily: "hard_parts", sourceMaterial: "bone" },
      { id: "internal_organs", integrityFamily: "organ_internal", sourceMaterial: "flesh" },
      { id: "brain", integrityFamily: "organ_brain", sourceMaterial: "flesh" },
      { id: "blood", integrityFamily: "blood_ichor", sourceMaterial: "blood" },
    ],
  },
  lootProfile: {
    carried: [
      { itemId: "ration", category: "food", rarity: "common", chance: 1, quantity: 1 },
    ],
    equipment: { source: "unit_loadout" },
    currency: { currencyId: "ahn", min: 100, max: 100, zeroAllowed: true },
    harvest: { source: "body_profile" },
  },
}, { harvestEngine: harvest });

const unit = {
  id: "knowledge_test_goblin",
  combatId: "enemy:knowledge:001",
  species: "goblin",
  scores: { str: 8, dex: 15, con: 10, int: 10, wis: 9, cha: 8 },
  defensiveLevel: 4,
  bodyProfile: profiles.bodyProfile,
  lootProfile: profiles.lootProfile,
  mechanics: {
    weaponLoadout: [
      { weaponId: "shortbow", range: "ranged", ammoType: "arrows", skillId: "goblin_shortbow_shot" },
    ],
  },
};

const loot = lootInstances.generateLootInstance(unit, {
  encounterId: "encounter_knowledge",
  unitInstanceId: unit.combatId,
  corpseId: "corpse_knowledge_001",
  zone: {
    id: "forest_edge",
    profileId: "forest",
  },
  events: [
    { id: "war_event_01", eventType: "war" },
  ],
  carriedCandidates: [],
  catalog,
});
const locked = lootInstances.lockLootInstance(loot, { unit, now: 1000 });
let state = postCombat.createInteractionState(locked, { now: 1001 });

const searcher = {
  id: "player_searcher",
  stats: { inteligencia: 16 },
  proficiencyBonus: 2,
  skillProficiency: { investigation: "expertise" },
  sp: 0,
};
const medic = {
  id: "player_medic",
  stats: { sabiduria: 16 },
  proficiencyBonus: 2,
  skillProficiency: { medicine: "expertise" },
  sp: 0,
};
const investigator = {
  id: "player_investigator",
  stats: { inteligencia: 14 },
  proficiencyBonus: 2,
  skillProficiency: { investigation: "proficient" },
  sp: 0,
};

const allHeads = () => 0;

const searched = postCombat.performAction(state, searcher, "search", {
  rng: allHeads,
});
state = searched.state;
assert.equal(searched.result.check.success, true);
assert.ok(searched.result.recovery.items.some((item) => item.definitionId === "ration"));
assert.equal(searched.result.recovery.currency.amount, 100);

const local0 = knowledge.createCompendium("player_medic", { now: 1100 });
const autopsy = postCombat.performAction(state, medic, "autopsy", {
  rng: allHeads,
  unitTruth: unit,
  lootInstance: locked,
  compendium: local0,
  now: 1200,
});
assert.equal(autopsy.result.check.skill, "medicine");
assert.equal(autopsy.result.check.ability, "wis");
assert.equal(autopsy.result.check.success, true);
assert.ok(autopsy.result.knowledge.facts.some((fact) => fact.id === "biology.body_kind"));
assert.ok(autopsy.result.knowledge.facts.some((fact) => fact.id === "biology.materials"));
assert.ok(autopsy.result.knowledge.facts.some((fact) => fact.id === "biology.harvestable_resources"));
assert.ok(autopsy.result.knowledge.facts.some((fact) => fact.id === "stats.constitution_score"), "high-margin Medicine may reveal a selected physical stat");
assert.ok(!autopsy.result.knowledge.facts.some((fact) => fact.id === "stats.dexterity_score"));
assert.ok(!autopsy.result.knowledge.facts.some((fact) => fact.id === "stats.intelligence_score"));
assert.ok(!autopsy.result.knowledge.facts.some((fact) => fact.section === "combat"), "autopsy-only discovery must stay separate from combat observation");

const localMedicine = autopsy.result.knowledge.compendium;
assert.ok(localMedicine.units.knowledge_test_goblin);
assert.equal(localMedicine.units.knowledge_test_goblin.facts["biology.body_kind"].visibility, "private");
assert.equal(localMedicine.units.knowledge_test_goblin.facts["stats.constitution_score"].value, 10);
assert.equal(knowledge.validateCompendium(localMedicine).valid, true);

const investigationLocal0 = knowledge.createCompendium("player_investigator", { now: 1300 });
const examined = postCombat.performAction(state, investigator, "examine", {
  rng: allHeads,
  unitTruth: unit,
  lootInstance: locked,
  compendium: investigationLocal0,
  now: 1400,
});
assert.equal(examined.result.check.skill, "investigation");
assert.equal(examined.result.check.ability, "int");
assert.equal(examined.result.check.threshold, 10);
assert.ok(examined.result.knowledge.facts.some((fact) => fact.id === "loot.observed_equipment"));
assert.ok(examined.result.knowledge.facts.some((fact) => fact.id === "environment.encounter_zone"));
assert.ok(examined.result.knowledge.facts.some((fact) => fact.id === "environment.encounter_events"));
assert.ok(examined.result.knowledge.facts.some((fact) => fact.id === "loot.observed_carried_items"));
assert.ok(examined.result.knowledge.facts.some((fact) => fact.id === "loot.observed_currency"));
assert.ok(examined.result.knowledge.facts.some((fact) => fact.id === "loot.known_rarity_labels"));
assert.ok(!examined.result.knowledge.facts.some((fact) => fact.id === "stats.strength_score"));
assert.ok(!examined.result.knowledge.facts.some((fact) => fact.id === "stats.intelligence_score"));

const rarityFact = examined.result.knowledge.facts.find((fact) => fact.id === "loot.known_rarity_labels");
assert.deepEqual(rarityFact.value, [{ itemId: "ration", rarity: "common", label: "Common" }]);
assert.equal(JSON.stringify(rarityFact.value).includes("0.6"), false, "player compendium must expose labels, not exact internal percentages");

const observedEquipment = examined.result.knowledge.facts.find((fact) => fact.id === "loot.observed_equipment");
assert.equal(observedEquipment.value[0].weaponId, "shortbow");
assert.equal(observedEquipment.value[0].ammoType, "arrows");

const observedCurrency = examined.result.knowledge.facts.find((fact) => fact.id === "loot.observed_currency");
assert.deepEqual(observedCurrency.value, { currencyId: "ahn", observedAmount: 100 });

const combatFacts = knowledge.combatObservationFacts({
  sourceUnitId: unit.id,
  encounterId: "encounter_knowledge",
  observationId: "obs_01",
  speed: { min: 3, max: 5 },
  usedSkills: ["goblin_shortbow_shot"],
  visibleTraits: ["nimble_escape"],
  defenseInteractions: [
    { damageType: "piercing", observedResult: "resisted" },
  ],
}, unit.id, {
  discoveredBy: "player_scout",
  discoveredAt: 1450,
});
assert.ok(combatFacts.some((fact) => fact.id === "combat.observed_speed"));
assert.ok(combatFacts.some((fact) => fact.id === "combat.observed_skills"));
assert.ok(combatFacts.some((fact) => fact.id === "combat.visible_traits"));
assert.ok(combatFacts.some((fact) => fact.id === "combat.observed_defense_interactions"));
assert.ok(!combatFacts.some((fact) => fact.section === "stats"));

let scoutCompendium = knowledge.createCompendium("player_scout");
scoutCompendium = knowledge.mergeFacts(scoutCompendium, unit.id, combatFacts, { now: 1450 });
assert.ok(scoutCompendium.units.knowledge_test_goblin.facts["combat.observed_speed"]);
assert.equal(scoutCompendium.units.knowledge_test_goblin.facts["combat.observed_speed"].visibility, "private");

let withNote = knowledge.addNote(localMedicine, unit.id, {
  authorId: "player_medic",
  text: "Órganos dañados por cortes; evitar contaminar la sangre.",
  visibility: "private",
}, { now: 1500 });
withNote = knowledge.addNote(withNote, unit.id, {
  authorId: "player_scout",
  text: "Usó arco durante el encuentro.",
  visibility: "private",
}, { now: 1510 });
assert.equal(withNote.units.knowledge_test_goblin.notes.length, 2);
assert.deepEqual(
  withNote.units.knowledge_test_goblin.notes.map((note) => note.authorId),
  ["player_medic", "player_scout"],
  "notes must preserve author attribution instead of becoming one anonymous blob",
);

let shared = knowledge.createCompendium("party_shared", { now: 1600 });
shared = knowledge.shareFacts(withNote, shared, unit.id, ["biology.body_kind", "stats.constitution_score"], {
  sharedBy: "player_medic",
  now: 1601,
});
assert.ok(shared.units.knowledge_test_goblin.facts["biology.body_kind"]);
assert.ok(shared.units.knowledge_test_goblin.facts["stats.constitution_score"]);
assert.equal(shared.units.knowledge_test_goblin.facts["biology.body_kind"].visibility, "shared");
assert.equal(shared.units.knowledge_test_goblin.facts["biology.materials"], undefined, "sharing selected facts must not leak unshared Unit truth");

shared = knowledge.shareNotes(withNote, shared, unit.id, [withNote.units.knowledge_test_goblin.notes[0].id], { now: 1602 });
assert.equal(shared.units.knowledge_test_goblin.notes.length, 1);
assert.equal(shared.units.knowledge_test_goblin.notes[0].authorId, "player_medic");

let recipient = knowledge.createCompendium("player_recipient", { now: 1700 });
recipient = knowledge.transferFacts(withNote, recipient, unit.id, ["biology.materials"], {
  transferredBy: "player_medic",
  now: 1701,
});
assert.ok(recipient.units.knowledge_test_goblin.facts["biology.materials"]);
assert.equal(recipient.units.knowledge_test_goblin.facts["biology.materials"].visibility, "direct");
assert.equal(recipient.units.knowledge_test_goblin.facts["stats.constitution_score"], undefined, "direct transfer must include only selected known facts");

const writes = [];
const fakeDb = {
  ref(path) {
    return {
      async set(value) {
        writes.push({ path, value });
      },
    };
  },
};
const localSave = await knowledge.persistLocal(withNote, { database: fakeDb });
assert.equal(localSave.path, "campaña/jugadores/player_medic/compendium");
const sharedSave = await knowledge.persistShared(shared, "player_medic", { database: fakeDb });
assert.equal(sharedSave.path, "campaña/compendium_shared");
assert.equal(writes.length, 2);
assert.equal(writes[0].value.playerId, "player_medic");
assert.equal(writes[1].value.playerId, "party_shared");

assert.throws(
  () => postCombat.performAction(state, medic, "autopsy", {
    rng: allHeads,
    unitTruth: { ...unit, id: "wrong_unit" },
    lootInstance: locked,
  }),
  /POST_COMBAT_UNIT_TRUTH_MISMATCH/,
  "Autopsy cannot be pointed at a different canonical Unit truth source",
);

console.log("Autopsy / Examine + Compendium knowledge smoke passed.");
