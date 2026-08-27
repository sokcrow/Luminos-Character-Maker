const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const engine = require(path.join(__dirname, "..", "js", "trait-engine.js"));
require(path.join(__dirname, "..", "js", "class-milestone-engine.js"));
const patch = require(path.join(__dirname, "..", "js", "milestone-trait-modifier-patch.js"));
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("formula de Trait resuelve el numero actual sin reescribir la descripcion", () => {
  const trait = {
    id: "jackpot",
    name: "JACKPOT!",
    description: "Gain (10 x STR MOD) and add STR MOD to Performance.",
    source: { type: "general", id: "jackpot" },
    activation: { type: "passive", actionCost: "none" },
    effects: [{ id: "jackpot_math", contexts: ["theatre"], trigger: "before_check", conditions: [{ path: "check.skillId", operator: "eq", value: "performance" }], operations: [{ type: "modify", path: "check.finalPower", mode: "add", formula: "StrengthMod" }] }],
    rules: [{ type: "modifier", trigger: "passive", target: "self", path: "resource.jackpot", mode: "set", formula: "10 * StrengthMod" }],
  };
  const originalDescription = trait.description;
  const resolved = patch.resolveFormula(engine, trait, "10 * StrengthMod", { character: { level: 20, stats: { fuerza: 16 } } });

  expect(resolved.display).toBe("30");
  expect(resolved.humanFormula).toBe("10 × STR MOD");
  expect(resolved.substitutedFormula).toBe("10 × 3");
  expect(resolved.breakdown).toEqual([expect.objectContaining({ label: "STR MOD", display: "3" })]);
  expect(trait.description).toBe(originalDescription);
});

test("formula compleja usa Class Level de la clase fuente y CON Mod", () => {
  const trait = { id: "number_nerd", source: { type: "class", id: "barbarian", classId: "barbarian" }, activation: { type: "passive", actionCost: "none" } };
  const resolved = patch.resolveFormula(engine, trait, "floor(ClassLevel / 2) + ConstitutionMod", {
    character: { level: 37, stats: { constitucion: 18 }, classes: [{ classId: "barbarian", levels: 17 }, { classId: "bard", levels: 20 }] },
  });

  expect(resolved.display).toBe("12");
  expect(resolved.humanFormula).toBe("floor (CLASS LEVEL / 2) + CON MOD");
  expect(resolved.substitutedFormula).toBe("floor (17 / 2) + 4");
  expect(resolved.breakdown).toEqual(expect.arrayContaining([
    expect.objectContaining({ label: "CLASS LEVEL", display: "17" }),
    expect.objectContaining({ label: "CON MOD", display: "4" }),
  ]));
});

test("identificador desconocido hace fallback y nunca inventa cero", () => {
  expect(patch.resolveFormula(engine, { id: "unsafe_preview" }, "DamageDealt + Level", { character: { level: 20 } })).toBeNull();
});

test("descubre formulas anidadas sin interpretar la descripcion como dato mecanico", () => {
  const trait = {
    description: "Texto original con (10 x STR MOD).",
    activation: { uses: { formula: "Proficiency" } },
    effects: [{ operations: [{ type: "modify", formula: "10 * StrengthMod" }] }],
    rules: [{ valueFormula: "ClassLevel / 2" }],
  };
  expect(patch.collectTraitFormulas(trait)).toEqual(expect.arrayContaining(["Proficiency", "10 * StrengthMod", "ClassLevel / 2"]));
  expect(patch.collectTraitFormulas(trait)).not.toContain(trait.description);
});

test("matcher visual acepta formula machine, x y signo de multiplicacion", () => {
  const regex = () => new RegExp(patch.formulaPattern("10 * StrengthMod"), "gi");
  expect("(10 x STR MOD)".match(regex())).toEqual(["(10 x STR MOD)"]);
  expect("10 × STR MOD".match(regex())).toEqual(["10 × STR MOD"]);
  expect("10 * StrengthMod".match(regex())).toEqual(["10 * StrengthMod"]);
});

