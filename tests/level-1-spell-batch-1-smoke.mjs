import assert from "node:assert/strict";

globalThis.STATUS_REGISTRY = {};
delete globalThis.__LuminousContentRegistryRegisteredSources;

await import("../js/content-registry.js");
await import("../js/content-registry-bootstrap.js");
await import("../js/spell-catalog-core.js");
await import("../js/spell-batch-level1-runtime.js");
await import("../js/core-condition-runtime.js");
await import("../js/environment-engine.js");
await import("../js/combat-spell-loadout-074.js");
await import("../js/combat-action-schema.js");
await import("../js/combat-action-adapters.js");

const catalog = globalThis.LuminousSpellCatalog;
const batch = globalThis.LuminousLevel1SpellBatchRuntime;
const loadout = globalThis.LuminousCombatSpellLoadout074;
const adapters = globalThis.LuminousCombatActionAdapters;
const environment = globalThis.LuminousEnvironmentEngine;
const conditions = globalThis.LuminousConditionRuntime;

assert.ok(catalog && batch && loadout && adapters && environment && conditions, "Level 1 spell runtime dependencies should load");

const schools = new Set(["abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation"]);
for (const spell of Object.values(catalog).filter((entry) => Number(entry?.level ?? entry?.spellLevel ?? -1) <= 1)) {
  assert.ok(Array.isArray(spell.classIds) && spell.classIds.length > 0, `${spell.id} must declare classIds`);
  assert.ok(schools.has(spell.school), `${spell.id} must declare a canonical school`);
  assert.ok(Array.isArray(spell.contexts) && spell.contexts.length > 0, `${spell.id} must declare contexts`);
}

const batchIds = [
  "alarm", "armor_of_agathys", "arms_of_hadar", "bane", "bless", "burning_hands",
  "detect_evil_and_good", "detect_magic", "detect_poison_and_disease", "disguise_self",
  "divine_favor", "divine_smite", "ensnaring_strike", "entangle"
];
for (const id of batchIds) {
  const spell = catalog[id];
  assert.ok(spell, `missing Level 1 spell ${id}`);
  assert.equal(spell.level, 1, `${id} must be Level 1`);
  assert.equal(spell.cantrip, false, `${id} must not be a cantrip`);
  assert.ok(Array.isArray(spell.classIds) && spell.classIds.length > 0, `${id} needs classIds`);
  assert.ok(spell.school, `${id} needs a school`);
  assert.ok(Array.isArray(spell.contexts) && spell.contexts.length > 0, `${id} needs contexts`);
}

assert.deepEqual(catalog.alarm.classIds, ["artificer", "ranger", "wizard"]);
assert.equal(catalog.alarm.school, "abjuration");
assert.equal(catalog.alarm.ritual, true);
assert.equal(catalog.armor_of_agathys.school, "abjuration");
assert.equal(catalog.armor_of_agathys.castingTime, "quick_action");
assert.deepEqual(catalog.arms_of_hadar.classIds, ["warlock"]);
assert.equal(catalog.arms_of_hadar.save.abilityId, "str");
assert.deepEqual(catalog.bane.classIds, ["bard", "cleric", "warlock"]);
assert.equal(catalog.bane.concentration, true);
assert.deepEqual(catalog.bless.classIds, ["cleric", "paladin"]);
assert.equal(catalog.bless.concentration, true);
assert.equal(catalog.burning_hands.school, "evocation");
assert.equal(catalog.burning_hands.save.abilityId, "dex");

// Create or Destroy Water closes the reviewed weather/environment contract.
assert.ok(catalog.create_or_destroy_water);
assert.deepEqual(catalog.create_or_destroy_water.classIds, ["cleric", "druid"]);
assert.equal(catalog.create_or_destroy_water.school, "transmutation");
assert.deepEqual(catalog.create_or_destroy_water.contexts, ["combat", "theater"]);
assert.equal(catalog.create_or_destroy_water.resolutionType, "automatic");
assert.equal(catalog.create_or_destroy_water.mechanics.combat.rain.encounterModifierId, "rain");
assert.deepEqual(
  catalog.create_or_destroy_water.mechanics.combat.destroyFog.suppressEncounterModifiers,
  { light_fog: 5, heavy_fog: 2 }
);

