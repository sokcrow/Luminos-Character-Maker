const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const root = path.resolve(__dirname, '..');
  delete globalThis.LuminousWeaponComponentCatalog;
  delete globalThis.LuminousFirearmComponentCatalog;
  delete globalThis.LuminousFirearmCompositionEngine;

  await import(pathToFileURL(path.join(root, 'js/item-catalog-weapon-components.js')).href);
  await import(pathToFileURL(path.join(root, 'js/item-catalog-firearm-components.js')).href);
  await import(pathToFileURL(path.join(root, 'js/item-firearm-composition-engine.js')).href);

  const Parts = globalThis.LuminousFirearmComponentCatalog;
  const Composition = globalThis.LuminousFirearmCompositionEngine;

  assert.ok(Parts);
  assert.ok(Composition);
  assert.equal(Parts.COMPONENTS.length, 16);
  assert.equal(Object.keys(Parts.ICONS).length, 10);
  assert.equal(Parts.get('compact_frame').icon, 'https://imgur.com/PTvX2iC.png');
  assert.equal(Parts.get('sights').icon, 'https://imgur.com/1UbIJyN');
  assert.equal(Parts.productionValue('compact_frame'), 274000);
  assert.equal(Parts.productionValue('standard_frame'), 349000);
  assert.equal(Parts.productionValue('long_frame'), 450000);
  assert.equal(Parts.productionValue('compact_barrel'), 422000);
  assert.equal(Parts.productionValue('standard_action'), 862000);
  assert.equal(Parts.productionValue('high_cadence_action'), 1147000);
  assert.equal(Parts.productionValue('stock'), 179000);
  assert.equal(Parts.productionValue('tube_feed'), 458000);
  for (const part of Parts.COMPONENTS) {
    assert.equal(part.directDamageAllowed, false);
    assert.equal(part.statusApplicationAllowed, false);
    assert.equal(part.soundSuppressionAllowed, false);
    assert.ok([20,24].includes(part.baseThreshold));
  }

  assert.equal(Composition.CHASSIS.length, 5);
  const pistol = Composition.referenceBuild('pistol');
  const revolver = Composition.referenceBuild('revolver');
  const smg = Composition.referenceBuild('smg');
  const rifle = Composition.referenceBuild('rifle');
  const shotgun = Composition.referenceBuild('shotgun');
  assert.equal(pistol.productionValueAhn, 3370000);
  assert.equal(revolver.productionValueAhn, 3816000);
  assert.equal(smg.productionValueAhn, 4299000);
  assert.equal(rifle.productionValueAhn, 4476000);
  assert.equal(shotgun.productionValueAhn, 4581000);
  assert.deepEqual(smg.profile.cadenceModes, ['single','rapid','burst','full']);
  assert.equal(smg.profile.control, 3);
  assert.equal(rifle.profile.control, 3);
  assert.equal(rifle.profile.rangeProfile, 'fastest');
  assert.equal(shotgun.profile.feedType, 'tube_feed');
  assert.equal(pistol.profile.directDamageFromWeapon, false);
  assert.equal(pistol.profile.soundSuppression, false);

  console.log('Firearm component/composition smoke: OK');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
