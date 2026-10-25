import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the actual packed roller with the live Speed authority and DM
// deployment builder, not a duplicate Speed formula.
const viewer = fs.readFileSync('combat/source/combat-v073-live.html', 'utf8');
const speedScript = fs.readFileSync('js/combat-v073-speed-authority.js', 'utf8');
const movementScript = fs.readFileSync('js/movement-speed-runtime.js', 'utf8');
const dmScript = fs.readFileSync('js/combat-v073-dm-setup.js', 'utf8');
const rollStart = viewer.indexOf('function rollUnitSpeed(unit,turnNumber){');
const rollEnd = viewer.indexOf('function formationSort(', rollStart);
assert.ok(rollStart >= 0 && rollEnd > rollStart, 'Packed turn Speed roller must be available');

const sandbox = {
  console,
  setInterval: () => 1,
  clearInterval() {},
  setTimeout: () => 1,
  clearTimeout() {},
  addEventListener() {},
  firebase: { database: { ServerValue: { TIMESTAMP: 123456 } } },
  LuminousCombatLiveAdapter073: { state: { role: 'dm' } },
  randomIntInclusive(_min, max) { return max; },
  statusModifier() { return 0; },
  speedForBaseRoll(_unit, _round, base) { return base; }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(movementScript, sandbox);
vm.runInContext(viewer.slice(rollStart, rollEnd), sandbox);

// Reproduce the report: without speedRange, the original roller only rolls 1.
assert.equal(sandbox.rollUnitSpeed({ id: 'old', speed: 0 }, 1), 1);

vm.runInContext(speedScript, sandbox);
vm.runInContext(dmScript, sandbox);
const speed = sandbox.LuminousCombatSpeedAuthority073;
const dm = sandbox.LuminousCombatDmSetup073;
speed.patchLegacySpeedRollers();
speed.state.round = 1;
speed.state.roundReady = true;

assert.deepEqual(Array.from(speed.rangeFor({})), [1, 6]);
assert.deepEqual(Array.from(speed.rangeFor({ speedRange: [1, 1] })), [1, 6]);
assert.deepEqual(Array.from(speed.rangeFor({ speedMin: 2, speedMax: 5 })), [2, 5]);
assert.deepEqual(Array.from(speed.rangeFor({ movement: { ground: 35 } })), [1, 7]);

const player = dm.buildPlayer('p-new', {
  name: 'New player',
  speed: 1,
  speedRollTurn: 1,
  speedBaseRoll: 1,
  speedTie: 0.2
});
assert.deepEqual(Array.from(player.speedRange), [1, 6], 'Players deploy with the normal Speed range');
assert.equal(player.speed, 0, 'Player deployment must not reuse a previous battle Speed');
assert.equal(player.speedRollTurn, 0, 'Player deployment must not carry old roll stamps');

const fast = dm.buildPlayer('p-fast', { name: 'Fast player', movement: { ground: 35 } });
assert.deepEqual(Array.from(fast.speedRange), [1, 7], 'Movement in feet must determine combat Speed range');

// A malformed old turn-one roll is stamped as already resolved. The DM must
// repair it once using the actual packed roller (which otherwise early-returns).
let rows = Object.fromEntries(Array.from({ length: 8 }, (_, i) => {
  const id = 'player:p-' + (i + 1);
  return [id, { id, isPlayer: true, speed: 1, speedBaseRoll: 1, speedRollTurn: 1, speedTie: 0.25 }];
}));
rows['ally:valid-one'] = {
  id: 'ally:valid-one', speedRange: [1, 6], speed: 1,
  speedBaseRoll: 1, speedRollTurn: 1, speedTie: 0.75
};
let transactions = 0;
speed.state.db = {
  ref() {
    return {
      async transaction(update) {
        transactions++;
        const next = update(rows);
        if (next === undefined) return { committed: false };
        rows = next;
        return { committed: true };
      }
    };
  }
};

assert.equal(await speed.ensureRoundSpeeds(), true, 'DM must repair the old speed rolls');
for (let i = 1; i <= 8; i++) {
  const unit = rows['player:p-' + i];
  assert.equal(unit.speed, 6, 'The packed roller must receive 1–6 rather than [1,1]');
  assert.equal(unit.speedBaseRoll, 6);
  assert.equal(unit.speedRollTurn, 1);
  assert.deepEqual(Array.from(unit.speedRange), [1, 6], 'Canonical range must be persisted');
}
assert.equal(rows['ally:valid-one'].speed, 1, 'A legal one with a valid range is preserved');
const previousTie = rows['player:p-1'].speedTie;
assert.equal(await speed.ensureRoundSpeeds(), false, 'A repaired roll is never rerolled in the same turn');
assert.equal(rows['player:p-1'].speedTie, previousTie);
assert.equal(transactions, 2);

console.log('combat v0.7.3 Player Speed turn-one regression: ok');
