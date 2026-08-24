const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const runtime = read("js/player-archetype-runtime.js");
const archetypeEngine = read("js/archetype-engine.js");
const utils = read("js/utils.js");
const css = read("css/player-archetype-runtime.css");
const tray = read("js/trait-player-tray.js");

test("Player loader monta el Archetype Runtime junto al Trait Runtime", () => {
  expect(utils).toContain("function ensurePlayerArchetypeRuntimeAssets");
  expect(utils).toContain("js/player-archetype-runtime.js");
  expect(utils).toContain("ensurePlayerTraitRuntimeAssets(document);");
  expect(utils).toContain("ensurePlayerArchetypeRuntimeAssets(document);");
});

test("selección se persiste por Class dentro de characterBuild.archetypes", () => {
  expect(runtime).toContain("character.characterBuild.archetypes = selections");
  expect(runtime).toContain("characterBuild/archetypes");
  expect(runtime).toContain("api.selectArchetype(character, classId, archetypeId");
  expect(archetypeEngine).toContain("selectedAtClassLevel: classLevel");
});

test("Traits mantiene categoría Archetype y agrega subtabs sólo al filtrar Archetype", () => {
  expect(tray).toContain('"archetype"');
  expect(runtime).toContain('normalizeId(tray.filter) !== "archetype"');
  expect(runtime).toContain("if (groups.length <= 1) return");
  expect(runtime).toContain('className = "player-archetype-subtabs"');
  expect(runtime).toContain("card.hidden = Boolean(traitArchetype && traitArchetype !== activeId)");
  expect(css).toContain(".player-archetype-subtabs");
  expect(css).toContain(".player-trait-card[hidden]");
});

test("runtime expone integración de Flight, Active Inventory y checks", () => {
  expect(runtime).toContain('capabilityId: "flight"');
  expect(runtime).toContain("activeInventoryLimit");
  expect(runtime).toContain("strengthThresholdModifier");
  expect(runtime).toContain("applyTheatreCheckMechanics");
  expect(runtime).toContain('skill === "performance"');
  expect(runtime).toContain('tags.includes("jump")');
});

test("runtime integra resistencia física, Ammo y Cursed Juggernaut en Combat Engine", () => {
  expect(runtime).toContain("defender.physRes = 1");
  expect(runtime).toContain("coinSpendsAmmo");
  expect(runtime).toContain("originalApplyDamage");
  expect(runtime).toContain("armCursedJuggernaut");
  expect(runtime).toContain("resolveCursedJuggernautRecovery");
});

test("Active Inventory deja de quedar limitado al 10 legacy cuando aplica el Archetype", () => {
  expect(runtime).toContain("const limit = activeInventoryLimit(character, 10)");
  expect(runtime).toContain("Object.keys(targetData).length >= limit");
  expect(runtime).toContain("event.stopImmediatePropagation()");
});
