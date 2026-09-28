import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// Universal Library: canonical content stays on the existing authorized roots,
// while the tiny manifest lives under Combat and records are fetched by ID.
delete globalThis.LuminousUniversalLibrary;
await import(`../js/universal-library-runtime.js?authority-smoke=${Date.now()}`);
const lib = globalThis.LuminousUniversalLibrary;
assert.ok(lib, 'Universal Library ESM side effect must expose its runtime API');
assert.equal(lib.ROOTS.manifestUnits, 'campaña/combate/libraryManifest/units');
assert.equal(lib.ROOTS.manifestSkills, 'campaña/combate/libraryManifest/skills');
assert.equal(lib.ROOTS.units, 'campaña/base_datos_unidades');
assert.equal(lib.ROOTS.skills, 'campaña/base_datos_skills');

function makeDb(seed = {}) {
  const store = structuredClone(seed);
  const reads = [];
  const writes = [];
  const parts = (path = '') => String(path).split('/').filter(Boolean);
  const get = (path = '') => parts(path).reduce((node, key) => node?.[key], store);
  const set = (path, value) => {
    const keys = parts(path);
    if (!keys.length) throw new Error('root set unsupported in test');
    let node = store;
    for (let i = 0; i < keys.length - 1; i += 1) node = node[keys[i]] ||= {};
    if (value == null) delete node[keys.at(-1)];
    else node[keys.at(-1)] = structuredClone(value);
  };
  const db = {
    ref(path = '') {
      return {
        async once() { reads.push(path); return { val: () => structuredClone(get(path) ?? null) }; },
        async update(updates) { for (const [key, value] of Object.entries(updates || {})) { writes.push(key); set(key, value); } },
        async set(value) { writes.push(path); set(path, value); },
      };
    },
  };
  return { db, store, reads, writes };
}

const fake = makeDb();
const unit = { id: 'test_goblin', name: 'Test Goblin', metadata: { canonicalUnit: true }, action_slots: ['test_slash'] };
const skill = { id: 'test_slash', name: 'Test Slash', basePower: 5, coinPower: 2, coinAmount: 1 };
await lib.publish(fake.db, { units: { test_goblin: unit }, skills: { test_slash: skill } });
assert.ok(fake.writes.includes('campaña/base_datos_unidades/test_goblin'));
assert.ok(fake.writes.includes('campaña/base_datos_skills/test_slash'));
assert.ok(fake.writes.includes('campaña/combate/libraryManifest/units/test_goblin'));
assert.ok(fake.writes.includes('campaña/combate/libraryManifest/skills/test_slash'));

lib.clearCache();
fake.reads.length = 0;
const loadedSkill = await lib.getSkill(fake.db, 'test_slash');
assert.equal(loadedSkill.record.name, 'Test Slash');
assert.deepEqual(fake.reads, [
  'campaña/combate/libraryManifest/skills/test_slash',
  'campaña/base_datos_skills/test_slash',
]);
const beforeCachedReadCount = fake.reads.length;
await lib.getSkill(fake.db, 'test_slash');
assert.equal(fake.reads.length, beforeCachedReadCount, 'cached Skill must not re-read Firebase');

const custom = makeDb({ campaña: { base_datos_unidades: { custom_rat: { id: 'custom_rat', name: 'Custom Rat', action_slots: [] } } } });
lib.clearCache();
const customRow = await lib.getUnit(custom.db, 'custom_rat');
assert.equal(customRow.source, 'campaign');
assert.equal(customRow.record.name, 'Custom Rat');
assert.deepEqual(custom.reads, [
  'campaña/combate/libraryManifest/units/custom_rat',
  'campaña/base_datos_unidades/custom_rat',
]);

// First manifest bootstrap must preserve DM-authored visual fields on an already
// persisted canonical Unit instead of replacing the record wholesale.
const customized = makeDb({
  campaña: {
    base_datos_unidades: {
      test_goblin: {
        ...unit,
        visual: { spriteUrl: 'dm-custom.png', spriteX: 17, spriteY: -4, scale: 1.4 },
        combatSprite: 'dm-custom.png',
      },
    },
  },
});
lib.clearCache();
await lib.publish(customized.db, { units: { test_goblin: unit }, skills: { test_slash: skill } });
assert.equal(customized.store.campaña.base_datos_unidades.test_goblin.visual.spriteUrl, 'dm-custom.png');
assert.equal(customized.store.campaña.base_datos_unidades.test_goblin.visual.spriteX, 17);
assert.equal(customized.store.campaña.base_datos_unidades.test_goblin.combatSprite, 'dm-custom.png');

const planSync = read('js/combat-v073-plan-sync.js');
assert.match(planSync, /syncLiveTargets/);
assert.match(planSync, /readyPlayers\/\$\{ctx\.owner\}/);
assert.match(planSync, /targetIntents:targets/);
assert.match(planSync, /plannedActions\/\$\{ctx\.owner\}/);
assert.match(planSync, /ready&&ctx\.plans\[i\]\?payloadFor/);
assert.doesNotMatch(planSync, /combat_private/);

const remote = read('js/combat-v073-remote-intents.js');
assert.match(remote, /READY_ROOT='campaña\/combate\/readyPlayers'/);
assert.match(remote, /AUTH_ROOT='campaña\/combate\/authority\/current'/);
assert.match(remote, /rowsFromReady/);
assert.match(remote, /full\?\(state\.authority\?\.plans\|\|\{\}\):state\.rawTargets/);

