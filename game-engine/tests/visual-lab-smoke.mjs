import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [index, main, game, inventoryRuntime, itemBridge] = await Promise.all([
  readFile(new URL("../lab/index.html", import.meta.url), "utf8"),
  readFile(new URL("../lab/main.js", import.meta.url), "utf8"),
  readFile(new URL("../lab/game/forest-0.3.3.1.html", import.meta.url), "utf8"),
  readFile(new URL("../../js/item-inventory-runtime.js", import.meta.url), "utf8"),
  readFile(new URL("../src/bridges/luminous/LuminousItemsBridge.js", import.meta.url), "utf8")
]);

assert.match(index, /src="\.\/game\/forest-0\.3\.3\.1\.html"/);
assert.doesNotMatch(index, /\?map=swampLab/);
assert.match(index, /id="gameFrame"/);
assert.match(index, /id="openInventory"/);
assert.match(index, /id="openShop"/);
assert.match(index, /id="fullscreenGame"/);
assert.match(index, /Pantalla completa horizontal/);
assert.match(index, /id="hpStat"/);
assert.match(index, />HP<\/i>/);
assert.match(index, /Assets\/Images\/Buttons\/Inventory\.svg/);
assert.match(index, /Offensive Level/);
assert.match(index, /Defensive Level/);

assert.match(main, /LuminousMapItemBridge/);
assert.match(main, /LuminousItemIconRegistry/);
assert.match(main, /LuminousPlantProduceCatalog/);
assert.match(main, /LuminousToolCatalog/);
assert.match(main, /forest-roadside-store/);
assert.match(main, /canal-general-store/);
assert.match(main, /shop:purchased/);
assert.match(main, /items\.insert\(/);
assert.match(main, /screen\.orientation/);
assert.match(main, /goToWorldMap/);
assert.match(main, /PaperGlobalMap/);
assert.match(main, /returnToGlobal/);
assert.match(main, /lock\("landscape"\)/);
assert.match(main, /fullscreenchange/);
assert.match(main, /engine\.start\(\)/);

assert.match(game, /item-icon-registry\.js/);
assert.match(game, /item-catalog-plant-produce\.js/);
assert.match(game, /item-catalog-tools\.js/);
assert.match(game, /window\.LuminousMapItemBridge/);
assert.match(game, /window\.PaperInventory/);
assert.match(game, /window\.LuminousShop/);
assert.match(game, /Mercader del camino/);
assert.match(game, /Tienda del Canal|canal-general-store/);
assert.match(game, /makeCanonicalWorldItemDisplay/);
assert.match(game, /forest-roadside-store/);
assert.match(game, /canal-general-store/);
assert.match(game, /makeGlobalSettlementMarker/);
assert.match(game, /Aldea del Bosque/);
assert.match(game, /settlement:Object\.freeze\(\{id:\'forest-village\'/);
assert.match(game, /map:\'canal\'/);
assert.match(game, /Assets\/Images\/Buttons\/Menu\.svg/);
assert.match(game, /Assets\/Images\/Buttons\/Inventory\.svg/);
assert.match(game, /Assets\/Images\/Buttons\/Player\.svg/);
assert.doesNotMatch(game, /LUMINOUS_MAP_ICON_FALLBACKS/);
assert.doesNotMatch(game, /icon-placeholder/);
assert.doesNotMatch(game, /travelTorch:/);
assert.doesNotMatch(game, /rope:\{id:'rope'/);
assert.doesNotMatch(game, /questSampleFallback/);
assert.doesNotMatch(game, /pickupFallback/);
assert.match(game, /paperItemIcon/);
assert.match(game, /https\?:\|data:\|blob:/);
assert.match(game, /FOREST_STRESS_DEVICE_MOBILE/);
assert.match(game, /navigator\.userAgentData/);
assert.match(game, /deviceMobile/);
assert.match(game, /mobileLandscape/);
assert.match(game, /displayPixelRatioCap/);
assert.match(game, /LuminousDisplayPerformance/);
assert.match(game, /DISPLAY_SHADOW_SIZE=DISPLAY_DEVICE_MOBILE\?512:1024/);
assert.match(game, /Forest Floor Ecology/);

assert.match(inventoryRuntime, /function insertItem\(/);
assert.match(inventoryRuntime, /luminous:item-inserted/);
assert.match(itemBridge, /insert\(player, definitionOrInstance/);

console.log("game-engine visual lab smoke: ok");
