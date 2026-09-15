const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemQualityEngine;
  delete globalThis.LuminousItemSizeLineageEngine;
  delete globalThis.LuminousVenomSecretionCatalog;

  await import(pathToFileURL(path.resolve(__dirname, '../js/item-quality-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-size-lineage-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-venom-secretion.js')).href);

  const catalog = globalThis.LuminousVenomSecretionCatalog;
  assert.ok(catalog);
  assert.equal(catalog.VERSION, 1);
  assert.equal(catalog.FAMILY, 'venom_secretion');
  assert.equal(catalog.ITEMS.length, 7);

  const prices = {
    venom: 3000,
    toxic_secretion: 2500,
    acid_secretion: 2000,
    ink_secretion: 800,
    pheromone_scent: 1200,
    defensive_secretion: 1500,
    exotic_secretion: 5000,
  };

  for (const [id, price] of Object.entries(prices)) {
    const item = catalog.get(id);
    assert.ok(item, id);
    assert.equal(item.standardUnitValueAhn, price);
    assert.equal(item.measure, 'secretion_unit');
    assert.equal(item.rawCraftingReagent, true);
    assert.equal(item.harvestIntegrityFamily, 'venom_secretion');
  }

  assert.equal(catalog.get('venom').iconFamily, 'venom_raw');
  assert.equal(catalog.get('toxic_secretion').iconFamily, 'venom_raw');
  assert.equal(catalog.get('acid_secretion').iconFamily, 'acid_secretion');
  assert.equal(catalog.get('ink_secretion').iconFamily, 'ink_secretion');
  assert.equal(catalog.get('pheromone_scent').iconFamily, 'bio_secretion');
  assert.equal(catalog.list({ reagentTag: 'toxin_reagent' }).length, 2);
  assert.equal(catalog.list({ reagentTag: 'corrosive_reagent' }).length, 1);

  assert.equal(catalog.fallbackCapacitySU('tiny'), 1);
  assert.equal(catalog.fallbackCapacitySU('small'), 2);
  assert.equal(catalog.fallbackCapacitySU('medium'), 4);
  assert.equal(catalog.fallbackCapacitySU('large'), 8);
  assert.equal(catalog.fallbackCapacitySU('huge'), 16);
  assert.equal(catalog.fallbackCapacitySU('gargantuan'), 32);

  assert.equal(catalog.unitValueForQuality('venom', 'ruined'), 750);
  assert.equal(catalog.unitValueForQuality('venom', 'poor'), 1500);
  assert.equal(catalog.unitValueForQuality('venom', 'fine'), 4500);
  assert.equal(catalog.unitValueForQuality('venom', 'exceptional'), 6000);
  assert.equal(catalog.potencyMultiplierForQuality('ruined'), 0.5);
  assert.equal(catalog.potencyMultiplierForQuality('fine'), 1.25);
  assert.equal(catalog.potencyMultiplierForQuality('exceptional'), 1.5);

  const serpent = catalog.createProducerProfile({
    id: 'test_serpent',
    lineageId: 'test_serpent',
    lineageName: 'Test Serpent',
    creatureSize: 'medium',
    secretionItemId: 'venom',
    producerOrganItemId: 'gland',
    producerAnatomicalIdentity: 'venom_gland',
    producerPartSize: 'small',
    renewable: true,
    collectionAction: 'milk_venom',
    collectionLimitSU: 1,
    regrowthPerDay: 0.5,
  });

  assert.equal(catalog.capacityForProducer(serpent), 2, 'producer Part Size controls fallback capacity');
  const fullPool = catalog.createSecretionPool(serpent);
  assert.equal(fullPool.capacitySU, 2);
  assert.equal(fullPool.currentStoredSU, 2);
  assert.equal(fullPool.recoverableSU, 2);

  const leaked = catalog.applyLeak(fullPool, 0.75, { contaminatedSU: 0.25 });
  assert.equal(leaked.currentStoredSU, 1.25);
  assert.equal(leaked.recoverableSU, 1);

  const venom = catalog.createHarvestStack('venom', {
    producerProfile: serpent,
    pool: leaked,
    secretionUnits: 2,
    quality: 'fine',
    lineageId: 'test_serpent',
    lineageName: 'Test Serpent',
    specialProperties: ['neurotoxic'],
  });
  assert.equal(venom.secretionUnits, 1, 'Harvest cannot recreate leaked/contaminated secretion');
  assert.equal(venom.displayName, 'Test Serpent Venom');
  assert.equal(venom.unitValueAhn, 4500);
  assert.equal(venom.totalValueAhn, 4500);
  assert.equal(venom.potencyMultiplier, 1.25);
  assert.ok(venom.reagentTags.includes('toxin_reagent'));
  assert.ok(venom.specialProperties.includes('neurotoxic'));
  assert.deepEqual(venom.sourceGland, {
    organItemId: 'gland',
    anatomicalIdentity: 'venom_gland',
    partSize: 'small',
  });

  const draw = catalog.collectRenewable(serpent, fullPool, 2);
  assert.equal(draw.collected, 1, 'living extraction obeys the profile collection limit');
  assert.equal(draw.action, 'milk_venom');
  assert.equal(draw.nextPool.currentStoredSU, 1);
  const regrown = catalog.regrowSecretion(draw.nextPool, 2);
  assert.equal(regrown.currentStoredSU, 2);
  assert.equal(regrown.recoverableSU, 2);

  const acidBeast = catalog.createProducerProfile({
    id: 'acid_beast',
    lineageName: 'Acid Beast',
    secretionItemId: 'acid_secretion',
    producerOrganItemId: 'sac_bladder',
    producerAnatomicalIdentity: 'acid_sac',
    producerPartSize: 'large',
    capacitySU: 12,
  });
  assert.equal(catalog.capacityForProducer(acidBeast), 12, 'explicit Anatomy/Profile capacity overrides fallback');
  const acidPool = catalog.createSecretionPool(acidBeast);
  assert.equal(acidPool.capacitySU, 12);
  assert.equal(catalog.collectRenewable(acidBeast, acidPool, 1), null, 'renewable extraction is profile opt-in');

  console.log('Venom/Secretion catalog smoke: OK (7 bases, SU reservoir pools, leakage, renewable collection, crafting reagent tags)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
