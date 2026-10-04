import assert from "node:assert/strict";
import fs from "node:fs";

function loadScript(path) {
  const source = fs.readFileSync(path, "utf8");
  new Function(source)();
}

function renderResolvedText(api, trait, runtime) {
  const resolved = api.resolveTraitDisplay(trait, runtime);
  let text = resolved?.template || String(trait?.description || "");
  for (const [id, value] of Object.entries(resolved?.values || {})) {
    text = text.split("{" + id + "}").join(value.display);
  }
  if (resolved?.extras?.length) {
    text += " | " + resolved.extras.map((value) => value.label + "=" + value.display).join(" · ");
  }
  return { resolved, text };
}

loadScript("js/trait-engine.js");
loadScript("js/trait-player-tray.js");
loadScript("js/trait-catalog-core.js");

[
  "js/barbarian-class-runtime.js",
  "js/bard-class-runtime.js",
  "js/fighter-class-runtime.js",
  "js/monk-class-runtime.js",
  "js/ranger-class-runtime.js",
  "js/rogue-class-runtime.js",
  "js/sorcerer-class-runtime.js",
  "js/wizard-class-runtime.js",
  "js/banneret-archetype-runtime.js",
  "js/battle-master-archetype-runtime.js",
  "js/bilgewater-buccaneer-archetype-runtime.js",
  "js/bilgewater-demolisher-archetype-runtime.js",
  "js/bladesinger-archetype-runtime.js",
  "js/champion-archetype-runtime.js",
  "js/mastermind-archetype-runtime.js",
  "js/path-of-the-zealot-archetype-runtime.js",
  "js/samurai-archetype-runtime.js",
].forEach(loadScript);

const api = globalThis.LuminousTraitPlayerTray;
const catalog = globalThis.LuminousTraitCatalogCore;
assert.ok(api, "LuminousTraitPlayerTray must load.");
assert.ok(catalog, "LuminousTraitCatalogCore must load.");
assert.equal(typeof api.descriptionFormulaCandidates, "function", "Description formula parser must be exported.");

const classLevels = Object.fromEntries(
  ["barbarian", "bard", "fighter", "monk", "ranger", "rogue", "sorcerer", "wizard"].map((id) => [id, 100]),
);
const runtime = {
  context: "theatre",
  character: {
    level: 100,
    classLevels,
    stats: {
      fuerza: 24,
      destreza: 24,
      constitucion: 24,
      inteligencia: 24,
      sabiduria: 24,
      carisma: 24,
    },
    combatStats: {
      hp_max: 500,
      hp_actual: 500,
      sp_max: 100,
      sp_actual: 100,
      offensiveLevel: 100,
      defensiveLevel: 100,
      minSpeed: 3,
      maxSpeed: 8,
    },
  },
};

const definitions = catalog.DEFINITIONS || {};
assert.ok(Object.keys(definitions).length >= 80, "Expected the current class/archetype catalog to be loaded.");

let formulaBearingTraits = 0;
const leftovers = [];

for (const [id, trait] of Object.entries(definitions)) {
  const before = api.descriptionFormulaCandidates(trait.description || "", trait);
  if (!before.length) continue;
  formulaBearingTraits += 1;

  const { text } = renderResolvedText(api, trait, runtime);
  const remaining = api.descriptionFormulaCandidates(text, trait);
  if (remaining.length) {
    leftovers.push({
      id,
      text,
      formulas: remaining.map((candidate) => candidate.raw),
    });
  }
}

assert.ok(
  formulaBearingTraits >= 16,
  "Expected broad real-catalog formula coverage; found only " + formulaBearingTraits + " formula-bearing Traits.",
);
assert.deepEqual(leftovers, [], "No recognized player-facing formula may remain after shared display resolution.");

const armorless = renderResolvedText(api, definitions.armorless_defense, runtime).text;
assert.match(armorless, /Gain \+7 Defensive Level\./);
assert.match(armorless, /Gain 100% Max HP as Shield/);
assert.doesNotMatch(armorless, /stitution Mod/);

const rage = renderResolvedText(api, definitions.rage, runtime).text;
assert.match(rage, /Rage scaling use Barbarian Class Level/);
assert.match(rage, /Uses=14/);
assert.match(rage, /Final Power=3/);

const cunning = renderResolvedText(api, definitions.cunning_action, runtime).text;
assert.match(cunning, /Gain \+5 Max Speed, \+10 Defense Power/);
assert.doesNotMatch(cunning, /\b(?:max|floor)\s*\(/i);

const zealotSynthetic = {
  id: "zealot_contract_formula",
  name: "Zealot Contract Formula",
  description: "Gain floor(Class Level / 4) Shield.",
  source: {
    type: "archetype",
    id: "path_of_the_zealot",
    archetypeId: "path_of_the_zealot",
    classId: "barbarian",
    className: "Barbarian",
  },
  contexts: ["any"],
  activation: { type: "passive", actionCost: "none" },
  effects: [],
  rules: [],
  mechanics: { shieldFormula: "floor(ClassLevel / 4)" },
};
const zealotRuntime = {
  context: "theatre",
  character: {
    level: 28,
    classLevels: { barbarian: 28 },
    stats: runtime.character.stats,
  },
};
const zealotText = renderResolvedText(api, zealotSynthetic, zealotRuntime).text;
assert.match(zealotText, /Gain 7 Shield/);

const dynamicSynthetic = {
  id: "dynamic_slot_contract",
  name: "Dynamic Slot Contract",
  description: "Reduce Damage by 10% × Spell Slot Level.",
  source: { type: "archetype", id: "bladesinger", classId: "wizard", className: "Wizard" },
  contexts: ["any"],
  activation: { type: "passive", actionCost: "none" },
  effects: [],
  rules: [],
  mechanics: { damageReductionPercentFormula: "10 * SpellSlotLevel" },
};
const dynamic = renderResolvedText(api, dynamicSynthetic, runtime);
assert.match(dynamic.text, /pending/);
assert.doesNotMatch(dynamic.text, /Spell Slot Level/);
assert.equal(
  Object.values(dynamic.resolved?.values || {})[0]?.pending,
  true,
  "A formula that needs an unselected Spell Slot must remain pending rather than resolve from the engine's zero fallback.",
);

const powerSynthetic = {
  id: "power_contract",
  name: "Power Contract",
  description: "Gain WIS Mod ^ 2 Shield.",
  source: { type: "class", id: "ranger", classId: "ranger", className: "Ranger" },
  contexts: ["any"],
  activation: { type: "passive", actionCost: "none" },
  effects: [],
  rules: [],
  mechanics: {},
};
const powerText = renderResolvedText(api, powerSynthetic, runtime).text;
assert.match(powerText, /Gain 49 Shield/);
assert.doesNotMatch(powerText, /WIS Mod|\^/);

console.log(
  "Trait formula display contract passed:",
  Object.keys(definitions).length + " definitions,",
  formulaBearingTraits + " formula-bearing descriptions, 0 unresolved formulas.",
);
