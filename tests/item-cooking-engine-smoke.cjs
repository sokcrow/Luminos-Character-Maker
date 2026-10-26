const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemAffinityEngine;
  delete globalThis.LuminousCookingEngine;
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-affinity-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-cooking-engine.js')).href);
  const affinity = globalThis.LuminousItemAffinityEngine;
  const cooking = globalThis.LuminousCookingEngine;

  assert.ok(cooking);
  assert.equal(cooking.VERSION, 1);
  assert.equal(cooking.MIN_RECIPE_TH, 8);
  assert.equal(cooking.MAX_RECIPE_TH, 24);
  assert.equal(cooking.MEDIUM_HUNGER_SLOTS, 3);
  assert.equal(cooking.MEDIUM_HYDRATION_SLOTS, 3);
  assert.equal(cooking.SURVIVAL_DECAY_HOURS, 6);

  assert.equal(cooking.methodBaseTh('assemble'), 8);
  assert.equal(cooking.methodBaseTh('pan fry'), 10);
  assert.equal(cooking.methodBaseTh('simmer'), 12);
  assert.equal(cooking.methodBaseTh('bake'), 13);
  assert.equal(cooking.methodBaseTh('ferment'), 15);

  const ingredients = [
    { role: 'core', taste: 3 },
    { role: 'major', taste: 2 },
    { role: 'minor', taste: 3 },
    { role: 'seasoning', taste: 4 },
  ];
  const complexity = cooking.ingredientComplexity(ingredients);
  assert.equal(complexity.raw, 2.75);
  assert.equal(complexity.th, 3);

  const recipeTh = cooking.buildRecipeTh({
    method: 'bake',
    ingredients,
    auxiliarySteps: ['whisk', 'temperature_control'],
    processedStabilization: 1,
  });
  assert.equal(recipeTh.baseTh, 13);
  assert.equal(recipeTh.ingredientTh, 3);
  assert.equal(recipeTh.auxiliaryTh, 2);
  assert.equal(recipeTh.recipeTh, 17);

  assert.equal(cooking.cooksUtensilsReduction({ hasCooksUtensils: true }), 1);
  assert.equal(cooking.cooksUtensilsReduction({ hasCooksUtensils: true, proficient: true, proficiency: 2 }), 4);

  const equipment = cooking.effectiveCookingTh(20, {
    hasCooksUtensils: true,
    proficient: true,
    proficiency: 2,
    improperEquipmentCount: 1,
  });
  assert.equal(equipment.utensilReduction, 4);
  assert.equal(equipment.improperPenalty, 3);
  assert.equal(equipment.effectiveTh, 19);

  assert.equal(cooking.validateRecipeAbility('DEX'), 'dex');
  assert.equal(cooking.validateRecipeAbility('str'), null);

  assert.equal(cooking.starsFromMargin(-8), 1);
  assert.equal(cooking.starsFromMargin(-7), 2);
  assert.equal(cooking.starsFromMargin(0), 3);
  assert.equal(cooking.starsFromMargin(4), 4);
  assert.equal(cooking.starsFromMargin(8), 5);

  assert.equal(cooking.STAR_ACTIVE_EFFECTS[1], 0);
  assert.equal(cooking.STAR_ACTIVE_EFFECTS[5], 3);
  assert.equal(cooking.STAR_DURATION_HOURS[2], 1);
  assert.equal(cooking.STAR_DURATION_HOURS[5], 6);

  const taste = cooking.baseTaste([
    { role: 'core', taste: 3 },
    { role: 'major', taste: 2 },
    { role: 'major', taste: 3 },
    { role: 'minor', taste: 3 },
    { role: 'seasoning', taste: 4 },
    { role: 'seasoning', taste: 3 },
  ]);
  assert.equal(taste.raw, 2.8125);
  assert.equal(taste.value, 3);
  assert.equal(cooking.finalTaste(3, 5), 5);
  assert.equal(cooking.spFromTaste(5, true), 7);
  assert.equal(cooking.spFromTaste(0, false), -10);
  assert.equal(cooking.spFromTaste(5, false), -5);

  assert.deepEqual(cooking.powerVector(1, 5), [6]);
  assert.deepEqual(cooking.powerVector(2, 5), [4, 2]);
  assert.deepEqual(cooking.powerVector(3, 5), [3, 2, 1]);
  assert.deepEqual(cooking.powerVector(4, 5), [1, 1, 1]);
  assert.equal(cooking.propertyPowerCapForTh(9), 2);
  assert.equal(cooking.propertyPowerCapForTh(13), 3);
  assert.equal(cooking.propertyPowerCapForTh(17), 4);
  assert.equal(cooking.propertyPowerCapForTh(22), 6);

  const propertyIngredients = [
    {
      itemId: 'wolf_meat',
      role: 'core',
      sourceInstanceId: 'wolf-a',
      culinaryProperties: [{ target: 'survival', sourceInstanceId: 'wolf-a' }],
    },
    {
      itemId: 'rice',
      role: 'major',
      sourceInstanceId: 'rice-a',
      culinaryProperties: [{ target: 'con_save', sourceInstanceId: 'rice-a' }],
    },
    {
      itemId: 'mystic_sauce',
      role: 'minor',
      sourceInstanceId: 'sauce-a',
      culinaryProperties: [{ target: 'athletics', sourceInstanceId: 'sauce-a' }],
    },
    {
      itemId: 'rosemary',
      role: 'seasoning',
      sourceInstanceId: 'herb-a',
      culinaryProperties: [{ target: 'survival', sourceInstanceId: 'herb-a' }],
    },
    {
      itemId: 'processed_wolf_stock',
      role: 'minor',
      culinaryProperties: [{ target: 'survival', sourceInstanceId: 'wolf-a' }],
    },
  ];
  const ranked = cooking.rankPropertyTargets(propertyIngredients);
  assert.deepEqual(ranked.map((entry) => [entry.target, entry.affinity]), [
    ['survival', 4],
    ['con_save', 3],
    ['athletics', 2],
  ]);

  const effects = cooking.resolveCulinaryEffects(propertyIngredients, { stars: 5, recipeTh: 22 });
  assert.deepEqual(effects.map((entry) => [entry.target, entry.power]), [
    ['survival', 3],
    ['con_save', 2],
    ['athletics', 1],
  ]);

  const proceduralIngredient = affinity.materializeCulinaryAffinity({
    itemId: 'mystic_apple',
    role: 'core',
    culinaryAffinities: {
      arcana: 75,
      survival: 25,
    },
  }, {
    sourceInstanceId: 'apple-instance-a',
    roll: 0.0,
  });
  assert.equal(proceduralIngredient.culinaryProperties.length, 1);
  assert.equal(proceduralIngredient.culinaryProperties[0].target, 'arcana');
  assert.deepEqual(
    cooking.rankPropertyTargets([proceduralIngredient]).map((entry) => [entry.target, entry.affinity]),
    [['arcana', 3]]
  );

  assert.deepEqual(cooking.dailySurvivalExhaustion({
    completedRequiredLongRest: false,
    hungerSlots: 0,
    hydrationSlots: 3,
  }), { sleepPenalty: 1, sustenancePenalty: 1, total: 2 });

  assert.deepEqual(cooking.dailySurvivalExhaustion({
    completedRequiredLongRest: true,
    hungerSlots: 1,
    hydrationSlots: 1,
  }), { sleepPenalty: 0, sustenancePenalty: 0, total: 0 });

  assert.equal(cooking.REST_CONTRACT.shortRest.activeWindows, 1);
  assert.equal(cooking.REST_CONTRACT.shortRest.cooldownHours, 2);
  assert.equal(cooking.REST_CONTRACT.longRest.sleepRequired, true);

  const finalItem = cooking.resolvePreparedItem({
    id: 'test_mystic_bake',
    ability: 'wis',
    method: 'bake',
    ingredients: propertyIngredients.map((entry, index) => ({ ...entry, taste: index === 3 ? 4 : 3 })),
    auxiliarySteps: ['whisk'],
    propertyPriority: ['survival', 'con_save', 'athletics'],
    edible: true,
  }, 30, {
    equipment: { hasCooksUtensils: true },
  });
  assert.equal(finalItem.ability, 'wis');
  assert.ok(finalItem.recipeTh >= 8 && finalItem.recipeTh <= 24);
  assert.equal(finalItem.stars, 5);
  assert.equal(finalItem.effects.length, 3);
  assert.ok(finalItem.sp >= 2 && finalItem.sp <= 8);

  console.log('Cooking V1 smoke: OK (TH, stars, taste/SP, survival and weighted item affinities)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
