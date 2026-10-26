import assert from "node:assert/strict";
import fs from "node:fs";

function load(path) { new Function(fs.readFileSync(path, "utf8"))(); }
load("js/trait-engine.js");
load("js/skill-trait-breakdown-patch.js");
load("js/rogue-class-runtime.js");
load("js/archetype-engine.js");
load("js/archetype-trait-catalog.js");
load("js/champion-archetype-runtime.js");
load("js/banneret-archetype-runtime.js");
load("js/samurai-archetype-runtime.js");
load("js/bladesinger-archetype-runtime.js");

const patch = globalThis.LuminousSkillTraitBreakdownPatch;
const engine = globalThis.LuminousTraitEngine;
const rogue = globalThis.LuminousRogueClassRuntime;
const trait = (id, mechanics = {}) => ({ id, name: id, mechanics });
const ch = {
  characterBuild: { calculatedAtLevel: 65, classes: [{ classId: "rogue", levels: 55 }] },
  classLevels: { rogue: 55 },
  level: 65,
  stats: { fuerza: 18, sabiduria: 18, carisma: 16 },
  skillProficiency: { performance: "proficient", persuasion: "none", athletics: "none" },
  abilityProficiency: {},
  saveProficiency: {},
};
const skill = (id, abilityId, proficiencyState) =>
  ({ kind: "skill", skillId: id, abilityId, ...(proficiencyState ? { proficiencyState } : {}) });
const amount = (traits, character, check) =>
  patch.specialCheckContributions(traits, character, check).reduce((sum, entry) => sum + entry.amount, 0);

// Validated real Rogue Trait: final power is applied to the actual result, not
// an unused finalPowerBonus metadata field. Only granted/proficient skill checks qualify.
const reliable = rogue.ROGUE_DEFINITIONS.reliable_talent;
assert.equal(amount([reliable], ch, skill("performance", "cha")), 3);
assert.equal(amount([reliable], ch, skill("athletics", "str")), 0);
let rolled = engine.resolveTheatreCheck({ character: ch, traits: [reliable],
  check: skill("performance", "cha") }).check;
assert.equal(rolled.finalPower, 3);
assert.equal(rolled.__rogueReliableTalentApplied, true);
assert.deepEqual(patch.applySpecialCheckBonuses([reliable], ch, rolled), []);
assert.equal(rolled.finalPower, 3, "Rogue bonus must not stack after its own engine hook");
rolled = engine.resolveTheatreCheck({ character: ch, traits: [], check: skill("performance", "cha") }).check;
assert.equal(rolled.finalPower, 0, "No grant must mean no bonus");

// Champion STR/DEX/CON +1, but no permanent ability increase.
const athlete = trait("remarkable_athlete", { physicalCheckFinalPower: 1 });
assert.equal(amount([athlete], ch, skill("athletics", "str")), 1);
assert.equal(amount([athlete], ch, skill("performance", "cha")), 0);
assert.equal(amount([athlete], ch, {kind: "save", abilityId: "dex"}), 1);

// Royal Envoy upgrades Persuasion proficiency rather than replacing CHA.
const envoy = trait("royal_envoy");
assert.equal(amount([envoy], ch, skill("persuasion", "cha", "none")), 5);
assert.equal(amount([envoy], ch, skill("persuasion", "cha", "half")), 3);
assert.equal(amount([envoy], ch, skill("persuasion", "cha", "proficient")), 5);
assert.equal(amount([envoy], ch, skill("persuasion", "cha", "expertise")), 0);

// Samurai WIS mod on Persuasion; save proficiency granted once.
const courtier = trait("elegant_courtier");
assert.equal(amount([courtier], ch, skill("persuasion", "cha")), 4);
assert.equal(amount([courtier], ch, { kind: "save", abilityId: "wis" }), 5);
const gifted = { ...ch, saveProficiency: { wis: "proficient" },
  traitChoices: { elegant_courtier_save: "cha" } };
assert.equal(amount([courtier], gifted, { kind: "save", abilityId: "wis" }), 0);
assert.equal(amount([courtier], gifted, { kind: "save", abilityId: "cha" }), 5);
assert.equal(amount([courtier], { ...ch, abilityProficiency: { wis: "half" } },
  { kind: "save", abilityId: "wis" }), 3);

// Bladesinger conditional Acrobatics: status on -> +4, off -> 0.
const bladesong = trait("bladesong", { acrobaticsBonus: 4 });
assert.equal(amount([bladesong], ch, skill("acrobatics", "dex")), 0);
assert.equal(amount([bladesong], { ...ch, statusEffects: { bladesong: { count: 1 } } },
  skill("acrobatics", "dex")), 4);

// Bard half-proficiency when not proficient, and no bonus if proficient.
const jack = trait("jack_of_all_trades");
assert.equal(amount([jack], ch, skill("athletics", "str")), 2);
assert.equal(amount([jack], ch, skill("performance", "cha")), 0);
assert.equal(amount([jack], ch, { kind: "ability", abilityId: "wis" }), 2);
assert.equal(amount([jack], { ...ch, abilityProficiency: { wis: "proficient" } },
  { kind: "ability", abilityId: "wis" }), 0, "Jack excludes proficient Ability checks.");

