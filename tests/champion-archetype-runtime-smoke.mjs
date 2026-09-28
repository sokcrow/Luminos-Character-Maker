import assert from "node:assert/strict";

const g = globalThis;
const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function fighterLevel(character = {}) {
  const classes = Array.isArray(character.classes) ? character.classes : character.characterBuild?.classes || [];
  const found = classes.find((entry) => normalizeId(entry.id || entry.classId || entry.name) === "fighter");
  return Number(found?.level ?? found?.levels ?? 0);
}

function isChampion(character = {}) {
  const raw = character.characterBuild?.archetypes || character.archetypes || [];
  return raw.some((entry) => normalizeId(entry.classId) === "fighter" && normalizeId(entry.archetypeId || entry.id) === "champion");
}

g.LuminousArchetypeEngine = {
  getClassLevel(character, classId) { return normalizeId(classId) === "fighter" ? fighterLevel(character) : 0; },
  isSelected(character, archetypeId, classId) { return normalizeId(archetypeId) === "champion" && normalizeId(classId) === "fighter" && isChampion(character); },
  resolveTraitGrants(character, grants = [], definitions = {}) {
    if (!isChampion(character)) return [];
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
g.LuminousStatusEngine = {
  applyStatus(unit, id, input = {}) {
    unit.statusEffects ||= {};
    const existing = unit.statusEffects[id] || { id, count: 0, potency: 0 };
    unit.statusEffects[id] = {
      ...existing,
      count: Number(existing.count || 0) + Number(input.count || 0),
      potency: Number(existing.potency || 0) + Number(input.potency || 0),
    };
    return unit.statusEffects[id];
  },
};

await import("../js/champion-archetype-runtime.js");

const runtime = g.LuminousChampionArchetypeRuntime;
assert.ok(runtime, "Champion archetype runtime should install");
assert.equal(runtime.ARCHETYPE_ID, "champion");
assert.equal(runtime.CLASS_ID, "fighter");
assert.equal(g.LuminousArchetypeTraitCatalog.allArchetypes().champion.name, "Champion");

const makeCharacter = (level, extra = {}) => ({
  id: "champion_" + level,
  hp: 100,
  maxHp: 100,
  classes: [{ id: "fighter", level }],
  characterBuild: { archetypes: [{ classId: "fighter", archetypeId: "champion" }] },
  ...extra,
});

assert.deepEqual(
  g.LuminousArchetypeTraitCatalog.resolveTraitGrants(makeCharacter(15)).map((trait) => trait.id),
  ["improved_critical"],
  "Level 15 grants Improved Critical",
);

assert.deepEqual(
  g.LuminousArchetypeTraitCatalog.resolveTraitGrants(makeCharacter(75)).map((trait) => trait.id).sort(),
  ["remarkable_athlete", "additional_fighting_style", "superior_critical"].sort(),
  "Superior Critical replaces Improved Critical at level 75",
);

assert.equal(runtime.DEFINITIONS.improved_critical.mechanics.critDamagePercent, 10);
assert.equal(runtime.DEFINITIONS.improved_critical.mechanics.additionalSkillPoise, 1);
assert.equal(runtime.DEFINITIONS.improved_critical.mechanics.turnStartPoise, 2);
assert.equal(runtime.DEFINITIONS.superior_critical.mechanics.critDamagePercent, 20);
assert.equal(runtime.DEFINITIONS.superior_critical.mechanics.additionalSkillPoise, 2);
assert.equal(runtime.DEFINITIONS.superior_critical.mechanics.turnStartPoise, 3);

assert.equal(runtime.fightingStyleChoiceLimit(makeCharacter(49)), 1);
assert.equal(runtime.fightingStyleChoiceLimit(makeCharacter(50)), 2);

const strCheck = runtime.applyRemarkableAthleteCheck({ abilityId: "STR", finalPower: 4 }, makeCharacter(35));
assert.equal(strCheck.finalPower, 5, "Remarkable Athlete adds +1 Final Power to STR checks");
const chaCheck = runtime.applyRemarkableAthleteCheck({ abilityId: "CHA", finalPower: 4 }, makeCharacter(35));
assert.equal(chaCheck.finalPower, 4, "Remarkable Athlete does not affect CHA checks");

const champion90 = makeCharacter(90);
g.LuminousArchetypeRuntime.syncArchetypeTraitsForUnit(champion90);
champion90.hp = 50;
champion90.maxHp = 100;
const turnStart = runtime.applyChampionTurnStart(champion90);
assert.equal(champion90.statusEffects.poise.count, 3, "Superior Critical grants 3 Poise on Turn Start");
assert.equal(champion90.hp, 55, "Survivor heals 5% Max HP at 50% HP or lower");
assert.equal(turnStart.survivor.healed, 5);

const poiseEffect = { tag: "[On Hit]", target: "self", type: "status", status: "poise", count: 2, potency: 1 };
const context = { attacker: champion90, skill: { effects: [poiseEffect] } };
let countDuringResolution = null;
runtime.withAdditionalSkillPoise(champion90, context, "[On Hit]", () => { countDuringResolution = poiseEffect.count; });
assert.equal(countDuringResolution, 4, "Superior Critical adds +2 Poise to Skills that already grant Poise");
assert.equal(poiseEffect.count, 2, "Skill definition is restored after resolution");

console.log("Champion archetype runtime smoke tests passed.");
