const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousSpHealingCatalog;
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-sp-healing.js')).href);
  const catalog = globalThis.LuminousSpHealingCatalog;

  assert.ok(catalog);
  assert.equal(catalog.VERSION, 1);
  assert.equal(catalog.FAMILY, 'healing_sp');
  assert.equal(catalog.CURRENCY, 'AHN');
  assert.equal(catalog.DEFAULT_MAX_SP, 45);
  assert.deepEqual(catalog.SOURCE_LIMITS, {
    generic: { quickAction: 5, combat: 6, offCombat: 10 },
    workshop: { quickAction: 7, combat: 10, offCombat: 15 },
    k_corp: { quickAction: 10, combat: 15, offCombat: 20 },
  });

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
    assert.equal(item.family, 'healing_sp');
    assert.equal(item.iconFamily, 'healing_sp');
    assert.equal(item.category, 'consumable');
    assert.ok(catalog.USE_TIMINGS.includes(item.runtime.actionCost));
    assert.equal(item.runtime.effects.spRestore, item.runtime.spHealing.immediate);

    const check = catalog.validateItem(item);
    assert.equal(check.valid, true, `${item.id}: ${JSON.stringify(check.errors)}`);
    assert.ok(check.total < 45, `${item.id} must never be a full 45 SP restore`);
    assert.ok(check.total <= check.limit, `${item.id} exceeds its source/timing limit`);
  }

  const genericCombat = catalog.restorationBreakdown('sp_generic_emergency_composure_dose', 0);
  assert.equal(genericCombat.total, 6);
  assert.equal(genericCombat.lineLimit, 6);

  const genericQuick = catalog.restorationBreakdown('sp_generic_last_line_focus_shot', 0);
  assert.equal(genericQuick.total, 5);
  assert.equal(genericQuick.lineLimit, 5);

  const genericOffCombat = catalog.restorationBreakdown('sp_generic_executive_sanity_case', 0);
  assert.equal(genericOffCombat.total, 10);
  assert.equal(genericOffCombat.lineLimit, 10);

  const workshopCombat = catalog.restorationBreakdown('sp_workshop_masterwork_composure_core', 0);
  assert.equal(workshopCombat.total, 10);
  assert.equal(workshopCombat.lineLimit, 10);

  const workshopOffCombat = catalog.restorationBreakdown('sp_workshop_serenity_cell', 0);
  assert.equal(workshopOffCombat.total, 15);

  const kCorpCombat = catalog.restorationBreakdown('sp_k_corp_prime_neural_ampule', 0);
  assert.equal(kCorpCombat.total, 15);
  assert.equal(kCorpCombat.lineLimit, 15);

  const kCorpOffCombat = catalog.restorationBreakdown('sp_k_corp_executive_reset_ampule', 0);
  assert.equal(kCorpOffCombat.total, 20);
  assert.equal(kCorpOffCombat.lineLimit, 20);

  const nearCap = catalog.restorationBreakdown('sp_k_corp_executive_reset_ampule', 40);
  assert.equal(nearCap.total, 5, 'SP restoration must clamp to the 45 SP maximum');
  assert.equal(nearCap.after, 45);

  const negativeSp = catalog.restorationBreakdown('sp_k_corp_executive_reset_ampule', -45);
  assert.equal(negativeSp.total, 20);
  assert.equal(negativeSp.after, -25, 'even the strongest item must not erase deep negative SP in one use');

  const regen = catalog.restorationBreakdown('sp_generic_slowbreath_strip', 0);
  assert.equal(regen.immediate, 1);
  assert.equal(regen.regen, 2);
  assert.equal(regen.total, 3);
  assert.equal(regen.turnsApplied, 2);

  const regenOneTurn = catalog.restorationBreakdown('sp_generic_slowbreath_strip', 0, { regenTurns: 1 });
  assert.equal(regenOneTurn.total, 2);
  assert.equal(regenOneTurn.turnsApplied, 1);

  const offCombat = catalog.get('sp_generic_civilian_composure_tea');
  assert.equal(catalog.canUse(offCombat, { inCombat: true }).allowed, false);
  assert.equal(catalog.canUse(offCombat, { inCombat: false }).allowed, true);

  console.log('SP healing catalog smoke: OK (60 items, bounded for 45 SP sanity economy)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
