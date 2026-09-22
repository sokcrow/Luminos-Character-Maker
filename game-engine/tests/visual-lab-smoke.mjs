import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const [index, main, game, inventoryRuntime, itemBridge] = await Promise.all([
  readFile(new URL("../lab/index.html", import.meta.url), "utf8"),
  readFile(new URL("../lab/main.js", import.meta.url), "utf8"),
  readFile(new URL("../lab/game/forest-0.3.3.1.html", import.meta.url), "utf8"),
  readFile(new URL("../../js/item-inventory-runtime.js", import.meta.url), "utf8"),
  readFile(new URL("../src/bridges/luminous/LuminousItemsBridge.js", import.meta.url), "utf8")
]);

assert.match(index, /src="\.\/game\/forest-0\.3\.3\.1\.html\?perf=forest"/);
assert.doesNotMatch(index, /\?map=swampLab/);
assert.match(index, /id="gameFrame"/);
assert.match(index, /id="openInventory"/);
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
assert.doesNotMatch(game, /makeGlobalSettlementMarker/);
assert.doesNotMatch(game, /settlement:Object\.freeze\(\{id:\'forest-village\'/);
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
assert.match(game, /testMode:new URLSearchParams\(location\.search\)\.get\('perf'\)===\'forest\'/);
assert.match(game, /mobileLandscape/);
assert.match(game, /displayBasePixelRatioCap\(\).*displayLandscapeMobile\(\)\?0\.70:1\.25/);
assert.match(game, /antialias:!DISPLAY_DEVICE_MOBILE/);
assert.match(game, /renderer\.shadowMap\.enabled=!displayLandscapeMobile\(\)/);
assert.match(game, /mobileLandscape:Object\.freeze\(\{label:'MÓVIL HORIZONTAL',fullFt:58,farFt:92,safetyFt:28,colliderFt:58,preloadCos:\.68,updateFrames:8\}\)/);
assert.match(game, /compactFarTree/);
assert.match(game, /forestMobileFarKeep/);
assert.match(game, /addForestCanopyShade\(grp,0,0,0/);
assert.match(game, /FOREST_CANOPY_SHADE_MATERIAL_CACHE/);
assert.match(game, /if\(force\|\|colliderStateChanged\)rebuildCollisionSpatialIndex\(\)/);
assert.match(game, /TREE_OCCLUSION_RUNTIME/);
assert.match(game, /DISPLAY_PERFORMANCE_RUNTIME/);
assert.match(game, /updateAdaptiveDisplayPerformance/);
assert.match(game, /targetFps:48/);
assert.match(game, /minFps:40/);
assert.match(game, /minScale:\.58/);
assert.match(game, /MOBILE_FOREST_LOW_POLY=DISPLAY_DEVICE_MOBILE/);
assert.match(game, /if\(displayLandscapeMobile\(\)\)\{/);
assert.match(game, /distance:\.22/);
assert.match(game, /height:\.42/);
assert.match(game, /fovBias:-12\.5/);
assert.match(game, /cameraProfile:typeof viewportCameraProfile/);
assert.match(game, /1 tronco \+ 2 masas de copa/);
assert.match(game, /drawSamples/);
assert.match(game, /capture draw avg/);
assert.doesNotMatch(game, /material\.color\.copy\(lit\);\s*material\.needsUpdate=true/);
assert.match(game, /treeInterval=displayLandscapeMobile\(\)\?50/);
assert.match(game, /LuminousDisplayPerformance/);
assert.match(game, /DISPLAY_SHADOW_SIZE=DISPLAY_DEVICE_MOBILE\?512:1024/);
assert.match(game, /Forest Floor Ecology/);

// Parse the embedded ES module with Node's syntax checker. The Lab is a large HTML
// file, so regex smoke alone can miss malformed ternaries/template literals that
// leave the browser stuck behind the loader.
const moduleMatch = game.match(/<script type="module">([\s\S]*?)<\/script>/);
assert.ok(moduleMatch?.[1], "embedded game module must exist");
const syntaxDir = await mkdtemp(join(tmpdir(), "luminous-lab-syntax-"));
const syntaxFile = join(syntaxDir, "forest-lab-module.mjs");
try {
  await writeFile(syntaxFile, moduleMatch[1], "utf8");
  const checked = spawnSync(process.execPath, ["--check", syntaxFile], { encoding: "utf8" });
  assert.equal(checked.status, 0, checked.stderr || checked.stdout || "embedded module syntax check failed");
} finally {
  await rm(syntaxDir, { recursive: true, force: true });
}

assert.match(inventoryRuntime, /function insertItem\(/);
assert.match(inventoryRuntime, /luminous:item-inserted/);
assert.match(itemBridge, /insert\(player, definitionOrInstance/);

console.log("game-engine visual lab smoke: ok");
