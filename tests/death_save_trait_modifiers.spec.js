const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const traitEngineSource = fs.readFileSync(path.join(__dirname, "..", "js", "trait-engine.js"), "utf8");
const deathSaveSource = fs.readFileSync(path.join(__dirname, "..", "js", "death-save-runtime.js"), "utf8");

function createSandbox() {
  const math = Object.create(Math);
  const sandbox = {
    console,
    Math: math,
    Date,
    JSON,
    Object,
    Array,
    Set,
    Map,
    WeakMap,
    Number,
    String,
    Boolean,
    RegExp,
    setInterval() { return 0; },
    clearInterval() {},
    dispatchEvent() { return true; },
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(traitEngineSource, sandbox, { filename: "trait-engine.js" });
  vm.runInContext(deathSaveSource, sandbox, { filename: "death-save-runtime.js" });
  return sandbox;
}

const deathSaveEdgeTrait = {
  schemaVersion: 1,
  id: "death_save_edge",
  name: "Death Save Edge",
  source: { type: "special", id: "death_save_edge" },
  contexts: ["combat"],
  activation: { type: "passive", actionCost: "none" },
  effects: [
    {
      id: "death_save_edge_power",
      contexts: ["combat"],
      trigger: "before_check",
      conditions: [{ path: "check.kind", operator: "eq", value: "death_save" }],
      operations: [
        { type: "modify", path: "check.finalPower", mode: "add", value: 1 },
        { type: "modify", path: "check.difficulty", mode: "add", value: -1 },
      ],
    },
  ],
  rules: [],
};

test("Death Save ignores Stats/proficiency but accepts Trait Power and Threshold modifiers", () => {
  const sandbox = createSandbox();
  const runtime = sandbox.LuminousDeathSaveRuntime;
  const unit = {
    id: "captain-trait-check",
    isCaptain: true,
    hp: 0,
    maxHp: 100,
    lifeState: "downed",
    isDowned: true,
    stats: { strength: 30, fuerza: 30, constitution: 30, constitucion: 30 },
    proficiency: 99,
    dndStats: { proficiencyBonus: 99 },
    traits: [deathSaveEdgeTrait],
  };

  // Exactly two Heads => base roll 8. Without Traits this fails Threshold 10.
  const rolls = [0.1, 0.1, 0.9, 0.9, 0.9];
  const check = runtime.rollDeathSave({ unit, rng: () => rolls.shift() });

  expect(check.rolledPower).toBe(8);
  expect(check.deathSavePower).toBe(1);
  expect(check.deathSaveThreshold).toBe(9);
  expect(check.total).toBe(9);
  expect(check.passed).toBe(true);
  expect(check.statModifier).toBe(0);
  expect(check.proficiencyBonus).toBe(0);
  expect(check.statModifiers).toBe(false);
  expect(unit.deathSavePower).toBe(1);
  expect(unit.deathSaveThreshold).toBe(9);
});

test("Death Save supports dedicated Trait channels as well as generic Check channels", () => {
  const sandbox = createSandbox();
  const runtime = sandbox.LuminousDeathSaveRuntime;
  const unit = {
    id: "captain-dedicated-check",
    isCaptain: true,
    hp: 0,
    maxHp: 100,
    lifeState: "downed",
    isDowned: true,
    traits: [{
      schemaVersion: 1,
      id: "death_save_focus",
      name: "Death Save Focus",
      source: { type: "special", id: "death_save_focus" },
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [{
        id: "death_save_focus_before",
        contexts: ["combat"],
        trigger: "before_check",
        conditions: [{ path: "check.abilityId", operator: "eq", value: "death_save" }],
        operations: [
          { type: "modify", path: "check.deathSavePower", mode: "add", value: 1 },
          { type: "modify", path: "check.deathSaveThreshold", mode: "add", value: -1 },
        ],
      }],
      rules: [],
    }],
  };

  const prepared = runtime.prepareDeathSaveCheck(unit);
  expect(prepared.check.deathSavePower).toBe(1);
  expect(prepared.check.deathSaveThreshold).toBe(9);
  expect(prepared.check.kind).toBe("death_save");
  expect(prepared.check.abilityId).toBe("death_save");
});
