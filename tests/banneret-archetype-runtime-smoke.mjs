import assert from "node:assert/strict";

const g = globalThis;
const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

function fighterLevel(character = {}) {
  const classes = Array.isArray(character.classes) ? character.classes : character.characterBuild?.classes || [];
  const found = classes.find((entry) => normalizeId(entry.id || entry.classId || entry.name) === "fighter");
  return Number(found?.level ?? found?.levels ?? 0);
}

function isBanneret(character = {}) {
  const raw = character.characterBuild?.archetypes || character.archetypes || [];
  return raw.some((entry) => normalizeId(entry.classId) === "fighter" && normalizeId(entry.archetypeId || entry.id) === "banneret");
}

g.LuminousArchetypeEngine = {
  getClassLevel(character, classId) {
    return normalizeId(classId) === "fighter" ? fighterLevel(character) : 0;
  },
  isSelected(character, archetypeId, classId) {
    return normalizeId(archetypeId) === "banneret" && normalizeId(classId) === "fighter" && isBanneret(character);
  },
  resolveTraitGrants(character, grants = [], definitions = {}) {
    if (!isBanneret(character)) return [];
    const level = fighterLevel(character);
    return grants
      .filter((grant) => level >= Number(grant.atLevel || 0))
      .map((grant) => ({ ...definitions[grant.traitId], source: { ...(definitions[grant.traitId]?.source || {}), ...(grant.source || {}) } }))
      .filter((trait) => trait?.id);
  },
};

g.LuminousArchetypeTraitCatalog = {
  ARCHETYPES: {},
  DEFINITIONS: {},
  GRANTS: [],
  allArchetypes() { return {}; },
  allDefinitions() { return {}; },
  allGrants() { return []; },
  getDefinition() { return null; },
  resolveTraitGrants() { return []; },
};

g.LuminousTraitCatalogCore = {
  allDefinitions() { return {}; },
  allGrants() { return []; },
  getDefinition() { return null; },
};

const activateCalls = [];
g.LuminousTraitEngine = {
  resolveTraitGrants() { return []; },
  activateTrait(traitInput, runtime = {}, state = {}) {
    const id = normalizeId(traitInput?.id || traitInput?.name || traitInput);
    activateCalls.push(id);
    const type = id === "second_wind"
      ? "fighter_second_wind_used"
      : id === "action_surge"
        ? "fighter_action_surge"
        : id === "indomitable"
          ? "fighter_indomitable"
          : null;
    return {
      available: true,
      scheduled: false,
      trait: typeof traitInput === "object" ? traitInput : { id },
      runtime,
      state,
      outcomes: type ? [{ type }] : [],
    };
  },
};

g.LuminousArchetypeRuntime = {
  syncArchetypeTraitsForUnit() { return []; },
};

const combatCalls = [];
g.CombatEngine = {
  getAllAliveUnits() { return []; },
  resolveUnilateralWithCounter(attacker, skill, defender, counterSkill, options = {}) {
    combatCalls.push({ attacker, skill, defender, counterSkill, options });
    return { attacker, skill, defender };
  },
};

await import("../js/banneret-archetype-runtime.js");

const runtime = g.LuminousBanneretArchetypeRuntime;
assert.ok(runtime, "Banneret runtime should install");
assert.equal(runtime.ARCHETYPE_ID, "banneret");
assert.equal(g.LuminousArchetypeTraitCatalog.allArchetypes().banneret.name, "Banneret / Purple Dragon Knight");

const makeBanneret = (level, extra = {}) => ({
  id: "banneret_" + level,
  name: "Banneret",
  faction: "player",
  hp: 100,
  maxHp: 100,
  speed: 5,
  level,
  classes: [{ id: "fighter", level }],
  characterBuild: { archetypes: [{ classId: "fighter", archetypeId: "banneret" }] },
  ...extra,
});

