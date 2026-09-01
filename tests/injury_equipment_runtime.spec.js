const { test, expect } = require("@playwright/test");

const injuries = require("../js/injury-engine.js");
const runtime = require("../js/injury-equipment-runtime.js");

test("Severe Injury also reduces player combatStats.hp_max while Light and Moderate do not", () => {
  const actor = { id: "hp_sheet", maxHp: 200, hp: 200, combatStats: { hp_max: 200, hp_actual: 200 }, statusEffects: {} };
  injuries.gainInjury(actor, "combat_bruising", { persist: false });
  runtime.syncCombatStatsMaxHp(actor);
  expect(actor.combatStats.hp_max).toBe(200);

  injuries.gainInjury(actor, "accumulated_trauma", { persist: false });
  runtime.syncCombatStatsMaxHp(actor);
  expect(actor.combatStats.hp_max).toBe(200);

  const severe = injuries.gainInjury(actor, "severe_trauma", { persist: false });
  runtime.syncCombatStatsMaxHp(actor);
  expect(actor.combatStats.hp_max).toBe(190);
  expect(actor.combatStats.hp_actual).toBe(190);

  injuries.removeInjury(actor, severe.injury.instanceId, { persist: false });
  runtime.syncCombatStatsMaxHp(actor);
  expect(actor.combatStats.hp_max).toBe(200);
  expect(actor.combatStats.hp_actual).toBe(190);
});

test("Missing Eye has no universal Perception penalty after monocular compensation", () => {
  const actor = { id: "one_eye", maxHp: 100, hp: 100, statusEffects: {} };
  injuries.gainInjury(actor, { ...injuries.definition("missing_eye"), affectedParts: ["left_eye"] }, { persist: false });
  expect(injuries.checkPenalty(actor, "DEX", "Perception")).toBe(-2);
  expect(runtime.missingEyePerceptionCompensation(actor, "Perception")).toBe(2);
});

test("Loot bridge clears the original Firebase-shaped equipment object instead of only its validation copy", () => {
  const actor = {
    equipment: {
      sword_key: { id: "sword", equipped: true, equipped_slot: "arma_principal", equipment: { kind: "weapon" } },
    },
  };
  global.LuminousCombatLootPool = [{ key: "sword_key", id: "sword", equipped: false }];
  const changed = runtime.syncLootDropsBackToSource(actor);
  expect(changed).toBe(1);
  expect(actor.equipment.sword_key.equipped).toBe(false);
  expect(actor.equipment.sword_key.equipped_slot).toBeNull();
});

test("Firebase combatant transition from populated to empty finalizes tracked Encounter", () => {
  const actor = { id: "finalize_me", maxHp: 100, hp: 40, statusEffects: {} };
  injuries.beginEncounter([actor]);
  injuries.markNaturalStagger(actor);
  runtime.trackUnit(actor);
  const result = runtime.finalizeTrackedEncounter();
  expect(result).toHaveLength(1);
  expect(injuries.activeInjuries(actor).some((injury) => injury.severity === "light")).toBe(true);
  expect(actor.injuryState.encounter.active).toBe(false);
});
