const { test, expect } = require("@playwright/test");
const path = require("node:path");

const baseRules = require("../js/character-build-rules.js");
const canonicalIntegration = require("../js/canonical-race-integration.js");
const existingIntegration = require("../js/existing-racial-stat-integration.js");
const rules = existingIntegration.installRules(canonicalIntegration.installRules(baseRules));

const ABILITY_KEYS = { str: "fuerza", dex: "destreza", con: "constitucion", int: "inteligencia", wis: "sabiduria", cha: "carisma" };
const BASE_10 = Object.freeze({ fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, sabiduria: 10, carisma: 10 });

function effective(input) {
  if (rules.EXISTING_RACIAL_STAT_RULES?.[input.raceId]) return rules.resolveExistingEffectiveStats(BASE_10, input);
  return rules.resolveEffectiveStats(BASE_10, input);
}

function expectStats(input, expected) {
  const full = { ...BASE_10 };
  Object.entries(expected).forEach(([abilityId, value]) => { full[ABILITY_KEYS[abilityId]] = value; });
  expect(effective(input)).toEqual(full);
  expect(BASE_10).toEqual({ fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, sabiduria: 10, carisma: 10 });
}

test("new canonical races resolve racial Stats independently from Traits", () => {
  const cases = [
    ["human", null, [], { str: 11, dex: 11, con: 11, int: 11, wis: 11, cha: 11 }],
    ["human", "variant", ["str", "dex"], { str: 11, dex: 11 }],
    ["dwarf", "hill", [], { con: 12, wis: 11 }], ["dwarf", "mountain", [], { con: 12, str: 12 }], ["dwarf", "duergar", [], { con: 12, str: 11 }],
    ["elf", "high", [], { dex: 12, int: 11 }], ["elf", "wood", [], { dex: 12, wis: 11 }], ["elf", "drow", [], { dex: 12, cha: 11 }],
    ["elf", "sea", [], { dex: 12, con: 11 }], ["elf", "eladrin", [], { dex: 12, cha: 11 }], ["elf", "shadar_kai", [], { dex: 12, con: 11 }],
    ["halfling", "lightfoot", [], { dex: 12, cha: 11 }], ["halfling", "stout", [], { dex: 12, con: 11 }],
    ["dragonborn", "red", [], { str: 12, cha: 11 }],
    ["gnome", "forest", [], { int: 12, dex: 11 }], ["gnome", "rock", [], { int: 12, con: 11 }],
    ["half_elf", null, ["str", "wis"], { cha: 12, str: 11, wis: 11 }],
    ["half_orc", null, [], { str: 12, con: 11 }], ["orc", null, [], { str: 12, con: 11 }],
  ];
  for (const [raceId, raceSubtypeId, racialStatChoices, expected] of cases) expectStats({ raceId, raceSubtypeId, racialStatChoices }, expected);
});

test("pre-existing races resolve their source-backed racial Stats too", () => {
  const cases = [
    ["lizalin", null, [], { con: 12, wis: 11 }], ["kobold", null, [], { dex: 12, int: 11 }], ["kenku", null, [], { dex: 12, wis: 11 }],
    ["centaur", null, [], { str: 12, wis: 11 }], ["goliath", null, [], { str: 12, con: 11 }], ["lanae", null, [], { con: 12, wis: 11 }],
    ["goblin", null, [], { dex: 12, con: 11 }], ["fairy", "fire", [], { dex: 11, cha: 11 }],
    ["aasimar", "protector", [], { cha: 12, wis: 11 }], ["aasimar", "scourge", [], { cha: 12, con: 11 }], ["aasimar", "fallen", [], { cha: 12, str: 11 }],
    ["tiefling", "asmodeus", ["int"], { cha: 12, int: 11 }], ["half_demon", null, [], { dex: 11, con: 11 }], ["warforged", "envoy", ["str"], { con: 12, str: 11 }],
    ["felinae", "ordinary", ["wis"], { dex: 12, wis: 11 }], ["half_dragon", "red", ["dex"], { str: 11, cha: 11, dex: 11 }],
    ["lupae", null, [], { str: 12, wis: 11 }], ["moonfae", "full_moon", [], { dex: 12, cha: 11 }],
    ["yuan_ti_pureblood", "red_eyes", ["dex"], { cha: 12, dex: 11 }],
  ];
  for (const [raceId, raceSubtypeId, racialStatChoices, expected] of cases) expectStats({ raceId, raceSubtypeId, racialStatChoices }, expected);
});

