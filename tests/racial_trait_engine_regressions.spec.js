const { test, expect } = require("@playwright/test");
const engine = require("../js/trait-engine.js");
const tray = require("../js/trait-player-tray.js");
const racialCatalog = require("../js/racial-trait-catalog.js");

test("modifier rules can target the top-level damage event object", () => {
  const trait = {
    id: "damage_root_regression",
    name: "Damage Root Regression",
    contexts: ["combat"],
    activation: { type: "automatic", actionCost: "none" },
    effects: [],
    rules: [{
      id: "fixed_damage",
      type: "modifier",
      trigger: "damage_dealt",
      target: "damage",
      path: "damage.amount",
      mode: "add",
      value: 3,
    }],
  };
  const damage = { amount: 10 };
  const result = engine.dispatchCombatEvent("damage_dealt", {
    character: { level: 10 },
    self: {},
    damage,
    traits: [trait],
  });

  expect(result.runtime.damage).toBe(damage);
  expect(damage.amount).toBe(13);
});

test("toggle conditions can read statuses held only in Trait state", () => {
  const trait = {
    id: "state_status_toggle_regression",
    name: "State Status Toggle Regression",
    contexts: ["combat"],
    activation: { type: "manual", actionCost: "none" },
    effects: [
      {
        id: "enable",
        contexts: ["combat"],
        trigger: "on_use",
        conditions: [{ path: "self.statusEffects.test_form", operator: "falsy" }],
        operations: [{ type: "apply_status", statusId: "test_form", count: 1 }],
      },
      {
        id: "disable",
        contexts: ["combat"],
        trigger: "on_use",
        conditions: [{ path: "self.statusEffects.test_form", operator: "truthy" }],
        operations: [{ type: "remove_status", statusId: "test_form" }],
      },
    ],
    rules: [],
  };
  const state = engine.createState();
  const runtime = { context: "combat", character: {}, self: {} };

  const enabled = engine.activateTrait(trait, runtime, state);
  expect(enabled.state.statuses.test_form).toBeTruthy();
  expect(runtime.self.statusEffects).toBeUndefined();

  const disabled = engine.activateTrait(trait, runtime, state);
  expect(disabled.state.statuses.test_form).toBeUndefined();
});

test("Trait tray mirrors toggle statuses to the production unit and removes them on disable", () => {
  const trait = {
    id: "tray_status_toggle_regression",
    name: "Tray Status Toggle Regression",
    contexts: ["combat"],
    activation: { type: "manual", actionCost: "none" },
    effects: [
      {
        id: "enable",
        contexts: ["combat"],
        trigger: "on_use",
        conditions: [{ path: "self.statusEffects.test_form", operator: "falsy" }],
        operations: [{ type: "apply_status", statusId: "test_form", count: 1 }],
      },
      {
        id: "disable",
        contexts: ["combat"],
        trigger: "on_use",
        conditions: [{ path: "self.statusEffects.test_form", operator: "truthy" }],
        operations: [{ type: "remove_status", statusId: "test_form" }],
      },
    ],
    rules: [],
  };
  const state = engine.createState();
  const unit = {};
  const runtime = { context: "combat", character: unit, self: unit };

  const enabled = engine.activateTrait(trait, runtime, state);
  tray.syncActivationStatuses(enabled, runtime);
  expect(unit.statusEffects.test_form).toBeTruthy();

  const disabled = engine.activateTrait(trait, runtime, state);
  tray.syncActivationStatuses(disabled, runtime);
  expect(unit.statusEffects.test_form).toBeUndefined();
});

test("stored characterBuild level powers positive racial damage with a minimum of 1", () => {
  const character = { characterBuild: { calculatedAtLevel: 20 }, stats: { constitucion: 10 } };
  const sacredDamage = { amount: 1 };
  engine.dispatchCombatEvent("damage_dealt", {
    character,
    self: character,
    target: { type: "Demon" },
    skill: { id: "dragon_breath", tags: ["dragon_breath"] },
    damage: sacredDamage,
    traits: [racialCatalog.getDefinition("half_dragon_gold_breath_conversion")],
  });
  expect(sacredDamage.amount).toBe(2);

  const protectorDamage = { amount: 1 };
  const state = engine.createState({ statuses: { aasimar_protector_form: { id: "aasimar_protector_form", count: 1 } } });
  engine.dispatchCombatEvent("damage_dealt", {
    character,
    self: character,
    damage: protectorDamage,
    traits: [racialCatalog.getDefinition("aasimar_protector_transformation")],
    state,
  });
  expect(protectorDamage.amount).toBe(3);
});


test("Moonfae Empathy registers a concrete DM request and returns no orphan flag", () => {
  const trait = racialCatalog.getDefinition("moonfae_empathy");
  const target = { id: "npc-heart", name: "Quiet Stranger" };
  let descriptor = null;
  const state = engine.createState();
  const result = engine.activateTrait(trait, {
    context: "theatre",
    character: { level: 20, proficiencyBonus: 3 },
    self: { level: 20 },
    target,
    registerDmEffect(value) { descriptor = value; return { id: "request-1", ...value }; },
  }, state);
  expect(result.available).toBeTruthy();
  expect(descriptor).toBeTruthy();
  expect(descriptor.kind).toBe("request");
  expect(descriptor.effectId).toBe("empathy_read");
  expect(descriptor.targetId).toBe("npc-heart");
  expect(state.flags?.empathy_read_requested).toBeUndefined();
});

test("shared Trait source binds Firebase owner buckets to actual combat Units", () => {
  const runtime = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "player-trait-runtime.js"), "utf8");
  const viewer = require("fs").readFileSync(require("path").join(__dirname, "..", "Battle-viewer.html"), "utf8");
  expect(runtime).toContain("${SHARED_PLANNED_ACTIONS_ROOT}/${ownerPlayerId}/${slotIndex}");
  expect(runtime).toContain("scheduledBy: ownerPlayerId");
  expect(viewer).toContain("function combatUnitForOwner(ownerPlayerId)");
  expect(viewer).toContain("sharedOwnerPlayerId");
  expect(viewer).toContain("!attackVectors[attackerSlotId]");
});
