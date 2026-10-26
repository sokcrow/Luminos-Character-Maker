import assert from "node:assert/strict";
import fs from "node:fs";

const load = (path) => new Function(fs.readFileSync(path, "utf8"))();
load("js/trait-engine.js");
load("js/archetype-engine.js");
load("js/archetype-trait-catalog.js");
const engine = globalThis.LuminousTraitEngine;
const catalog = globalThis.LuminousArchetypeTraitCatalog;
const character = {
  level: 15, stats: { fuerza: 18, carisma: 16 },
  characterBuild: {
    calculatedAtLevel: 15,
    classes: [{ classId: "barbarian", levels: 15 }],
    archetypes: [{ classId: "barbarian", archetypeId: "path_of_the_devil_lineage" }],
  },
  skillProficiency: { performance: "proficient" },
};
const grants = catalog.resolveTraitGrants(character);
const jackpot = grants.find((trait) => trait.id === "devil_lineage_jackpot");
assert.ok(jackpot, "The actual selected Devil Lineage archetype must grant Jackpot at level 15.");
assert.equal(catalog.resolveTraitGrants({
  ...character, characterBuild: { ...character.characterBuild, archetypes: [] },
}).some((trait) => trait.id === "devil_lineage_jackpot"), false, "Unselected archetypes must never grant bonuses.");
assert.equal(catalog.resolveTraitGrants({
  ...character, characterBuild: { ...character.characterBuild, classes: [{ classId: "barbarian", levels: 14 }] },
}).some((trait) => trait.id === "devil_lineage_jackpot"), false, "Locked Traits must never grant bonuses.");

const ability = { id: "cha", code: "CHA", key: "carisma", skills: [{ id: "performance", name: "Performance" }] };
const value = { textContent: "+5" };
const row = {
  dataset: { skillId: "performance" },
  title: "",
  querySelector(selector) { return selector === ".dnd-skill-value" ? value : null; },
};
const panel = { querySelectorAll(selector) { return selector.startsWith(".dnd-skill") ? [row] : []; } };
globalThis.document = {
  readyState: "loading",
  addEventListener() {},
  querySelector(selector) { return selector === "#stats-modal .player-ability-console" ? panel : null; },
};
globalThis.datosJugador = character;
globalThis.LuminousPlayerStats = {
  ABILITIES: [ability],
  abilityScore() { return 16; },
  abilityModifier(score) { return Math.floor((score - 10) / 2); },
  proficiencyContribution() { return 2; },
  skillProficiencyState() { return "proficient"; },
  skillValue() { return 5; },
};
globalThis.LuminousPlayerTraitRuntime = {
  getCharacter() { return character; },
  getTraits() { return grants; },
};
load("js/skill-trait-breakdown-patch.js");
const patch = globalThis.LuminousSkillTraitBreakdownPatch;
const performance = patch.playerSkillBreakdown(ability.skills[0], ability, character);
assert.equal(performance.base, 5);
assert.equal(performance.traitBonus, 4);
assert.equal(performance.total, 9, "Jackpot STR +4 must be part of Performance's effective Skill Score.");
assert.equal(patch.syncPlayerSkillPreviews(), true);
assert.equal(value.textContent, "+9", "The player's actual visible Performance value must be +9.");
assert.match(row.title, /JACKPOT/i, "The visible Skill must explain the Jackpot contribution.");
assert.equal(patch.syncPlayerSkillPreviews(), false, "Refreshing Stats must not stack the Skill modifier.");

const checked = engine.resolveTheatreCheck({ character, traits: grants,
  check: { kind: "skill", abilityId: "cha", skillId: "performance" } }).check;
patch.foldCheckFinalPowerIntoScore(checked);
assert.equal(checked.checkPower, 4, "Jackpot must be applied to the roll modifier.");
assert.equal(checked.finalPower, 0, "No Check Final Power is applied after the roll.");

const rogueLegacy = { kind: "skill", abilityId: "cha", skillId: "performance", checkPower: 4, finalPower: 3 };
patch.foldCheckFinalPowerIntoScore(rogueLegacy);
assert.equal(rogueLegacy.checkPower, 7);
assert.equal(rogueLegacy.finalPower, 0);
patch.foldCheckFinalPowerIntoScore(rogueLegacy);
assert.equal(rogueLegacy.checkPower, 7, "Folding an already converted Check must not double count.");
const penalty = { checkPower: 2, finalPower: -3 };
patch.foldCheckFinalPowerIntoScore(penalty);
assert.equal(penalty.checkPower, -1, "Negative Check Final Power must also affect the Skill modifier.");

const playerRuntime = fs.readFileSync("js/player-trait-runtime.js", "utf8");
assert.match(playerRuntime, /archetypeGranted = global\.LuminousArchetypeTraitCatalog\?\.resolveTraitGrants/);
assert.match(playerRuntime, /foldCheckFinalPowerIntoScore\?\.\(result\.check\)/);
console.log("Visible Skill Score smoke: selected Jackpot +4 -> Performance +9, post-coin bonuses folded, no duplicates.");
