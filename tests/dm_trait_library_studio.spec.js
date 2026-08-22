const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const studio = require("../js/dm-trait-library-studio.js");
const engine = require("../js/trait-engine.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("Grant de clase normaliza nivel y conserva identidad determinista", () => {
  const grant = studio.normalizeGrant({ sourceType: "Class", sourceId: "Barbarian", traitId: "Rage", atLevel: 5 });
  expect(grant).toEqual({ sourceType: "class", sourceId: "barbarian", traitId: "rage", atLevel: 5 });
  expect(studio.grantIdentity(grant)).toBe("class:barbarian:rage:5");
  expect(studio.validateGrant(grant).valid).toBe(true);
});

test("Grant de clase rechaza niveles inválidos en lugar de corregirlos silenciosamente", () => {
  for (const atLevel of [0, 101, "abc", 1.5]) {
    const validation = studio.validateGrant({ sourceType: "class", sourceId: "barbarian", traitId: "rage", atLevel });
    expect(validation.valid).toBe(false);
    expect(validation.errors.join(" ")).toContain("atLevel");
  }

  expect(studio.normalizeGrant({ sourceType: "class", sourceId: "barbarian", traitId: "rage", atLevel: 101 }).atLevel).toBe(101);
});

test("Grant racial no hereda atLevel porque el nivel solo pertenece a clases", () => {
  const grant = studio.normalizeGrant({ sourceType: "race", sourceId: "tiefling", traitId: "infernal_touch", atLevel: 99 });
  expect(grant).toEqual({ sourceType: "race", sourceId: "tiefling", traitId: "infernal_touch" });
  expect(studio.grantIdentity(grant)).toBe("race:tiefling:infernal_touch:0");
});

test("validator de Grants rechaza fuente, trait o source vacíos", () => {
  const invalid = studio.validateGrant({ sourceType: "item", sourceId: "", traitId: "" });
  expect(invalid.valid).toBe(false);
  expect(invalid.errors.join(" ")).toContain("Unsupported grant source");
  expect(invalid.errors.join(" ")).toContain("sourceId");
  expect(invalid.errors.join(" ")).toContain("traitId");
});

test("Grants resuelven desde characterBuild tal como se persiste el jugador real", () => {
  const player = {
    level: 10,
    raceId: "legacy_race",
    backgroundId: "legacy_background",
    characterBuild: {
      calculatedAtLevel: 10,
      classes: [{ classId: "barbarian", levels: 5 }, { classId: "fighter", levels: 5 }],
      raceId: "tiefling",
      backgroundId: "chef",
    },
  };
  const catalog = {
    rage: { id: "rage", name: "Rage", source: { type: "class", id: "barbarian" } },
    infernal_touch: { id: "infernal_touch", name: "Infernal Touch", source: { type: "race", id: "tiefling" } },
    chef_passion: { id: "chef_passion", name: "Chef Passion", source: { type: "background", id: "chef" } },
  };
  const grants = [
    studio.normalizeGrant({ sourceType: "class", sourceId: "barbarian", atLevel: 5, traitId: "rage" }),
    studio.normalizeGrant({ sourceType: "race", sourceId: "tiefling", traitId: "infernal_touch" }),
    studio.normalizeGrant({ sourceType: "background", sourceId: "chef", traitId: "chef_passion" }),
  ];
  const character = studio.normalizeCharacterForGrantResolution(player);

  expect(character.classes).toEqual(player.characterBuild.classes);
  expect(character.raceId).toBe("tiefling");
  expect(character.backgroundId).toBe("chef");
  expect(engine.resolveTraitGrants(character, grants, catalog).map((trait) => trait.id)).toEqual(["rage", "infernal_touch", "chef_passion"]);
});

test("editar una definición conserva createdAt y solo actualiza updatedAt", () => {
  const trait = { id: "rage", name: "Rage" };
  const existing = { ...trait, createdAt: 111, updatedAt: 222 };
  expect(studio.buildDefinitionPayload(trait, existing, 333)).toEqual({
    id: "rage",
    name: "Rage",
    createdAt: 111,
    updatedAt: 333,
  });

  expect(studio.buildDefinitionPayload(trait, null, 444)).toEqual({
    id: "rage",
    name: "Rage",
    createdAt: 444,
    updatedAt: 444,
  });
});

test("Trait Library reutiliza campaña/config, que ya es DM-only, sin ampliar reglas Firebase", () => {
  expect(studio.TRAITS_ROOT).toBe("campaña/config/traits");
  expect(studio.DEFINITIONS_ROOT).toBe("campaña/config/traits/definitions");
  expect(studio.GRANTS_ROOT).toBe("campaña/config/traits/grants");
  const rules = JSON.parse(read("database.rules.json"));
  expect(rules.rules["campaña"].config[".write"]).toContain("auth.uid");
});

test("panel DM carga Trait Studio desde utils sin editar pantalla_dm.html", () => {
  const utils = read("js/utils.js");
  expect(utils).toContain("ensureDmTraitLibraryAssets");
  expect(utils).toContain("css/dm-trait-library-studio.css");
  expect(utils).toContain("js/dm-trait-library-studio.js");
  expect(utils).toContain("js/trait-engine.js");

  const dashboard = read("pantalla_dm.html");
  expect(dashboard).not.toContain("dm-trait-library-studio.js");
});
