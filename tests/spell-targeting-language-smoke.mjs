import assert from 'node:assert/strict';

await import('../js/creature-type-catalog.js');
await import('../js/spell-targeting-language.js');

const creatureTypes = globalThis.LuminousCreatureTypeCatalog;
const language = globalThis.LuminousSpellTargetingLanguage;
assert.ok(creatureTypes && language);

const contract = language.authoringContract();
assert.deepEqual(contract.canonicalKeys, [
  'allowedCreatureTypes',
  'excludedCreatureTypes',
  'allowedCreatureSubtypes',
  'excludedCreatureSubtypes',
]);
assert.equal(contract.creatureTypes.length, 14);
assert.equal(contract.creatureTypes.some((entry) => entry.id === 'beast'), true);
assert.equal(contract.creatureTypes.some((entry) => entry.id === 'humanoid'), true);

const legacy = language.canonicalizeSpellDefinition({
  id: 'legacy_beast_spell',
  creatureTypes: ['Beasts'],
});
assert.deepEqual(legacy.allowedCreatureTypes, ['beast']);
assert.deepEqual(legacy.excludedCreatureTypes, []);
assert.equal('creatureTypes' in legacy, false);

assert.throws(
  () => language.canonicalizeSpellDefinition({ id: 'bad_spell', allowedCreatureTypes: ['robot'] }),
  /UNKNOWN_CREATURE_TYPE:robot/,
);
const contradiction = language.validateRule({ allowedCreatureTypes: ['beast'], excludedCreatureTypes: ['beast'] });
assert.equal(contradiction.valid, false);
assert.match(contradiction.errors.join(' '), /SPELL_TARGETING_TYPE_CONTRADICTION:beast/);

const wolf = { id: 'wolf_1', species: 'wolf', creatureType: 'beast', creatureSubtypes: [] };
const goblin = { id: 'goblin_1', species: 'goblin', creatureType: 'humanoid', creatureSubtypes: ['goblinoid'] };
const kobold = { id: 'kobold_1', species: 'kobold', creatureType: 'humanoid', creatureSubtypes: ['kobold'] };
const dragon = { id: 'dragon_1', species: 'red_dragon', creatureType: 'dragon', creatureSubtypes: ['chromatic', 'fire'] };

const beastOnly = { allowedCreatureTypes: ['beast'] };
assert.equal(language.validateTarget(beastOnly, wolf).valid, true);
assert.equal(language.validateTarget(beastOnly, goblin).reason, 'SPELL_TARGET_INVALID_CREATURE_TYPE');
assert.equal(language.validateTarget({ allowedCreatureTypes: ['humanoid'], allowedCreatureSubtypes: ['goblinoid'] }, goblin).valid, true);
assert.equal(language.validateTarget({ allowedCreatureTypes: ['humanoid'], allowedCreatureSubtypes: ['goblinoid'] }, kobold).valid, false);
assert.equal(language.validateTarget({ allowedCreatureTypes: ['dragon'] }, dragon).valid, true);
assert.equal(language.validateTarget({}, { id: 'legacy_unknown_target' }).valid, true, 'Unrestricted legacy Spells must remain compatible');

// Registry/loadout normalization must use the exact same language.
globalThis.LuminousContentRegistry = {
  entries: new Map(),
  registerSource(type, store, collection) {
    for (const [id, definition] of Object.entries(collection || {})) this.entries.set(`${type}:${id}`, { definition: structuredClone(definition) });
  },
  get(type, id) {
    if (id === undefined) return this.entries.get(type) || null;
    return this.entries.get(`${type}:${id}`) || null;
  },
};
globalThis.LuminousContentRegistryBootstrap = { registerAvailableCore() {} };
globalThis.LuminousSpellcastingRuntime = {
  getClassSpellcastingAbility(id) { return id === 'wizard' ? 'int' : null; },
  resolveSpellcasting() { return { spellMod: 3, spellDC: 13 }; },
  canSpendSpellSlot() { return { available: true }; },
  spendSpellSlot() { throw new Error('illegal target must never spend a Spell Slot'); },
};

globalThis.LuminousContentRegistry.entries.set('spell:beast_command', {
  definition: {
    id: 'beast_command', name: 'Beast Command', kind: 'spell', level: 1,
    sourceClassId: 'wizard', targetingType: 'focused_attack', basePower: 1, coinPower: 1, coinAmount: 1,
    creatureTypes: ['beasts'],
  },
});
globalThis.LuminousContentRegistry.entries.set('spell:invalid_robot_spell', {
  definition: {
    id: 'invalid_robot_spell', name: 'Invalid Robot Spell', kind: 'spell', level: 1,
    sourceClassId: 'wizard', allowedCreatureTypes: ['robot'],
  },
});

