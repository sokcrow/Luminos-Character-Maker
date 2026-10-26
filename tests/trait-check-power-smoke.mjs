import assert from "node:assert/strict";
import fs from "node:fs";

function load(path) {
  new Function(fs.readFileSync(path, "utf8"))();
}

load("js/trait-engine.js");
load("js/archetype-engine.js");
load("js/archetype-trait-catalog.js");
load("js/derived-stats-engine.js");
load("js/skill-trait-breakdown-patch.js");

const engine = globalThis.LuminousTraitEngine;
const catalog = globalThis.LuminousArchetypeTraitCatalog;
const bridge = globalThis.LuminousSkillTraitBreakdownPatch;
const derived = globalThis.LuminousDerivedStats;
assert.ok(engine && catalog && bridge && derived, "The check/trait/stat modules must load.");

const statCharacter = {
  baseStats: { fuerza: 12, carisma: 14 },
  stats: { fuerza: 15, carisma: 14 },
  traitStatBonuses: { str: 2 },
  backgroundStatBonuses: { str: 1 },
};
const score = derived.resolveAbility(statCharacter, "str");
assert.equal(score.score, 15, "Stored Trait and background score bonuses must affect actual STR.");
assert.equal(score.modifier, 2, "The effective STR score must drive the roll modifier.");
assert.equal(derived.resolveAbility(statCharacter, "cha").score, 14, "Other Ability Scores stay untouched.");
assert.equal(statCharacter.baseStats.fuerza, 12, "Reading derived stats never mutates the base.");

const jackpot = catalog.getDefinition("devil_lineage_jackpot");
assert.ok(jackpot, "Jackpot must remain in the real archetype catalog.");
assert.equal(engine.validateTrait(jackpot).valid, true, "Jackpot is a valid Trait.");

const character = {
  level: 15,
  stats: { fuerza: 18, carisma: 16 },
  classLevels: { barbarian: 15 },
};
const performance = { kind: "skill", abilityId: "cha", skillId: "performance" };
const athletics = { kind: "skill", abilityId: "str", skillId: "athletics" };
const ability = { kind: "ability", abilityId: "str" };

const contribution = (check, actor = character) =>
  bridge.checkPowerContributions(engine, [jackpot], actor, check)
    .reduce((total, item) => total + item.amount, 0);

assert.equal(contribution(performance), 4, "STR Mod +4 must appear in Performance preview.");
assert.equal(contribution(athletics), 0, "Jackpot must not change Athletics.");
assert.equal(contribution(ability), 0, "Jackpot must not alter raw Ability checks.");
assert.equal(contribution(performance, { ...character, stats: { fuerza: 10, carisma: 16 } }), 0);
assert.equal(contribution(performance, { ...character, stats: { fuerza: 6, carisma: 16 } }), -2);

const evaluated = engine.resolveTheatreCheck({
  character,
  traits: [jackpot],
  check: { ...performance, checkPower: 0, finalPower: 0 },
});
assert.equal(evaluated.check.checkPower, 4, "Theatre resolution must use the same bonus.");
assert.equal(evaluated.check.finalPower, 0, "Jackpot must not also add Final Power.");
assert.equal(contribution(performance), 4, "Repeated preview must not stack the bonus.");

const playerHtml = fs.readFileSync("hoja_personaje.html", "utf8");
const playerStats = fs.readFileSync("js/player-stats-ability-bar.js", "utf8");
const archetypeRuntime = fs.readFileSync("js/player-archetype-runtime-core.js", "utf8");
assert.match(playerHtml, /src="js\/derived-stats-engine\.js"/);
assert.match(playerHtml, /src="js\/skill-trait-breakdown-patch\.js"/);
assert.match(playerStats, /LuminousDerivedStats\?\.resolveAbility/);
assert.match(playerStats, /syncPlayerSkillPreviews\?\.\(\)/);
assert.doesNotMatch(archetypeRuntime, /check\.finalPower\s*=\s*numberOr\(check\.finalPower\)\s*\+\s*statMod\(character, "strength"\)/);

console.log("Trait Check Power smoke: Jackpot preview, dice contract, conditions and no double-count OK.");
