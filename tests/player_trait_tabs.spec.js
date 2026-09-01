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

test("Hungry Jaws resuelve 13% y explica Level y CON Mod", () => {
  const trait = engine.normalizeTrait({
    id: "lizalin_hungry_jaws",
    name: "Hungry Jaws",
    description: "When Bite deals damage, gain Shield equal to (CON Mod + Level/4)% of that Bite damage.",
    source: { type: "race", id: "lizalin" },
    activation: { type: "automatic", actionCost: "none" },
  });
  const resolved = tray.resolveTraitDisplay(trait, {
    character: { level: 40, stats: { constitution: 16 } },
  });

  expect(resolved.values.shieldRate.display).toBe("13%");
  expect(resolved.values.shieldRate.formula).toBe("ConstitutionMod + Level / 4");
  expect(resolved.values.shieldRate.breakdown).toEqual(expect.arrayContaining([
    expect.objectContaining({ label: "CON Mod", display: "+3" }),
    expect.objectContaining({ label: "Level", display: "40" }),
  ]));
});

test("los valores resueltos se recalculan y no quedan cacheados", () => {
  const trait = { id: "lizalin_hungry_jaws", source: { type: "race", id: "lizalin" } };
  const first = tray.resolveTraitDisplay(trait, { character: { level: 40, stats: { constitution: 16 } } });
  const second = tray.resolveTraitDisplay(trait, { character: { level: 80, stats: { constitution: 20 } } });

  expect(first.values.shieldRate.display).toBe("13%");
  expect(second.values.shieldRate.display).toBe("25%");
});

test("sin display o con formula insegura hace fallback sin NaN ni valores inventados", () => {
  expect(tray.resolveTraitDisplay({ id: "plain_trait", description: "Plain rule." }, { character: { level: 20 } })).toBeNull();

  const unsafe = {
    id: "event_only_preview",
    display: {
      playerDescription: "Gain {shield} Shield.",
      resolvedValues: [{ id: "shield", formula: "DamageDealt + Level" }],
    },
  };
  expect(tray.resolveTraitDisplay(unsafe, { character: { level: 20 } })).toBeNull();

  const invalid = {
    id: "invalid_preview",
    display: {
      playerDescription: "Gain {amount}.",
      resolvedValues: [{ id: "amount", formula: "Level + )" }],
    },
  };
  expect(tray.resolveTraitDisplay(invalid, { character: { level: 20 } })).toBeNull();
});

test("ClassLevel usa la clase fuente correcta al multiclasear", () => {
  const trait = {
    id: "class_scaling_preview",
    source: { type: "class", id: "barbarian", classId: "barbarian" },
    display: {
      playerDescription: "Gain {bonus} bonus.",
      resolvedValues: [{ id: "bonus", label: "Class Bonus", formula: "ClassLevel / 5", signed: true }],
    },
  };
  const resolved = tray.resolveTraitDisplay(trait, {
    character: {
      level: 65,
      classes: [
        { classId: "barbarian", levels: 25 },
        { classId: "wizard", levels: 40 },
      ],
    },
  });

  expect(resolved.values.bonus.display).toBe("+5");
  expect(resolved.values.bonus.breakdown).toEqual(expect.arrayContaining([
    expect.objectContaining({ label: "Class Level", display: "25" }),
  ]));
});

test("Yuan-ti affinity y Healing Hands muestran resultados actuales", () => {
  const affinity = tray.resolveTraitDisplay(
    { id: "yuan_ti_wrath_affinity", source: { type: "race", id: "yuan_ti_pureblood" } },
    { character: { level: 80 } },
  );
  expect(affinity.values.sinBonus.display).toBe("+20%");

  const healing = tray.resolveTraitDisplay(
    { id: "aasimar_healing_hands", source: { type: "race", id: "aasimar" } },
    { character: { level: 40, stats: { constitution: 16 } } },
  );
  expect(healing.values.healing.display).toBe("23 HP");
});

test("tooltip declara hover, focus, click/tap, Escape y ARIA sin requerir browser en CI", () => {
  const js = read("js/trait-player-tray.js");
  const css = read("css/player-trait-tabs.css");

  expect(js).toContain('control.addEventListener("click"');
  expect(js).toContain('event.stopPropagation()');
  expect(js).toContain('event.key !== "Escape"');
  expect(js).toContain('control.setAttribute("aria-expanded"');
  expect(js).toContain('tooltip.setAttribute("role", "tooltip")');
  expect(js).toContain('control.setAttribute("aria-describedby"');
  expect(css).toContain('.player-trait-resolved-value:hover .player-trait-formula-tooltip');
  expect(css).toContain('.player-trait-resolved-value:focus .player-trait-formula-tooltip');
  expect(css).toContain('.player-trait-resolved-value.is-open .player-trait-formula-tooltip');
});

test("la UI declara Stats y Traits y carga su stylesheet dedicado", () => {
  const js = read("js/trait-player-tray.js");
  const css = read("css/player-trait-tabs.css");

  expect(js).toContain('["stats", "Stats"]');
  expect(js).toContain('["traits", "Traits"]');
  expect(js).toContain('css/player-trait-tabs.css');
  expect(js).toContain('player-trait-filter');
  expect(js).toContain('requiredClassLevel');
  expect(js).toContain('player-trait-resolved-value');
  expect(js).toContain('player-trait-formula-tooltip');
  expect(css).toContain('.player-stats-view-tab');
  expect(css).toContain('.player-trait-card[data-trait-category="racial"]');
  expect(css).toContain('.player-trait-card[data-trait-category="class"]');
  expect(css).toContain('.player-trait-card[data-trait-category="general"]');
  expect(css).toContain('.player-trait-resolved-value');
  expect(css).toContain('.player-trait-formula-tooltip');
});
