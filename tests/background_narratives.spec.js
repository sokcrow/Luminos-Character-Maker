"use strict";

const assert = require("node:assert/strict");
const rulesModule = require("../js/character-build-rules.js");
const rules = rulesModule?.BACKGROUNDS ? rulesModule : globalThis.LuminousCharacterBuildRules;
const catalog = require("../js/background-narratives/catalog.js");

assert.ok(rules?.BACKGROUNDS, "character-build-rules debe exponer su API por CommonJS o globalThis");

require("../js/background-narratives/templates-meta.js");
require("../js/background-narratives/templates-ideal.js");
require("../js/background-narratives/templates-other.js");
require("../js/background-narratives/templates-runtime.js");

for (const file of [
  "civilian-labor",
  "backstreets-fixers",
  "associations-workshops",
  "syndicates-fingers",
  "greatlake-outskirts",
  "wings-war",
  "lobotomy-anomaly",
  "hcorp-social",
]) {
  require(`../js/background-narratives/${file}.js`);
}

const entries = catalog.all();
assert.equal(entries.length, 158, "el catálogo narrativo debe contener exactamente 158 trasfondos");
assert.equal(new Set(entries.map((entry) => entry.id)).size, 158, "no debe haber IDs narrativos duplicados");

const validation = catalog.validate({ expectedCount: 158 });
assert.equal(validation.valid, true, validation.errors.join("\n"));
assert.deepEqual(validation.errors, []);

for (const entry of entries) {
  assert.equal(entry.ideals.length, 7, `${entry.id}: requiere 7 ideales`);
  assert.equal(entry.bonds.length, 7, `${entry.id}: requiere 7 vínculos`);
  assert.equal(entry.flaws.length, 7, `${entry.id}: requiere 7 defectos`);
  assert.equal(entry.customChoice?.custom, true, `${entry.id}: requiere opción personalizada`);
  assert.ok(entry.overview.length > 40, `${entry.id}: overview demasiado corto`);
  assert.ok(entry.trait.name && entry.trait.description, `${entry.id}: Trait incompleto`);
  assert.ok(entry.feature.name && entry.feature.description, `${entry.id}: Feature incompleto`);
  assert.ok(entry.feature.limits, `${entry.id}: límites narrativos ausentes`);
  for (const group of [entry.ideals, entry.bonds, entry.flaws]) {
    for (const choice of group) {
      assert.ok(choice.label, `${entry.id}: opción sin label`);
      assert.ok(choice.description.length > 80, `${entry.id}: opción narrativa sin explicación amplia`);
    }
  }
}

for (const id of ["house_spiders_apprentice", "house_spiders_survivor"]) {
  assert.equal(catalog.get(id), null, `${id} no debe existir en el catálogo narrativo`);
}

const buildCatalog = catalog.buildBackgroundCatalog(rules.BACKGROUNDS);
assert.equal(buildCatalog.length, 158, "el catálogo de build adaptado debe producir 158 trasfondos");
assert.equal(new Set(buildCatalog.map((entry) => entry.id)).size, 158, "el catálogo de build no debe duplicar IDs");
assert.ok(!buildCatalog.some((entry) => entry.id.startsWith("house_spiders")), "House of Spiders debe quedar fuera del build adaptado");
assert.equal(buildCatalog.filter((entry) => entry.category === "social").length, 15, "deben existir 15 trasfondos Social");

// El parche narrativo no rebalancea los coeficientes de los trasfondos existentes.
assert.equal(
  buildCatalog.find((entry) => entry.id === "chef").hpCoefBonus,
  rules.getBackground("chef").hpCoefBonus,
  "Chef debe conservar su HP Coef existente",
);
assert.equal(
  buildCatalog.find((entry) => entry.id === "industrial_worker").hpCoefBonus,
  rules.getBackground("industrial_worker").hpCoefBonus,
  "Industrial Worker debe conservar su HP Coef existente",
);

// Guardas de canon sensibles que no deben degradarse en futuras ediciones.
assert.equal(buildCatalog.find((entry) => entry.id === "eight_explorer").name, "Eight Association Fixer");
assert.equal(catalog.get("pinky_operator").feature.name, "Deep Cover");
assert.match(catalog.get("pinky_operator").feature.limits, /red automática/i);
assert.match(catalog.get("heishou_trainee").feature.limits, /Branch/i);
assert.match(catalog.get("w_cleanup_l4").feature.limits, /CCA/i);
assert.match(catalog.get("navigator").feature.limits, /Laws/i);
assert.match(catalog.get("pequod_survivor").feature.limits, /Pequod/i);

console.log(`background narrative contract: ${entries.length}/158 OK`);
