const { test, expect } = require("@playwright/test");

const traitEngine = require("../js/trait-engine.js");
const archetypeEngine = require("../js/archetype-engine.js");
const catalog = require("../js/archetype-trait-catalog.js");

function character(levels, archetypes = []) {
  return {
    characterBuild: {
      classes: Object.entries(levels).map(([classId, level]) => ({ classId, level })),
      archetypes,
      calculatedAtLevel: Object.values(levels).reduce((sum, level) => sum + level, 0),
    },
    stats: { fuerza: 18, constitucion: 16 },
    combatStats: { hp_max: 200, hp_actual: 100 },
  };
}

test("Archetype unlock usa Class Level y no Character Level", () => {
  const highTotalLowBarbarian = character({ barbarian: 14, wizard: 60 });
  expect(archetypeEngine.getClassLevel(highTotalLowBarbarian, "barbarian")).toBe(14);
  expect(archetypeEngine.eligibleArchetypes(highTotalLowBarbarian, catalog.allArchetypes(), "barbarian")).toHaveLength(0);

  const unlocked = character({ barbarian: 15, wizard: 60 });
  expect(archetypeEngine.eligibleArchetypes(unlocked, catalog.allArchetypes(), "barbarian").map((entry) => entry.id)).toContain("path_of_the_devil_lineage");
});

test("multiclase conserva un Archetype separado por Class", () => {
  const fakeCatalog = {
    path_of_the_devil_lineage: catalog.ARCHETYPES.path_of_the_devil_lineage,
    school_of_test: { id: "school_of_test", name: "School of Test", classId: "wizard", className: "Wizard", unlockLevel: 15 },
  };
  const base = character({ barbarian: 20, wizard: 20 });
  const barbarian = archetypeEngine.selectArchetype(base, "barbarian", "path_of_the_devil_lineage", fakeCatalog);
  const withBarbarian = character({ barbarian: 20, wizard: 20 }, barbarian);
  const both = archetypeEngine.selectArchetype(withBarbarian, "wizard", "school_of_test", fakeCatalog);
  expect(both).toHaveLength(2);
  expect(both.find((entry) => entry.classId === "barbarian")?.archetypeId).toBe("path_of_the_devil_lineage");
  expect(both.find((entry) => entry.classId === "wizard")?.archetypeId).toBe("school_of_test");
});

test("validateSelections rechaza dos Archetypes persistidos para la misma Class", () => {
  const malformed = character({ barbarian: 40 }, [
    { classId: "barbarian", archetypeId: "path_of_the_devil_lineage", selectedAtClassLevel: 15 },
    { classId: "barbarian", archetypeId: "path_of_the_devil_lineage", selectedAtClassLevel: 30 },
  ]);
  const normalized = archetypeEngine.normalizeSelections(malformed);
  expect(normalized).toHaveLength(2);
  const validation = archetypeEngine.validateSelections(malformed, catalog.allArchetypes());
  expect(validation.valid).toBe(false);
  expect(validation.errors.some((message) => message.includes("Only one Archetype can be selected for barbarian"))).toBe(true);
});

test("Path of the Devil Lineage entrega Traits por pisos 15/30/50/70", () => {
  const expected = new Map([[15, 4], [30, 5], [50, 9], [70, 13]]);
  for (const [level, count] of expected) {
    const unit = character({ barbarian: level }, [{ classId: "barbarian", archetypeId: "path_of_the_devil_lineage", selectedAtClassLevel: 15 }]);
    const traits = catalog.resolveTraitGrants(unit);
    expect(traits).toHaveLength(count);
    for (const trait of traits) {
      expect(trait.source.type).toBe("archetype");
      expect(trait.source.archetypeId).toBe("path_of_the_devil_lineage");
      expect(trait.source.classId).toBe("barbarian");
      expect(trait.source.requiredClassLevel).toBeLessThanOrEqual(level);
    }
  }
});

test("Orosh Lineage se desbloquea para Sorcerer en Class Level 1", () => {
  const unit = character({ sorcerer: 1 });
  const eligible = archetypeEngine.eligibleArchetypes(unit, catalog.allArchetypes(), "sorcerer");
  expect(eligible.map((entry) => entry.id)).toContain("orosh_lineage");
  expect(catalog.ARCHETYPES.orosh_lineage.traitLevels).toEqual([1, 30, 70, 85]);
});

