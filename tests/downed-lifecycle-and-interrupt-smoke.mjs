import assert from 'node:assert/strict';

// Regression: a unit at 0 HP is still targetable when Downed but can never
// execute a queued attack, spell, action, reaction or preplanned escape.
await import('../js/death-save-runtime.js');
const life = globalThis.LuminousDeathSaveRuntime;
assert.ok(life);
for (const rank of ['captain', 'leader']) {
  const unit = { id: rank, rank, hp: 12, maxHp: 12, faction: 'enemy' };
  assert.equal(life.usesDeathSaves(unit), true, rank + ' must receive Death Saves');
  const transition = life.enterDowned(unit);
  assert.equal(transition.entered, true);
  assert.equal(unit.lifeState, 'downed');
  assert.equal(unit.hp, 0);
  assert.equal(life.isTargetable(unit), true, 'Downed remains on the field and targetable');
  assert.equal(life.canAct(unit), false);
  assert.equal(unit.isDead, false);
  life.resolveDeath(unit, { reason: 'test' });
  assert.equal(life.isDead(unit), true);
}
assert.equal(life.usesDeathSaves({ rank: 'normal' }), false);

// Legacy damage-over-time processors can write HP without calling applyDamage.
globalThis.CombatEngine = {
  applyDamage(unit, amount) { unit.hp = Math.max(0, unit.hp - amount); return {}; },
  processStatusEffects(unit) { unit.hp = 0; },
  triggerPhase() {},
};
assert.equal(life.patchCombatEngine(), true);
const dotLeader = { id: 'dotLeader', rank: 'leader', hp: 7, maxHp: 7 };
globalThis.CombatEngine.processStatusEffects(dotLeader, 'on_round_end');
assert.equal(dotLeader.lifeState, 'downed');
assert.equal(dotLeader.deathSaves.failures, 1, 'status causing Downed creates one failure');

await import('../js/loot-live-postcombat-runtime.js');
const loot = globalThis.LuminousLootLivePostCombatRuntime;
assert.ok(loot);
assert.equal(loot.isLootEligible({ faction: 'enemy', rank: 'leader', hp: 0, isDowned: true }), false);
assert.equal(loot.isLootEligible({ faction: 'enemy', rank: 'captain', hp: 0 }), false, 'unsynced 0 HP is not confirmed death');
assert.equal(loot.isLootEligible({ faction: 'enemy', rank: 'leader', hp: 0, isDead: true }), true);
assert.equal(loot.isLootEligible({ faction: 'enemy', rank: 'normal', hp: 0 }), true);

await import('../js/combat-action-schema.js');
await import('../js/combat-action-adapters.js');
await import('../js/combat-action-engine-bridge.js');
await import('../js/combat-action-queue.js');
await import('../js/combat-action-resolver.js');
await import('../js/individual-goap-combat-ai.js');
const ai = globalThis.LuminousIndividualGoapCombatAI;
const resolver = globalThis.LuminousCombatActionResolver;
const adapters = globalThis.LuminousCombatActionAdapters;
assert.ok(ai && resolver && adapters);
assert.equal(ai.planTurn({ actor: { id: 'downedGoap', rank: 'captain', hp: 0, maxHp: 30, lifeState: 'downed' },
  availableSlots: 3, targets: [{ id: 'ally' }], sources: [] }).actions.length, 0);

let attacks = 0;
const attacker = { id: 'actor', hp: 0, maxHp: 20, lifeState: 'downed', isDowned: true };
const target = { id: 'target', hp: 20, maxHp: 20 };
const engine = { resolveUnilateralWithCounter() { attacks++; return { damageTaken: 4 }; } };
const blockedAction = adapters.compileSkillToCombatAction(attacker,
  { id: 'dead_slash', basePower: 4, coinPower: 1, coinAmount: 2 }, { targetId: 'target' });
const blocked = resolver.resolveCombatAction(blockedAction, { phase: 'combat_phase', units: [attacker, target], engine });
assert.equal(blocked.cancelled, true);
assert.equal(attacks, 0, 'no damage after actor entered Downed');

// A counter during the first Coin must abort all remaining Coins.
attacker.hp = 20; attacker.lifeState = 'alive'; attacker.isDowned = false;
const counterEngine = {
  resolveUnilateralWithCounter(actor, skill, defender) {
    attacks++;
    defender.hp -= 4;
    actor.hp = 0;
    actor.isDowned = true;
    actor.lifeState = 'downed';
    return { damageTaken: 4 };
  },
};
const coinAction = adapters.compileSkillToCombatAction(attacker,
  { id: 'counter_test', basePower: 4, coinPower: 1, coinAmount: 3 }, { targetId: 'target' });
const interrupted = resolver.resolveCombatAction(coinAction,
  { phase: 'combat_phase', units: [attacker, target], engine: counterEngine,
    coinwiseResolution: true, combatActionQueue: globalThis.LuminousCombatActionQueue });
assert.equal(interrupted.cancelled, true);
assert.equal(attacks, 1, 'counter death must stop the second and third Coin');

console.log('Downed lifecycle / loot boundary / GOAP / action interruption: OK');
