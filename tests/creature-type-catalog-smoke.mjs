import assert from 'node:assert/strict';

await import('../js/creature-type-catalog.js');

const types = globalThis.LuminousCreatureTypeCatalog;
if (!types) throw new Error('Creature Type catalog was not initialized.');

assert.deepStrictEqual(types.CREATURE_TYPES, [
  'aberration',
  'beast',
  'celestial',
  'construct',
  'dragon',
  'elemental',
  'fey',
  'fiend',
  'giant',
  'humanoid',
  'monstrosity',
  'ooze',
  'plant',
  'undead',
]);
assert.equal(types.list().length, 14);
assert.equal(types.normalizeCreatureType('Humanoid'), 'humanoid');
assert.equal(types.normalizeCreatureType('beasts'), 'beast');
assert.equal(types.isValidCreatureType('dragon'), true);
assert.equal(types.isValidCreatureType('goblinoid'), false, 'subtypes must not be accepted as creature types');
assert.throws(() => types.assertCreatureType('machine'), /UNKNOWN_CREATURE_TYPE:machine/);

const wolf = { id: 'wolf_1', species: 'wolf', unitType: 'enemy' };
const direWolf = { id: 'dire_wolf_1', species: 'dire_wolf', unitType: 'enemy' };
const goblin = { id: 'goblin_1', species: 'goblin', unitType: 'enemy' };
const kobold = { id: 'kobold_1', species: 'kobold', unitType: 'enemy' };

assert.deepStrictEqual(types.profileForUnit(wolf), { creatureType: 'beast', creatureSubtypes: [], inferredFromSpecies: true });
assert.deepStrictEqual(types.profileForUnit(direWolf), { creatureType: 'beast', creatureSubtypes: [], inferredFromSpecies: true });
assert.deepStrictEqual(types.profileForUnit(goblin), { creatureType: 'humanoid', creatureSubtypes: ['goblinoid'], inferredFromSpecies: true });
assert.deepStrictEqual(types.profileForUnit(kobold), { creatureType: 'humanoid', creatureSubtypes: ['kobold'], inferredFromSpecies: true });

assert.equal(types.matchesTargetRule(wolf, { allowedCreatureTypes: ['beast'] }), true);
assert.equal(types.matchesTargetRule(wolf, { allowedCreatureTypes: ['humanoid'] }), false);
assert.equal(types.matchesTargetRule(goblin, { allowedCreatureTypes: ['humanoid'] }), true);
assert.equal(types.matchesTargetRule(goblin, { excludedCreatureTypes: ['humanoid'] }), false);
assert.equal(types.matchesTargetRule(goblin, { allowedCreatureSubtypes: ['goblinoid'] }), true);
assert.equal(types.matchesTargetRule(kobold, { allowedCreatureSubtypes: ['goblinoid'] }), false);
assert.equal(types.matchesTargetRule(wolf, { allowedCreatureTypes: ['beast', 'plant'] }), true);

const futureDragon = types.decorateUnit({
  id: 'future_red_dragon',
  species: 'red_dragon',
  unitType: 'enemy',
  creatureType: 'dragon',
  creatureSubtypes: ['chromatic', 'fire'],
}, { mutate: false, allowSpeciesDefault: false });
assert.equal(futureDragon.creatureType, 'dragon');
assert.deepStrictEqual(futureDragon.creatureSubtypes, ['chromatic', 'fire']);
assert.equal(types.matchesTargetRule(futureDragon, { allowedCreatureTypes: ['dragon'] }), true);
assert.equal(types.matchesTargetRule(futureDragon, { excludedCreatureSubtypes: ['chromatic'] }), false);

const missingFutureType = types.validateUnitCreatureType({ id: 'new_creature', species: 'new_creature' }, { allowSpeciesDefault: false });
assert.equal(missingFutureType.valid, false);
assert.match(missingFutureType.errors[0], /CREATURE_TYPE_REQUIRED:new_creature/);

const invalidFutureType = types.validateUnitCreatureType({ id: 'bad_creature', creatureType: 'robot' }, { allowSpeciesDefault: false });
assert.equal(invalidFutureType.valid, false);
assert.match(invalidFutureType.errors[0], /UNKNOWN_CREATURE_TYPE:robot/);

console.log('creature type catalog smoke: ok (14 canonical types; Wolf=Beast; Kobold/Goblin=Humanoid)');