test("racial Stat choices enforce source restrictions", () => {
  expect(rules.validateExistingRacialStatChoices({ raceId: "tiefling", racialStatChoices: ["dex"] }).valid).toBe(true);
  expect(rules.validateExistingRacialStatChoices({ raceId: "tiefling", racialStatChoices: ["str"] }).valid).toBe(false);
  expect(rules.validateExistingRacialStatChoices({ raceId: "warforged", racialStatChoices: ["con"] }).valid).toBe(false);
  expect(rules.validateExistingRacialStatChoices({ raceId: "felinae", racialStatChoices: ["dex"] }).valid).toBe(false);
  expect(rules.validateExistingRacialStatChoices({ raceId: "half_dragon", racialStatChoices: ["str"] }).valid).toBe(false);
  expect(rules.validateExistingRacialStatChoices({ raceId: "half_dragon", racialStatChoices: ["cha"] }).valid).toBe(false);
  expect(rules.validateExistingRacialStatChoices({ raceId: "yuan_ti_pureblood", racialStatChoices: ["str"] }).valid).toBe(false);

  const variant = canonicalIntegration.installRules(baseRules).validateBuild({
    level: 10, constitution: 10, classes: [{ classId: "fighter", levels: 10 }], backgroundId: "chef",
    raceId: "human", raceSubtypeId: "variant", racialStatChoices: ["dex", "dex"],
  });
  expect(variant.complete).toBe(false);
});

test("Half-Demon receives its sourced DEX +1 and CON +1 racial bonus", () => {
  expect(rules.SOURCE_UNRESOLVED_RACIAL_STAT_RACES).not.toContain("half_demon");
  expect(rules.resolveExistingRacialStatBonuses({ raceId: "half_demon" })).toEqual({ str: 0, dex: 1, con: 1, int: 0, wis: 0, cha: 0 });
});

test("adding racial Stats does not change legacy race HP coefficient, OFF, or DEF rules", () => {
  const choiceByRace = { tiefling: ["int"], warforged: ["str"], felinae: ["str"], half_dragon: ["dex"], yuan_ti_pureblood: ["dex"] };
  const keys = ["classHpCoef", "backgroundHpCoefBonus", "raceHpCoefBonus", "intrinsicHpCoef", "classOffMod", "classDefMod", "raceDefMod", "offLevel", "defLevel"];
  for (const race of baseRules.RACES) {
    const input = {
      level: 10, constitution: 10, classes: [{ classId: "fighter", levels: 10 }], backgroundId: "chef",
      raceId: race.id, raceSubtypeId: race.subtypes?.[0]?.id || null, baseOffLevel: 10, baseDefLevel: 10,
    };
    const before = baseRules.calculateBuild(input);
    const after = rules.calculateBuild({ ...input, racialStatChoices: choiceByRace[race.id] || [] });
    expect(after.raceId).toBe(race.id);
    for (const key of keys) expect(after[key], `${race.id}.${key}`).toBe(before[key]);
  }
});

test("canonical Traits validate, add new packages, and preserve existing packages", () => {
  const engine = require("../js/trait-engine.js");
  const baseCatalog = require("../js/racial-trait-catalog.js");
  const beforeGoliath = baseCatalog.resolveTraitGrants({ raceId: "goliath" }).map((trait) => trait.id);
  const canonicalCatalog = require("../js/canonical-racial-traits.js");
  expect(canonicalCatalog.validateAll(engine)).toMatchObject({ valid: true, errors: [] });
  expect(canonicalCatalog.resolveTraitGrants({ raceId: "goliath" }).map((trait) => trait.id)).toEqual(beforeGoliath);
  expect(canonicalCatalog.resolveTraitGrants({ raceId: "dwarf", raceSubtypeId: "hill" }).map((trait) => trait.id)).toEqual([
    "dwarven_resilience", "stonecunning", "dwarven_combat_training", "tool_proficiency", "heavy_armor_movement", "dwarven_toughness",
  ]);
});

