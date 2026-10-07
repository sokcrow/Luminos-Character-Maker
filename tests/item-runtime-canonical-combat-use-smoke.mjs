import assert from 'node:assert/strict';

for (const key of ['LuminousItemRuntime', 'LuminousStatusEngine']) delete globalThis[key];
await import('../js/status-engine.js');
await import('../js/item-runtime-engine.js');

const runtime = globalThis.LuminousItemRuntime;
const statuses = globalThis.LuminousStatusEngine;
assert.ok(runtime);
assert.ok(statuses);

const hpUnit = {
  id: 'hp-unit',
  hp: 20,
  hp_max: 100,
  inventario_activo: {},
};
const hpItem = {
  instanceId: 'hp-live',
  definitionId: 'hp_generic_pocket_recovery_patch',
  category: 'consumable',
  quantity: 1,
  runtime: {
    actionCost: 'action',
    targetMode: 'self',
    consumeQty: 1,
    healing: { flat: 2, maxHpPercent: 3, capMaxHpPercent: 30 },
  },
};
hpUnit.inventario_activo[hpItem.instanceId] = hpItem;
const hpUse = runtime.useItem(hpUnit, hpItem, { phase: 'combat', ignoreActionCost: true });
assert.equal(hpUse.used, true, 'canonical HP healing profile must resolve through ItemRuntime');
assert.equal(hpUnit.hp, 25);
assert.equal(hpItem.quantity, 0);

const blockedItem = {
  instanceId: 'camp-only',
  definitionId: 'hp_generic_civilian_recovery_pack',
  category: 'consumable',
  quantity: 1,
  runtime: {
    actionCost: 'off_combat',
    targetMode: 'self',
    consumeQty: 1,
    healing: { flat: 4, maxHpPercent: 5, capMaxHpPercent: 30 },
  },
};
const blocked = runtime.useItem(hpUnit, blockedItem, { phase: 'combat', ignoreActionCost: true });
assert.equal(blocked.used, false);
assert.equal(blocked.reason, 'off_combat_only');
assert.equal(blockedItem.quantity, 1, 'Off Combat item must not be consumed in Combat');

const hybridUnit = {
  id: 'hybrid-unit',
  hp: 10,
  hp_max: 100,
  sp: 0,
  sp_max: 45,
  inventario_activo: {},
};
const hybridItem = {
  instanceId: 'hybrid-live',
  definitionId: 'hybrid_generic_test',
  category: 'consumable',
  quantity: 1,
  runtime: {
    actionCost: 'action',
    targetMode: 'self',
    consumeQty: 1,
    effects: { spRestore: 2 },
    hybridHealing: {
      hp: { flat: 1, maxHpPercent: 2, capMaxHpPercent: 12 },
      sp: { immediate: 2, maxSp: 45 },
    },
  },
};
hybridUnit.inventario_activo[hybridItem.instanceId] = hybridItem;
const hybridUse = runtime.useItem(hybridUnit, hybridItem, { phase: 'combat', ignoreActionCost: true });
assert.equal(hybridUse.used, true);
assert.equal(hybridUnit.hp, 13, 'hybrid item must apply its canonical HP component');
assert.equal(hybridUnit.sp, 2, 'hybrid item must apply its SP component');
assert.equal(hybridItem.quantity, 0);

const statusUnit = {
  id: 'status-unit',
  hp: 10,
  hp_max: 10,
  statusEffects: {},
  inventario_activo: {},
};
statuses.applyStatus(statusUnit, 'bleed', { mode: 'set', count: 3, potency: 2 });
const cureItem = {
  instanceId: 'cure-live',
  definitionId: 'cure_generic_test',
  category: 'consumable',
  quantity: 1,
  runtime: {
    actionCost: 'action',
    targetMode: 'self',
    consumeQty: 1,
    handler: 'status_cure',
    effects: { statusAdjustments: [{ statusId: 'bleed', countDelta: -2, potencyDelta: -1 }] },
  },
};
statusUnit.inventario_activo[cureItem.instanceId] = cureItem;
const cureUse = runtime.useItem(statusUnit, cureItem, { phase: 'combat', ignoreActionCost: true });
assert.equal(cureUse.used, true, 'canonical status cure adjustment must resolve through ItemRuntime');
assert.deepEqual(
  { count: statuses.getStatus(statusUnit, 'bleed').count, potency: statuses.getStatus(statusUnit, 'bleed').potency },
  { count: 1, potency: 1 }
);
assert.equal(cureItem.quantity, 0);

