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

function hydrateCombatant(unit, id, name) {
  const canonicalHp = Number(unit.hp ?? unit.mechanics?.hp ?? 1);
  const canonicalMaxHp = Number(unit.maxHp ?? unit.mechanics?.maxHp ?? canonicalHp);
  unit.id = id;
  unit.name = name;
  unit.hp = Math.max(Number.isFinite(canonicalHp) ? canonicalHp : 1, 10);
  unit.maxHp = Math.max(Number.isFinite(canonicalMaxHp) ? canonicalMaxHp : unit.hp, unit.hp);
  unit.mechanics = { ...(unit.mechanics || {}), hp: unit.hp, maxHp: unit.maxHp };
  unit.sp = Number.isFinite(Number(unit.sp ?? unit.mechanics?.sp)) ? Number(unit.sp ?? unit.mechanics?.sp) : 0;
  unit.level = unit.effectiveLevel || unit.mechanics?.level || 2;
  unit.faction = 'enemy';
  unit.faccion = 'enemy';
  unit.statusEffects = unit.statusEffects || {};
  unit.stats = unit.stats || {};
  unit.physRes = unit.physRes || 1;
  unit.sinRes = unit.sinRes || 1;
  return unit;
}

const kobold = hydrateCombatant(
  kobolds.resolve('kobold_dagger', { level: 2, initializeEncounter: true }),
  'real_kobold',
  'Real GOAP Kobold',
);

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
  allowGrapple: false,
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

const sling = hydrateCombatant(
  kobolds.resolve('kobold_sling', { level: 2, initializeEncounter: true }),
  'real_sling',
  'Real Sling Kobold',
);
ammo.setAmmo(sling, 'pebbles', 0);
const dryPlan = kitAdapter.planUnitTurn({ actor: sling, targetIds: [player.id], availableSlots: 1, allowEscape: false, allowGrapple: false });
assert.equal(dryPlan.planned, true);
assert.equal(dryPlan.sequence[0].sourceId, 'kobold_duck_away');
assert.equal(dryPlan.kit.unavailable.filter((entry) => entry.reason === 'ammunition_unavailable').length, 2);

console.log(`unit-ai-kit-adapter real-engine smoke: ok (${hpBefore} -> ${player.hp} HP)`);
