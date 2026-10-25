import assert from 'node:assert/strict';
await import('../js/combat-v073-steps.js');
const { create } = globalThis.LuminousCombatSteps;
const units = {
  actor: { id: 'actor', hp: 12, lifeState: 'alive', isDowned: false },
  target: { id: 'target', hp: 10, lifeState: 'alive' },
};
let damageCalls = 0, shields = 0;
const rules = {
  unit: id => units[id],
  data: plan => plan.data,
  isUnitTargetable: unit => Boolean(unit && (unit.hp > 0 || unit.isDowned)),
  statusAttackPowerModifier: () => 0,
  targetFinalPowerVulnerabilityBonus: () => 0,
  rollSide: () => 'tail',
  coinHeadsChanceForUnit: () => 50,
  coinSrc: () => '',
  consumeParalysisOnHead: () => false,
  triggerBleedOnCoinFlip: id => {
    units[id].hp = 0; units[id].lifeState = 'downed'; units[id].isDowned = true;
  },
  damageCombatant: () => { damageCalls++; return { finalDamage: 3 }; },
  addEphemeralShield: () => { shields++; },
  statusDefensePowerModifier: () => 0,
};
const steps = create({ rules,
  snapshot: () => JSON.parse(JSON.stringify(units)),
  context: () => ({ round: 1 }),
});
const entry = { ownerId: 'actor', localIndex: 0,
  plan: { targetId: 'target', data: { coinAmount: 3, basePower: 4, finalPowerBonus: 0, coinPower: 1 } } };
const dealt = await steps.hits(entry, 'target', 3);
assert.equal(dealt, 0);
assert.equal(damageCalls, 0, 'bleed that downs the owner prevents current and later Coin damage');
assert.ok(steps.events().some(e => e.type === 'ActionCancelled' && e.reason === 'owner_unavailable'));
const shield = await steps.guard(entry);
assert.equal(shield, 0);
assert.equal(shields, 0);

units.target.hp = 10;
steps.mutate('TestDownedTransition', entry, {}, () => {
  units.target.hp = 0; units.target.lifeState = 'downed'; units.target.isDowned = true;
});
assert.ok(steps.events().some(e => e.type === 'UnitDowned' && e.unitId === 'target'));
assert.ok(!steps.events().some(e => e.type === 'UnitDefeated' && e.unitId === 'target'));
console.log('v073 owner interruption and UnitDowned event: OK');
