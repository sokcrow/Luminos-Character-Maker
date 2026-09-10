import assert from 'node:assert/strict';

await import('../js/combat-action-schema.js');
const schema = globalThis.LuminousCombatAction;
await import('../js/combat-action-adapters.js');
const adapters = globalThis.LuminousCombatActionAdapters;
await import('../js/combat-action-engine-bridge.js');
await import('../js/combat-action-queue.js');
await import('../js/combat-action-resolver.js');
const resolver = globalThis.LuminousCombatActionResolver;
await import('../js/unit-catalog-goblin.js');
const goblins = globalThis.LuminousGoblinUnitCatalog;
await import('../js/individual-goap-combat-ai.js');
const ai = globalThis.LuminousIndividualGoapCombatAI;

if (!schema || !adapters || !resolver || !goblins || !ai) {
  throw new Error('Individual GOAP combat test dependencies were not initialized.');
}

const slash = {
  sourceType: 'skill',
  definition: {
    id: 'test_slash', name: 'Test Slash', basePower: 5, coinPower: 2, coinAmount: 1,
    damageType: 'slash', isClashable: false,
  },
  estimate: { damage: 8, damageType: 'slash' },
};

const fire = {
  sourceType: 'skill',
  definition: {
    id: 'test_fire', name: 'Test Fire', basePower: 4, coinPower: 1, coinAmount: 1,
    damageType: 'fire', isClashable: false,
  },
  estimate: { damage: 6, damageType: 'fire' },
};

const goblin = goblins.resolve('goblin', { level: 3, rank: 'normal' });
goblin.id = 'goblin_goap';
goblin.hp = goblin.maxHp;
const healthyPlan = ai.planTurn({
  actor: goblin,
  availableSlots: 2,
  targets: [{ id: 'player_1', faction: 'allies' }],
  sources: [slash, fire],
});
assert.equal(healthyPlan.planned, true);
assert.equal(healthyPlan.goal, ai.GOALS.KILL_TARGET);
assert.equal(healthyPlan.actions.length, 2);
assert.equal(healthyPlan.slotsUsed, 2);
assert.equal(healthyPlan.unusedSlots, 0);
assert.equal(healthyPlan.actions[0].phase.selectedAt, schema.PHASES.PLANNING_PHASE_AI);
assert.equal(healthyPlan.actions[0].actorId, goblin.id);
assert.equal(healthyPlan.actions[0].targeting.mainTargetId, 'player_1');
for (const action of healthyPlan.actions) {
  assert.equal(schema.validateCombatAction(action).valid, true, 'GOAP output must remain a canonical CombatAction');
}

const oneSlot = ai.planTurn({ actor: goblin, availableSlots: 1, targetIds: ['player_1'], sources: [slash, fire] });
assert.equal(oneSlot.actions.length, 1);
assert.equal(oneSlot.slotsRequested, 1);

const privateTargetView = {
  id: 'player_private', faction: 'allies',
  get hp() { throw new Error('GOAP read private target HP'); },
  get sp() { throw new Error('GOAP read private target SP'); },
  get resistances() { throw new Error('GOAP read private target resistances'); },
  get skills() { throw new Error('GOAP read private target skills'); },
  get plannedActions() { throw new Error('GOAP read future player actions'); },
};
const fairPlan = ai.planTurn({ actor: goblin, availableSlots: 1, targets: [privateTargetView], sources: [slash] });
assert.equal(fairPlan.planned, true);
assert.equal(fairPlan.targetId, 'player_private');

let intel = ai.createIntelState();
intel = ai.observeDamageResult(intel, { targetId: 'player_1', damageType: 'slash', expectedDamage: 10, actualDamage: 2 });
intel = ai.observeDamageResult(intel, { targetId: 'player_1', damageType: 'slash', expectedDamage: 10, actualDamage: 3 });
intel = ai.observeDamageResult(intel, { targetId: 'player_1', damageType: 'slash', expectedDamage: 10, actualDamage: 2 });
assert.ok(intel.targets.player_1.damageTypes.slash.multiplierEstimate < 0.4);
assert.ok(intel.targets.player_1.damageTypes.slash.confidence > 0.5);

