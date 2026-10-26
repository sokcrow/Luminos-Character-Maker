globalThis.window = globalThis;

await import('../js/combat-skill-schema.js');
await import('../js/coin-engine-core.js');

const schema = globalThis.CombatSkillSchema;
const engine = globalThis.LuminousCoinEngine;

if (!schema) throw new Error('CombatSkillSchema was not initialized.');
if (!engine) throw new Error('LuminousCoinEngine was not initialized.');

const EXPECTED = Object.freeze({
  activeHead: 'https://imgur.com/yCxmI84.png',
  activeTail: 'https://imgur.com/12jXebG.png',
  crackedHead: 'https://imgur.com/3wKu1xC.png',
  crackedTail: 'https://imgur.com/lFKCm2b.png',
});

const assetChecks = [
  ['active head', engine.coinSrc('head', { type: 'unbreakable', status: 'active' }), EXPECTED.activeHead],
  ['active tail', engine.coinSrc('tail', { type: 'unbreakable', status: 'active' }), EXPECTED.activeTail],
  ['latent head', engine.coinSrc('head', { type: 'unbreakable', status: 'latent' }), EXPECTED.crackedHead],
  ['latent tail', engine.coinSrc('tail', { type: 'unbreakable', status: 'latent' }), EXPECTED.crackedTail],
];

for (const [label, actual, expected] of assetChecks) {
  if (actual !== expected) throw new Error(`Unexpected Red Coin asset for ${label}: ${actual}`);
}

if (engine.coinSrc('head', { type: 'normal' }) !== engine.HEAD_SRC) {
  throw new Error('Normal Heads asset regressed.');
}
if (engine.coinSrc('tail', { type: 'normal' }) !== engine.TAIL_SRC) {
  throw new Error('Normal Tails asset regressed.');
}

const activeState = engine.coinVisualState({ type: 'unbreakable', status: 'active' });
if (!activeState.unbreakable || activeState.cracked || activeState.status !== 'active') {
  throw new Error(`Unexpected active Red Coin state: ${JSON.stringify(activeState)}`);
}

const latentState = engine.coinVisualState({ type: 'unbreakable', status: 'latent' });
if (!latentState.unbreakable || !latentState.cracked || latentState.status !== 'latent') {
  throw new Error(`Unexpected latent Red Coin state: ${JSON.stringify(latentState)}`);
}

// The Skill Creator uses the same CombatSkillSchema for Attack and Spell authoring.
// This verifies an authored Spell can mix Normal and Unbreakable Coins without
// losing the per-Coin mechanic during normalization / Firebase serialization.
const authoredSpell = schema.normalizeCombatSkill({
  id: 'red_coin_spell_smoke',
  name: 'Red Coin Spell Smoke',
  type: 'Spell',
  coinAmount: 4,
  basePower: 5,
  coinPower: 3,
  coins: [
    { type: 'normal', status: 'active', effects: [] },
    { type: 'unbreakable', status: 'active', effects: [] },
    { type: 'unbreakable', status: 'latent', effects: [] },
    { coinType: 'unbreakable', coinStatus: 'active', effects: [] },
  ],
});

if (authoredSpell.type !== 'Spell') throw new Error('Spell authoring type was not preserved.');
if (authoredSpell.coins[0].type !== 'normal') throw new Error('Normal Coin type was not preserved.');
if (authoredSpell.coins[1].type !== 'unbreakable') throw new Error('Active Red Coin type was not preserved.');
if (authoredSpell.coins[2].type !== 'unbreakable' || authoredSpell.coins[2].status !== 'latent') {
  throw new Error('Latent Red Coin state was not preserved.');
}
if (authoredSpell.coins[3].type !== 'unbreakable') {
  throw new Error('Legacy coinType alias did not normalize to an Unbreakable Coin.');
}

const serialized = schema.serializeCombatSkill(authoredSpell, { includeLegacyAliases: true });
const roundTrip = schema.normalizeCombatSkill(JSON.parse(JSON.stringify(serialized)));

for (const index of [1, 2, 3]) {
  if (roundTrip.coins[index].type !== 'unbreakable') {
    throw new Error(`Red Coin ${index + 1} was lost during serialization round-trip.`);
  }
}
if (roundTrip.coins[2].status !== 'latent') {
  throw new Error('Cracked/latent Red Coin status was lost during serialization round-trip.');
}

console.log('[UnbreakableRedCoin] Smoke test passed.');
console.log({
  assets: EXPECTED,
  spellCoinTypes: roundTrip.coins.map((coin) => `${coin.type}:${coin.status}`),
});
