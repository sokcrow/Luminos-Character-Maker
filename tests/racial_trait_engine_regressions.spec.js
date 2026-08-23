const { test, expect } = require("@playwright/test");
const engine = require("../js/trait-engine.js");
const tray = require("../js/trait-player-tray.js");

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
