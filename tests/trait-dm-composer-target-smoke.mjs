import assert from "node:assert/strict";
import fs from "node:fs";

const coordinator = fs.readFileSync("js/theatre-check-coordinator.js", "utf8");
const start = coordinator.indexOf("  function playerRollPreview(");
const end = coordinator.indexOf("\n  function playerLabel(", start);
assert.ok(start > 0 && end > start, "DM Check preview resolver must exist.");

let normalCheckCalled = 0;
const check = (kind, abilityId, skillId) => ({ kind, abilityId, ...(skillId ? { skillId } : {}) });
const selected = [{ id: "devil_lineage_jackpot" }, { id: "reliable_talent" }];
const patch = {
  resolvedDmTraits() { return selected; },
  checkPowerContributions(engine, traits, character, input) {
    assert.equal(engine.resolveTheatreCheck, undefined, "DM preview must not execute a live Check.");
    assert.equal(traits, selected);
    return input.skillId === "performance" ? [{ amount: 4 }] : [];
  },
  finalPowerContributions() { return [{ amount: 2 }]; },
  specialCheckContributions(traits, character, input) {
    assert.equal(input.proficiencyState, "proficient");
    return [{ amount: 3 }];
  },
};
const global = {
  LuminousTraitEngine: {},
  LuminousSkillTraitBreakdownPatch: patch,
  LuminousDerivedStats: { resolveAbility() { return { score: 18 }; } },
};
const numberOr = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const normalizeProfState = (v) => String(v || "none").toLowerCase();
const make = new Function("global", "abilityById", "skillById", "numberOr", "normalizeProfState",
  "playerProficiencyBonus", "PROFICIENCY_MULTIPLIER", "clamp",
  coordinator.slice(start, end) + "\nreturn playerRollPreview;");
const dmPreview = make(global, () => ({
  id: "cha", key: "carisma", skills: [{ id: "performance", name: "Performance" }],
}), (ability, id) => ability.skills.find((skill) => skill.id === id), numberOr, normalizeProfState, () => 3, { none: 0, proficient: 1, expertise: 2, half: 0.5 },
(value, low, high) => Math.max(low, Math.min(high, value)));

const player = { level: 41, stats: { carisma: 12 },
  skillProficiency: { performance: "proficient" }, combatStats: { sp_actual: 0 } };
assert.equal(dmPreview(player, check("skill", "cha", "performance")).base, 16,
  "DM preview must show derived CHA (+4), Proficiency (+3), Check Power (+4), Final Power (+2), special trait (+3).");
global.LuminousSkillTraitBreakdownPatch = { resolvedDmTraits() { return []; },
  checkPowerContributions() { return []; },
  finalPowerContributions() { return []; },
  specialCheckContributions() { return []; },
};
assert.equal(dmPreview(player, check("skill", "cha", "performance")).base, 7,
  "The bonus must disappear when no Trait is granted.");
assert.equal(normalCheckCalled, 0);

const playerRuntime = fs.readFileSync("js/player-trait-runtime.js", "utf8");
assert.match(playerRuntime, /const target = runtimeInput\.target \|\| preparedCheck\.target \|\| state\.theatreTarget/);
assert.match(playerRuntime, /check: preparedCheck,\s*target,\s*state:/,
  "The actual Trait Engine must receive the selected Theatre target.");
const patchSource = fs.readFileSync("js/skill-trait-breakdown-patch.js", "utf8");
assert.match(patchSource, /\bresolvedDmTraits,\s*installResolvedCheckBridge,/);
assert.ok(fs.readFileSync("pantalla_dm.html", "utf8").includes('src="js/skill-trait-breakdown-patch.js"'),
  "DM must load the shared Trait preview module.");

console.log("DM Check composer/selected target regression passed.");