await import('../js/combat-spell-loadout-074.js');
const loadout = globalThis.LuminousCombatSpellLoadout074;
const wizard = { id: 'wizard_1', classId: 'wizard', spellIds: ['beast_command', 'invalid_robot_spell'] };
const trusted = loadout.resolveSpellDefinition('beast_command');
assert.equal(trusted.ok, true);
assert.deepEqual(trusted.spell.allowedCreatureTypes, ['beast']);
assert.equal('creatureTypes' in trusted.spell, false);
assert.equal(loadout.resolveSpellDefinition('invalid_robot_spell').reason, 'SPELL_TARGETING_INVALID');
assert.equal(loadout.validateSpellTarget(trusted.spell, wolf).valid, true);
assert.equal(loadout.validateSpellTarget(trusted.spell, goblin).valid, false);
assert.equal(loadout.resolveSpellForCombatant(wizard, 'beast_command', { target: goblin }).reason, 'SPELL_TARGET_INVALID_CREATURE_TYPE');

// Adapter must reject an illegal explicit target before a CombatAction can be scheduled.
globalThis.combatData = { wizard_1: wizard, wolf_1: wolf, goblin_1: goblin };
globalThis.LuminousBattleViewerActionAdapter073 = {
  combatData() { return globalThis.combatData; },
  unitIdFromSlot(slotId) { return String(slotId).split('_slot_')[0]; },
  compilePlan(slotId, explicitTargetSlotId, plan) {
    const actorId = this.unitIdFromSlot(slotId);
    const targetId = this.unitIdFromSlot(explicitTargetSlotId || plan.targetId || '');
    return {
      action: {
        actorId,
        source: { type: 'spell', id: plan.spellId },
        economy: { cost: 'action' },
        targeting: { mode: 'single', mainTargetId: targetId, targetIds: [targetId], attackWeight: 1 },
        resolution: { type: 'unopposed' },
        resources: [], modifiers: [], effects: [], metadata: {}, state: 'planned',
      },
    };
  },
};
await import('../js/battle-viewer-spell-adapter-074.js');
const adapter = globalThis.LuminousBattleViewerSpellAdapter074;
const legalCompile = adapter.compileCanonicalSpell(
  globalThis.LuminousBattleViewerActionAdapter073,
  'wizard_1_slot_0', 'wolf_1_slot_0',
  { kind: 'spell', spellId: 'beast_command', classId: 'wizard', targetId: 'wolf_1' },
  wizard, {},
);
assert.ok(legalCompile.action, legalCompile.reason);
const illegalCompile = adapter.compileCanonicalSpell(
  globalThis.LuminousBattleViewerActionAdapter073,
  'wizard_1_slot_0', 'goblin_1_slot_0',
  { kind: 'spell', spellId: 'beast_command', classId: 'wizard', targetId: 'goblin_1' },
  wizard, {},
);
assert.equal(illegalCompile.action, null);
assert.equal(illegalCompile.reason, 'spell_target_invalid_creature_type');

// Runtime bridge is authoritative: illegal target stops before the underlying resolver/resource spend.
let resolverCalls = 0;
globalThis.LuminousCombatActionResolver = {
  resolveCombatAction(input, context) {
    resolverCalls += 1;
    return { resolved: true, input, context };
  },
};
globalThis.LuminousCombatAction = {
  normalizeCombatAction(input) { return structuredClone(input); },
};
await import('../js/battle-viewer-spell-runtime-074.js');
const spellRuntime = globalThis.LuminousBattleViewerSpellRuntime074;
spellRuntime.installSpellTargetingResolverBridge();

const restrictedAction = {
  actorId: 'wizard_1',
  source: { type: 'spell', id: 'beast_command' },
  targeting: { mode: 'multi', mainTargetId: 'goblin_1', targetIds: ['goblin_1'], attackWeight: 2 },
  metadata: { sourceDefinition: trusted.spell },
};
const illegalResolution = globalThis.LuminousCombatActionResolver.resolveCombatAction(restrictedAction, {
  units: [wizard, wolf, goblin, kobold],
});
assert.equal(illegalResolution.resolved, false);
assert.equal(illegalResolution.reason, 'SPELL_TARGET_INVALID_CREATURE_TYPE');
assert.equal(illegalResolution.resourcesConsumed, false);
assert.equal(resolverCalls, 0, 'Underlying resolver must not run for illegal Spell targets');

const legalAction = structuredClone(restrictedAction);
legalAction.targeting.mainTargetId = 'wolf_1';
legalAction.targeting.targetIds = ['wolf_1'];
const legalResolution = globalThis.LuminousCombatActionResolver.resolveCombatAction(legalAction, {
  units: [wizard, wolf, goblin, kobold],
});
assert.equal(legalResolution.resolved, true);
assert.equal(resolverCalls, 1);
assert.deepEqual(legalResolution.context.targetCandidates.map((unit) => unit.id), ['wolf_1'], 'Multi-target expansion must only see eligible Creature Types');

console.log('spell targeting language smoke: ok (authoring -> registry -> adapter -> resolver)');
