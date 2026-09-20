const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemQualityEngine;
  delete globalThis.LuminousItemSizeLineageEngine;
  delete globalThis.LuminousOozeGelCatalog;

  await import(pathToFileURL(path.resolve(__dirname, '../js/item-quality-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-size-lineage-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-ooze-gel.js')).href);

  const catalog = globalThis.LuminousOozeGelCatalog;
  assert.ok(catalog);
  assert.equal(catalog.VERSION, 1);
  assert.equal(catalog.FAMILY, 'ooze_gel');
  assert.equal(catalog.ITEMS.length, 7);

  assert.equal(catalog.get('slime').standardUnitValueAhn, 1500);
  assert.equal(catalog.get('mucus').standardUnitValueAhn, 1250);
  assert.equal(catalog.get('gel').standardUnitValueAhn, 2500);
  assert.equal(catalog.get('adhesive_ooze').standardUnitValueAhn, 4500);
  assert.equal(catalog.get('regenerative_gel').standardUnitValueAhn, 9000);
  assert.equal(catalog.get('conductive_gel').standardUnitValueAhn, 10000);
  assert.equal(catalog.get('exotic_ooze').standardUnitValueAhn, 17500);

  for (const item of catalog.ITEMS) assert.equal(item.iconFamily, 'ooze_gel');
  assert.equal(catalog.list({ materialTag: 'conductive_medium' })[0].id, 'conductive_gel');
  assert.equal(catalog.list({ materialTag: 'medical_reagent' })[0].id, 'regenerative_gel');
  assert.equal(catalog.list({ materialTag: 'adhesive' })[0].id, 'adhesive_ooze');

  assert.equal(catalog.fallbackYieldMax('tiny'), 4);
  assert.equal(catalog.fallbackYieldMax('small'), 8);
  assert.equal(catalog.fallbackYieldMax('medium'), 16);
  assert.equal(catalog.fallbackYieldMax('large'), 32);
  assert.equal(catalog.fallbackYieldMax('huge'), 64);
  assert.equal(catalog.fallbackYieldMax('gargantuan'), 128);

  const profile = catalog.createBodyProfile({
    id: 'test_slime',
    lineageId: 'test_slime',
    lineageName: 'Test Slime',
    creatureSize: 'medium',
    itemId: 'slime',
  });
  const pool = catalog.createOozePool(profile);
  assert.equal(pool.maxOU, 16);
  assert.equal(pool.currentOU, 16);
  assert.equal(pool.recoverableOU, 16);

  const damaged = catalog.applyLoss(pool, 6, { contaminatedOU: 2 });
  assert.equal(damaged.currentOU, 10);
  assert.equal(damaged.recoverableOU, 8);

  const stack = catalog.createHarvestStack('slime', {
    bodyProfile: profile,
    pool: damaged,
    oozeUnits: 12,
    quality: 'exceptional',
    lineageId: 'test_slime',
    lineageName: 'Test Slime',
  });
  assert.equal(stack.oozeUnits, 8, 'Quality must not recreate lost OU');
  assert.equal(stack.unitValueAhn, 3000);
  assert.equal(stack.totalValueAhn, 24000);
  assert.equal(stack.materialTags.includes('binder'), true);

  const renewableProfile = catalog.createBodyProfile({
    id: 'renewable_mucus',
    lineageName: 'Mucus Beast',
    creatureSize: 'small',
    itemId: 'mucus',
    renewable: true,
    collectionLimitOU: 2,
    regrowthPerDay: 1,
  });
  const renewablePool = catalog.createOozePool(renewableProfile);
  const collected = catalog.collectRenewable(renewableProfile, renewablePool, 6);
  assert.equal(collected.collected, 2);
  assert.equal(collected.nextPool.currentOU, 6);
  assert.equal(collected.nextPool.recoverableOU, 6);
  const regrown = catalog.regrow(collected.nextPool, 1);
  assert.equal(regrown.currentOU, 7);
  assert.equal(regrown.recoverableOU, 7);

  const explicitProfile = catalog.createBodyProfile({ creatureSize: 'medium', itemId: 'gel', maxOU: 3 });
  assert.equal(catalog.createOozePool(explicitProfile).maxOU, 3, 'profile maximum must override Size fallback');

  console.log('Ooze / Gel catalog smoke: OK (7 materials + OU pool + crafting tags + renewable harvest)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
