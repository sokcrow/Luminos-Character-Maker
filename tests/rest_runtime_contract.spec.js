const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const statusEngine = read("js/status-engine.js");
const restEngine = read("js/rest-engine.js");
const restRuntime = read("js/rest-runtime-integration.js");
const docs = read("docs/rest-system.md");

test("Status Engine bootstrap carga Rest Engine e integración de runtime", () => {
  expect(statusEngine).toContain("rest-engine-script");
  expect(statusEngine).toContain("js/rest-engine.js");
  expect(statusEngine).toContain("rest-runtime-integration-script");
  expect(statusEngine).toContain("js/rest-runtime-integration.js");
});

test("Rest Engine usa hpPer5 de Character Build Rules como Class Base HP", () => {
  expect(restEngine).toContain("definition?.hpPer5");
  expect(restEngine).toContain("Math.floor(getClassLevel(character, classId) / RECOVER_LEVEL_INTERVAL)");
  expect(restEngine).toContain("RECOVER_FLAT_BONUS + (classBaseHp * count)");
});

test("Augments tienen cap global 5% y sólo se aplican en short_rest", () => {
  expect(restEngine).toContain("SHORT_REST_AUGMENT_MAX_HP_PERCENT_CAP = 5");
  expect(restEngine).toContain('context === "short_rest"');
  expect(restEngine).toContain("mechanics.shortRestRecoveryPercent");
});

test("Runtime conecta Traits de Recover inmediato y bloqueo multi-Long-Rest", () => {
  expect(restRuntime).toContain("spendRecoverSlot");
  expect(restRuntime).toContain("performRecoverImmediately");
  expect(restRuntime).toContain("blockUsedRecoverSlotLongRests");
  expect(restRuntime).toContain('context: "combat"');
  expect(restRuntime).toContain("includeAugments: false");
});

test("Rest Runtime expone avance de tiempo sin imponer cooldown ni calendario propio", () => {
  expect(restRuntime).toContain("luminous:world-time-advance-requested");
  expect(restRuntime).toContain("worldHoursAdvanced");
  expect(docs).toContain("no daily cooldown");
  expect(docs).toContain("world time");
});
