import assert from "node:assert/strict";

globalThis.window = globalThis;

await import("../js/loot-encounter-context.js");

const runtime = globalThis.LuminousLootEncounterContext;
assert.ok(runtime);

for (const profileId of [
  "forest", "mine", "industrial", "hospital", "laboratory",
  "ruins", "poor_district", "rich_district",
]) {
  assert.ok(runtime.ZONE_PROFILES[profileId], `missing zone profile ${profileId}`);
}

for (const eventType of [
  "convoy", "robbery", "famine", "war", "evacuation", "plague",
  "medical_shipment", "mining_expedition", "smuggling_operation",
  "laboratory_escape", "treasure_expedition", "black_market_deal",
]) {
  assert.ok(runtime.EVENT_PROFILES[eventType], `missing event profile ${eventType}`);
}

const forestNode = {
  key: "district_12:3,7",
  jurisdiction: "backstreets",
  terrain: "forest",
  settlementId: "",
  metadata: {},
};
const forest = runtime.deriveZoneFromWorldNode(forestNode);
assert.equal(forest.profileId, "forest");
assert.ok(forest.tags.includes("forest"));
assert.ok(forest.tags.includes("backstreets"));
assert.equal(forest.regional.key, forestNode.key);
assert.ok(forest.weights.biomaterials > 1);
assert.ok(forest.weights.technology < 1);

const hospitalNode = {
  key: "district_4:1,1",
  jurisdiction: "nest",
  terrain: "plains",
  settlementId: "nest_clinic_04",
  metadata: {
    lootZone: {
      profileId: "hospital",
      tags: ["clinic"],
      weights: { medicine: 1.25 },
    },
  },
};
const hospital = runtime.deriveZoneFromWorldNode(hospitalNode);
assert.equal(hospital.profileId, "hospital");
assert.ok(hospital.tags.includes("clinic"));
assert.ok(hospital.tags.includes("settlement"));
assert.ok(hospital.weights.medicine > runtime.ZONE_PROFILES.hospital.weights.medicine);

const sealedForest = runtime.normalizeZoneProfile({
  id: "forest_vaultless",
  profileId: "forest",
  impossibleCategories: ["gems", "luxury", "technology"],
  source: "encounter",
});
let context = runtime.resolveEncounterContext({ zone: sealedForest });
assert.equal(runtime.categoryState(context, "gems").state, "impossible");
assert.equal(runtime.categoryState(context, "gem").state, "impossible");
assert.equal(runtime.categoryState(context, "technology").state, "impossible");

const treasure = runtime.normalizeEventProfile({
  id: "robbed_jewelry_convoy",
  eventType: "treasure_expedition",
});
context = runtime.resolveEncounterContext({
  zone: sealedForest,
  events: [treasure],
});
assert.equal(runtime.categoryState(context, "gems").state, "allowed_by_exception");
assert.ok(runtime.categoryState(context, "gems").weight > 1);
assert.equal(runtime.categoryState(context, "technology").state, "impossible", "event may unlock only its authored categories");
assert.deepEqual(context.provenance.eventIds, ["robbed_jewelry_convoy"]);
assert.deepEqual(context.provenance.eventTypes, ["treasure_expedition"]);
assert.equal(context.provenance.zoneId, "forest_vaultless");

const medicalShipment = runtime.normalizeEventProfile({
  id: "shipment_77",
  eventType: "medical_shipment",
  guaranteedItems: [
    { itemId: "authored_medical_crate", quantity: 1, tags: ["sealed"] },
  ],
  quantityMultiplier: 1.4,
  qualityMultiplier: 1.1,
});
const medicalContext = runtime.resolveEncounterContext({
  zone: runtime.normalizeZoneProfile({ id: "hospital_2", profileId: "hospital" }),
  events: [medicalShipment],
});
assert.equal(medicalContext.guaranteedItems.length, 1);
assert.equal(medicalContext.guaranteedItems[0].itemId, "authored_medical_crate");
assert.equal(medicalContext.guaranteedItems[0].provenance.eventId, "shipment_77");
assert.ok(medicalContext.quantityMultiplier > 1);
assert.ok(medicalContext.qualityMultiplier > 1);
assert.ok(medicalContext.weights.medicine > runtime.ZONE_PROFILES.hospital.weights.medicine);

const warFamine = runtime.resolveEncounterContext({
  zone: runtime.normalizeZoneProfile({ id: "poor_block", profileId: "poor_district" }),
  events: [
    { id: "war_01", eventType: "war" },
    { id: "famine_01", eventType: "famine" },
  ],
});
assert.ok(warFamine.weights.ammunition > 1);
assert.ok(warFamine.weights.food < 1);
assert.ok(warFamine.quantityMultiplier < 1);
assert.ok(warFamine.qualityMultiplier < 1);

const customZone = runtime.normalizeZoneProfile({
  id: "wing_factory",
  allowCustom: true,
  tags: ["industrial", "restricted"],
  weights: { industrial_material: 2.2, technology: 1.4 },
  impossibleCategories: ["gems"],
});
assert.equal(customZone.weights.industrial_materials, 2.2);
assert.ok(customZone.impossibleCategories.includes("gems"));

const customEvent = runtime.normalizeEventProfile({
  id: "artifact_transfer",
  allowCustom: true,
  tags: ["transfer"],
  weights: { valuables: 1.8 },
  allowCategories: ["gems"],
  guaranteedItems: [{ itemId: "authored_case", min: 1, max: 1 }],
});
assert.equal(runtime.validateEventProfile(customEvent).valid, true);
const customContext = runtime.resolveEncounterContext({
  zone: customZone,
  events: [customEvent],
});
assert.equal(runtime.categoryState(customContext, "gems").state, "allowed_by_exception");
assert.equal(customContext.guaranteedItems[0].provenance.eventId, "artifact_transfer");

const blockedByEvent = runtime.resolveEncounterContext({
  zone: runtime.normalizeZoneProfile({ id: "mine_1", profileId: "mine" }),
  events: [{ id: "collapse", allowCustom: true, blockCategories: ["gems"], tags: ["collapse"] }],
});
assert.equal(runtime.categoryState(blockedByEvent, "gems").state, "impossible");

assert.equal(
  runtime.validateEventProfile({ eventType: "totally_fake_event" }).valid,
  false,
);
assert.equal(
  runtime.validateZoneProfile({ profileId: "totally_fake_zone" }).valid,
  false,
);

console.log("Encounter Zone + Event loot context smoke passed.");
