const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemQualityEngine;
  delete globalThis.LuminousItemSizeLineageEngine;
  delete globalThis.LuminousHidePeltCatalog;

  await import(pathToFileURL(path.resolve(__dirname, '../js/item-quality-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-size-lineage-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-hide-pelt.js')).href);

  const catalog = globalThis.LuminousHidePeltCatalog;
  assert.ok(catalog);
  assert.equal(catalog.VERSION, 1);
  assert.equal(catalog.FAMILY, 'hide_pelt');
  assert.equal(catalog.AHN_ECONOMY_SCALE, 10);
  assert.equal(catalog.ITEMS.length, 9);

  const mediumPrices = {
    hide_mammal: 16000,
    pelt_fur: 19000,
    hide_humanoid: 20000,
    hide_avian: 12000,
    hide_reptilian: 22000,
    skin_amphibian: 14000,
    skin_fish: 10000,
    hide_draconic: 50000,
    hide_exotic: 32000,
  };

  for (const [id, price] of Object.entries(mediumPrices)) {
    const item = catalog.get(id);
    assert.ok(item, id);
    assert.equal(item.mediumStandardValueAhn, price);
    assert.equal(item.qualitySystem, 'universal');
    assert.equal(item.sizeSystem, 'universal_physical');
    assert.equal(item.currency, 'AHN');
    assert.equal(catalog.priceForSizeAndQuality(id, 'medium', 'standard'), price);
  }

  assert.equal(catalog.priceForSizeAndQuality('hide_mammal', 'tiny', 'standard'), 4000);
  assert.equal(catalog.priceForSizeAndQuality('hide_mammal', 'small', 'standard'), 8000);
  assert.equal(catalog.priceForSizeAndQuality('hide_mammal', 'large', 'standard'), 32000);
  assert.equal(catalog.priceForSizeAndQuality('hide_mammal', 'huge', 'standard'), 64000);
  assert.equal(catalog.priceForSizeAndQuality('hide_mammal', 'gargantuan', 'standard'), 128000);
  assert.equal(catalog.priceForSizeAndQuality('hide_mammal', 'huge', 'fine'), 96000);
  assert.equal(catalog.priceForSizeAndQuality('hide_draconic', 'huge', 'exceptional'), 400000);

  const bunny = catalog.createHarvestStack('pelt_fur', {
    size: 'small',
    quality: 'fine',
    lineageId: 'bunny',
    lineageName: 'Bunny',
    originCreatureType: 'beast',
    originCreatureId: 'rabbit',
  });
  assert.equal(bunny.size, 'small');
  assert.equal(bunny.hideUnits, 2);
  assert.equal(bunny.remainingUnits, 2);
  assert.equal(bunny.quality, 'fine');
  assert.equal(bunny.lineageId, 'bunny');
  assert.equal(bunny.materialName, 'Bunny Pelt');
  assert.equal(bunny.displayName, 'Small Bunny Pelt');
  assert.equal(bunny.unitValueAhn, 14250);

  const elephant = catalog.createHarvestStack('hide_mammal', {
    size: 'huge',
    quality: 'fine',
    lineageId: 'elephant',
    lineageName: 'Elephant',
    originCreatureId: 'elephant',
  });
  assert.equal(elephant.hideUnits, 16);
  assert.equal(elephant.remainingUnits, 16);
  assert.equal(elephant.materialName, 'Elephant Hide');
  assert.equal(elephant.unitValueAhn, 96000);

  assert.equal(catalog.recipeUnits('leather_armor', 'medium'), 4);
  assert.equal(catalog.recipeUnits('reinforced_studded_leather', 'medium'), 6);
  assert.equal(catalog.recipeUnits('hide_armor', 'medium'), 8);
  assert.equal(catalog.recipeUnits('leather_armor', 'large'), 8);
  assert.equal(catalog.recipeUnits('leather_armor', 'tiny'), 1);

  console.log('Hide/Pelt catalog smoke: OK (9 materials, 6 sizes, Ahn recalibration)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});