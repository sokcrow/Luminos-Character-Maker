const assert = require('node:assert/strict');

for (const key of [
  'LuminousAnatomyEquipmentEngine',
  'LuminousInjuryEngine',
  'LuminousItemRuntime',
  'LuminousMedicalSupplyCatalog',
]) delete globalThis[key];

require('../js/anatomy-equipment-engine.js');
require('../js/injury-engine.js');
require('../js/item-runtime-engine.js');
require('../js/item-catalog-medical-supply.js');

const catalog = globalThis.LuminousMedicalSupplyCatalog;
const injuryEngine = globalThis.LuminousInjuryEngine;

assert.ok(catalog);
assert.ok(injuryEngine);
assert.equal(catalog.VERSION, 2);
assert.equal(catalog.FAMILY, 'medical_supply');
assert.equal(catalog.CURRENCY, 'AHN');
assert.equal(injuryEngine.__luminousMedicalSupplyNarrativeBridge, true);
assert.equal(catalog.validateCatalog().valid, true, JSON.stringify(catalog.validateCatalog().errors));
assert.equal(catalog.ITEMS.length, 60);
assert.equal(new Set(catalog.ITEMS.map((item) => item.id)).size, 60);

for (const sourceLine of ['generic', 'workshop', 'specialist']) {
  const line = catalog.list({ sourceLine });
  assert.equal(line.length, 20, `${sourceLine} should contain 20 items`);
  for (const tier of catalog.TIERS) {
    assert.equal(line.filter((item) => item.tier === tier).length, 4, `${sourceLine} tier ${tier} should contain 4 items`);
  }
}

const expectedRelief = {
  generic: [1, 1, 1, 1, 1],
  workshop: [1, 1, 2, 2, 3],
  specialist: [1, 2, 2, 3, 3],
};
let narrativeReliefCount = 0;

for (const item of catalog.ITEMS) {
  assert.equal(item.family, 'medical_supply');
  assert.equal(item.iconFamily, 'medical_supply');
  assert.equal(item.category, 'consumable');
  assert.equal(item.purchasable, true);
  assert.equal(item.currency, 'AHN');
  assert.ok(Number.isInteger(item.priceAhn) && item.priceAhn > 0);
  assert.ok(catalog.USE_TIMINGS.includes(item.runtime.actionCost));
  assert.equal(item.runtime.handler, 'medical_supply');
  assert.equal(item.runtime.injuryTreatment.allowStructural, false);
  assert.ok(item.runtime.injuryTreatment.targetCatalogIds.length > 0);
  assert.ok(item.runtime.injuryTreatment.allowedSeverities.length > 0);
  assert.equal(item.runtime.effects, undefined, 'medical supplies must not duplicate HP/SP/status effects');

  const narrativeRelief = item.runtime.injuryTreatment.narrativeRelief;
  if (narrativeRelief) {
    narrativeReliefCount += 1;
    assert.deepEqual(Object.keys(narrativeRelief), ['speed']);
    assert.ok(narrativeRelief.speed > 0);
    assert.equal(item.runtime.actionCost, 'quick_action', 'only orthopedic Quick Action supplies grant narrative mobility relief');
  }
}
assert.equal(narrativeReliefCount, 15, 'five orthopedic items in each source line should grant narrative Speed relief');

for (const [sourceLine, values] of Object.entries(expectedRelief)) {
  catalog.TIERS.forEach((tier, tierIndex) => {
    const tierItems = catalog.list({ sourceLine, tier });
    const orthopedic = tierItems.find((item) => item.runtime.injuryTreatment.narrativeRelief);
    assert.ok(orthopedic, `${sourceLine} ${tier} should have one orthopedic narrative-relief item`);
    assert.equal(orthopedic.runtime.injuryTreatment.narrativeRelief.speed, values[tierIndex]);
  });
}

for (const structuralId of catalog.STRUCTURAL_EXCLUSIONS) {
  assert.equal(catalog.list({ injuryId: structuralId }).length, 0, `${structuralId} must not have a normal medical supply cure`);
}

assert.ok(catalog.list({ injuryId: 'deep_wound' }).length > 0);
assert.ok(catalog.list({ injuryId: 'broken_arm' }).length > 0);
assert.ok(catalog.list({ injuryId: 'damaged_lung' }).length > 0);
assert.ok(catalog.list({ injuryId: 'moderate_concussion' }).length > 0);

