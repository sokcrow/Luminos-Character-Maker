import assert from "node:assert/strict";

const g = globalThis;
const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function fighterLevel(character = {}) {
  const classes = Array.isArray(character.classes) ? character.classes : character.characterBuild?.classes || [];
  const found = classes.find((entry) => normalizeId(entry.id || entry.classId || entry.name) === "fighter");
  return Number(found?.level ?? found?.levels ?? 0);
}

function isSamurai(character = {}) {
  const raw = character.characterBuild?.archetypes || character.archetypes || [];
  return raw.some((entry) => normalizeId(entry.classId) === "fighter" && normalizeId(entry.archetypeId || entry.id) === "samurai");
}

g.LuminousArchetypeEngine = {
  getClassLevel(character, classId) { return normalizeId(classId) === "fighter" ? fighterLevel(character) : 0; },
  isSelected(character, archetypeId, classId) { return normalizeId(archetypeId) === "samurai" && normalizeId(classId) === "fighter" && isSamurai(character); },
  resolveTraitGrants(character, grants = [], definitions = {}) {
    if (!isSamurai(character)) return [];
    const level = fighterLevel(character);
    return grants
      .filter((grant) => level >= Number(grant.atLevel || 0))
      .map((grant) => ({ ...clone(definitions[grant.traitId]), source: { ...(definitions[grant.traitId]?.source || {}), ...(grant.source || {}) } }))
      .filter((trait) => trait.id);
  },
};

g.LuminousArchetypeTraitCatalog = {
  ARCHETYPES: {}, DEFINITIONS: {}, GRANTS: [],
  allArchetypes() { return {}; }, allDefinitions() { return {}; }, allGrants() { return []; },
  getDefinition() { return null; }, resolveTraitGrants() { return []; },
};
g.LuminousTraitCatalogCore = { allDefinitions() { return {}; }, allGrants() { return []; }, getDefinition() { return null; } };
g.LuminousTraitEngine = { resolveTraitGrants() { return []; } };
g.LuminousArchetypeRuntime = { syncArchetypeTraitsForUnit() { return []; } };

const combatants = [];
const combatCalls = [];
g.CombatEngine = {
  applyPassiveModifiers() {
    return { clash_power: 0, final_power: 0, damage_dealt_multiplier: 0 };
  },
  triggerEvent() { return null; },
  triggerEncounterStart() { return true; },
  triggerPhase() { return true; },
  resolveUnilateralWithCounter(attacker, skill, defender, counterSkill, options = {}) {
    combatCalls.push({ attacker, skill, defender, counterSkill, options });
    return { attacker, skill, defender };
  },
  applyDamage(unit, damage) {
    let remaining = Math.max(0, Number(damage) || 0);
    if (unit.shield > 0) {
      const absorbed = Math.min(unit.shield, remaining);
      unit.shield -= absorbed;
      remaining -= absorbed;
    }
    unit.hp = Math.max(0, unit.hp - remaining);
    return { hp: unit.hp, shield: unit.shield || 0 };
  },
  getAllAliveUnits() { return combatants.filter((unit) => unit.hp > 0); },
};

await import("../js/samurai-archetype-runtime.js");

const runtime = g.LuminousSamuraiArchetypeRuntime;
assert.ok(runtime, "Samurai archetype runtime should install");
assert.equal(runtime.ARCHETYPE_ID, "samurai");
assert.equal(runtime.CLASS_ID, "fighter");
assert.equal(g.LuminousArchetypeTraitCatalog.allArchetypes().samurai.name, "Samurai");

const makeCharacter = (level, extra = {}) => ({
  id: "samurai_" + level,
  hp: 100,
  maxHp: 100,
  shield: 0,
  level,
  stats: { sabiduria: 14, inteligencia: 12, carisma: 10 },
  classes: [{ id: "fighter", level }],
  characterBuild: { archetypes: [{ classId: "fighter", archetypeId: "samurai" }] },
  ...extra,
});

assert.deepEqual(
  g.LuminousArchetypeTraitCatalog.resolveTraitGrants(makeCharacter(15)).map((trait) => trait.id),
  ["fighting_spirit"],
  "Level 15 grants Fighting Spirit",
);

assert.deepEqual(
  g.LuminousArchetypeTraitCatalog.resolveTraitGrants(makeCharacter(50)).map((trait) => trait.id).sort(),
  ["elegant_courtier", "fighting_spirit_plus", "tireless_spirit"].sort(),
  "Level 50 replaces Fighting Spirit with Fighting Spirit+ and grants Tireless Spirit",
);

assert.deepEqual(
  g.LuminousArchetypeTraitCatalog.resolveTraitGrants(makeCharacter(90)).map((trait) => trait.id).sort(),
  ["elegant_courtier", "fighting_spirit_plus_plus", "rapid_strike", "strength_before_death", "tireless_spirit"].sort(),
  "Level 90 replaces Fighting Spirit+ with Fighting Spirit++ and grants Strength Before Death",
);

const samurai90 = makeCharacter(90);
g.LuminousArchetypeRuntime.syncArchetypeTraitsForUnit(samurai90);

g.CombatEngine.triggerEvent("[On Hit]", { attacker: samurai90, skill: { skillFamily: "attack", attackMode: "melee" } }, []);
assert.equal(runtime.fightingSpiritCount(samurai90), 3, "Fighting Spirit++ gains 3 Count On Hit");
assert.equal(samurai90.shield, 9, "Fighting Spirit++ gains 3 Shield per Count gained");

