import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the shipped start guard after the actual bootstrap replacement.
const source = fs.readFileSync(new URL('../combat/source/combat-v073-live.html', import.meta.url), 'utf8');
const bootstrap = fs.readFileSync(new URL('../Battle-viewer.html', import.meta.url), 'utf8');
const literal = (name) => JSON.parse(bootstrap.match(new RegExp(`const ${name}=("(?:[^"\\\\]|\\\\.)*");`))[1]);
const needle = literal('liveRoundReadyNeedle'), patch = literal('liveRoundReadyPatch');
assert.equal(source.split(needle).length, 2);
const start = source.indexOf('async function startRound(){');
const guard = source.slice(start, source.indexOf('  roundRunning=true;', start)).replace(needle, patch);
for (const [phase, sealedRound, localReady, expected] of [
  ['running', 1, false, true], ['sealed', 1, false, undefined],
  ['running', 2, false, undefined], ['', 1, false, undefined], ['', 1, true, true],
]) {
  const run = vm.runInNewContext(guard + 'return true;\n}\nstartRound', {
    window: { LuminousCombatLiveMode: true, LuminousCombatAuthority073: { state: { current: { phase, round: sealedRound } } } },
    roundRunning: false, planReady: localReady, round: 1, hideClashForecast() {}, setStatus() {},
  });
  assert.equal(await run(), expected, `start guard: ${phase}/${sealedRound}/${localReady}`);
}

const round = { textContent: '1' }, writes = [], errors = [];
let advance = false, readyCalls = 0;
const units = { 'player:a': { id: 'player:a', isPlayer: true, canonicalPlayerKey: 'a', controlled: 'remote', hp: 90, maxHp: 100, sp: 0 },
  enemy: { id: 'enemy', controlled: 'ai', hp: 145, maxHp: 150, sp: 0 } };
const db = { ref() { return { on() {}, off() {}, async update(updates) { writes.push(updates); } }; } };
const adapter = { role: 'dm', uid: 'dm', user: { uid: 'dm' }, db, round: 1, combatants: units };
const window = { Math: Object.create(Math), console: { error(...args) { errors.push(args.join(' ')); } },
  document: { getElementById: (id) => id === 'round' ? round : null },
  addEventListener() {}, setTimeout() {}, clearTimeout() {},
  setPlanReady() { readyCalls++; },
  async startRound() { if (advance) round.textContent = '2'; },
  LuminousCombatLiveAdapter073: { state: adapter },
  LuminousCombat073: { combatants: () => units, plans: () => [], render() {} },
};
vm.runInNewContext(fs.readFileSync(new URL('../js/combat-v073-authority.js', import.meta.url), 'utf8'), { window, console: window.console });
const authority = window.LuminousCombatAuthority073;
authority.state.current = { phase: 'running', round: 1, seed: 123 };
assert.equal(await authority.requestStartRound(), false);
assert.equal(writes.length, 0, 'an early runtime return must not publish a completed round');
assert.ok(errors.some((message) => message.includes('COMBAT_ROUND_DID_NOT_ADVANCE')));
advance = true;
assert.equal(await authority.requestStartRound(), true);
assert.equal(readyCalls, 0, 'playback must not submit Player Ready after sealing');
const final = writes.at(-1);
assert.equal(final[authority.ROOT.current + '/phase'], 'complete');
assert.equal(final[authority.ROOT.current + '/checkpoint'].combatants.enemy.hp, 145);
assert.equal(final[authority.ROOT.state].round, 2);
authority.stop();
console.log('Combat authority: early-return rejection and completed-round checkpoint passed');
