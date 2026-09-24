const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousWeaponComponentCatalog;
  delete globalThis.LuminousWeaponCompositionEngine;

  await import(pathToFileURL(path.resolve(__dirname, '../js/item-catalog-weapon-components.js')).href);
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-weapon-composition-engine.js')).href);

  const components = globalThis.LuminousWeaponComponentCatalog;
  const engine = globalThis.LuminousWeaponCompositionEngine;

  assert.ok(components);
  assert.ok(engine);
  assert.equal(components.VERSION, 1);
  assert.equal(engine.VERSION, 1);
  assert.equal(components.COMPONENTS.length, 23);
  assert.equal(engine.CHASSIS.length, 28);

  assert.equal(components.ICONS.weapon_component_blade_short, 'Assets/Icons/items/equipment/weapon_component_blade_short.png');
  assert.equal(components.ICONS.weapon_component_lash, 'Assets/Icons/items/equipment/weapon_component_lash.png');

  assert.equal(components.MATERIAL_DURABILITY.iron, 25);
  assert.equal(components.MATERIAL_DURABILITY.hardened_weapon_steel, 40);
  assert.equal(components.MATERIAL_DURABILITY.titanium_alloy, 53);
  assert.equal(components.MATERIAL_DURABILITY.exotic_alloy, 100);

  const shortBlade = components.resolveReferenceComponent('short_blade');
  assert.equal(shortBlade.valid, true);
  assert.equal(shortBlade.durability, 25);
  assert.equal(shortBlade.productionValueAhn, 72000);
  assert.equal(shortBlade.primaryMaterial.materialId, 'iron');

  const longBlade = components.resolveReferenceComponent('long_blade');
  assert.equal(longBlade.durability, 50);
  assert.equal(longBlade.productionValueAhn, 143000);

  const reinforcedHandle = components.resolveReferenceComponent('reinforced_handle');
  assert.equal(reinforcedHandle.durability, 25);
  assert.equal(reinforcedHandle.productionValueAhn, 47000);

  const dagger = engine.referenceBuild('dagger');
  assert.equal(dagger.valid, true);
  assert.equal(dagger.maxDurability, 40);
  assert.equal(dagger.productionValueAhn, 115000);
  assert.equal(dagger.handMode, 'one_handed');

  const longsword = engine.referenceBuild('longsword');
  assert.equal(longsword.maxDurability, 85);
  assert.equal(longsword.productionValueAhn, 273000);
  assert.equal(longsword.handMode, 'versatile');
  assert.equal(longsword.primaryMaterialId, 'iron');

  const greatsword = engine.referenceBuild('greatsword');
  assert.equal(greatsword.maxDurability, 110);
  assert.equal(greatsword.productionValueAhn, 367000);
  assert.equal(greatsword.handMode, 'two_handed');
  assert.equal(greatsword.handCost, 2);

  const halberd = engine.referenceBuild('halberd');
  assert.equal(halberd.maxDurability, 105);
  assert.equal(halberd.productionValueAhn, 306000);
  assert.equal(halberd.handMode, 'two_handed');

  const ironLong = components.resolveComponent('long_blade', { body: { materialId:'iron', unitValueAhn:22000, quality:'standard' } });
  const ironReinforced = components.resolveReferenceComponent('reinforced_handle');
  const ironGrip = components.resolveReferenceComponent('grip');
  const canonical = engine.resolveCanonicalBuild('longsword', [
    { ...ironLong, quantity:1, quality:'standard' },
    { ...ironReinforced, quantity:1, quality:'standard' },
    { ...ironGrip, quantity:1, quality:'standard' },
  ], 27);
  assert.equal(canonical.valid, true);
  assert.equal(canonical.craftedQuality, 'fine');
  assert.equal(canonical.craftAdjustment, 1);
  assert.equal(canonical.maxDurability, 85);

  assert.equal(engine.craftAdjustment(27, 22), 1);
  assert.equal(engine.craftAdjustment(24, 22), 0);
  assert.equal(engine.craftAdjustment(19, 22), -1);
  assert.equal(engine.craftAdjustment(17, 22), -2);

  const customGreatPole = engine.resolveCustomAssembly([
    { ...components.resolveReferenceComponent('great_blade'), quantity:1, quality:'standard' },
    { ...components.resolveReferenceComponent('long_shaft'), quantity:1, quality:'standard' },
    { ...components.resolveReferenceComponent('grip'), quantity:1, quality:'standard' },
  ], { result:22, threshold:22 });
  assert.equal(customGreatPole.valid, true);
  assert.equal(customGreatPole.chassisId, 'custom');
  assert.equal(customGreatPole.weaponFamily, 'polearm');
  assert.equal(customGreatPole.handMode, 'two_handed');

  const customLongAxe = engine.resolveCustomAssembly([
    { ...components.resolveReferenceComponent('axe_head_small'), quantity:1, quality:'standard' },
    { ...components.resolveReferenceComponent('long_shaft'), quantity:1, quality:'standard' },
  ]);
  assert.equal(customLongAxe.valid, true);
  assert.equal(customLongAxe.handMode, 'two_handed');

  const impossibleGreatHandle = engine.resolveCustomAssembly([
    { ...components.resolveReferenceComponent('great_blade'), quantity:1, quality:'standard' },
    { ...components.resolveReferenceComponent('handle'), quantity:1, quality:'standard' },
  ]);
  assert.equal(impossibleGreatHandle.valid, false);
  assert.equal(impossibleGreatHandle.reason, 'primary_support_incompatible');

  const flailMissingChain = engine.resolveCustomAssembly([
    { ...components.resolveReferenceComponent('flail_head'), quantity:1, quality:'standard' },
    { ...components.resolveReferenceComponent('handle'), quantity:1, quality:'standard' },
  ]);
  assert.equal(flailMissingChain.valid, false);
  assert.equal(flailMissingChain.reason, 'chain_required');

  assert.equal(engine.durabilityLossForSkill(), 1);
  assert.equal(engine.durabilityLossForSkill(3), 4);
  assert.equal(engine.canUpgrade({ currentDurability:51, maxDurability:100 }), true);
  assert.equal(engine.canUpgrade({ currentDurability:50, maxDurability:100 }), false);

  const degraded = engine.resolveDurabilityBreak({ currentQuality:'fine', currentDurability:0, maxDurability:85 });
  assert.equal(degraded.currentQuality, 'standard');
  assert.equal(degraded.currentDurability, 85);
  assert.equal(degraded.destroyed, false);

  const ruined = engine.resolveDurabilityBreak({ currentQuality:'ruined', currentDurability:0, maxDurability:85 });
  assert.equal(ruined.destroyed, true);

  const dart = engine.resolveDurabilityBreak({ currentQuality:'standard', currentDurability:0, maxDurability:5, nonRepairable:true });
  assert.equal(dart.destroyed, true);

  assert.equal(engine.improvisedDamage(25), 15);
  assert.equal(engine.improvisedDamage(5), 3);

  console.log('Weapon composition engine smoke: OK (23 components + 28 melee chassis + custom assembly)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
