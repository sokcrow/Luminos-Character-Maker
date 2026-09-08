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
      visual: { spriteUrl: 'https://example.invalid/wolf.png' },
      action_slots: ['bite', 'howl', 'bite'],
    },
  },
});

assert.equal(merged.length, 1);
assert.equal(merged[0].scope, 'units');
assert.equal(merged[0].actorId, 'unit_wolf');
assert.equal(merged[0].category, 'enemy');
assert.equal(merged[0].tokenImage, 'https://example.invalid/wolf.png');
assert.deepEqual(merged[0].skillIds, ['bite', 'howl']);

const token = library.tokenFromActor(merged[0], { x: 10, y: 10 }, { grid:{ size:70, cols:10, rows:10 } });
assert.equal(token.actorRef.scope, 'units');
assert.equal(token.actorRef.id, 'unit_wolf');
assert.deepEqual(token.skillIds, ['bite', 'howl']);

const bridge = state.createBridge({ root: globalThis });
bridge.applyUnits({
  unit_guard: { id: 'unit_guard', name: 'Guard', faction: 'ally', action_slots:['shield_bash'] },
});
assert.equal(bridge.list().length, 1);
assert.equal(bridge.list()[0].actorId, 'unit_guard');
assert.equal(bridge.list()[0].category, 'ally');
assert.deepEqual(bridge.list()[0].skillIds, ['shield_bash']);

console.log('vtt actor library units smoke: ok');
