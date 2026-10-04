import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(".");
for (const key of [
  "LuminousItemDescriptionEngine",
  "LuminousContentRegistry",
  "LuminousDmLocalItemManagerV3",
]) delete globalThis[key];

const load = (file) => import(pathToFileURL(path.join(root, file)).href);

await load("js/item-description-engine.js");
const descriptions = globalThis.LuminousItemDescriptionEngine;
assert.ok(descriptions);

const explicit = descriptions.enrich({
  id: "manual",
  name: "Manual Item",
  description: "Descripción escrita a mano.",
});
assert.equal(explicit.description, "Descripción escrita a mano.");
assert.equal(explicit.descripcion, "Descripción escrita a mano.");

const fixtures = [
  {
    label: "HP healing",
    item: { name:"Recovery Patch", family:"healing_hp", category:"consumable", runtime:{ healing:{ flat:2, maxHpPercent:3 } } },
    contains: /recuperar hp/i,
  },
  {
    label: "SP healing",
    item: { name:"Mind Ampoule", family:"healing_sp", category:"consumable", runtime:{ spHealing:{ immediate:4 } } },
    contains: /sp/i,
  },
  {
    label: "hybrid healing",
    item: { name:"Dual Recovery Kit", family:"healing_hybrid", category:"consumable", runtime:{ hybridHealing:{ hp:{}, sp:{} } } },
    contains: /hp y sp/i,
  },
  {
    label: "status cure",
    item: { name:"Status Cleanser", family:"status_cure", category:"consumable", runtime:{ handler:"status_cure", statusCure:{} } },
    contains: /estados perjudiciales/i,
  },
  {
    label: "medical supply",
    item: { name:"Trauma Kit", family:"medical_supply", category:"consumable", runtime:{ handler:"medical_supply", injuryTreatment:{} } },
    contains: /heridas|lesiones/i,
  },
  {
    label: "weapon",
    item: { name:"Longsword", family:"weapons", category:"weapon", itemType:"weapon", properties:["versatile"] },
    contains: /arma/i,
  },
  {
    label: "ranged weapon",
    item: { name:"Longbow", family:"weapons", category:"weapon", itemType:"weapon", properties:["ammunition","two_handed"] },
    contains: /distancia/i,
  },
  {
    label: "food",
    item: { name:"Cooked Meat", family:"food", category:"food", tags:["cooked","meat"] },
    contains: /comida|carne/i,
  },
  {
    label: "retail food",
    item: { name:"Cookie Pack", family:"retail_food", category:"food", tags:["cookie_pack"] },
    contains: /envasado|consumo directo/i,
  },
  {
    label: "tool",
    item: { name:"Cartographer's Tools", family:"tools", itemType:"tool", useTags:["mapping"] },
    contains: /herramientas/i,
  },
  {
    label: "raw chemical",
    item: { name:"Industrial Solvent", family:"chemical_raw", category:"material" },
    contains: /reactivo industrial/i,
  },
  {
    label: "raw medicinal",
    item: { name:"Medical Saline", family:"medicinal_raw", category:"material" },
    contains: /grado médico|materia prima/i,
  },
  {
    label: "ore",
    item: { name:"Iron Ore", family:"ore_ingot_gem", form:"raw_mineral", tags:["ore"] },
    contains: /mineral en bruto/i,
  },
  {
    label: "refined metal",
    item: { name:"Steel Ingot", family:"ore_ingot_gem", form:"refined_metal", tags:["ingot","metal_stock"] },
    contains: /metal refinado/i,
  },
  {
    label: "jewelry",
    item: { name:"Ring", family:"jewelry_valuables", kind:"jewelry", category:"equipment" },
    contains: /pieza ornamental/i,
  },
  {
    label: "valuable",
    item: { name:"Goblet", family:"jewelry_valuables", kind:"valuable", category:"valuable", tags:["treasure"] },
    contains: /objeto valioso/i,
  },
  {
    label: "creature hide",
    item: { name:"Wolf Pelt", family:"hide_pelt", category:"ingredient", tags:["pelt"] },
    contains: /piel|pelaje/i,
  },
  {
    label: "organ",
    item: { name:"Venom Gland", family:"organ_gland", category:"ingredient", tags:["gland"] },
    contains: /órgano|glándula/i,
  },
  {
    label: "weapon component",
    item: { name:"Long Blade", family:"weapon_components", category:"component", tags:["weapon_component"] },
    contains: /componente de arma/i,
  },
  {
    label: "upgrade",
    item: { name:"Serrated Edge", category:"status", group:"bleed_potency", slotCost:1, statusType:"bleed" },
    contains: /modificación/i,
  },
  {
    label: "ammo component",
    item: { name:"Firearm Projectile", family:"firearm_ammunition", itemType:"ammo_component", tags:["ammo_component"] },
    contains: /abstracto|munición/i,
  },
];