function unit(id) {
  return {
    id,
    hp: 100,
    maxHp: 100,
    equipment: {},
    injuries: [],
    injuryState: { downCount: 0, currentlyDownedCounted: false },
  };
}

const patient = unit('medical_patient');
const deep = injuryEngine.gainInjury(patient, 'deep_wound', { persist: false });
assert.equal(deep.gained, true);
assert.equal(deep.injury.remainingRecoveryHours, 18);

const fieldDressing = catalog.get('medical_generic_sterile_field_dressing');
const fieldGate = catalog.canTreatInjury(fieldDressing, patient, deep.injury.instanceId, { injuryEngine, inCombat: true });
assert.equal(fieldGate.allowed, true);
const fieldResult = catalog.applyTreatment(fieldDressing, patient, deep.injury.instanceId, { injuryEngine, inCombat: true });
assert.equal(fieldResult.applied, true);
assert.equal(injuryEngine.activeInjuries(patient)[0].remainingRecoveryHours, 16, 'Tier I field dressing should reduce deep wound recovery by 2h');
assert.equal(patient.hp, 100, 'medical supply should not restore HP');

const anklePatient = unit('ankle_patient');
const ankle = injuryEngine.gainInjury(anklePatient, 'sprained_ankle', { persist: false });
assert.equal(ankle.gained, true);
assert.equal(injuryEngine.collectNarrativeEffects(anklePatient).totals.speed, -1);
const jointWrap = catalog.get('medical_generic_joint_support_wrap');
const jointResult = catalog.applyTreatment(jointWrap, anklePatient, ankle.injury.instanceId, { injuryEngine, inCombat: true });
assert.equal(jointResult.applied, true);
assert.equal(jointResult.result.narrativeRelief.after, 0);
assert.equal(injuryEngine.collectNarrativeEffects(anklePatient).totals.speed, 0, 'generic support should neutralize a -1 narrative mobility penalty');
assert.equal(Object.prototype.hasOwnProperty.call(injuryEngine.collectModifiers(anklePatient), 'speed'), false, 'medical relief must never restore Combat Speed because Injury Speed is narrative-only');

const legPatient = unit('broken_leg_patient');
const brokenLeg = injuryEngine.gainInjury(legPatient, 'broken_leg', { persist: false });
assert.equal(brokenLeg.gained, true);
assert.equal(injuryEngine.collectNarrativeEffects(legPatient).totals.speed, -3);
assert.equal(injuryEngine.collectModifiers(legPatient).evade_power, -6);

const combatRig = catalog.get('medical_workshop_combat_orthopedic_rig');
const combatRigResult = catalog.applyTreatment(combatRig, legPatient, brokenLeg.injury.instanceId, { injuryEngine, inCombat: true });
assert.equal(combatRigResult.applied, true);
assert.equal(combatRigResult.result.narrativeRelief.relief, 2);
assert.equal(injuryEngine.collectNarrativeEffects(legPatient).totals.speed, -1, 'Workshop Tier III should reduce -3 narrative Speed to -1');
assert.equal(injuryEngine.collectModifiers(legPatient).evade_power, -6, 'orthopedic narrative relief must not erase non-Speed injury mechanics');

const weakerBrace = catalog.get('medical_workshop_snap_set_brace');
catalog.applyTreatment(weakerBrace, legPatient, brokenLeg.injury.instanceId, { injuryEngine, inCombat: true });
assert.equal(injuryEngine.collectNarrativeEffects(legPatient).totals.speed, -1, 'weaker supports must not stack over or replace a stronger existing support');

const zeroLag = catalog.get('medical_workshop_zero_lag_orthopedic_frame');
const zeroLagResult = catalog.applyTreatment(zeroLag, legPatient, brokenLeg.injury.instanceId, { injuryEngine, inCombat: true });
assert.equal(zeroLagResult.applied, true);
assert.equal(zeroLagResult.result.narrativeRelief.relief, 3);
assert.equal(injuryEngine.collectNarrativeEffects(legPatient).totals.speed, 0, 'Tier V Workshop support should fully offset -3 narrative Speed');
assert.equal(injuryEngine.collectModifiers(legPatient).evade_power, -6);
assert.equal(Object.prototype.hasOwnProperty.call(injuryEngine.collectModifiers(legPatient), 'speed'), false);

const severePatient = unit('severe_patient');
const broken = injuryEngine.gainInjury(severePatient, 'broken_arm', { persist: false });
assert.equal(broken.gained, true);
assert.equal(catalog.canTreatInjury(fieldDressing, severePatient, broken.injury.instanceId, { injuryEngine }).allowed, false, 'generic dressing must not treat a broken arm');

