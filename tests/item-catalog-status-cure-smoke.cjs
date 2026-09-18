const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  for (const key of ['LuminousStatusLibrary', 'LuminousStatusEngine', 'LuminousStatusCureCatalog', 'LuminousItemRuntime', 'STATUS_REGISTRY']) delete globalThis[key];

  await import(pathToFileURL(path.resolve(__dirname, '../js/status-library.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/status-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-runtime-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-status-cure.js')).href);

  const catalog = globalThis.LuminousStatusCureCatalog;
  const statusEngine = globalThis.LuminousStatusEngine;
  const itemRuntime = globalThis.LuminousItemRuntime;

  assert.ok(catalog);
  assert.ok(statusEngine);
  assert.ok(itemRuntime);
  assert.equal(catalog.VERSION, 2);
  assert.equal(catalog.FAMILY, 'status_cure');
  assert.equal(catalog.CURRENCY, 'AHN');
  assert.equal(itemRuntime.__luminousStatusCureBridge, true, 'status cure catalog should bridge into normal item use');

  const supported = Object.keys(catalog.CURABLE_STATUS_PROFILES).sort();
  assert.deepEqual(supported, [
    'bleed', 'burn', 'chill', 'corrosion', 'decay', 'paralyze',
    'poison', 'radiance', 'rupture', 'shock', 'sinking', 'tremor',
  ]);

  for (const forbidden of ['frozen', 'petrified', 'grappled', 'restrained', 'sleep', 'exhaustion', 'blinded', 'confusion', 'frightened']) {
    assert.equal(catalog.CURABLE_STATUS_PROFILES[forbidden], undefined, `${forbidden} should not be a generic status-cure target`);
  }

  const validation = catalog.validateCatalog();
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  assert.equal(validation.count, 60);
  assert.equal(new Set(catalog.ITEMS.map((item) => item.id)).size, 60);

  for (const sourceLine of ['generic', 'workshop', 'specialist']) {
    const line = catalog.list({ sourceLine });
    assert.equal(line.length, 20, `${sourceLine} should contain 20 items`);
    for (const tier of catalog.TIERS) {
      assert.equal(line.filter((item) => item.tier === tier).length, 4, `${sourceLine} tier ${tier} should contain 4 items`);
    }
  }

  for (const item of catalog.ITEMS) {
    assert.equal(item.family, 'status_cure');
    assert.equal(item.iconFamily, 'status_cure');
    assert.equal(item.category, 'consumable');
    assert.equal(item.purchasable, true);
    assert.equal(item.currency, 'AHN');
    assert.ok(Number.isInteger(item.priceAhn) && item.priceAhn > 0);
    assert.ok(catalog.USE_TIMINGS.includes(item.runtime.actionCost));
    assert.equal(item.runtime.handler, 'status_cure');
    assert.ok(Array.isArray(item.runtime.effects.statusAdjustments));
    assert.ok(item.runtime.effects.statusAdjustments.length > 0);
    for (const adjustment of item.runtime.effects.statusAdjustments) {
      assert.ok(catalog.CURABLE_STATUS_PROFILES[adjustment.statusId], `${item.id} targets unsupported ${adjustment.statusId}`);
      assert.ok(adjustment.countDelta <= 0);
      assert.ok(adjustment.potencyDelta <= 0);
      assert.ok(adjustment.countDelta < 0 || adjustment.potencyDelta < 0);
    }
  }

  for (const statusId of supported) {
    assert.ok(catalog.list({ statusId }).length > 0, `${statusId} should have at least one cure item`);
  }

  const unit = { id: 'unit_cure_smoke', statusEffects: {} };

  statusEngine.applyStatus(unit, 'bleed', { mode: 'set', count: 5, potency: 3 });
  const bleedResult = catalog.applyCure('cure_generic_coagulant_bandage', unit, { statusEngine, inCombat: true });
  assert.equal(bleedResult.applied, true);
  assert.deepEqual(statusEngine.getStatus(unit, 'bleed') && {
    count: statusEngine.getStatus(unit, 'bleed').count,
    potency: statusEngine.getStatus(unit, 'bleed').potency,
  }, { count: 2, potency: 2 });

  statusEngine.applyStatus(unit, 'shock', { mode: 'set', count: 2, potency: 0 });
  const shockResult = catalog.applyCure('cure_generic_grounding_patch', unit, { statusEngine, inCombat: true });
  assert.equal(shockResult.applied, true);
  assert.equal(statusEngine.hasStatus(unit, 'shock'), false, 'single-mode status should be removed when Count is depleted');

  statusEngine.applyStatus(unit, 'poison', { mode: 'set', count: 3, potency: 4 });
  const poisonPartial = catalog.applyCure('cure_generic_basic_antitoxin', unit, { statusEngine, inCombat: true });
  assert.equal(poisonPartial.applied, true);
  const poisonAfterPartial = statusEngine.getStatus(unit, 'poison');
  assert.ok(poisonAfterPartial, 'Poison Potency is persistent even if active Count reaches zero');
  assert.equal(poisonAfterPartial.count, 0);
  assert.equal(poisonAfterPartial.potency, 3);

  const poisonFull = catalog.applyCure('cure_specialist_prime_counteragent', unit, { statusEngine, inCombat: true });
  assert.equal(poisonFull.applied, true);
  assert.equal(statusEngine.hasStatus(unit, 'poison'), false, 'Poison should disappear only after Count and Potency are both depleted');

  const offCombat = catalog.get('cure_generic_field_recovery_kit');
  assert.equal(catalog.canUse(offCombat, { inCombat: true }).allowed, false);
  assert.equal(catalog.canUse(offCombat, { inCombat: false }).allowed, true);
  assert.equal(catalog.applyCure(offCombat, unit, { statusEngine, inCombat: true }).reason, 'off_combat_only');

  const totalCase = catalog.get('cure_specialist_specialist_total_countermeasure_case');
  assert.ok(totalCase);
  const totalTargets = new Set(totalCase.runtime.statusCure.statusAdjustments.map((entry) => entry.statusId));
  for (const statusId of supported) assert.ok(totalTargets.has(statusId), `Tier V specialist case should cover ${statusId}`);

  // Normal LuminousItemRuntime.useItem must route cure handlers, consume the item and apply partial treatment.
  const runtimeUnit = { id: 'runtime_cure_unit', statusEffects: {} };
  statusEngine.applyStatus(runtimeUnit, 'bleed', { mode: 'set', count: 6, potency: 4 });
  const runtimeItem = catalog.get('cure_generic_coagulant_bandage');
  runtimeItem.quantity = 1;
  const runtimeUse = itemRuntime.useItem(runtimeUnit, runtimeItem, { phase: 'other', target: runtimeUnit });
  assert.equal(runtimeUse.used, true);
  assert.equal(runtimeUse.consumed, true);
  assert.equal(runtimeItem.quantity, 0);
  const runtimeBleed = statusEngine.getStatus(runtimeUnit, 'bleed');
  assert.equal(runtimeBleed.count, 3);
  assert.equal(runtimeBleed.potency, 3);

  const combatOffItem = catalog.get('cure_generic_field_recovery_kit');
  combatOffItem.quantity = 1;
  const blockedOffCombat = itemRuntime.useItem(runtimeUnit, combatOffItem, { phase: 'combat', target: runtimeUnit });
  assert.equal(blockedOffCombat.used, false);
  assert.equal(blockedOffCombat.reason, 'off_combat_only');
  assert.equal(combatOffItem.quantity, 1, 'blocked Off Combat cure must not be consumed');

  console.log('Status cure catalog smoke: OK (60 items, 12 canonical reducible statuses, partial Count/Potency treatment + item runtime bridge)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
