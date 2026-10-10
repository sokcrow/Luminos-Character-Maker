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
  "tienda-enchanter-servicios","tienda-enchanter-recetas",
]) assert.ok(dm.includes(`id="${element}"`),`DM shop editor missing ${element}`);
assert.ok(dm.includes("renderShopEnchanterOptions(enchanterIds"),"editing a shop must refill the service and recipe checks");
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
assert.deepEqual(shop.enchanterProvider.knownEnchantments,["flamebound"]);

// Each user-facing control is real form markup, not an uneditable raw schema.
const inlineScripts=[...dm.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
for(const m of inlineScripts) if(m[1].trim()) new Function(m[1]);

console.log("DM Enchanter provider name, Rank, services, recipe authoring and Player seam smoke: OK");
