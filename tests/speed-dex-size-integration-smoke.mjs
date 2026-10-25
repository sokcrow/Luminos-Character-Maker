import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const viewer = fs.readFileSync('combat/source/combat-v073-live.html', 'utf8');
const context = {
  console, setInterval: () => 1, clearInterval() {}, setTimeout: () => 1,
  clearTimeout() {}, addEventListener() {},
  firebase: { database: { ServerValue: { TIMESTAMP: 1 } } },
  LuminousCombatLiveAdapter073: { state: { role: 'dm' } },
  randomIntInclusive: (_min, max) => max,
  statusModifier: (unit, key) => unit.statusEffects?.[key] || 0,
  conditionSpeedForcedToOne: unit => Boolean(unit.forced),
};
context.window = context;
vm.createContext(context);
function load(path) { vm.runInContext(fs.readFileSync(path, 'utf8'), context); }
load('js/movement-speed-runtime.js');
load('js/derived-stats-engine.js');
load('js/universal-speed-runtime.js');
load('js/unit-combat-instantiator.js');
load('js/combat-v073-dm-setup.js');
vm.runInContext(viewer.slice(viewer.indexOf('function speedForBaseRoll('), viewer.indexOf('function formationSort(')), context);
load('js/combat-v073-speed-authority.js');
const movement = context.LuminousMovementSpeedRuntime;
const authority = context.LuminousCombatSpeedAuthority073;
authority.patchLegacySpeedRollers();
authority.state.round = 1;
authority.state.roundReady = true;
const bounds = profile => [profile.min, profile.max];
const plain = value => JSON.parse(JSON.stringify(value));

// Approved examples, including penalties that apply to the ceiling only.
for (const [size, expected] of [
  ['tiny', [1, 7]], ['small', [1, 7]], ['medium', [1, 6]],
  ['large', [1, 5]], ['huge', [1, 4]], ['gargantuan', [1, 3]],
]) {
  assert.deepEqual(bounds(movement.rangeForEntity({ size, scores: { dex: 10 }, movement: { ground: 30 } })), expected);
}
for (const [dex, expected] of [[2, [1, 4]], [6, [1, 5]], [8, [1, 6]], [10, [1, 6]],
  [12, [1, 6]], [14, [2, 7]], [16, [2, 7]], [18, [3, 8]], [20, [3, 8]], [30, [3, 8]]]) {
  assert.deepEqual(bounds(movement.rangeForEntity({ scores: { dex }, movement: { ground: 30 } })), expected);
}
assert.deepEqual(bounds(movement.rangeForEntity({ size: 'gargantuan', scores: { dex: 18 }, movement: { ground: 30 } })), [3, 5]);
assert.deepEqual(bounds(movement.rangeForEntity({ size: 'gargantuan', scores: { dex: 10 }, movement: { ground: 40 } })), [1, 5]);
for (const size of Object.keys(movement.SIZE_MAX_SPEED_MODIFIERS)) {
  for (const dex of [1, 2, 6, 8, 10, 14, 18, 20, 30]) {
    for (const ground of [5, 10, 20, 25, 30, 35, 40, 60, 120]) {
      const range = movement.rangeForEntity({ size, scores: { dex }, movement: { ground } });
      assert.ok(range.min >= 1 && range.max >= 2 && range.max >= range.min);
    }
  }
}

// The same DEX works for canonical NPC scores and Spanish Player sheet stats.
const npc = { size: 'small', scores: { dex: 15 }, movement: { ground: 30 } };
const player = { isPlayer: true, size: 'small', stats: { destreza: 15 }, movement: { ground: 30 } };
assert.deepEqual(bounds(movement.combatRangeForEntity(npc)), [2, 8]);
assert.deepEqual(bounds(movement.combatRangeForEntity(player)), [2, 8]);
assert.deepEqual(bounds(movement.combatRangeForEntity({ ...player, scores: { dex: 8 } })), [2, 8], 'A linked NPC must not override Player sheet DEX');
const built = context.LuminousCombatDmSetup073.buildPlayer('test', player);
const deployed = context.LuminousUnitCombatInstantiator.normalizeDefinition('test-npc', npc);
assert.deepEqual(plain(built.speedRange), plain(deployed.speedRange));
assert.deepEqual(plain(authority.rangeFor(built)), [2, 8]);
assert.deepEqual(plain(authority.rangeFor(deployed)), [2, 8]);
for (const character of [player, npc]) {
  const snapshot = context.LuminousDerivedStats.resolveCharacterStats(character);
  assert.deepEqual(bounds(snapshot.speed), [2, 8]);
}
assert.deepEqual(bounds(context.LuminousUniversalSpeedRuntime.baseSpeedRange(player, built, 1)), [2, 8]);
// Modern builds use the effective ability, including persistent/runtime bonuses.
const build = { isPlayer: true, characterBuild: { baseStats: { destreza: 14 },
  breakdown: { backgroundStatBonuses: { dex: 2 } } } };
