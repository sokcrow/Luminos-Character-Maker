const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemSizeLineageEngine;
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-size-lineage-engine.js')).href);
  const engine = globalThis.LuminousItemSizeLineageEngine;

  assert.ok(engine);
  assert.equal(engine.VERSION, 1);
  assert.equal(engine.DEFAULT_SIZE, 'medium');
  assert.equal(engine.HUNGER_MAX_PERCENT, 100);
  assert.equal(engine.RATION_HUNGER, 100);
  assert.deepEqual(engine.SIZE_ORDER, ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']);

  const expected = {
    tiny: [0.25, 1, 25, 0.25],
    small: [0.5, 2, 50, 0.5],
    medium: [1, 4, 100, 1],
    large: [2, 8, 200, 2],
    huge: [4, 16, 400, 4],
    gargantuan: [8, 32, 800, 8],
  };

  for (const [size, [multiplier, hideUnits, hunger, rationEquivalent]] of Object.entries(expected)) {
    const profile = engine.getSize(size);
    assert.equal(profile.multiplier, multiplier);
    assert.equal(profile.hideUnits, hideUnits);
    assert.equal(profile.dailyHunger, hunger);
    assert.equal(profile.rationEquivalent, rationEquivalent);
    assert.equal(engine.hideUnitsForSize(size), hideUnits);
    assert.equal(engine.hungerForSize(size), hunger);
    assert.equal(engine.rationEquivalentForSize(size), rationEquivalent);
  }

  assert.equal(engine.hungerPercent(50, 'medium'), 50);
  assert.equal(engine.hungerPercent(200, 'huge'), 50);
  assert.equal(engine.hungerPercent(999, 'small'), 100);
  assert.equal(engine.hungerPercent(-5, 'medium'), 0);

  const wolfDominant = engine.resolveDominantLineage([
    { family: 'meat', lineageId: 'wolf', lineageName: 'Wolf', quantity: 3, size: 'medium' },
    { family: 'meat', lineageId: 'boar', lineageName: 'Boar', quantity: 1, size: 'medium' },
    { family: 'vegetable', lineageId: 'carrot', lineageName: 'Carrot', quantity: 8, size: 'medium' },
  ], { eligibleFamilies: ['meat'] });
  assert.equal(wolfDominant.lineageId, 'wolf');
  assert.equal(wolfDominant.lineageName, 'Wolf');
  assert.equal(wolfDominant.mixed, false);

  const sizeDominant = engine.resolveDominantLineage([
    { family: 'meat', lineageId: 'rabbit', lineageName: 'Rabbit', quantity: 2, size: 'small' },
    { family: 'meat', lineageId: 'shark', lineageName: 'Shark', quantity: 1, size: 'large' },
  ], { eligibleFamilies: ['meat'] });
  assert.equal(sizeDominant.lineageId, 'shark');

  const mixed = engine.resolveDominantLineage([
    { family: 'meat', lineageId: 'wolf', lineageName: 'Wolf', quantity: 2, size: 'medium' },
    { family: 'meat', lineageId: 'boar', lineageName: 'Boar', quantity: 2, size: 'medium' },
  ], { eligibleFamilies: ['meat'] });
  assert.equal(mixed.lineageId, 'mixed');
  assert.equal(mixed.lineageName, 'Mixed');
  assert.equal(mixed.mixed, true);

  assert.equal(
    engine.composeInheritedName({ prefix: 'Light', lineageName: 'Bunny', materialName: 'Pelt', suffix: 'Armor' }),
    'Light Bunny Pelt Armor'
  );

  console.log('Item size/lineage engine smoke: OK');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
