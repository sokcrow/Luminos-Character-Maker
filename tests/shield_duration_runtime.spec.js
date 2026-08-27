const { test, expect } = require("@playwright/test");
const CombatEngine = require("../js/combatEngine.js");
const shieldRuntime = require("../js/shield-duration-runtime.js");

shieldRuntime.installCombatBridge(CombatEngine);

function unit(overrides = {}) {
  return {
    id: "shield_duration_test",
    hp: 100,
    maxHp: 100,
    sp: 0,
    shield: 0,
    stats: { constitucion: 14 },
    statusEffects: {},
    ...overrides,
  };
}

test("Guard Shield is Ephemeral and is lost at the next Round Start", () => {
  const character = unit();
  const guardSkill = {
    type: "Guard",
    isDefense: true,
    defenseSubtype: "Guard",
    basePower: 0,
    coinPower: 0,
    coinAmount: 0,
    coins: [],
  };

  const result = CombatEngine.resolveGuard(character, guardSkill);
  expect(result.guardPower).toBe(2);
  expect(result.shieldType).toBe("ephemeral");
  expect(shieldRuntime.shieldBreakdown(character)).toEqual({
    ephemeral: 2,
    encounter: 0,
    persistent: 0,
    total: 2,
  });

  CombatEngine.triggerPhase("[Round Start]", [character]);
  expect(character.shield).toBe(0);
});

test("Encounter Shield survives rounds and is lost at Encounter End", () => {
  const character = unit();
  shieldRuntime.gainShield(character, 25, "encounter");

  CombatEngine.triggerPhase("[Round Start]", [character]);
  expect(character.shield).toBe(25);
  expect(shieldRuntime.shieldBreakdown(character).encounter).toBe(25);

  CombatEngine.triggerPhase("[Encounter End]", [character]);
  expect(character.shield).toBe(0);
  expect(shieldRuntime.shieldBreakdown(character).encounter).toBe(0);
});

test("Persistent Shield survives Round Start and Encounter End until consumed", () => {
  const character = unit();
  shieldRuntime.gainShield(character, 30, "persistent");

  CombatEngine.triggerPhase("[Round Start]", [character]);
  CombatEngine.triggerPhase("[Encounter End]", [character]);
  expect(character.shield).toBe(30);
  expect(shieldRuntime.shieldBreakdown(character).persistent).toBe(30);
});

test("Shield damage consumption uses Ephemeral then Encounter then Persistent", () => {
  const character = unit();
  shieldRuntime.gainShield(character, 5, "ephemeral");
  shieldRuntime.gainShield(character, 7, "encounter");
  shieldRuntime.gainShield(character, 11, "persistent");

  const result = CombatEngine.applyDamage(character, 9, "directo", false, null);
  expect(result.hp).toBe(100);
  expect(result.shield).toBe(14);
  expect(shieldRuntime.shieldBreakdown(character)).toEqual({
    ephemeral: 0,
    encounter: 3,
    persistent: 11,
    total: 14,
  });
});

test("legacy untyped Shield is preserved as Persistent Shield", () => {
  const character = unit({ shield: 12 });
  expect(shieldRuntime.shieldBreakdown(character)).toEqual({
    ephemeral: 0,
    encounter: 0,
    persistent: 12,
    total: 12,
  });

  CombatEngine.triggerPhase("[Encounter End]", [character]);
  expect(character.shield).toBe(12);
});
