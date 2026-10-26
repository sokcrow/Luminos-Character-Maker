import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
// Load the same AI and universal-action validators used by the encounter.
// A READY/subscription regression must not silently bypass roster validation.
function loadUniversalAi(context) {
  for (const name of [
    'combat-action-schema', 'combat-action-adapters', 'individual-goap-combat-ai',
    'unit-ai-kit-adapter', 'unit-ai-universal-actions', 'unit-independent-actions',
    'unit-universal-action-policy', 'unit-universal-action-runtime',
  ]) vm.runInContext(source('js/' + name + '.js'), context, { filename: name + '.js' });
}
function harness() {
  const timers = [], errors = [];
  const status = { textContent: '' };
  const c = vm.createContext({
    console: { log() {}, warn() {}, error(...args) { errors.push(args); } },
    Math, Date, JSON, Promise, Map, Set, WeakMap, WeakSet, Uint32Array,
    setTimeout(fn) { timers.push(fn); return timers.length; },
    clearTimeout() {}, setInterval() { return 1; }, clearInterval() {},
    addEventListener() {},
    document: { getElementById(id) { return id === 'status' ? status : null; } },
  });
  c.window = c;
  c.globalThis = c;
  vm.runInContext(source('js/combat-participants.js'), c);
  loadUniversalAi(c);
  return { c, timers, errors, status };
}

// AI can be prepared even if an unrelated Player-only Skill is absent from
// the sparse catalog. Only missing AI skills are prerequisites for AI plans.
{
  const { c } = harness();
  const units = {};
  for (let i = 1; i <= 6; i++) {
    units['player:p' + i] = { id: 'player:p' + i, isPlayer: true,
      canonicalPlayerKey: 'p' + i, battleActive: true, controlled: 'remote',
      skillIds: ['player-only-unavailable'] };
  }
  units.enemy = { id: 'enemy', battleActive: true, controlled: 'ai',
    skillIds: ['bite'], faction: 'enemy', hp: 10, maxHp: 10, autoPlans: [], aiUniversalActions: [] };
  let published = 0, rechecked = 0;
  const db = { ref() { return {
    on() {}, off() {}, async set() { published++; },
    async once() { return { val: () => null }; }
  }; } };
  c.LuminousCombatLiveAdapter073 = { state: { role: 'dm', user: {}, uid: 'dm',
    round: 2, combatState: 'PRE_COMBAT_PLANNING', hydratedOnce: true,
    combatants: units, db, skills: { bite: { id: 'bite', name: 'Bite', kind: 'skill', basePower: 8, coinAmount: 1 } } },
    skillIdsFor(unit) { return unit.skillIds || []; } };
  c.LuminousCombat073 = { combatants: () => units, render() {},
    kit(id) { return { actions: (units[id]?.skillIds || [])
      .map(skillId => c.LuminousCombatLiveAdapter073.state.skills?.[skillId]).filter(Boolean) }; } };
  c.LuminousCombatAuthority073 = { state: { readyRows: {} },
    serializeRuntimePlan() { return {}; }, maybeAutoStart() { rechecked++; } };
  vm.runInContext(source('js/combat-v073-remote-intents.js'), c);
  const availableSkills = c.LuminousCombatLiveAdapter073.state.skills;
  c.LuminousCombatLiveAdapter073.state.skills = {};
  assert.equal(await c.LuminousCombatRemoteIntents073.publishPlanningAi(), false, 'Missing enemy skill must still wait');
  assert.equal(published, 0);
  c.LuminousCombatLiveAdapter073.state.skills = availableSkills;
  assert.equal(await c.LuminousCombatRemoteIntents073.publishPlanningAi(), true);
  assert.equal(published, 1, 'Missing Player skill must not block enemy AI');
  assert.equal(rechecked, 1, 'AI readiness must trigger a new turn-start check');
}

