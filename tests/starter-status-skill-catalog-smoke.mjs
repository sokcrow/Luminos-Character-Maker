import assert from 'node:assert/strict';

await import('../js/combat-skill-schema.js');
await import('../js/status-rupture-runtime.js');
await import('../js/skill-catalog-starter-status-tier1.js');

const schema = globalThis.CombatSkillSchema;
const rupture = globalThis.LuminousRuptureStatusRuntime;
const catalog = globalThis.LuminousStarterStatusSkillCatalog;
if (!schema || !rupture || !catalog) throw new Error('Starter status skill modules were not initialized.');

const statuses = ['burn', 'rupture', 'sinking', 'tremor', 'poise', 'bleed'];
const expectedCoinPower = new Map([[1, 6], [2, 4], [3, 3]]);
const expectedSins = {
  burn: ['wrath', 'lust', 'pride'],
  rupture: ['gluttony', 'envy', 'pride'],
  sinking: ['gloom', 'sloth', 'envy'],
  tremor: ['sloth', 'pride', 'gluttony'],
  poise: ['pride', 'lust', 'gluttony'],
  bleed: ['lust', 'wrath', 'envy'],
};
const validSins = new Set(['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy']);
const skills = catalog.list();
assert.equal(skills.length, 72);
assert.deepEqual(catalog.STATUS_ORDER, statuses);
assert.equal(catalog.version, '1.1.0');
assert.equal(rupture.DEFINITION.mode, 'double');
assert.equal(rupture.DEFINITION.rules[0].trigger, 'getting_hit');
assert.equal(globalThis.STATUS_REGISTRY.rupture.mode, 'double');

for (const statusId of statuses) {
  const group = catalog.byStatus(statusId);
  assert.equal(group.length, 12, `${statusId} must have exactly 12 starter Skills`);
  assert.deepEqual(group.map((skill) => skill.coinAmount).sort((a, b) => a - b), [1,1,1,1,2,2,2,2,3,3,3,3]);
  assert.deepEqual(group.map((skill) => skill.coinPower).sort((a, b) => b - a), [6,6,6,6,4,4,4,4,3,3,3,3]);
  assert.deepEqual(catalog.STATUS_CONFIG[statusId].sins, expectedSins[statusId]);

  const sinCounts = Object.fromEntries(expectedSins[statusId].map((sin) => [sin, 0]));
  for (const skill of group) {
    assert.ok(Object.prototype.hasOwnProperty.call(sinCounts, skill.sinAffinity), `${skill.id} has unexpected Sin ${skill.sinAffinity}`);
    sinCounts[skill.sinAffinity] += 1;
  }
  assert.deepEqual(Object.values(sinCounts), [4, 4, 4], `${statusId} must distribute its three Sins 4/4/4`);
}

const ids = new Set();
for (const skill of skills) {
  assert.ok(skill.id && !ids.has(skill.id), `duplicate or empty id: ${skill.id}`);
  ids.add(skill.id);
  assert.match(skill.id, /^t1_(burn|rupture|sinking|tremor|poise|bleed)_\d{2}_[a-z0-9_]+$/);
  assert.equal(skill.tier, 1);
  assert.equal(skill.type, 'Attack');
  assert.equal(skill.metadata?.starter, true);
  assert.equal(skill.metadata?.buildEntry, true);
  assert.equal(skill.metadata?.rulesPolicy, 'apply_only');
  assert.equal(skill.metadata?.combatRange, 'melee');
  assert.ok(validSins.has(skill.sinAffinity), `${skill.id} must use a canonical Sin affinity`);
  assert.notEqual(skill.sinAffinity, 'sinless');
  assert.equal(skill.attackWeight, 1);
  assert.equal(skill.skillRange, 1, `${skill.id} must remain melee Range 1`);
  assert.equal(skill.targetingType, 'Focused Attack');
  assert.equal(skill.isClashable, true);
  assert.equal(skill.isUnclashable, false);
  assert.ok(skill.basePower >= 1 && skill.basePower <= 7);
  assert.ok(skill.coinPower >= 3 && skill.coinPower <= 6);
  assert.ok(skill.coinAmount >= 1 && skill.coinAmount <= 3);
  assert.equal(skill.coinPower, expectedCoinPower.get(skill.coinAmount), `${skill.id} coin power must decrease as coin count increases`);

  const maxPower = skill.basePower + (skill.coinPower * skill.coinAmount);
  assert.ok(maxPower >= 10 && maxPower <= 13, `${skill.id} max power ${maxPower} outside Tier 1 budget`);

  const validation = schema.validateCombatSkill(skill);
  assert.equal(validation.valid, true, `${skill.id}: ${validation.errors.join(' · ')}`);

  const allEffects = [
    ...(skill.effects || []).map((effect) => ({ effect, source: 'global' })),
    ...(skill.coins || []).flatMap((coin) => (coin.effects || []).map((effect) => ({ effect, source: 'coin' }))),
  ];
  assert.ok(allEffects.length >= 1, `${skill.id} needs a status application`);

  let potency = 0;
  let count = 0;
  for (const { effect, source } of allEffects) {
    assert.equal(effect.type, 'status', `${skill.id} has a non-status effect`);
    assert.equal(effect.status, skill.metadata.statusFamily);
    assert.equal(effect.condition, null);
    assert.equal(effect.maxCap, 0);
    assert.equal(effect.scaleTarget, null);
    assert.equal(effect.scaleCondition, null);
    assert.equal(effect.is_reuse, false);
    assert.equal(effect.target_ally, false);
    assert.equal(effect.timing, 'immediate');
    assert.ok(effect.potency >= 1);
    assert.ok(effect.count >= 1);
    potency += effect.potency;
    count += effect.count;

    if (skill.metadata.statusFamily === 'poise') {
      assert.equal(source, 'global');
      assert.equal(effect.trigger, '[On Use]');
      assert.equal(effect.target, 'self');
    } else {
      assert.equal(source, 'coin');
      assert.equal(effect.trigger, '[On Hit]');
      assert.equal(effect.target, 'target');
    }
  }
  assert.ok(potency >= 1 && potency <= 2, `${skill.id} potency package out of starter range`);
  assert.ok(count >= 1 && count <= 2, `${skill.id} count package out of starter range`);
}

const payload = catalog.firebasePayload(schema);
assert.equal(Object.keys(payload).length, 72);
assert.ok(payload[skills[0].id].schemaVersion === 2);
assert.equal(payload[skills[0].id].range, 1);
assert.equal(payload[skills[0].id].affinity, skills[0].sinAffinity);

console.log('starter status skill catalog smoke: ok');
