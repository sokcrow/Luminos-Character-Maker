import assert from "node:assert/strict";

globalThis.STATUS_REGISTRY = {};
delete globalThis.__LuminousContentRegistryRegisteredSources;

await import("../js/content-registry.js");
await import("../js/content-registry-bootstrap.js");
await import("../js/spell-catalog-core.js");
await import("../js/spell-batch-level1-runtime.js");
await import("../js/combat-props-runtime.js");
await import("../js/core-condition-runtime.js");
await import("../js/environment-engine.js");
await import("../js/combat-spell-loadout-074.js");
await import("../js/combat-action-schema.js");
await import("../js/combat-action-adapters.js");
await import("../js/battle-viewer-spell-adapter-074.js");

const catalog = globalThis.LuminousSpellCatalog;
const batch = globalThis.LuminousLevel1SpellBatchRuntime;
const loadout = globalThis.LuminousCombatSpellLoadout074;
const adapters = globalThis.LuminousCombatActionAdapters;
const environment = globalThis.LuminousEnvironmentEngine;
const conditions = globalThis.LuminousConditionRuntime;
const spellAdapter = globalThis.LuminousBattleViewerSpellAdapter074;
const propsRuntime = globalThis.LuminousCombatPropsRuntime;

assert.ok(catalog && batch && loadout && adapters && environment && conditions && spellAdapter && propsRuntime, "Level 1 spell runtime dependencies should load");

const schools = new Set(["abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation"]);
for (const spell of Object.values(catalog).filter((entry) => Number(entry?.level ?? entry?.spellLevel ?? -1) <= 1)) {
  assert.ok(Array.isArray(spell.classIds) && spell.classIds.length > 0, `${spell.id} must declare classIds`);
  assert.ok(schools.has(spell.school), `${spell.id} must declare a canonical school`);
  assert.ok(Array.isArray(spell.contexts) && spell.contexts.length > 0, `${spell.id} must declare contexts`);
}

