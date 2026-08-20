const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const rules = require("../js/character-build-rules.js");
const studio = read("js/dm-player-dnd-studio.js");
const playerStatsSource = read("js/player-stats-ability-bar.js");
const utils = read("js/utils.js");

function closeTo(actual, expected, precision = 6) {
  expect(Math.abs(actual - expected)).toBeLessThan(10 ** -precision);
}

function loadPlayerStatsApi() {
  const document = {
    readyState: "loading",
    addEventListener() {},
  };
  const window = {
    document,
    setInterval() { return 0; },
  };
  window.window = window;
  vm.runInNewContext(playerStatsSource, { window, console });
  return window.LuminousPlayerStats;
}

test("catálogos contienen las 13 clases, 16 razas y trasfondos Project Moon", () => {
  expect(rules.CLASSES).toHaveLength(13);
  expect(rules.RACES).toHaveLength(16);
  expect(rules.BACKGROUNDS.length).toBeGreaterThanOrEqual(140);
  expect(rules.SETTINGS.defaultRaceId).toBe("human");
  expect(rules.RACES[0].id).toBe("human");
  expect(rules.getRace("human")).toMatchObject({ name: "Humano", hpCoefBonus: 0, defMod: 0, isDefault: true });
  expect(rules.getClass("rogue")?.hpCoefBase).toBe(2.78);
  expect(rules.getClass("sorcerer")?.offMod).toBe(2);
  expect(rules.getRace("yuan_ti_pureblood")?.hpCoefBonus).toBe(0.03);
  expect(rules.getBackground("chef")?.hpCoefBonus).toBe(0.13);
});

test("las razas no aportan OFF permanente y DEF racial queda excepcional", () => {
  expect(rules.SETTINGS.raceOffModifier).toBe(0);
  for (const race of rules.RACES) expect(race.offMod).toBeUndefined();
  expect(rules.getRace("human")?.defMod).toBe(0);
  expect(rules.getRace("goliath")?.defMod).toBe(1);
  expect(rules.getRace("warforged")?.defMod).toBe(1);
  expect(rules.getRace("yuan_ti_pureblood")?.defMod).toBe(0);
});

test("Humano es el baseline neutral y no altera HP Coef, OFF ni DEF", () => {
  const result = rules.calculateBuild({
    level: 10,
    constitution: 10,
    classes: [{ classId: "fighter", levels: 10 }],
    backgroundId: "chef",
    raceId: "human",
  });

  expect(result.valid).toBe(true);
  expect(result.raceId).toBe("human");
  expect(result.raceSubtypeId).toBeNull();
  expect(result.raceHpCoefBonus).toBe(0);
  expect(result.raceDefMod).toBe(0);
  closeTo(result.intrinsicHpCoef, 2.99);
  expect(result.offLevel).toBe(11);
  expect(result.defLevel).toBe(11);
  expect(result.hpBase).toBe(20);
  expect(result.hp).toBe(53);
});

test("subrazas se suman dentro de la capa racial sin aportar OFF", () => {
  const warforged = rules.calculateBuild({
    level: 10,
    constitution: 10,
    classes: [{ classId: "fighter", levels: 10 }],
    backgroundId: "chef",
    raceId: "warforged",
    raceSubtypeId: "juggernaut",
  });
  const felinae = rules.calculateBuild({
    level: 10,
    constitution: 10,
    classes: [{ classId: "fighter", levels: 10 }],
    backgroundId: "chef",
    raceId: "felinae",
    raceSubtypeId: "large",
  });

  expect(warforged.valid).toBe(true);
  closeTo(warforged.raceHpCoefBonus, 0.16);
  expect(warforged.raceDefMod).toBe(1);
  expect(warforged.classOffMod).toBe(1);
  expect(warforged.offLevel).toBe(11);

  expect(felinae.valid).toBe(true);
  closeTo(felinae.raceHpCoefBonus, 0.06);
  expect(felinae.raceDefMod).toBe(0);
  expect(felinae.offLevel).toBe(11);
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
  expect(Math.abs(result.classDefMod)).toBe(0);
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

test("DM Studio usa Humano como default visual sin auto-migrar legacy", () => {
  expect(studio).toContain('const defaultRaceId = api.SETTINGS.defaultRaceId');
  expect(studio).toContain('" · DEFAULT"');
  expect(studio).toContain('raceId !== api?.SETTINGS?.defaultRaceId');
  expect(studio).toContain('field("dm-player-build-race").value = api?.SETTINGS?.defaultRaceId || ""');
  expect(studio).toContain('build.raceId || api.SETTINGS.defaultRaceId || ""');
  expect(studio).toContain('Humano es el default visual');
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
  expect(studio).toContain('"characterBuild/raceSubtypeId": buildCalculation.raceSubtypeId');
  expect(studio).toContain('"classModifiers/offensiveLevel": offensive.classModifier');
  expect(studio).toContain('"classModifiers/defensiveLevel": defensive.classModifier');
  expect(studio).toContain('"raceModifiers/defensiveLevel": defensive.raceModifier');
  expect(studio).toContain('"combatStats/hp_base": hpBase');
  expect(studio).toContain('"combatStats/hp_coefficient": hpCoef');
  expect(studio).toContain('if (buildCalculation && !buildCalculation.valid)');
  expect(studio).toContain('"LEGACY / MANUAL"');
  expect(studio).toContain('RAZA + SUBRAZA');
});

test("Jugador consume DEF racial sin contaminar OFF", () => {
  const playerStats = loadPlayerStatsApi();
  expect(playerStats).toBeTruthy();

  const player = {
    level: 35,
    combatLevels: {
      offensive: { classModifier: 2, raceModifier: 9, dmModifier: 0, itemModifier: 0 },
      defensive: { classModifier: -2, raceModifier: 1, dmModifier: 0, itemModifier: 0 },
    },
  };

  const offensive = playerStats.combatLevelBreakdown("offensive", player);
  const defensive = playerStats.combatLevelBreakdown("defensive", player);

  expect(offensive.raceModifier).toBe(0);
  expect(offensive.total).toBe(37);
  expect(defensive.raceModifier).toBe(1);
  expect(defensive.total).toBe(34);
});

test("Jugador mantiene fallback legacy para DEF racial y HP almacenado", () => {
  const playerStats = loadPlayerStatsApi();
  const defensive = playerStats.combatLevelBreakdown("defensive", {
    level: 35,
    classModifiers: { defensiveLevel: -2 },
    raceModifiers: { defensiveLevel: 1 },
    combatStats: { def_lvl_mod: 0, hp_max: 161 },
  });

  expect(defensive.classModifier).toBe(-2);
  expect(defensive.raceModifier).toBe(1);
  expect(defensive.total).toBe(34);
  expect(playerStatsSource).toContain('data?.combatStats?.hp_max ?? data?.hp_max');
});

test("el editor DM no se inyecta en la hoja del Jugador", () => {
  const start = utils.indexOf("function ensureDmPlayerDndStudioAssets");
  const end = utils.indexOf("function ensurePlayerSplashFramingAssets", start);
  const block = utils.slice(start, end);
  expect(block).toContain("#dashboard-jugadores");
  expect(block).toContain("js/dm-player-dnd-studio.js");
  expect(block).not.toContain(".sheet-phone-wrapper");
});