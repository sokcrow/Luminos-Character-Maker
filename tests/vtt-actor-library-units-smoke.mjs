import assert from 'node:assert/strict';

await import('../js/vtt/actor-library.js');
await import('../js/vtt/actor-library-state.js');

const library = globalThis.LuminousVttActorLibrary;
const state = globalThis.LuminousVttActorLibraryState;
if (!library || !state) throw new Error('Actor Library modules were not initialized.');

assert.equal(state.UNITS_ROOT, 'campaña/base_datos_unidades');

const merged = library.mergeCollections({
  units: {
    unit_wolf: {
      id: 'unit_wolf',
      name: 'Test Wolf',
      faction: 'enemy',
      icono: 'https://example.invalid/wolf.png',
      attack_tier_1_sequence: ['skill:bite'],
    },
  },
});

assert.equal(merged.length, 1);
assert.equal(merged[0].scope, 'units');
assert.equal(merged[0].actorId, 'unit_wolf');
assert.equal(merged[0].category, 'enemy');
assert.deepEqual(merged[0].raw.attack_tier_1_sequence, ['skill:bite']);

const bridge = state.createBridge({ root: globalThis });
bridge.applyUnits({
  unit_guard: { id: 'unit_guard', name: 'Guard', faction: 'ally' },
});
assert.equal(bridge.list().length, 1);
assert.equal(bridge.list()[0].actorId, 'unit_guard');
assert.equal(bridge.list()[0].category, 'ally');

console.log('vtt actor library units smoke: ok');