g.CombatEngine.triggerEvent("[On Kill]", { attacker: samurai90, skill: { skillFamily: "attack", attackMode: "melee" } }, []);
assert.equal(runtime.fightingSpiritCount(samurai90), 10, "Fighting Spirit++ gains 7 additional Count On Kill");
assert.equal(samurai90.shield, 30, "On Hit + On Kill Count gains generate proportional Shield");

let modifiers = g.CombatEngine.applyPassiveModifiers(samurai90, { skill: { skillFamily: "attack", attackMode: "melee" } });
assert.equal(modifiers.clash_power, 2, "10 Fighting Spirit grants +2 Clash Power");
assert.equal(modifiers.final_power, 0, "10 Fighting Spirit does not yet grant Final Power");
assert.equal(modifiers.damage_dealt_multiplier, 1, "10 Fighting Spirit on Fighting Spirit++ grants +10% Damage");

runtime.setFightingSpiritCount(samurai90, 30);
modifiers = g.CombatEngine.applyPassiveModifiers(samurai90, { skill: { skillFamily: "attack", attackMode: "melee" } });
assert.equal(modifiers.clash_power, 2, "Clash Power caps at +2");
assert.equal(modifiers.final_power, 2, "30 Fighting Spirit grants +2 Final Power");
assert.equal(modifiers.damage_dealt_multiplier, 3, "30 Fighting Spirit grants +30% Damage");

const samurai50 = makeCharacter(50);
runtime.setFightingSpiritCount(samurai50, 0);
samurai50.shield = 0;
g.CombatEngine.triggerEncounterStart([samurai50]);
assert.equal(runtime.fightingSpiritCount(samurai50), 5, "Tireless Spirit gains 5 Count at Encounter Start");
assert.equal(samurai50.shield, 10, "Fighting Spirit+ converts the 5 gained Count into 10 Shield");
g.CombatEngine.triggerPhase("[Round Start]", [samurai50]);
assert.equal(runtime.fightingSpiritCount(samurai50), 7, "Tireless Spirit gains 2 Count at Turn Start");
assert.equal(samurai50.shield, 14, "Turn Start Count also generates Fighting Spirit+ Shield");

const persuasion = runtime.applyElegantCourtierCheck({ kind: "skill", skillId: "persuasion", abilityId: "cha", finalPower: 1 }, makeCharacter(35));
assert.equal(persuasion.finalPower, 3, "Elegant Courtier adds WIS modifier to Persuasion Final Power");

const wisSave = runtime.applyElegantCourtierCheck({ kind: "save", abilityId: "wis", finalPower: 0 }, makeCharacter(35));
assert.equal(wisSave.finalPower, 2, "Elegant Courtier grants WIS Save proficiency through Check Final Power");

const alreadyWis = makeCharacter(35, { abilityProficiency: { wis: "proficient" }, traitChoices: {} });
assert.equal(runtime.applyElegantCourtierSaveChoice(alreadyWis, "int").success, true, "Existing WIS Save proficiency can choose INT");
const intSave = runtime.applyElegantCourtierCheck({ kind: "save", abilityId: "int", finalPower: 0 }, alreadyWis);
assert.equal(intSave.finalPower, 2, "Elegant Courtier alternate INT Save receives proficiency");

const enemyA = { id: "enemy_a", hp: 100, faction: "enemy" };
const enemyB = { id: "enemy_b", hp: 100, faction: "enemy" };
const samuraiRapid = makeCharacter(75, {
  faction: "player",
  attack_tier_1_sequence: [{ id: "tier1", skillFamily: "attack", attackMode: "melee" }],
  attack_tier_2_sequence: [{ id: "tier2", skillFamily: "attack", attackMode: "melee" }],
  attack_tier_3_sequence: [{ id: "tier3", skillFamily: "attack", attackMode: "melee" }],
});
combatants.splice(0, combatants.length, samuraiRapid, enemyA, enemyB);
runtime.setFightingSpiritCount(samuraiRapid, 30);
runtime.resetTurnState(samuraiRapid);
combatCalls.length = 0;
g.CombatEngine.resolveUnilateralWithCounter(samuraiRapid, { id: "starter", skillFamily: "attack", attackMode: "melee" }, enemyA, null, {});
assert.equal(combatCalls.length, 2, "Rapid Strike adds one extra Skill after a Melee Skill");
assert.equal(combatCalls[1].skill.id, "tier3", "30+ Fighting Spirit uses Tier 3");
assert.equal(combatCalls[1].options.__samuraiRapidStrike, true);
g.CombatEngine.resolveUnilateralWithCounter(samuraiRapid, { id: "starter2", skillFamily: "attack", attackMode: "melee" }, enemyB, null, {});
assert.equal(combatCalls.length, 3, "Rapid Strike can trigger only once per Turn");

const samuraiDeath = makeCharacter(90, { hp: 10, maxHp: 100, shield: 0 });
runtime.setFightingSpiritCount(samuraiDeath, 20);
runtime.resetEncounterState(samuraiDeath);
g.CombatEngine.applyDamage(samuraiDeath, 50);
assert.equal(samuraiDeath.hp, 21, "Strength Before Death survives at 1 HP then heals 20% Max HP");
assert.equal(runtime.fightingSpiritCount(samuraiDeath), 0, "Strength Before Death consumes all Fighting Spirit Count");
assert.equal(runtime.encounterState(samuraiDeath).strengthBeforeDeathUsed, true);
g.CombatEngine.applyDamage(samuraiDeath, 50);
assert.equal(samuraiDeath.hp, 0, "Strength Before Death only triggers once per Encounter");

console.log("Samurai archetype runtime smoke tests passed.");