const lowInt = { id: 'low_int', hp: 20, maxHp: 20, scores: { int: 5, wis: 10 } };
const highInt = { id: 'high_int', hp: 20, maxHp: 20, scores: { int: 18, wis: 10 } };
const lowPlan = ai.planTurn({ actor: lowInt, availableSlots: 1, targetIds: ['player_1'], sources: [slash, fire], intel });
const highPlan = ai.planTurn({ actor: highInt, availableSlots: 1, targetIds: ['player_1'], sources: [slash, fire], intel });
assert.equal(lowPlan.sequence[0].sourceId, 'test_slash');
assert.equal(highPlan.sequence[0].sourceId, 'test_fire');

// Escape is terminal: extra allocated slots remain unused after leaving the encounter.
const cautious = { id: 'cautious', hp: 2, maxHp: 20, scores: { int: 10, wis: 18 } };
const escapePlan = ai.planTurn({ actor: cautious, availableSlots: 3, targets: [privateTargetView], sources: [slash, fire] });
assert.equal(escapePlan.goal, ai.GOALS.ESCAPE);
assert.equal(escapePlan.sequence[0].sourceId, 'escape');
assert.equal(escapePlan.actions.length, 1);
assert.equal(escapePlan.slotsUsed, 1);
assert.equal(escapePlan.unusedSlots, 2);
assert.equal(escapePlan.actions[0].phase.executesAt, schema.PHASES.ON_TURN_END);
assert.equal(escapePlan.actions[0].effects[0].deniesXp, true);

// Resources are budgeted across the whole planned turn, not validated independently per slot.
// Disable Grapple here because this fixture isolates ammo budgeting and intentionally has no fallback action.
const onePebbleShot = {
  sourceType: 'skill',
  definition: {
    id: 'one_pebble_shot', name: 'One Pebble Shot', type: 'Attack', basePower: 6, coinPower: 2, coinAmount: 1,
    damageType: 'blunt', isClashable: false,
    resourceCosts: [{ type: 'ammunition', id: 'pebbles', amount: 1 }],
  },
  estimate: { damage: 9, damageType: 'blunt' },
  metadata: {
    resourceChecks: [{
      known: true,
      resource: { type: 'ammunition', id: 'pebbles', amount: 1 },
      detail: { available: true, current: 1, required: 1 },
    }],
  },
};
const resourcePlan = ai.planTurn({
  actor: { id: 'ammo_ai', hp: 20, maxHp: 20, scores: { int: 12, wis: 10 } },
  availableSlots: 2,
  targetIds: ['player_1'],
  sources: [onePebbleShot],
  allowEscape: false,
  allowGrapple: false,
});
assert.equal(resourcePlan.actions.length, 1);
assert.equal(resourcePlan.sequence[0].sourceId, 'one_pebble_shot');
assert.equal(resourcePlan.unusedSlots, 1);
assert.equal(resourcePlan.resourceSpent['ammunition:pebbles'], 1);

let attackCalls = 0;
const engine = {
  calculateFinalPower(skill, heads) { return Number(skill.basePower || 0) + Number(heads || 0); },
  resolveUnilateralWithCounter(attacker, skill, defender) {
    attackCalls += 1;
    defender.hp -= 3;
    return { damageTaken: 3, skillId: skill.id, attackerId: attacker.id, defenderId: defender.id };
  },
};
const realPlayer = { id: 'player_1', faction: 'allies', hp: 20, maxHp: 20, sp: 0 };
const engineGoblin = { ...goblin, faction: 'enemy', hp: goblin.maxHp };
const enginePlan = ai.planTurn({ actor: engineGoblin, availableSlots: 1, targetIds: ['player_1'], sources: [slash] });
const engineResult = resolver.resolveCombatAction(enginePlan.actions[0], {
  phase: schema.PHASES.COMBAT_PHASE,
  units: [engineGoblin, realPlayer],
  engine,
});
assert.equal(engineResult.resolved, true);
assert.equal(attackCalls, 1);
assert.equal(realPlayer.hp, 17);

let escaped = false;
const escapeResult = resolver.resolveCombatAction(escapePlan.actions[0], {
  phase: schema.PHASES.ON_TURN_END,
  units: [cautious, realPlayer],
  engine,
  effectHandlers: {
    escape: ({ actor, effect }) => {
      escaped = effect.leavesEncounter === true && actor.id === 'cautious';
      return { escaped };
    },
  },
});
assert.equal(escapeResult.resolved, true);
assert.equal(escaped, true);

console.log('individual GOAP combat AI smoke: ok');
