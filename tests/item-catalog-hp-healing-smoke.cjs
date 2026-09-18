const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousHpHealingCatalog;
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-hp-healing.js')).href);
  const catalog = globalThis.LuminousHpHealingCatalog;

  assert.ok(catalog);
  assert.equal(catalog.VERSION, 1);
  assert.equal(catalog.FAMILY, 'healing_hp');
  assert.equal(catalog.CURRENCY, 'AHN');
  assert.deepEqual(catalog.SOURCE_CAPS, { generic: 30, workshop: 60, k_corp: 100 });

  const validation = catalog.validateCatalog();
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  assert.equal(validation.count, 60);
  assert.equal(new Set(catalog.ITEMS.map((item) => item.id)).size, 60);

  for (const sourceLine of ['generic', 'workshop', 'k_corp']) {
    const line = catalog.list({ sourceLine });
    assert.equal(line.length, 20, `${sourceLine} should contain 20 items`);
    for (const tier of catalog.TIERS) {
      assert.equal(
        line.filter((item) => item.tier === tier).length,
        4,
        `${sourceLine} tier ${tier} should contain 4 items`
      );
    }
  }

  for (const item of catalog.ITEMS) {
    assert.equal(item.purchasable, true);
    assert.equal(item.currency, 'AHN');
    assert.ok(Number.isInteger(item.priceAhn) && item.priceAhn > 0);
    assert.equal(item.family, 'healing_hp');
    assert.equal(item.iconFamily, 'healing_hp');
    assert.equal(item.category, 'consumable');
    assert.ok(catalog.USE_TIMINGS.includes(item.runtime.actionCost));
    assert.ok(item.runtime.healing.capMaxHpPercent <= catalog.SOURCE_CAPS[item.sourceLine]);
  }

  const genericAt200 = catalog.healingBreakdown('hp_generic_executive_recovery_case', 200);
  assert.equal(genericAt200.total, 58);
  assert.equal(genericAt200.cap, 60);

  const genericAt20 = catalog.healingBreakdown('hp_generic_executive_recovery_case', 20);
  assert.equal(genericAt20.total, 6, 'generic healing must respect the 30% cap at low max HP');

  const workshopAt200 = catalog.healingBreakdown('hp_workshop_workshop_phoenix_cell', 200);
  assert.equal(workshopAt200.total, 120);
  assert.equal(workshopAt200.capPercent, 60);

  const kCorpAt200 = catalog.healingBreakdown('hp_k_corp_k_corp_full_restoration_ampule', 200);
  assert.equal(kCorpAt200.total, 200);
  assert.equal(kCorpAt200.capPercent, 100);

  const regen = catalog.healingBreakdown('hp_generic_slowburn_strip', 200);
  assert.equal(regen.immediate, 5);
  assert.equal(regen.regen, 6);
  assert.equal(regen.total, 11);
  assert.equal(regen.turnsApplied, 2);

  const regenOneTurn = catalog.healingBreakdown('hp_generic_slowburn_strip', 200, { regenTurns: 1 });
  assert.equal(regenOneTurn.total, 8);

  const offCombat = catalog.get('hp_generic_civilian_recovery_pack');
  assert.equal(catalog.canUse(offCombat, { inCombat: true }).allowed, false);
  assert.equal(catalog.canUse(offCombat, { inCombat: false }).allowed, true);

  const workshopCleanse = catalog.get('hp_workshop_restoration_frame');
  assert.deepEqual(workshopCleanse.runtime.healing.extra, { removePhysicalDot: 1 });

  const kCorpPack = catalog.get('hp_k_corp_k_corp_restoration_pack');
  assert.equal(kCorpPack.runtime.healing.capMaxHpPercent, 85);
  assert.deepEqual(kCorpPack.runtime.healing.extra, { removePhysicalDot: 2 });

  console.log('HP healing catalog smoke: OK (60 items, Generic/Workshop/K Corp)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