test("JACKPOT aporta STR Mod solo a Performance y conserva fuente", () => {
  const jackpot = {
    schemaVersion: 1,
    id: "jackpot",
    name: "JACKPOT!",
    description: "Add STR MOD to Performance.",
    source: { type: "general", id: "jackpot" },
    contexts: ["theatre"],
    activation: { type: "passive", actionCost: "none" },
    effects: [{ id: "jackpot_performance", contexts: ["theatre"], trigger: "before_check", conditions: [{ path: "check.skillId", operator: "eq", value: "performance" }], operations: [{ type: "modify", path: "check.finalPower", mode: "add", formula: "StrengthMod" }] }],
    rules: [],
  };
  const character = { level: 20, stats: { fuerza: 16, carisma: 14 } };
  expect(patch.skillTraitContributions(engine, [jackpot], character, { kind: "skill", abilityId: "cha", skillId: "performance" })).toEqual([{ traitId: "jackpot", name: "JACKPOT!", amount: 3 }]);
  expect(patch.skillTraitContributions(engine, [jackpot], character, { kind: "skill", abilityId: "cha", skillId: "persuasion" })).toEqual([]);
});

test("rollback +2 resta exactamente el allocation y conserva otros milestones", () => {
  const player = { stats: { fuerza: 16, destreza: 14 }, characterBuild: { classMilestones: { barbarian: { 20: { classId: "barbarian", milestoneLevel: 20, type: "stats", allocation: { fuerza: 2 } }, 40: { classId: "barbarian", milestoneLevel: 40, type: "trait", traitId: "alert" } } } } };
  const result = patch.revertMilestoneState(player, "barbarian", 20);
  expect(result.valid).toBe(true);
  expect(result.player.stats.fuerza).toBe(14);
  expect(result.player.characterBuild.classMilestones.barbarian[20]).toBeUndefined();
  expect(result.player.characterBuild.classMilestones.barbarian[40].traitId).toBe("alert");
  expect(player.stats.fuerza).toBe(16);
});

test("rollback +1/+1 resta ambos y Trait milestone borra solo la eleccion", () => {
  const split = patch.revertMilestoneState({ stats: { fuerza: 15, destreza: 15 }, characterBuild: { classMilestones: { bard: { 20: { type: "stats", allocation: { fuerza: 1, destreza: 1 } } } } } }, "bard", 20);
  expect(split.valid).toBe(true);
  expect(split.player.stats).toMatchObject({ fuerza: 14, destreza: 14 });

  const trait = patch.revertMilestoneState({ stats: { fuerza: 14 }, characterBuild: { classMilestones: { bard: { 20: { type: "trait", traitId: "jackpot" } } } } }, "bard", 20);
  expect(trait.valid).toBe(true);
  expect(trait.player.stats.fuerza).toBe(14);
  expect(trait.player.characterBuild.classMilestones.bard).toBeUndefined();
});

test("rollback invalido aborta sin mutacion parcial", () => {
  const player = { stats: { fuerza: 1 }, characterBuild: { classMilestones: { barbarian: { 20: { type: "stats", allocation: { fuerza: 2 } } } } } };
  const result = patch.revertMilestoneState(player, "barbarian", 20);
  expect(result.valid).toBe(false);
  expect(player.stats.fuerza).toBe(1);
  expect(player.characterBuild.classMilestones.barbarian[20]).toBeTruthy();
});

test("parche no modifica el Coin Engine ni triggerCoinRoll para evitar doble conteo", () => {
  const source = read("js/milestone-trait-modifier-patch.js");
  expect(source).not.toContain("rollAdjustment.bonus =");
  expect(source).not.toContain("triggerCoinRoll =");
  expect(source).toContain("skillTraitContributions");
  expect(source).toContain("check.finalpower");
});

test("runtime compartido carga el parche en Player y DM", () => {
  const loader = read("js/player-stat-tooltip-runtime.js");
  expect(loader).toContain("milestone-trait-modifier-patch-script");
  expect(loader).toContain("js/milestone-trait-modifier-patch.js");
});
