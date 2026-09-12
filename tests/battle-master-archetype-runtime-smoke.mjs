import assert from "node:assert/strict";

const g = globalThis;
const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
function fighterLevel(character = {}) {
  const classes = Array.isArray(character.classes) ? character.classes : character.characterBuild?.classes || [];
  const found = classes.find((entry) => normalizeId(entry.id || entry.classId || entry.name) === "fighter");
  return Number(found?.level ?? found?.levels ?? 0);
}
function isBattleMaster(character = {}) {
  const raw = character.characterBuild?.archetypes || character.archetypes || [];
  return raw.some((entry) => normalizeId(entry.classId) === "fighter" && normalizeId(entry.archetypeId || entry.id) === "battle_master");
}

g.LuminousArchetypeEngine = {
  getClassLevel(character, classId) { return normalizeId(classId) === "fighter" ? fighterLevel(character) : 0; },
  isSelected(character, archetypeId, classId) { return normalizeId(archetypeId) === "battle_master" && normalizeId(classId) === "fighter" && isBattleMaster(character); },
  resolveTraitGrants(character, grants = [], definitions = {}) {
    if (!isBattleMaster(character)) return [];
    const level = fighterLevel(character);
    return grants.filter((grant) => level >= Number(grant.atLevel || 0)).map((grant) => ({ ...clone(definitions[grant.traitId]), source: { ...(definitions[grant.traitId]?.source || {}), ...(grant.source || {}) } })).filter((trait) => trait.id);
  },
};
g.LuminousArchetypeTraitCatalog = { ARCHETYPES: {}, DEFINITIONS: {}, GRANTS: [], allArchetypes() { return {}; }, allDefinitions() { return {}; }, allGrants() { return []; }, getDefinition() { return null; }, resolveTraitGrants() { return []; } };
g.LuminousTraitCatalogCore = { allDefinitions() { return {}; }, allGrants() { return []; }, getDefinition() { return null; } };
g.LuminousTraitEngine = { resolveTraitGrants() { return []; }, normalizeTrait(trait) { return clone(trait); } };
g.LuminousArchetypeRuntime = { syncArchetypeTraitsForUnit() { return []; } };

await import("../js/fighter-maneuver-catalog.js");
await import("../js/battle-master-archetype-runtime.js");
const runtime = g.LuminousBattleMasterArchetypeRuntime;
assert.ok(runtime, "Battle Master archetype runtime should install");
assert.equal(runtime.ARCHETYPE_ID, "battle_master");
assert.equal(runtime.CLASS_ID, "fighter");
assert.equal(g.LuminousArchetypeTraitCatalog.allArchetypes().battle_master.name, "Battle Master");
assert.equal(g.LuminousFighterManeuverCatalog.list().length, 23, "Fighter Maneuver list contains all 23 Maneuvers");
assert.equal(g.LuminousFighterManeuverCatalog.get("Brace").mechanics.unopposed, false, "Brace is not Unopposed");
assert.equal(g.LuminousFighterManeuverCatalog.get("Quick Toss").mechanics.unopposed, true, "Quick Toss is Unopposed");

const makeCharacter = (level, extra = {}) => ({ id: `fighter_${level}`, hp: 100, maxHp: 100, classes: [{ id: "fighter", level }], characterBuild: { archetypes: [{ classId: "fighter", archetypeId: "battle_master" }] }, ...extra });
const traits15 = g.LuminousArchetypeTraitCatalog.resolveTraitGrants(makeCharacter(15));
assert.deepEqual(traits15.map((trait) => trait.id).sort(), ["combat_superiority", "student_of_war"].sort());
assert.ok(g.LuminousArchetypeTraitCatalog.resolveTraitGrants(makeCharacter(35)).some((trait) => trait.id === "know_your_enemy"));
const traits90 = g.LuminousArchetypeTraitCatalog.resolveTraitGrants(makeCharacter(90));
assert.deepEqual(traits90.map((trait) => trait.id).sort(), ["combat_superiority", "student_of_war", "know_your_enemy", "combat_superiority_plus", "relentless", "combat_superiority_plus_plus"].sort());

assert.deepEqual(runtime.combatSuperiorityProfile(makeCharacter(15)), { tier: 0, name: "Combat Superiority", clashWinGain: 3, onHitGain: 1, damageCap: 0.10, battleMasterManeuvers: 3 });
assert.deepEqual(runtime.combatSuperiorityProfile(makeCharacter(50)), { tier: 1, name: "Combat Superiority+", clashWinGain: 4, onHitGain: 2, damageCap: 0.15, battleMasterManeuvers: 4 });
assert.deepEqual(runtime.combatSuperiorityProfile(makeCharacter(90)), { tier: 2, name: "Combat Superiority++", clashWinGain: 5, onHitGain: 3, damageCap: 0.20, battleMasterManeuvers: 5 });
assert.equal(runtime.superiorityGain(makeCharacter(90), "clash_win"), 5);
assert.equal(runtime.superiorityGain(makeCharacter(90), "on_hit"), 3);
assert.equal(runtime.maneuverCapacity(makeCharacter(50)), 4);
assert.equal(runtime.maneuverCapacity(makeCharacter(50, { traits: [{ id: "superior_technique" }] })), 5, "Superior Technique remains an extra Maneuver");

const relentless = makeCharacter(90, { hp: 25, maxHp: 100 });
assert.equal(runtime.relentlessActive(relentless), true);
assert.equal(runtime.maneuverEffectMultiplier(relentless), 2);
assert.equal(runtime.maneuverDamageCap(relentless), 0.40, "Relentless doubles the 20% cap to 40%");
assert.equal(runtime.maneuverDamageCap(makeCharacter(90, { hp: 26, maxHp: 100 })), 0.20);

assert.equal(runtime.knowYourEnemyUnlockDue(makeCharacter(35), 9), false);
assert.equal(runtime.knowYourEnemyUnlockDue(makeCharacter(35), 10), true);
assert.deepEqual(runtime.knowYourEnemyRequest(makeCharacter(35), 10, "kobold"), { type: "analyse_feature_unlock", sourceTraitId: "know_your_enemy", enemyType: "kobold", unlockFeatures: 1, bypassAnalyseCheck: true, advanceObservationLevel: true, useExistingObservationTarget: true });
assert.match(g.LuminousArchetypeTraitCatalog.getDefinition("know_your_enemy").description, /Analyse Check/);

console.log("Battle Master archetype smoke passed.");
