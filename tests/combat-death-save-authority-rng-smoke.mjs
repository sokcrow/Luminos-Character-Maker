import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('combat/source/combat-v073-live.html');
const coinScript = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(script => script.includes('global.LuminousCoinEngine = Object.freeze'));
assert.ok(coinScript, 'exercise the actual production Coin engine');
const start = source.indexOf('function processDeathSavesRoundEnd(');
assert.ok(start >= 0);
const roundEnd = source.slice(start, source.indexOf('\n}', start) + 2);
const copy = value => JSON.parse(JSON.stringify(value));

function client(localRandom) {
  const events = [];
  const c = vm.createContext({ console, Math: Object.assign(Object.create(Math), { random: localRandom }),
    Date: { now: () => 1000 }, round: 1, setTimeout: () => 0, clearTimeout() {}, addEventListener() {},
    syncUnitActionState() {}, syncCombatantVitalNumber() {},
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    dispatchEvent: event => events.push(event)
  });
  c.window = c;
  vm.runInContext(coinScript, c, { filename: 'production Coin engine' });
  vm.runInContext(read('js/death-save-runtime.js'), c);
  c.combatData = Object.fromEntries(['captain', 'leader'].map(rank => [rank, {
    id: rank, rank, actionSlots: 3, activeSlots: 3, hp: 0, maxHp: 100, faction: 'enemy', battleActive: true, isBackup: false,
    lifeState: 'downed', isDowned: true, isDead: false, isRetreated: false, isStable: false,
    deathSaves: { successes: 2, failures: 2, stable: false }
  }]));
  // Neither Stable nor an off-field reserve is entitled to a roll.
  c.combatData.stable = { ...copy(c.combatData.captain), id: 'stable', isStable: true,
    deathSaves: { successes: 1, failures: 0, stable: true } };
  c.combatData.reserve = { ...copy(c.combatData.leader), id: 'reserve', battleActive: false, isBackup: true };
  c.LuminousCombat073 = { combatants: () => c.combatData, render() {} };
  vm.runInContext(roundEnd, c, { filename: 'production processDeathSavesRoundEnd' });
  vm.runInContext(read('js/combat-v073-steps.js'), c);
  vm.runInContext(read('js/combat-v073-authority.js'), c);
  const authority = c.LuminousCombatAuthority073;
  authority.installHooks();
  const steps = c.LuminousCombatSteps.create({ rules: {}, context: () => ({ round: 1 }), snapshot: authority.snapshotRuntime });
  return { c, authority, events, steps, localRandom };
}
function resolve(peer) {
  const { c, authority, steps, localRandom } = peer;
  steps.mutate('RoundEndEffects', null, {}, () => c.processDeathSavesRoundEnd(1));
  assert.equal(c.Math.random, localRandom, 'authority RNG scope must restore local randomness');
  const result = { cursor: authority.state.cursor, snapshot: copy(authority.snapshotRuntime()),
    rolls: peer.events.filter(event => event.type === 'luminous:death-save-resolved')
      .map(event => ({ id: event.detail.unit.id, tosses: copy(event.detail.check.tosses), passed: event.detail.check.passed })) };
  c.processDeathSavesRoundEnd(1);
  assert.equal(authority.state.cursor, result.cursor, 'same-round retries must not consume more RNG');
  return result;
}

for (const phase of ['sealed', 'running']) {
  for (const seed of [1, 17, 12345]) {
    for (const cursor of [0, 7, 19]) {
      const dm = client(() => 0), player = client(() => 0.999);
      for (const peer of [dm, player]) {
        peer.authority.state.current = { phase, seed, round: 1 };
        peer.authority.resetRandom(seed, cursor);
      }
      const checkpoint = { combatants: copy(dm.authority.snapshotRuntime()), seed, rngCursor: cursor };
      const first = resolve(dm), second = resolve(player);
      assert.equal(first.cursor, cursor + 10, 'two eligible units consume five seeded Coins each');
      assert.deepEqual(second, first, 'same seed/cursor must match despite opposite local RNG');
      assert.equal(first.rolls.length, 2, 'Stable and reserve never roll');
      for (const roll of first.rolls) assert.equal(first.snapshot[roll.id].lifeState, roll.passed ? 'retreated' : 'dead');
      const recovered = client(() => 0.9);
      recovered.authority.state.current = { phase, seed: checkpoint.seed, round: 1 };
      recovered.authority.applySnapshot(checkpoint.combatants);
      recovered.authority.resetRandom(checkpoint.seed, checkpoint.rngCursor);
      assert.deepEqual(resolve(recovered), first, 'checkpoint recovery must reproduce outcomes and RNG cursor');
    }
  }
}
// Local/offline play retains the native RNG when no live round is seeded.
for (const [random, passed] of [[() => 0, true], [() => 0.999, false]]) {
  const local = client(random), result = resolve(local);
  assert.ok(result.rolls.every(roll => roll.passed === passed));
  assert.equal(result.cursor, 0);
}
console.log('Death Save authority RNG: DM/player and checkpoint replay match; local fallback preserved.');
