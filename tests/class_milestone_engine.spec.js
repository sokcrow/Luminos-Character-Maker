const { test, expect } = require("@playwright/test");
const milestones = require("../js/class-milestone-engine.js");

test("los milestones se ganan por nivel de cada clase, no por nivel total", () => {
  const earned = milestones.earnedMilestones([
    { classId: "barbarian", levels: 40 },
    { classId: "fighter", levels: 20 },
    { classId: "wizard", levels: 19 },
  ]);

  expect(earned.map((entry) => entry.key)).toEqual([
    "barbarian:20",
    "barbarian:40",
    "fighter:20",
  ]);
});

test("un salto por encima del milestone no pierde la elección", () => {
  expect(milestones.earnedMilestones([{ classId: "barbarian", levels: 21 }]).map((entry) => entry.milestoneLevel)).toEqual([20]);
  expect(milestones.earnedMilestones([{ classId: "barbarian", levels: 96 }]).map((entry) => entry.milestoneLevel)).toEqual([20, 40, 60, 80, 95]);
});

test("+2 a un Stat es válido mientras no supere 20", () => {
  expect(milestones.validateChoice({ type: "stats", allocation: { fuerza: 2 } }, { fuerza: 18 }).valid).toBe(true);

  const invalid = milestones.validateChoice({ type: "stats", allocation: { fuerza: 2 } }, { fuerza: 19 });
  expect(invalid.valid).toBe(false);
  expect(invalid.errors.join(" ")).toContain("20");
});

test("Stats asignados rechazan valores faltantes, vacíos o no numéricos", () => {
  const choice = { type: "stats", allocation: { fuerza: 2 } };

  expect(milestones.validateChoice(choice, {}).valid).toBe(false);
  expect(milestones.validateChoice(choice, { fuerza: "" }).valid).toBe(false);
  expect(milestones.validateChoice(choice, { fuerza: "abc" }).valid).toBe(false);
  expect(milestones.validateChoice(choice, { fuerza: 18 }).valid).toBe(true);
});

test("Stats asignados rechazan valores decimales", () => {
  const invalid = milestones.validateChoice(
    { type: "stats", allocation: { fuerza: 2 } },
    { fuerza: "18.5" },
  );

  expect(invalid.valid).toBe(false);
  expect(invalid.errors.join(" ")).toContain("entero válido");
});

test("+1/+1 exige dos Stats diferentes y respeta el cap 20", () => {
  expect(milestones.validateChoice({ type: "stats", allocation: { fuerza: 1, destreza: 1 } }, { fuerza: 19, destreza: 19 }).valid).toBe(true);
  expect(milestones.validateChoice({ type: "stats", allocation: { fuerza: 1 } }, { fuerza: 18 }).valid).toBe(false);
  expect(milestones.validateChoice({ type: "stats", allocation: { fuerza: 1, destreza: 1 } }, { fuerza: 20, destreza: 18 }).valid).toBe(false);
});

test("aplicar Stats suma exactamente dos puntos y nunca modifica otros Stats", () => {
  const result = milestones.applyStatAllocation(
    { fuerza: 18, destreza: 12, constitucion: 14, inteligencia: 10, sabiduria: 11, carisma: 8 },
    { fuerza: 1, constitucion: 1 },
  );

  expect(result.valid).toBe(true);
  expect(result.stats).toMatchObject({ fuerza: 19, destreza: 12, constitucion: 15, inteligencia: 10, sabiduria: 11, carisma: 8 });
});

test("un milestone reclamado deja de aparecer como pendiente", () => {
  const choices = {
    barbarian: {
      20: { type: "stats", allocation: { fuerza: 2 } },
    },
  };
  const pending = milestones.pendingMilestones([{ classId: "barbarian", levels: 40 }], choices);
  expect(pending.map((entry) => entry.key)).toEqual(["barbarian:40"]);
});

test("Trait General exige traitId y se resuelve sólo desde definiciones General", () => {
  expect(milestones.validateChoice({ type: "trait", traitId: "tough" }).valid).toBe(true);
  expect(milestones.validateChoice({ type: "trait" }).valid).toBe(false);

  const character = {
    characterBuild: {
      classMilestones: {
        barbarian: {
          20: { type: "trait", traitId: "tough" },
          40: { type: "stats", allocation: { fuerza: 2 } },
        },
        fighter: {
          20: { type: "trait", traitId: "tough" },
          40: { type: "trait", traitId: "class_only" },
        },
      },
    },
  };
  const catalog = {
    tough: { id: "tough", name: "Tough", source: { type: "general" } },
    class_only: { id: "class_only", name: "Class Only", source: { type: "class", id: "fighter" } },
  };

  expect(milestones.selectedGeneralTraitIds(character)).toEqual(["tough", "class_only"]);
  expect(milestones.resolveSelectedGeneralTraits(character, catalog).map((trait) => trait.id)).toEqual(["tough"]);
});
