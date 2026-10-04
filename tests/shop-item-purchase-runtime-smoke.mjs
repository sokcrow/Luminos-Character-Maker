import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

for (const key of [
  "LuminousShopItemPurchaseRuntime",
  "LuminousItemRuntime",
]) delete globalThis[key];

await import(pathToFileURL(path.resolve("js/shop-item-purchase-runtime.js")).href);
await import(pathToFileURL(path.resolve("js/item-runtime-engine.js")).href);

const shop = globalThis.LuminousShopItemPurchaseRuntime;
const runtime = globalThis.LuminousItemRuntime;
assert.ok(shop);
assert.ok(runtime);

const definitionId = "hp_generic_pocket_recovery_patch";
const storeItem = {
  id: definitionId,
  definitionId,
  canonicalId: definitionId,
  nombre: "Pocket Recovery Patch",
  name: "Pocket Recovery Patch",
  category: "consumable",
  itemType: "consumable",
  family: "healing_hp",
  tier: "I",
  quantity: 99,
  cantidad: 99,
  stock_actual: 12,
  stock_maximo: 12,
  requisito_aparicion: "Siempre",
  runtime: {
    actionCost: "action",
    targetMode: "self",
    consumeQty: 1,
    healing: {
      flat: 2,
      maxHpPercent: 3,
      capMaxHpPercent: 30,
    },
  },
};

const fakeInventoryRuntime = {
  createItemInstance(definition, options) {
    // Mirrors the compact inventory instance shape: instance metadata is kept,
    // while the canonical runtime behavior must survive from the definition.
    return {
      schemaVersion: 3,
      instanceId: "shop_purchase_1",
      definitionId: definition.definitionId,
      quantity: options.quantity,
      qualityTier: 1,
      condition: 100,
      conditionMax: 100,
      currentOwnerId: options.currentOwnerId,
      runtimeState: {},
      customData: {},
      variantData: {},
    };
  },
};

const purchased = shop.buildPurchasePayload(
  definitionId,
  storeItem,
  "Player",
  { inventoryRuntime: fakeInventoryRuntime },
);

assert.deepEqual(purchased.runtime, storeItem.runtime, "shop purchase must keep runtime.healing");
assert.equal(purchased.category, "consumable");
assert.equal(purchased.itemType, "consumable");
assert.equal(purchased.family, "healing_hp");
assert.equal(purchased.quantity, 1);
assert.equal(purchased.cantidad, 1);
assert.equal(purchased.currentOwnerId, "Player");
assert.equal(purchased.stock_actual, undefined);
assert.equal(purchased.stock_maximo, undefined);
assert.equal(purchased.requisito_aparicion, undefined);

const legacyBrokenStack = {
  id: definitionId,
  instanceId: "legacy_stack",
  nombre: "Pocket Recovery Patch",
  tier: "I",
  cantidad: 2,
};

const repaired = shop.mergePurchasedStack(legacyBrokenStack, purchased, 1);
assert.equal(repaired.instanceId, "legacy_stack", "repair must preserve the owned instance identity");
assert.equal(repaired.quantity, 3);
assert.equal(repaired.cantidad, 3);
assert.equal(repaired.category, "consumable");
assert.equal(repaired.family, "healing_hp");
assert.deepEqual(repaired.runtime, storeItem.runtime, "buying into a legacy stack must restore missing runtime");

const player = {
  id: "Player",
  hp: 50,
  hp_max: 180,
  inventario_activo: { legacy_stack: repaired },
};
const use = runtime.useItem(player, repaired, { ignoreActionCost: true });
assert.equal(use.used, true, "a purchased healing item must be usable at 50/180 HP");
assert.equal(player.hp, 57.4);
assert.equal(repaired.quantity, 2);

const broken = {
  instanceId: "broken_consumable",
  definitionId: "broken_consumable",
  category: "consumable",
  quantity: 1,
};
const brokenUse = runtime.useItem(
  { hp: 50, hp_max: 180, inventario_activo: { broken_consumable: broken } },
  broken,
  { ignoreActionCost: true },
);
assert.equal(brokenUse.used, false);
assert.equal(brokenUse.reason, "item_has_no_runtime_effect");
assert.equal(broken.quantity, 1);

const fullHpItem = shop.buildPurchasePayload(
  definitionId,
  storeItem,
  "FullHpPlayer",
  { inventoryRuntime: fakeInventoryRuntime },
);
const fullHpUse = runtime.useItem(
  { hp: 180, hp_max: 180, inventario_activo: { [fullHpItem.instanceId]: fullHpItem } },
  fullHpItem,
  { ignoreActionCost: true },
);
assert.equal(fullHpUse.used, false);
assert.equal(fullHpUse.reason, "hp_already_full");
assert.equal(fullHpItem.quantity, 1);

console.log("shop item purchase runtime smoke: OK (50/180 HP heal + legacy stack repair)");
