const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemQualityEngine;
  delete globalThis.LuminousItemSizeLineageEngine;
  delete globalThis.LuminousEssenceCoreCatalog;

  await import(pathToFileURL(path.resolve(__dirname, '../js/item-quality-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-size-lineage-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-essence-core.js')).href);

  const catalog = globalThis.LuminousEssenceCoreCatalog;
  assert.ok(catalog);
  assert.equal(catalog.VERSION, 1);
  assert.equal(catalog.FAMILY, 'essence_core');
  assert.equal(catalog.ITEMS.length, 8);

  assert.equal(catalog.list({ form: 'essence' }).length, 6);
  assert.equal(catalog.list({ form: 'core' }).length, 2);

  assert.equal(catalog.get('elemental_essence').standardUnitValueAhn, 30000);
  assert.equal(catalog.get('arcane_essence').standardUnitValueAhn, 36000);
  assert.equal(catalog.get('necrotic_essence').standardUnitValueAhn, 42000);
  assert.equal(catalog.get('spirit_essence').standardUnitValueAhn, 45000);
  assert.equal(catalog.get('radiant_essence').standardUnitValueAhn, 48000);
  assert.equal(catalog.get('psionic_essence').standardUnitValueAhn, 54000);
  assert.equal(catalog.get('mana_energy_core').standardMediumValueAhn, 225000);
  assert.equal(catalog.get('exotic_core').standardMediumValueAhn, 450000);

  assert.equal(catalog.unitValueForQuality('arcane_essence', 'fine'), 54000);
  assert.equal(catalog.potencyMultiplierForQuality('exceptional'), 1.5);
  assert.equal(catalog.unitValueForQuality('mana_energy_core', 'standard', { partSize: 'large' }), 450000);
  assert.equal(catalog.unitValueForQuality('exotic_core', 'exceptional', { partSize: 'large' }), 1800000);

  for (const entry of catalog.ITEMS) {
    assert.equal(entry.requiresDeclaredSourceProfile, true);
    assert.equal(entry.universalYieldFallback, null);
  }

  const emptyProfile = catalog.createSourceProfile({ id: 'wolf', lineageName: 'Wolf' });
  assert.equal(catalog.declaredEssenceMaxEU(emptyProfile, 'arcane_essence'), null);
  assert.equal(catalog.declaredCoreMaxCount(emptyProfile, 'mana_energy_core'), null);
  assert.equal(catalog.createHarvestStack('arcane_essence', { sourceProfile: emptyProfile, essenceUnits: 3 }), null);
  assert.equal(catalog.createHarvestStack('mana_energy_core', { sourceProfile: emptyProfile, quantity: 1 }), null);

  const source = catalog.createSourceProfile({
    id: 'arcane_beast',
    lineageId: 'arcane_beast',
    lineageName: 'Arcane Beast',
    essence: {
      arcane_essence: { maxEU: 3 },
      elemental_essence: 1,
    },
    cores: {
      central_core: { itemId: 'mana_energy_core', maxCount: 1, partSize: 'large' },
    },
  });

  assert.equal(catalog.declaredEssenceMaxEU(source, 'arcane_essence'), 3);
  assert.equal(catalog.declaredCoreMaxCount(source, 'mana_energy_core'), 1);

  const essence = catalog.createHarvestStack('arcane_essence', {
    sourceProfile: source,
    essenceUnits: 5,
    recoverableMaxEU: 2,
    quality: 'exceptional',
  });
  assert.equal(essence.essenceUnits, 2);
  assert.equal(essence.unitValueAhn, 72000);
  assert.equal(essence.totalValueAhn, 144000);
  assert.equal(essence.potencyMultiplier, 1.5);

  const core = catalog.createHarvestStack('mana_energy_core', {
    sourceProfile: source,
    anatomicalIdentity: 'central_core',
    quantity: 2,
    quality: 'fine',
  });
  assert.equal(core.quantity, 1);
  assert.equal(core.partSize, 'large');
  assert.equal(core.unitValueAhn, 675000);
  assert.equal(core.totalValueAhn, 675000);

  console.log('Essence/Core catalog smoke: OK (8 materials, expensive magic economy, declared-source-only yield)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
