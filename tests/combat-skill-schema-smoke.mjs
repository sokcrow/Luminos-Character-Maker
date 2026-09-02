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

console.log('[CombatSkillSchema] Smoke test passed.');
console.log(smoke.checks);
console.log('Formatter:', selfText);