const workshopRig = catalog.get('medical_workshop_zero_lag_orthopedic_frame');
const workshopGate = catalog.canTreatInjury(workshopRig, severePatient, broken.injury.instanceId, { injuryEngine });
assert.equal(workshopGate.allowed, true);
const beforeWorkshop = injuryEngine.activeInjuries(severePatient)[0].remainingRecoveryHours;
const workshopResult = catalog.applyTreatment(workshopRig, severePatient, broken.injury.instanceId, { injuryEngine });
assert.equal(workshopResult.applied, true);
assert.ok(injuryEngine.activeInjuries(severePatient)[0].remainingRecoveryHours < beforeWorkshop, 'Workshop rig should accelerate severe recovery');
assert.ok(injuryEngine.activeInjuries(severePatient)[0].remainingRecoveryHours > 0, 'Workshop rig should not instantly cure Tier V broken arm');
assert.equal(workshopResult.result.narrativeRelief.applied, false, 'broken arm has no narrative Speed penalty to relieve');

const specialistPatient = unit('specialist_patient');
const lung = injuryEngine.gainInjury(specialistPatient, 'damaged_lung', { persist: false });
const specialistCase = catalog.get('medical_specialist_specialist_recovery_case_ex');
assert.equal(catalog.canUse(specialistCase, { inCombat: true }).allowed, false, 'specialist EX case must be off-combat only');
assert.equal(catalog.canTreatInjury(specialistCase, specialistPatient, lung.injury.instanceId, { injuryEngine, inCombat: false }).allowed, true);
const specialistResult = catalog.applyTreatment(specialistCase, specialistPatient, lung.injury.instanceId, { injuryEngine, inCombat: false });
assert.equal(specialistResult.applied, true);
assert.equal(injuryEngine.activeInjuries(specialistPatient).length, 0, 'EX specialist case should complete non-structural severe recovery');

const structuralPatient = unit('structural_patient');
const missing = injuryEngine.gainInjury(structuralPatient, 'missing_hand', { persist: false });
assert.equal(missing.gained, true);
const structuralGate = catalog.canTreatInjury(specialistCase, structuralPatient, missing.injury.instanceId, { injuryEngine, inCombat: false });
assert.equal(structuralGate.allowed, false);
assert.equal(structuralGate.reason, 'structural_injury_not_treatable');
assert.equal(injuryEngine.activeInjuries(structuralPatient).length, 1);

const runtimePatient = unit('runtime_patient');
const runtimeInjury = injuryEngine.gainInjury(runtimePatient, 'cut_hand', { persist: false });
const runtimeItem = catalog.get('medical_generic_reinforced_wound_dressing');
runtimeItem.quantity = 1;
const runtime = globalThis.LuminousItemRuntime;
assert.equal(runtime.__luminousMedicalSupplyBridge, true);
const runtimeUse = runtime.useItem(runtimePatient, runtimeItem, { injuryRef: runtimeInjury.injury.instanceId, phase: 'other' });
assert.equal(runtimeUse.used, true);
assert.equal(runtimeItem.quantity, 0, 'runtime use should consume the medical supply');
assert.equal(injuryEngine.activeInjuries(runtimePatient).length, 0, '4h reduction should complete a 3h Cut Hand recovery');

const runtimeMobilityPatient = unit('runtime_mobility_patient');
const runtimeAnkle = injuryEngine.gainInjury(runtimeMobilityPatient, 'sprained_ankle', { persist: false });
const runtimeJointWrap = catalog.get('medical_generic_joint_support_wrap');
runtimeJointWrap.quantity = 1;
const runtimeMobilityUse = runtime.useItem(runtimeMobilityPatient, runtimeJointWrap, { injuryRef: runtimeAnkle.injury.instanceId, phase: 'other' });
assert.equal(runtimeMobilityUse.used, true);
assert.equal(runtimeJointWrap.quantity, 0);
assert.equal(injuryEngine.collectNarrativeEffects(runtimeMobilityPatient).totals.speed, 0, 'normal Item Runtime use should apply narrative mobility relief through the Injury bridge');
assert.equal(Object.prototype.hasOwnProperty.call(injuryEngine.collectModifiers(runtimeMobilityPatient), 'speed'), false);

console.log('Medical supply catalog smoke: OK (60 items, 15 orthopedic narrative-Speed supports, Injury Engine harmony, structural exclusions)');
