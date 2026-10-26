const assert = require('node:assert/strict');

for (const key of [
  'LuminousAnatomyEquipmentEngine',
  'LuminousInjuryEngine',
]) delete globalThis[key];

require('../js/anatomy-equipment-engine.js');
require('../js/injury-engine.js');

const injuryEngine = globalThis.LuminousInjuryEngine;
assert.ok(injuryEngine);
assert.deepEqual(injuryEngine.NARRATIVE_ONLY_EFFECTS, ['speed', 'min_speed', 'max_speed']);

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

const anklePatient = unit('ankle_patient');
const ankle = injuryEngine.gainInjury(anklePatient, 'sprained_ankle', { persist: false });
assert.equal(ankle.gained, true);
assert.equal(ankle.injury.effects.speed, -1, 'legacy/catalog speed metadata must remain available');

const ankleMechanical = injuryEngine.collectModifiers(anklePatient);
assert.equal(Object.prototype.hasOwnProperty.call(ankleMechanical, 'speed'), false, 'injury speed must not be a mechanical combat channel');
assert.equal(Object.prototype.hasOwnProperty.call(ankleMechanical, 'min_speed'), false);
assert.equal(Object.prototype.hasOwnProperty.call(ankleMechanical, 'max_speed'), false);

const ankleNarrative = injuryEngine.collectNarrativeEffects(anklePatient);
assert.equal(ankleNarrative.narrativeOnly, true);
assert.equal(ankleNarrative.speedAffected, true);
assert.equal(ankleNarrative.totals.speed, -1);
assert.equal(ankleNarrative.injuries.length, 1);
assert.equal(ankleNarrative.injuries[0].catalogId, 'sprained_ankle');
assert.equal(ankleNarrative.injuries[0].effects.speed, -1);

const kneePatient = unit('knee_patient');
injuryEngine.gainInjury(kneePatient, 'damaged_knee', { persist: false });
const combatEngine = {
  applyPassiveModifiers() {
    return { speed: 5, evade_power: 10, final_power: 2 };
  },
};
injuryEngine.wrapCombatEngine(combatEngine);
const kneeCombat = combatEngine.applyPassiveModifiers(kneePatient);
assert.equal(kneeCombat.speed, 5, 'injury must preserve Combat Engine speed unchanged');
assert.equal(kneeCombat.evade_power, 8, 'non-Speed injury effects remain mechanical');
assert.equal(kneeCombat.final_power, 2);

const legacyPatient = unit('legacy_patient');
legacyPatient.injuries.push({
  instanceId: 'legacy_speed_injury',
  catalogId: 'legacy_speed_injury',
  id: 'legacy_speed_injury',
  name: 'Legacy Speed Injury',
  severity: 'moderate',
  active: true,
  affectedParts: ['leg'],
  bodyPart: 'leg',
  effects: { speed: -2, min_speed: -1, max_speed: -1, evade_power: -3 },
});

const legacyMechanical = injuryEngine.collectModifiers(legacyPatient);
assert.equal(Object.prototype.hasOwnProperty.call(legacyMechanical, 'speed'), false, 'legacy saves must not leak speed into Combat');
assert.equal(legacyMechanical.evade_power, -3);
const legacyNarrative = injuryEngine.collectNarrativeEffects(legacyPatient);
assert.deepEqual(legacyNarrative.totals, { speed: -2, min_speed: -1, max_speed: -1 });
assert.equal(legacyPatient.injuries[0].effects.speed, -2, 'legacy save data must not be migrated or destroyed');

console.log('Injury narrative Speed smoke: OK (Speed metadata preserved, Combat mechanics untouched)');
