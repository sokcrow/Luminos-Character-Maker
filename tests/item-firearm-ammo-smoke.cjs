const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const root = path.resolve(__dirname, '..');
  delete globalThis.LuminousFirearmAmmoCatalog;
  globalThis.LuminousAmmoRuntime = Object.freeze({
    combatGradeForMaterial(materialId, override) {
      if (Number.isFinite(Number(override))) return Math.max(-3,Math.min(3,Math.round(Number(override))));
      return ({lead:-3,iron:0,carbon_steel:1,hardened_weapon_steel:2,tungsten_alloy:3})[String(materialId)] ?? 0;
    },
    combatGradeDamagePercent(grade) {
      return ({'-3':-30,'-2':-20,'-1':-10,'0':0,'1':5,'2':10,'3':15})[String(grade)] ?? 0;
    },
  });

  await import(pathToFileURL(path.join(root, 'js/item-catalog-firearm-ammo.js')).href);
  const Ammo = globalThis.LuminousFirearmAmmoCatalog;

  assert.ok(Ammo);
  assert.equal(Ammo.PARTS.length, 4);
  assert.equal(Ammo.getCaliberTier(1).batchYield, 20);
  assert.equal(Ammo.getCaliberTier(4).batchYield, 5);
  assert.equal(Ammo.getPart('ammo_projectile').iconStatus, 'pending_dedicated_art');
  assert.equal(Ammo.validateStatus('decay').valid, false);
  assert.equal(Ammo.validateStatus('radiance').valid, false);
  assert.equal(Ammo.validateStatus('burn').valid, true);
  const grade3 = Ammo.resolveRoundProfile({caliberTier:3,offensiveMaterialId:'tungsten_alloy'});
  assert.equal(grade3.combatGrade, 3);
  assert.equal(grade3.materialDamagePercent, 15);
  assert.equal(grade3.createsAbsentStatus, false);
  const batch = Ammo.resolveBatch(2,{projectile:33000,casing:57000,propellant:40000,ignition:114000});
  assert.equal(batch.valid, true);
  assert.equal(batch.batchYield, 15);
  assert.ok(batch.batchProductionValueAhn > 0);
  assert.equal(Ammo.resolveRoundProfile({caliberTier:2,statusId:'decay'}).valid, false);

  console.log('Firearm ammo smoke: OK');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
