const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const modifiers = require("../js/universal-modifier-engine.js");
const economy = require("../js/universal-action-economy.js");
const traitEngine = require("../js/trait-engine.js");
const racialCatalog = require("../js/racial-trait-catalog.js");
const CombatEngine = require("../js/combatEngine.js");
const dmEffects = require("../js/dm-managed-effect-engine.js");

test("Actions are assigned to free Action Slots during Planning instead of executing immediately", () => {
  const unit = { id: "actor", activeSlots: 2, hp: 10, maxHp: 20 };
  economy.beginPlanning(unit);
  const runtimeEconomy = economy.runtimeFor(unit, { phase: "PRE_COMBAT_PLANNING" });
  expect(runtimeEconomy.action).toBe(2);

  const trait = {
    id: "planned_heal",
    name: "Planned Heal",
    contexts: ["combat"],
    activation: { type: "manual", actionCost: "action" },
    effects: [{
      id: "heal",
      contexts: ["combat"],
      trigger: "on_use",
      conditions: [],
      operations: [{ type: "heal_hp", path: "self.hp", maxPath: "self.maxHp", value: 5 }],
    }],
    rules: [],
  };
  const state = traitEngine.createState();
  const result = traitEngine.activateTrait(trait, {
    context: "combat",
    self: unit,
    character: unit,
    actionEconomy: runtimeEconomy,
  }, state);

  expect(result.available).toBeTruthy();
  expect(result.scheduled).toBeTruthy();
  expect(result.slotIndex).toBe(0);
  expect(unit.hp).toBe(10);
  expect(economy.getPlannedAction(unit, 0)?.traitId).toBe("planned_heal");
  expect(economy.snapshot(unit, { phase: "planning" }).action).toBe(1);
});

test("Quick Action is exactly one per Turn and only before Combat Phase", () => {
  const unit = { id: "quick", actionSlots: 1 };
  economy.beginPlanning(unit);
  expect(economy.consume(unit, "quick_action", { phase: "planning" })).toBeTruthy();
  expect(economy.consume(unit, "quick_action", { phase: "planning" })).toBeFalsy();
  economy.beginCombat(unit);
  expect(economy.canUse(unit, "quick_action", { phase: "combat" })).toBeFalsy();
  economy.beginPlanning(unit);
  expect(economy.canUse(unit, "quick_action", { phase: "planning" })).toBeTruthy();
});

test("Reaction is exactly one per Turn and only during Combat Phase", () => {
  const unit = { id: "reaction", actionSlots: 1 };
  economy.beginPlanning(unit);
  expect(economy.canUse(unit, "reaction", { phase: "planning" })).toBeFalsy();
  economy.beginCombat(unit);
  expect(economy.consume(unit, "reaction", { phase: "combat" })).toBeTruthy();
  expect(economy.consume(unit, "reaction", { phase: "combat" })).toBeFalsy();
  economy.resetTurnResources(unit);
  expect(economy.consume(unit, "reaction", { phase: "combat" })).toBeTruthy();
});

test("Counter and ClashableCounter both consume the universal Reaction", () => {
  const unit = { id: "counter", actionSlots: 1 };
  economy.beginPlanning(unit);
  economy.beginCombat(unit);
  expect(economy.isCounterSkill({ type: "Counter", isDefense: true })).toBeTruthy();
  expect(economy.isCounterSkill({ type: "ClashableCounter", isDefense: true })).toBeTruthy();
  expect(economy.consumeCounterReaction(unit, { type: "ClashableCounter", isDefense: true }, { phase: "combat" })).toBeTruthy();
  expect(economy.consumeCounterReaction(unit, { type: "Counter", isDefense: true }, { phase: "combat" })).toBeFalsy();
});

test("Quick Action and Reaction Traits consume their universal resources", () => {
  const quickTrait = {
    id: "quick_trait",
    contexts: ["combat"],
    activation: { type: "manual", actionCost: "quick_action" },
    effects: [], rules: [],
  };
  const reactionTrait = {
    id: "reaction_trait",
    contexts: ["combat"],
    activation: { type: "manual", actionCost: "reaction" },
    effects: [], rules: [],
  };
  const unit = { id: "trait-user" };
  const state = traitEngine.createState();

  economy.beginPlanning(unit);
  const planning = { context: "combat", self: unit, character: unit, actionEconomy: economy.runtimeFor(unit, { phase: "planning" }) };
  expect(traitEngine.activateTrait(quickTrait, planning, state).available).toBeTruthy();
  expect(traitEngine.activateTrait(quickTrait, planning, state).available).toBeFalsy();
  expect(traitEngine.activateTrait(reactionTrait, planning, state).available).toBeFalsy();

  economy.beginCombat(unit);
  const combat = { context: "combat", self: unit, character: unit, actionEconomy: economy.runtimeFor(unit, { phase: "combat" }) };
  expect(traitEngine.activateTrait(reactionTrait, combat, state).available).toBeTruthy();
  expect(traitEngine.activateTrait(reactionTrait, combat, state).available).toBeFalsy();
});

