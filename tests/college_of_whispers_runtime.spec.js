const { test, expect } = require("@playwright/test");

const baseTraitEngine = require("../js/trait-engine.js");
global.LuminousTraitEngine = baseTraitEngine;
global.LuminousStatusEngine = require("../js/status-engine.js");
global.LuminousArchetypeEngine = require("../js/archetype-engine.js");
delete global.LuminousSpellcastingRuntime;
require("../js/spellcasting-runtime.js");
const catalog = require("../js/archetype-trait-catalog.js");
global.LuminousArchetypeTraitCatalog = catalog;
delete global.LuminousCollegeOfWhispersRuntime;
const whispers = require("../js/college-of-whispers-runtime.js");

function character(level = 30) {
  return {
    id: `bard-${level}`,
    name: "Whisper Bard",
    level,
    proficiency: Math.ceil(level / 20),
    classes: [{ classId: "bard", levels: level }],
    characterBuild: {
      classes: [{ classId: "bard", level }],
      archetypes: [{ classId: "bard", archetypeId: "college_of_whispers", selectedAtClassLevel: 15 }],
      calculatedAtLevel: level,
    },
    stats: { carisma: 20, sabiduria: 14 },
  };
}

test("College of Whispers grants Traits at Bard Class Levels 15/30/70", () => {
  const l15 = catalog.resolveTraitGrants(character(15)).map((trait) => trait.id);
  const l30 = catalog.resolveTraitGrants(character(30)).map((trait) => trait.id);
  const l70 = catalog.resolveTraitGrants(character(70)).map((trait) => trait.id);

  expect(l15).toEqual(expect.arrayContaining(["psychic_blade", "words_of_terror"]));
  expect(l15).toHaveLength(2);
  expect(l30).toEqual(expect.arrayContaining(["psychic_blade", "words_of_terror", "mantle_of_whispers"]));
  expect(l30).toHaveLength(3);
  expect(l70).toEqual(expect.arrayContaining(["psychic_blade", "words_of_terror", "mantle_of_whispers", "shadow_lore"]));
  expect(l70).toHaveLength(4);
});

test("Psychic Blade spends Bardic Inspiration, gains Count, reduces SP and loses 1 Count On Hit", () => {
  const bard = character(30);
  const self = { id: bard.id, name: bard.name, statusEffects: {} };
  const target = { id: "target", name: "Target", sp: 20, statusEffects: {} };
  const psychicBlade = catalog.getDefinition("psychic_blade");
  const engine = global.LuminousTraitEngine;
  const state = engine.createState();

  const activation = engine.activateTrait(psychicBlade, { context: "combat", character: bard, self }, state);
  expect(activation.available).toBe(true);
  expect(state.usages.bardic_inspiration.used).toBe(1);
  expect(self.statusEffects.psychic_blade.count).toBeCloseTo(6.5, 5);

  const hit = global.LuminousTraitEngine.dispatchTrait(psychicBlade, "on_hit", { context: "combat", character: bard, self, target }, state);
  expect(hit.outcomes.some((outcome) => outcome.type === "psychic_blade_on_hit")).toBe(true);
  expect(target.sp).toBeCloseTo(16.3, 5);
  expect(self.statusEffects.psychic_blade.count).toBeCloseTo(5.5, 5);
});

test("Words of Terror uses Bard Spell DC and only applies Frightened on a failed WIS Save", () => {
  const bard = character(30);
  const target = { id: "victim", name: "Victim", statusEffects: {} };
  const words = catalog.getDefinition("words_of_terror");
  const state = global.LuminousTraitEngine.createState();

  const failed = global.LuminousTraitEngine.activateTrait(words, { context: "theatre", character: bard, self: bard, target, savePassed: false }, state);
  expect(failed.available).toBe(true);
  const outcome = failed.outcomes.find((entry) => entry.type === "spell_save_failed");
  expect(outcome?.abilityId).toBe("wis");
  expect(outcome?.dc).toBe(15);
  expect(target.statusEffects.frightened).toBeTruthy();

  const secondTarget = { id: "victim-2", statusEffects: {} };
  const passed = global.LuminousTraitEngine.activateTrait(words, { context: "theatre", character: bard, self: bard, target: secondTarget, savePassed: true }, state);
  expect(passed.available).toBe(true);
  expect(secondTarget.statusEffects.frightened).toBeFalsy();
  expect(passed.outcomes.some((entry) => entry.type === "spell_save_failed")).toBe(false);
});

test("Mantle of Whispers stores one named Shadow per Long Rest and consumes it into a 1 Hour identity", () => {
  const bard = character(30);
  const deadHumanoid = { id: "npc-gregor", name: "Gregor", tags: ["humanoid"], current_sprite: "gregor.png" };

  const captured = whispers.captureShadow(deadHumanoid, bard);
  expect(captured.captured).toBe(true);
  expect(captured.effectName).toBe("Shadow of Gregor");
  expect(bard.statusEffects.shadow_of_gregor.name).toBe("Shadow of Gregor");

  const blocked = whispers.captureShadow({ id: "npc-2", name: "Second", tags: ["humanoid"] }, bard);
  expect(blocked.captured).toBe(false);

  const assumed = whispers.useStoredShadow(bard);
  expect(assumed.used).toBe(true);
  expect(assumed.durationHours).toBe(1);
  expect(bard.assumedIdentity.name).toBe("Gregor");
  expect(bard.statusEffects.shadow_of_gregor).toBeFalsy();

  whispers.advanceWorldHours(1);
  expect(bard.assumedIdentity).toBeFalsy();
  whispers.resetMantleOnLongRest(bard);
  const afterRest = whispers.captureShadow({ id: "npc-3", name: "Third", tags: ["humanoid"] }, bard);
  expect(afterRest.captured).toBe(true);
});

test("Mantle disguise gives +5 Deception Power only against Insight identity checks", () => {
  const bard = character(30);
  whispers.resetMantleOnLongRest(bard);
  whispers.captureShadow({ id: "npc-mask", name: "Mask", tags: ["humanoid"] }, bard);
  whispers.useStoredShadow(bard);
  const check = { skillId: "deception", opposedSkillId: "insight", finalPower: 2 };
  const outcome = whispers.applyDisguiseDeceptionBonus(bard, check);
  expect(outcome?.bonus).toBe(5);
  expect(check.finalPower).toBe(7);
});

test("Shadow Lore is Once Per Long Rest and applies an 8 Hour Charmed effect on failed WIS Save", () => {
  const bard = character(70);
  const target = { id: "secret-holder", name: "Secret Holder", statusEffects: {} };
  const shadowLore = catalog.getDefinition("shadow_lore");
  const state = global.LuminousTraitEngine.createState();

  const first = global.LuminousTraitEngine.activateTrait(shadowLore, { context: "theatre", character: bard, self: bard, target, savePassed: false }, state);
  expect(first.available).toBe(true);
  expect(target.statusEffects.charmed).toBeTruthy();
  expect(target.statusEffects.charmed.data.durationHours).toBe(8);
  expect(target.statusEffects.charmed.data.casterLearnsSecret).toBe(false);

  const second = global.LuminousTraitEngine.activateTrait(shadowLore, { context: "theatre", character: bard, self: bard, target, savePassed: false }, state);
  expect(second.available).toBe(false);
  expect(second.reasons.some((reason) => reason.includes("No uses remaining"))).toBe(true);
});
