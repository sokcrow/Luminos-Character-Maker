import assert from 'node:assert/strict';
await import('../js/dm-loot-queue.js');
const api = globalThis.LuminousDmLootQueue;
const initial = { 'campaña': { config: { dm_uid: 'dm' }, loot_encounters: {
  legacy: { corpses: { kobold: { name: 'Kobold', lootInstanceId: 'legacy-corpse' } } },
  modern: { meta: { open: true, result: 'victory', participants: { p1: true } }, corpses: { wolf: { name: 'Wolf' } } },
  closed: { meta: { open: false }, corpses: { a: {} } },
}, loot_instances: { 'legacy-corpse': { locked: true } }, jugadores: { p1: { inventario_activo: { received: { quantity: 1 } }, dinero: 300 } } } };
const data = structuredClone(initial), writes = [];
const read = path => path.split('/').reduce((value, key) => value?.[key], data);
const db = { ref(path) { return {
  once: async () => ({ val: () => structuredClone(read(path)) }),
  on(_, handler) { handler({ val: () => structuredClone(read(path)) }); }, off() {},
  async transaction(update) {
    const next = update(structuredClone(read(path)));
    if (next === undefined) return { committed: false, snapshot: { val: () => read(path) } };
    const keys = path.split('/'), last = keys.pop(), parent = keys.reduce((value, key) => value[key], data);
    parent[last] = next; writes.push(path);
    return { committed: true, snapshot: { val: () => structuredClone(next) } };
  },
}; } };
assert.deepEqual(api.activeQueues(data.campaña.loot_encounters).map(row => row.key).sort(), ['legacy', 'modern']);
await assert.rejects(api.closeQueue({ db, key: 'legacy', uid: 'player' }), /Solo el DM/);
await assert.rejects(api.closeQueue({ db, key: '../legacy', uid: 'dm' }), /identificar/);
assert.equal(writes.length, 0);
await api.closeQueue({ db, key: 'legacy', uid: 'dm', now: 123 });
assert.equal(data.campaña.loot_encounters.legacy.meta.open, false, 'legacy rows without metadata must close');
assert.equal(data.campaña.loot_encounters.legacy.meta.closedByDm, true);
assert.deepEqual(api.activeQueues(data.campaña.loot_encounters).map(row => row.key), ['modern']);
assert.deepEqual(data.campaña.jugadores, initial.campaña.jugadores, 'removing a queue must preserve delivered items and cash');
assert.deepEqual(data.campaña.loot_instances, initial.campaña.loot_instances, 'corpse history must remain intact');
await api.closeQueue({ db, key: 'legacy', uid: 'dm', now: 999 });
assert.equal(data.campaña.loot_encounters.legacy.meta.closedAt, 123, 'repeated close is idempotent');
await api.closeQueue({ db, key: 'modern', uid: 'dm', now: 456 });
assert.deepEqual(api.activeQueues(data.campaña.loot_encounters), []);
assert.deepEqual(data.campaña.loot_encounters.modern.meta.participants, { p1: true });
console.log('DM loot queues: legacy cleanup, DM-only authorization, idempotency and preservation of confirmed deliveries passed.');
