"use strict";
// Include only the canonical runtime dependencies needed by the privileged
// callable. Firebase Functions uploads its own source directory, not ../js.
const fs=require("node:fs");
const path=require("node:path");
const source=path.resolve(__dirname,"../js");
const destination=path.resolve(__dirname,"vendor/js");
const modules=[
  "item-quality-engine.js",
  "item-catalog-ore-ingot-gem.js",
  "item-catalog-enchantments.js",
  "item-enchantment-engine.js",
  "item-runtime-engine.js",
  "item-inventory-runtime.js",
  "item-magic-runtime.js",
  "curse-catalog.js",
  "curse-runtime.js",
  "curse-enchanter-bridge.js",
  "item-magic-knowledge-runtime.js",
  "item-enchantment-compendium-runtime.js",
  "item-enchanter-service-runtime.js",
  "shop-runtime.js",
];
fs.mkdirSync(destination,{recursive:true});
for(const name of modules){
  const from=path.join(source,name);
  if(!fs.existsSync(from))throw new Error("Missing canonical Enchanter dependency: "+name);
  fs.copyFileSync(from,path.join(destination,name));
}
console.log("Enchanter Firebase Function bundle: "+modules.length+" canonical modules copied");
