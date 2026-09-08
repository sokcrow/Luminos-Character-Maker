import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const loadedSession = require('../js/battle-viewer-firebase-session-074.js');
const session = loadedSession?.version === '0.7.4' ? loadedSession : globalThis.LuminousBattleViewerFirebaseSession074;

function snapshot(value) { return { val: () => value }; }

function firebaseHarness({ uid = 'player_uid', configuredDmUid = 'dm_uid', failPath = null } = {}) {
  const writes = [];
  const values = {
    [session.ROOTS.configDmUid]: configuredDmUid,
    [session.ROOTS.players]: {
      player_a: { uid: 'player_uid', status: 'approved', characterBuild: { spellSelections: ['arc_bolt'] } },
    },
    [session.ROOTS.combatState]: 'PRE_COMBAT_PLANNING',
    [session.ROOTS.combatants]: { 'player:player_a': { id: 'player:player_a', isPlayer: true } },
    [session.ROOTS.plannedActions]: {},
    [session.ROOTS.units]: { unit_a: { id: 'unit_a', action_slots: ['skill_a'] } },
    [session.ROOTS.skills]: { skill_a: { id: 'skill_a' } },
    [session.ROOTS.connected]: true,
  };
  const db = {
    ref(path) {
      return {
        async once(event) {
          assert.equal(event, 'value');
          if (path === failPath) throw Object.assign(new Error(`Permission denied: ${path}`), { code: 'PERMISSION_DENIED' });
          return snapshot(values[path] ?? null);
        },
        set(value) { writes.push(['set', path, value]); },
        update(value) { writes.push(['update', path, value]); },
        transaction(fn) { writes.push(['transaction', path, fn]); },
      };
    },
  };
  const auth = {
    currentUser: uid ? { uid } : null,
    onAuthStateChanged(next) {
      queueMicrotask(() => next(uid ? { uid } : null));
      return () => {};
    },
  };
  const app = { name: '[DEFAULT]' };
  const sdk = {
    apps: [app],
    app: () => app,
    auth: () => auth,
    database: () => db,
    initializeApp() { throw new Error('initializeApp must not run when the default app already exists'); },
  };
  return { sdk, app, auth, db, writes };
}

assert.ok(session, 'Firebase session runtime must attach to globalThis in Node module mode');
assert.equal(session.version, '0.7.4');
assert.equal(session.ROOTS.units, 'campaña/base_datos_unidades');
assert.equal(session.ROOTS.skills, 'campaña/base_datos_skills');
assert.equal(session.ROOTS.plannedActions, 'campaña/combate/plannedActions');

{
  const h = firebaseHarness();
  const services = session.resolveServices({ firebase: h.sdk });
  assert.equal(services.ok, true);
  assert.equal(services.app, h.app);
  assert.equal(services.auth, h.auth);
  assert.equal(services.db, h.db);
}

{
  const h = firebaseHarness();
  const result = await session.preflight({ firebase: h.sdk });
  assert.equal(result.ok, true);
  assert.equal(result.role, 'player');
  assert.equal(result.playerId, 'player_a');
  assert.equal(result.uid, 'player_uid');
  assert.equal(result.dmUid, 'dm_uid');
  assert.equal(result.connected, true);
  assert.equal(result.diagnostics.length, 5);
  assert.deepEqual(h.writes, [], 'Firebase preflight must be read-only');
}

{
  const h = firebaseHarness({ uid: 'dm_uid' });
  const result = await session.preflight({ firebase: h.sdk });
  assert.equal(result.ok, true);
  assert.equal(result.role, 'dm');
  assert.equal(result.playerId, null);
}

{
  const h = firebaseHarness({ uid: session.FALLBACK_DM_UID, configuredDmUid: null });
  const result = await session.preflight({ firebase: h.sdk });
  assert.equal(result.ok, true);
  assert.equal(result.role, 'dm');
  assert.equal(result.dmUid, session.FALLBACK_DM_UID);
}

{
  const h = firebaseHarness({ uid: 'unlinked_uid' });
  const result = await session.preflight({ firebase: h.sdk });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'PLAYER_NOT_LINKED');
}

{
  const h = firebaseHarness({ failPath: session.ROOTS.units });
  const result = await session.preflight({ firebase: h.sdk });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'FIREBASE_READ_PREFLIGHT_FAILED');
  assert.deepEqual(h.writes, []);
}

{
  const h = firebaseHarness();
  h.auth.currentUser = null;
  h.auth.onAuthStateChanged = (next) => { queueMicrotask(() => next(null)); return () => {}; };
  const result = await session.preflight({ firebase: h.sdk, authTimeoutMs: 100 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'AUTH_REQUIRED');
}

const rules = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8'));
const campaign = rules.rules?.['campaña'];
assert.equal(campaign?.['.read'], 'auth != null');
assert.ok(campaign?.base_datos_unidades?.['.write']?.includes("child('dm_uid')"), 'Unit Library must be writable by configured DM');
assert.ok(campaign?.base_datos_skills?.['.write']?.includes("child('dm_uid')"), 'Skill Library must be writable by configured DM');
const planned = campaign?.combate?.plannedActions?.['$ownerPlayerId']?.['$slotIndex'];
assert.ok(planned?.['.write']?.includes("child('dm_uid')"), 'plannedActions DM override must use configured DM');
assert.ok(planned?.['.validate']?.includes("child('dm_uid')"), 'plannedActions validation must use configured DM');
assert.ok(planned?.['.validate']?.includes('equippedSkillIndex'), 'Player Skills must stay loadout-authorized');
assert.ok(planned?.['.validate']?.includes('spellSelections'), 'Player Spells must stay selection-authorized');
assert.ok(campaign?.combate?.['$other']?.['.write']?.includes("child('dm_uid')"), 'DM combat state writes must use configured DM');

const firebaseRc = JSON.parse(fs.readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8'));
assert.equal(firebaseRc.projects?.default, 'luminous-system', 'Firebase CLI must target the production Luminous project');
const firebaseJson = JSON.parse(fs.readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'));
assert.equal(firebaseJson.database?.rules, 'database.rules.json', 'Firebase deploy must publish the reviewed Realtime Database rules file');
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(packageJson.scripts?.['firebase:deploy:rules'], 'npx firebase-tools deploy --only database --project luminous-system');

const runtimeSource = fs.readFileSync(new URL('../js/battle-viewer-runtime-074.js', import.meta.url), 'utf8');
assert.match(runtimeSource, /initializeConfiguredDmConsole/);
assert.match(runtimeSource, /result\.uid === dmConsole\.DM_UID/);
assert.match(runtimeSource, /dmState\.authorized = true/);
assert.match(runtimeSource, /result\.db\.ref\(dmConsole\.ROOTS\.players\)/);
assert.match(runtimeSource, /result\.db\.ref\(dmConsole\.ROOTS\.combatants\)/);

const seederSource = fs.readFileSync(new URL('../dm-skill-starter-status-seeder.html', import.meta.url), 'utf8');
assert.match(seederSource, /id="sync" disabled/);
assert.match(seederSource, /battle-viewer-firebase-session-074\.js/);
assert.match(seederSource, /session\.preflight\(\{firebase\}\)/);
assert.match(seederSource, /result\.role!==['"]dm['"]/);
assert.match(seederSource, /Object\.keys\(payload\)\.length!==216/);

console.log('combat-v074-firebase-contract-smoke: ok');
