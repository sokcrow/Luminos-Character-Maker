import assert from 'node:assert/strict';

await import('../js/skill-forge-g2.js');

const forge = globalThis.LuminousSkillForgeG2;
if (!forge) throw new Error('LuminousSkillForgeG2 was not initialized.');

assert.equal(forge.version, '0.2.0');
assert.equal(forge.GENERATION_RULES[1].maxConditions, 0);
assert.equal(forge.GENERATION_RULES[2].maxConditions, 1);
assert.equal(forge.TIER_RULES[1].maxCoins, 3);
assert.equal(forge.TIER_RULES[2].maxCoins, 4);
assert.equal(forge.TIER_RULES[3].maxCoins, 5);
assert.deepEqual([forge.TIER_RULES[1].printedPowerMin, forge.TIER_RULES[1].printedPowerMax], [10, 13]);
assert.deepEqual([forge.TIER_RULES[2].printedPowerMin, forge.TIER_RULES[2].printedPowerMax], [15, 17]);
assert.deepEqual([forge.TIER_RULES[3].printedPowerMin, forge.TIER_RULES[3].printedPowerMax], [19, 24]);

for (const tier of [1, 2, 3]) assert.ok(forge.TIER_RULES[tier].countCost > forge.TIER_RULES[tier].potencyCost, `Tier ${tier} Count must cost more than Potency`);

const clashCost = forge.rewardCost({ kind: 'clash_power', amount: 1 }, { tier: 1, power: { coinAmount: 3 } });
const finalCost = forge.rewardCost({ kind: 'final_power', amount: 1 }, { tier: 1, power: { coinAmount: 3 } });
const coinCost = forge.rewardCost({ kind: 'coin_power', amount: 1 }, { tier: 1, power: { coinAmount: 3 } });
assert.ok(clashCost < finalCost, 'Clash Power must be cheaper than Final Power');
assert.ok(finalCost < coinCost, 'Final Power must be cheaper than Coin Power');

const g1 = forge.generateRecipe({ seed: 'campaign-g1', tier: 1, generation: 1, weapon: 'sword', status: 'burn' });
assert.equal(g1.validation.valid, true);
assert.equal(g1.recipe.generation, 1);
assert.equal(g1.recipe.damageFamily, 'slash');
assert.equal(g1.recipe.core.status, 'burn');
assert.equal(g1.recipe.core.trigger, '[On Hit]');
assert.equal(g1.recipe.style.condition, null);
assert.ok(forge.maxPower(g1.recipe) >= forge.TIER_RULES[1].mechanicalFloor);
assert.ok(forge.maxPower(g1.recipe) <= forge.TIER_RULES[1].printedPowerMax);

const g2 = forge.generateRecipe({ seed: 'campaign-g2', tier: 2, generation: 2, weapon: 'spear', status: 'rupture', styleId: 'predator' });
assert.equal(g2.validation.valid, true);
assert.equal(g2.recipe.generation, 2);
assert.equal(g2.recipe.damageFamily, 'pierce');
assert.equal(g2.recipe.style.id, 'predator');
assert.equal(g2.recipe.style.condition.stat, 'hp_percent');
assert.ok(g2.recipe.power.coinAmount <= 4);

const illegalG1Condition = forge.validateRecipe({
  tier: 1, generation: 1, damageFamily: 'slash', sinAffinity: 'wrath', range: 1, attackWeight: 1,
  power: { basePower: 4, coinPower: 3, coinAmount: 2 }, core: { status: 'burn', potency: 1, count: 0 },
  style: { id: 'predator', reward: { kind: 'damage_percent', amount: 10 }, condition: { target: 'target', stat: 'hp_percent', operator: '<=', value: 50 } },
});
assert.equal(illegalG1Condition.valid, false);
assert.ok(illegalG1Condition.errors.some(error => error.includes('requires G2') || error.includes('does not allow Conditions')));

const tooMuchCount = forge.validateRecipe({
  tier: 1, generation: 1, damageFamily: 'blunt', sinAffinity: 'sloth', range: 1, attackWeight: 1,
  power: { basePower: 7, coinPower: 6, coinAmount: 1 }, core: { status: 'tremor', potency: 1, count: 2 },
  style: { id: 'duelist', reward: { kind: 'clash_power', amount: 1 } },
});
assert.equal(tooMuchCount.valid, false);
assert.ok(tooMuchCount.errors.some(error => error.includes('Count cap') || error.includes('Effect Budget')));

const proceduralWeaponMismatch = forge.validateRecipe({ ...g1.recipe, mode: 'procedural', damageFamily: 'pierce' });
assert.equal(proceduralWeaponMismatch.valid, false);
assert.ok(proceduralWeaponMismatch.errors.some(error => error.includes('procedural grammar')));

const dmCreative = forge.validateRecipe({ ...g1.recipe, mode: 'dm', core: { ...g1.recipe.core, potency: 2, count: 1 } }, { mode: 'dm', creativeAllowance: 0.25 });
assert.equal(dmCreative.valid, true, `DM creative allowance should preserve hard caps but allow a small budget overage: ${dmCreative.errors.join(' · ')}`);

const g3Complexity = forge.validateRecipe({ ...g1.recipe, generation: 3 });
assert.equal(g3Complexity.valid, false);
assert.ok(g3Complexity.errors.some(error => error.includes('Only G1-G2')));

const compiled = forge.compileRecipe(g2.recipe);
assert.equal(compiled.metadata.forge, true);
assert.equal(compiled.metadata.generation, 2);
assert.equal(compiled.skillRange, 1);
assert.equal(compiled.damageType, 'perforante');
const allEffects = [...compiled.effects, ...compiled.coins.flatMap(coin => coin.effects || [])];
assert.ok(allEffects.some(effect => effect.type === 'status' && effect.trigger === '[On Hit]' && effect.tag === '[On Hit]'));
assert.ok(allEffects.some(effect => effect.type === 'forge_reward' && effect.trigger === '[Heads Hit]' && effect.condition?.stat === 'hp_percent'));

const deckA = forge.generateDeck({ seed: 'minion-01', size: 6, tier: 1, generation: 1, weapon: 'hammer', status: 'tremor' });
const deckB = forge.generateDeck({ seed: 'minion-01', size: 6, tier: 1, generation: 1, weapon: 'hammer', status: 'tremor' });
assert.deepEqual(deckA.map(entry => entry.recipe), deckB.map(entry => entry.recipe), 'same seed must reproduce the same procedural Deck');
assert.ok(deckA.every(entry => entry.recipe.damageFamily === 'blunt'));
assert.ok(deckA.every(entry => entry.recipe.core.status === 'tremor'));
assert.ok(new Set(deckA.map(entry => entry.recipe.style?.id)).size >= 2, 'procedural deck should preserve style diversity');

const moduleDeck = forge.generateDeck({ seed: 'module-minion', size: 4, tier: 2, generation: 2, weapon: 'spear', modules: [{ status: 'rupture', styleWeights: { predator: 60 } }] });
assert.ok(moduleDeck.every(entry => entry.recipe.core.status === 'rupture'));
assert.ok(moduleDeck.every(entry => entry.recipe.damageFamily === 'pierce'));

console.log('skill forge G1-G2 smoke: ok');