test("Orosh Lineage entrega Traits por pisos 1/30/70/85", () => {
  const expected = new Map([[1, 3], [30, 4], [70, 5], [85, 6]]);
  for (const [level, count] of expected) {
    const unit = character({ sorcerer: level }, [{ classId: "sorcerer", archetypeId: "orosh_lineage", selectedAtClassLevel: 1 }]);
    const traits = catalog.resolveTraitGrants(unit);
    expect(traits).toHaveLength(count);
    for (const trait of traits) {
      expect(trait.source.type).toBe("archetype");
      expect(trait.source.archetypeId).toBe("orosh_lineage");
      expect(trait.source.classId).toBe("sorcerer");
      expect(trait.source.requiredClassLevel).toBeLessThanOrEqual(level);
    }
  }
});

test("Orosh Lineage conserva las mecánicas acordadas", () => {
  const defs = catalog.allDefinitions();
  expect(defs.orosh_lineage_termosense.mechanics.targetingIgnores).toEqual(["normal_darkness", "magical_darkness", "visual_camouflage"]);
  expect(defs.orosh_lineage_emotional_echo.mechanics.insightFinalPowerBonus).toBe(2);
  expect(defs.orosh_lineage_fragmented_blessing.mechanics.matchingSinDamagePercentFormula).toBe("ClassLevel / 2");
  expect(defs.orosh_lineage_fragmented_blessing.mechanics.matchingSinFinalPowerFormula).toBe("max(1, ClassLevel / 20)");
  expect(defs.orosh_lineage_primordial_bond.mechanics.attackWeightBonus).toBe(1);
  expect(defs.orosh_lineage_voice_of_the_first.mechanics.echoes.wrath.damagePercent).toBe(30);
  expect(defs.orosh_lineage_voice_of_the_first.mechanics.echoes.sloth.onHitStatus).toEqual({ statusId: "bind", potency: 2 });
  expect(defs.orosh_lineage_ascension_of_the_heiress.mechanics.durationRounds).toBe(10);
  expect(defs.orosh_lineage_ascension_of_the_heiress.mechanics.slotRecoveryOnKill).toMatchObject({ count: 3, maxSlotLevel: 5, scope: "once_per_turn" });
});

test("sin selección de Archetype no se conceden Traits de Archetype", () => {
  expect(catalog.resolveTraitGrants(character({ barbarian: 70 }))).toEqual([]);
});

test("todas las definiciones del Archetype son válidas para Trait Engine", () => {
  for (const [id, definition] of Object.entries(catalog.allDefinitions())) {
    const validation = traitEngine.validateTrait(definition);
    expect(validation.errors, `${id}: ${validation.errors.join(" | ")}`).toEqual([]);
  }
});

test("Demonic Resistance puede ejecutar su Recover de Turn Start", () => {
  const definition = catalog.allDefinitions().devil_lineage_demonic_resistance;
  const state = traitEngine.createState();
  const self = { hp: 100, maxHp: 200 };
  const unit = character({ barbarian: 15 }, [{ classId: "barbarian", archetypeId: "path_of_the_devil_lineage" }]);
  unit.combatStats.hp_max = 200;
  const result = traitEngine.dispatchTrait(definition, "turn_start", { context: "combat", character: unit, self, Proficiency: 1 }, state);
  expect(result.outcomes.some((outcome) => outcome.type === "heal_hp")).toBe(true);
  expect(self.hp).toBeGreaterThan(100);
});

test("groupTraitsByArchetype separa visualmente varios Archetypes", () => {
  const groups = archetypeEngine.groupTraitsByArchetype([
    { id: "a", source: { type: "archetype", archetypeId: "devil", archetypeName: "Devil", classId: "barbarian" } },
    { id: "b", source: { type: "archetype", archetypeId: "school", archetypeName: "School", classId: "wizard" } },
    { id: "c", source: { type: "archetype", archetypeId: "devil", archetypeName: "Devil", classId: "barbarian" } },
  ]);
  expect(groups).toHaveLength(2);
  expect(groups.find((group) => group.archetypeId === "devil")?.traits).toHaveLength(2);
  expect(groups.find((group) => group.archetypeId === "school")?.traits).toHaveLength(1);
});
