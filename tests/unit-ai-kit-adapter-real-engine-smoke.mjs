import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// combatEngine.js is a browser/CommonJS script, not an ESM export. Evaluate the
// repository file in a browser-like global so this test exercises the real engine.
globalThis.window = globalThis;
globalThis.STATUS_REGISTRY = globalThis.STATUS_REGISTRY || {};
const engineSource = readFileSync(new URL('../js/combatEngine.js', import.meta.url), 'utf8');
vm.runInThisContext(engineSource, { filename: 'js/combatEngine.js' });
const engine = globalThis.CombatEngine;

await import('../js/status-engine.js');
await import('../js/universal-ranged-ammo-runtime.js');
await import('../js/skill-catalog-kobold-tier1.js');
await import('../js/unit-rank-runtime.js');
await import('../js/unit-combat-mechanics-runtime.js');
await import('../js/unit-catalog-kobold-tier1.js');
await import('../js/combat-action-schema.js');
await import('../js/combat-action-adapters.js');
await import('../js/combat-action-engine-bridge.js');
await import('../js/combat-action-queue.js');
await import('../js/combat-action-resolver.js');
await import('../js/individual-goap-combat-ai.js');
await import('../js/unit-ai-kit-adapter.js');

const resolver = globalThis.LuminousCombatActionResolver;
const kitAdapter = globalThis.LuminousUnitAiKitAdapter;
const kobolds = globalThis.LuminousKoboldUnitCatalog;
const ammo = globalThis.LuminousUniversalRangedAmmoRuntime;

if (!engine || !resolver || !kitAdapter || !kobolds || !ammo) {
  throw new Error('Real-engine Unit AI dependencies were not initialized.');
}

engine.currentState = 'COMBAT_ACTIVE';

const kobold = kobolds.resolve('kobold_dagger', { level: 2, initializeEncounter: true });
kobold.id = 'real_kobold';
kobold.name = 'Real GOAP Kobold';
kobold.hp = Math.max(kobold.hp, 10);
kobold.maxHp = Math.max(kobold.maxHp, 10);
kobold.sp = 0;
kobold.level = kobold.effectiveLevel || 2;
kobold.faction = 'enemy';
kobold.faccion = 'enemy';
kobold.statusEffects = kobold.statusEffects || {};
kobold.stats = kobold.stats || {};
kobold.physRes = kobold.physRes || 1;
kobold.sinRes = kobold.sinRes || 1;

const player = {
  id: 'real_player', name: 'Target Player', faction: 'allies', faccion: 'allies',
  hp: 80, maxHp: 80, sp: 0, level: 2, statusEffects: {}, stats: {},
  shield: 0, physRes: 1, sinRes: 1,
};

const plan = kitAdapter.planUnitTurn({
  actor: kobold,
  targets: [player],
  availableSlots: 1,
  allowEscape: false,
});
assert.equal(plan.planned, true);
assert.equal(plan.actions.length, 1);
assert.ok(['kobold_dagger_jab', 'kobold_desperate_stab'].includes(plan.sequence[0].sourceId), 'healthy melee Kobold should choose an offensive canonical Skill');

const hpBefore = player.hp;
const result = resolver.resolveCombatAction(plan.actions[0], {
  phase: plan.actions[0].phase.executesAt,
  units: [kobold, player],
  engine,
  resourceHandlers: { ammunition: ammo.ammunitionHandler() },
});
assert.equal(result.resolved, true, result.reason || 'canonical Unit CombatAction should resolve');
assert.ok(player.hp < hpBefore, `real CombatEngine should apply damage (${hpBefore} -> ${player.hp})`);

// A Sling Kobold with no ammunition must plan its remaining canonical defense rather than
// send an action that the resolver will reject for missing ammunition.
const sling = kobolds.resolve('kobold_sling', { level: 2, initializeEncounter: true });
sling.id = 'real_sling';
sling.hp = Math.max(sling.hp, 10);
sling.maxHp = Math.max(sling.maxHp, 10);
sling.faction = 'enemy';
sling.faccion = 'enemy';
ammo.setAmmo(sling, 'pebbles', 0);
const dryPlan = kitAdapter.planUnitTurn({ actor: sling, targetIds: [player.id], availableSlots: 1, allowEscape: false });
assert.equal(dryPlan.planned, true);
assert.equal(dryPlan.sequence[0].sourceId, 'kobold_duck_away');
assert.equal(dryPlan.kit.unavailable.filter((entry) => entry.reason === 'ammunition_unavailable').length, 2);

console.log(`unit-ai-kit-adapter real-engine smoke: ok (${hpBefore} -> ${player.hp} HP)`);
