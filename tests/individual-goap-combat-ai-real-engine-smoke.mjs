import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// combatEngine.js is a browser/CommonJS script rather than an ESM module.
// Give it a browser-like global and evaluate the repository file directly so this
// smoke test exercises the real engine implementation, not a mock.
globalThis.window = globalThis;
globalThis.STATUS_REGISTRY = globalThis.STATUS_REGISTRY || {};
const engineSource = readFileSync(new URL('../js/combatEngine.js', import.meta.url), 'utf8');
vm.runInThisContext(engineSource, { filename: 'js/combatEngine.js' });
const engine = globalThis.CombatEngine;
if (!engine) throw new Error('CombatEngine did not initialize.');

await import('../js/combat-action-schema.js');
const schema = globalThis.LuminousCombatAction;
await import('../js/combat-action-adapters.js');
await import('../js/combat-action-engine-bridge.js');
await import('../js/combat-action-queue.js');
await import('../js/combat-action-resolver.js');
const resolver = globalThis.LuminousCombatActionResolver;
await import('../js/individual-goap-combat-ai.js');
const ai = globalThis.LuminousIndividualGoapCombatAI;

if (!schema || !resolver || !ai) throw new Error('Canonical combat/GOAP modules were not initialized.');

const goblin = {
  id: 'real_engine_goblin',
  name: 'GOAP Goblin',
  faction: 'enemy',
  faccion: 'enemy',
  hp: 20,
  maxHp: 20,
  sp: 0,
  level: 3,
  scores: { int: 10, wis: 9 },
  stats: {},
  statusEffects: {},
  shield: 0,
};
const player = {
  id: 'real_engine_player',
  name: 'Test Player',
  faction: 'allies',
  faccion: 'allies',
  hp: 40,
  maxHp: 40,
  sp: 0,
  level: 3,
  stats: {},
  statusEffects: {},
  shield: 0,
  physRes: 1,
  sinRes: 1,
};

const strike = {
  sourceType: 'skill',
  definition: {
    id: 'goap_real_strike',
    name: 'GOAP Real Strike',
    type: 'Attack',
    basePower: 5,
    coinPower: 2,
    coinAmount: 1,
    coinType: 'positive',
    attackWeight: 1,
    damageType: 'slash',
    sinAffinity: 'sinless',
    targetingType: 'Focused Attack',
    isDefense: false,
    isClashable: false,
    isUnclashable: true,
    resourceCosts: [],
    effects: [],
    coins: [{ index: 0, type: 'normal', status: 'active', effects: [] }],
  },
  estimate: { damage: 7, damageType: 'slash' },
};

const plan = ai.planTurn({
  actor: goblin,
  availableSlots: 1,
  targetIds: [player.id],
  sources: [strike],
});
assert.equal(plan.planned, true);
assert.equal(plan.goal, ai.GOALS.KILL_TARGET);
assert.equal(plan.actions.length, 1);
assert.equal(schema.validateCombatAction(plan.actions[0]).valid, true);

const hpBefore = player.hp;
const result = resolver.resolveCombatAction(plan.actions[0], {
  phase: schema.PHASES.COMBAT_PHASE,
  units: [goblin, player],
  engine,
});

assert.equal(result.resolved, true, result.reason || 'GOAP CombatAction should resolve');
assert.ok(player.hp < hpBefore, `Real CombatEngine should apply damage (${hpBefore} -> ${player.hp})`);
assert.equal(result.action.actorId, goblin.id);
assert.equal(result.action.source.id, 'goap_real_strike');

console.log(`individual GOAP real CombatEngine smoke: ok (${hpBefore} -> ${player.hp} HP)`);
