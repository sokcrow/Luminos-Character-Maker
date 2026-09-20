const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemQualityEngine;
  delete globalThis.LuminousItemSizeLineageEngine;
  delete globalThis.LuminousBloodIchorCatalog;
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-quality-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-size-lineage-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-blood-ichor.js')).href);
  const catalog = globalThis.LuminousBloodIchorCatalog;

  assert.ok(catalog);
  assert.equal(catalog.VERSION, 1);
  assert.equal(catalog.FAMILY, 'blood_ichor');
  assert.equal(catalog.ITEMS.length, 6);

  assert.equal(catalog.get('blood').standardUnitValueAhn, 12500);
  assert.equal(catalog.get('humanoid_blood').standardUnitValueAhn, 4000);
  assert.equal(catalog.get('hemolymph').standardUnitValueAhn, 3500);
  assert.equal(catalog.get('ichor').standardUnitValueAhn, 7500);
  assert.equal(catalog.get('draconic_blood').standardUnitValueAhn, 2500);
  assert.equal(catalog.get('exotic_blood_fluid').standardUnitValueAhn, 15000);

  assert.equal(catalog.fallbackBloodUnits('tiny'), 2);
  assert.equal(catalog.fallbackBloodUnits('medium'), 8);
  assert.equal(catalog.fallbackBloodUnits('gargantuan'), 64);
  assert.equal(catalog.unitValueForQuality('humanoid_blood', 'fine'), 6000);

  const human = catalog.createPhysiologyProfile({
    id: 'human',
    lineageName: 'Human',
    creatureSize: 'medium',
    fluidItemId: 'humanoid_blood',
    renewableDraw: true,
    safeDrawMaxBU: 1,
    regrowthPerDay: 0.5,
  });
  assert.equal(catalog.maxBloodUnitsFor(human), 8);

  const fullPool = catalog.createBloodPool(human);
  assert.equal(fullPool.maxBloodUnits, 8);
  assert.equal(fullPool.currentBloodUnits, 8);
  assert.equal(fullPool.recoverableBloodUnits, 8);

  const afterBleed = catalog.applyBloodLoss(fullPool, 3);
  assert.equal(afterBleed.currentBloodUnits, 5);
  assert.equal(afterBleed.recoverableBloodUnits, 5);

  const contaminated = catalog.contaminateBlood(afterBleed, 2);
  assert.equal(contaminated.currentBloodUnits, 5);
  assert.equal(contaminated.recoverableBloodUnits, 3);

  const corpseStack = catalog.createHarvestStack('humanoid_blood', {
    pool: contaminated,
    bloodUnits: 6,
    quality: 'fine',
    lineageId: 'human',
    lineageName: 'Human',
    originCreatureType: 'humanoid',
  });
  assert.equal(corpseStack.bloodUnits, 3, 'Harvest cannot recover lost or contaminated blood');
  assert.equal(corpseStack.unitValueAhn, 6000);
  assert.equal(corpseStack.totalValueAhn, 18000);
  assert.equal(corpseStack.displayName, 'Human Blood');

  const freshStack = catalog.createHarvestStack('humanoid_blood', {
    pool: fullPool,
    bloodUnits: 6,
    quality: 'fine',
    lineageId: 'human',
    lineageName: 'Human',
  });
  assert.equal(freshStack.totalValueAhn, 36000);

  const largeRich = catalog.createPhysiologyProfile({
    id: 'rich_blooded_beast',
    lineageName: 'Rich-Blooded Beast',
    creatureSize: 'large',
    fluidItemId: 'blood',
    bloodPoolModifier: 1.5,
  });
  assert.equal(catalog.maxBloodUnitsFor(largeRich), 24);

  const draw = catalog.drawBlood(human, fullPool, 4);
  assert.equal(draw.drawn, 1, 'nonlethal draw obeys the profile safe limit');
  assert.equal(draw.nextPool.currentBloodUnits, 7);
  const regrown = catalog.regrowBlood(draw.nextPool, 2);
  assert.equal(regrown.currentBloodUnits, 8);

  console.log('Blood/Ichor catalog smoke: OK (6 bases, BU pools, blood loss, contamination, safe draw)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
