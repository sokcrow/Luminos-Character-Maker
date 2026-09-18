const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousHybridHealingCatalog;
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-hybrid-healing.js')).href);
  const catalog = globalThis.LuminousHybridHealingCatalog;

  assert.ok(catalog);
  assert.equal(catalog.VERSION, 1);
  assert.equal(catalog.FAMILY, 'healing_hybrid');
  assert.equal(catalog.CURRENCY, 'AHN');
  assert.equal(catalog.DEFAULT_MAX_SP, 45);
  assert.deepEqual(catalog.SOURCE_CAPS, {
    generic: 12,
    workshop: 16,
    premium_synthesis: 18,
  });
  assert.deepEqual(catalog.SP_LIMITS, {
    generic: { quickAction: 2, combat: 3, offCombat: 4 },
    workshop: { quickAction: 3, combat: 4, offCombat: 5 },
    premium_synthesis: { quickAction: 4, combat: 5, offCombat: 6 },
  });

  const validation = catalog.validateCatalog();
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  assert.equal(validation.count, 60);
  assert.equal(new Set(catalog.ITEMS.map((item) => item.id)).size, 60);

  for (const sourceLine of ['generic', 'workshop', 'premium_synthesis']) {
    const line = catalog.list({ sourceLine });
    assert.equal(line.length, 20, `${sourceLine} should contain 20 items`);
    for (const tier of catalog.TIERS) {
      assert.equal(line.filter((item) => item.tier === tier).length, 4, `${sourceLine} tier ${tier} should contain 4 items`);
    }
  }

  for (const item of catalog.ITEMS) {
    assert.equal(item.family, 'healing_hybrid');
    assert.equal(item.iconFamily, 'healing_hybrid');
    assert.equal(item.purchasable, true);
    assert.equal(item.currency, 'AHN');
    assert.ok(Number.isInteger(item.priceAhn) && item.priceAhn > 0);
    assert.ok(catalog.USE_TIMINGS.includes(item.runtime.actionCost));
    assert.equal(item.runtime.effects.spRestore, item.runtime.hybridHealing.sp.immediate);
    assert.equal(item.runtime.hybridHealing.sp.regen, undefined, `${item.id} must not carry SP regen`);

    const check = catalog.validateItem(item);
    assert.equal(check.valid, true, `${item.id}: ${JSON.stringify(check.errors)}`);
    assert.ok(check.hpCapPercent <= 18, `${item.id} hybrid HP must stay diluted`);
    assert.ok(check.spTotal <= 6, `${item.id} hybrid SP must stay diluted`);
  }

  const generic = catalog.list({ sourceLine: 'generic', tier: 'V' }).find((item) => item.runtime.actionCost === 'off_combat');
  const workshop = catalog.list({ sourceLine: 'workshop', tier: 'V' }).find((item) => item.runtime.actionCost === 'off_combat');
  const premium = catalog.list({ sourceLine: 'premium_synthesis', tier: 'V' }).find((item) => item.runtime.actionCost === 'off_combat');

  const genericResult = catalog.restorationBreakdown(generic, 200, 0);
  assert.equal(genericResult.hp.total, 24, 'Generic hybrid must cap at 12% of 200 HP');
  assert.equal(genericResult.sp.total, 4);

  const workshopResult = catalog.restorationBreakdown(workshop, 200, 0);
  assert.equal(workshopResult.hp.total, 32, 'Workshop hybrid must cap at 16% of 200 HP');
  assert.equal(workshopResult.sp.total, 5);

  const premiumResult = catalog.restorationBreakdown(premium, 200, 0);
  assert.equal(premiumResult.hp.total, 36, 'Premium hybrid must cap at 18% of 200 HP');
  assert.equal(premiumResult.sp.total, 6);

  const nearSpCap = catalog.restorationBreakdown(premium, 200, 42);
  assert.equal(nearSpCap.sp.total, 3);
  assert.equal(nearSpCap.sp.after, 45);

  const sustained = catalog.list({ sourceLine: 'generic', tier: 'V' }).find((item) => item.runtime.hybridHealing.hp.regen);
  const sustainedResult = catalog.restorationBreakdown(sustained, 200, 0);
  assert.equal(sustainedResult.hp.turnsApplied, 2);
  assert.ok(sustainedResult.hp.regen > 0);
  assert.equal(sustainedResult.sp.regen, 0);

  assert.equal(catalog.canUse(premium, { inCombat: true }).allowed, false);
  assert.equal(catalog.canUse(premium, { inCombat: false }).allowed, true);

  console.log('Hybrid healing catalog smoke: OK (60 items, deliberately diluted HP + SP recovery)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
