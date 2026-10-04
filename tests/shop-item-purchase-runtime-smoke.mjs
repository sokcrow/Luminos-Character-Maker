import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

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
  costo: 2000,
  quantity: 99,
  cantidad: 99,
  stock_actual: 12,
  stock_maximo: 12,
  requisito_aparicion: "Siempre",
  shop_price_ahn: 123456,
  shop_stock_auto: true,
  shop_runtime_version: 1,
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
assert.equal(purchased.valorBase, 2000, "shop cost must survive as the owned item's resale base value");
assert.equal(purchased.stock_actual, undefined);
assert.equal(purchased.stock_maximo, undefined);
assert.equal(purchased.requisito_aparicion, undefined);
assert.equal(purchased.shop_price_ahn, undefined);
assert.equal(purchased.shop_stock_auto, undefined);
assert.equal(purchased.shop_runtime_version, undefined);

const legacyBrokenStack = {
  id: definitionId,
  instanceId: "legacy_stack",
  nombre: "Pocket Recovery Patch",
  tier: 1,
  cantidad: 2,
};

assert.equal(shop.sameTier(legacyBrokenStack.tier, storeItem.tier), true, "legacy numeric tier must match canonical roman tier");

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
assert.equal(player.hp, 57, "HP healing must floor fractional recovery");
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
assert.equal(brokenUse.reason, "item_not_usable");
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

const playerSource = fs.readFileSync(path.resolve("hoja_personaje.js"), "utf8");
const playerCss = fs.readFileSync(path.resolve("hoja_personaje.css"), "utf8");
const playerHtml = fs.readFileSync(path.resolve("hoja_personaje.html"), "utf8");
const dmHtml = fs.readFileSync(path.resolve("pantalla_dm.html"), "utf8");

