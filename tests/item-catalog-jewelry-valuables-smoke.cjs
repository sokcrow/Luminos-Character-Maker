const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemQualityEngine;
  delete globalThis.LuminousItemSizeLineageEngine;
  delete globalThis.LuminousOreIngotGemCatalog;
  delete globalThis.LuminousJewelryValuableCatalog;

  await import(pathToFileURL(path.resolve(__dirname, '../js/item-quality-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-size-lineage-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-ore-ingot-gem.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-jewelry-valuables.js')).href);

  const catalog = globalThis.LuminousJewelryValuableCatalog;
  assert.ok(catalog);
  assert.equal(catalog.VERSION, 3);
  assert.equal(catalog.CURRENCY, 'AHN');
  assert.equal(catalog.JEWELRY_CHASSIS.length, 15);
  assert.equal(catalog.VALUABLE_CHASSIS.length, 2);
  assert.equal(catalog.CHASSIS.length, 17);
  assert.equal(new Set(catalog.CHASSIS.map((entry) => entry.id)).size, 17);

  assert.equal(catalog.get('ring').itemType, 'accessory');
  assert.equal(catalog.get('ring').iconFamily, 'accessory');
  assert.equal(catalog.get('gold_relic').itemType, 'valuable');
  assert.equal(catalog.get('gold_relic').iconFamily, 'valuable');
  assert.equal(catalog.get('gold_relic').lootOnly, true);
  assert.equal(catalog.get('gold_relic').craftable, false);
  assert.equal(catalog.get('gold_relic').retailAvailable, false);
  assert.equal(catalog.get('gem_inlaid_relic').lootOnly, true);
  assert.equal(catalog.get('ornamental_goblet'), null);
  assert.equal(catalog.get('reliquary'), null);
  assert.equal(catalog.get('circlet'), null);
  assert.equal(catalog.get('tiara'), null);
  assert.equal(catalog.get('crown'), null);
  assert.equal(catalog.get('band').id, 'plain_band');
  assert.equal(catalog.get('relic').id, 'gold_relic');
  assert.equal(catalog.get('jeweled_relic').id, 'gem_inlaid_relic');

  const necklace = catalog.create('necklace', {
    metalId: 'gold',
    gems: [
      { id:'diamond', quantity:1 },
      { id:'ruby', quantity:6 },
    ],
  });
  assert.equal(necklace.valid, true);
  assert.equal(necklace.itemType, 'accessory');
  assert.equal(necklace.equipmentKind, 'accessory');
  assert.equal(necklace.stackable, false);
  assert.equal(necklace.metalId, 'gold');
  assert.equal(necklace.metalUnits, 0.45);
  assert.equal(necklace.metalInputValueAhn, 162000);
  assert.equal(necklace.gemCount, 7);
  assert.equal(necklace.gemstoneInputValueAhn, 2010000);
  assert.equal(necklace.consumedInputValueAhn, 2172000);
  assert.equal(necklace.standardProductionValueAhn, 3258000);
  assert.equal(necklace.productionValueAhn, 3258000);
  assert.equal(necklace.enchanted, false);
  assert.equal(necklace.enchantmentValueAhn, 0);
  assert.equal(necklace.gemResonanceWeights.fire, 6);
  assert.equal(necklace.gemResonanceWeights.heat, 6);
  assert.equal(necklace.gemResonanceWeights.light, 1);
  assert.equal(necklace.gemResonanceWeights.force, 1);
  assert.deepEqual(necklace.dominantResonanceTags.sort(), ['fire','heat']);
  assert.match(necklace.displayName, /Gold Necklace/);
  assert.match(necklace.displayName, /Diamond ×1/);
  assert.match(necklace.displayName, /Ruby ×6/);

  const fine = catalog.create('ring', {
    metalId:'silver',
    gems:[{ id:'ruby', quantity:1 }],
    quality:'fine',
  });
  assert.equal(fine.valid, true);
  assert.equal(fine.standardProductionValueAhn, 342630);
  assert.equal(fine.productionValueAhn, 513945);

  const plain = catalog.create('plain_band', { metalId:'copper' });
  assert.equal(plain.valid, true);
  assert.equal(plain.gemCount, 0);
  assert.equal(plain.standardProductionValueAhn, 6480);
  assert.deepEqual(plain.dominantResonanceTags, []);

  const tooMany = catalog.create('ring', {
    metalId:'gold',
    gems:[{ id:'ruby', quantity:6 }],
  });
  assert.equal(tooMany.valid, false);
  assert.equal(tooMany.reason, 'gem_capacity_exceeded');

  const roughRejected = catalog.create('pendant', {
    metalId:'gold',
    gems:[{ id:'rough_ruby', quantity:1 }],
  });
  assert.equal(roughRejected.valid, false);
  assert.equal(roughRejected.reason, 'invalid_cut_gem');

  const rawMetalRejected = catalog.create('bracelet', { metalId:'gold_ore' });
  assert.equal(rawMetalRejected.valid, false);
  assert.equal(rawMetalRejected.reason, 'invalid_jewelry_metal');

  const lootOnlyRejected = catalog.create('gold_relic', {});
  assert.equal(lootOnlyRejected.valid, false);
  assert.equal(lootOnlyRejected.reason, 'loot_only_chassis');

  const goldRelic = catalog.create('gold_relic', {
    origin:'location_loot',
  });
  assert.equal(goldRelic.valid, true);
  assert.equal(goldRelic.lootOnly, true);
  assert.equal(goldRelic.craftable, false);
  assert.equal(goldRelic.retailAvailable, false);
  assert.equal(goldRelic.origin, 'location_loot');
  assert.equal(goldRelic.metalId, 'gold');
  assert.equal(goldRelic.gemCount, 0);
  assert.equal(goldRelic.relicValueTier, 1);
  assert.equal(goldRelic.displayName, 'Gold Relic');

  const gemRelic = catalog.create('gem_inlaid_relic', {
    origin:'treasure',
    gems:[{id:'diamond',quantity:99}],
  });
  assert.equal(gemRelic.valid, true);
  assert.equal(gemRelic.metalId, 'gold');
  assert.equal(gemRelic.gemCount, 0);
  assert.equal(gemRelic.relicValueTier, 2);
  assert.ok(gemRelic.productionValueAhn > goldRelic.productionValueAhn);
  assert.equal(gemRelic.displayName, 'Gem-Inlaid Relic');

  console.log(`Jewelry/Valuables catalog smoke: OK (${catalog.CHASSIS.length} generative chassis)`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
