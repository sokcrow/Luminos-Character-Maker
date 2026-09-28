const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemQualityEngine;
  delete globalThis.LuminousItemSizeLineageEngine;
  delete globalThis.LuminousItemHarvestIntegrityEngine;
  delete globalThis.LuminousHardPartsCatalog;

  await import(pathToFileURL(path.resolve(__dirname, '../js/item-quality-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-size-lineage-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-harvest-integrity-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-hard-parts.js')).href);

  const hard = globalThis.LuminousHardPartsCatalog;
  assert.ok(hard);
  assert.equal(hard.VERSION, 1);
  assert.equal(hard.FAMILY, 'hard_parts');
  assert.equal(hard.AHN_ECONOMY_SCALE, 20);
  assert.equal(hard.ITEMS.length, 10);

  const prices = {
    hard_bone: 12000,
    hard_beak: 18000,
    hard_claw: 20000,
    hard_talon: 20000,
    hard_fang: 24000,
    hard_horn: 30000,
    hard_antler: 30000,
    hard_tusk: 36000,
    hard_ivory: 36000,
    hard_exotic: 44000,
  };
  for (const [id, price] of Object.entries(prices)) {
    const item = hard.get(id);
    assert.ok(item, id);
    assert.equal(item.mediumStandardValueAhn, price);
    assert.equal(item.qualitySystem, 'universal');
    assert.equal(item.sizeSystem, 'anatomical_part_size');
    assert.equal(item.creatureSizeDoesNotImplyPartSize, true);
  }

  assert.equal(hard.priceForSizeAndQuality('hard_bone', 'tiny', 'standard'), 3000);
  assert.equal(hard.priceForSizeAndQuality('hard_bone', 'large', 'standard'), 24000);
  assert.equal(hard.priceForSizeAndQuality('hard_fang', 'medium', 'fine'), 36000);
  assert.equal(hard.priceForSizeAndQuality('hard_fang', 'medium', 'standard', { draconic: true }), 72000);

  const wolfProfile = hard.createAnatomyProfile({
    id: 'wolf',
    lineageId: 'wolf',
    lineageName: 'Wolf',
    creatureSize: 'medium',
    parts: {
      skull: 1,
      femur: { maxCount: 2, partSize: 'medium' },
      humerus: { maxCount: 2, partSize: 'medium' },
      fang: { maxCount: 4, partSize: 'small' },
      claw: { maxCount: 18, partSize: 'tiny' },
    },
  });
  assert.equal(hard.maxCountForPart(wolfProfile, 'skull'), 1);
  assert.equal(hard.clampYieldToAnatomy(wolfProfile, 'skull', 2), 1);
  assert.equal(hard.clampYieldToAnatomy(wolfProfile, 'fang', 8), 4);

  const twoHeadedProfile = hard.createAnatomyProfile({ id: 'two_headed', heads: 2 });
  assert.equal(hard.maxCountForPart(twoHeadedProfile, 'skull'), 2);

  const wolfFemur = hard.createHarvestPart('hard_bone', {
    anatomyProfile: wolfProfile,
    anatomicalPart: 'femur',
    quantity: 2,
    quality: 'fine',
    lineageId: 'wolf',
    lineageName: 'Wolf',
    originCreatureType: 'beast',
    originCreatureId: 'wolf',
  });
  assert.equal(wolfFemur.quantity, 2);
  assert.equal(wolfFemur.partSize, 'medium');
  assert.equal(wolfFemur.creatureSize, 'medium');
  assert.equal(wolfFemur.anatomicalPart, 'femur');
  assert.equal(wolfFemur.form, 'long');
  assert.equal(wolfFemur.materialName, 'Wolf Femur');
  assert.equal(wolfFemur.displayName, 'Medium Wolf Femur');
  assert.equal(wolfFemur.unitValueAhn, 18000);
  assert.equal(wolfFemur.canMergeForLargerPart, false);

  const chickenFemurs = hard.createHarvestPart('hard_bone', {
    anatomicalPart: 'femur',
    quantity: 4,
    partSize: 'tiny',
    lineageId: 'chicken',
    lineageName: 'Chicken',
  });
  assert.equal(hard.recipeSatisfied('bone_club', [chickenFemurs]), false, 'four Tiny bones cannot merge into a Medium club blank');
  assert.equal(hard.recipeSatisfied('bone_club', [wolfFemur]), true);
  assert.equal(hard.canMergePartsForLargerSize([chickenFemurs], 'medium'), false);
  assert.equal(hard.canDownsizePart('large', 'medium'), true);
  assert.equal(hard.canDownsizePart('tiny', 'medium'), false);

  const shieldBoneA = { ...wolfFemur, quantity: 1 };
  const shieldBoneB = { ...wolfFemur, quantity: 1, anatomicalPart: 'humerus' };
  assert.equal(hard.recipeSatisfied('primitive_shield', [shieldBoneA], 4), false);
  assert.equal(hard.recipeSatisfied('primitive_shield', [shieldBoneA, shieldBoneB], 4), true);
  assert.equal(hard.recipeSatisfied('primitive_shield', [shieldBoneA, shieldBoneB], 2), false);

  const dragonFang = hard.createHarvestPart('hard_fang', {
    anatomicalPart: 'fang',
    partSize: 'large',
    quality: 'standard',
    lineageId: 'red_dragon',
    lineageName: 'Red Dragon',
    originCreatureType: 'dragon',
    draconic: true,
  });
  assert.equal(dragonFang.materialName, 'Red Dragon Fang');
  assert.equal(dragonFang.displayName, 'Large Red Dragon Fang');
  assert.equal(dragonFang.lineageValueMultiplier, 3);
  assert.equal(dragonFang.unitValueAhn, 144000);

  console.log('Hard Parts catalog smoke: OK (anatomical pieces, size gates, lineage naming, Ahn recalibration)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});