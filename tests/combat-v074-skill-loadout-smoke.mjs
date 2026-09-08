import assert from 'node:assert/strict';

await import('../js/combat-skill-schema.js');
await import('../js/combat-skill-loadout-074.js');

const loadout = globalThis.LuminousCombatSkillLoadout074;
if (!loadout) throw new Error('LuminousCombatSkillLoadout074 was not initialized.');

assert.equal(loadout.version, '0.7.4');
assert.equal(loadout.ROOTS.skills, 'campaña/base_datos_skills');
assert.equal(loadout.ROOTS.units, 'campaña/base_datos_unidades');

const validSkill = (name, overrides = {}) => ({
  name,
  type: 'Attack',
  tier: 1,
  basePower: 5,
  coinPower: 3,
  coinAmount: 2,
  damageType: 'cortante',
  sinAffinity: 'wrath',
  effects: [],
  coins: [{ effects: [] }, { effects: [] }],
  schemaVersion: 2,
  ...overrides,
});

const slotSource = {
  action_slots: ['skill_a', 'skill_b', 'skill_a'],
};
assert.deepEqual(loadout.skillSlotIdsFor(slotSource), ['skill_a', 'skill_b', 'skill_a']);
assert.deepEqual(loadout.skillIdsFor(slotSource), ['skill_a', 'skill_b']);
assert.deepEqual(loadout.buildEquippedSkillIndex(slotSource), { skill_a: true, skill_b: true });

const objectSlots = {
  action_slots: { 2: 'skill_c', 0: 'skill_a', 1: 'skill_b' },
};
assert.deepEqual(loadout.skillSlotIdsFor(objectSlots), ['skill_a', 'skill_b', 'skill_c']);

// Player -> Unit resolution must use canonical identity signals, never display names.
const units = {};
for (let i = 1; i <= 8; i += 1) {
  units[`unit_${i}`] = {
    id: `unit_${i}`,
    isPlayer: true,
    name: i === 1 ? 'Repeated Name' : `Unit ${i}`,
    linkedPlayerUID: `uid-${i}`,
    action_slots: [`skill_${i}_a`, `skill_${i}_b`],
  };
}
for (let i = 1; i <= 8; i += 1) {
  const resolved = loadout.resolvePlayerUnit({
    category: 'player',
    ownerUid: `uid-${i}`,
    playerId: `player_${i}`,
    actorId: `actor_${i}`,
    name: i === 8 ? 'Repeated Name' : `Player ${i}`,
  }, units);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.unitId, `unit_${i}`);
  assert.deepEqual(loadout.skillSlotIdsFor(resolved.unit), [`skill_${i}_a`, `skill_${i}_b`]);
}

const nameOnly = loadout.resolvePlayerUnit({
  category: 'player', ownerUid: 'uid-no-match', playerId: 'player-no-match', name: 'Repeated Name',
}, {
  unit_name_collision: { isPlayer: true, name: 'Repeated Name', action_slots: ['wrong_skill'] },
});
assert.equal(nameOnly.ok, false);
assert.equal(nameOnly.reason, 'PLAYER_UNIT_NOT_FOUND');

const ambiguous = loadout.resolvePlayerUnit({
  category: 'player', ownerUid: 'uid-ambiguous', playerId: 'player_ambiguous',
}, {
  unit_a: { isPlayer: true, linkedPlayerUID: 'uid-ambiguous', action_slots: ['skill_a'] },
  unit_b: { isPlayer: true, linkedPlayerUID: 'uid-ambiguous', action_slots: ['skill_b'] },
});
assert.equal(ambiguous.ok, false);
assert.equal(ambiguous.reason, 'AMBIGUOUS_PLAYER_UNIT');
assert.deepEqual(ambiguous.matches.sort(), ['unit_a', 'unit_b']);

const skills = {
  skill_a: validSkill('Canonical A', { basePower: 7, coinPower: 2, coinAmount: 2 }),
  skill_b: validSkill('Canonical B', { basePower: 4, coinPower: 4, coinAmount: 1 }),
  invalid_skill: { name: 'Broken Skill', basePower: 4, coinAmount: 1 },
};

const hydrated = loadout.hydrateLoadout({ action_slots: ['skill_a', 'skill_b', 'skill_a'] }, skills);
assert.equal(hydrated.ready, true);
assert.equal(hydrated.hasErrors, false);
assert.deepEqual(hydrated.slotIds, ['skill_a', 'skill_b', 'skill_a']);
assert.deepEqual(hydrated.skillIds, ['skill_a', 'skill_b']);
assert.deepEqual(hydrated.equippedSkillIndex, { skill_a: true, skill_b: true });
assert.equal(hydrated.slots.length, 3);
assert.equal(hydrated.slots[0].status, 'ready');
assert.equal(hydrated.skillsById.skill_a.id, 'skill_a');
assert.equal(hydrated.skillsById.skill_a.libraryKey, 'skill_a');
assert.equal(hydrated.skillsById.skill_a.basePower, 7);
assert.equal(hydrated.skillsById.skill_a.coinPower, 2);

const brokenHydration = loadout.hydrateLoadout({ action_slots: ['skill_a', 'missing_skill', 'invalid_skill'] }, skills);
assert.equal(brokenHydration.ready, false);
assert.equal(brokenHydration.hasErrors, true);
assert.deepEqual(brokenHydration.missingIds, ['missing_skill']);
assert.deepEqual(brokenHydration.invalidIds, ['invalid_skill']);
assert.equal(brokenHydration.slots[1].status, 'missing');
assert.equal(brokenHydration.slots[2].status, 'invalid');

loadout.applySkills(skills);
const combatant = {
  id: 'player:player_1',
  skillSlotIds: ['skill_a', 'skill_b'],
  skillIds: ['skill_a', 'skill_b'],
  equippedSkillIndex: { skill_a: true, skill_b: true },
};
const equipped = loadout.resolveSkillForCombatant(combatant, 'skill_a');
assert.equal(equipped.ok, true);
assert.equal(equipped.skill.id, 'skill_a');
assert.equal(equipped.skill.basePower, 7);
assert.equal(loadout.resolveSkillForCombatant(combatant, 'skill_not_equipped').reason, 'SKILL_NOT_EQUIPPED');

const missingEquipped = {
  ...combatant,
  skillSlotIds: ['missing_skill'],
  skillIds: ['missing_skill'],
  equippedSkillIndex: { missing_skill: true },
};
assert.equal(loadout.resolveSkillForCombatant(missingEquipped, 'missing_skill').reason, 'SKILL_NOT_FOUND');

console.log('combat-v074-skill-loadout-smoke: ok');
