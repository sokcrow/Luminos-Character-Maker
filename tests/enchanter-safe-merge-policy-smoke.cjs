"use strict";
// Merge safety is separate from approving real-money production activation.
// Existing Player-subtree write rules are shared by Shops, contracts and P2P;
// do not widen Enchanter's privileges or secretly enable the callable.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const rules=JSON.parse(fs.readFileSync("database.rules.json","utf8")).rules;
const playerRule=rules["campaña"]?.jugadores?.["$nombre_personaje"]?.[".write"]||"";
const source=fs.readFileSync("functions/index.cjs","utf8");
const player=fs.readFileSync("hoja_personaje.js","utf8");
const config=JSON.parse(fs.readFileSync("firebase.json","utf8"));
const service=fs.readFileSync("js/item-enchanter-firebase-transaction.js","utf8");
assert.ok(playerRule.includes("data.child('uid').val() === auth.uid"),
  "Owner-writable Player subtree still exists; no live monetary security claim is allowed");
assert.ok(source.includes('process.env.LUMINOUS_ENCHANTER_SERVER_ENABLED!=="true"'),
  "A deployed callable must reject paid requests by default");
assert.ok(source.includes("enchanter_server_not_enabled"));
assert.ok(player.includes("window.LuminousEnchanterServerEnabled===true"),
  "The player terminal also needs an explicit client release opt-in");
assert.equal(/window[.]LuminousEnchanterServerEnabled\s*=\s*true/.test(player),false,
  "Merging the PR must never auto-enable the client server checkout");
assert.ok(service.includes("provider_stock_requires_server_atomic_commit"),
  "Legacy Player-subtree persistence must refuse non-atomic external Shop stock");
assert.ok(config.functions?.source==="functions");
assert.ok(config.database?.rules==="database.rules.json");
console.log("Enchanter safe merge: privileged callable default-off, client opt-in only, Shop-stock fallback fail-closed; owner-wallet release risk remains documented");