const zeroCountUnit = {
  id: 'zero-count-unit',
  hp: 10,
  hp_max: 10,
  statusEffects: {},
};
statuses.applyStatus(zeroCountUnit, 'bleed', { mode: 'set', count: 1, potency: 5 });
const zeroCountItem = {
  instanceId: 'zero-count-cure',
  definitionId: 'cure_bleed_zero_count',
  category: 'consumable',
  quantity: 1,
  runtime: {
    actionCost: 'action',
    targetMode: 'self',
    consumeQty: 1,
    handler: 'status_cure',
    effects: { statusAdjustments: [{ statusId: 'bleed', countDelta: -3, potencyDelta: -1 }] },
  },
};
const zeroCountUse = runtime.useItem(zeroCountUnit, zeroCountItem, { phase: 'combat', ignoreActionCost: true });
assert.equal(zeroCountUse.used, true);
assert.equal(statuses.getStatus(zeroCountUnit, 'bleed'), null, 'Bleed must be removed when Count reaches zero even if Potency would remain');
assert.equal(zeroCountItem.quantity, 0);

const regenUnit = {
  id: 'regen-unit',
  hp: 20,
  hp_max: 100,
};
const regenItem = {
  instanceId: 'regen-live',
  definitionId: 'hp_generic_slowburn_strip',
  category: 'consumable',
  quantity: 1,
  runtime: {
    actionCost: 'action',
    targetMode: 'self',
    consumeQty: 1,
    healing: {
      flat: 1,
      maxHpPercent: 2,
      capMaxHpPercent: 30,
      regen: { turns: 2, tick: 'turn_start', flatPerTurn: 1, maxHpPercentPerTurn: 1 },
    },
  },
};
const regenUse = runtime.useItem(regenUnit, regenItem, { phase: 'combat', ignoreActionCost: true });
assert.equal(regenUse.used, true);
assert.equal(regenUnit.hp, 23, 'regen item must apply immediate canonical healing first');
assert.equal(regenUnit.itemRuntimeEffects.length, 1, 'regen item must schedule a turn-start effect');
let ticks = runtime.processTurnStartEffects(regenUnit, { round: 1 });
assert.equal(ticks.length, 1);
assert.equal(regenUnit.hp, 25, 'first regeneration turn must heal');
ticks = runtime.processTurnStartEffects(regenUnit, { round: 1 });
assert.equal(ticks.length, 0, 'same-round duplicate turn-start hooks must not double tick regeneration');
assert.equal(regenUnit.hp, 25);
ticks = runtime.processTurnStartEffects(regenUnit, { round: 2 });
assert.equal(ticks.length, 1);
assert.equal(regenUnit.hp, 27, 'second regeneration turn must heal');
assert.equal(regenUnit.itemRuntimeEffects.length, 0, 'regeneration effect must expire after its declared turns');


const activeGoodberryDish = {
  instanceId: 'active-goodberry-dish',
  category: 'consumable',
  runtime: {
    healing: { flat: 15, maxHpPercent: 10 },
    magicalFoodExpiresAt: Date.now() + 60_000,
  },
};
assert.deepEqual(runtime.runtimeUseProfile(activeGoodberryDish).hpHealing, { flat: 15, maxHpPercent: 10 });

const expiredGoodberryDish = {
  instanceId: 'expired-goodberry-dish',
  category: 'consumable',
  customData: { goodMagicDish: { expiresAt: 1 } },
  runtime: {
    healing: { flat: 15, maxHpPercent: 10 },
    magicalFoodExpiresAt: 1,
  },
};
assert.equal(runtime.runtimeUseProfile(expiredGoodberryDish).hpHealing, null, 'Goodberry dish healing must expire with the inherited ingredient timer');

console.log('canonical Combat ItemRuntime use smoke: ok');
