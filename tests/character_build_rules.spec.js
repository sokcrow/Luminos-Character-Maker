const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const rules = require("../js/character-build-rules.js");
const studio = read("js/dm-player-dnd-studio.js");

function closeTo(actual, expected, precision = 6) {
  expect(Math.abs(actual - expected)).toBeLessThan(10 ** -precision);
}

test("catálogos contienen las 13 clases, 15 razas y trasfondos Project Moon", () => {
  expect(rules.CLASSES).toHaveLength(13);
  expect(rules.RACES).toHaveLength(15);
  expect(rules.BACKGROUNDS.length).toBeGreaterThanOrEqual(140);
  expect(rules.getClass("rogue")?.hpCoefBase).toBe(2.78);
  expect(rules.getClass("sorcerer")?.offMod).toBe(2);
  expect(rules.getRace("yuan_ti_pureblood")?.hpCoefBonus).toBe(0.03);
  expect(rules.getBackground("chef")?.hpCoefBonus).toBe(0.13);
});

test("las razas no aportan OFF permanente y DEF racial queda excepcional", () => {
  expect(rules.SETTINGS.raceOffModifier).toBe(0);
  for (const race of rules.RACES) expect(race.offMod).toBeUndefined();
  expect(rules.getRace("goliath")?.defMod).toBe(1);
  expect(rules.getRace("warforged")?.defMod).toBe(1);
  expect(rules.getRace("yuan_ti_pureblood")?.defMod).toBe(0);
});

test("Pícaro 15 / Hechicero 20 + Chef + Yuan-ti calcula el ejemplo acordado", () => {
  const result = rules.calculateBuild({
    level: 35,
    constitution: 14,
    classes: [
      { classId: "rogue", levels: 15 },
      { classId: "sorcerer", levels: 20 },
    ],
    backgroundId: "chef",
    raceId: "yuan_ti_pureblood",
    raceSubtypeId: "green_eyes",
  });

  expect(result.valid).toBe(true);
  closeTo(result.classHpCoef, 2.745714285714286);
  expect(result.classOffMod).toBe(2);
  expect(result.classDefMod).toBe(-2);
  expect(result.raceDefMod).toBe(0);
  closeTo(result.backgroundHpCoefBonus, 0.13);
  closeTo(result.raceHpCoefBonus, 0.03);
  closeTo(result.intrinsicHpCoef, 2.905714285714286);
  expect(result.hpBase).toBe(62);
  expect(result.offLevel).toBe(37);
  expect(result.defLevel).toBe(33);
  expect(result.hp).toBe(158);
});

test("multiclase usa promedio ponderado y redondeo simétrico para OFF / DEF", () => {
  const result = rules.calculateBuild({
    level: 35,
    constitution: 10,
    classes: [
      { classId: "barbarian", levels: 15 },
      { classId: "wizard", levels: 20 },
    ],
    backgroundId: "nest_heir",
    raceId: "kobold",
  });

  closeTo(result.classOffModRaw, 40 / 35);
  closeTo(result.classDefModRaw, -10 / 35);
  expect(result.classOffMod).toBe(1);
  expect(result.classDefMod).toBe(0);
  expect(rules.symmetricRound(-1.5)).toBe(-2);
  expect(rules.symmetricRound(1.5)).toBe(2);
});

test("el coeficiente natural respeta el cap 3.40", () => {
  const result = rules.calculateBuild({
    level: 100,
    constitution: 20,
    classes: [{ classId: "barbarian", levels: 100 }],
    backgroundId: "pequod_survivor",
    raceId: "warforged",
    raceSubtypeId: "juggernaut",
  });

  expect(result.intrinsicHpCoefUncapped).toBeGreaterThan(3.4);
  expect(result.intrinsicHpCoef).toBe(3.4);
  expect(result.raceDefMod).toBe(1);
});

test("un build parcial no reemplaza silenciosamente el modo legacy", () => {
  const result = rules.calculateBuild({
    level: 35,
    constitution: 14,
    classes: [{ classId: "rogue", levels: 15 }],
    backgroundId: "chef",
    raceId: "yuan_ti_pureblood",
  });

  expect(result.valid).toBe(false);
  expect(result.errors.join(" ")).toContain("deben sumar 35");
  expect(result.errors.join(" ")).toContain("subraza");
});

test("DM Studio persiste build derivado sin romper las rutas legacy", () => {
  for (const id of [
    "dm-player-build-race",
    "dm-player-build-subrace",
    "dm-player-build-background",
    "dm-player-build-class-total",
    "dm-player-build-class-coef",
  ]) expect(studio).toContain(`id=\"${id}\"`);

  expect(studio).toContain('const BUILD_RULES_SRC = "js/character-build-rules.js"');
  expect(studio).toContain('"characterBuild/classes": buildCalculation.classes');
  expect(studio).toContain('"characterBuild/backgroundId": buildCalculation.backgroundId');
  expect(studio).toContain('"characterBuild/raceId": buildCalculation.raceId');
  expect(studio).toContain('"classModifiers/offensiveLevel": offensive.classModifier');
  expect(studio).toContain('"classModifiers/defensiveLevel": defensive.classModifier');
  expect(studio).toContain('"raceModifiers/defensiveLevel": defensive.raceModifier');
  expect(studio).toContain('"combatStats/hp_base": hpBase');
  expect(studio).toContain('"combatStats/hp_coefficient": hpCoef');
  expect(studio).toContain('if (buildCalculation && !buildCalculation.valid)');
  expect(studio).toContain('"LEGACY / MANUAL"');
});
