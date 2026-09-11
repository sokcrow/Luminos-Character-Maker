import assert from 'node:assert/strict';

await import('../js/status-engine.js');
await import('../js/universal-ranged-ammo-runtime.js');
await import('../js/spellcasting-runtime.js');
await import('../js/skill-catalog-kobold-tier1.js');
await import('../js/skill-catalog-goblin-tier1.js');
await import('../js/unit-rank-runtime.js');
await import('../js/unit-combat-mechanics-runtime.js');
await import('../js/unit-catalog-kobold-tier1.js');
await import('../js/unit-catalog-goblin.js');
await import('../js/combat-action-schema.js');
await import('../js/combat-action-adapters.js');
await import('../js/individual-goap-combat-ai.js');
await import('../js/unit-ai-kit-adapter.js');

const ammo = globalThis.LuminousUniversalRangedAmmoRuntime;
const kobolds = globalThis.LuminousKoboldUnitCatalog;
const goblins = globalThis.LuminousGoblinUnitCatalog;
const ai = globalThis.LuminousIndividualGoapCombatAI;
const kitAdapter = globalThis.LuminousUnitAiKitAdapter;

if (!ammo || !kobolds || !goblins || !ai || !kitAdapter) {
  throw new Error('Unit AI kit test dependencies were not initialized.');
}

const playerIdentityOnly = new Proxy({ id: 'player_1' }, {
  get(target, prop, receiver) {
    if (['hp', 'maxHp', 'sp', 'physRes', 'sinRes', 'skills', 'plannedActions'].includes(String(prop))) {
      throw new Error(`AI attempted to read private target field: ${String(prop)}`);
    }
    return Reflect.get(target, prop, receiver);
  },
});

// Canonical Kobold dagger: resolvedSkills should become usable AI sources without a manual sources[] array.
const dagger = kobolds.resolve('kobold_dagger', { level: 2, initializeEncounter: true });
dagger.id = 'kobold_dagger_test';
const daggerKit = kitAdapter.buildKit(dagger);
const daggerIds = daggerKit.sources.map((source) => source.definition.id).sort();
assert.ok(daggerIds.includes('kobold_dagger_jab'));
assert.ok(daggerIds.includes('kobold_desperate_stab'));
assert.ok(daggerIds.includes('kobold_scurry'));
assert.equal(daggerKit.unavailable.length, 0);

const daggerPlan = kitAdapter.planUnitTurn({
  actor: dagger,
  targets: [playerIdentityOnly],
  availableSlots: 2,
  intel: ai.createIntelState(),
});
assert.equal(daggerPlan.planned, true);
assert.equal(daggerPlan.actions.length, 2);
assert.ok(daggerPlan.actions.every((action) => action.actorId === dagger.id));
assert.ok(daggerPlan.actions.every((action) => action.phase.selectedAt === 'planning_phase_ai'));
assert.ok(daggerPlan.actions.every((action) => action.targeting.mainTargetId === 'player_1'));

// Canonical Sling Kobold: ammunition is real encounter state and must gate its ranged attacks.
const sling = kobolds.resolve('kobold_sling', { level: 2, initializeEncounter: true });
sling.id = 'kobold_sling_test';
assert.ok(ammo.ammoCount(sling, 'pebbles') > 0, 'encounter initialization should grant pebbles');

const loadedKit = kitAdapter.buildKit(sling);
const loadedIds = loadedKit.sources.map((source) => source.definition.id);
assert.ok(loadedIds.includes('kobold_sling_shot'));
assert.ok(loadedIds.includes('kobold_rapid_pebble'));
assert.ok(loadedIds.includes('kobold_duck_away'));

ammo.setAmmo(sling, 'pebbles', 0);
assert.equal(ammo.ammoCount(sling, 'pebbles'), 0);
const dryKit = kitAdapter.buildKit(sling);
const dryIds = dryKit.sources.map((source) => source.definition.id);
assert.equal(dryIds.includes('kobold_sling_shot'), false, 'Sling Shot must be removed when ammunition is unavailable');
assert.equal(dryIds.includes('kobold_rapid_pebble'), false, 'Rapid Pebble must be removed when ammunition is unavailable');
assert.ok(dryIds.includes('kobold_duck_away'), 'defense must remain available with no ammunition');
assert.ok(dryKit.unavailable.some((entry) => entry.sourceId === 'kobold_sling_shot' && entry.reason === 'ammunition_unavailable'));
assert.ok(dryKit.unavailable.some((entry) => entry.sourceId === 'kobold_rapid_pebble' && entry.reason === 'ammunition_unavailable'));

const dryPlan = kitAdapter.planUnitTurn({
  actor: sling,
  targetIds: ['player_1'],
  availableSlots: 1,
});
assert.equal(dryPlan.planned, true);
assert.equal(dryPlan.sequence[0].sourceId, 'kobold_duck_away');

