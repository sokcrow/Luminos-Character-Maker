const { test, expect } = require("@playwright/test");

global.STATUS_REGISTRY = {
  haste: {
    name: "Haste",
    type: "positive",
    mode: "single",
    icon: null,
    rules: [{ trigger: "passive", cond_input: 1, cond_type: "count", operation: "add", aff_input: 1, affectation: "speed", decay: "none" }],
  },
};

const modifiers = require("../js/universal-modifier-engine.js");
const statusEngine = require("../js/status-engine.js");
const speedRuntime = require("../js/universal-speed-runtime.js");
const catalog = require("../js/trait-catalog-core.js");

function unit(speed = 2) {
  return {
    id: "speed_test_barbarian",
    level: 100,
    classes: [{ classId: "barbarian", levels: 100 }],
    stats: { fuerza: 20, constitucion: 18 },
    combatStats: { offensiveLevel: 90, defensiveLevel: 60, minSpeed: 2, maxSpeed: 6 },
    speed,
  };
}

test("Fast Movement raises the effective combat speed floor without mutating the rolled base speed", () => {
  const character = unit(2);
  const resolved = speedRuntime.effectiveSpeed(character, {
    modifierEngine: modifiers,
    character,
    traits: [catalog.getDefinition("fast_movement")],
  });
  expect(resolved).toBe(3);
  expect(character.speed).toBe(2);
});

test("Haste and Fast Movement share the same resolved combat speed path", () => {
  const character = unit(2);
  statusEngine.applyStatus(character, "haste", { count: 5 });
  const resolved = speedRuntime.effectiveSpeed(character, {
    modifierEngine: modifiers,
    character,
    traits: [catalog.getDefinition("fast_movement")],
  });
  expect(resolved).toBe(8);
  expect(character.speed).toBe(2);
});

test("universal speed keeps rolls already above the raised minimum unchanged", () => {
  const character = unit(5);
  const resolved = speedRuntime.effectiveSpeed(character, {
    modifierEngine: modifiers,
    character,
    traits: [catalog.getDefinition("fast_movement")],
  });
  expect(resolved).toBe(5);
});

test("withResolvedSpeeds exposes resolved values only during the consumer calculation", () => {
  const slow = unit(2);
  const fast = unit(5);
  slow.traitDefinitions = [catalog.getDefinition("fast_movement")];
  fast.traitDefinitions = [];

  const seen = speedRuntime.withResolvedSpeeds([slow, fast], () => ({ slow: slow.speed, fast: fast.speed }));
  expect(seen).toEqual({ slow: 3, fast: 5 });
  expect(slow.speed).toBe(2);
  expect(fast.speed).toBe(5);
});