assert.match(
  playerCss,
  /\.shop-modal-content\s*\{[\s\S]*?width:\s*70%;[\s\S]*?max-width:\s*840px;[\s\S]*?height:\s*60vh;/,
  "desktop physical Shop HUD must remain about 30% smaller than the previous 95% / 1200px / 85vh shell",
);
assert.match(
  playerSource,
  /physicalShopBalance[\s\S]*?campaña\/jugadores\/\$\{playerId\}[\s\S]*?canonicalPlayerBalance/,
  "physical Shop footer must bind to the canonical Player record instead of a local/debug number",
);
assert.match(
  playerSource,
  /finance\?\.currentBalance !== undefined[\s\S]*?Number\(playerData\.finance\.currentBalance\)[\s\S]*?Number\(playerData\.ahn\)/,
  "Shop balance resolution must prefer finance.currentBalance with legacy ahn fallback",
);
assert.match(
  playerSource,
  /campaña\/jugadores\/\$\{accountId\}\/ahn[\s\S]*?campaña\/jugadores\/\$\{accountId\}\/finance\/currentBalance/,
  "physical purchases must synchronize legacy ahn and finance.currentBalance",
);
assert.ok(
  playerHtml.includes("hoja_personaje.css?v=20261004-shop-commerce-1") &&
  playerHtml.includes("hoja_personaje.js?v=20261004-shop-commerce-1"),
  "Shop HUD/balance changes must be cache-busted in the deployed player sheet",
);
assert.match(
  playerHtml,
  /shop-mode-tabs[\s\S]*?shop-footer-buy-mode[\s\S]*?COMPRAR[\s\S]*?shop-footer-sell-mode[\s\S]*?VENDER/,
  "physical Shop must expose Comprar/Vender as visible mode tabs",
);
assert.match(
  playerSource,
  /setPhysicalShopMode\("sell"\)[\s\S]*?renderizarGridVentaFisica/,
  "Vender tab must switch the physical Shop into Stash resale mode",
);
assert.match(
  playerSource,
  /campaña\/jugadores\/\$\{accountId\}\/inventario_stash/,
  "physical Shop inventory reads/writes must use the canonical player account path",
);
assert.match(
  playerHtml,
  /id="market-event-overlay"[\s\S]*?MERCADO[\s\S]*?id="market-event-lines"/,
  "player sheet must expose the market world-change HUD",
);
assert.match(
  playerSource,
  /campaña\/economia\/market_event[\s\S]*?setMarketEvent[\s\S]*?showMarketEventHud/,
  "player must bind market events to Shop Runtime and the HUD",
);
assert.match(
  playerCss,
  /\.market-event-percent\.discount[\s\S]*?#54e86e[\s\S]*?\.market-event-percent\.surcharge[\s\S]*?#ff4e5b/,
  "market HUD must distinguish discounts in green and surcharges in red",
);
assert.match(
  playerSource,
  /Variación de precios[\s\S]*?cambios de oferta y demanda/,
  "player-facing market fallback copy must stay diegetic",
);
assert.doesNotMatch(
  playerSource,
  /El DM ha activado|DM activó|DM hizo/,
  "player-facing market HUD must never expose the DM as an in-world cause",
);
assert.match(
  dmHtml,
  /syncShopTypeControls[\s\S]*?LuminousShopRuntime\?\.SHOP_TYPES[\s\S]*?market-event-mod/,
  "DM Shop and Market controls must be generated from the Runtime taxonomy",
);
assert.ok(
  dmHtml.includes("Describe una causa dentro del mundo"),
  "DM market authoring must explicitly request diegetic player-facing copy",
);
assert.match(
  playerSource,
  /const remainingQuantity\s*=\s*quantity - 1;[\s\S]*?quantity:\s*remainingQuantity,[\s\S]*?cantidad:\s*remainingQuantity,[\s\S]*?next\.inventario_stash\[itemKey\]\s*=\s*remainingItem;/,
  "selling a stack must compute one remaining quantity and persist it to quantity/cantidad together",
);
assert.match(
  playerSource,
  /remainingItem\.totalValueAhn\s*=\s*[\s\S]*?sellBreakdown\.baseValueAhn[\s\S]*?remainingQuantity/,
  "selling one unit must also reduce totalValueAhn for the remaining stack",
);
assert.match(
  playerSource,
  /legacySellUnitBase[\s\S]*?unitValueAhn[\s\S]*?totalValueAhn[\s\S]*?\/ quantity/,
  "legacy sellback fallback must also price one stack unit",
);
assert.match(
  playerSource,
  /next\.ahn\s*=\s*balanceAfter;[\s\S]*?currentBalance:\s*balanceAfter,/,
  "selling must keep legacy Ahn and finance.currentBalance synchronized",
);
assert.ok(
  playerHtml.includes('id="shop-footer-service-mode"') &&
  playerHtml.includes("SERVICIOS"),
  "physical Shop must expose Services as a real player-facing mode",
);
assert.ok(
  playerHtml.includes("abrirServiciosTiendaDinamica") &&
  playerHtml.includes("theater-shop-merchant"),
  "Theater Shop must expose the same Services and merchant surface",
);
assert.match(
  playerSource,
  /function repairShopInventoryItem[\s\S]*?repairBreakdown[\s\S]*?applyFullShopRepair/,
  "repair service must quote through Shop Runtime and mutate canonical durability/condition",
);
assert.match(
  playerSource,
  /reserveShopPromotionRewards[\s\S]*?deliverShopPromotionRewards/,
  "promotional reward items must reserve shared stock before delivery",
);
assert.ok(
  playerSource.includes("shop_commerce") &&
  playerSource.includes("LuminousRecordShopCommerceActivity"),
  "player purchases/services must persist commerce history for loyalty and frequent-customer mechanics",
);
assert.ok(
  dmHtml.includes('id="tienda-npc-sprite"') &&
  dmHtml.includes('id="tienda-npc-saludo"') &&
  dmHtml.includes('id="tienda-servicio-reparacion"') &&
  dmHtml.includes('id="tienda-lealtad-activa"'),
  "DM Shop authoring must expose NPC presentation, Repair and loyalty controls",
);
assert.ok(
  dmHtml.includes('id="tienda-promocion-tipo"') &&
  dmHtml.includes('id="tienda-promocion-producto"') &&
  dmHtml.includes('id="tienda-promocion-regalo"'),
  "DM Shop authoring must expose product-facing promotion controls",
);

console.log("shop item purchase runtime smoke: OK (functional purchases + commerce + repair + loyalty + promotions)");
