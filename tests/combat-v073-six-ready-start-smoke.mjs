import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function harness() {
  const timers = [], statuses = [], errors = [];
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
  return { c, timers, errors, status, statuses };
}

// Scenario: all six players are marked READY in RTDB, but player six's
// planned action has not arrived. A premature seal must not be attempted.
{
  const { c, timers, status } = harness();
  const units = {}, readyPlayers = {}, plannedActions = {};
  for (let i = 1; i <= 6; i++) {
    const playerId = 'p' + i, unitId = 'player:' + playerId;
    units[unitId] = { id: unitId, canonicalPlayerKey: playerId, isPlayer: true,
      name: 'Jugador ' + i, battleActive: true, deploymentState: 'field',
      controlled: 'remote', hp: 20, maxHp: 20, actionSlots: 1 };
    readyPlayers[playerId] = { ready: true, round: 2, unitId, plannedSlots: 1 };
    plannedActions[playerId] = { 0: { unitId, round: 2, scheduledBy: playerId,
      kind: 'skill', skillId: 'attack', actionData: { name: 'Ataque' } } };
  }
  delete plannedActions.p6;
  let encounter = { estado: { phase: 'PRE_COMBAT_PLANNING', round: 2, active: true },
    combatants: units, readyPlayers, plannedActions };
  let seals = 0, updates = 0, currentTurn = 2;
  const db = { ref(path = '') { return {
    on() {}, off() {},
    async once() { return { val: () => path === 'campaña/combate' ? encounter : null }; },
    async update() { updates++; }
  }; } };
  c.LuminousCombatLiveAdapter073 = { state: { role: 'dm', isAuthority: true,
    user: {}, uid: 'dm', db, round: 2, combatState: 'PRE_COMBAT_PLANNING',
    firebaseReady: true, combatants: units } };
  c.LuminousCombat073 = { combatants: () => units, plans: () => [], render() {} };
  c.LuminousCombatSlotDeck073 = { validatePlans() {} };
  c.LuminousCombatRemoteIntents073 = { async publishPlanningAi() { return true; } };
  c.LuminousCombatSession = {
    canSeal() { return true; },
    async updateRoot(_db, mutate) {
      const next = mutate(encounter);
      if (!next) return { committed: false };
      encounter = next;
      seals++;
      return { committed: true };
    }
  };
  c.startRound = async () => { currentTurn = 3; };
  c.document.getElementById = id => id === 'status' ? status :
    id === 'round' ? { textContent: String(currentTurn) } : null;
  vm.runInContext(source('js/combat-v073-authority.js'), c);
  const authority = c.LuminousCombatAuthority073;

  const members = c.LuminousCombatParticipants.players(units);
  assert.equal(members.length, 6);
  assert.equal(authority.allReadySnapshot(readyPlayers), true);
  const incomplete = authority.readyComplete(readyPlayers, plannedActions, 2, members);
  assert.equal(incomplete.complete, false, 'Six READY do not imply six persisted plans');
  assert.ok(incomplete.missing.includes('p6:PLAN'));
  assert.equal(authority.maybeAutoStart(readyPlayers), true);
  await timers.shift()();
  assert.equal(seals, 0, 'A partial Firebase snapshot must never seal the turn');
  assert.match(status.textContent, /Jugador 6/);

  plannedActions.p6 = { 0: { unitId: 'player:p6', round: 2, scheduledBy: 'p6',
    kind: 'skill', skillId: 'attack', actionData: { name: 'Ataque' } } };
  assert.equal(authority.readyComplete(readyPlayers, plannedActions, 2, members).complete, true);
  assert.equal(authority.maybeAutoStart(readyPlayers), true);
  await timers.shift()();
  assert.equal(seals, 1, 'Complete six-player READY must seal exactly once');
  assert.ok(updates >= 2, 'The live round should start and publish its completion');
  assert.equal(authority.state.lastStartError, '', 'The DM should not receive a false READY rejection');

  const wrongUnit = { ...readyPlayers, p6: { ...readyPlayers.p6, unitId: 'old-character' } };
  assert.ok(authority.readyComplete(wrongUnit, plannedActions, 2, members).missing.includes('p6:UNIT'));
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
    skillIds: ['bite'], faction: 'enemy', hp: 10, maxHp: 10, autoPlans: [] };
  let published = 0, rechecked = 0;
  const db = { ref() { return {
    on() {}, off() {}, async set() { published++; },
    async once() { return { val: () => null }; }
  }; } };
  c.LuminousCombatLiveAdapter073 = { state: { role: 'dm', user: {}, uid: 'dm',
    round: 2, combatState: 'PRE_COMBAT_PLANNING', hydratedOnce: true,
    combatants: units, db, skills: { bite: { id: 'bite', name: 'Bite' } } },
    skillIdsFor(unit) { return unit.skillIds || []; } };
  c.LuminousCombat073 = { combatants: () => units, render() {}, kit() { return { actions: [] }; } };
  c.LuminousCombatAuthority073 = { state: { readyRows: {} },
    serializeRuntimePlan() { return {}; }, maybeAutoStart() { rechecked++; } };
  vm.runInContext(source('js/combat-v073-remote-intents.js'), c);
  assert.equal(await c.LuminousCombatRemoteIntents073.publishPlanningAi(), true);
  assert.equal(published, 1, 'Missing Player skill must not block enemy AI');
  assert.equal(rechecked, 1, 'AI readiness must trigger a new turn-start check');
}

console.log('Combat Live: six READY, atomic plans, AI prerequisites and turn-start smoke passed.');