test("Cold Fury inherits Counter Power for Counter and ClashableCounter", () => {
  const trait = racialCatalog.getDefinition("yuan_ti_cold_fury");
  const unit = { level: 20, statusEffects: {} };

  const ordinary = modifiers.resolveTraitModifiers({
    character: unit,
    unit,
    traits: [trait],
    context: "combat",
    skill: { type: "Counter", isDefense: true },
  });
  const clashable = modifiers.resolveTraitModifiers({
    character: unit,
    unit,
    traits: [trait],
    context: "combat",
    skill: { type: "ClashableCounter", isDefense: true },
  });
  const guard = modifiers.resolveTraitModifiers({
    character: unit,
    unit,
    traits: [trait],
    context: "combat",
    skill: { type: "ClashableGuard", isDefense: true },
  });

  expect(ordinary.counter_power).toBe(4);
  expect(clashable.counter_power).toBe(4);
  expect(guard.counter_power).toBe(0);
});


test("production Battle viewer follows Firebase Planning state", () => {
  const viewer = fs.readFileSync(path.join(__dirname, "..", "Battle-viewer.html"), "utf8");
  expect(viewer).toContain("db.ref(COMBAT_STATE_PATH).on('value'");
  expect(viewer).toContain("CombatEngine.beginPlanningPhase(units)");
  expect(viewer).toContain("CombatEngine.triggerEncounterStart(units)");
  expect(viewer).toContain("syncCombatEnginePhase('COMBAT_ACTIVE')");
  expect(viewer).toContain("await db.ref(COMBAT_STATE_PATH).set('COMBAT_ACTIVE')");
});

test("production timeline resolves planned Trait Action Slots", () => {
  const viewer = fs.readFileSync(path.join(__dirname, "..", "Battle-viewer.html"), "utf8");
  expect(viewer).toContain("...collectPlannedActionSlotIds()");
  expect(viewer).toContain("CombatEngine.resolveActionSlot(attackerUnit, slotIndex");
  expect(viewer).toContain("claimSharedPlannedAction(sharedOwnerPlayerId, slotIndex)");
  expect(viewer).toContain("plannedAction: claimed");
  expect(viewer).toContain("finishSharedPlannedAction(sharedOwnerPlayerId, slotIndex, plannedResolution)");
  expect(viewer).toContain("resolvedSlots.add(attackerSlotId)");
  expect(viewer).toContain("function combatUnitForOwner(ownerPlayerId)");
  expect(viewer).toContain("!attackVectors[attackerSlotId]");
});


test("CombatEngine rejects serialized shared Traits that are not trusted grants", () => {
  global.LuminousTraitEngine = traitEngine;
  const unit = { id: "actor", hp: 10, maxHp: 20 };
  const trait = { id: "shared_heal", name: "Shared Heal", contexts: ["combat"], activation: { type: "manual", actionCost: "action" }, effects: [{ id: "heal", contexts: ["combat"], trigger: "on_use", conditions: [], operations: [{ type: "heal_hp", path: "self.hp", maxPath: "self.maxHp", value: 5 }] }], rules: [] };
  const plannedAction = { kind: "trait", traitId: trait.id, targetId: null, data: { trait } };
  const result = CombatEngine.resolveActionSlot(unit, 0, { phase: "combat", combatData: { actor: unit }, plannedAction });
  expect(result.handled).toBeTruthy();
  expect(result.result.available).toBeFalsy();
  expect(unit.hp).toBe(10);
  delete global.LuminousTraitEngine;
});

test("DM managed effects expose deterministic duration helpers", () => {
  const effect = { active: true, expiresAt: 3_600_000 };
  expect(dmEffects.isActive(effect, 0)).toBeTruthy();
  expect(dmEffects.formatRemaining(effect, 0)).toBe("1h 0m");
  expect(dmEffects.isActive(effect, 3_600_000)).toBeFalsy();
});