assert.deepEqual(
  g.LuminousArchetypeTraitCatalog.resolveTraitGrants(makeBanneret(15)).map((trait) => trait.id),
  ["rallying_cry"],
  "Lv15 grants Rallying Cry",
);

assert.deepEqual(
  g.LuminousArchetypeTraitCatalog.resolveTraitGrants(makeBanneret(75)).map((trait) => trait.id).sort(),
  ["bulwark", "inspiring_surge", "rallying_cry", "royal_envoy"].sort(),
  "Lv75 grants the first four Banneret traits",
);

assert.deepEqual(
  g.LuminousArchetypeTraitCatalog.resolveTraitGrants(makeBanneret(90)).map((trait) => trait.id).sort(),
  ["bulwark", "inspiring_surge_plus", "rallying_cry", "royal_envoy"].sort(),
  "Lv90 replaces Inspiring Surge with Inspiring Surge+",
);

const banneret15 = makeBanneret(15);
const allyA = { id: "ally_a", faction: "player", hp: 20, maxHp: 100, speed: 2 };
const allyB = { id: "ally_b", faction: "player", hp: 30, maxHp: 60, speed: 9 };
const allyC = { id: "ally_c", faction: "player", hp: 90, maxHp: 100, speed: 6 };
const allyD = { id: "ally_d", faction: "player", hp: 80, maxHp: 100, speed: 4 };
const enemy = { id: "enemy", faction: "enemy", hp: 100, maxHp: 100, speed: 10 };
const combatants = [banneret15, allyA, allyB, allyC, allyD, enemy];

const secondWindResult = g.LuminousTraitEngine.activateTrait(
  { id: "second_wind" },
  { self: banneret15, character: banneret15, combatants },
  {}
);
const rally = secondWindResult.outcomes.find((outcome) => outcome.type === "banneret_rallying_cry");
assert.ok(rally?.triggered, "Rallying Cry triggers on Second Wind");
assert.deepEqual(rally.targets.map((unit) => unit.id), ["ally_a", "ally_b", "ally_d"], "Rallying Cry targets the three lowest HP percentages");
assert.equal(allyA.hp, 30, "Rallying Cry heals 10% Max HP");
assert.equal(allyB.hp, 36, "Rallying Cry heals 10% of each ally's own Max HP");
assert.equal(allyD.hp, 90, "Rallying Cry heals the third-lowest ally");
assert.equal(allyC.hp, 90, "Fourth ally is not healed");

const banneret35 = makeBanneret(35);
const persuasionNone = runtime.applyRoyalEnvoyCheck({ kind: "skill", skillId: "persuasion", finalPower: 0 }, banneret35);
assert.equal(persuasionNone.finalPower, 2, "Royal Envoy grants Persuasion proficiency");
assert.equal(persuasionNone.royalEnvoyProficiency, "proficient");

const banneret35Proficient = makeBanneret(35, { skillProficiency: { persuasion: "proficient" } });
const persuasionProficient = runtime.applyRoyalEnvoyCheck({ kind: "skill", skillId: "persuasion", finalPower: 0 }, banneret35Proficient);
assert.equal(persuasionProficient.finalPower, 2, "Existing Persuasion proficiency is upgraded by one additional proficiency bonus");
assert.equal(persuasionProficient.royalEnvoyProficiency, "expertise");

const fast = {
  id: "fast",
  faction: "player",
  hp: 100,
  maxHp: 100,
  speed: 12,
  attack_tier_1_sequence: [{ id: "fast_t1", type: "Attack" }],
  attack_tier_2_sequence: [{ id: "fast_t2", type: "Attack" }],
  attack_tier_3_sequence: [{ id: "fast_t3", type: "Attack" }],
};
const medium = {
  id: "medium",
  faction: "player",
  hp: 100,
  maxHp: 100,
  speed: 8,
  attack_tier_1_sequence: [{ id: "medium_t1", type: "Attack" }],
};
const slow = {
  id: "slow",
  faction: "player",
  hp: 100,
  maxHp: 100,
  speed: 3,
  attack_tier_1_sequence: [{ id: "slow_t1", type: "Attack" }],
};
const enemy1 = { id: "enemy1", faction: "enemy", hp: 100, maxHp: 100 };
const enemy2 = { id: "enemy2", faction: "enemy", hp: 100, maxHp: 100 };

