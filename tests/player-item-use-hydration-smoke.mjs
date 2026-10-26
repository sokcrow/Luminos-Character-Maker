import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

for (const key of [
  "LuminousContentRegistry",
  "LuminousItemRuntime",
  "LuminousItemInventoryRuntime",
  "LuminousHpHealingCatalog",
  "LuminousHybridHealingCatalog",
  "LuminousSpHealingCatalog",
  "LuminousStatusCureCatalog",
  "LuminousMedicalSupplyCatalog",
  "LuminousPlayerItemContentBootstrap",
]) delete globalThis[key];

const root = path.resolve(".");
const load = (file) => import(pathToFileURL(path.join(root, file)).href);

await load("js/item-runtime-engine.js");
await load("js/content-registry.js");
await load("js/item-catalog-hp-healing.js");
await load("js/item-catalog-hybrid-healing.js");
await load("js/item-catalog-sp-healing.js");
await load("js/item-catalog-status-cure.js");
await load("js/item-catalog-medical-supply.js");
await load("js/player-item-content-bootstrap.js");
await load("js/item-inventory-runtime.js");

const registry = globalThis.LuminousContentRegistry;
const runtime = globalThis.LuminousItemRuntime;
const bootstrap = globalThis.LuminousPlayerItemContentBootstrap;

assert.ok(registry);
assert.ok(runtime);
assert.ok(bootstrap);

for (const catalog of [
  globalThis.LuminousHpHealingCatalog,
  globalThis.LuminousHybridHealingCatalog,
  globalThis.LuminousSpHealingCatalog,
  globalThis.LuminousStatusCureCatalog,
  globalThis.LuminousMedicalSupplyCatalog,
]) {
  assert.ok(catalog?.ITEMS?.length > 0);
  const first = catalog.ITEMS[0];
  assert.ok(registry.get("item", first.id), `${first.id} must be registered for player-side hydration`);
}

const legacy = {
  schemaVersion: 3,
  instanceId: "legacy_heal_stack",
  definitionId: "hp_generic_pocket_recovery_patch",
  quantity: 2,
  cantidad: 2,
};

assert.equal(runtime.hasFunction(legacy, "use"), false, "raw legacy shell has no executable runtime by itself");

const hydrated = runtime.resolveItem(legacy);
assert.ok(hydrated?.runtime?.healing, "definitionId must hydrate runtime.healing from the canonical catalog");
assert.equal(runtime.hasFunction(hydrated, "use"), true, "hydrated healing item must expose USE");

const player = {
  id: "Player",
  hp: 50,
  hp_max: 180,
  inventario_activo: {
    legacy_heal_stack: legacy,
  },
  inventario_stash: {},
};

const result = runtime.useItem(player, legacy, { ignoreActionCost: true });
assert.equal(result.used, true, "legacy healing shell must become usable through canonical hydration");
assert.equal(player.hp, 57, "50/180 HP must heal to 57/180 with floor rounding");
assert.equal(legacy.quantity, 1, "resolved use must sync quantity back to the owned stack");
assert.equal(legacy.cantidad, 1, "resolved use must keep legacy quantity mirror synchronized");

const emptyConsumable = {
  schemaVersion: 3,
  instanceId: "empty_consumable",
  definitionId: "not_a_registered_functional_item",
  category: "consumable",
  itemType: "consumable",
  quantity: 1,
  cantidad: 1,
};

assert.equal(runtime.hasFunction(emptyConsumable, "use"), false, "consumable category alone must not imply USE");
const emptyUse = runtime.useItem(
  {
    hp: 50,
    hp_max: 180,
    inventario_activo: { empty_consumable: emptyConsumable },
    inventario_stash: {},
  },
  emptyConsumable,
  { ignoreActionCost: true },
);
assert.equal(emptyUse.used, false);
assert.equal(emptyUse.reason, "item_not_usable");
assert.equal(emptyConsumable.quantity, 1);
assert.equal(emptyConsumable.cantidad, 1);

const html = fs.readFileSync(path.join(root, "hoja_personaje.html"), "utf8");
const requiredOrder = [
  "js/content-registry.js",
  "js/item-catalog-hp-healing.js",
  "js/item-catalog-hybrid-healing.js",
  "js/item-catalog-sp-healing.js",
  "js/item-catalog-status-cure.js",
  "js/item-catalog-medical-supply.js",
  "js/player-item-content-bootstrap.js",
  "js/item-inventory-runtime.js",
];
for (let index = 1; index < requiredOrder.length; index += 1) {
  assert.ok(
    html.indexOf(requiredOrder[index - 1]) < html.indexOf(requiredOrder[index]),
    `${requiredOrder[index - 1]} must load before ${requiredOrder[index]}`,
  );
}

const hud = fs.readFileSync(path.join(root, "js/inventory-hud-v2.js"), "utf8");
assert.match(
  hud,
  /const functionalItem = runtime\(\)\?\.resolveItem\?\.\(item\) \|\| item;[\s\S]*const canUse = runtime\(\)\?\.hasFunction\?\.\(functionalItem, "use"\) === true;/,
  "HUD USE button must be based on the hydrated functional definition",
);
assert.doesNotMatch(
  hud,
  /hasFunction\?\.\(item, "use"\) \|\| itemCategory\(item\)\.toLowerCase\(\) === "consumable"/,
  "HUD must not show USE to every consumable",
);

console.log("player item use hydration smoke: OK (legacy shell 50/180 -> 57/180, empty consumable hidden)");