// Real subscription path: late actions must restart automatically without another
// READY write, hydration event, manual start, or direct maybeAutoStart() call.
async function subscribedEncounter({ cancelReady = false, staleUnit = false, stopped = false, lateIdentity = false } = {}) {
  const root = 'campaña/combate', clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const timers = new Map(), listeners = new Map(), events = new Map(), errors = [];
  let timerId = 0, currentTurn = 2, runs = 0, seals = 0;
  const status = { textContent: '' };
  const c = vm.createContext({
    Math: Object.create(Math), Date, JSON, Promise, Map, Set, WeakMap, WeakSet, Uint32Array,
    console: { log() {}, warn() {}, error(...args) { errors.push(args); } },
    setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(name, fn) { if (!events.has(name)) events.set(name, []); events.get(name).push(fn); },
    document: { getElementById(id) { return id === 'status' ? status : id === 'round' ? { textContent: String(currentTurn) } : null; } },
  });
  c.window = c; c.globalThis = c;
  for (const file of ['combat-participants', 'combat-session-lifecycle', 'skill-catalog-kobold-tier1'])
    vm.runInContext(source('js/' + file + '.js'), c);
  loadUniversalAi(c);
  const skills = c.LuminousKoboldTier1SkillCatalog.firebasePayload();
  const units = {}, readyPlayers = {}, plannedActions = {};
  const kinds = ['skill', 'defense', 'item', 'global', 'spell', 'skill'];
  for (let i = 1; i <= 6; i++) {
    const playerId = 'p' + i, unitId = 'player:' + playerId, kind = kinds[i - 1];
    units[unitId] = { id: unitId, canonicalPlayerKey: playerId, isPlayer: true,
      name: 'Jugador ' + i, battleActive: true, deploymentState: 'field', faction: 'ally',
      controlled: 'remote', hp: 20, maxHp: 20, actionSlots: i === 6 ? 2 : 1,
      speed: 8 - i, skillIds: ['player-exclusive-' + i], classes: [{ classId: 'wizard', levels: 3 }] };
    readyPlayers[playerId] = { ready: true, round: 2, unitId, plannedSlots: i === 6 ? 2 : 1 };
    plannedActions[playerId] = { 0: { unitId, round: 2, scheduledBy: playerId, kind,
      skillId: 'player-exclusive-' + i, spellId: 'magic_missile', itemId: 'potion', actionKey: 'dodge',
      actionData: { id: 'chosen-' + i, name: 'Elección ' + i, kind }, targetId: 'kobold:1' } };
  }
  // The global fixture must use an actual Universal Action. Help targets an
  // existing allied Skill/Slot rather than an enemy or an unsupported dodge key.
  plannedActions.p4[0].actionKey = 'help';
  plannedActions.p4[0].actionData.actionKey = 'help';
  plannedActions.p4[0].targetId = 'player:p1';
  plannedActions.p4[0].targetSlotIndex = 0;
  plannedActions.p6[1] = { ...plannedActions.p6[0], skillId: 'player-exclusive-second',
    actionData: { id: 'second-choice', name: 'Segunda Skill', kind: 'skill' }, sourceSlotIndex: 1 };
  const delayed = clone(plannedActions.p6);
  delete plannedActions.p6;
  for (let i = 1; i <= 3; i++) {
    const id = 'kobold:' + i, skillId = i === 2 ? 'kobold_sling_shot' : 'kobold_dagger_jab';
    units[id] = { id, name: 'Kobold ' + i, controlled: 'ai', faction: 'enemy',
      battleActive: true, hp: 12, maxHp: 12, actionSlots: 1, speed: i,
      skillIds: [skillId], aiUniversalActions: [], autoPlans: [{ type: 'auto', data: skills[skillId], targetId: 'player:p' + i }] };
  }
  let data = { campaña: { combate: { estado: { phase: 'PRE_COMBAT_PLANNING', active: true, round: 2 },
    combatants: clone(units), readyPlayers, plannedActions } } };
  const get = path => path.split('/').filter(Boolean).reduce((row, key) => row?.[key], data) ?? null;
  const snapshot = path => { const value = clone(get(path)); return { val: () => clone(value) }; };
  function put(path, value) {
    const parts = path.split('/').filter(Boolean); let node = data;
    for (const key of parts.slice(0, -1)) node = node[key] ||= {};
    node[parts.at(-1)] = clone(value);
  }
  function notify(paths) {
    for (const [path, handlers] of [...listeners]) {
      if (paths.some(changed => changed === path || changed.startsWith(path + '/') || path.startsWith(changed + '/')))
        for (const fn of [...handlers]) fn(snapshot(path));
    }
  }
  const db = { ref(path = '') { return {
    on(_event, fn) { if (!listeners.has(path)) listeners.set(path, new Set()); listeners.get(path).add(fn); fn(snapshot(path)); },
    off(_event, fn) { listeners.get(path)?.delete(fn); },
    async once() { return snapshot(path); },
    async set(value) { put(path, value); notify([path]); },
    async update(updates) {
      const paths = Object.keys(updates).map(key => path ? path + '/' + key : key);
      Object.values(updates).forEach((value, i) => put(paths[i], value)); notify(paths);
    },
    async transaction(mutate) {
      const next = mutate(clone(get(path)));
      if (next === undefined) return { committed: false, snapshot: snapshot(path) };
      if (next.authority?.current?.phase === 'sealed') seals++;
      put(path, next); notify([path]); return { committed: true, snapshot: snapshot(path) };
    },
  }; } };
  c.LuminousCombatLiveAdapter073 = { state: { role: lateIdentity ? null : 'dm', isAuthority: !lateIdentity, user: {}, uid: 'dm',
    db, round: 2, combatState: 'PRE_COMBAT_PLANNING', firebaseReady: true, hydratedOnce: true,
    combatants: clone(units), skills }, skillIdsFor: unit => unit.skillIds || [] };
  c.LuminousSpellcastingRuntime = { getClassSpellcastingProfile: () => ({ spellcastingStartLimbusLevel: 1 }) };
  c.LuminousCombat073 = { combatants: () => units, plans: () => [], render() {},
    kit: id => ({ actions: (units[id].skillIds || []).map(key => skills[key]).filter(Boolean) }) };
  c.combatData = units; c.PLAYER_ID = 'observer'; c.AUTO_UNIT_IDS = Object.keys(units);
  c.plannedActions = []; c.playerSlots = () => [];
  c.unitSlots = id => Array.from({ length: units[id].actionSlots }, () => ({}));
  const live = source('combat/source/combat-v073-live.html');
  vm.runInContext(live.slice(live.indexOf('function buildExecutionQueue('), live.indexOf('const TIMELINE_SPEED_STEP_MS')), c);
  let queue;
  c.startRound = async () => { runs++; queue = c.buildExecutionQueue(); currentTurn++; };
  vm.runInContext(source('js/combat-v073-authority.js'), c);
  if (lateIdentity) {
    Object.assign(c.LuminousCombatLiveAdapter073.state, { role: 'dm', isAuthority: true });
    for (const fn of events.get('luminous:combat073-hydrated') || []) fn({});
  }
  vm.runInContext(source('js/combat-v073-remote-intents.js'), c);
  const authority = c.LuminousCombatAuthority073;
  async function flush() {
    for (let n = 0; timers.size && n < 50; n++) {
      const [id, fn] = timers.entries().next().value; timers.delete(id); await fn();
    }
    assert.equal(timers.size, 0, 'No polling loop should remain while waiting for plans');
  }
  await flush();
  assert.equal(runs, 0); assert.equal(seals, 0);
  assert.match(status.textContent, /Jugador 6/);
  assert.ok(authority.readyComplete(readyPlayers, plannedActions, 2).missing.includes('p6:PLAN'));
  // A stale round's actions arriving first cannot satisfy the current READY.
  const stale = clone(delayed);
  Object.values(stale).forEach(plan => { plan.round = 1; });
  await db.ref(root + '/plannedActions/p6').set(stale);
  await flush();
  assert.equal(seals, 0);
  if (cancelReady) await db.ref(root + '/readyPlayers/p6/ready').set(false);
  if (staleUnit) await db.ref(root + '/readyPlayers/p6/unitId').set('old-character');
  if (stopped) { authority.stop(); c.LuminousCombatRemoteIntents073.stop(); }
  await db.ref(root + '/plannedActions/p6').set(delayed);
  await flush();
  if (cancelReady || staleUnit || stopped) {
    assert.equal(runs, 0, 'Cancelled READY, old unit or stopped listeners must not resolve');
    assert.equal(seals, 0);
  } else {
    assert.equal(runs, 1, 'The real plannedActions listener must resume the six-player round');
    assert.equal(seals, 1, 'READY and plan notifications must seal exactly once');
    assert.equal(queue.length, 10, 'Seven Player actions and three Kobold actions reach the actual queue builder');
    for (let i = 1; i <= 6; i++)
      assert.equal(queue.find(row => row.ownerId === 'player:p' + i && row.localIndex === 0)?.plan.data.name, 'Elección ' + i);
    assert.equal(queue.find(row => row.ownerId === 'player:p6' && row.localIndex === 1)?.plan.data.name, 'Segunda Skill');
    assert.equal(queue.filter(row => row.ownerId.startsWith('kobold:')).length, 3);
    assert.equal(get(root + '/authority/current/phase'), 'complete');
    assert.equal(get(root + '/estado/round'), 3);
    assert.equal(authority.state.lastStartError, '');
  }
  assert.deepEqual(errors, []);
  authority.stop(); c.LuminousCombatRemoteIntents073.stop();
  assert.equal([...listeners.values()].reduce((n, handlers) => n + handlers.size, 0), 0, 'Stop detaches all Firebase listeners');
}
await subscribedEncounter();
await subscribedEncounter({ lateIdentity: true });
await subscribedEncounter({ cancelReady: true });
await subscribedEncounter({ staleUnit: true });
await subscribedEncounter({ stopped: true });

// Both the bootstrap and its dynamically loaded bridge must invalidate cached authority code.
const viewer = source('Battle-viewer.html');
assert.ok(viewer.includes('js/combat-v073-plan-sync.js?v=20261024-six-ready-2'));
assert.ok(source('js/combat-v073-plan-sync.js').includes('js/combat-v073-authority.js?v=20261024-six-ready-2'));
console.log('Combat Live: six READY, late-plan subscriptions, mixed actions, Kobold queue and cancellation smoke passed.');