const liveAdapter = read('js/combat-v073-live-adapter.js');
const libraryClient = read('js/combat-v073-library-client.js');
assert.match(libraryClient, /getSkill\(s\.db,id/);
assert.match(libraryClient, /requiredIds\(\)/);
assert.match(libraryClient, /detachBulkSkills/);
assert.ok(!/subscribe\(ROOTS\.skills/.test(liveAdapter) || /0\.7\.3-live\.2/.test(liveAdapter), 'new adapter must be sparse or guarded by the bridge');

const authoritySource = read('js/combat-v073-authority.js');
function authorityContext() {
  const combatants = {
    'player:a': { id: 'player:a', name: 'A', controlled: 'player', isPlayer: true, canonicalPlayerKey: 'a', canonicalOwnerUid: 'uid-a', hp: 30, maxHp: 30, sp: 0, speed: 5, speedTie: 0.2, actionSlots: 1, activeSlots: 1, statusEffects: {} },
    'player:b': { id: 'player:b', name: 'B', controlled: 'remote', isPlayer: true, canonicalPlayerKey: 'b', canonicalOwnerUid: 'uid-b', hp: 28, maxHp: 28, sp: 0, speed: 4, speedTie: 0.3, actionSlots: 1, activeSlots: 1, statusEffects: {}, autoPlans: [{ type: 'deck', data: { id: 'b_skill' }, sourceSlotIndex: 0 }] },
    goblin: { id: 'goblin', name: 'Goblin', controlled: 'ai', hp: 20, maxHp: 20, sp: -5, speed: 3, speedTie: 0.4, actionSlots: 1, activeSlots: 1, statusEffects: { bleed: { potency: 2, count: 3 } }, autoPlans: [] },
  };
  const runtime = { combatants: () => combatants, plans: () => [], render() {} };
  const context = {
    console,
    Math: Object.create(Math),
    Date,
    Uint32Array,
    JSON,
    Object,
    Array,
    Map,
    Set,
    Number,
    String,
    Boolean,
    Promise,
    crypto: { getRandomValues(array) { array[0] = 123456789; return array; } },
    firebase: { database: { ServerValue: { TIMESTAMP: 1 } } },
    LuminousCombat073: runtime,
    LuminousCombatLiveAdapter073: { state: { role: 'player', playerId: 'a', uid: 'uid-a', round: 1, combatState: 'COMBAT', combatants, db: null, user: { uid: 'uid-a' } } },
    LuminousCombatRemoteIntents073: { runtimePlan: (raw, slot) => ({ type: 'deck', data: raw.actionData || { id: raw.skillId }, sourceSlotIndex: slot, targetId: raw.targetId || null }) },
    buildExecutionQueue: () => [{ ownerId: 'player:a', ownerName: 'A', localIndex: 0, speed: 5, tieSeed: 0.2, plan: { type: 'deck', data: { id: 'a_skill' } }, controller: 'player' }],
    executeQueueEntry: async () => true,
    unitSlots: () => [{ index: 0 }],
    document: { getElementById: () => null },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    setTimeout() { return 0; },
    clearTimeout() {},
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(authoritySource, context, { filename: 'combat-v073-authority.js' });
  return context;
}

const a = authorityContext();
const b = authorityContext();
for (const ctx of [a, b]) {
  ctx.LuminousCombatAuthority073.state.current = { round: 1, phase: 'running', seed: 424242 };
  ctx.LuminousCombatAuthority073.resetRandom(424242, 0);
}
const seqA = Array.from({ length: 20 }, () => a.LuminousCombatAuthority073.random());
const seqB = Array.from({ length: 20 }, () => b.LuminousCombatAuthority073.random());
assert.deepEqual(seqA, seqB, 'all viewers must consume the same mechanical RNG sequence');

for (const ctx of [a, b]) ctx.LuminousCombatAuthority073.resetRandom(424242, 20);
const snapA = a.LuminousCombatAuthority073.snapshotRuntime();
const snapB = b.LuminousCombatAuthority073.snapshotRuntime();
assert.equal(a.LuminousCombatAuthority073.checkpointDigest(snapA, 1), b.LuminousCombatAuthority073.checkpointDigest(snapB, 1));

a.LuminousCombatAuthority073.installHooks();
const queue = a.buildExecutionQueue();
assert.ok(queue.some((row) => row.ownerId === 'player:a'));
assert.ok(queue.some((row) => row.ownerId === 'player:b'), 'remote Player must be in the shared execution queue');

const readiness = a.LuminousCombatAuthority073.readyComplete(
  { a: { ready: true, round: 1, plannedSlots: 1 }, b: { ready: true, round: 1, plannedSlots: 1 } },
  { a: { 0: { skillId: 'a_skill' } }, b: { 0: { skillId: 'b_skill' } } },
  1,
);
assert.equal(readiness.complete, true);
const missingPlan = a.LuminousCombatAuthority073.readyComplete(
  { a: { ready: true, round: 1, plannedSlots: 1 }, b: { ready: true, round: 1, plannedSlots: 1 } },
  { a: { 0: { skillId: 'a_skill' } }, b: {} },
  1,
);
assert.equal(missingPlan.complete, false);
assert.ok(missingPlan.missing.includes('b:PLAN'));

console.log('Universal Library + authoritative Combat smoke: PASS');
