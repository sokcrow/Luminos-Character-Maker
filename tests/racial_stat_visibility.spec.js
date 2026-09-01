const { test, expect } = require("@playwright/test");
const path = require("node:path");

const baseRules = require("../js/character-build-rules.js");
const canonicalIntegration = require("../js/canonical-race-integration.js");
const existingIntegration = require("../js/existing-racial-stat-integration.js");
const rules = existingIntegration.installRules(canonicalIntegration.installRules(baseRules));
global.LuminousCharacterBuildRules = rules;
const racialRuntime = require("../js/racial-stat-runtime.js");

const ALL_10 = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, sabiduria: 10, carisma: 10 };

test("legacy Human 10 resolves to effective 11 without requiring a resave", () => {
  const legacy = { stats: { ...ALL_10 } };
  expect(racialRuntime.characterInput(legacy).raceId).toBe("human");
  expect(racialRuntime.effectiveStats(legacy)).toEqual({
    fuerza: 11, destreza: 11, constitucion: 11, inteligencia: 11, sabiduria: 11, carisma: 11,
  });
});

test("modern effective Stats are not double-counted", () => {
  const modern = {
    baseStats: { ...ALL_10 },
    stats: { fuerza: 11, destreza: 11, constitucion: 11, inteligencia: 11, sabiduria: 11, carisma: 11 },
    characterBuild: {
      raceId: "human",
      breakdown: { racialStatBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 } },
    },
  };
  expect(racialRuntime.abilityScore("str", modern)).toBe(11);
  expect(racialRuntime.effectiveStats(modern).fuerza).toBe(11);

  const transitional = {
    stats: { fuerza: 11, destreza: 11, constitucion: 11, inteligencia: 11, sabiduria: 11, carisma: 11 },
    characterBuild: {
      raceId: "human",
      breakdown: { racialStatBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 } },
    },
  };
  expect(racialRuntime.effectiveStats(transitional).fuerza).toBe(11);
});

test("runtime uses existing racial rules and Variant Human choices", () => {
  expect(racialRuntime.effectiveStats({
    stats: { ...ALL_10 },
    characterBuild: { raceId: "lizalin" },
  })).toMatchObject({ constitucion: 12, sabiduria: 11 });

  expect(racialRuntime.effectiveStats({
    stats: { ...ALL_10 },
    characterBuild: { raceId: "human", raceSubtypeId: "variant", racialStatChoices: ["str", "dex"] },
  })).toEqual({ fuerza: 11, destreza: 11, constitucion: 10, inteligencia: 10, sabiduria: 10, carisma: 10 });
});

test("player Stats HUD displays and rolls from the effective racial Score", async ({ page }) => {
  await page.setContent('<div id="stats-modal"><div id="stats-container"></div></div>');
  await page.evaluate(() => {
    window.datosJugador = {
      level: 1,
      stats: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, sabiduria: 10, carisma: 10 },
    };
  });

  const root = path.join(__dirname, "..");
  for (const file of ["character-build-rules.js", "canonical-race-integration.js", "existing-racial-stat-integration.js", "racial-stat-runtime.js", "player-stats-ability-bar.js"]) {
    await page.addScriptTag({ path: path.join(root, "js", file) });
  }

  await expect(page.locator("[data-stat-score]")).toHaveText("11");
  await expect(page.locator("[data-stat-modifier]")).toHaveText("+0");
  await expect(page.locator("[data-stat-save]")).toHaveText("+0");

  const humanRoll = await page.evaluate(() => window.LuminousPlayerStats.abilityRollMath(window.LuminousPlayerStats.ABILITIES[0], window.datosJugador));
  expect(humanRoll).toMatchObject({ score: 11, modifier: 0, base: 0 });

  await page.evaluate(() => { window.datosJugador.stats.fuerza = 11; });
  await expect(page.locator("[data-stat-score]")).toHaveText("12", { timeout: 2500 });
  await expect(page.locator("[data-stat-modifier]")).toHaveText("+1");
});

test("DM Studio keeps Base editable and shows Effective racial Score", async ({ page }) => {
  await page.setContent('<section id="dashboard-jugadores"><div class="panel-cyber"><div id="grid-jugadores"></div></div></section>');
  await page.evaluate(() => {
    window.calculateLevelData = () => ({ level: 1, xpPercent: 0, xpMissing: 0 });
    const players = {
      p1: {
        characterName: "Human Test",
        xp: 0,
        stats: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, sabiduria: 10, carisma: 10 },
        characterBuild: { raceId: "human", classes: [], backgroundId: "" },
      },
    };
    const db = {
      ref(path) {
        return {
          on(event, callback) {
            if (path === "campaña/jugadores" && event === "value") callback({ val: () => players });
          },
          update() { return Promise.resolve(); },
        };
      },
    };
    window.firebase = { apps: [{}], database: () => db };
  });

  const root = path.join(__dirname, "..");
  for (const file of ["character-build-rules.js", "canonical-race-integration.js", "existing-racial-stat-integration.js", "dm-player-dnd-studio.js", "dm-player-dnd-studio-hotfix.js"]) {
    await page.addScriptTag({ path: path.join(root, "js", file) });
  }

  await expect(page.locator("#dm-player-dnd-select option[value='p1']")).toHaveCount(1);
  await page.selectOption("#dm-player-dnd-select", "p1");
  await expect(page.locator("#dm-player-stat-str")).toHaveValue("10");
  await expect(page.locator('[data-racial-effective-stat="str"]')).toHaveText("BASE 10 → EFFECTIVE 11 · RACE +1", { timeout: 2500 });
  expect(await page.locator("#dm-player-stat-str").getAttribute("data-effective-score")).toBe("11");
});