assert.equal(environment.EFFECTS.rain.encounterModifierId, "rain");
assert.equal(environment.EFFECTS.rain.mechanics.electricDamageTakenMultiplier, 1.10);
assert.equal(environment.EFFECTS.storm.encounterModifierId, "thunderstorm");
assert.equal(environment.EFFECTS.storm.mechanics.lightningStrikeChance, 0.15);
assert.equal(environment.EFFECTS.storm.mechanics.lightningFixedDamage, 30);
assert.equal(environment.EFFECTS.storm.mechanics.lightningShockPotency, 5);
assert.equal(environment.EFFECTS.storm.mechanics.lightningShockCount, 5);
assert.equal(environment.EFFECTS.storm.mechanics.conductiveMetalAdditionalFixedDamage, 10);
assert.equal(environment.EFFECTS.storm.mechanics.conductiveMetalAdditionalShock, 3);
assert.equal(environment.EFFECTS.storm.mechanics.spearAdditionalStrikeChance, 0.10);
assert.equal(environment.EFFECTS.fog.encounterModifierId, "light_fog");
assert.equal(environment.EFFECTS.fog.mechanics.clashPowerModifier, -1);
assert.equal(environment.EFFECTS.dense_fog.encounterModifierId, "heavy_fog");
assert.equal(environment.EFFECTS.dense_fog.mechanics.clashPowerModifier, -3);

const thunderstormEnv = environment.resolveEnvironment({ weatherId: "tormenta" });
const stormEffect = thunderstormEnv.effects.find((entry) => entry.id === "storm");
assert.equal(stormEffect.encounterModifierId, "thunderstorm");
assert.equal(stormEffect.mechanics.lightningFixedDamage, 30);

// Cure Wounds uses the approved Limbus healing formula.
assert.ok(catalog.cure_wounds);
assert.deepEqual(catalog.cure_wounds.classIds, ["bard", "cleric", "druid", "paladin", "ranger"]);
assert.equal(catalog.cure_wounds.school, "abjuration");
assert.deepEqual(catalog.cure_wounds.contexts, ["combat"]);
assert.equal(catalog.cure_wounds.resolutionType, "automatic");
assert.equal(catalog.cure_wounds.mechanics.healing.flatPerSpellSlotUsed, 2);
assert.deepEqual(catalog.cure_wounds.mechanics.healing.maxHpPercent, { minimum: 2, perSpellMod: 2 });

const cureTarget = { id: "cure_target", hp: 40, maxHp: 100 };
const cureLevel1 = batch.applyCureWounds(cureTarget, 1, 3);
assert.equal(cureLevel1.flat, 2);
assert.equal(cureLevel1.maxHpPercent, 6);
assert.equal(cureLevel1.healed, 8);
assert.equal(cureTarget.hp, 48);

const cureMinimum = batch.calculateCureWoundsHealing(1, 0, 100);
assert.equal(cureMinimum.flat, 2);
assert.equal(cureMinimum.maxHpPercent, 2);
assert.equal(cureMinimum.total, 4);

const cureUpcast = batch.calculateCureWoundsHealing(3, 4, 100);
assert.equal(cureUpcast.flat, 6);
assert.equal(cureUpcast.maxHpPercent, 8);
assert.equal(cureUpcast.total, 14);

const cureAction = adapters.compileSpellToCombatAction(
  { id: "cleric" },
  catalog.cure_wounds,
  { classId: "cleric", slotLevel: 3, targetId: "ally" }
);
assert.equal(cureAction.resolution.type, "automatic");
assert.equal(cureAction.resources[0].type, "spell_slot");
assert.equal(cureAction.resources[0].metadata.slotLevel, 3);
assert.equal(cureAction.effects[0].type, "level1_cure_wounds");

// Reviewed detection / utility / Paladin-Ranger control batch.
assert.deepEqual(catalog.detect_evil_and_good.classIds, ["cleric", "paladin"]);
assert.deepEqual(catalog.detect_evil_and_good.contexts, ["combat", "theater"]);
assert.equal(catalog.detect_evil_and_good.concentration, true);
assert.equal(catalog.detect_evil_and_good.description.toLowerCase().includes("dm"), false);

assert.equal(catalog.detect_magic.ritual, true);
assert.equal(catalog.detect_magic.mechanics.detectionRequest.type, "magic_sources");
assert.deepEqual(catalog.detect_magic.mechanics.detectionRequest.sources, ["nearby_magical_effect", "objects", "creatures", "phenomena"]);
assert.equal(catalog.detect_magic.description.toLowerCase().includes("dm"), false);

assert.equal(catalog.detect_poison_and_disease.ritual, true);
assert.equal(catalog.detect_poison_and_disease.mechanics.detectionRequest.includeLocation, true);
assert.equal(catalog.detect_poison_and_disease.description.toLowerCase().includes("dm"), false);

