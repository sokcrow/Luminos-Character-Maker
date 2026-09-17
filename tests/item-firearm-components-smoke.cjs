const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const Base = require(path.join(root, 'js/item-catalog-weapon-components.js'));
globalThis.LuminousWeaponComponentCatalog = Base;
const Parts = require(path.join(root, 'js/item-catalog-firearm-components.js'));
globalThis.LuminousFirearmComponentCatalog = Parts;
const Composition = require(path.join(root, 'js/item-firearm-composition-engine.js'));

assert.equal(Parts.COMPONENTS.length, 16);
assert.equal(Object.keys(Parts.ICONS).length, 10);
assert.equal(Parts.get('compact_frame').icon, 'https://imgur.com/PTvX2iC.png');
assert.equal(Parts.get('sights').icon, 'https://imgur.com/1UbIJyN');
assert.equal(Parts.productionValue('compact_frame'), 110000);
assert.equal(Parts.productionValue('standard_frame'), 140000);
assert.equal(Parts.productionValue('long_frame'), 180000);
assert.equal(Parts.productionValue('compact_barrel'), 169000);
assert.equal(Parts.productionValue('standard_action'), 345000);
assert.equal(Parts.productionValue('high_cadence_action'), 459000);
assert.equal(Parts.productionValue('stock'), 72000);
assert.equal(Parts.productionValue('tube_feed'), 183000);
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
assert.equal(pistol.productionValueAhn, 1349000);
assert.equal(revolver.productionValueAhn, 1527000);
assert.equal(smg.productionValueAhn, 1721000);
assert.equal(rifle.productionValueAhn, 1791000);
assert.equal(shotgun.productionValueAhn, 1833000);
assert.deepEqual(smg.profile.cadenceModes, ['single','rapid','burst','full']);
assert.equal(smg.profile.control, 3);
assert.equal(rifle.profile.control, 3);
assert.equal(rifle.profile.rangeProfile, 'fastest');
assert.equal(shotgun.profile.feedType, 'tube_feed');
assert.equal(pistol.profile.directDamageFromWeapon, false);
assert.equal(pistol.profile.soundSuppression, false);

console.log('Firearm component/composition smoke: OK');
