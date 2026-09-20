const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemQualityEngine;
  delete globalThis.LuminousItemSizeLineageEngine;
  delete globalThis.LuminousOrganGlandCatalog;
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-quality-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-size-lineage-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-organ-gland.js')).href);
  const catalog = globalThis.LuminousOrganGlandCatalog;

  assert.ok(catalog);
  assert.equal(catalog.VERSION, 1);
  assert.equal(catalog.FAMILY, 'organ_gland');
  assert.equal(catalog.ITEMS.length, 10);

  assert.equal(catalog.get('heart').standardMediumValueAhn, 35000);
  assert.equal(catalog.get('brain').standardMediumValueAhn, 45000);
  assert.equal(catalog.get('exotic_organ').standardMediumValueAhn, 75000);
  assert.equal(catalog.get('heart').iconFamily, 'organ_internal');
  assert.equal(catalog.get('eye').iconFamily, 'organ_sensory');
  assert.equal(catalog.get('brain').iconFamily, 'organ_brain');
  assert.equal(catalog.get('gland').iconFamily, 'organ_gland');

  assert.equal(catalog.unitValueForQuality('heart', 'fine', { partSize: 'large' }), 105000);
  assert.deepEqual(catalog.medicalValueRangeForQuality('heart', 'fine', { partSize: 'large' }), { minAhn: 1800000, maxAhn: 1800000 });
  assert.equal(catalog.medicalValueRangeForQuality('brain', 'standard'), null);
  assert.deepEqual(catalog.medicalValueRangeForQuality('gland', 'standard'), { minAhn: 100000, maxAhn: 400000 });
  assert.deepEqual(catalog.medicalValueRangeForQuality('exotic_organ', 'standard'), { minAhn: 500000, maxAhn: null });

  const humanoid = catalog.createAnatomyProfile({
    id: 'human',
    lineageName: 'Human',
    creatureSize: 'medium',
    parts: {
      heart: { maxCount: 1, partSize: 'medium', transplantable: true },
      liver: { maxCount: 1, partSize: 'medium', transplantable: true },
      kidney: { maxCount: 2, partSize: 'small', transplantable: true },
      lung: { maxCount: 2, partSize: 'medium', transplantable: true },
      brain: { maxCount: 1, partSize: 'medium' },
      eye: { maxCount: 2, partSize: 'small', transplantable: true },
      stomach: { maxCount: 1, partSize: 'medium', transplantable: true },
      venom_gland: { itemId: 'gland', maxCount: 2, partSize: 'small' },
    },
  });

  assert.equal(catalog.maxYieldFor(humanoid, 'heart'), 1);
  assert.equal(catalog.maxYieldFor(humanoid, 'kidney'), 2);
  assert.equal(catalog.maxYieldFor(humanoid, 'gland', { anatomicalIdentity: 'venom_gland' }), 2);
  assert.equal(catalog.maxYieldFor(null, 'heart'), null, 'organs have no generic count fallback');

  const kidneys = catalog.createHarvestPart('kidney', {
    anatomyProfile: humanoid,
    anatomicalIdentity: 'kidney',
    quantity: 3,
    quality: 'fine',
    lineageId: 'human',
    lineageName: 'Human',
    originCreatureType: 'humanoid',
  });
  assert.equal(kidneys.quantity, 2, 'harvest cannot exceed anatomical count');
  assert.equal(kidneys.partSize, 'small');
  assert.equal(kidneys.displayName, 'Small Human Kidney');
  assert.equal(kidneys.transplantableByAnatomy, true);

  const oneEyeLeft = catalog.createHarvestPart('eye', {
    anatomyProfile: humanoid,
    anatomicalIdentity: 'eye',
    quantity: 2,
    integrityRecoverableMax: 1,
    lineageId: 'human',
    lineageName: 'Human',
  });
  assert.equal(oneEyeLeft.quantity, 1, 'combat integrity caps surviving organs before Harvest quality');

  const gland = catalog.createHarvestPart('gland', {
    anatomyProfile: humanoid,
    anatomicalIdentity: 'venom_gland',
    anatomicalLabel: 'Venom Gland',
    quantity: 2,
    lineageId: 'test_serpent',
    lineageName: 'Test Serpent',
  });
  assert.equal(gland.quantity, 2);
  assert.equal(gland.displayName, 'Small Test Serpent Venom Gland');

  console.log('Organ/Gland catalog smoke: OK (10 bases, anatomy counts, integrity caps, transplant metadata)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
