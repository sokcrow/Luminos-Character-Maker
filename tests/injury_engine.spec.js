const { test, expect } = require("@playwright/test");

const equipment = require("../js/anatomy-equipment-engine.js");
const injuries = require("../js/injury-engine.js");

function unit(maxHp = 200) {
  return {
    id: `unit_${Math.random()}`,
    hp: maxHp,
    maxHp,
    statusEffects: {},
    dndStats: {
      STR: 16,
      DEX: 18,
      CON: 14,
      proficiencies: [],
      proficiencyBonus: 2,
    },
  };
}

test("Light and Moderate Injuries do not reduce Max HP", () => {
  const actor = unit(200);
  injuries.gainInjury(actor, "combat_bruising", { persist: false });
  injuries.gainInjury(actor, "accumulated_trauma", { persist: false });
  expect(actor.maxHp).toBe(200);
  expect(actor.injuryMaxHpPenaltyPct).toBe(0);
});

test("each Severe Injury reduces Max HP by 5% and the global injury cap is 20%", () => {
  const actor = unit(200);
  const refs = [];
  for (let index = 0; index < 5; index += 1) {
    refs.push(injuries.gainInjury(actor, { id: `severe_${index}`, name: `Severe ${index}`, severity: "severe", recoveryHours: 100 }, { persist: false }).injury.instanceId);
  }
  expect(actor.maxHp).toBe(160);
  expect(actor.injuryMaxHpPenaltyPct).toBe(0.20);

  injuries.removeInjury(actor, refs[0], { persist: false });
  expect(actor.maxHp).toBe(160);
  injuries.removeInjury(actor, refs[1], { persist: false });
  expect(actor.maxHp).toBe(170);
});

test("three distinct Downs before reset generate one Moderate Injury and keep overflow", () => {
  const actor = unit();
  const first = injuries.handleDown(actor);
  expect(first.downCount).toBe(1);
  expect(injuries.handleDown(actor).counted).toBe(false);

  injuries.clearCurrentDown(actor);
  injuries.handleDown(actor);
  expect(actor.injuryState.downCount).toBe(2);
  injuries.clearCurrentDown(actor);
  const third = injuries.handleDown(actor);
  expect(third.downCount).toBe(0);
  expect(third.moderate.gained).toBe(true);
  expect(injuries.activeInjuries(actor).map((entry) => entry.severity)).toEqual(["moderate"]);
});

test("Long Rest reset is represented by clearing Down Count, not by curing existing Injuries", () => {
  const actor = unit();
  injuries.handleDown(actor);
  injuries.clearCurrentDown(actor);
  injuries.handleDown(actor);
  injuries.gainInjury(actor, "deep_wound", { persist: false });
  injuries.resetDownCount(actor, { persist: false, reason: "long_rest" });
  expect(actor.injuryState.downCount).toBe(0);
  expect(injuries.activeInjuries(actor).some((entry) => entry.catalogId === "deep_wound")).toBe(true);
});

test("natural Stagger Threshold only creates Light Injury when Encounter finalizes", () => {
  const actor = unit();
  injuries.beginEncounter([actor]);
  injuries.markNaturalStagger(actor, { crossed: 1 });
  expect(injuries.activeInjuries(actor)).toHaveLength(0);
  const result = injuries.finalizeEncounter([actor]);
  expect(result[0].light.gained).toBe(true);
  expect(injuries.activeInjuries(actor)[0].severity).toBe("light");
});

test("higher automatic severity replaces lower automatic Injury from the same Encounter", () => {
  const actor = unit();
  injuries.beginEncounter([actor]);
  injuries.gainAutomaticInjury(actor, "moderate", { trigger: "down_count" });
  expect(injuries.activeInjuries(actor).map((entry) => entry.severity)).toEqual(["moderate"]);
  injuries.handleDeath(actor, { reason: "death" });
  expect(injuries.activeInjuries(actor).map((entry) => entry.severity)).toEqual(["severe"]);
});

test("Death records Severe Injury before revival and revival does not remove it", () => {
  const actor = unit(200);
  const death = injuries.handleDeath(actor, { reason: "impalement" });
  expect(death.gained).toBe(true);
  expect(death.injury.severity).toBe("severe");
  expect(actor.maxHp).toBe(190);
  injuries.clearCurrentDown(actor);
  expect(injuries.activeInjuries(actor)).toHaveLength(1);
});

test("world hours reduce remaining recovery time without requiring a Rest type", () => {
  const actor = unit();
  const gained = injuries.gainInjury(actor, "cracked_ribs", { persist: false });
  const ref = gained.injury.instanceId;
  injuries.advanceRecovery(actor, 10, { persist: false });
  expect(injuries.activeInjuries(actor).find((entry) => entry.instanceId === ref).remainingRecoveryHours).toBe(38);
  injuries.advanceRecovery(actor, 38, { persist: false });
  expect(injuries.activeInjuries(actor).some((entry) => entry.instanceId === ref)).toBe(false);
});