for (const fixture of fixtures) {
  const description = descriptions.describe(fixture.item);
  assert.ok(description.length >= 40, fixture.label + " should have a substantial player-facing description");
  assert.match(description, fixture.contains, fixture.label);
  assert.doesNotMatch(description, /sourceLine|instanceId|runtime\.|definitionId|recipeId/i, fixture.label + " must not leak implementation metadata");
}

const unknown = descriptions.describe({ name:"Unknown Object", id:"unknown_object" });
assert.ok(unknown.length >= 30, "unknown item fallback must still be player-readable");
assert.doesNotMatch(unknown, /sin descripción/i);

const catalogFiles = fs.readdirSync(path.join(root, "js"))
  .filter((name) => /^item-catalog-.*\.js$/.test(name))
  .sort();
assert.ok(catalogFiles.length >= 39, "expected the full item catalog surface");

for (const file of catalogFiles) {
  const source = fs.readFileSync(path.join(root, "js", file), "utf8");
  const families = [...source.matchAll(/const\s+FAMILY\s*=\s*["'`]([^"'\`]+)["'`]/g)].map((match) => match[1]);
  const fallbackFamily = file.replace(/^item-catalog-/, "").replace(/\.js$/, "").replace(/-/g, "_");
  const candidates = families.length ? families : [fallbackFamily];
  for (const family of candidates) {
    const description = descriptions.describe({ name:"Coverage Item", family, category:"item" });
    assert.ok(description.length >= 30, file + " / " + family + " must always receive a description");
  }
}

await load("js/content-registry.js");
const registry = globalThis.LuminousContentRegistry;
registry.clear();
const registered = registry.register({
  type:"item",
  id:"coverage_tool",
  name:"Coverage Tool",
  family:"tools",
  itemType:"tool",
  useTags:["repair"],
}, { source:"test" });
assert.ok(registered.definition.description);
assert.equal(registered.definition.description, registered.definition.descripcion);

await load("js/dm-local-item-manager-v3.js");
const dm = globalThis.LuminousDmLocalItemManagerV3;
const normalized = dm.normalizeDefinition({
  id:"coverage_material",
  name:"Coverage Material",
  family:"craft_components",
  category:"ingredient",
  itemType:"component",
  tags:["craft_component"],
}, { source:"test" });
assert.ok(normalized.description);
assert.equal(normalized.description, normalized.descripcion);

const hud = fs.readFileSync(path.join(root, "js/inventory-hud-v2.js"), "utf8");
assert.match(hud, /LuminousItemDescriptionEngine\?\.describe/, "HUD must use generated descriptions for legacy inventory items");

for (const file of ["hoja_personaje.html","pantalla_dm.html"]) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  assert.ok(html.includes("js/item-description-engine.js"), file + " must load the description engine");
}

console.log(`item description engine smoke: OK (${catalogFiles.length} catalog files + canonical/DM/HUD integration)`);
