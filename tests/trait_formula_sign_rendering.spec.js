const { test, expect } = require("@playwright/test");
const engine = require("../js/trait-engine.js");
const catalog = require("../js/trait-catalog-core.js");
const formulaView = require("../js/trait-formula-view-patch.js");

test("max formula shorthand matches the authored (1, Constitution Mod) text", () => {
  const pattern = formulaView.formulaPattern("max(1, ConstitutionMod)");
  const regex = new RegExp(pattern, "i");
  expect(regex.test("(1, Constitution Mod)")).toBe(true);
  expect(regex.test("max(1, ConstitutionMod)")).toBe(true);
});

test("formula regex absorbs an authored plus or minus sign", () => {
  const plus = formulaView.formulaRegex("max(1, ConstitutionMod)").exec("Gain +(1, Constitution Mod) Defensive Level.");
  const minus = formulaView.formulaRegex("ConstitutionMod").exec("Gain -(Constitution Mod) Defensive Level.");

  expect(plus[1]).toBe("+");
  expect(plus[0]).toBe("+(1, Constitution Mod)");
  expect(minus[1]).toBe("-");
  expect(minus[0]).toBe("-(Constitution Mod)");
});

test("signed dynamic formula display keeps the sign attached to the number", () => {
  expect(formulaView.displayForSignedFormula({ value: 3, display: "3" }, "+")).toBe("+3");
  expect(formulaView.displayForSignedFormula({ value: 3, display: "3" }, "-")).toBe("-3");
});

test("Armorless Defense resolves its authored minimum shorthand without changing source text", () => {
  const trait = catalog.getDefinition("armorless_defense");
  const character = {
    level: 30,
    classes: [{ classId: "barbarian", levels: 30 }],
    stats: { constitucion: 10 },
    maxHp: 200,
  };
  const resolved = formulaView.resolveFormula(engine, trait, trait.mechanics.defensiveLevelFormula, { character });

  expect(trait.description).toContain("+(1, Constitution Mod) Defensive Level");
  expect(resolved.value).toBe(1);
  expect(formulaView.displayForSignedFormula(resolved, "+")).toBe("+1");
});
