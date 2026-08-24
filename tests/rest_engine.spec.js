const { test, expect } = require("@playwright/test");

const traitEngine = require("../js/trait-engine.js");
const restEngine = require("../js/rest-engine.js");
const catalog = require("../js/archetype-trait-catalog.js");

function character(levels = { barbarian: 20 }, hp = 500, currentHp = 100) {
  return {
    characterBuild: {
      classes: Object.entries(levels).map(([classId, level]) => ({ classId, level })),
      calculatedAtLevel: Object.values(levels).reduce((sum, level) => sum + level, 0),
    },
    combatStats: { hp_max: hp, hp_actual: currentHp },
  };
}

test("Recover Slots escalan por Class Level cada 5 niveles y conservan pools separados", () => {
  const unit = character({ barbarian: 20, wizard: 10 });
  expect(restEngine.recoverPool(unit, "barbarian")).toMatchObject({ classLevel: 20, classBaseHp: 12, maximum: 4, available: 4 });
  expect(restEngine.recoverPool(unit, "wizard")).toMatchObject({ classLevel: 10, classBaseHp: 6, maximum: 2, available: 2 });
});

test("Recover usa HP plano 5 + Class Base HP por slot", () => {
  const unit = character({ barbarian: 20 });
  const result = restEngine.performRecover(unit, "barbarian", 3, { context: "short_rest" });
  expect(result.success).toBe(true);
  expect(result.flatBonus).toBe(5);
  expect(result.classBaseHp).toBe(12);
  expect(result.calculatedHp).toBe(41);
  expect(unit.combatStats.hp_actual).toBe(141);
  expect(restEngine.recoverPool(unit, "barbarian").available).toBe(1);
});

test("el +5 se aplica por acción Recover, no por slot", () => {
  const split = character({ barbarian: 20 });
  const combined = character({ barbarian: 20 });
  restEngine.performRecover(split, "barbarian", 1, { context: "short_rest" });
  restEngine.performRecover(split, "barbarian", 1, { context: "short_rest" });
  restEngine.performRecover(combined, "barbarian", 2, { context: "short_rest" });
  expect(split.combatStats.hp_actual).toBe(134);
  expect(combined.combatStats.hp_actual).toBe(129);
});

test("sólo Augments de Short Rest aportan Max HP y su suma tiene cap global de 5%", () => {
  const unit = character({ barbarian: 20 });
  unit.augmentations = [
    { id: "augment_a", mechanics: { shortRestRecoveryPercent: 3 } },
    { id: "augment_b", mechanics: { shortRestRecoveryPercent: 4 } },
  ];
  const result = restEngine.performRecover(unit, "barbarian", 1, { context: "short_rest" });
  expect(result.augmentPercentRaw).toBe(7);
  expect(result.augmentPercentApplied).toBe(5);
  expect(result.augmentHp).toBe(25);
  expect(result.calculatedHp).toBe(42);

  const combatRecover = character({ barbarian: 20 });
  combatRecover.augmentations = unit.augmentations;
  const combatResult = restEngine.performRecover(combatRecover, "barbarian", 1, { context: "combat" });
  expect(combatResult.augmentPercentApplied).toBe(0);
  expect(combatResult.calculatedHp).toBe(17);
});

test("Short Rest dura 1-2 horas, no devuelve Recover Slots y puede ejecutar múltiples Recover", () => {
  const unit = character({ barbarian: 20, wizard: 10 });
  const result = restEngine.performShortRest(unit, {
    hours: 2,
    recovers: [
      { classId: "barbarian", slots: 1 },
      { classId: "wizard", slots: 1 },
    ],
  });
  expect(result.success).toBe(true);
  expect(result.worldHoursAdvanced).toBe(2);
  expect(result.recovers).toHaveLength(2);
  expect(restEngine.recoverPool(unit, "barbarian").available).toBe(3);
  expect(restEngine.recoverPool(unit, "wizard").available).toBe(1);

  const secondShortRest = restEngine.performShortRest(unit, { hours: 1 });
  expect(secondShortRest.success).toBe(true);
  expect(restEngine.recoverPool(unit, "barbarian").available).toBe(3);
});

test("Short Rest preflight evita gasto parcial cuando se solicitan más slots de los disponibles", () => {
  const unit = character({ barbarian: 5 });
  const result = restEngine.performShortRest(unit, {
    hours: 1,
    recovers: [
      { classId: "barbarian", slots: 1 },
      { classId: "barbarian", slots: 1 },
    ],
  });
  expect(result.success).toBe(false);
  expect(restEngine.recoverPool(unit, "barbarian").available).toBe(1);
  expect(unit.combatStats.hp_actual).toBe(100);
});

test("Short Rest sólo recupera usos de Traits que lo declaran explícitamente", () => {
  const unit = character({ barbarian: 20 });
  const state = traitEngine.createState();
  state.usages.partial = { used: 3, reset: "never" };
  state.usages.all_short = { used: 2, reset: "short_rest" };
  state.usages.long_only = { used: 4, reset: "never" };
  const traits = [
    { id: "partial", activation: { type: "manual", actionCost: "none", uses: { max: 3, recoverOnShortRest: 1 } }, contexts: ["any"], effects: [], rules: [] },
    { id: "all_short", activation: { type: "manual", actionCost: "none", uses: { max: 2, reset: "short_rest" } }, contexts: ["any"], effects: [], rules: [] },
    { id: "long_only", activation: { type: "manual", actionCost: "none", uses: { max: 4 } }, contexts: ["any"], effects: [], rules: [] },
  ];
  const result = restEngine.performShortRest(unit, { hours: 1, traits, traitState: state });
  expect(result.success).toBe(true);
  expect(state.usages.partial.used).toBe(2);
  expect(state.usages.all_short.used).toBe(0);
  expect(state.usages.long_only.used).toBe(4);
});

