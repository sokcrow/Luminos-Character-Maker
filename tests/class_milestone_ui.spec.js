const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

const hotfix = read("js/dm-player-dnd-studio-hotfix.js");
const ui = read("js/dm-player-class-milestones.js");
const css = read("css/dm-player-class-milestones.css");
const traitCreator = read("dm-trait-creator.html");

test("DM Studio carga el motor y la UI de milestones", () => {
  expect(hotfix).toContain('js/class-milestone-engine.js');
  expect(hotfix).toContain('js/dm-player-class-milestones.js');
  expect(hotfix).toContain('css/dm-player-class-milestones.css');
  expect(ui).toContain('LV.20 / 40 / 60 / 80 / 95');
  expect(css).toContain('.dm-player-class-milestones');
});

test("la UI reclama el milestone mediante una transacción del jugador", () => {
  expect(ui).toContain('playerRef.transaction');
  expect(ui).toContain('Ese milestone ya fue reclamado.');
  expect(ui).toContain('api.validateChoice(proposed, current.stats || {})');
  expect(ui).toContain('api.applyStatAllocation');
  expect(ui).toContain('current.characterBuild.classMilestones[classId][String(milestoneLevel)]');
});

test("Traits Generales se distinguen de Grants automáticos", () => {
  expect(traitCreator).toContain('<option>general</option>');
  expect(ui).toContain('api.isGeneralTraitDefinition(definition)');
  expect(ui).toContain('campaña/config/traits/definitions');
  expect(ui).not.toContain('campaña/config/traits/grants');
});
