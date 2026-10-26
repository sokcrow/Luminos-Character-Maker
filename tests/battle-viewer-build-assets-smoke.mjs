import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const viewer=readFileSync(new URL("../Battle-viewer.html",import.meta.url),"utf8");
const adapter=readFileSync(new URL("../js/combat-v073-live-adapter.js",import.meta.url),"utf8");
const core=readFileSync(new URL("../js/item-persistence-runtime.js",import.meta.url),"utf8");
for(const tag of ["js/build-equipment-catalog.js","js/equipment-loadout-runtime.js",
                  "js/item-equipment-effects-runtime.js"]){
 assert.ok(viewer.includes(tag),tag+" must be injected before packed runtime");
}
assert.ok(viewer.includes("js/combat-xp-runtime.js?v=20261024-victory-xp-1"),
  "Builds must not drop the latest main victory XP runtime");
for(const path of ["js/combat-skill-loadout-074.js","js/combat-v073-live-adapter.js",
                   "js/combat-v073-deck.js","js/combat-v073-authority.js",
                   "js/battle-viewer-player-skill-planner-074.js"]){
 assert.ok(viewer.includes("'"+path+"'"),path+" must use new Battle Viewer cache version");
}
assert.match(viewer,/builds-2/);
assert.match(adapter,/authoritativePlayer\?\.augmentations \?\?/,
  "Player anatomy is authoritative over stale Combat copies");
assert.match(core,/function syncInstalledAugments\(/);
assert.match(core,/paths\.augmentations/);
assert.match(core,/unit\.equipment\[slot\] = id \? findInstance/,
  "Unequipped slots must clear from player's live HUD");
console.log("BATTLE_VIEWER_BUILD_ASSETS_PASS modules, XP, cache coherency, canonical Augments");
