const { test, expect } = require("@playwright/test");

const baseTraitEngine = require("../js/trait-engine.js");
global.LuminousTraitEngine = baseTraitEngine;
delete global.LuminousSpellcastingRuntime;
delete require.cache[require.resolve("../js/spellcasting-runtime.js")];
delete require.cache[require.resolve("../js/spellcasting-basic-rules-runtime.js")];
require("../js/spellcasting-runtime.js");
const spellcasting = require("../js/spellcasting-basic-rules-runtime.js");

function bardCharacter(overrides = {}) {
  return {
    id: "bard_pc",
    level: 40,
    proficiency: 4,
    classes: [{
      classId: "bard",
      levels: 40,
      spellcasting: { slots: { 1: 4, 2: 3, 3: 2, 4: 1, 5: 1 } },
    }],
    stats: { carisma: 20, inteligencia: 16, constitucion: 14 },
    currentSp: 20,
    hp: 100,
    ...overrides,
  };
}

function bardTrait(source = { type: "class", id: "bard", classId: "bard" }) {
  return {
    id: "bard_spell_test",
    name: "Bard Spell Test",
    source,
    contexts: ["any"],
    activation: { type: "passive", actionCost: "none" },
    effects: [],
    rules: [],
  };
}

test("Bard resolves Spell Mod and Spell DC from the Class once", () => {
  const variables = global.LuminousTraitEngine.buildVariables(bardCharacter(), {}, bardTrait());
  expect(spellcasting.getClassSpellcastingAbility("bard")).toBe("cha");
  expect(variables.SpellMod).toBe(5);
  expect(variables.SpellDC).toBe(17);
});

test("Archetype Traits inherit their parent Class Spellcasting Ability", () => {
  const trait = bardTrait({ type: "archetype", id: "college_of_whispers", archetypeId: "college_of_whispers", classId: "bard" });
  const variables = global.LuminousTraitEngine.buildVariables(bardCharacter(), {}, trait);
  expect(variables.SpellMod).toBe(5);
  expect(variables.SpellDC).toBe(17);
});

test("Spellcasting registry is reusable and saved Class data may override its Ability", () => {
  spellcasting.registerClassSpellcastingAbility("wizard", "int");
  const wizardTrait = bardTrait({ type: "class", id: "wizard", classId: "wizard" });
  const wizard = bardCharacter({ classes: [{ classId: "wizard", levels: 40, spellcastingAbility: "cha" }] });
  let variables = global.LuminousTraitEngine.buildVariables(wizard, {}, wizardTrait);
  expect(spellcasting.getClassSpellcastingAbility("wizard")).toBe("int");
  expect(spellcasting.classSpellcastingAbility(wizard, "wizard")).toBe("cha");
  expect(variables.SpellMod).toBe(5);

  delete wizard.classes[0].spellcastingAbility;
  variables = global.LuminousTraitEngine.buildVariables(wizard, {}, wizardTrait);
  expect(variables.SpellMod).toBe(3);
});

test("Spell Slots are tracked per Class and restored on Long Rest", () => {
  const character = bardCharacter();
  expect(spellcasting.spellSlotPool(character, "bard").levels[3]).toMatchObject({ maximum: 2, available: 2 });
  expect(spellcasting.spendSpellSlot(character, "bard", 3).spent).toBe(1);
  expect(spellcasting.spellSlotPool(character, "bard").levels[3].available).toBe(1);

  spellcasting.handleRestCompleted({ detail: { type: "long_rest", character } });
  expect(spellcasting.spellSlotPool(character, "bard").levels[3].available).toBe(2);
});

test("Cantrips spend no Slot and no Overcast resource", () => {
  const character = bardCharacter();
  const result = spellcasting.castSpell(character, {
    id: "mock_cantrip",
    name: "Mock Cantrip",
    slotLevel: 0,
    sourceClassId: "bard",
  });
  expect(result.success).toBe(true);
  expect(result.resource).toMatchObject({ type: "cantrip", spent: 0 });
  expect(character.currentSp).toBe(20);
});

