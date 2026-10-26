const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousWeaponComponentCatalog;
  delete globalThis.LuminousRangedWeaponComponentCatalog;
  delete globalThis.LuminousWeaponCompositionEngine;
  delete globalThis.LuminousRangedWeaponCompositionEngine;
  delete globalThis.LuminousRangedWeaponUpgradeCatalog;
  delete globalThis.LuminousAmmoRuntime;

  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-weapon-components.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-ranged-weapon-components.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-weapon-composition-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-ranged-weapon-composition-engine.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-ranged-weapon-upgrades.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-ammo-runtime.js')).href);

  const Ammo = globalThis.LuminousAmmoRuntime;
  assert.ok(Ammo);

  assert.equal(Ammo.combatGradeForMaterial('iron'), 0);
  assert.equal(Ammo.combatGradeForMaterial('carbon_steel'), 1);
  assert.equal(Ammo.combatGradeForMaterial('hardened_weapon_steel'), 2);
  assert.equal(Ammo.combatGradeForMaterial('corp_composite_alloy'), 3);
  assert.equal(Ammo.combatGradeForMaterial('bone'), -2);
  assert.equal(Ammo.combatGradeDamagePercent(-3), -30);
  assert.equal(Ammo.combatGradeDamagePercent(3), 15);

  assert.equal(Ammo.baseDurabilityPerPiece('arrow'), 5, '48 craft DP / 10 arrows should round to 5 uses');
  assert.equal(Ammo.baseDurabilityPerPiece('bolt'), 6, '48 craft DP / 8 bolts should be 6 uses');
  assert.equal(Ammo.baseDurabilityPerPiece('blowgun_dart'), 2, '48 craft DP / 20 darts should round to 2 uses');
  assert.equal(Ammo.baseDurabilityPerPiece('sling_bullet'), 3, '25 craft DP / 10 bullets should round to 3 uses');
  assert.equal(Ammo.baseDurabilityPerPiece('sling_stone'), 1, 'natural sling stone durability is locked to 1');

  assert.equal(Ammo.wearPenaltyForUpgrade('ammo_honed_point'), 30);
  assert.equal(Ammo.wearPenaltyForUpgrade('ammo_barbed_point'), 30);
  assert.equal(Ammo.wearPenaltyForUpgrade('ammo_deep_barbs'), 90);
  assert.equal(Ammo.wearPenaltyForUpgrade('ammo_needle_point'), 90);
  assert.equal(Ammo.combinedUpgradeWearPenalty(['ammo_honed_point','ammo_barbed_point']), 60);
  assert.equal(Ammo.combinedUpgradeWearPenalty(['ammo_honed_point','ammo_barbed_point','ammo_rebound_head']), 90);

  const standardArrow = Ammo.resolveAmmoProfile('arrow');
  assert.equal(standardArrow.combatGrade, 0);
  assert.equal(standardArrow.ammoPowerPercent, 0);
  assert.equal(standardArrow.maxDurability, 5);
  assert.equal(standardArrow.recoverable, true);

  const reinforcedArrow = Ammo.resolveAmmoProfile('arrow', {}, {reinforced:true});
  assert.equal(reinforcedArrow.maxDurability, 10, 'reinforced ammo doubles base durability');
  assert.equal(reinforcedArrow.ammoPowerPercent, -30, 'reinforced ammo keeps the approved 70% direct-damage profile');

  const barbedArrow = Ammo.resolveAmmoProfile('arrow', {}, {upgradeIds:['ammo_barbed_point']});
  assert.equal(barbedArrow.wearPenaltyPercent, 30);
  assert.equal(barbedArrow.specializationDamagePenalty, -20, 'low status specialization uses 80% direct damage');
  assert.equal(barbedArrow.maxDurability, 4, '5 base uses with -30% wear rounds to 4');

  const deepBarbs = Ammo.resolveAmmoProfile('arrow', {}, {upgradeIds:['ammo_deep_barbs']});
  assert.equal(deepBarbs.wearPenaltyPercent, 90);
  assert.equal(deepBarbs.specializationDamagePenalty, -40, 'high status specialization uses 60% direct damage');
  assert.equal(deepBarbs.maxDurability, 1, 'durability is always clamped to at least 1');

  const reinforcedSpecial = Ammo.resolveAmmoProfile('arrow', {}, {reinforced:true,upgradeIds:['ammo_barbed_point']});
  assert.equal(reinforcedSpecial.maxDurability, 7, 'reinforcement applies before upgrade wear: round(5*2*0.7)=7');

  const upgradedSkill = Ammo.applyAmmoProfileToSkill({power:20,modifiers:{}}, reinforcedArrow);
  assert.equal(upgradedSkill.power, 20, 'base damage remains the ranged Skill Power');
  assert.equal(upgradedSkill.modifiers.ammoPowerPercent, -30);

  let stack = Ammo.createAmmoStack(standardArrow, 2);
  assert.deepEqual(stack.available, {'5':2});
  const firstShot = Ammo.fireProjectile(stack);
  assert.equal(firstShot.valid, true);
  assert.equal(firstShot.remainingDurability, 4);
  assert.deepEqual(firstShot.stack.available, {'5':1});
  assert.deepEqual(firstShot.stack.spent, {'4':1});

  const secondShot = Ammo.fireProjectile(firstShot.stack);
  assert.deepEqual(secondShot.stack.available, {});
  assert.deepEqual(secondShot.stack.spent, {'4':2}, 'spent projectiles cannot be reused in the same encounter');

  const recovered = Ammo.resolveEndOfCombatRecovery(secondShot.stack);
  assert.deepEqual(recovered.available, {'4':2});
  assert.deepEqual(recovered.spent, {});

  const stone = Ammo.resolveAmmoProfile('sling_stone');
  assert.equal(stone.maxDurability, 1);
  assert.equal(stone.durabilityLocked, true);
  assert.equal(stone.recoverable, false);
  const stoneShot = Ammo.fireProjectile(Ammo.createAmmoStack(stone, 1));
  assert.equal(stoneShot.stack.destroyed, 1);
  assert.deepEqual(stoneShot.stack.spent, {});

  console.log('Ammo runtime smoke passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
