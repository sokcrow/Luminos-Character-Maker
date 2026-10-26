import assert from 'node:assert/strict';
import '../js/trait-engine.js';
import '../js/trait-catalog-core.js';
import '../js/class-milestone-engine.js';
import '../js/combat-v073-economy-menu.js';

const menu = globalThis.LuminousCombatEconomyMenu073;
const actor = { id: 'player:hero', ownerPlayerId: 'hero', controlled: 'player', traits: ['rage', 'dm_quick'] };
globalThis.LuminousCombat073 = {
  playerId: () => actor.id,
  combatants: () => ({ [actor.id]: actor }),
};
globalThis.LuminousCombatLiveAdapter073 = {
  state: {
    playerId: 'hero',
    players: { hero: { characterBuild: { classes: [{ classId: 'barbarian', levels: 1 }] } } },
  },
};
menu.state.traitCatalogDefinitions = {
  dm_quick: { id: 'dm_quick', name: 'DM Quick', contexts: ['combat'], activation: { type: 'manual', actionCost: 'quick_action' }, effects: [] },
  unearned_quick: { id: 'unearned_quick', name: 'Unearned Quick', contexts: ['combat'], activation: { type: 'manual', actionCost: 'quick_action' }, effects: [] },
};
menu.state.traitCatalogGrants = {
  own: { sourceType: 'class', sourceId: 'barbarian', atLevel: 1, traitId: 'dm_quick' },
  other: { sourceType: 'class', sourceId: 'fighter', atLevel: 1, traitId: 'unearned_quick' },
};
const traits = menu.traitDefinitionsForPlayer();
assert.equal(traits.filter((trait) => trait.id === 'rage').length, 1, 'Barbarian Rage resolves once from its canonical Level 1 grant');
assert.equal(traits.find((trait) => trait.id === 'rage')?.economyCost, 'quick_action');
assert.equal(traits.find((trait) => trait.id === 'dm_quick')?.economyCost, 'quick_action', 'DM library definition is resolved from its ID');
assert.ok(!traits.some((trait) => trait.id === 'unearned_quick'), 'a Fighter-only grant must not leak into another build');

actor.traits = [];
globalThis.LuminousCombatLiveAdapter073.state.players.hero.characterBuild.classes = [{ classId: 'fighter', levels: 1 }];
const fighterTraits = menu.traitDefinitionsForPlayer();
assert.ok(!fighterTraits.some((trait) => trait.id === 'rage'), 'switching builds removes unearned Barbarian actions');
assert.ok(fighterTraits.some((trait) => trait.id === 'unearned_quick'), 'canonical player build is authoritative over stale combatant fields');
assert.equal(menu.normalizeEconomyCost({ castingTime: 'quick_action' }), 'quick_action', 'Skills and Spells use canonical timing');
console.log('combat class + DM Trait Quick Action resolution: ok');
