const { test, expect } = require("@playwright/test");
const engine = require("../js/trait-engine.js");
const catalog = require("../js/trait-catalog-core.js");
const tray = require("../js/trait-player-tray.js");
const CombatEngine = require("../js/combatEngine.js");
const barbarianRuntime = require("../js/barbarian-class-runtime.js");

barbarianRuntime.installCombatBridge(CombatEngine);

function multiclassBarbarian(barbarianLevel, otherLevel = 0, constitution = 16) {
  return {
    id: "barbarian_classlevel_patch_test",
    level: barbarianLevel + otherLevel,
    classes: [
      { classId: "barbarian", levels: barbarianLevel },
      ...(otherLevel ? [{ classId: "wizard", levels: otherLevel }] : []),
    ],
    stats: {
      fuerza: 18,
      constitucion: constitution,
      destreza: 14,
      inteligencia: 18,
      sabiduria: 12,
      carisma: 10,
    },
    combatStats: {
      offensiveLevel: barbarianLevel + otherLevel,
      defensiveLevel: barbarianLevel + otherLevel,
    },
    sp: 0,
    shield: 0,
  };
}

test("Armorless Defense display resolves Barbarian ClassLevel instead of Character Level", () => {
  const trait = catalog.getDefinition("armorless_defense");
  const character = multiclassBarbarian(30, 70, 16);
  const resolved = tray.resolveTraitDisplay(trait, { character });

  expect(resolved.values.guardBonus.display).toBe("33 Guard");
  expect(resolved.values.shieldBonus.display).toBe("+15%");
  expect(resolved.values.guardBonus.breakdown).toEqual(expect.arrayContaining([
    expect.objectContaining({ label: "CON Mod", display: "+3" }),
    expect.objectContaining({ label: "Class Level", display: "30" }),
  ]));
  expect(resolved.values.shieldBonus.breakdown).toEqual(expect.arrayContaining([
    expect.objectContaining({ label: "Class Level", display: "30" }),
  ]));
});

test("Armorless encounter state increases Guard Power and Guard Shield without using other class levels", () => {
  const trait = catalog.getDefinition("armorless_defense");
  const character = multiclassBarbarian(30, 70, 16);
  const state = engine.createState();

  engine.dispatchCombatEvent("encounter_start", {
    character,
    self: character,
    traits: [trait],
    state,
    equipment: { armorEquipped: false },
  });

  expect(character.guard).toMatchObject({ powerBonus: 33, shieldPercent: 15 });

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

  // Native Guard uses CON Mod (+3) as base. Armorless adds 33 Guard, for 36 total.
  expect(result.guardPower).toBe(36);
  expect(result.shieldPercentBonus).toBe(15);
  expect(result.shieldBonus).toBeCloseTo(5.4, 6);
  expect(result.newShieldAmount).toBeCloseTo(41.4, 6);
  expect(character.shield).toBeCloseTo(41.4, 6);
});

test("Brutal Critical and Unstoppable Rage previews stay tied to Barbarian ClassLevel", () => {
  const character = multiclassBarbarian(55, 45, 18);

  const brutal = tray.resolveTraitDisplay(catalog.getDefinition("brutal_critical"), { character });
  const unstoppable = tray.resolveTraitDisplay(catalog.getDefinition("unstoppable_rage"), { character });

  expect(brutal.values.critDamage.display).toBe("+27%");
  expect(unstoppable.values.recovery.display).toBe("18%");
  expect(brutal.values.critDamage.breakdown).toEqual(expect.arrayContaining([
    expect.objectContaining({ label: "Class Level", display: "55" }),
  ]));
  expect(unstoppable.values.recovery.breakdown).toEqual(expect.arrayContaining([
    expect.objectContaining({ label: "Class Level", display: "55" }),
  ]));
});