const banneret50 = makeBanneret(50);
combatCalls.length = 0;
const surge50 = g.LuminousTraitEngine.activateTrait(
  { id: "action_surge" },
  { self: banneret50, character: banneret50, combatants: [banneret50, fast, medium, slow, enemy1, enemy2], combatEngine: g.CombatEngine, rng: () => 0 },
  {}
);
const inspiring50 = surge50.outcomes.find((outcome) => outcome.type === "banneret_inspiring_surge");
assert.ok(inspiring50?.triggered, "Inspiring Surge triggers on Action Surge");
assert.equal(combatCalls.length, 1, "Base Inspiring Surge causes one ally Skill");
assert.equal(combatCalls[0].attacker.id, "fast", "Highest Speed ally acts");
assert.equal(combatCalls[0].skill.id, "fast_t1", "Skill selection can choose from the full offensive pool without tier thresholds");
assert.equal(combatCalls[0].defender.id, "enemy1", "Target is selected randomly from enemies");

const banneret90 = makeBanneret(90);
combatCalls.length = 0;
const surge90 = g.LuminousTraitEngine.activateTrait(
  { id: "action_surge" },
  { self: banneret90, character: banneret90, combatants: [banneret90, fast, medium, slow, enemy1, enemy2], combatEngine: g.CombatEngine, rng: () => 0 },
  {}
);
const inspiring90 = surge90.outcomes.find((outcome) => outcome.type === "banneret_inspiring_surge");
assert.equal(inspiring90.traitId, "inspiring_surge_plus");
assert.equal(combatCalls.length, 2, "Inspiring Surge+ causes two ally Skills");
assert.deepEqual(combatCalls.map((call) => call.attacker.id), ["fast", "medium"], "Inspiring Surge+ uses the two highest Speed allies");

const banneret75 = makeBanneret(75);
const lowCheck = {
  kind: "save",
  effectId: "dragon_fear",
  total: 3,
  headsChance: 100,
  coins: [{ side: "tail", success: false }, { side: "tail", success: false }],
};
const highCheck = {
  kind: "save",
  effectId: "dragon_fear",
  total: 7,
  headsChance: 100,
  coins: [{ side: "tail", success: false }, { side: "head", success: true }],
};
const otherEffectCheck = {
  kind: "save",
  effectId: "other_effect",
  total: 1,
  headsChance: 100,
  coins: [{ side: "tail", success: false }],
};

const bulwarkResult = g.LuminousTraitEngine.activateTrait(
  { id: "indomitable" },
  {
    self: banneret75,
    character: banneret75,
    check: { kind: "save", effectId: "dragon_fear", total: 2 },
    alliedSaveChecks: [
      { unit: fast, check: highCheck },
      { unit: medium, check: lowCheck },
      { unit: slow, check: otherEffectCheck },
    ],
    rng: () => 0,
  },
  {}
);
const bulwark = bulwarkResult.outcomes.find((outcome) => outcome.type === "banneret_bulwark");
assert.ok(bulwark?.triggered, "Bulwark triggers on Indomitable");
assert.equal(bulwark.ally.id, "medium", "Bulwark selects the lowest Save Check against the same effect");
assert.equal(bulwark.reroll.rerolled, 2, "Bulwark rerolls the entire Save Check");
assert.equal(lowCheck.heads, 2, "Bulwark uses the new rerolled Check");
assert.equal(lowCheck.bulwarkReroll.rerolled, 2);
assert.equal(otherEffectCheck.coins[0].side, "tail", "Bulwark does not touch a different effect");

console.log("Banneret archetype runtime smoke tests passed.");