test("medicine and Treatment reduce hours and may cure a normal Injury in minutes", () => {
  const actor = unit();
  const gained = injuries.gainInjury(actor, "deep_wound", { persist: false });
  const ref = gained.injury.instanceId;
  const reduced = injuries.treatInjury(actor, ref, { reducePercent: 50 });
  expect(reduced.after).toBe(9);
  const cured = injuries.treatInjury(actor, ref, { cure: true, method: "advanced_treatment" });
  expect(cured.cured).toBe(true);
});

test("Structural loss never heals from elapsed hours or ordinary treatment", () => {
  const actor = unit();
  const gained = injuries.gainInjury(actor, { ...injuries.definition("missing_hand"), affectedParts: ["left_hand"] }, { persist: false });
  const ref = gained.injury.instanceId;
  injuries.advanceRecovery(actor, 10000, { persist: false });
  expect(injuries.activeInjuries(actor).some((entry) => entry.instanceId === ref)).toBe(true);
  const normal = injuries.treatInjury(actor, ref, { cure: true, method: "medical_treatment" });
  expect(normal.treated).toBe(false);
  const replacement = injuries.treatInjury(actor, ref, { cure: true, method: "replacement" });
  expect(replacement.cured).toBe(true);
});

test("Missing Arm disables the whole Arm-Hand-Finger chain and invalid equipment is sent to Loot", () => {
  const actor = unit();
  const sword = { id: "sword", equipped: true, equipment: { kind: "weapon", handCost: 1 } };
  const greatsword = { id: "greatsword", equipped: true, equipment: { kind: "weapon", handCost: 2 } };
  actor.equipment = [sword, greatsword];
  global.LuminousCombatLootPool = [];

  injuries.gainInjury(actor, { ...injuries.definition("missing_arm"), affectedParts: ["left_arm"] }, { persist: false });
  expect(actor.anatomyRuntime.parts.left_arm.state).toBe("missing");
  expect(actor.anatomyRuntime.parts.left_hand.state).toBe("missing");
  expect(actor.anatomyRuntime.parts.left_finger_1.state).toBe("missing");
  expect(global.LuminousCombatLootPool.some((item) => item.id === "greatsword")).toBe(true);
});

test("Missing Hand does not disable its parent Arm", () => {
  const actor = unit();
  injuries.gainInjury(actor, { ...injuries.definition("missing_hand"), affectedParts: ["left_hand"] }, { persist: false });
  expect(actor.anatomyRuntime.parts.left_arm.state).toBe("available");
  expect(actor.anatomyRuntime.parts.left_hand.state).toBe("missing");
  expect(actor.anatomyRuntime.parts.left_finger_5.state).toBe("missing");
});

test("Injury modifiers feed Speed, Evade Power and D&D-style physical checks", () => {
  const actor = unit();
  injuries.gainInjury(actor, "damaged_knee", { persist: false });
  const modifiers = injuries.collectModifiers(actor);
  expect(modifiers.speed).toBe(-1);
  expect(modifiers.evade_power).toBe(-2);
  expect(injuries.checkPenalty(actor, "DEX", null)).toBe(-2);
});

test("CombatEngine bridge detects natural threshold crossing and merges Injury modifiers", () => {
  const actor = unit();
  actor.staggerThresholds = [50];
  actor.crossedThresholds = [false];
  actor.hp = 40;
  const combat = {
    checkStagger(target) {
      const pct = (target.hp / target.maxHp) * 100;
      if (pct <= target.staggerThresholds[0]) target.crossedThresholds[0] = true;
    },
    triggerEncounterStart() {},
    initializeUnitData() {},
    applyPassiveModifiers() { return { speed: 0, evade_power: 0 }; },
    calculateDndBonus() { return 4; },
  };
  injuries.wrapCombatEngine(combat);
  combat.triggerEncounterStart([actor]);
  combat.checkStagger(actor);
  expect(actor.injuryState.encounter.naturalStaggerCrossed).toBe(true);

  injuries.gainInjury(actor, "damaged_knee", { persist: false });
  expect(combat.applyPassiveModifiers(actor).speed).toBe(-1);
  expect(combat.applyPassiveModifiers(actor).evade_power).toBe(-2);
  expect(combat.calculateDndBonus(actor, "DEX", null)).toBe(2);
});

test("Dante Clock Windup removes Injuries, restores Max HP and resets Down Count", () => {
  const actor = unit(200);
  injuries.handleDown(actor);
  injuries.gainInjury(actor, { ...injuries.definition("missing_arm"), affectedParts: ["left_arm"] }, { persist: false });
  expect(actor.maxHp).toBe(190);
  const result = injuries.clearForDanteClock(actor);
  expect(result.cleared).toBe(true);
  expect(injuries.activeInjuries(actor)).toHaveLength(0);
  expect(actor.injuryState.downCount).toBe(0);
  expect(actor.maxHp).toBe(200);
  expect(actor.anatomyRuntime.parts.left_arm.state).toBe("available");
});
