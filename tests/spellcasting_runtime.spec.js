const { test, expect } = require("@playwright/test");

const baseTraitEngine = require("../js/trait-engine.js");
global.LuminousTraitEngine = baseTraitEngine;
delete global.LuminousSpellcastingRuntime;
const spellcasting = require("../js/spellcasting-runtime.js");

function bardCharacter() {
  return {
    level: 40,
    proficiency: 4,
    classes: [{ classId: "bard", levels: 40 }],
    stats: { carisma: 20, inteligencia: 16 },
  };
}

test("Bard resolves Spell Mod and Spell DC from the Class once", () => {
  const trait = {
    id: "bard_spell_test",
    name: "Bard Spell Test",
    source: { type: "class", id: "bard", classId: "bard" },
    contexts: ["any"],
    activation: { type: "passive", actionCost: "none" },
    effects: [],
    rules: [],
  };
  const variables = global.LuminousTraitEngine.buildVariables(bardCharacter(), {}, trait);
  expect(spellcasting.getClassSpellcastingAbility("bard")).toBe("cha");
  expect(variables.SpellMod).toBe(5);
  expect(variables.SpellDC).toBe(17);
});

test("Archetype Traits inherit their parent Class Spellcasting Ability", () => {
  const trait = {
    id: "words_of_terror",
    name: "Words of Terror",
    source: { type: "archetype", id: "college_of_whispers", archetypeId: "college_of_whispers", classId: "bard" },
    contexts: ["any"],
    activation: { type: "manual", actionCost: "none" },
    effects: [],
    rules: [],
  };
  const variables = global.LuminousTraitEngine.buildVariables(bardCharacter(), {}, trait);
  expect(variables.SpellMod).toBe(5);
  expect(variables.SpellDC).toBe(17);
});

test("Spellcasting registry is reusable for future Classes", () => {
  spellcasting.registerClassSpellcastingAbility("wizard", "int");
  const trait = {
    id: "wizard_spell_test",
    source: { type: "class", id: "wizard", classId: "wizard" },
    contexts: ["any"],
    activation: { type: "passive", actionCost: "none" },
    effects: [],
    rules: [],
  };
  const variables = global.LuminousTraitEngine.buildVariables(bardCharacter(), {}, trait);
  expect(variables.SpellMod).toBe(3);
  expect(variables.SpellDC).toBe(15);
});
