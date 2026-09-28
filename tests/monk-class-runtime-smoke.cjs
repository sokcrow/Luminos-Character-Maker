const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  delete globalThis.LuminousTraitEngine;
  delete globalThis.LuminousTraitCatalogCore;
  delete globalThis.LuminousWeaponPropertyRuntime;
  delete globalThis.LuminousMonkClassRuntime;

  await import(pathToFileURL(path.resolve(__dirname, "../js/trait-engine.js")).href);
  await import(pathToFileURL(path.resolve(__dirname, "../js/trait-catalog-core.js")).href);
  await import(pathToFileURL(path.resolve(__dirname, "../js/weapon-property-runtime.js")).href);
  await import(pathToFileURL(path.resolve(__dirname, "../js/monk-class-runtime.js")).href);

  const monk = globalThis.LuminousMonkClassRuntime;
  const catalog = globalThis.LuminousTraitCatalogCore;
  const engine = globalThis.LuminousTraitEngine;

  assert.ok(monk);
  assert.equal(monk.MONK_GRANTS.length, 22);

  [
    "unarmored_defense", "martial_arts", "ki", "flurry_of_blows", "patient_defense",
    "step_of_the_wind", "unarmored_movement", "deflect_missiles", "slow_fall",
    "stunning_strike", "ki_empowered_strikes", "evasion", "stillness_of_mind",
    "unarmored_movement_plus", "purity_of_body", "tongue_of_the_sun_and_moon",
    "diamond_soul", "timeless_body", "unarmored_movement_plus_plus", "empty_body",
    "perfect_self",
  ].forEach((id) => assert.ok(catalog.getDefinition(id), id));

  const grantsByLevel = monk.MONK_GRANTS.reduce((map, grant) => {
    const level = String(grant.atLevel);
    if (!map[level]) map[level] = [];
    map[level].push(grant.traitId);
    return map;
  }, {});
  assert.deepEqual(grantsByLevel["1"], ["unarmored_defense", "martial_arts"]);
  assert.deepEqual(grantsByLevel["10"], ["ki", "flurry_of_blows", "patient_defense", "step_of_the_wind", "unarmored_movement"]);
  assert.deepEqual(grantsByLevel["15"], ["deflect_missiles"]);
  assert.deepEqual(grantsByLevel["20"], ["slow_fall"]);
  assert.deepEqual(grantsByLevel["25"], ["additional_attack", "stunning_strike"]);
  assert.deepEqual(grantsByLevel["30"], ["ki_empowered_strikes"]);
  assert.deepEqual(grantsByLevel["35"], ["evasion", "stillness_of_mind"]);
  assert.deepEqual(grantsByLevel["50"], ["unarmored_movement_plus", "purity_of_body"]);
  assert.deepEqual(grantsByLevel["65"], ["tongue_of_the_sun_and_moon"]);
  assert.deepEqual(grantsByLevel["70"], ["diamond_soul"]);
  assert.deepEqual(grantsByLevel["75"], ["timeless_body"]);
  assert.deepEqual(grantsByLevel["90"], ["unarmored_movement_plus_plus", "empty_body"]);
  assert.deepEqual(grantsByLevel["100"], ["perfect_self"]);

  const validation = catalog.validateAll(engine);
  assert.equal(validation.valid, true, validation.errors.join("\n"));

  assert.equal(monk.isMonkWeapon({ id:"dagger", classification:"simple_melee", properties:["light","finesse"] }), true);
  assert.equal(monk.isMonkWeapon({ id:"greatclub", classification:"simple_melee", properties:["heavy"], handMode:"two_handed" }), false);
  assert.equal(monk.isMonkWeapon({ id:"shortsword", classification:"martial_melee", properties:["light","finesse"] }), true);
  assert.equal(monk.isMonkWeapon({ id:"shortsword", classification:"martial_melee", properties:["heavy"] }), false);

  const eligible = monk.martialArtsEligibleAttack(
    { type:"Attack", skillFamily:"attack", attackMode:"melee", coinAmount:1 },
    { id:"dagger", classification:"simple_melee", properties:["light","finesse"] }
  );
  assert.equal(eligible, true);

  const followUp = monk.martialArtsFollowUp(
    { equipment:{} },
    { type:"Attack", skillFamily:"attack", attackMode:"melee", coinAmount:1 },
    { id:"dagger", classification:"simple_melee", properties:["light","finesse"] },
    { modifiers:{ resolveEquipment:() => ({armorEquipped:false,shield:null}) } }
  );
  assert.equal(followUp.available, true);
  assert.equal(followUp.tier, 1);
  assert.equal(followUp.skillFamily, "unarmed");

  const l10 = { classes:[{ id:"monk", levels:10 }] };
  const l50 = { classes:[{ id:"monk", levels:50 }] };
  const l90 = { classes:[{ id:"monk", levels:90 }] };
  const l100 = { classes:[{ id:"monk", levels:100 }] };

  assert.equal(monk.kiMaximum(l10), 2);
  assert.equal(monk.kiMaximum(l100), 20);
  assert.equal(monk.slowFallReductionPercent(l10), 10);
  assert.equal(monk.slowFallReductionPercent(l100), 50);

  monk.gainKi(l10, 2, "test");
  assert.equal(monk.kiPool(l10).current, 2);
  assert.equal(monk.spendKi(l10, 1).success, true);
  assert.equal(monk.kiPool(l10).current, 1);

  const l100EventOutcomes = [];
  monk.processMonkCombatEvent("encounter_start", { character:l100, self:l100, turnNumber:1 }, l100EventOutcomes);
  assert.equal(monk.kiPool(l100).current, 8);
  monk.processMonkCombatEvent("turn_start", { character:l100, self:l100, turnNumber:1 }, l100EventOutcomes);
  assert.equal(monk.kiPool(l100).current, 10);

  const definitions = catalog.allDefinitions();
  const grants = catalog.allGrants();
  const traits10 = engine.resolveTraitGrants(l10, grants, definitions).map((trait) => trait.id);
  const traits50 = engine.resolveTraitGrants(l50, grants, definitions).map((trait) => trait.id);
  const traits90 = engine.resolveTraitGrants(l90, grants, definitions).map((trait) => trait.id);
  assert.ok(traits10.includes("unarmored_movement"));
  assert.ok(!traits10.includes("unarmored_movement_plus"));
  assert.ok(!traits50.includes("unarmored_movement"));
  assert.ok(traits50.includes("unarmored_movement_plus"));
  assert.ok(!traits90.includes("unarmored_movement"));
  assert.ok(!traits90.includes("unarmored_movement_plus"));
  assert.ok(traits90.includes("unarmored_movement_plus_plus"));

  const languageCharacter = {};
  const languageResult = monk.applyTongueOfSunAndMoon(languageCharacter);
  assert.equal(languageResult.updated, 16);
  assert.equal(languageCharacter.idiomas.common.porcentaje, 100);
  assert.equal(languageCharacter.idiomas.deep_speech.porcentaje, 100);
  assert.equal(languageCharacter.idiomas.anomalous, undefined);

  const evasion = monk.resolveEvasion({ atkWeight:2 }, { passed:true });
  assert.equal(evasion.triggered, true);
  assert.equal(evasion.damageMultiplier, 0);

  const deflectSpell = monk.deflectMissilesClashPower(l100, { type:"Spell", skillFamily:"spell" }, false);
  const deflectRanged = monk.deflectMissilesClashPower(l100, { type:"Attack", skillFamily:"attack", attackMode:"ranged" }, false);
  assert.equal(deflectSpell.clashPower, 1);
  assert.equal(deflectRanged.clashPower, 2);

  console.log("Monk class runtime smoke: OK (base L1-L100)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