test("player runtime reconciles resolved shared Trait Actions into local usage state", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "player-trait-runtime.js"), "utf8");
  expect(source).toContain("function processSharedActionResolutions()");
  expect(source).toContain('action.status !== "resolved"');
  expect(source).toContain('String(action.scheduledBy || "") !== playerId');
  expect(source).toContain('record.used = Math.max(0, Number(record.used || 0)) + 1');
  expect(source).toContain("LuminousActionEconomy?.cancelAction?.(unit, slotIndex)");
  expect(source).toContain("state.db.ref(SHARED_PLANNED_ACTIONS_ROOT).on");
});


test("normal Skill reservations and Trait Actions cannot occupy the same Action Slot", () => {
  const unit = { id: "slot-owner", actionSlots: 2 };
  economy.beginPlanning(unit);
  const result = economy.scheduleAction(unit, { kind: "trait", traitId: "x" }, { phase: "planning", reservedSlotIndexes: [0] });
  expect(result.scheduled).toBeTruthy();
  expect(result.slotIndex).toBe(1);
  const one = { id: "one", actionSlots: 1 };
  economy.beginPlanning(one);
  const blocked = economy.scheduleAction(one, { kind: "trait", traitId: "x" }, { phase: "planning", reservedSlotIndexes: [0] });
  expect(blocked.scheduled).toBeFalsy();
  expect(blocked.reason).toBe("no_free_action_slot");
});

test("shared Trait execution ignores serialized definitions and authorizes canonical racial grants", () => {
  global.LuminousTraitEngine = traitEngine;
  global.LuminousRacialTraitCatalog = racialCatalog;
  const unit = { id: "aasimar", raceId: "aasimar", level: 20, hp: 5, maxHp: 30, dndStats: { CON: 10 } };
  const malicious = { id: "aasimar_healing_hands", contexts: ["combat"], activation: { type: "manual", actionCost: "action" }, effects: [{ id: "evil", contexts: ["combat"], trigger: "on_use", conditions: [], operations: [{ type: "heal_hp", path: "self.hp", maxPath: "self.maxHp", value: 999 }] }], rules: [] };
  const result = CombatEngine.resolveActionSlot(unit, 0, { phase: "combat", combatData: { aasimar: unit }, plannedAction: { kind: "trait", traitId: "aasimar_healing_hands", data: { trait: malicious } } });
  expect(result.handled).toBeTruthy();
  expect(result.result.available).toBeTruthy();
  expect(unit.hp).toBe(15);
  const intruder = { id: "kobold", raceId: "kobold", level: 20, hp: 5, maxHp: 30, dndStats: { CON: 10 } };
  const denied = CombatEngine.resolveActionSlot(intruder, 0, { phase: "combat", combatData: { kobold: intruder }, plannedAction: { kind: "trait", traitId: "aasimar_healing_hands", data: { trait: malicious } } });
  expect(denied.handled).toBeTruthy();
  expect(denied.result.available).toBeFalsy();
  expect(intruder.hp).toBe(5);
  delete global.LuminousRacialTraitCatalog;
  delete global.LuminousTraitEngine;
});

test("shared runtime sends identifiers only and Battle viewer protects Trait-reserved slots", () => {
  const runtime = fs.readFileSync(path.join(__dirname, "..", "js", "player-trait-runtime.js"), "utf8");
  const viewer = fs.readFileSync(path.join(__dirname, "..", "Battle-viewer.html"), "utf8");
  expect(runtime).toContain("schedulerUid");
  expect(runtime).not.toContain("data: { ...(local.data || {}), trait }");
  expect(runtime).toContain("reservedSlotIndexes: combatReservedActionSlotIndexes(self)");
  expect(viewer).toContain("function isTraitActionSlotReserved(slotId)");
  expect(viewer).toContain("if (isTraitActionSlotReserved(slot.id))");
  expect(viewer).toContain("if (!attackerId || isTraitActionSlotReserved(attackerId))");
  expect(viewer).toContain("firebase-auth.js");
  expect(viewer).toContain("js/trait-catalog-core.js");
});

test("DM-managed effect renderer uses text nodes for player-controlled fields", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "dm-managed-effect-engine.js"), "utf8");
  expect(source).toContain("function appendTextLine");
  expect(source).toContain("line.textContent");
  expect(source).not.toContain("card.innerHTML");
  expect(source).not.toContain("insertAdjacentHTML");
});
