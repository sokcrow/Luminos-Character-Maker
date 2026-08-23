const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const tray = require(path.join(__dirname, "..", "js", "trait-player-tray.js"));
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("Traits se clasifican por origen para la pestaña del jugador", () => {
  const cases = [
    [{ source: { type: "race", id: "lizalin" } }, "racial"],
    [{ source: { type: "class", id: "barbarian" } }, "class"],
    [{ source: { type: "archetype", id: "berserker", classId: "barbarian" } }, "archetype"],
    [{ source: { type: "background", id: "soldier" } }, "background"],
    [{ source: { type: "general", id: "alert" } }, "general"],
    [{ source: { type: "special", id: "campaign" } }, "other"],
  ];

  cases.forEach(([trait, expected]) => expect(tray.sourceCategory(trait)).toBe(expected));
});

test("la etiqueta conserva origen, clase padre y nivel cuando existen", () => {
  expect(tray.sourceMeta({ source: { type: "class", id: "barbarian", requiredLevel: 45 } }).detail)
    .toBe("CLASS • BARBARIAN LV.45");

  expect(tray.sourceMeta({ source: { type: "archetype", id: "berserker", classId: "barbarian", requiredClassLevel: 15 } }).detail)
    .toBe("ARCHETYPE • BERSERKER · BARBARIAN LV.15");
});

test("los filtros no eliminan Traits pasivas de la colección", () => {
  const traits = [
    { id: "racial", source: { type: "race", id: "lizalin" }, activation: { type: "passive" } },
    { id: "class", source: { type: "class", id: "barbarian" }, activation: { type: "manual" } },
    { id: "general", source: { type: "general", id: "alert" }, activation: { type: "passive" } },
  ];

  expect(tray.filterTraits(traits, "all")).toHaveLength(3);
  expect(tray.filterTraits(traits, "racial").map((trait) => trait.id)).toEqual(["racial"]);
  expect(tray.filterTraits(traits, "general").map((trait) => trait.id)).toEqual(["general"]);
});

test("la UI declara Stats y Traits y carga su stylesheet dedicado", () => {
  const js = read("js/trait-player-tray.js");
  const css = read("css/player-trait-tabs.css");

  expect(js).toContain('["stats", "Stats"]');
  expect(js).toContain('["traits", "Traits"]');
  expect(js).toContain('css/player-trait-tabs.css');
  expect(js).toContain('player-trait-filter');
  expect(css).toContain('.player-stats-view-tab');
  expect(css).toContain('.player-trait-card[data-trait-category="racial"]');
  expect(css).toContain('.player-trait-card[data-trait-category="class"]');
  expect(css).toContain('.player-trait-card[data-trait-category="general"]');
});
