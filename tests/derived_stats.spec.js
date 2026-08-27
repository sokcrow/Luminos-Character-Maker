const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const derived = require("../js/derived-stats-engine.js");
const modifierEngine = require("../js/universal-modifier-engine.js");
const traitCatalog = require("../js/trait-catalog-core.js");
const tooltip = require("../js/player-stat-tooltip-runtime.js");

const BASE_10 = Object.freeze({
  fuerza: 10,
  destreza: 10,
  constitucion: 10,
  inteligencia: 10,
  sabiduria: 10,
  carisma: 10,
});

function character(overrides = {}) {
  return {
    level: 10,
    baseStats: { ...BASE_10 },
    stats: { ...BASE_10 },
    characterBuild: {
      raceId: "human",
      raceSubtypeId: null,
      racialStatChoices: [],
      backgroundId: "chef",
      classes: [{ classId: "fighter", levels: 10 }],
      ...(overrides.characterBuild || {}),
    },
    ...overrides,
    baseStats: { ...BASE_10, ...(overrides.baseStats || {}) },
  };
}

function resetRuntimeGlobals() {
  delete global.LuminousDerivedStatsRuntime;
  delete global.LuminousPlayerStats;
  delete global.LuminousDmPlayerDndStudio;
  delete global.LuminousNpcStats;
  delete global.CombatEngine;
}

test.afterEach(() => resetRuntimeGlobals());

test("Human base 10 + racial +1 resolves 11 and reload never reapplies the bonus", () => {
  const first = derived.resolveCharacterStats(character());
  expect(first.baseStats.fuerza).toBe(10);
  expect(first.effectiveStats.fuerza).toBe(11);
  expect(first.abilities.str.modifier).toBe(0);

  const reloaded = character({
    stats: { fuerza: 11, destreza: 11, constitucion: 11, inteligencia: 11, sabiduria: 11, carisma: 11 },
  });
  const second = derived.resolveCharacterStats(reloaded);
  expect(second.baseStats.fuerza).toBe(10);
  expect(second.effectiveStats.fuerza).toBe(11);
  expect(second.effectiveStats.fuerza).not.toBe(12);
});

test("DM editing stays on base Score while canonical effective Score remains separate", () => {
  const source = character();
  const snapshot = derived.resolveCharacterStats(source);
  expect(source.baseStats.fuerza).toBe(10);
  expect(snapshot.baseStats.fuerza).toBe(10);
  expect(snapshot.effectiveStats.fuerza).toBe(11);
  expect(source.baseStats.fuerza).toBe(10);
});

test("Player, DM, NPC and Combat adapters expose the same canonical Ability Mod", () => {
  const source = character({ baseStats: { fuerza: 14 } });
  const canonical = derived.resolveCharacterStats(source);

  global.LuminousPlayerStats = Object.freeze({
    abilityScore: () => 999,
    abilityModifier: () => 999,
    proficiencyBonus: () => 999,
    abilityRollMath: () => ({ state: "none", proficiencyValue: 0 }),
    combatLevelBreakdown: () => ({ total: -1 }),
    currentHp: () => -1,
    maxHp: () => -1,
  });
  global.LuminousDmPlayerDndStudio = Object.freeze({
    abilityModifier: () => 999,
    proficiencyBonus: () => 999,
    resolveEffectiveStats: () => ({}),
    effectiveAbilityScore: () => 999,
    combatBreakdown: () => ({ total: -1 }),
    baseStatsFromForm: () => ({ ...source.baseStats }),
    racialStatInput: () => ({ raceId: "human", racialStatChoices: [] }),
  });
  global.LuminousNpcStats = Object.freeze({
    abilityModifier: () => 999,
    abilityRollMath: (profile, abilityId) => ({ abilityId, score: profile.stats.fuerza, proficiencyValue: 0 }),
  });
  global.CombatEngine = {
    getOffensiveLevel: () => -1,
    getDefensiveLevel: () => -1,
  };

  delete require.cache[require.resolve("../js/derived-stats-runtime.js")];
  const runtime = require("../js/derived-stats-runtime.js");
  runtime.install();

  const playerRoll = global.LuminousPlayerStats.abilityRollMath({ id: "str", key: "fuerza" }, source);
  expect(playerRoll.modifier).toBe(canonical.abilities.str.modifier);
  expect(global.LuminousPlayerStats.abilityModifier(canonical.abilities.str.score)).toBe(canonical.abilities.str.modifier);
  expect(global.LuminousDmPlayerDndStudio.abilityModifier(canonical.abilities.str.score)).toBe(canonical.abilities.str.modifier);

  const npc = { stats: { ...source.baseStats }, proficiencyBonus: 1 };
  const npcRoll = global.LuminousNpcStats.abilityRollMath(npc, "str");
  expect(npcRoll.modifier).toBe(derived.abilityModifier(14));

  const combatSnapshot = global.CombatEngine.resolveDerivedStats(source);
  expect(combatSnapshot.abilities.str.modifier).toBe(canonical.abilities.str.modifier);
});

