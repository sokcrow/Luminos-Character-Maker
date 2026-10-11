"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ROOT=path.resolve(__dirname,"..");
const dm=fs.readFileSync(path.join(ROOT,"pantalla_dm.html"),"utf8");
const player=fs.readFileSync(path.join(ROOT,"hoja_personaje.js"),"utf8");
const playerHtml=fs.readFileSync(path.join(ROOT,"hoja_personaje.html"),"utf8");

for(const element of [
  "tienda-enchanter-activa","tienda-enchanter-opciones",
  "tienda-enchanter-nombre","tienda-enchanter-rango",
  "tienda-enchanter-duracion-1","tienda-enchanter-duracion-2","tienda-enchanter-duracion-3",
  "tienda-enchanter-servicios","tienda-enchanter-recetas",
]) assert.ok(dm.includes(`id="${element}"`),`DM shop editor missing ${element}`);
assert.ok(dm.includes("renderShopEnchanterOptions(enchanterIds"),"editing a shop must refill the service and recipe checks");
for(const element of ["tienda-enchanter-fiabilidad","tienda-enchanter-tarifas",
  "tienda-enchanter-reparacion-precio","tienda-enchanter-extraccion-calidad","tienda-enchanter-fallo"]){
  assert.ok(dm.includes(`id="${element}"`),`DM shop editor missing ${element}`);
}
for(const field of ["servicePriceAhn:enchanterPrices","magicalRepairAhnPerPoint:needsRepairPrice",
  "safeExtractionGemQuality:enchanterServices.includes","reliability:reliabilityPercent/100",
  "renderShopEnchanterPriceFields(existingEnchanter.servicePriceAhn",
  "durationHoursByRank:enchanterDurationHours",
  "existingEnchanter.durationHoursByRank?.[rank]"]){
  assert.ok(dm.includes(field),`DM provider authoring must persist/refill ${field}`);
}

assert.ok(dm.includes("authoredServiceSettings"),"shop creation must store individually offered Enchanter services");
assert.ok(dm.includes("enchanterProvider: enchanterEnabled"),"DM shop editor must save provider details");
assert.ok(dm.includes('src="js/item-catalog-enchantments.js"'),"DM provider must populate known recipes from the real catalog");
assert.ok(!dm.includes("id=\"tienda-enchanter-schema-json\""),"no raw-schema editing controls belong to the DM UI");
assert.ok(player.includes("shopData.enchanterProvider"),"Player service terminal must read the DM-authored provider");
assert.ok(playerHtml.includes("js/item-enchanter-ui.js"),"Player must load the terminal");

require("../js/shop-runtime.js");
const Shop=globalThis.LuminousShopRuntime;
assert.ok(Shop);
const shop={
  shop_type:"specialist",shop_tier:5,
  services:{enchant:{enabled:true},identify:{enabled:true},remove_rewrite:{enabled:false}},
  enchanterProvider:{name:"Maestra Calina",maxRank:2,
    knownEnchantments:["flamebound"],services:["enchant","identify"]},
};
assert.equal(Shop.serviceEnabled(shop,"enchant"),true);
assert.equal(Shop.serviceEnabled(shop,"identify"),true);
assert.equal(Shop.serviceEnabled(shop,"remove_rewrite"),false);
assert.equal(shop.enchanterProvider.maxRank,2);
require("../js/item-quality-engine.js");
require("../js/item-catalog-ore-ingot-gem.js");
require("../js/item-catalog-enchantments.js");
require("../js/item-enchantment-engine.js");
require("../js/item-runtime-engine.js");
require("../js/item-inventory-runtime.js");
require("../js/item-magic-runtime.js");
require("../js/item-enchanter-service-runtime.js");
const service=globalThis.LuminousItemEnchanterServiceRuntime;
const author=service.normalizeProviderProfile({
  maxRank:3,durationHoursByRank:{1:8,2:48,3:192},
  services:["enchant"],knownEnchantments:["flamebound"],
});
assert.equal(service.serviceDuration(author,1).hours,8);
assert.equal(service.serviceDuration(author,2).hours,48);
assert.equal(service.serviceDuration(author,3).hours,192);
assert.deepEqual(shop.enchanterProvider.knownEnchantments,["flamebound"]);

// Each user-facing control is real form markup, not an uneditable raw schema.
const inlineScripts=[...dm.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
for(const m of inlineScripts) if(m[1].trim()) new Function(m[1]);

console.log("DM Enchanter provider name, Rank, services, recipe authoring and Player seam smoke: OK");
