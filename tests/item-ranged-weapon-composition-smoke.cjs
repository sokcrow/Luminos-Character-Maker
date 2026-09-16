const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousWeaponComponentCatalog;
  delete globalThis.LuminousRangedWeaponComponentCatalog;
  delete globalThis.LuminousWeaponCompositionEngine;
  delete globalThis.LuminousRangedWeaponCompositionEngine;

  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-weapon-components.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-ranged-weapon-components.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-weapon-composition-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-ranged-weapon-composition-engine.js')).href);

  const Components = globalThis.LuminousRangedWeaponComponentCatalog;
  const Engine = globalThis.LuminousRangedWeaponCompositionEngine;

  assert.ok(Components);
  assert.ok(Engine);
  assert.equal(Components.COMPONENTS.length, 19, 'expected 19 ranged component definitions');
  for (const component of Components.COMPONENTS) {
    for (const input of component.materialInputs) {
      assert.ok(Number.isInteger(input.quantity) && input.quantity > 0, `${component.id} has non-integer material quantity`);
    }
    assert.ok(component.icon, `${component.id} should have a direct icon`);
  }

  const expectedBuilds = {
    shortbow: [48, 41000],
    longbow: [63, 57000],
    hand_crossbow: [73, 88000],
    light_crossbow: [103, 106000],
    heavy_crossbow: [133, 140000],
    sling: [18, 18000],
    blowgun: [45, 36000],
    dart: [40, 3600],
    net: [54, 35000],
  };
  for (const [id, [durability, value]] of Object.entries(expectedBuilds)) {
    const build = Engine.referenceBuild(id);
    assert.ok(build?.valid, `${id} reference build should resolve`);
    assert.equal(build.maxDurability, durability, `${id} durability mismatch`);
    assert.equal(build.productionValueAhn, value, `${id} Production Value mismatch`);
  }
  assert.equal(Engine.referenceBuild('shortbow').handMode, 'two_handed');
  assert.equal(Engine.referenceBuild('hand_crossbow').handMode, 'one_handed');
  assert.equal(Engine.referenceBuild('dart').recoverable, true);
  assert.equal(Engine.referenceBuild('net').recoverable, true);

  const expectedAmmo = {
    arrow: [10, 45000, 4500, 48],
    bolt: [8, 45000, 5625, 48],
    blowgun_dart: [20, 43200, 2160, 48],
    dart: [10, 36000, 3600, 40],
    sling_bullet: [10, 26400, 2640, 25],
  };
  for (const [id, [yieldCount, batchValue, unitValue, durability]] of Object.entries(expectedAmmo)) {
    const ammo = Engine.resolveAmmo(id);
    assert.ok(ammo?.valid, `${id} ammo should resolve`);
    assert.equal(ammo.batchYield, yieldCount, `${id} batch yield mismatch`);
    assert.equal(ammo.batchProductionValueAhn, batchValue, `${id} batch value mismatch`);
    assert.equal(ammo.unitProductionValueAhn, unitValue, `${id} unit value mismatch`);
    assert.equal(ammo.structuralDurability, durability, `${id} structural durability mismatch`);
  }

  const stone = Engine.resolveAmmo('sling_stone');
  assert.equal(stone.natural, true);
  assert.equal(stone.upgradeable, false);
  assert.equal(stone.unitProductionValueAhn, 0);
  assert.equal(stone.structuralDurability, 30);

  assert.equal(Engine.resolveAmmo('arrow').consumedOnUse, true);
  assert.equal(Engine.resolveAmmo('bolt').consumedOnUse, true);
  assert.equal(Engine.resolveAmmo('blowgun_dart').consumedOnUse, true);
  assert.equal(Engine.resolveAmmo('sling_bullet').consumedOnUse, true);
  assert.equal(Engine.resolveAmmo('dart').recoverable, true);
  assert.equal(Engine.resolveAmmo('dart').repairable, true);
  assert.equal(Engine.resolveAmmo('dart').ammoGradeEligible, false);

  console.log('Ranged weapon composition smoke passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});