test("runtime Trait modifies effective Score without rewriting base Score", () => {
  const source = {
    ...character({
      level: 100,
      baseStats: { fuerza: 20, constitucion: 18 },
      characterBuild: {
        raceId: null,
        backgroundId: "chef",
        classes: [{ classId: "barbarian", levels: 100 }],
      },
    }),
    classes: [{ classId: "barbarian", levels: 100 }],
  };
  const before = JSON.parse(JSON.stringify(source.baseStats));
  const snapshot = derived.resolveCharacterStats(source, {
    modifierEngine,
    traits: [traitCatalog.getDefinition("primordial_champion")],
    context: "any",
  });

  expect(snapshot.baseStats.fuerza).toBe(20);
  expect(snapshot.effectiveStats.fuerza).toBe(24);
  expect(snapshot.abilities.str.runtimeScoreBonus).toBe(4);
  expect(source.baseStats).toEqual(before);
});

test("multiclass only affects derived build through explicit weighted class rules", () => {
  const multi = character({
    level: 100,
    characterBuild: {
      raceId: "human",
      backgroundId: "chef",
      classes: [
        { classId: "barbarian", levels: 25 },
        { classId: "bard", levels: 75 },
      ],
    },
  });
  const snapshot = derived.resolveCharacterStats(multi);
  expect(snapshot.level).toBe(100);
  expect(snapshot.build.classLevelTotal).toBe(100);
  expect(snapshot.abilities.str.score).toBe(11);
  expect(snapshot.abilities.str.modifier).toBe(0);
});

test("tooltip modifier breakdown sums exactly to the canonical visible modifier", () => {
  const source = character({
    baseStats: { fuerza: 11 },
    characterBuild: {
      raceId: "human",
      backgroundId: "chef",
      classes: [{ classId: "fighter", levels: 10 }],
      breakdown: {
        backgroundStatBonuses: { str: 1 },
        traitStatBonuses: { str: 1 },
      },
    },
  });
  const snapshot = derived.resolveCharacterStats(source);
  const ability = snapshot.abilities.str;
  const parts = tooltip.modifierContributions({
    baseScore: ability.baseScore,
    racialScoreBonus: ability.racialScoreBonus,
    backgroundScoreBonus: ability.backgroundScoreBonus,
    traitsScoreBonus: ability.traitScoreBonus,
  });
  expect(parts.total).toBe(ability.modifier);
  expect(parts.baseModifier + parts.racial + parts.background + parts.traits).toBe(ability.modifier);
});

test("legacy effective stats with stored racial breakdown normalize before calculation", () => {
  const legacy = {
    level: 10,
    stats: { fuerza: 11, destreza: 11, constitucion: 11, inteligencia: 11, sabiduria: 11, carisma: 11 },
    characterBuild: {
      raceId: "human",
      backgroundId: "chef",
      classes: [{ classId: "fighter", levels: 10 }],
      breakdown: { racialStatBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 } },
    },
  };
  const snapshot = derived.resolveCharacterStats(legacy);
  expect(snapshot.baseStats.fuerza).toBe(10);
  expect(snapshot.effectiveStats.fuerza).toBe(11);
});