test("Overcast costs 15 SP per Slot Level and overflow becomes Fixed Damage", () => {
  const character = bardCharacter({ currentSp: 20 });
  character.classes[0].spellcasting.slots = { 3: 1 };
  spellcasting.spendSpellSlot(character, "bard", 3);

  const fixedDamageCalls = [];
  const result = spellcasting.castSpell(character, {
    id: "mock_level_three",
    name: "Mock Level Three",
    slotLevel: 3,
    sourceClassId: "bard",
  }, {
    slotLevel: 3,
    overcast: true,
    fixedDamageRuntime: {
      applyFixedDamage(target, amount) {
        fixedDamageCalls.push({ target, amount });
        return { applied: true, amount };
      },
    },
  });

  expect(result.success).toBe(true);
  expect(result.resource.type).toBe("overcast");
  expect(result.resource.overcast).toMatchObject({ spCost: 45, spSpent: 20, spAfter: 0, overflowFixedDamage: 25 });
  expect(fixedDamageCalls).toHaveLength(1);
  expect(fixedDamageCalls[0].amount).toBe(25);
});

test("Overcast overflow never mutates SP when Fixed Damage is unavailable", () => {
  const character = bardCharacter({ currentSp: 5 });
  const result = spellcasting.applyOvercast(character, 2, { fixedDamageRuntime: {} });
  expect(result.success).toBe(false);
  expect(result.reason).toContain("Fixed Damage Runtime");
  expect(character.currentSp).toBe(5);
});

test("Upcast exposes Final Power, Coin Power, ATK Weight and Duration as independent channels", () => {
  const result = spellcasting.resolveUpcast({
    slotLevel: 2,
    upcast: { finalPower: 1, coinPower: 2, atkWeight: 1, duration: 3 },
  }, 5);

  expect(result).toMatchObject({
    baseSlotLevel: 2,
    slotLevel: 5,
    extraLevels: 3,
    finalPower: 3,
    coinPower: 6,
    atkWeight: 3,
    duration: 9,
  });
});

test("Spell Saves use the Class Spell DC and preserve success behavior metadata", () => {
  const save = spellcasting.resolveSpellSave(bardCharacter(), "bard", {
    save: { ability: "dex", onSuccess: "half" },
  });
  expect(save).toMatchObject({ abilityId: "dex", onSuccess: "half", dc: 17, classId: "bard" });
});

test("Casting Time emits a Scene Time Action Instance contract", () => {
  const action = spellcasting.buildCastingActionMessage({
    id: "two_round_ritual",
    name: "Two Round Ritual",
    castingTimeRounds: 2,
  }, "bard_pc");
  expect(action).toMatchObject({
    tipo_dialogo: "actuar",
    actorId: "bard_pc",
    actionDurationSeconds: 12,
    actionBucket: "prolonged",
    spellId: "two_round_ritual",
    source: "spellcasting",
  });
  expect(spellcasting.buildCastingActionMessage({ castingTime: "instant" }, "bard_pc")).toBeNull();
});

test("Concentration creates one Constitution Check per damaging Skill using its highest Final Power", () => {
  const character = bardCharacter();
  spellcasting.startConcentration(character, { id: "hold_mock", name: "Hold Mock", concentration: true }, { classId: "bard" });

  const first = spellcasting.concentrationCheckForSkill(character, {
    skillEventId: "enemy_skill_1",
    finalPowers: [11, 18, 13],
  });
  expect(first).toMatchObject({ required: true, duplicate: false, abilityId: "con", dc: 18, highestFinalPower: 18 });

  const duplicate = spellcasting.concentrationCheckForSkill(character, {
    skillEventId: "enemy_skill_1",
    finalPowers: [99],
  });
  expect(duplicate.required).toBe(false);
  expect(duplicate.duplicate).toBe(true);
  expect(duplicate.dc).toBe(18);
});

test("Failed Concentration Check ends the active Spell; success preserves it", () => {
  const character = bardCharacter();
  spellcasting.startConcentration(character, { id: "focus", concentration: true }, { classId: "bard" });
  const check = spellcasting.concentrationCheckForSkill(character, { skillEventId: "hit_1", finalPower: 15 });
  expect(spellcasting.resolveConcentrationCheck(character, check, 15).success).toBe(true);
  expect(spellcasting.ensureSpellcastingState(character).concentration.active.spellId).toBe("focus");

  const second = spellcasting.concentrationCheckForSkill(character, { skillEventId: "hit_2", finalPower: 19 });
  expect(spellcasting.resolveConcentrationCheck(character, second, 18).success).toBe(false);
  expect(spellcasting.ensureSpellcastingState(character).concentration.active).toBeUndefined();
});