test("Trait importer sees canonical racial definitions and generated grants have Firebase-safe ids", () => {
  require("../js/trait-engine.js");
  const canonicalCatalog = require("../js/canonical-racial-traits.js");
  const importer = require("../js/dm-trait-catalog-importer.js");
  expect(importer.collectCatalog().definitions.dwarven_resilience).toBeTruthy();
  for (const grant of canonicalCatalog.allGrants()) {
    expect(grant.id).toBeTruthy();
    expect(grant.id).not.toMatch(/[.#$\[\]\/]/);
  }
});

test("DM Studio uses racial Stats for derived HP and persists base/effective layers", async ({ page }) => {
  await page.setContent('<section id="dashboard-jugadores"><div class="panel-cyber"><div id="grid-jugadores"></div></div></section>');
  await page.evaluate(() => {
    window.calculateLevelData = () => ({ level: 10, xpPercent: 0, xpMissing: 60 });
    const players = {
      p1: {
        characterName: "Lizalin Test",
        xp: 780,
        stats: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, sabiduria: 10, carisma: 10 },
        characterBuild: {
          classes: [{ classId: "fighter", levels: 10 }],
          backgroundId: "chef",
          raceId: "lizalin",
          raceSubtypeId: null,
        },
      },
    };
    window.__lastPlayerUpdate = null;
    const db = {
      ref(path) {
        return {
          on(event, callback) {
            if (path === "campaña/jugadores" && event === "value") callback({ val: () => players });
          },
          update(updates) {
            window.__lastPlayerUpdate = { path, updates: JSON.parse(JSON.stringify(updates)) };
            return Promise.resolve();
          },
        };
      },
    };
    window.firebase = { apps: [{}], database: () => db };
  });

  const root = path.join(__dirname, "..");
  for (const file of ["character-build-rules.js", "canonical-race-integration.js", "existing-racial-stat-integration.js", "dm-player-dnd-studio.js"]) {
    await page.addScriptTag({ path: path.join(root, "js", file) });
  }

  await expect(page.locator("#dm-player-dnd-select option[value='p1']")).toHaveCount(1);
  await page.selectOption("#dm-player-dnd-select", "p1");
  await page.waitForTimeout(0);

  expect(await page.locator("#dm-player-stat-con").inputValue()).toBe("10");
  expect(await page.locator("#dm-player-stat-wis").inputValue()).toBe("10");

  const effective = await page.evaluate(() => window.LuminousDmPlayerDndStudio.resolveEffectiveStats());
  expect(effective).toMatchObject({ constitucion: 12, sabiduria: 11 });

  // Fighter level 10 => tier 2. Lizalin CON 10 + racial 2 => CON 12 => +1 mod.
  // HP Base therefore becomes 2 * (10 + 1) = 22.
  expect(await page.locator("#dm-player-hp-base").inputValue()).toBe("22");

  await page.click("#dm-player-dnd-save");
  await expect.poll(() => page.evaluate(() => Boolean(window.__lastPlayerUpdate))).toBe(true);
  const saved = await page.evaluate(() => window.__lastPlayerUpdate);
  expect(saved.path).toBe("campaña/jugadores/p1");
  expect(saved.updates).toMatchObject({
    "baseStats/constitucion": 10,
    "baseStats/sabiduria": 10,
    "stats/constitucion": 12,
    "stats/sabiduria": 11,
    "characterBuild/raceId": "lizalin",
    "characterBuild/breakdown/racialStatBonuses": { str: 0, dex: 0, con: 2, int: 0, wis: 1, cha: 0 },
    hp_base: 22,
  });

  // The editor remains on base values; racial bonuses are a separate layer.
  expect(await page.locator("#dm-player-stat-con").inputValue()).toBe("10");
  expect(await page.locator("#dm-player-stat-wis").inputValue()).toBe("10");
});