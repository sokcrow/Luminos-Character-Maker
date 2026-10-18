// Real Firebase Auth/RTDB test of production loadout + authority modules.
// The DOM and runtime adapter are harnesses; this does not certify live browser
// combat choreography. The separate Playwright suite covers that surface.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { emulatorHosts, seedPhase0, readEmulator, writeEmulator, PROJECT, NAMESPACE, PASSWORD } from './fixtures/combat-phase0-fixture.mjs';

const require = createRequire(import.meta.url);
const firebase = require('firebase/compat/app');
require('firebase/compat/auth');
require('firebase/compat/database');
const contract = JSON.parse(fs.readFileSync(new URL('../combat/runtime-contract.json', import.meta.url)));
const hosts = emulatorHosts();
// The Node RTDB SDK applies HTTP_PROXY even to loopback WebSockets. All
// endpoints in this isolated test are emulator-only; do not proxy them.
for (const key of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']) delete process.env[key];
let stage = 'seeding';
const deadline = setTimeout(() => { console.error('Combat emulator timed out at:', stage); process.exit(1); }, 45000);
const fixture = await seedPhase0();
const apps = [];
const timers = new Set();
try {
  const sessions = {};
  for (const role of ['dm', 'a', 'b']) {
    stage = `auth:${role}`;
    const app = firebase.initializeApp({ apiKey: 'fake', projectId: PROJECT, databaseURL: `https://${NAMESPACE}.firebaseio.com` }, `phase0-${role}`);
    apps.push(app);
    app.auth().useEmulator(`http://${hosts.auth}`, { disableWarnings: true });
    app.database().useEmulator(hosts.database.split(':')[0], Number(hosts.database.split(':')[1]));
    await app.auth().signInWithEmailAndPassword(fixture.users[role].email, PASSWORD);
    sessions[role] = { app, db: app.database() };
    assert.equal(app.auth().currentUser.uid, fixture.users[role].uid);
  }
  const fields = Object.fromEntries([1, 2, 3].map((tier, i) => [`dm-loadout-tier-${tier}`, { value: ['phase0_cut', 'phase0_thrust', 'phase0_finish'][i] }]));
  for (const key of ['deck-feedback', 'spell-feedback', 'save-deck', 'save-spells']) fields[`dm-loadout-${key}`] = {};
  const units = structuredClone(fixture.campaign.combate.combatants);
  const adapterState = { db: sessions.dm.db, uid: fixture.users.dm.uid, user: { uid: fixture.users.dm.uid }, role: 'dm', round: 1, combatants: units, combatState: 'PRE_COMBAT_PLANNING' };
  const window = {
    console, Math: Object.create(Math), crypto: globalThis.crypto,
    document: { readyState: 'loading', addEventListener() {}, getElementById(id) { return fields[id] || null; } },
    addEventListener() {}, removeEventListener() {},
    setTimeout(callback, ms) { const id = setTimeout(callback, ms); timers.add(id); return id; }, clearTimeout,
    firebase,
    LuminousCombatLiveAdapter073: { state: adapterState },
    LuminousCombat073: { combatants: () => units, plans: () => [], render() {} },
  };
  const sandbox = vm.createContext({ window, console });
  for (const file of ['dm-player-loadout-core.js', 'combat-skill-loadout-074.js', 'dm-player-loadout-manager.js']) {
    vm.runInContext(fs.readFileSync(new URL(`../js/${file}`, import.meta.url), 'utf8'), sandbox, { filename: file });
  }
  const manager = window.LuminousDmPlayerLoadoutManager;
  Object.assign(manager.state, { db: sessions.dm.db, playerId: 'a', player: fixture.campaign.jugadores.a, skills: fixture.skills, units: fixture.units });
  stage = 'DM loadout write';
  assert.equal(await manager.saveDeck(), true);
  for (const role of ['a', 'b']) {
    const value = (await sessions[role].db.ref(contract.roots.combatants + '/player:a').once('value')).val();
    assert.deepEqual(value.skillIds, ['phase0_cut', 'phase0_thrust', 'phase0_finish']);
  }
  const saved = await readEmulator('campaña');
  assert.deepEqual(saved.base_datos_unidades['unit-a'].skillIds, saved.combate.combatants['player:a'].skillIds);
  assert.deepEqual(saved.jugadores.a.skillIds, saved.combate.combatants['player:a'].skillIds);
  assert.deepEqual(saved.combate.combatants['player:b'].skillIds, ['old_strike']);
  assert.deepEqual(saved.combate.combatants['enemy:dummy'].skillIds, ['old_strike']);

  const planFor = (id) => ({ schemaVersion: contract.planSchemaVersion, engineVersion: contract.planEngineVersion,
    unitId: `player:${id}`, scheduledBy: id, schedulerUid: fixture.users[id].uid, status: 'planned', round: 1,
    sourceSlotIndex: 0, kind: 'skill', skillId: id === 'a' ? 'phase0_cut' : 'old_strike', targetId: 'enemy:dummy', targetSlotIndex: 0 });
  for (const id of ['a', 'b']) {
    stage = `plan:${id}`;
    await sessions[id].db.ref(`${contract.roots.plans}/${id}/0`).set(planFor(id));
    await sessions[id].db.ref(`${contract.roots.ready}/${id}`).set({ ready: true, round: 1, schedulerUid: fixture.users[id].uid, unitId: `player:${id}`, plannedSlots: 1 });
  }
  await assert.rejects(sessions.b.db.ref(`${contract.roots.plans}/a/0`).set(planFor('a')), /permission_denied/i);
  await assert.rejects(sessions.a.db.ref(contract.roots.plans).remove(), /permission_denied/i);
  await assert.rejects(sessions.a.db.ref(contract.roots.ready).remove(), /permission_denied/i);
  await assert.rejects(sessions.a.db.ref(contract.roots.authority).set({ phase: 'running', round: 1, seed: 999 }), /permission_denied/i);
  await assert.rejects(sessions.a.db.ref(`${contract.roots.combatants}/enemy:dummy/hp`).set(0), /permission_denied/i);
  vm.runInContext(fs.readFileSync(new URL('../js/combat-v073-authority.js', import.meta.url), 'utf8'), sandbox);
  const authority = window.LuminousCombatAuthority073;
  stage = 'seal';
  const sealed = await authority.sealRound();
  assert.equal(sealed.schemaVersion, contract.authoritySchemaVersion);
  assert.equal(sealed.engineVersion, contract.authorityEngineVersion);
  assert.equal(sealed.authorityUid, fixture.users.dm.uid);
  assert.ok(sealed.seed > 0);
  assert.deepEqual(JSON.parse(JSON.stringify(sealed.plans.a[0])), planFor('a'));
  for (const role of ['a', 'b']) {
    const remote = (await sessions[role].db.ref(contract.roots.authority).once('value')).val();
    assert.equal(remote.seed, sealed.seed);
    assert.equal(remote.phase, 'sealed');
  }
  await assert.rejects(sessions.a.db.ref(`${contract.roots.plans}/a/0`).set(planFor('a')), /permission_denied/i);
  // Test the actual checkpoint/round-close transport with unchanged fixture
  // vitals; damage/choreography are deliberately left to the browser suite.
  const final = await authority.afterRound({ completedRound: 1, nextRound: 2 });
  const canonical = await readEmulator(contract.roots.authority);
  assert.equal(canonical.phase, 'complete');
  assert.equal(canonical.checkpoint.digest, final.digest);
  assert.equal((await readEmulator(contract.roots.state)).round, 2);
  assert.equal(await readEmulator(contract.roots.plans), null);
  assert.equal(await readEmulator(contract.roots.ready), null);
  authority.stop();
  console.log('Combat Phase 0 Auth/RTDB: 3 authenticated sessions; loadout isolation, plans, DM seal and checkpoint transport passed');
  stage = 'phase2-protocol';
  // Competing tabs use the production transaction and the real DM Auth UID.
  await writeEmulator(contract.roots.authority, null);
  const tabs = [0, 1].map(index => {
    const win = { Math, Date, console, crypto: { randomUUID: () => `test-dm-tab-${index}` }, addEventListener() {},
      LuminousCombatLiveAdapter073: { state: { db: sessions.dm.db } } };
    win.window = win;
    for (const name of ['playback', 'playback-sync']) vm.runInNewContext(fs.readFileSync(new URL(`../js/combat-v073-${name}.js`, import.meta.url), 'utf8'), win);
    win.LuminousCombatPlaybackSync.state.authority = { ROOT: { current: contract.roots.authority },snapshotRuntime:()=>({'player:a':{hp:100,statusEffects:{},pendingStatusEffects:[]}}) };
    return win.LuminousCombatPlaybackSync;
  });
  const outcomes = await Promise.allSettled(tabs.map(tab => tab.seal({ round: 1, seed: 8, phase: 'sealed' })));
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(result => result.status === 'rejected').length, 1);
  const owner = outcomes.findIndex(result => result.status === 'fulfilled');
  const seal = outcomes[owner].value;
  assert.throws(() => tabs[1 - owner].assertOwner(seal), /otra pestaña/);
  const root = contract.playback.root;
  const row = { schemaVersion: 1, engineVersion: contract.playback.engineVersion, generation: seal.id,
    seq: 1, payload:JSON.stringify({eventCursor: 1, rngCursor: 2, digest: 'result-one', type: 'action', combatants: { 'player:a': { hp: 90, arrows: 2, statusEffects:{}, pendingStatusEffects:[] } }}) };
  const commit = { [root]: { generation: seal.id, schemaVersion: 1, engineVersion: contract.playback.engineVersion, batches: { '000001': row } },
    [contract.roots.authority + '/checkpoint']: row, ['campaña/jugadores/a/phase2TestArrows']: 2 };
  await sessions.dm.db.ref().update(commit).catch(error => {throw new Error('phase2 first atomic commit: '+error.message);});
  await sessions.dm.db.ref().update(commit).catch(error => {throw new Error('phase2 identical retry: '+error.message);}); // exact retry is idempotent
  assert.equal(JSON.parse((await readEmulator(root)).batches['000001'].payload).combatants['player:a'].arrows, 2);
  for (const role of ['a', 'b']) {
    await assert.rejects(sessions[role].db.ref(root + '/batches/000002').set({ ...row, seq: 2 }), /permission_denied/i);
    await assert.rejects(sessions[role].db.ref(root).remove(), /permission_denied/i);
  }
  await assert.rejects(sessions.dm.db.ref(root + '/batches/000001').set({ ...row, payload:JSON.stringify({digest:'rewritten'}) }), /permission_denied/i);
  await assert.rejects(sessions.dm.db.ref(root + '/batches/000002').set({ ...row, seq: 2, generation: 'old' }), /permission_denied/i);
  assert.equal((await readEmulator(contract.roots.authority)).checkpoint.payload, row.payload);
  assert.equal(await readEmulator('campaña/jugadores/a/phase2TestArrows'), 2);
  console.log('Combat Phase 2 Auth/RTDB: competing DM transactions, atomic retry, immutable batches and Player denial passed');
} finally {
  stage = 'cleanup';
  for (const timer of timers) clearTimeout(timer);
  for (const app of apps) {
    app.database().goOffline();
    await app.auth().signOut();
    await app.delete();
  }
  clearTimeout(deadline);
}
