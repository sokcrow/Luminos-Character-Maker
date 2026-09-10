import assert from 'node:assert/strict';

await import('../js/status-engine.js');
await import('../js/universal-ranged-ammo-runtime.js');
await import('../js/skill-catalog-kobold-tier1.js');
await import('../js/unit-rank-runtime.js');
await import('../js/unit-combat-mechanics-runtime.js');
await import('../js/unit-catalog-kobold-tier1.js');
await import('../js/combat-action-schema.js');
await import('../js/combat-action-adapters.js');
await import('../js/individual-goap-combat-ai.js');
await import('../js/unit-ai-kit-adapter.js');

const ammo = globalThis.LuminousUniversalRangedAmmoRuntime;
const kobolds = globalThis.LuminousKoboldUnitCatalog;
const kitAdapter = globalThis.LuminousUnitAiKitAdapter;

if (!ammo || !kobolds || !kitAdapter) throw new Error('GOAP resource budget dependencies were not initialized.');

const sling = kobolds.resolve('kobold_sling', { level: 2, initializeEncounter: true });
sling.id = 'budget_sling';
sling.hp = sling.maxHp;
ammo.setAmmo(sling, 'pebbles', 1);
assert.equal(ammo.ammoCount(sling, 'pebbles'), 1);

const plan = kitAdapter.planUnitTurn({
  actor: sling,
  availableSlots: 2,
  targetIds: ['player_1'],
  allowEscape: false,
});

assert.equal(plan.planned, true);
assert.equal(plan.slotsRequested, 2);
assert.equal(plan.actions.length, 2, 'the remaining slot should be usable by the canonical defense');

const ammoActions = plan.actions.filter((action) =>
  (action.resources || []).some((resource) => resource.type === 'ammunition' && resource.id === 'pebbles')
);
assert.equal(ammoActions.length, 1, 'one Pebble can fund only one ranged action across the whole turn');
assert.equal(plan.resourceSpent['ammunition:pebbles'], 1);
assert.ok(plan.sequence.some((entry) => entry.sourceId === 'kobold_duck_away'));

console.log('individual GOAP multi-slot resource budget smoke: ok');