// Mixed Traits are additive exactly once, including negative conditional mods.
const check = skill("persuasion", "cha");
assert.equal(amount([envoy, courtier], ch, check), 9);
assert.equal(patch.applySpecialCheckBonuses([envoy, courtier], ch, check).length, 2);
assert.equal(check.finalPower, 9);
assert.deepEqual(patch.applySpecialCheckBonuses([envoy, courtier], ch, check), []);
assert.equal(check.finalPower, 9);
const alreadyApplied = skill("persuasion", "cha");
alreadyApplied.finalPower = 4;
alreadyApplied.__banneretRoyalEnvoyAdjusted = true;
patch.applySpecialCheckBonuses([envoy, courtier], ch, alreadyApplied);
assert.equal(alreadyApplied.finalPower, 8, "Legacy armCheck pre-bonus must not be counted twice");


const fighter = (archetypeId, proficiency = "half") => ({
  characterBuild: {
    classes: [{ classId: "fighter", levels: 35 }],
    archetypes: [{ classId: "fighter", archetypeId }],
  },
  classes: [{ classId: "fighter", levels: 35 }],
  level: 41,
  stats: { fuerza: 18, sabiduria: 16, carisma: 14 },
  skillProficiency: { persuasion: proficiency },
  abilityProficiency: { wis: "half" },
});
const realEnvoy = fighter("banneret");
const envoyCheck = globalThis.LuminousBanneretArchetypeRuntime.applyRoyalEnvoyCheck(
  skill("persuasion", "cha"), realEnvoy);
assert.equal(envoyCheck.finalPower, 2, "Banneret rounds half proficiency before upgrading it.");
assert.equal(amount([envoy], realEnvoy, skill("persuasion", "cha")), 2);
assert.equal(patch.applySpecialCheckBonuses([envoy], realEnvoy, envoyCheck).length, 0);
assert.equal(envoyCheck.finalPower, 2);

const realChampion = fighter("champion");
const athleteCheck = globalThis.LuminousChampionArchetypeRuntime.applyRemarkableAthleteCheck(
  skill("athletics", "str"), realChampion);
assert.equal(athleteCheck.finalPower, 1);
assert.equal(patch.applySpecialCheckBonuses([athlete], realChampion, athleteCheck).length, 0);
assert.equal(athleteCheck.finalPower, 1);

const realSamurai = fighter("samurai");
const courtierCheck = globalThis.LuminousSamuraiArchetypeRuntime.applyElegantCourtierCheck(
  { kind: "save", abilityId: "wis" }, realSamurai);
assert.equal(courtierCheck.finalPower, 2, "Samurai grants missing proficiency, not half plus full.");
assert.equal(amount([courtier], realSamurai, { kind: "save", abilityId: "wis" }), 2);
assert.equal(patch.applySpecialCheckBonuses([courtier], realSamurai, courtierCheck).length, 0);

const realBladesinger = {
  characterBuild: { classes: [{ classId: "wizard", levels: 10 }],
    archetypes: [{ classId: "wizard", archetypeId: "bladesinger" }] },
  classes: [{ classId: "wizard", levels: 10 }],
  level: 10, stats: { destreza: 16 }, statusEffects: { bladesong: { count: 1 } },
};
const bladeCheck = globalThis.LuminousBladesingerArchetypeRuntime.applyAcrobaticsBonus(
  skill("acrobatics", "dex"), realBladesinger);
assert.equal(bladeCheck.finalPower, 4);
assert.equal(patch.applySpecialCheckBonuses([bladesong], realBladesinger, bladeCheck).length, 0);
assert.equal(bladeCheck.finalPower, 4, "Bladesong is idempotent after the specialised runtime.");

// Jackpot is declarative check.checkPower and must remain distinct from finalPower.
const jackpot = globalThis.LuminousArchetypeTraitCatalog.getDefinition("devil_lineage_jackpot");
const jCheck = skill("performance", "cha");
const j = globalThis.LuminousTraitEngine.resolveTheatreCheck({
  character: ch, traits: [jackpot], check: jCheck,
}).check;
assert.equal(j.checkPower, 4);
assert.equal(j.finalPower || 0, 0);

const playerRuntimeSource = fs.readFileSync("js/player-trait-runtime.js", "utf8");
assert.match(playerRuntimeSource, /applySpecialCheckBonuses\?\.\(/);
const previews = fs.readFileSync("js/skill-trait-breakdown-patch.js", "utf8");
assert.match(previews, /\.\.\.specialCheckContributions\(runtime\.getTraits\(\)/);
assert.match(previews, /\.\.\.specialCheckContributions\(traits, character/);
assert.match(previews, /function syncPlayerAbilityPreviews\(/);
assert.match(previews, /applySpecialCheckBonuses\(/);

console.log("trait-special-check-regression: OK (Rogue, Champion, Banneret, Samurai, Bladesinger, Bard, Jackpot, no double counting)");