test("NPC and PC use identical shared Score -> Modifier semantics", () => {
  const pc = derived.resolveCharacterStats(character({ baseStats: { destreza: 17 } }));
  const npc = derived.resolveCharacterStats({ stats: { destreza: 18 } }, { proficiencyBonusOverride: 3 });
  expect(pc.abilities.dex.modifier).toBe(derived.abilityModifier(pc.abilities.dex.score));
  expect(npc.abilities.dex.modifier).toBe(derived.abilityModifier(npc.abilities.dex.score));
  expect(npc.proficiency).toMatchObject({ bonus: 3, source: "override" });
});

test("OFF DEF and Speed are one canonical base plus Universal Modifier channels", () => {
  const source = {
    ...character({
      level: 100,
      characterBuild: {
        raceId: null,
        backgroundId: "chef",
        classes: [{ classId: "barbarian", levels: 100 }],
      },
    }),
    classes: [{ classId: "barbarian", levels: 100 }],
    combatStats: { minSpeed: 2, maxSpeed: 6 },
  };
  const traits = [traitCatalog.getDefinition("armorless_defense"), traitCatalog.getDefinition("fast_movement")];
  const snapshot = derived.resolveCharacterStats(source, { modifierEngine, traits, context: "combat" });

  expect(snapshot.defensiveLevel.runtimeModifier).toBe(derived.abilityModifier(snapshot.abilities.con.score));
  expect(snapshot.speed.minModifier).toBe(1);
  expect(snapshot.speed.min).toBe(3);
  expect(snapshot.offensiveLevel.total).toBe(
    snapshot.offensiveLevel.level + snapshot.offensiveLevel.classModifier + snapshot.offensiveLevel.raceModifier +
    snapshot.offensiveLevel.dmModifier + snapshot.offensiveLevel.itemModifier + snapshot.offensiveLevel.runtimeModifier
  );
  expect(snapshot.defensiveLevel.total).toBe(
    snapshot.defensiveLevel.level + snapshot.defensiveLevel.classModifier + snapshot.defensiveLevel.raceModifier +
    snapshot.defensiveLevel.dmModifier + snapshot.defensiveLevel.itemModifier + snapshot.defensiveLevel.runtimeModifier
  );
});

test("SP contract preserves existing current value without inventing a Max SP formula", () => {
  expect(derived.resolveCharacterStats({ combatStats: { sp_actual: -12 } }).sp).toEqual({ current: -12, max: null, source: "current-only" });
  expect(derived.resolveCharacterStats({ combatStats: { sp_actual: 5, sp_max: 45 } }).sp).toEqual({ current: 5, max: 45, source: "stored" });
});

test("Derived Stats runtime owns Combat base while preserving Skill-specific scaling", () => {
  const source = character({
    level: 10,
    baseStats: { fuerza: 14 },
    stats: { fuerza: 15 },
  });
  global.CombatEngine = {
    getOffensiveLevel: () => 999,
    getDefensiveLevel: () => 999,
  };
  delete require.cache[require.resolve("../js/derived-stats-runtime.js")];
  const runtime = require("../js/derived-stats-runtime.js");
  runtime.installCombat();

  const base = derived.resolveCharacterStats(source).offensiveLevel.total;
  const skill = { scaling_stat: "fuerza", resonance: 2 };
  expect(global.CombatEngine.getOffensiveLevel(source, skill)).toBe(base + 15 + 2);
  expect(global.CombatEngine.__derivedStatsV1).toBe(true);
});

test("runtime and engine stay mechanics-only and do not persist derived state", () => {
  const engineSource = fs.readFileSync(path.join(__dirname, "..", "js/derived-stats-engine.js"), "utf8");
  const runtimeSource = fs.readFileSync(path.join(__dirname, "..", "js/derived-stats-runtime.js"), "utf8");
  expect(engineSource).not.toContain("firebase.database");
  expect(engineSource).not.toContain(".update(");
  expect(engineSource).not.toContain(".set(");
  expect(runtimeSource).not.toContain("firebase.database");
});
