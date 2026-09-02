import '../js/combat-skill-schema.js';

const schema = globalThis.CombatSkillSchema;
if (!schema) throw new Error('CombatSkillSchema was not initialized.');

const smoke = schema.runSmokeTest();
if (!smoke.passed) {
  console.error('[CombatSkillSchema] Smoke test failed:', smoke.checks);
  process.exitCode = 1;
  throw new Error('CombatSkillSchema smoke test failed.');
}

const selfText = schema.formatSkillCondition({
  target: 'self',
  stat: 'hp_percent',
  operator: '<=',
  value: 50
});
if (selfText !== 'At 50% HP or less') {
  throw new Error(`Unexpected self formatter output: ${selfText}`);
}

const invalidPercentSkill = schema.normalizeCombatSkill({
  name: 'Invalid Percent Test',
  effects: [{
    trigger: '[On Use]',
    target: 'self',
    type: 'percentage_damage',
    potency: 20,
    condition: { target: 'self', stat: 'hp_percent', operator: '<=', value: 150 }
  }]
});
const validation = schema.validateCombatSkill(invalidPercentSkill);
if (validation.valid) {
  throw new Error('Expected validation to reject HP percentages above 100.');
}

// SP authoring is Current SP only in the Skill Creator. The schema still reads legacy SP forms,
// but these checks guarantee both Self and Target current-SP readings and descriptions.
const selfSpCondition = { target: 'self', stat: 'sp_current', operator: '<=', value: -30 };
const targetSpCondition = { target: 'target', stat: 'sp_current', operator: '>=', value: 20 };

const selfSpText = schema.formatSkillCondition(selfSpCondition);
if (selfSpText !== 'At -30 SP or less') {
  throw new Error(`Unexpected Self SP formatter output: ${selfSpText}`);
}

const targetSpText = schema.formatSkillCondition(targetSpCondition);
if (targetSpText !== 'If target has 20 SP or more') {
  throw new Error(`Unexpected Target SP formatter output: ${targetSpText}`);
}

if (!schema.evaluateCondition(selfSpCondition, { self: { sp: -35 } })) {
  throw new Error('Expected Self Current SP -35 to satisfy -30 SP or less.');
}
if (schema.evaluateCondition(selfSpCondition, { self: { sp: -20 } })) {
  throw new Error('Expected Self Current SP -20 to fail -30 SP or less.');
}
if (!schema.evaluateCondition(targetSpCondition, { target: { sp: 25 } })) {
  throw new Error('Expected Target Current SP 25 to satisfy 20 SP or more.');
}
if (schema.evaluateCondition(targetSpCondition, { target: { sp: 10 } })) {
  throw new Error('Expected Target Current SP 10 to fail 20 SP or more.');
}

// Boundary readings used by the HUD's -45..45 authoring range.
if (schema.readConditionStat({ sp: -45 }, 'sp_current') !== -45) {
  throw new Error('Expected Current SP reader to preserve -45.');
}
if (schema.readConditionStat({ sp: 45 }, 'sp_current') !== 45) {
  throw new Error('Expected Current SP reader to preserve 45.');
}

console.log('[CombatSkillSchema] Smoke test passed.');
console.log(smoke.checks);
console.log('HP Formatter:', selfText);
console.log('SP Self Formatter:', selfSpText);
console.log('SP Target Formatter:', targetSpText);
