import assert from "node:assert/strict";
import fs from "node:fs";

function load(path) { new Function(fs.readFileSync(path, "utf8"))(); }
load("js/trait-engine.js");
load("js/skill-trait-breakdown-patch.js");
load("js/archetype-engine.js");
load("js/archetype-trait-catalog.js");
load("js/derived-stats-engine.js");
load("js/check-trait-bonus-runtime.js");

const engine = globalThis.LuminousTraitEngine;
const bonuses = globalThis.LuminousCheckTraitBonusRuntime;
const bridge = globalThis.LuminousSkillTraitBreakdownPatch;
assert.ok(engine && bonuses && bridge);
const trait = (id) => ({ id, name: id, source: { type: "class", id: "test" }, contexts: ["any"],
  activation: { type: "passive", actionCost: "none" }, effects: [], rules: [] });
const actor = (extra = {}) => ({ level: 41, stats: { fuerza: 18, sabiduria: 16, carisma: 14 },
  skillProficiency: {}, abilityProficiency: {}, ...extra });
const skill = (abilityId, skillId) => ({ kind: "skill", abilityId, skillId });

const jackpot = globalThis.LuminousArchetypeTraitCatalog.getDefinition("devil_lineage_jackpot");
assert.ok(jackpot, "Jackpot must be part of the catalog.");
const perf = bonuses.previewCheck(engine, [jackpot], actor(), skill("cha", "performance"));
assert.equal(perf.check.checkPower, 4, "STR modifier must augment Performance.");
assert.equal(perf.check.finalPower, 0, "Jackpot must never be counted in both channels.");
assert.equal(bonuses.resolveCheck(engine, [jackpot], actor(), skill("cha", "performance")).check.checkPower, 4);
assert.equal(bonuses.previewCheck(engine, [jackpot], actor(), skill("str", "athletics")).check.checkPower, 0);

assert.equal(bonuses.previewCheck(engine, [trait("remarkable_athlete")], actor(), { kind: "ability", abilityId: "str" }).check.finalPower, 1);
assert.equal(bonuses.previewCheck(engine, [trait("remarkable_athlete")], actor(), { kind: "save", abilityId: "con" }).check.finalPower, 1);
assert.equal(bonuses.previewCheck(engine, [trait("remarkable_athlete")], actor(), skill("cha", "performance")).check.finalPower, 0);

assert.equal(bonuses.previewCheck(engine, [trait("royal_envoy")], actor(), skill("cha", "persuasion")).check.finalPower, 3);
assert.equal(bonuses.previewCheck(engine, [trait("royal_envoy")], actor({
  skillProficiency: { persuasion: "proficient" },
}), skill("cha", "persuasion")).check.finalPower, 3);
assert.equal(bonuses.previewCheck(engine, [trait("royal_envoy")], actor({
  skillProficiency: { persuasion: "expertise" },
}), skill("cha", "persuasion")).check.finalPower, 0);
assert.equal(bonuses.previewCheck(engine, [trait("royal_envoy")], actor(), skill("cha", "deception")).check.finalPower, 0);

assert.equal(bonuses.previewCheck(engine, [trait("elegant_courtier")], actor(), skill("cha", "persuasion")).check.finalPower, 3);
assert.equal(bonuses.previewCheck(engine, [trait("elegant_courtier")], actor(), { kind: "save", abilityId: "wis" }).check.finalPower, 3);
assert.equal(bonuses.previewCheck(engine, [trait("elegant_courtier")], actor({
  abilityProficiency: { wis: "proficient" }, traitChoices: { elegant_courtier_save: "cha" },
}), { kind: "save", abilityId: "cha" }).check.finalPower, 3);

globalThis.LuminousBladesingerArchetypeRuntime = {
  applyAcrobaticsBonus(check, character) {
    if (!character.bladesong || check.skillId !== "acrobatics") return check;
    return { ...check, finalPower: (check.finalPower || 0) + 4 };
  },
};
assert.equal(bonuses.previewCheck(engine, [trait("bladesong")], actor({ bladesong: true }), skill("dex", "acrobatics")).check.finalPower, 4);
assert.equal(bonuses.previewCheck(engine, [trait("bladesong")], actor(), skill("dex", "acrobatics")).check.finalPower, 0);

assert.equal(bonuses.previewCheck(engine, [trait("reliable_talent")], actor({
  skillProficiency: { athletics: "proficient" },
}), skill("str", "athletics")).check.finalPower, 3);
assert.equal(bonuses.previewCheck(engine, [trait("reliable_talent")], actor(), skill("str", "athletics")).check.finalPower, 0);
assert.equal(bonuses.previewCheck(engine, [trait("jack_of_all_trades")], actor(), { kind: "ability", abilityId: "int" }).check.finalPower, 1);
assert.equal(bonuses.previewCheck(engine, [trait("jack_of_all_trades")], actor({
  abilityProficiency: { int: "proficient" },
}), { kind: "ability", abilityId: "int" }).check.finalPower, 0);

assert.equal(bonuses.previewCheck(engine, [trait("training_in_war_and_song")], actor(), skill("cha", "performance")).check.checkPower, 3);
assert.equal(bonuses.previewCheck(engine, [trait("training_in_war_and_song")], actor({
  skillProficiency: { performance: "proficient" },
}), skill("cha", "performance")).check.checkPower, 0);

const once = bonuses.applyClassCheckBonuses(skill("cha", "persuasion"), actor(),
  [trait("royal_envoy")]);
const twice = bonuses.applyClassCheckBonuses(once.check, actor(), [trait("royal_envoy")]);
assert.equal(twice.check.finalPower, once.check.finalPower, "A resolved Check cannot gain the same trait twice.");

// A preview must never consume single-use traits via the real resolution method.
const consumingEngine = { ...engine, resolveTheatreCheck() { throw new Error("Preview consumed a one-use Trait."); } };
assert.equal(bonuses.previewCheck(consumingEngine,
  [trait("orosh_lineage_fragmented_blessing")], actor(),
  skill("wis", "insight")).check.finalPower, 0);

const playerHtml = fs.readFileSync("hoja_personaje.html", "utf8");
const dmHtml = fs.readFileSync("pantalla_dm.html", "utf8");
const runtime = fs.readFileSync("js/player-trait-runtime.js", "utf8");
const patch = fs.readFileSync("js/skill-trait-breakdown-patch.js", "utf8");
assert.ok(playerHtml.includes('src="js/check-trait-bonus-runtime.js"'));
assert.ok(dmHtml.includes('src="js/check-trait-bonus-runtime.js"'));
assert.match(runtime, /applyClassCheckBonuses/);
assert.match(patch, /previewCheck/);
assert.ok(patch.includes("resolveTheatreCheck?.(descriptor.check)"),
  "An actual player click must execute one-use Traits; the preview may not.");
console.log("All Trait Check Bonuses smoke: preview, actual check, classes, proficiency, one-use safety and idempotence OK.");
