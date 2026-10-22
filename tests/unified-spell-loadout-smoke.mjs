import assert from 'node:assert/strict';
await import('../js/spellcasting-runtime.js');
await import('../js/spellcasting-basic-rules-runtime.js');
await import('../js/spell-catalog-core.js');
await import('../js/role-spell-catalog-core.js');
await import('../js/spell-loadout-core.js');
await import('../js/content-registry.js');
await import('../js/content-registry-bootstrap.js');
await import('../js/combat-spell-loadout-074.js');
await import('../js/battle-viewer-player-entry-074.js');
await import('../js/theatre-spell-loadout.js');
const shared = globalThis.LuminousSpellLoadout;
const combat = globalThis.LuminousCombatSpellLoadout074;
const theatre = globalThis.LuminousTheatreSpells;
const entry = globalThis.LuminousBattleViewerPlayerEntry074;
const copy = value => value == null ? value : structuredClone(value);
const applyPatch = (record, updates) => {
  for (const [path, value] of Object.entries(updates)) {
    const parts = path.split('/'); let node = record;
    for (const part of parts.slice(0, -1)) node = node[part] ??= {};
    node[parts.at(-1)] = copy(value);
  }
  return record;
};
const all = shared.catalog();
assert.strictEqual(shared.catalog(), all, 'menu/planner reads reuse catalog hydration instead of cloning every definition');
globalThis.LuminousContentRegistry.register({ type: 'spell', id: 'fixture_spell', definition: { id: 'fixture_spell', contexts: ['theater'] } }, { source: 'test' });
assert.ok(shared.definition('fixture_spell', 'theater'), 'new campaign content invalidates the catalog cache');
globalThis.LuminousContentRegistry.clear({ type: 'spell' });
assert.equal(shared.definition('fixture_spell'), null);
assert.equal(all.length, new Set(all.map(row => row.id)).size, 'one catalog entry per spell identity');
assert.ok(shared.definition('mage_hand', 'combat'));
assert.ok(shared.definition('mage_hand', 'theater'));
assert.ok(shared.definition('mage_hand').classIds.includes('artificer'), 'older Role metadata must not remove current classes');
assert.equal(shared.definition('distort_value', 'combat'), null);
assert.equal(shared.definition('fire_bolt', 'theater'), null);

const player = applyPatch({ uid: 'uid-a', actorId: 'actor-a', classId: 'bard', level: 10,
  characterBuild: { classes: [{ classId: 'bard', levels: 10 }] } }, shared.buildUpdates(['mage_hand', 'distort_value']));
assert.deepEqual(shared.selectedIds(player), ['distort_value', 'mage_hand']);
assert.deepEqual(combat.spellIdsFor(player), ['mage_hand']);
assert.deepEqual(theatre.spellsFor(player).map(row => row.id), ['distort_value', 'mage_hand']);
assert.deepEqual(player.characterBuild.spellSelections, ['mage_hand'], 'Firebase combat-plan rules retain their compatibility projection');
const legacy = { spellIds: ['fire_bolt'], characterBuild: { roleSpellSelections: ['message'] } };
assert.deepEqual(shared.selectedIds(legacy), ['fire_bolt', 'message']);
// Simulate RTDB removing every empty array/map: the versioned assignment still wins.
const cleared = { spellLoadout: { schemaVersion: 1, source: 'dm_loadout_manager' }, spellIds: ['fire_bolt'], characterBuild: { roleSpellSelections: ['message'] } };
assert.deepEqual(shared.selectedIds(cleared), []);
assert.deepEqual(combat.rawSpellIdsFor(cleared), []);
assert.deepEqual(theatre.spellsFor(cleared), []);
for (const raw of [{ spellIds: [] }, { characterBuild: { spellSelections: ['mage_hand'] } }, cleared]) {
  assert.equal(entry.automaticSpellLoadoutForActor({ name: 'Angelo V.', raw }), null, 'deployment cannot overwrite an existing or empty assignment');
}
assert.ok(entry.automaticSpellLoadoutForActor({ name: 'Angelo V.', raw: {} }), 'new records can still import sheet defaults');
assert.throws(() => theatre.prepareCast(player, { uid: 'other', actorId: 'actor-a', spellId: 'mage_hand' }), /verificar/);
assert.throws(() => theatre.prepareCast(player, { uid: 'uid-a', actorId: 'other', spellId: 'mage_hand' }), /actor asignado/);
assert.throws(() => theatre.prepareCast(player, { uid: 'uid-a', actorId: 'actor-a', spellId: 'fire_bolt' }), /asignado/);
const prepared = theatre.prepareCast(player, { uid: 'uid-a', actorId: 'actor-a', spellId: 'mage_hand', description: 'Abre la puerta.' });
assert.equal(prepared.message.tipo_dialogo, 'actuar');
assert.equal(prepared.message.actionDurationSeconds, 6);
assert.equal(prepared.result.resource.type, 'cantrip');
assert.equal(player.spellcastingState, undefined, 'preflight cannot spend resources in the live character');
const messagePlayer = applyPatch(copy(player), shared.buildUpdates(['message']));
const privateCast = theatre.prepareCast(messagePlayer, { uid: 'uid-a', actorId: 'actor-a', spellId: 'message', description: 'secret-content' });
assert.ok(!JSON.stringify(privateCast.message).includes('secret-content'), 'a public casting action cannot reveal a private Message body');