ammo.setAmmo(sling, 'pebbles', 3);
const reloadedKit = kitAdapter.buildKit(sling);
assert.ok(reloadedKit.sources.some((source) => source.definition.id === 'kobold_sling_shot'));
assert.ok(reloadedKit.sources.some((source) => source.definition.id === 'kobold_rapid_pebble'));

// Goblin weapon references are backed by the full canonical Tier 1 + Tier 2 kit.
// The adapter must expose those real definitions and never fall back to a pending legacy weapon.
const goblin = goblins.resolve('goblin', { level: 3, initializeEncounter: true });
goblin.id = 'goblin_test';
const goblinKit = kitAdapter.buildKit(goblin);
const goblinSkillIds = goblinKit.sources.map((source) => source.definition.id);
assert.ok(goblinSkillIds.includes('goblin_scimitar_slash'));
assert.ok(goblinSkillIds.includes('goblin_hamstring_cut'));
assert.ok(goblinSkillIds.includes('goblin_shortbow_shot'));
assert.ok(goblinSkillIds.includes('goblin_serrated_slash'));
assert.ok(goblinSkillIds.includes('goblin_crippling_stab'));
assert.ok(goblinSkillIds.includes('goblin_barbed_arrow'));
assert.equal(goblinKit.unresolved.some((entry) => entry.reason === 'canonical_weapon_skill_pending'), false);

const goblinPlan = kitAdapter.planUnitTurn({ actor: goblin, targetIds: ['player_1'], availableSlots: 2, allowGrapple: false });
assert.equal(goblinPlan.planned, true);
assert.ok(goblinPlan.actions.length >= 1);
const canonicalGoblinSkillIds = new Set(goblin.resolvedSkills.map((skill) => skill.id));
assert.ok(goblinPlan.sequence.every((entry) => canonicalGoblinSkillIds.has(entry.sourceId)));

// Generic resource handlers can preflight future resource-bearing Skills/Traits without coupling GOAP to their runtimes.
const customActor = {
  id: 'custom_unit', hp: 10, maxHp: 10, scores: { int: 12, wis: 10 },
  combatSkills: [{
    id: 'charged_hit', sourceType: 'skill', type: 'Attack', basePower: 5, coinPower: 2, coinAmount: 1,
    resourceCosts: [{ type: 'charge', id: 'battery', amount: 1 }],
  }],
};
const blockedCustom = kitAdapter.buildKit(customActor, {
  resourceHandlers: { charge: { validate: () => ({ available: false, reason: 'battery_empty' }) } },
});
assert.equal(blockedCustom.sources.length, 0);
assert.equal(blockedCustom.unavailable[0].reason, 'battery_empty');

const allowedCustom = kitAdapter.buildKit(customActor, {
  resourceHandlers: { charge: { validate: () => ({ available: true }) } },
});
assert.equal(allowedCustom.sources[0].definition.id, 'charged_hit');

// Unknown resource contracts fail closed; GOAP should never plan an action the resolver cannot validate.
const unknownResourceKit = kitAdapter.buildKit(customActor);
assert.equal(unknownResourceKit.sources.length, 0);
assert.equal(unknownResourceKit.unavailable[0].reason, 'resource_validation_unavailable');

// Cooldown state is filtered before GOAP candidate scoring.
const cooldownActor = {
  id: 'cooldown_unit', hp: 10, maxHp: 10, scores: { int: 12, wis: 10 }, cooldowns: { burst: 2 },
  combatSkills: [{ id: 'burst', sourceType: 'skill', type: 'Attack', basePower: 8, coinPower: 2, coinAmount: 1 }],
};
const cooldownKit = kitAdapter.buildKit(cooldownActor);
assert.equal(cooldownKit.sources.length, 0);
assert.equal(cooldownKit.unavailable[0].reason, 'cooldown_active');

// Leveled Spells implicitly consume a spell slot in CombatActionAdapters. The current spellcasting runtime
// does not expose canSpendSpellSlot yet, so the AI must block that Spell rather than choose a doomed action.
const caster = {
  id: 'caster', hp: 10, maxHp: 10, scores: { int: 14, wis: 10 },
  resolvedSpells: [{ id: 'leveled_spell', sourceType: 'spell', level: 1, slotLevel: 1, classId: 'wizard', targetType: 'single' }],
};
const casterKit = kitAdapter.buildKit(caster);
assert.equal(casterKit.sources.length, 0);
assert.equal(casterKit.unavailable[0].reason, 'spell_slot_validator_unavailable');

// Cantrips do not require a spell slot and remain eligible.
const cantripCaster = {
  id: 'cantrip_caster', hp: 10, maxHp: 10, scores: { int: 14, wis: 10 },
  resolvedSpells: [{ id: 'test_cantrip', sourceType: 'spell', level: 0, slotLevel: 0, cantrip: true, targetType: 'single' }],
};
const cantripKit = kitAdapter.buildKit(cantripCaster);
assert.equal(cantripKit.sources.length, 1);
assert.equal(cantripKit.sources[0].definition.id, 'test_cantrip');

console.log('unit-ai-kit-adapter smoke: ok');