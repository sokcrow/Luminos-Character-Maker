import assert from "node:assert/strict";
import fs from "node:fs";

function load(path) { new Function(fs.readFileSync(path, "utf8"))(); }
const source = (path) => fs.readFileSync(path, "utf8");

load("js/trait-engine.js");
load("js/trait-catalog-core.js");
load("js/archetype-engine.js");
load("js/archetype-trait-catalog.js");
load("js/status-engine.js");
load("js/status-library.js");
globalThis.LuminousArchetypeRuntime = { syncArchetypeTraitsForUnit() { return []; } };
load("js/bard-class-runtime.js");
load("js/rogue-class-runtime.js");
load("js/champion-archetype-runtime.js");
load("js/banneret-archetype-runtime.js");
load("js/samurai-archetype-runtime.js");
load("js/bladesinger-archetype-runtime.js");
load("js/skill-trait-breakdown-patch.js");

const engine = globalThis.LuminousTraitEngine;
const preview = globalThis.LuminousSkillTraitBreakdownPatch;
const core = globalThis.LuminousTraitCatalogCore;
const sum = (values) => values.reduce((n, entry) => n + entry.amount, 0);
assert.ok(engine && preview && core);

const basic = { level: 45, stats: { destreza: 18, sabiduria: 16 } };
const insight = { kind: "skill", abilityId: "wis", skillId: "insight" };
const green = core.getDefinition("green_eyed_heir");
const inherent = preview.evaluatedCheckBonuses(engine, [green], basic, insight);
assert.equal(inherent.finalPowerTotal, 2, "Declarative +2 Insight final power is part of preview.");
assert.equal(inherent.checkPowerTotal, 0);
assert.equal(preview.evaluatedCheckBonuses(engine, [green], basic, { ...insight, skillId: "history" }).finalPowerTotal, 0);
const save = preview.evaluatedCheckBonuses(engine, [core.getDefinition("danger_senses")], basic, { kind: "save", abilityId: "dex" });
assert.equal(save.finalPowerTotal, 4, "DEX save shows Danger Sense +4.");
assert.equal(preview.evaluatedCheckBonuses(engine, [core.getDefinition("danger_senses")], basic, { kind: "ability", abilityId: "dex" }).finalPowerTotal, 0);

const rogueRuntime = globalThis.LuminousRogueClassRuntime;
assert.ok(rogueRuntime, "Rogue runtime must be loaded.");
const rogue = { level: 55, classes: [{ id: "rogue", levels: 55 }], skillProficiency: { perception: "proficient" } };
const talent = rogueRuntime.ROGUE_DEFINITIONS.reliable_talent;
const perception = { kind: "skill", abilityId: "wis", skillId: "perception" };
const rogueResult = engine.resolveTheatreCheck({ character: rogue, traits: [talent], check: perception });
assert.equal(rogueResult.check.finalPower, 3, "Reliable Talent must change the actual post-coin Final Power, not metadata alone.");
assert.equal(engine.resolveTheatreCheck({ character: rogue, traits: [talent], check: rogueResult.check }).check.finalPower, 3, "Reliable Talent is idempotent after Check cloning.");
assert.equal(preview.evaluatedCheckBonuses(engine, [talent], rogue, perception).finalPowerTotal, 3);
assert.equal(preview.evaluatedCheckBonuses(engine, [talent], rogue, { ...perception, skillId: "insight" }).finalPowerTotal, 0, "No proficiency means no Talent bonus.");

const bardRuntime = globalThis.LuminousBardClassRuntime;
assert.ok(bardRuntime);
const jack = bardRuntime.BARD_DEFINITIONS.jack_of_all_trades;
const bard = { level: 60, classes: [{ id: "bard", levels: 60 }], skillProficiency: {} };
const untrained = preview.evaluatedCheckBonuses(engine, [jack], bard, { kind: "skill", abilityId: "cha", skillId: "performance" });
assert.equal(untrained.finalPowerTotal, 1, "Jack of All Trades gives half of proficiency for an untrained check.");
assert.equal(preview.evaluatedCheckBonuses(engine, [jack], { ...bard, skillProficiency: { performance: "proficient" } }, { kind: "skill", abilityId: "cha", skillId: "performance" }).finalPowerTotal, 0);