let stored = { campaña: { jugadores: { alice: copy(player) }, teatro: {}, estado_mundo: { escena_actual: {} } } };
let failDelivery = false, deliveryCount = 0;
function get(path) { return path.split('/').filter(Boolean).reduce((node, key) => node?.[key], stored) ?? null; }
function set(path, value) {
  const parts = path.split('/').filter(Boolean); let node = stored;
  for (const part of parts.slice(0, -1)) node = node[part] ??= {};
  if (value === null) delete node[parts.at(-1)]; else node[parts.at(-1)] = copy(value);
}
const db = { ref(path = '') { return {
  async once() { return { val: () => copy(get(path)) }; },
  push() { return { key: 'new-cast' }; },
  async transaction(update) {
    // Simulate the empty-cache callback followed by the server callback.
    update(null);
    const next = update(copy(get(path)));
    if (next === undefined) return { committed: false };
    set(path, next); return { committed: true, snapshot: { val: () => copy(next) } };
  },
  async update(updates) {
    if (failDelivery) throw new Error('offline');
    for (const [key, value] of Object.entries(updates)) set(key, value);
    deliveryCount++;
  }
}; } };
const options = { db, playerId: 'alice', uid: 'uid-a', actorId: 'actor-a', spellId: 'distort_value', requestId: 'cast-1',
  paths: { scene: 'campaña/estado_mundo/escena_actual', queue: 'campaña/teatro/cola', roomId: 'default' } };
const first = await theatre.cast(options);
assert.equal(first.queued, true);
assert.equal(get('campaña/teatro/cola/cast-1').actionDurationSeconds, 60);
assert.ok(get('campaña/teatro/scene_time_requests/default/events/theatre_default_cast-1'));
assert.equal(get('campaña/jugadores/alice/theatreSpellOutbox/cast-1'), null);
const resources = copy(get('campaña/jugadores/alice/spellcastingState'));
assert.equal(resources.slotsByClass.bard.levels['1'].spent, 1, 'Theatre must actually spend one canonical Spell Slot');
await theatre.cast(options);
assert.deepEqual(get('campaña/jugadores/alice/spellcastingState'), resources, 'same request must not spend another Slot');
assert.equal(deliveryCount, 1, 'same completed request must not requeue an action');
failDelivery = true;
const originalError = console.error; console.error = () => {};
const pending = await theatre.cast({ ...options, spellId: 'mage_hand', requestId: 'cast-2' });
console.error = originalError;
assert.equal(pending.pending, true);
assert.ok(get('campaña/jugadores/alice/theatreSpellOutbox/cast-2'));
failDelivery = false;
await theatre.flushOutbox(db, 'alice', get('campaña/jugadores/alice'));
assert.ok(get('campaña/teatro/cola/cast-2'));
assert.equal(get('campaña/jugadores/alice/theatreSpellOutbox/cast-2'), null);
set('campaña/estado_mundo/escena_actual', { transitioning: true });
await assert.rejects(theatre.cast({ ...options, requestId: 'cast-3' }), /cambio de escena/);
assert.equal(get('campaña/jugadores/alice/theatreSpellCasts/cast-3'), null);

// A spell-only change must invalidate live Combat hydration; stale Unit
// snapshots cannot hide a newly assigned spell or resurrect a removed one.
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.firebase = { apps: [{}], auth: () => ({ onAuthStateChanged() {} }), database: () => db };
await import('../js/combat-participants.js');
await import('../js/combat-v073-live-adapter.js');
const live = globalThis.LuminousCombatLiveAdapter073;
Object.assign(live.state, { role: 'dm', players: { alice: player }, combatants: {
  'player:alice': { id: 'player:alice', isPlayer: true, canonicalPlayerKey: 'alice', faction: 'ally', battleActive: true,
    spellLoadout: { schemaVersion: 1, spellIds: ['fire_bolt'] } }
} });
const before = live.normalizedCombatants();
assert.deepEqual(shared.selectedIds(before[0]), shared.selectedIds(player));
const signature = live.hydrationSignature(before, 'player:alice');
live.state.players.alice = { ...player, spellLoadout: { schemaVersion: 1 } };
const after = live.normalizedCombatants();
assert.deepEqual(shared.selectedIds(after[0]), []);
assert.notEqual(live.hydrationSignature(after, 'player:alice'), signature, 'live Player must refresh on spell-only changes');
console.log('Unified spell assignments: context projections, legacy migration, empty selection, deployment, permissions, casting, Scene Time, retry/idempotency passed.');
