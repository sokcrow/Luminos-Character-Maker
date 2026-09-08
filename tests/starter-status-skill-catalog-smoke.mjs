import assert from 'node:assert/strict';

await import('../js/combat-skill-schema.js');
await import('../js/status-rupture-runtime.js');
await import('../js/skill-catalog-starter-status-tier1.js');

const schema = globalThis.CombatSkillSchema;
const rupture = globalThis.LuminousRuptureStatusRuntime;
const catalog = globalThis.LuminousStarterStatusSkillCatalog;
if (!schema || !rupture || !catalog) throw new Error('Starter status skill modules were not initialized.');

const statuses = ['burn', 'rupture', 'sinking', 'tremor', 'poise', 'bleed'];
const damages = ['slash', 'pierce', 'blunt'];
const expectedDamageTypes = { slash: 'cortante', pierce: 'perforante', blunt: 'contundente' };
const expectedCoinPower = new Map([[1, 6], [2, 4], [3, 3]]);
const expectedSins = {
  burn: ['wrath', 'lust', 'pride'], rupture: ['gluttony', 'envy', 'pride'], sinking: ['gloom', 'sloth', 'envy'],
  tremor: ['sloth', 'pride', 'gluttony'], poise: ['pride', 'lust', 'gluttony'], bleed: ['lust', 'wrath', 'envy'],
};
const validSins = new Set(['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy']);
const skills = catalog.list();
assert.equal(skills.length, 216);
assert.deepEqual(catalog.STATUS_ORDER, statuses);
assert.deepEqual(catalog.DAMAGE_ORDER, damages);
assert.equal(catalog.version, '1.3.0');
assert.equal(rupture.DEFINITION.mode, 'double');
assert.equal(rupture.DEFINITION.rules[0].trigger, 'getting_hit');
assert.equal(globalThis.STATUS_REGISTRY.rupture.mode, 'double');

for (const damageId of damages) {
  const group = catalog.byDamage(damageId);
  assert.equal(group.length, 72, `${damageId} must have exactly 72 starter Skills across all Status families`);
  assert.ok(group.every((skill) => skill.damageType === expectedDamageTypes[damageId]));
}

for (const statusId of statuses) {
  const group = catalog.byStatus(statusId);
  assert.equal(group.length, 36, `${statusId} must have exactly 36 starter Skills`);
  assert.deepEqual(catalog.STATUS_CONFIG[statusId].sins, expectedSins[statusId]);
  const familySinCounts = Object.fromEntries(expectedSins[statusId].map((sin) => [sin, 0]));
  for (const skill of group) familySinCounts[skill.sinAffinity] += 1;
  assert.deepEqual(Object.values(familySinCounts), [12, 12, 12], `${statusId} must distribute its three Sins 12/12/12 across 36 Skills`);
  for (const damageId of damages) {
    const damageGroup = group.filter((skill) => skill.metadata?.damageFamily === damageId);
    assert.equal(damageGroup.length, 12, `${statusId}/${damageId} must have exactly 12 Skills`);
    assert.ok(damageGroup.every((skill) => skill.damageType === expectedDamageTypes[damageId]));
    assert.deepEqual(damageGroup.map((skill) => skill.coinAmount).sort((a, b) => a - b), [1,1,1,1,2,2,2,2,3,3,3,3]);
    assert.deepEqual(damageGroup.map((skill) => skill.coinPower).sort((a, b) => b - a), [6,6,6,6,4,4,4,4,3,3,3,3]);
    const sinCounts = Object.fromEntries(expectedSins[statusId].map((sin) => [sin, 0]));
    for (const skill of damageGroup) { assert.ok(Object.prototype.hasOwnProperty.call(sinCounts, skill.sinAffinity), `${skill.id} has unexpected Sin ${skill.sinAffinity}`); sinCounts[skill.sinAffinity] += 1; }
    assert.deepEqual(Object.values(sinCounts), [4, 4, 4], `${statusId}/${damageId} must distribute its three Sins 4/4/4`);
  }
}

const ids = new Set();
let legacyIdCount = 0;
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
  assert.ok(damages.includes(skill.metadata?.damageFamily), `${skill.id} must identify a physical damage family`);
  assert.equal(skill.damageType, expectedDamageTypes[skill.metadata.damageFamily]);
  if (skill.metadata?.legacyStarterId) legacyIdCount += 1;
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
  const allEffects = [...(skill.effects || []).map((effect) => ({ effect, source: 'global' })), ...(skill.coins || []).flatMap((coin) => (coin.effects || []).map((effect) => ({ effect, source: 'coin' })))];
  assert.ok(allEffects.length >= 1, `${skill.id} needs a status application`);
  let potency = 0, count = 0;
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
    assert.equal(source, 'coin');
    assert.equal(effect.trigger, '[On Hit]');
    assert.equal(effect.target, skill.metadata.statusFamily === 'poise' ? 'self' : 'target');
  }
  assert.ok(potency >= 1 && potency <= 2, `${skill.id} potency package out of starter range`);
  assert.ok(count >= 1 && count <= 2, `${skill.id} count package out of starter range`);
}

assert.equal(legacyIdCount, 72, 'the original 72 starter IDs must remain preserved');
const payload = catalog.firebasePayload(schema);
assert.equal(Object.keys(payload).length, 216);
assert.ok(payload[skills[0].id].schemaVersion === 2);
assert.equal(payload[skills[0].id].range, 1);
assert.equal(payload[skills[0].id].affinity, skills[0].sinAffinity);

console.log('starter status skill catalog smoke: ok');
