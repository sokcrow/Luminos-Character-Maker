import assert from "node:assert/strict";

globalThis.LuminousContentRegistry = {
  entries: new Map(),
  registerSource(type, store, collection) {
    for (const [id, definition] of Object.entries(collection || {})) {
      this.entries.set(`${type}:${id}`, { definition: JSON.parse(JSON.stringify(definition)) });
    }
  },
  get(type, id) {
    if (id === undefined) return this.entries.get(type) || null;
    return this.entries.get(`${type}:${id}`) || null;
  }
};

globalThis.LuminousContentRegistryBootstrap = {
  registerAvailableCore() {
    if (globalThis.LuminousSpellCatalog) {
      globalThis.LuminousContentRegistry.registerSource("spell", "spell-catalog", globalThis.LuminousSpellCatalog);
    }
  }
};

globalThis.LuminousSpellcastingRuntime = {
  getClassSpellcastingAbility(id) {
    return {
      artificer: "int", bard: "cha", druid: "wis",
      sorcerer: "cha", warlock: "cha", wizard: "int"
    }[id] || null;
  },
  resolveSpellcasting(actor, classId) {
    const spellMod = classId === "wizard" ? 3 : 2;
    return { classId, spellMod, proficiency: 2, spellDC: 8 + spellMod + 2 };
  }
};

await import("../js/creature-type-catalog.js");
await import("../js/spell-targeting-language.js");
await import("../js/spell-catalog-core.js");
await import("../js/combat-spell-loadout-074.js");
const loadout = globalThis.LuminousCombatSpellLoadout074;

const wizard = {
  id: "wizard_unit",
  classId: "wizard",
  level: 40,
  spellIds: ["fire_bolt", "scorching_ray", "old_test_spell"]
};
const barbarian = {
  id: "barbarian_unit",
  classId: "barbarian",
  level: 40,
  spellIds: ["fire_bolt"]
};

assert.equal(loadout.canCastSpells(wizard), true);
assert.deepEqual(loadout.spellIdsFor(wizard), ["fire_bolt", "scorching_ray"]);
assert.equal(loadout.canCastSpells(barbarian), false);
assert.deepEqual(loadout.spellIdsFor(barbarian), []);
assert.equal(loadout.resolveSpellForCombatant(barbarian, "fire_bolt").reason, "SPELLCASTING_ABILITY_REQUIRED");
assert.equal(loadout.resolveSpellForCombatant(wizard, "old_test_spell").reason, "SPELL_DEFINITION_NOT_FOUND");

const unrestrictedFire = loadout.resolveSpellDefinition("fire_bolt").spell;
assert.deepEqual(unrestrictedFire.allowedCreatureTypes, []);
assert.deepEqual(unrestrictedFire.excludedCreatureTypes, []);
assert.deepEqual(unrestrictedFire.allowedCreatureSubtypes, []);
assert.deepEqual(unrestrictedFire.excludedCreatureSubtypes, []);
assert.equal(loadout.validateSpellTarget(unrestrictedFire, { id: "legacy_target_without_creature_type" }).valid, true);

globalThis.LuminousBattleViewerActionAdapter073 = {
  compilePlan() {
    return { action: { targeting: { attackWeight: 1 }, economy: { cost: "action" }, metadata: {}, effects: [] } };
  }
};

await import("../js/battle-viewer-spell-adapter-074.js");
const adapter = globalThis.LuminousBattleViewerSpellAdapter074;

const fire = loadout.resolveSpellDefinition("fire_bolt").spell;
const fire40 = adapter.materializeSpell(wizard, "wizard", fire, 0, {});
assert.equal(fire40.ok, true);
assert.equal(fire40.definition.coinPower, 10);
assert.equal(fire40.definition.effects[0].status, "burn");

const ray = loadout.resolveSpellDefinition("scorching_ray").spell;
const rayAt4 = adapter.materializeSpell(wizard, "wizard", ray, 4, {});
assert.equal(rayAt4.definition.coinAmount, 5);

const orb = loadout.resolveSpellDefinition("chromatic_orb").spell;
assert.equal(adapter.materializeSpell(wizard, "wizard", orb, 1, {}).reason, "spell_choice_required");
const fireOrb = adapter.materializeSpell(wizard, "wizard", orb, 2, { element: "fire" });
assert.equal(fireOrb.definition.coinPower, 11);
assert.equal(fireOrb.definition.effects[0].status, "burn");

console.log("canonical spell runtime smoke: ok");