const championRuntime = globalThis.LuminousChampionArchetypeRuntime;
const champTrait = championRuntime.DEFINITIONS.remarkable_athlete;
const champion = {
  level: 35, classes: [{ id: "fighter", levels: 35 }],
  characterBuild: { archetypes: [{ classId: "fighter", archetypeId: "champion" }] },
};
assert.equal(sum(preview.specialFinalPowerContributions([champTrait], champion, { kind: "ability", abilityId: "str" })), 1);
assert.equal(sum(preview.specialFinalPowerContributions([champTrait], champion, { kind: "ability", abilityId: "cha" })), 0);
const champArmed = preview.applySpecialArmedCheck({ kind: "ability", abilityId: "str", finalPower: 2 }, [champTrait], champion);
assert.equal(champArmed.finalPower, 3);
assert.equal(preview.applySpecialArmedCheck(champArmed, [champTrait], champion).finalPower, 3, "Champion power cannot stack on an already modified Check.");

const banneretRuntime = globalThis.LuminousBanneretArchetypeRuntime;
const envoyTrait = banneretRuntime.DEFINITIONS.royal_envoy;
const banneret = {
  level: 35, classes: [{ id: "fighter", levels: 35 }],
  characterBuild: { archetypes: [{ classId: "fighter", archetypeId: "banneret" }] },
  skillProficiency: { persuasion: "none" },
};
const persuasion = { kind: "skill", abilityId: "cha", skillId: "persuasion" };
assert.equal(sum(preview.specialFinalPowerContributions([envoyTrait], banneret, persuasion)), 2);
const envoyArmed = preview.applySpecialArmedCheck({ ...persuasion, finalPower: 0 }, [envoyTrait], banneret);
assert.equal(envoyArmed.finalPower, 2);
assert.equal(preview.applySpecialArmedCheck(envoyArmed, [envoyTrait], banneret).finalPower, 2, "Royal Envoy cannot be applied twice.");
assert.equal(sum(preview.specialFinalPowerContributions([envoyTrait], banneret, { ...persuasion, skillId: "intimidation" })), 0);

const samuraiRuntime = globalThis.LuminousSamuraiArchetypeRuntime;
const courtier = samuraiRuntime.DEFINITIONS.elegant_courtier;
const samurai = {
  level: 35, classes: [{ id: "fighter", levels: 35 }],
  characterBuild: { archetypes: [{ classId: "fighter", archetypeId: "samurai" }] },
  stats: { sabiduria: 14 }, abilityProficiency: {},
};
assert.equal(sum(preview.specialFinalPowerContributions([courtier], samurai, persuasion)), 2, "Elegant Courtier's WIS modifier increases Persuasion.");
assert.equal(sum(preview.specialFinalPowerContributions([courtier], samurai, { kind: "save", abilityId: "wis" })), 2, "Elegant Courtier grants WIS save proficiency.");
assert.equal(sum(preview.specialFinalPowerContributions([courtier], samurai, { kind: "skill", abilityId: "cha", skillId: "deception" })), 0);
const courtierArmed = preview.applySpecialArmedCheck({ ...persuasion, finalPower: 0 }, [courtier], samurai);
assert.equal(preview.applySpecialArmedCheck(courtierArmed, [courtier], samurai).finalPower, courtierArmed.finalPower);

const bladeRuntime = globalThis.LuminousBladesingerArchetypeRuntime;
const bladesong = bladeRuntime.DEFINITIONS.bladesong;
const bladesinger = {
  level: 35, classes: [{ id: "wizard", levels: 35 }],
  characterBuild: { archetypes: [{ classId: "wizard", archetypeId: "bladesinger" }] },
  statusEffects: { bladesong: { id: "bladesong", count: 1 } },
};
const acrobatics = { kind: "skill", abilityId: "dex", skillId: "acrobatics" };
assert.equal(sum(preview.specialFinalPowerContributions([bladesong], bladesinger, acrobatics)), 4);
const bladesongArmed = preview.applySpecialArmedCheck({ ...acrobatics, finalPower: 2 }, [bladesong], bladesinger);
assert.equal(bladesongArmed.finalPower, 6);
assert.equal(preview.applySpecialArmedCheck(bladesongArmed, [bladesong], bladesinger).finalPower, 6, "Bladesong Acrobatics cannot stack.");
assert.equal(sum(preview.specialFinalPowerContributions([bladesong], { ...bladesinger, statusEffects: {} }, acrobatics)), 0);

assert.match(source("js/trait-standardization-runtime.js"), /armPlayerCheck/);
assert.match(source("js/skill-trait-breakdown-patch.js"), /armPlayerCheck\?\.\(resolvedCheck\)/);
assert.match(source("pantalla_dm.html"), /src="js\/skill-trait-breakdown-patch\.js"/);
console.log("Trait Check/Final Power unified: declared effects, Champion, Banneret, Bladesinger, Rogue, Bard, DM UI and manual roll bridge OK.");
