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
  assert.equal(catalog.ITEMS.length, 9);

  const mediumPrices = {
    hide_mammal: 1600,
    pelt_fur: 1900,
    hide_humanoid: 2000,
    hide_avian: 1200,
    hide_reptilian: 2200,
    skin_amphibian: 1400,
    skin_fish: 1000,
    hide_draconic: 5000,
    hide_exotic: 3200,
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

  assert.equal(catalog.priceForSizeAndQuality('hide_mammal', 'tiny', 'standard'), 400);
  assert.equal(catalog.priceForSizeAndQuality('hide_mammal', 'small', 'standard'), 800);
  assert.equal(catalog.priceForSizeAndQuality('hide_mammal', 'large', 'standard'), 3200);
  assert.equal(catalog.priceForSizeAndQuality('hide_mammal', 'huge', 'standard'), 6400);
  assert.equal(catalog.priceForSizeAndQuality('hide_mammal', 'gargantuan', 'standard'), 12800);
  assert.equal(catalog.priceForSizeAndQuality('hide_mammal', 'huge', 'fine'), 9600);
  assert.equal(catalog.priceForSizeAndQuality('hide_draconic', 'huge', 'exceptional'), 40000);

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
  assert.equal(bunny.unitValueAhn, 1425);

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
  assert.equal(elephant.unitValueAhn, 9600);

  assert.equal(catalog.recipeUnits('leather_armor', 'medium'), 4);
  assert.equal(catalog.recipeUnits('reinforced_studded_leather', 'medium'), 6);
  assert.equal(catalog.recipeUnits('hide_armor', 'medium'), 8);
  assert.equal(catalog.recipeUnits('leather_armor', 'large'), 8);
  assert.equal(catalog.recipeUnits('leather_armor', 'tiny'), 1);

  console.log('Hide/Pelt catalog smoke: OK (9 materials, 6 sizes)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