const detectionCaster = { id: "detect_caster", name: "Caster" };
const evilRequest = batch.buildDetectionRequest(detectionCaster, "detect_evil_and_good", { id: "detect_test", casterUid: "uid_test" });
assert.equal(evilRequest.resolved, true);
assert.deepEqual(evilRequest.request.schema.choices, ["aberration", "celestial", "elemental", "fey", "fiend", "undead", "hallow"]);
assert.equal(batch.detectionPlayerMessage(evilRequest.request, { selected: ["fiend", "undead"] }), "Detected: fiend, undead.");

const magicRequest = batch.buildDetectionRequest(detectionCaster, "detect_magic", { id: "magic_test" });
assert.equal(magicRequest.request.schema.type, "magic_sources");
assert.equal(
  batch.detectionPlayerMessage(magicRequest.request, { sources: [{ source: "objects", detected: true, school: "evocation" }] }),
  "objects: evocation"
);

const poisonRequest = batch.buildDetectionRequest(detectionCaster, "detect_poison_and_disease", { id: "poison_test" });
assert.equal(poisonRequest.request.schema.type, "presence_details");
assert.ok(batch.detectionPlayerMessage(poisonRequest.request, {
  presences: [{ presence: "poison", detected: true, type: "ingested", location: "cup" }]
}).includes("cup"));

const disguiseUnit = { id: "disguise_unit", statusEffects: {} };
const disguise = batch.applyDisguiseSelf(disguiseUnit, { now: Date.now() });
assert.equal(disguise.deceptionFinalPowerBonus, 4);
const disguiseCheck = conditions.applyCheckThreshold(disguiseUnit, { kind: "skill", abilityId: "cha", skillId: "deception", threshold: 12 });
assert.equal(disguiseCheck.finalPowerModifier, 4);

assert.equal(catalog.divine_favor.castingTime, "quick_action");
assert.equal(catalog.divine_favor.mechanics.onWeaponHit.oncePerSkill, true);
assert.equal(batch.divineFavorFixedDamage({ statusEffects: {} }), 1);
assert.equal(batch.divineFavorFixedDamage({ statusEffects: { radiance: { id: "radiance", count: 1 } } }), 2);

assert.equal(catalog.divine_smite.castingTime, "quick_action");
assert.deepEqual(batch.divineSmiteFixedDamage(1, { creatureType: "humanoid" }), {
  slotLevel: 1, base: 8, multiplier: 1, total: 8, creatureType: "humanoid"
});
assert.equal(batch.divineSmiteFixedDamage(1, { creatureType: "fiend" }).total, 12);
assert.equal(batch.divineSmiteFixedDamage(3, { creatureType: "undead" }).total, 24);

const restrainedTarget = { id: "restrained_target", statusEffects: {} };
batch.applySpellRestrained(restrainedTarget, {
  sourceSpellId: "ensnaring_strike", sourceUnitId: "ranger", spellDC: 17, slotLevel: 3
});
assert.equal(restrainedTarget.statusEffects.restrained.data.turnStartFixedDamage, 6);
const ensnaringLiberate = conditions.buildLiberateRequest(restrainedTarget, restrainedTarget, "sleight_of_hand", { inCombat: true });
assert.equal(ensnaringLiberate.check.kind, "ability");
assert.equal(ensnaringLiberate.check.abilityId, "str");
assert.equal(ensnaringLiberate.threshold, 17);
assert.equal(ensnaringLiberate.economy, "action");

assert.equal(catalog.entangle.attackWeight, 4);
assert.equal(catalog.entangle.save.abilityId, "str");
const entangleCaster = { id: "druid", statusEffects: {} };
const entangleArea = batch.createEntangleArea(entangleCaster, [{ id: "enemy_a" }, { id: "enemy_b" }]);
assert.equal(entangleArea.area.difficultTerrain, true);
assert.equal(entangleArea.area.attackWeight, 4);
assert.deepEqual(entangleArea.area.targetIds, ["enemy_a", "enemy_b"]);

assert.equal(catalog.chromatic_orb.mechanics.requiresChoice.key, "element");
assert.deepEqual(catalog.chromatic_orb.mechanics.requiresChoice.values, ["acid", "cold", "fire", "lightning", "poison", "thunder"]);
assert.equal(catalog.chromatic_orb.mechanics.onCritJump.maxJumpsFromSlotLevel, true);
assert.equal(batch.chromaticJumpLimit({ slotLevel: 4 }), 4);
const jumpTarget = batch.nextChromaticOrbTarget(
  { id: "caster", faction: "ally" },
  { id: "enemy_a", faction: "enemy", hp: 10 },
  { __luminousChromaticVisitedIds: ["enemy_a"] },
  { units: [
    { id: "caster", faction: "ally", hp: 10 },
    { id: "enemy_a", faction: "enemy", hp: 10 },
    { id: "enemy_b", faction: "enemy", hp: 10 }
  ] }
);
assert.equal(jumpTarget.id, "enemy_b");