assert.deepEqual(bounds(movement.combatRangeForEntity(build)), [2, 7]);
assert.deepEqual(bounds(movement.combatRangeForEntity({ ...build, stats: { destreza: 8 } })), [2, 7], 'Modern base stats and bonuses supersede stale stored totals');
const enhanced = context.LuminousDerivedStats.resolveCharacterStats(build, { runtimeStatBonuses: { dex: 2 } });
assert.equal(enhanced.abilities.dex.score, 18);
assert.deepEqual(bounds(enhanced.speed), [3, 8]);
const legacyPlayer = { isPlayer: true, stats: { destreza: 18 }, speedRange: [1, 6] };
assert.deepEqual(plain(authority.rangeFor(legacyPlayer)), [3, 8], 'Old default Player ranges must not hide DEX');
assert.deepEqual(bounds(movement.combatRangeForEntity({ speedRange: [2, 4], scores: { dex: 20 } })), [2, 4], 'Explicit NPC ranges without movement remain DM overrides');

// Rehydration and repeated rounds must not apply DEX or rank twice.
const captain = { ...npc, rankBonuses: { minSpeedBonus: 0, maxSpeedBonus: 1 } };
for (let round = 1; round <= 4; round++) {
  authority.state.round = round;
  Object.assign(captain, authority.rollFor(captain));
  assert.deepEqual(plain(captain.speedRange), [2, 9]);
}
const flyer = { size: 'tiny', scores: { dex: 18 }, movement: { ground: 5, fly: 60 }, flying: true };
assert.deepEqual(plain(authority.rangeFor(flyer)), [3, 15]);
flyer.flying = false;
assert.deepEqual(plain(authority.rangeFor(flyer)), [3, 5]);
const swimmer = { size: 'large', scores: { dex: 14 }, movement: { ground: 20, swim: 40 } };
assert.deepEqual(plain(authority.rangeFor(swimmer)), [2, 4]);
swimmer.encounterTags = ['underwater'];
assert.deepEqual(plain(authority.rangeFor(swimmer)), [2, 8]);

// Exercise the packed modifier rules, not a stub Speed formula.
for (const [statusEffects, expected] of [[{}, 8], [{ haste: 2 }, 10], [{ bind: 2 }, 6],
  [{ chill: 5 }, 6], [{ exhaustion: 2 }, 6]]) {
  assert.equal(authority.rollFor({ ...player, statusEffects }).speed, expected);
}
assert.equal(authority.rollFor({ ...player, forced: true, statusEffects: { haste: 9 } }).speed, 1);
const hasted = { ...player, ...authority.rollFor({ ...player, statusEffects: { haste: 2 } }) };
assert.equal(context.LuminousUniversalSpeedRuntime.effectiveSpeed(hasted), 10);
assert.equal(context.LuminousDerivedStats.resolveCharacterStats(hasted).speed.current, 10);
context.randomIntInclusive = min => min;
const bound = { ...player, stats: { destreza: 18 }, statusEffects: { bind: 2 } };
Object.assign(bound, authority.rollFor(bound));
assert.equal(bound.speedBaseRoll, 3);
assert.equal(bound.speed, 1);
assert.equal(context.LuminousUniversalSpeedRuntime.effectiveSpeed(bound), 1);
assert.equal(context.LuminousDerivedStats.resolveCharacterStats(bound).speed.current, 1);
context.randomIntInclusive = (_min, max) => max;
const original = authority.state.originalRollUnitSpeed;
authority.state.originalRollUnitSpeed = null;
assert.equal(authority.rollFor({ speedRange: [2, 2], statusEffects: { exhaustion: 2 } }).speed, 1, 'Fallback retains Exhaustion');
assert.equal(authority.rollFor({ ...player, forced: true }).speed, 1);
authority.state.originalRollUnitSpeed = original;

// Repair old [1,1] outcomes even when movement data was already present.
authority.state.round = 1;
let rows = {
  old: { id: 'old', isPlayer: true, movement: { ground: 35 }, speed: 1, speedBaseRoll: 1, speedTie: 0.2, speedRollTurn: 1 },
  legal: { id: 'legal', speedRange: [1, 6], speed: 1, speedBaseRoll: 1, speedTie: 0.4, speedRollTurn: 1 },
  forced: { id: 'forced', isPlayer: true, forced: true, movement: { ground: 30 }, speed: 1, speedBaseRoll: 1, speedTie: 0.3, speedRollTurn: 1 },
};
authority.state.db = { ref: () => ({ transaction: async update => {
  const next = update(rows);
  if (!next) return { committed: false };
  rows = next;
  return { committed: true };
} }) };
assert.equal(await authority.ensureRoundSpeeds(), true);
assert.equal(rows.old.speed, 7);
assert.equal(rows.legal.speed, 1);
assert.equal(rows.forced.speed, 1);
assert.equal(await authority.ensureRoundSpeeds(), false);
authority.state.combatants = rows;
context.combatData = { old: { id: 'old', speed: 0 }, legal: { id: 'legal', speed: 0 } };
authority.syncRuntimeSpeedsFromCanonical(1);
assert.equal(context.combatData.old.speed, 7);
assert.deepEqual(plain(context.combatData.old.speedRange), [1, 7]);
assert.equal(context.combatData.legal.speed, 1);

console.log('Speed movement / DEX / size integration: ok');