test("Long Rest dura 6-8 horas, cura Full HP, devuelve Recover Slots y todos los usos de Traits", () => {
  const unit = character({ barbarian: 20 }, 500, 25);
  restEngine.performRecover(unit, "barbarian", 3, { context: "short_rest" });
  unit.combatStats.hp_actual = 25;
  const state = traitEngine.createState();
  state.usages.a = { used: 2, reset: "never" };
  state.usages.b = { used: 1, reset: "encounter" };
  const result = restEngine.performLongRest(unit, { hours: 7, traitState: state, traits: [] });
  expect(result.success).toBe(true);
  expect(result.worldHoursAdvanced).toBe(7);
  expect(unit.combatStats.hp_actual).toBe(500);
  expect(restEngine.recoverPool(unit, "barbarian").available).toBe(4);
  expect(state.usages.a.used).toBe(0);
  expect(state.usages.b.used).toBe(0);
});

test("Long Rest no tiene cooldown: el límite narrativo es el tiempo mundial consumido", () => {
  const unit = character({ barbarian: 20 }, 500, 1);
  const first = restEngine.performLongRest(unit, { hours: 6 });
  unit.combatStats.hp_actual = 1;
  const second = restEngine.performLongRest(unit, { hours: 8 });
  expect(first.success).toBe(true);
  expect(second.success).toBe(true);
  expect(first.worldHoursAdvanced).toBe(6);
  expect(second.worldHoursAdvanced).toBe(8);
  expect(unit.combatStats.hp_actual).toBe(500);
});

test("Recover Slot bloqueado por Improved Demonic Resistance requiere 2 Long Rests completos", () => {
  const unit = character({ barbarian: 50 });
  const recover = restEngine.performRecover(unit, "barbarian", 1, {
    context: "combat",
    includeAugments: false,
    blockLongRests: 2,
    sourceTraitId: "devil_lineage_improved_demonic_resistance",
  });
  expect(recover.success).toBe(true);
  expect(restEngine.recoverPool(unit, "barbarian")).toMatchObject({ maximum: 10, available: 9, blocked: 1 });

  restEngine.performLongRest(unit, { hours: 6 });
  expect(restEngine.recoverPool(unit, "barbarian").blockedSlots[0].remainingLongRests).toBe(1);
  expect(restEngine.recoverPool(unit, "barbarian").available).toBe(9);

  restEngine.performLongRest(unit, { hours: 6 });
  expect(restEngine.recoverPool(unit, "barbarian")).toMatchObject({ maximum: 10, available: 10, blocked: 0 });
});

test("Improved Demonic Resistance usa el Recover Engine real y se bloquea sin slots", () => {
  const restRuntime = require("../js/rest-runtime-integration.js");
  restRuntime.install();
  const integratedTraitEngine = global.LuminousTraitEngine;
  const trait = catalog.allDefinitions().devil_lineage_improved_demonic_resistance;
  const unit = character({ barbarian: 50 }, 200, 50);
  const combatSelf = { hp: 50, maxHp: 200, characterBuild: unit.characterBuild };
  global.datosJugador = unit;
  const state = integratedTraitEngine.createState();
  const result = integratedTraitEngine.activateTrait(trait, { context: "combat", character: unit, self: combatSelf }, state);
  expect(result.available).toBe(true);
  expect(result.restRecover).toMatchObject({ calculatedHp: 17, slotsUsed: 1, blockedForLongRests: 2 });
  expect(combatSelf.hp).toBe(67);
  expect(restEngine.recoverPool(unit, "barbarian").blocked).toBe(1);

  const lowLevel = character({ barbarian: 4 }, 100, 50);
  global.datosJugador = lowLevel;
  const blocked = integratedTraitEngine.canActivateTrait(trait, { context: "combat", character: lowLevel, self: lowLevel }, integratedTraitEngine.createState());
  expect(blocked.available).toBe(false);
  expect(blocked.reasons.join(" ")).toContain("0 Recover Slot");
  delete global.datosJugador;
});

test("duraciones fuera de rango son rechazadas", () => {
  expect(restEngine.validateRestHours("short_rest", 0.5).valid).toBe(false);
  expect(restEngine.validateRestHours("short_rest", 1).valid).toBe(true);
  expect(restEngine.validateRestHours("short_rest", 2).valid).toBe(true);
  expect(restEngine.validateRestHours("short_rest", 3).valid).toBe(false);
  expect(restEngine.validateRestHours("long_rest", 5).valid).toBe(false);
  expect(restEngine.validateRestHours("long_rest", 6).valid).toBe(true);
  expect(restEngine.validateRestHours("long_rest", 8).valid).toBe(true);
  expect(restEngine.validateRestHours("long_rest", 9).valid).toBe(false);
});
