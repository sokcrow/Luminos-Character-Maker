import assert from 'node:assert/strict';

// Exercise the real Unit Library -> DM deploy -> Combat FIELD/BACKUP pipeline.
globalThis.window = globalThis;
for (const file of [
  'movement-speed-runtime.js',
  'skill-catalog-kobold-tier1.js',
  'unit-catalog-kobold-tier1.js',
  'universal-library-runtime.js',
  'combat-deployment-runtime.js',
  'unit-combat-instantiator.js',
  'combat-session-lifecycle.js',
]) await import(`../js/${file}`);

const catalog = globalThis.LuminousKoboldUnitCatalog;
const lib = globalThis.LuminousUniversalLibrary;
const spellRefs = ['fire_bolt', 'poison_spray', 'charm_person', 'chromatic_orb', 'expeditious_retreat', 'scorching_ray'];
const sorcerer = catalog.get('scale_sorcerer_kobold');
assert.deepEqual(sorcerer.action_slots, ['kobold_dagger_jab'], 'Only true Combat Skills belong to action_slots');
assert.deepEqual(sorcerer.mechanics.skills, ['kobold_dagger_jab']);
assert.deepEqual(sorcerer.spellIds, spellRefs, 'Canonical spells must remain equipped separately');
assert.equal(sorcerer.classId, 'sorcerer', 'Spellcasting authority requires the canonical class');

const legacy = {
  ...sorcerer,
  classId: undefined,
  spellIds: undefined,
  action_slots: ['kobold_dagger_jab', ...spellRefs.map(id => `spell:${id}`)],
  mechanics: {
    ...sorcerer.mechanics,
    skills: ['kobold_dagger_jab', ...spellRefs.map(id => `spell:${id}`)],
  },
};
const migrated = lib.unitWithLoadout(legacy);
assert.deepEqual(migrated.skillIds, ['kobold_dagger_jab']);
assert.deepEqual(migrated.mechanics.skills, ['kobold_dagger_jab']);
assert.deepEqual(migrated.spellIds, spellRefs);
assert.equal(migrated.classId, 'sorcerer');

function makeDb() {
  const root = { estado: { phase: 'PRE_COMBAT_PLANNING', round: 1, active: true }, combatants: {}, reserves: {} };
  const db = {
    root,
    ref(path = '') {
      const read = () => path === 'campaña/combate' ? root : null;
      return {
        once: async () => ({ val: read }),
        on: (_event, listener) => listener({ val: read }),
        off: () => {},
        transaction: async (mutator) => {
          const next = mutator(root);
          if (next === undefined) return { committed: false, snapshot: { val: () => root } };
          Object.keys(root).forEach(key => delete root[key]);
          Object.assign(root, next);
          return { committed: true, snapshot: { val: () => structuredClone(root) } };
        },
      };
    },
  };
  return db;
}

const db = makeDb();
globalThis.LuminousCombatLiveAdapter073 = { state: { role: 'dm' } };
globalThis.LuminousCombatUnitLibrarySync = {
  state: { localSkills: { kobold_dagger_jab: { id: 'kobold_dagger_jab', name: 'Dagger Jab' } } },
};
globalThis.LuminousCombatDmSetup073 = {
  state: { db, units: { scale_sorcerer_kobold: legacy } },
  requirePlanning() {},
  async ensureEncounterIdentity() {},
};
await import('../js/combat-v073-unit-deploy-bridge.js');
const bridge = globalThis.LuminousCombat073UnitDeployBridge;
const resolved = await bridge.resolveDeploymentDefinition('scale_sorcerer_kobold', legacy, db);
assert.deepEqual(resolved.missingSkills, [], 'Spell references must not trigger UNIT_LOADOUT_INVALID');
assert.deepEqual(resolved.skillIds, ['kobold_dagger_jab']);
assert.deepEqual(resolved.definition.spellIds, spellRefs);

const [field] = await bridge.deployUnits('scale_sorcerer_kobold', 'enemy', 1);
assert.equal(field.isBackup, false);
assert.equal(field.deploymentState, 'field');
assert.equal(field.classId, 'sorcerer');
assert.deepEqual(field.spellIds, spellRefs);
assert.deepEqual(field.skillIds, ['kobold_dagger_jab']);

// Fill the remaining seven enemy positions; the next Sorcerer must enter BACKUP.
for (let index = 0; index < 7; index += 1) {
  const id = `enemy:fixture:${index}`;
  db.root.combatants[id] = { id, faction: 'enemy', battleActive: true, deploymentState: 'field', hp: 10 };
}
const [backup] = await bridge.deployUnits('scale_sorcerer_kobold', 'enemy', 1);
assert.equal(backup.isBackup, true);
assert.equal(backup.deploymentState, 'backup');
assert.deepEqual(backup.spellIds, spellRefs);
assert.deepEqual(backup.skillIds, ['kobold_dagger_jab']);
assert.equal(Object.keys(db.root.combatants).length, 8);
assert.equal(Object.keys(db.root.reserves).length, 1);

console.log('Scale Sorcerer Kobold FIELD + BACKUP deployment smoke OK');
