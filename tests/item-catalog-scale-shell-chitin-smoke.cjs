const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemQualityEngine;
  delete globalThis.LuminousItemSizeLineageEngine;
  delete globalThis.LuminousScaleShellChitinCatalog;

  await import(pathToFileURL(path.resolve(__dirname, '../js/item-quality-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-size-lineage-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-scale-shell-chitin.js')).href);

  const catalog = globalThis.LuminousScaleShellChitinCatalog;
  assert.ok(catalog);
  assert.equal(catalog.VERSION, 1);
  assert.equal(catalog.FAMILY, 'scale_shell_chitin');
  assert.equal(catalog.AHN_ECONOMY_SCALE, 10);
  assert.equal(catalog.ITEMS.length, 7);

  const prices = {
    scale: 3000,
    scute: 5000,
    shell: 18000,
    carapace: 20000,
    chitin: 4500,
    exoskeleton_plate: 15000,
    exotic_armor_plate: 26000,
  };

  for (const [id, price] of Object.entries(prices)) {
    const item = catalog.get(id);
    assert.ok(item, id);
    assert.equal(item.mediumStandardValueAhn, price);
    assert.equal(item.qualitySystem, 'universal');
    assert.equal(item.sizeSystem, 'anatomical_part_size');
    assert.equal(item.canMergeForLargerPart, false);
  }

  assert.equal(catalog.get('scale').iconFamily, 'scale_reptile');
  assert.equal(catalog.get('shell').iconFamily, 'shell_carapace');
  assert.equal(catalog.get('chitin').iconFamily, 'chitin_plate');
  assert.equal(catalog.get('scale').physicalMode, 'modular');
  assert.equal(catalog.get('carapace').physicalMode, 'structural');
  assert.equal(catalog.get('scale').canAggregateCoverage, true);
  assert.equal(catalog.get('carapace').canAggregateCoverage, false);

  assert.equal(catalog.priceForSizeAndQuality('scale', 'tiny', 'standard'), 750);
  assert.equal(catalog.priceForSizeAndQuality('scale', 'medium', 'standard'), 3000);
  assert.equal(catalog.priceForSizeAndQuality('carapace', 'large', 'standard'), 40000);
  assert.equal(catalog.priceForSizeAndQuality('scale', 'medium', 'standard', { draconic: true }), 9000);
  assert.equal(catalog.priceForSizeAndQuality('scale', 'medium', 'fine', { draconic: true }), 13500);
  assert.equal(catalog.priceForSizeAndQuality('chitin', 'medium', 'fine', { draconic: true }), 6750);

  assert.equal(catalog.fallbackYieldMax('scale', 'medium'), 8);
  assert.equal(catalog.fallbackYieldMax('scale', 'large'), 16);
  assert.equal(catalog.fallbackYieldMax('scute', 'medium'), 4);
  assert.equal(catalog.fallbackYieldMax('chitin', 'huge'), 32);
  assert.equal(catalog.fallbackYieldMax('scale', 'gargantuan', { draconic: true }), 128);
  assert.equal(catalog.fallbackYieldMax('carapace', 'gargantuan'), null);

  const turtleProfile = catalog.createAnatomyProfile({
    id: 'turtle',
    lineageId: 'turtle',
    lineageName: 'Turtle',
    creatureSize: 'large',
    parts: {
      carapace: { maxCount: 1, partSize: 'large' },
      scute: { maxCount: 12, partSize: 'medium' },
    },
  });
  assert.equal(catalog.maxYieldFor(turtleProfile, 'carapace'), 1);
  assert.equal(catalog.clampYieldToAnatomy(turtleProfile, 'carapace', 4), 1);
  assert.equal(catalog.maxYieldFor(turtleProfile, 'scute'), 12);

  const turtle = catalog.createHarvestPart('carapace', {
    anatomyProfile: turtleProfile,
    quantity: 3,
    quality: 'fine',
    lineageId: 'turtle',
    lineageName: 'Turtle',
    originCreatureType: 'beast',
  });
  assert.equal(turtle.quantity, 1);
  assert.equal(turtle.partSize, 'large');
  assert.equal(turtle.displayName, 'Large Turtle Carapace');
  assert.equal(turtle.discreteStructuralPart, true);
  assert.equal(turtle.canAggregateCoverage, false);
  assert.equal(turtle.canMergeForLargerPart, false);
  assert.equal(turtle.canDownsizeForSmallerUse, true);
  assert.equal(turtle.harvestIntegrityFamily, 'hard_cover_structural');
  assert.equal(turtle.unitValueAhn, 60000);

  const dragonProfile = catalog.createAnatomyProfile({
    id: 'red_dragon',
    lineageId: 'red_dragon',
    lineageName: 'Red Dragon',
    creatureSize: 'gargantuan',
    draconic: true,
    parts: {
      scale: { maxCount: 128 },
    },
  });
  const dragonScale = catalog.createHarvestPart('scale', {
    anatomyProfile: dragonProfile,
    quantity: 4,
    partSize: 'large',
    quality: 'standard',
    lineageId: 'red_dragon',
    lineageName: 'Red Dragon',
    originCreatureType: 'dragon',
    draconic: true,
  });
  assert.equal(dragonScale.quantity, 4);
  assert.equal(dragonScale.displayName, 'Large Red Dragon Scale');
  assert.equal(dragonScale.modularCoverageMaterial, true);
  assert.equal(dragonScale.canAggregateCoverage, true);
  assert.equal(dragonScale.canMergeForLargerPart, false);
  assert.equal(dragonScale.lineageValueMultiplier, 3);
  assert.equal(dragonScale.unitValueAhn, 18000);
  assert.equal(dragonScale.harvestIntegrityFamily, 'hard_cover_modular');

  const eightMediumScales = [{ itemId: 'scale', size: 'medium', quality: 'standard', quantity: 8 }];
  assert.equal(catalog.materialValue(eightMediumScales), 24000);
  assert.equal(catalog.craftBaseValue(eightMediumScales), 30000);
  assert.equal(catalog.retailValue(eightMediumScales), 37500);

  const mixedSizes = [
    { itemId: 'scale', size: 'small', quality: 'standard', quantity: 4 },
    { itemId: 'scale', size: 'medium', quality: 'standard', quantity: 2 },
  ];
  assert.equal(catalog.materialValue(mixedSizes), 12000);
  assert.equal(catalog.craftBaseValue(mixedSizes), 15000);

  console.log('Scale/Shell/Chitin catalog smoke: OK (7 materials + anatomical yield + recalibrated craft value)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});