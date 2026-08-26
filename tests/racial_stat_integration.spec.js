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

test("pre-existing races now resolve their source-backed racial Stats too", () => {
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

test("old HP Coef/OFF/DEF race calculations are preserved while racial Stats are added", () => {
  const choiceByRace = { tiefling: ["int"], warforged: ["str"], felinae: ["str"], half_dragon: ["dex"], yuan_ti_pureblood: ["dex"] };
  const keys = ["hpBase", "classHpCoef", "backgroundHpCoefBonus", "raceHpCoefBonus", "intrinsicHpCoef", "classOffMod", "classDefMod", "raceDefMod", "offLevel", "defLevel", "hp"];
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

test("DOM save exposes effective racial Stats, persists base Stats, then restores the editor", async ({ page }) => {
  await page.setContent(`
    <div><select id="dm-player-build-race"><option value="human">Humano</option><option value="lizalin">Lizalin</option></select></div>
    <div id="dm-player-build-subrace-field"><select id="dm-player-build-subrace"><option value=""></option><option value="hill">Hill</option></select></div>
    <select id="dm-player-dnd-select"><option value="p1" selected>p1</option></select>
    ${Object.keys(ABILITY_KEYS).map((id) => `<div><input id="dm-player-stat-${id}" value="10"></div>`).join("")}
    <button id="dm-player-dnd-save" type="button">SAVE</button>
  `);
  await page.evaluate(() => {
    window.__racialWrites = [];
    window.firebase = { database() { return { ref(path) { return {
      update(updates) { window.__racialWrites.push({ path, updates: JSON.parse(JSON.stringify(updates)) }); return Promise.resolve(); },
      once() { return Promise.resolve({ val: () => ({}) }); },
    }; } }; } };
  });
  const root = path.join(__dirname, "..");
  for (const file of ["character-build-rules.js", "canonical-race-integration.js", "existing-racial-stat-integration.js", "racial-stat-preview-bridge.js"]) {
    await page.addScriptTag({ path: path.join(root, "js", file) });
  }
  await page.evaluate(() => { document.getElementById("dm-player-build-race").value = "lizalin"; });
  const diagnostic = await page.evaluate(() => {
    const base = { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, sabiduria: 10, carisma: 10 };
    const input = { raceId: "lizalin", raceSubtypeId: "", racialStatChoices: [] };
    return {
      canonical: Boolean(window.LuminousCharacterBuildRules?.__canonicalRaceIntegration),
      existing: Boolean(window.LuminousCharacterBuildRules?.__existingRacialStatIntegration),
      rule: Boolean(window.LuminousExistingRacialStatIntegration?.RACIAL_STAT_RULES?.lizalin),
      direct: window.LuminousExistingRacialStatIntegration?.resolveEffectiveStats(base, input),
      bind: window.LuminousExistingRacialStatIntegration?.bindDom?.(),
      previewBind: window.LuminousRacialStatPreviewBridge?.bind?.(),
    };
  });
  expect(diagnostic.canonical).toBe(true);
  expect(diagnostic.existing).toBe(true);
  expect(diagnostic.rule).toBe(true);
  expect(diagnostic.direct).toMatchObject({ constitucion: 12, sabiduria: 11 });
  await page.evaluate(() => {
    document.getElementById("dm-player-dnd-save").addEventListener("click", () => {
      window.__observedEffective = { con: Number(document.getElementById("dm-player-stat-con").value), wis: Number(document.getElementById("dm-player-stat-wis").value) };
    });
  });
  await page.click("#dm-player-dnd-save");
  await page.waitForTimeout(0);
  const result = await page.evaluate(() => ({
    observed: window.__observedEffective,
    restored: { con: Number(document.getElementById("dm-player-stat-con").value), wis: Number(document.getElementById("dm-player-stat-wis").value) },
    writes: window.__racialWrites,
  }));
  expect(result.observed).toEqual({ con: 12, wis: 11 });
  expect(result.restored).toEqual({ con: 10, wis: 10 });
  const lastWrite = result.writes.filter((entry) => entry.updates["characterBuild/breakdown/racialStatBonuses"]).at(-1);
  expect(lastWrite.updates).toMatchObject({
    "baseStats/constitucion": 10, "baseStats/sabiduria": 10,
    "characterBuild/breakdown/racialStatBonuses": { str: 0, dex: 0, con: 2, int: 0, wis: 1, cha: 0 },
  });
});

test("preview bridge exposes effective Stats during input without mutating the base field", async ({ page }) => {
  await page.setContent(`
    <div><select id="dm-player-build-race"><option value="lizalin" selected>Lizalin</option></select></div>
    <div id="dm-player-build-subrace-field"><select id="dm-player-build-subrace"><option value=""></option></select></div>
    ${Object.keys(ABILITY_KEYS).map((id) => `<div><input id="dm-player-stat-${id}" value="10"></div>`).join("")}
  `);
  const root = path.join(__dirname, "..");
  for (const file of ["character-build-rules.js", "canonical-race-integration.js", "existing-racial-stat-integration.js", "racial-stat-preview-bridge.js"]) {
    await page.addScriptTag({ path: path.join(root, "js", file) });
  }
  const diagnostic = await page.evaluate(() => {
    const base = { fuerza: 10, destreza: 10, constitucion: 14, inteligencia: 10, sabiduria: 10, carisma: 10 };
    const input = { raceId: "lizalin", raceSubtypeId: "", racialStatChoices: [] };
    return {
      direct: window.LuminousRacialStatPreviewBridge?.effectiveStats(base, input),
      bind: window.LuminousRacialStatPreviewBridge?.bind?.(),
    };
  });
  expect(diagnostic.direct).toMatchObject({ constitucion: 16, sabiduria: 11 });
  await page.evaluate(() => {
    document.getElementById("dm-player-stat-con").addEventListener("input", () => { window.__previewObserved = Number(document.getElementById("dm-player-stat-con").value); });
  });
  await page.locator("#dm-player-stat-con").fill("14");
  await page.waitForTimeout(0);
  expect(await page.evaluate(() => window.__previewObserved)).toBe(16);
  expect(await page.locator("#dm-player-stat-con").inputValue()).toBe("14");
});