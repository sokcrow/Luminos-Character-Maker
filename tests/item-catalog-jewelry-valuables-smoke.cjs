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
  assert.equal(catalog.VERSION, 4);
  assert.equal(catalog.CURRENCY, 'AHN');
  assert.equal(catalog.JEWELRY_CHASSIS.length, 8);
  assert.equal(catalog.VALUABLE_CHASSIS.length, 8);
  assert.equal(catalog.CHASSIS.length, 16);
  assert.equal(new Set(catalog.CHASSIS.map((entry) => entry.id)).size, 16);

  assert.equal(catalog.get('ring').itemType, 'accessory');
  assert.equal(catalog.get('earring').id, 'earrings');
  assert.equal(catalog.get('hair_pin').id, 'hairpin');
  for (const removed of ['plain_band','signet_ring','medallion','choker','bangle','cuff_bracelet','cufflinks']) {
    assert.equal(catalog.get(removed), null, removed);
  }
  assert.equal(catalog.get('goblet').itemType, 'valuable');
  assert.equal(catalog.get('goblet').lootOnly, true);
  assert.equal(catalog.get('decorative_box').lootOnly, true);
  assert.equal(catalog.get('reliquary').lootOnly, true);

  const necklace = catalog.create('necklace', {
    metalId: 'gold',
    gems: [
      { id:'diamond', quantity:1 },
      { id:'ruby', quantity:6 },
    ],
  });
  assert.equal(necklace.valid, true);
  assert.equal(necklace.itemType, 'accessory');
  assert.equal(necklace.iconVisualVariant, 'gold');
  assert.equal(necklace.iconFamily, 'jewelry_necklace_gold');
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
  assert.equal(fine.iconVisualVariant, 'silver');
  assert.equal(fine.iconFamily, 'jewelry_ring_silver');
  assert.equal(fine.standardProductionValueAhn, 342630);
  assert.equal(fine.productionValueAhn, 513945);

  const copperRing = catalog.create('ring', { metalId:'copper' });
  assert.equal(copperRing.valid, true);
  assert.equal(copperRing.iconVisualVariant, 'copper');
  assert.equal(copperRing.iconFamily, 'jewelry_ring_copper');
  assert.equal(copperRing.gemCount, 0);
  assert.deepEqual(copperRing.dominantResonanceTags, []);

  const ironRing = catalog.create('ring', { metalId:'iron' });
  assert.equal(ironRing.valid, true);
  assert.equal(ironRing.iconVisualVariant, 'metal');
  assert.equal(ironRing.iconFamily, 'jewelry_ring_metal');

  const platinumRing = catalog.create('ring', { metalId:'platinum' });
  assert.equal(platinumRing.valid, true);
  assert.equal(platinumRing.iconVisualVariant, 'silver');
  assert.equal(platinumRing.iconFamily, 'jewelry_ring_silver');

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

  const lootOnlyRejected = catalog.create('goblet', {});
  assert.equal(lootOnlyRejected.valid, false);
  assert.equal(lootOnlyRejected.reason, 'loot_only_chassis');

  const goldGoblet = catalog.create('goblet', { origin:'location_loot', variant:'gold' });
  assert.equal(goldGoblet.valid, true);
  assert.equal(goldGoblet.iconFamily, 'valuable_goblet_gold');
  assert.equal(goldGoblet.productionValueAhn, 420000);

  const gemGoblet = catalog.create('goblet', { origin:'treasure', variant:'gems' });
  assert.equal(gemGoblet.valid, true);
  assert.equal(gemGoblet.iconFamily, 'valuable_goblet_gems');
  assert.equal(gemGoblet.productionValueAhn, 780000);
  assert.ok(gemGoblet.productionValueAhn > goldGoblet.productionValueAhn);

  const gemScepter = catalog.create('scepter', { origin:'world_loot', variant:'gems' });
  assert.equal(gemScepter.valid, true);
  assert.equal(gemScepter.productionValueAhn, 2200000);

  console.log(`Jewelry/Valuables catalog smoke: OK (${catalog.CHASSIS.length} generative chassis)`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
