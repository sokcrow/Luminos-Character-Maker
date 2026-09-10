'use strict';

const assert = require('assert');
require('../js/status-library.js');
require('../js/status-engine.js');
const ammo = require('../js/universal-ranged-ammo-runtime.js');
const status = global.LuminousStatusEngine;

assert.strictEqual(ammo.AMMO.pebbles.mode, 'single');
assert.strictEqual(ammo.AMMO.arrows.mode, 'single');
assert.strictEqual(ammo.AMMO.javelin.mode, 'single');
assert.strictEqual(ammo.AMMO.rock.maxCount, 1);
assert.strictEqual(ammo.PIERCED.mode, 'single');

const kobold = { id: 'kobold', actorCategory: 'enemy', mechanics: { ammoLoadout: [{ id: 'pebbles', amount: 6 }] } };
ammo.onEncounterStart(kobold);
assert.strictEqual(ammo.ammoCount(kobold, 'pebbles'), 6);
assert.strictEqual(ammo.consumeAmmo(kobold, 'pebbles', 1).ok, true);
assert.strictEqual(ammo.ammoCount(kobold, 'pebbles'), 5);

const rockUnit = { id: 'winged', actorCategory: 'enemy' };
ammo.gainAmmo(rockUnit, 'rock', 5);
assert.strictEqual(ammo.ammoCount(rockUnit, 'rock'), 1);

const rangedPebble = {
  skillRange: 6,
  sourceType: 'skill',
  resourceCosts: [{ type: 'ammunition', id: 'pebbles', amount: 1 }],
  metadata: { ammoType: 'pebbles', weaponSkill: true },
};
const meleeFakeAmmo = {
  skillRange: 1,
  sourceType: 'skill',
  resourceCosts: [{ type: 'ammunition', id: 'pebbles', amount: 1 }],
  metadata: { ammoType: 'pebbles', weaponSkill: true },
};
assert.strictEqual(ammo.isAmmoConsumingSkill(rangedPebble, 'pebbles'), true);
assert.strictEqual(ammo.isAmmoConsumingSkill(meleeFakeAmmo, 'pebbles'), false);

const piercedTarget = { id: 'target' };
let pierced = ammo.applyPierced(piercedTarget, 3);
assert.strictEqual(pierced.bindGain, 1);
assert.strictEqual(status.getStatus(piercedTarget, 'bind').count, 1);
pierced = ammo.applyPierced(piercedTarget, 1);
assert.strictEqual(pierced.bleedCountGain, 1);
assert.strictEqual(status.getStatus(piercedTarget, 'bleed').count, 1);
assert.strictEqual(ammo.statusCount(piercedTarget, 'pierced'), 4);
assert.strictEqual(ammo.removePiercedCount(piercedTarget, 3).after, 1);

const rangedAction = {
  id: 'ranged-action', actorId: 'archer', metadata: { resolvedSpeed: 5, sourceDefinition: { skillRange: 6, sourceType: 'skill', metadata: { weaponSkill: true } } },
};
const meleeAction = {
  id: 'melee-action', actorId: 'melee', metadata: { resolvedSpeed: 3, sourceDefinition: { skillRange: 1, sourceType: 'skill', metadata: { weaponSkill: true } } },
};
let prepared = ammo.prepareClashActions(rangedAction, meleeAction, {});
assert.strictEqual(prepared.actionA.metadata.sourceDefinition.__universalRangedWeaponClashPowerBonus, 2);
assert.strictEqual(prepared.actionB.metadata.sourceDefinition.__universalRangedWeaponClashPowerBonus, undefined);

prepared = ammo.prepareClashActions({ ...rangedAction, metadata: { ...rangedAction.metadata, resolvedSpeed: 3 } }, meleeAction, {});
assert.strictEqual(prepared.actionA.metadata.sourceDefinition.__universalRangedWeaponClashPowerBonus, undefined);

const rangedSpell = {
  id: 'spell-action', actorId: 'caster', metadata: { resolvedSpeed: 6, sourceDefinition: { skillRange: 6, sourceType: 'spell', metadata: { weaponSkill: false } } },
};
prepared = ammo.prepareClashActions(rangedSpell, meleeAction, {});
assert.strictEqual(prepared.actionA.metadata.sourceDefinition.__universalRangedWeaponClashPowerBonus, undefined);

// Players withdraw Encounter ammo from inventory; only what exists is granted.
const oldItemRuntime = global.LuminousItemRuntime;
const oldInventoryRuntime = global.LuminousItemInventoryRuntime;
const arrowStack = { id: 'arrow-stack', definitionId: 'ammo_arrows', quantity: 7 };
global.LuminousItemRuntime = {
  ammoResourceId: () => 'arrows',
  definitionId: (item) => item.definitionId,
  quantityOf: (item) => item.quantity,
  consumeQuantity(item, amount) { if (item.quantity < amount) return { consumed: false }; item.quantity -= amount; return { consumed: true, remaining: item.quantity }; },
  findItem: () => arrowStack,
};
global.LuminousItemInventoryRuntime = {
  inventorySnapshot: () => ({ active: [{ item: arrowStack }], stash: [] }),
};
const player = { id: 'player', isPlayer: true, mechanics: { ammoLoadout: [{ id: 'arrows', amount: 10 }] } };
const grant = ammo.onEncounterStart(player)[0];
assert.strictEqual(grant.requested, 10);
assert.strictEqual(grant.granted, 7);
assert.strictEqual(grant.fromInventory, true);
assert.strictEqual(ammo.ammoCount(player, 'arrows'), 7);
assert.strictEqual(arrowStack.quantity, 0);
global.LuminousItemRuntime = oldItemRuntime;
global.LuminousItemInventoryRuntime = oldInventoryRuntime;

console.log('Universal ranged ammo smoke OK');
