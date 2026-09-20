const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemQualityEngine;
  delete globalThis.LuminousItemSizeLineageEngine;
  delete globalThis.LuminousFeatherRawFiberCatalog;

  await import(pathToFileURL(path.resolve(__dirname, '../js/item-quality-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-size-lineage-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-feather-raw-fiber.js')).href);

  const catalog = globalThis.LuminousFeatherRawFiberCatalog;
  assert.ok(catalog);
  assert.equal(catalog.VERSION, 1);
  assert.equal(catalog.FAMILY, 'feather_raw_fiber');
  assert.equal(catalog.AHN_ECONOMY_SCALE, 100);
  assert.equal(catalog.ITEMS.length, 7);

  const prices = {
    feather: 500,
    flight_feather: 2000,
    down: 2000,
    wool: 2500,
    animal_hair: 1500,
    raw_silk: 6000,
    exotic_raw_fiber: 10000,
  };

  for (const [id, price] of Object.entries(prices)) {
    const item = catalog.get(id);
    assert.ok(item, id);
    assert.equal(item.standardUnitValueAhn, price);
    assert.equal(item.qualitySystem, 'universal');
    assert.equal(item.supportsRenewableHarvest, true);
  }

  assert.equal(catalog.get('feather').iconFamily, 'feather_raw');
  assert.equal(catalog.get('wool').iconFamily, 'animal_fiber_raw');
  assert.equal(catalog.get('raw_silk').iconFamily, 'silk_raw');
  assert.equal(catalog.get('feather').measure, 'piece');
  assert.equal(catalog.get('wool').measure, 'fiber_unit');

  assert.equal(catalog.fallbackYieldMax('feather', 'tiny'), 40);
  assert.equal(catalog.fallbackYieldMax('feather', 'gargantuan'), 3000);
  assert.equal(catalog.fallbackYieldMax('flight_feather', 'medium'), 24);
  assert.equal(catalog.fallbackYieldMax('flight_feather', 'gargantuan'), 192);
  assert.equal(catalog.fallbackYieldMax('wool', 'medium'), 16);
  assert.equal(catalog.fallbackYieldMax('raw_silk', 'huge'), 64);

  assert.equal(catalog.unitValueForQuality('feather', 'standard', { partSize: 'medium' }), 500);
  assert.equal(catalog.unitValueForQuality('feather', 'fine', { partSize: 'large' }), 1500);
  assert.equal(catalog.unitValueForQuality('wool', 'fine'), 3750);
  assert.equal(catalog.unitValueForQuality('raw_silk', 'exceptional'), 12000);

  const chicken = catalog.createAnatomyProfile({
    id: 'chicken',
    lineageId: 'chicken',
    lineageName: 'Chicken',
    creatureSize: 'tiny',
    parts: {
      feather: { maxCount: 80, partSize: 'tiny', renewable: true, renewalAction: 'collect', regrowthPerDay: 4 },
      flight_feather: { maxCount: 18, partSize: 'tiny', renewable: true, renewalAction: 'pluck_collect', regrowthPerDay: 1 },
      down: { maxFiberUnits: 3, renewable: true, renewalAction: 'collect', regrowthPerDay: 0.25 },
    },
  });

  assert.equal(catalog.maxYieldFor(chicken, 'feather'), 80);
  assert.equal(catalog.maxYieldFor(chicken, 'flight_feather'), 18);
  assert.equal(catalog.maxYieldFor(chicken, 'down'), 3);
  assert.equal(catalog.recoverableYieldFor(chicken, 'feather', 80, { integrityRecoverableMax: 31 }), 31);

  const feathers = catalog.createHarvestStack('feather', {
    anatomyProfile: chicken,
    quantity: 80,
    integrityRecoverableMax: 31,
    quality: 'standard',
    lineageId: 'chicken',
    lineageName: 'Chicken',
  });
  assert.equal(feathers.quantity, 31);
  assert.equal(feathers.partSize, 'tiny');
  assert.equal(feathers.displayName, 'Tiny Chicken Feather');
  assert.equal(feathers.totalValueAhn, 3875, 'Tiny Feather is ₳125 after size scaling/rounding');
  assert.equal(feathers.renewable, true);

  const sheep = catalog.createAnatomyProfile({
    id: 'sheep',
    lineageId: 'sheep',
    lineageName: 'Sheep',
    creatureSize: 'small',
    parts: {
      wool: { maxFiberUnits: 16, renewable: true, renewalAction: 'shear', regrowthPerDay: 2 },
    },
  });

  const wool = catalog.createHarvestStack('wool', {
    anatomyProfile: sheep,
    fiberUnits: 12,
    quality: 'standard',
    lineageId: 'sheep',
    lineageName: 'Sheep',
  });
  assert.equal(wool.fiberUnits, 12);
  assert.equal(wool.displayName, 'Sheep Wool');
  assert.equal(wool.unitValueAhn, 2500);
  assert.equal(wool.totalValueAhn, 30000);

  const state = catalog.createRenewableState(sheep, 'wool');
  assert.equal(state.capacity, 16);
  assert.equal(state.current, 16);
  assert.equal(state.renewalAction, 'shear');
  const sheared = catalog.collectRenewable(state, 12);
  assert.equal(sheared.collected, 12);
  assert.equal(sheared.nextState.current, 4);
  const regrown = catalog.regrowRenewable(sheared.nextState, 3);
  assert.equal(regrown.current, 10);

  const nonRenewable = catalog.createAnatomyProfile({
    id: 'wild_fiber_source',
    lineageName: 'Wild Fiber Source',
    creatureSize: 'small',
    parts: { animal_hair: { maxFiberUnits: 8 } },
  });
  assert.equal(catalog.createRenewableState(nonRenewable, 'animal_hair'), null);

  console.log('Feather/Raw Fiber catalog smoke: OK (fragile feather yield + renewable fiber harvest + Ahn recalibration)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});