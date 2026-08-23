const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const engine = require(path.join(__dirname, "..", "js", "trait-engine.js"));
const tray = require(path.join(__dirname, "..", "js", "trait-player-tray.js"));
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("Traits se clasifican por origen para la pestaña del jugador", () => {
  const cases = [
    [{ source: { type: "race", id: "lizalin" } }, "racial"],
    [{ source: { type: "class", id: "barbarian" } }, "class"],
    [{ source: { type: "archetype", id: "berserker", classId: "barbarian" } }, "archetype"],
    [{ source: { type: "background", id: "soldier" } }, "background"],
    [{ source: { type: "general", id: "alert" } }, "general"],
    [{ category: "general", source: { type: "special", id: "alert" } }, "general"],
    [{ source: { type: "special", id: "campaign" } }, "other"],
  ];

  cases.forEach(([trait, expected]) => expect(tray.sourceCategory(trait)).toBe(expected));
});

test("Traits Generales por category sobreviven normalizeTrait", () => {
  const normalized = engine.normalizeTrait({
    id: "alert",
    name: "Alert",
    category: "general",
    activation: { type: "passive", actionCost: "none" },
  });

  expect(normalized.source.type).toBe("special");
  expect(tray.sourceCategory(normalized)).toBe("general");
});

test("la etiqueta conserva origen, clase padre y nivel cuando existen", () => {
  expect(tray.sourceMeta({ source: { type: "class", id: "barbarian", requiredLevel: 45 } }).detail)
    .toBe("CLASS • BARBARIAN LV.45");

  expect(tray.sourceMeta({ source: { type: "archetype", id: "berserker", classId: "barbarian", requiredClassLevel: 15 } }).detail)
    .toBe("ARCHETYPE • BERSERKER · BARBARIAN LV.15");
});

test("el resolver preserva atLevel para metadata de Traits de Clase", () => {
  const patchedEngine = tray.preserveGrantMetadata(engine);
  const [trait] = patchedEngine.resolveTraitGrants(
    { classes: [{ classId: "barbarian", levels: 45 }] },
    [{
      id: "core_class_barbarian_l45_brutal_critical",
      sourceType: "class",
      sourceId: "barbarian",
      atLevel: 45,
      traitId: "brutal_critical",
      grantType: "trait",
    }],
    {
      brutal_critical: {
        id: "brutal_critical",
        name: "Brutal Critical",
        source: { type: "class", id: "barbarian", classId: "barbarian" },
        activation: { type: "passive", actionCost: "none" },
      },
    },
  );

  expect(trait.source.atLevel).toBe(45);
  expect(trait.source.requiredClassLevel).toBe(45);
  expect(tray.sourceMeta(trait).detail).toBe("CLASS • BARBARIAN LV.45");
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
  expect(js).toContain('requiredClassLevel');
  expect(css).toContain('.player-stats-view-tab');
  expect(css).toContain('.player-trait-card[data-trait-category="racial"]');
  expect(css).toContain('.player-trait-card[data-trait-category="class"]');
  expect(css).toContain('.player-trait-card[data-trait-category="general"]');
});
