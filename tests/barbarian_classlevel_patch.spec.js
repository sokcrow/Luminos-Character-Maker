const { test, expect } = require("@playwright/test");
const engine = require("../js/trait-engine.js");
const catalog = require("../js/trait-catalog-core.js");
const tray = require("../js/trait-player-tray.js");
const modifiers = require("../js/universal-modifier-engine.js");
const CombatEngine = require("../js/combatEngine.js");
const barbarianRuntime = require("../js/barbarian-class-runtime.js");
const shieldRuntime = require("../js/shield-duration-runtime.js");

barbarianRuntime.installCombatBridge(CombatEngine);
shieldRuntime.installCombatBridge(CombatEngine);

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
    hp: 200,
    maxHp: 200,
    sp: 0,
    shield: 0,
    statusEffects: {},
  };
}

test("Armorless Defense uses Barbarian ClassLevel for Shield and Constitution Mod for Defensive Level", () => {
  const trait = catalog.getDefinition("armorless_defense");
  const character = multiclassBarbarian(30, 70, 16);
  const variables = engine.buildVariables(character, {}, trait);
  const defensiveRule = trait.rules.find((rule) => rule.channel === "defensive_level");

  expect(trait.description).toContain("Gain +(1, Constitution Mod) Defensive Level.");
  expect(trait.description).toContain("Gain (Class Level)% Max HP as Shield for encounter");
  expect(variables.ClassLevel).toBe(30);
  expect(engine.evaluateFormula(defensiveRule.formula, variables)).toBe(3);
  expect(engine.evaluateFormula(trait.mechanics.encounterShieldPercentFormula, variables)).toBe(30);
  expect(engine.evaluateFormula(trait.mechanics.encounterShieldAmountFormula, variables)).toBe(60);
  expect(tray.resolveTraitDisplay(trait, { character })).toBeNull();

  const snapshot = modifiers.resolveCharacterSnapshot({
    unit: character,
    character,
    traits: [trait],
    context: "combat",
  });
  expect(snapshot.defensiveLevel).toBe(103);
});

test("Armorless Encounter Shield is separate from normal Guard Ephemeral Shield", () => {
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

  expect(character.shield).toBe(60);
  expect(shieldRuntime.shieldBreakdown(character)).toEqual({
    ephemeral: 0,
    encounter: 60,
    persistent: 0,
    total: 60,
  });

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

  expect(result.guardPower).toBe(3);
  expect(result.shieldType).toBe("ephemeral");
  expect(result.newShieldAmount).toBe(63);
  expect(shieldRuntime.shieldBreakdown(character)).toEqual({
    ephemeral: 3,
    encounter: 60,
    persistent: 0,
    total: 63,
  });

  CombatEngine.triggerPhase("[Round Start]", [character]);
  expect(character.shield).toBe(60);
  expect(shieldRuntime.shieldBreakdown(character).encounter).toBe(60);

  CombatEngine.triggerPhase("[Encounter End]", [character]);
  expect(character.shield).toBe(0);
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