const batchIds = [
  "alarm", "armor_of_agathys", "arms_of_hadar", "bane", "bless", "burning_hands", "catapult",
  "detect_evil_and_good", "detect_magic", "detect_poison_and_disease", "disguise_self", "find_familiar",
  "divine_favor", "divine_smite", "ensnaring_strike", "entangle",
  "fog_cloud", "goodberry", "grease", "guiding_bolt", "hail_of_thorns", "healing_word",
  "hellish_rebuke", "heroism", "hex", "hunters_mark", "ice_knife"
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
assert.equal(catalog.arms_of_hadar.coinType, "unbreakable");
assert.equal(catalog.arms_of_hadar.isUnclashable, false);
assert.equal(catalog.arms_of_hadar.save, undefined);
assert.equal(catalog.arms_of_hadar.mechanics.suppressReactionOnHit, true);
assert.deepEqual(catalog.bane.classIds, ["bard", "cleric", "warlock"]);
assert.equal(catalog.bane.concentration, true);
assert.deepEqual(catalog.bless.classIds, ["cleric", "paladin"]);
assert.equal(catalog.bless.concentration, true);
assert.equal(catalog.burning_hands.school, "evocation");
assert.equal(catalog.burning_hands.coinType, "unbreakable");
assert.equal(catalog.burning_hands.isUnclashable, false);
assert.equal(catalog.burning_hands.save, undefined);
assert.equal(catalog.burning_hands.mechanics.onHitStatus.potencyPerSlotLevel, 2);
assert.ok(catalog.catapult);
assert.deepEqual(catalog.catapult.classIds, ["artificer", "sorcerer", "wizard"]);
assert.equal(catalog.catapult.basePower, 6);
assert.equal(catalog.catapult.coinPower, 8);
assert.equal(catalog.catapult.mechanics.combatProp.required, true);

const chairProp = { id: "chair_prop", name: "Chair", weight: 4, hiddenHP: 3, throwable: true };
propsRuntime.registerEncounterProps([chairProp]);
const burningSlot3 = spellAdapter.materializeSpell({ id: "wizard", level: 5 }, "wizard", catalog.burning_hands, 3, {});
assert.equal(burningSlot3.ok, true);
assert.equal(burningSlot3.definition.coinPower, 9);
const burningEffect = burningSlot3.definition.effects.find((effect) => effect.status === "burn");
assert.equal(burningEffect.potency, 6);

const catapultSlot1 = spellAdapter.materializeSpell(
  { id: "wizard", level: 1 },
  "wizard",
  catalog.catapult,
  1,
  { combatPropId: "chair_prop" }
);
assert.equal(catapultSlot1.ok, true);
assert.equal(catapultSlot1.definition.selectedPropId, "chair_prop");
assert.deepEqual(catapultSlot1.definition.__luminousPropUse, { propId: "chair_prop", wear: 1, cause: "catapult" });
assert.equal(spellAdapter.materializeSpell({ id: "wizard" }, "wizard", catalog.catapult, 1, {}).reason, "combat_prop_required");

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

const enchantedSmiteSkill = {
  id: "smite_slash",
  skillRange: 1,
  __luminousSlotEnchantments: [{
    id: "divine_smite",
    slotLevel: 2,
    targetDrawId: "draw_divine_smite",
    finalPowerIfTargetHasRadiance: 1,
    radiance: 2
  }]
};
assert.equal(batch.divineSmiteEnchantment(enchantedSmiteSkill).slotLevel, 2);
assert.equal(batch.divineSmiteEnchantmentKey(enchantedSmiteSkill, batch.divineSmiteEnchantment(enchantedSmiteSkill)), "draw_divine_smite");
const smiteAttacker = { id: "smiter", statusEffects: {} };
const smiteTarget = { id: "smite_target", hp: 100, statusEffects: { radiance: { id: "radiance", count: 1 } }, creatureType: "humanoid" };
assert.equal(batch.divineSmitePowerBonus(smiteAttacker, smiteTarget, enchantedSmiteSkill), 1);
const smiteResolved = batch.resolveDivineSmiteHit(smiteAttacker, smiteTarget, enchantedSmiteSkill, {});
assert.equal(smiteResolved.resolved, true);
assert.equal(smiteResolved.total, 12);
assert.equal(batch.resolveDivineSmiteHit(smiteAttacker, smiteTarget, enchantedSmiteSkill, {}), null, "same enchanted Hand card must Smite only once");

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

assert.ok(catalog.find_familiar);
assert.deepEqual(catalog.find_familiar.classIds, ["wizard"]);
assert.equal(catalog.find_familiar.school, "conjuration");
assert.deepEqual(catalog.find_familiar.contexts, ["theater"]);
assert.equal(catalog.find_familiar.ritual, true);
assert.equal(catalog.find_familiar.mechanics.unitLibraryChoice.chooseVariantWhenAvailable, true);
assert.deepEqual(catalog.find_familiar.mechanics.requiresChoice.values, ["celestial", "fey", "fiend"]);

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
assert.equal(armor.shieldGranted, 20);
assert.equal(armor.retaliationDamage, 6);
assert.equal(armor.chill, 1);
assert.equal(caster.shield, 20);
assert.equal(batch.armorOfAgathysState(caster).slotLevel, 2);

const meleeEnemy = { id: "melee_enemy", hp: 50, shield: 0, statusEffects: {} };
const retaliationEngine = {
  applyDamage(unit, amount) { unit.hp -= amount; return { hp: unit.hp, shield: unit.shield || 0 }; }
};
const retaliation = batch.retaliateArmorOfAgathys(
  retaliationEngine,
  meleeEnemy,
  caster,
  { id: "melee_skill", skillRange: 1 },
  { attackLogs: [{}] },
  { state: batch.armorOfAgathysState(caster), shieldBefore: 20 }
);
assert.equal(retaliation.damage, 6);
assert.equal(meleeEnemy.hp, 44);
assert.equal(meleeEnemy.statusEffects.chill.count, 1);

const alarm = batch.createAlarmWard(caster, { id: "alarm_test", mode: "mental", areaId: "north_gate", excludedUnitIds: ["friend"], persist: false, subjectPlayerId: "player_1", now: 1000 });
assert.equal(alarm.resolved, true);
assert.equal(alarm.ward.mode, "mental");
assert.equal(alarm.ward.durationHours, 8);
assert.equal(alarm.ward.areaId, "north_gate");

assert.equal(alarm.ward.dmManagedTrigger, true);
assert.equal(alarm.persistence.effect.kind, "alarm");
assert.equal(alarm.persistence.effect.subjectPlayerId, "player_1");
assert.equal(alarm.persistence.effect.expiresAt, 1000 + 8 * 60 * 60 * 1000);

const familiarLibrary = {
  cat_black: { id: "cat_black", name: "Cat · Black", species: "cat", hp: 4, maxHp: 4, action_slots: ["cat_scratch"] },
  cat_white: { id: "cat_white", name: "Cat · White", species: "cat", hp: 4, maxHp: 4, action_slots: ["cat_scratch"] },
  owl: { id: "owl", name: "Owl", species: "owl", hp: 3, maxHp: 3, action_slots: ["owl_talons"] },
  wolf: { id: "wolf", name: "Wolf", species: "wolf", hp: 11, maxHp: 11, action_slots: ["wolf_bite"] }
};
const familiarOptions = batch.listFindFamiliarOptions(familiarLibrary);
assert.deepEqual(familiarOptions.filter((row) => row.form === "cat").map((row) => row.id), ["cat_black", "cat_white"]);
assert.ok(familiarOptions.some((row) => row.id === "owl"));
assert.equal(familiarOptions.some((row) => row.id === "wolf"), false);

const familiarCaster = { id: "wizard_familiar", faction: "ally" };
const familiarContext = { unitLibrary: familiarLibrary, combatData: {}, units: [familiarCaster] };
const firstFamiliar = batch.summonFindFamiliar(familiarCaster, {
  familiarUnitId: "cat_black",
  spiritType: "celestial",
  context: familiarContext
});
assert.equal(firstFamiliar.resolved, true);
assert.equal(firstFamiliar.familiar.familiarUnitId, "cat_black");
assert.equal(firstFamiliar.familiar.familiarForm, "cat");
assert.equal(firstFamiliar.familiar.creatureType, "celestial");
assert.equal(firstFamiliar.familiar.familiarCannotAttack, false);
assert.deepEqual(firstFamiliar.familiar.action_slots, ["cat_scratch"]);
assert.ok(firstFamiliar.familiar.actionSlots >= 1);

const oldFamiliarId = firstFamiliar.familiar.id;
const secondFamiliar = batch.summonFindFamiliar(familiarCaster, {
  familiarUnitId: "cat_white",
  spiritType: "fey",
  context: familiarContext
});
assert.equal(secondFamiliar.resolved, true);
assert.equal(secondFamiliar.familiar.familiarUnitId, "cat_white");
assert.equal(familiarContext.combatData[oldFamiliarId], undefined, "recasting must replace the previous Familiar");
assert.equal(familiarCaster.__luminousFindFamiliar.unitLibraryId, "cat_white");

const touchDelivery = batch.deliverTouchSpellThroughFamiliar(familiarCaster, secondFamiliar.familiar, {
  id: "touch_spell_action",
  metadata: {}
});
assert.equal(touchDelivery.resolved, true);
assert.equal(touchDelivery.action.metadata.spellOriginUnitId, secondFamiliar.familiar.id);
assert.equal(touchDelivery.action.metadata.familiarReactionRequired, true);



assert.deepEqual(catalog.fog_cloud.classIds, ["druid", "ranger", "sorcerer", "wizard"]);
assert.equal(catalog.fog_cloud.mechanics.clashPowerModifier, -3);
assert.equal(catalog.fog_cloud.mechanics.unopposedFinalPowerModifier, -4);
assert.equal(catalog.fog_cloud.mechanics.analyseThresholdModifier, 5);
assert.deepEqual(catalog.fog_cloud.mechanics.bypassSenses, ["blindsight", "truesight"]);

assert.deepEqual(catalog.goodberry.classIds, ["druid", "ranger"]);
assert.deepEqual(catalog.goodberry.mechanics.requiresChoice.values, ["goodberry", "goodshrooms"]);
assert.equal(catalog.goodberry.description.includes("Cooking"), false, "Goodberry player-facing text must not reveal secret cooking");

assert.equal(catalog.grease.mechanics.speedModifier, -1);
assert.deepEqual(catalog.grease.mechanics.saveTriggers, ["on_create", "on_enter", "turn_end"]);

assert.deepEqual(catalog.guiding_bolt.classIds, ["cleric"]);
assert.equal(catalog.guiding_bolt.attackWeight, 1);
assert.equal(catalog.guiding_bolt.damageType, "perforante");
assert.equal(batch.STATUS_DEFINITIONS.guided_light.icon, "https://imgur.com/9OdpgRZ", "Guided Light should use the approved icon");

assert.equal(catalog.hail_of_thorns.attackWeight, 3);
assert.equal(catalog.hail_of_thorns.mechanics.fixedDamagePerSpellSlotUsed, 5);

assert.equal(catalog.healing_word.attackWeight, 0, "healing/buff target count must not use ATK Weight");
assert.deepEqual(catalog.healing_word.classIds, ["bard", "cleric", "druid"]);

assert.equal(catalog.hellish_rebuke.mechanics.onFailedSaveStatus.count, 3);
assert.equal(catalog.heroism.attackWeight, 0, "buff target count must not use ATK Weight");
assert.equal(catalog.heroism.mechanics.shieldPerSpellMod, 3);
assert.equal(batch.STATUS_DEFINITIONS.hexed.icon, "https://imgur.com/M89vPkr");
assert.equal(batch.STATUS_DEFINITIONS.marked_quarry.icon, "https://imgur.com/bwjqA28");
assert.equal(catalog.hunters_mark.mechanics.analyseThresholdModifier, -2);
assert.equal(catalog.ice_knife.mechanics.explosion.attackWeight, 3);

const fogCaster = {
  id: "fog_caster",
  spellcastingState: { concentration: { active: { spellId: "fog_cloud" } } },
};
const fogAttacker = { id: "fog_attacker", statusEffects: {} };
const fogTarget = { id: "fog_target", statusEffects: {} };
const fog = batch.createFogCloudArea(fogCaster, [fogTarget], { slotLevel: 2, id: "fog_test" });
assert.equal(fog.resolved, true);
assert.equal(fog.area.additionalAreaRings, 1);
assert.equal(batch.fogCloudPowerModifier(fogAttacker, fogTarget, "clash"), -3);
assert.equal(batch.fogCloudPowerModifier(fogAttacker, fogTarget, "unopposed"), -4);
assert.equal(batch.fogCloudAnalyseThresholdModifier(fogAttacker, fogTarget), 5);
fogAttacker.traits = ["Truesight"];
assert.equal(batch.fogCloudPowerModifier(fogAttacker, fogTarget, "clash"), 0);
assert.equal(batch.fogCloudAnalyseThresholdModifier(fogAttacker, fogTarget), 0);
assert.equal(batch.disperseFogCloud("fog_test", [fogTarget], "strong_wind").resolved, true);

const greaseCaster = { id: "grease_caster" };
const greaseTarget = { id: "grease_target", speed: 5, statusEffects: {} };
const grease = batch.createGreaseArea(greaseCaster, [greaseTarget], { id: "grease_test", spellDC: 14 });
assert.equal(grease.resolved, true);
assert.equal(batch.greaseSpeedModifier(greaseTarget), -1);
batch.resolveGreaseSave(greaseTarget, false, grease.area);
assert.ok(greaseTarget.statusEffects.prone);
batch.setGreaseMembership(grease.area, greaseTarget, false);
assert.equal(batch.greaseSpeedModifier(greaseTarget), 0);

const foodCaster = { id: "food_caster", inventory: {} };
const goodberry = batch.createGoodMagicFood(foodCaster, "goodberry", { now: 1000 });
assert.equal(goodberry.resolved, true);
assert.equal(goodberry.item.definitionId, "blueberry");
assert.equal(goodberry.item.quantity, 10);
assert.equal(goodberry.item.hungerSlotsRestored, 3);
assert.equal(goodberry.item.hydrationSlotsRestored, 3);
assert.equal(goodberry.item.customData.goodMagicFood.secretCooking.healFlat, 15);
assert.equal(goodberry.item.customData.goodMagicFood.secretCooking.healMaxHpPercent, 10);
assert.equal(
  batch.resolveGoodMagicCookingEnhancement([{ item: goodberry.item, units: 10 }], 2000).healing.maxHpPercent,
  10
);
const goodshrooms = batch.createGoodMagicFood({ id: "shroom_caster", inventory: {} }, "goodshrooms", { now: 1000 });
assert.equal(goodshrooms.item.definitionId, "common_mushroom");
assert.equal(goodshrooms.variant, "goodshrooms");

const healingTarget = { id: "healing_target", hp: 50, maxHp: 100 };
const healing = batch.applyHealingWord(healingTarget, 2, 3);
assert.equal(healing.flat, 2);
assert.equal(healing.maxHpPercent, 6);
assert.equal(healing.healed, 8);
assert.equal(healingTarget.hp, 58);

const guideCaster = { id: "guide_caster" };
const guideTarget = { id: "guide_target", statusEffects: {} };
batch.resolveGuidingBoltHit(guideCaster, guideTarget, { id: "guiding_bolt" });
assert.equal(guideTarget.statusEffects.radiance.count, 2);
assert.ok(guideTarget.statusEffects.guided_light);
assert.equal(batch.guidedLightPowerBonus({ id: "ally" }, guideTarget), 2);
assert.equal(batch.consumeGuidedLight(guideTarget), true);
assert.equal(guideTarget.statusEffects.guided_light, undefined);

const heroCaster = {
  id: "hero_caster",
  spellcastingState: { concentration: { active: { spellId: "heroism" } } },
};
const heroTarget = { id: "hero_target", shield: 0, statusEffects: { frightened: { id: "frightened", count: 2 } } };
const hero = batch.grantHeroism(heroTarget, heroCaster, 4);
assert.equal(hero.desiredShield, 12);
assert.equal(heroTarget.__luminousHeroism.remainingShield, 12);
assert.equal(heroTarget.statusEffects.frightened, undefined);
batch.consumeHeroismShield(heroTarget, 12);
assert.equal(batch.heroismHasShield(heroTarget), false);
batch.refreshHeroismAtTurnStart([heroCaster, heroTarget]);
assert.equal(batch.heroismHasShield(heroTarget), true);
assert.equal(heroTarget.__luminousHeroism.remainingShield, 12);

const hexCaster = { id: "hex_caster", hp: 100 };
const hexTarget = { id: "hex_target", hp: 100, maxHp: 100, statusEffects: {} };
const hexResult = batch.applyHex(hexCaster, hexTarget, "wis", 1, 1000);
assert.equal(hexResult.resolved, true);
assert.equal(batch.hexCheckThresholdModifier(hexTarget, "wis"), 3);
assert.equal(batch.hexCheckThresholdModifier(hexTarget, "dex"), 0);
const hexSkill = { id: "slash" };
batch.resolveHexHit(hexCaster, hexTarget, hexSkill, { engine: { applyDamage(unit, amount) { unit.hp -= amount; } } });
assert.equal(hexTarget.hp, 97);
assert.equal(hexTarget.statusEffects.decay.count, 1);
assert.equal(batch.resolveHexHit(hexCaster, hexTarget, hexSkill, { engine: { applyDamage(unit, amount) { unit.hp -= amount; } } }), null, "Hex must trigger once per Attack Skill");

const ranger = { id: "ranger", hp: 100 };
const quarry = { id: "quarry", hp: 100, maxHp: 100, statusEffects: {} };
batch.applyHuntersMark(ranger, quarry, 1, 1000);
assert.equal(batch.markedQuarryAnalyseThresholdModifier(ranger, quarry), -2);
assert.equal(batch.markedQuarryTrackingThresholdModifier(ranger, quarry, "perception"), -3);
const markSkill = { id: "arrow" };
batch.resolveHuntersMarkHit(ranger, quarry, markSkill, { engine: { applyDamage(unit, amount) { unit.hp -= amount; } } });
assert.equal(quarry.hp, 96);

const hailA = { id: "hail_a", hp: 30, statusEffects: {} };
const hailB = { id: "hail_b", hp: 30, statusEffects: {} };
const hail = batch.resolveHailOfThorns([hailA, hailB], 2, { metadata: { saveResults: { hail_a: false, hail_b: true } } }, {});
assert.equal(hail.damage, 10);
assert.equal(hail.results[0].damage, 10);
assert.equal(hail.results[1].damage, 5);

const rebukeTarget = { id: "rebuke_target", hp: 40, statusEffects: {} };
const rebuke = batch.resolveHellishRebuke(rebukeTarget, 2, { metadata: { saveResults: { rebuke_target: false } } }, {});
assert.equal(rebuke.damage, 15);
assert.equal(rebukeTarget.statusEffects.burn.count, 3);

const iceA = { id: "ice_a", hp: 40, statusEffects: {} };
const iceB = { id: "ice_b", hp: 40, statusEffects: {} };
const ice = batch.resolveIceKnifeExplosion([iceA, iceB], 2, { metadata: { saveResults: { ice_a: false, ice_b: true } } }, {});
assert.equal(ice.damage, 9);
assert.equal(ice.attackWeight, 3);
assert.equal(iceA.statusEffects.chill.count, 2);
assert.equal(iceB.statusEffects.chill, undefined);

console.log("Level 1 spell batch 1 smoke: OK");