// Current-rule cleanup for the 9 definitions that existed before this batch.
assert.deepEqual(catalog.animal_friendship.classIds, ["bard", "druid", "ranger"]);
assert.equal("intelligenceMaxExclusive" in catalog.animal_friendship.mechanics.targetRequirement, false);
assert.equal(catalog.charm_person.mechanics.targetRequirement.creatureType, "humanoid");
assert.equal(catalog.charm_person.mechanics.saveAdvantageWhenFightingCasterOrAllies, true);
assert.deepEqual(catalog.dissonant_whispers.classIds, ["bard"]);

// Metadata debt from the pre-Level-1 pass must not punch holes in School filtering.
for (const [id, school] of Object.entries({
  fire_bolt: "evocation",
  poison_spray: "necromancy",
  charm_person: "enchantment",
  chromatic_orb: "evocation",
  expeditious_retreat: "transmutation",
})) {
  assert.equal(catalog[id].school, school, `${id} school metadata`);
  assert.ok(catalog[id].contexts?.length, `${id} contexts metadata`);
}

// Catalog filtering is shared: Player surfaces can filter owned spells by School;
// DM/catalog surfaces can query the whole catalog by Class.
const wizardLevel1 = loadout.listSpellDefinitions({ classId: "wizard", level: 1 }).map((spell) => spell.id);
assert.ok(wizardLevel1.includes("alarm"));
assert.ok(wizardLevel1.includes("burning_hands"));
assert.ok(!wizardLevel1.includes("bane"));

const evocationLevel1 = loadout.listSpellDefinitions({ school: "evocation", level: 1 }).map((spell) => spell.id);
assert.ok(evocationLevel1.includes("burning_hands"));
assert.ok(evocationLevel1.includes("chromatic_orb"));
assert.ok(!evocationLevel1.includes("bane"));

// The canonical resource compiler still owns Spell Slot spending.
const blessAction = adapters.compileSpellToCombatAction(
  { id: "cleric" },
  catalog.bless,
  { classId: "cleric", slotLevel: 1, targetIds: ["ally_a", "ally_b"] }
);
assert.equal(blessAction.resolution.type, "automatic");
assert.equal(blessAction.resources.length, 1);
assert.equal(blessAction.resources[0].type, "spell_slot");
assert.equal(blessAction.resources[0].id, "cleric");
assert.equal(blessAction.resources[0].metadata.slotLevel, 1);

const caster = { id: "caster", shield: 0, statusEffects: {} };
const enemy = { id: "enemy", hp: 50, shield: 0, statusEffects: {} };
const ally = { id: "ally", statusEffects: {} };

const bane = batch.applyBane(enemy, "caster");
assert.equal(bane.count, 10);
assert.equal(bane.potency, 1);
assert.equal(batch.STATUS_DEFINITIONS.bane.rules[0].cond_type, "potency");
assert.equal(batch.STATUS_DEFINITIONS.bane.rules[0].aff_input, 2);

const bless = batch.applyBless(ally, "caster");
assert.equal(bless.count, 10);
assert.equal(bless.potency, 1);
assert.equal(batch.STATUS_DEFINITIONS.bless.rules[0].cond_type, "potency");
assert.equal(batch.STATUS_DEFINITIONS.bless.rules[0].aff_input, 2);

batch.suppressReaction(enemy);
assert.equal(enemy.statusEffects.reaction_suppressed.count, 1);
assert.equal(enemy.statusEffects.reaction_suppressed.duration, "next_turn_end");

const armor = batch.grantArmorOfAgathys(caster, 2);
assert.equal(armor.shieldGranted, 10);
assert.equal(armor.retaliationDamage, 10);
assert.equal(caster.shield, 10);
assert.equal(batch.armorOfAgathysState(caster).slotLevel, 2);

const alarm = batch.createAlarmWard(caster, { mode: "mental", areaId: "north_gate", excludedUnitIds: ["friend"] });
assert.equal(alarm.resolved, true);
assert.equal(alarm.ward.mode, "mental");
assert.equal(alarm.ward.durationHours, 8);
assert.equal(alarm.ward.areaId, "north_gate");

console.log("Level 1 spell batch 1 smoke: OK");
