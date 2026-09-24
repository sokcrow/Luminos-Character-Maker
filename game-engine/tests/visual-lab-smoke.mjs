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

assert.match(index, /src="\.\/game\/forest-0\.3\.3\.1\.html"/);
assert.doesNotMatch(index, /\?perf=forest/);
assert.doesNotMatch(index, /\?map=swampLab/);
assert.doesNotMatch(index, /id="debugDrawer"|id="toggleDebug"|GAME ENGINE STATUS|benchmark móvil/);
assert.match(index, /Mapa hexagonal · exploración \+ inventario \+ Game Engine/);
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
assert.match(main, /WORLD_SPACE_CONTRACT/);
assert.match(main, /CombatMovementTracker/);
assert.match(main, /LuminousWorldMovementBridge/);
assert.doesNotMatch(main, /debugDrawer|toggleDebug|eventLog|inspectPlayer|dmState/);

assert.match(game, /item-icon-registry\.js/);
assert.match(game, /item-catalog-plant-produce\.js/);
assert.match(game, /item-catalog-tools\.js/);
assert.match(game, /window\.LuminousMapItemBridge/);
assert.match(game, /window\.LuminousWorldMovementBridge/);
assert.match(game, /gridHelper=null,gridVisible=false/);
assert.match(game, /id="gridToggle" hidden aria-hidden="true" tabindex="-1">Cuadrícula: OFF<\/button>/);
assert.match(game, /function buildGrid\(\)\{[\s\S]*gridVisible=false;[\s\S]*clearGrid\(\);/);
assert.doesNotMatch(game, /LineBasicMaterial\(\{color:0xead39e/);
assert.doesNotMatch(game, /LineBasicMaterial\(\{color:0xf2dca7/);
assert.match(game, /function terrainMovementSampleAtWorld/);
assert.match(game, /function addDifficultTerrain\(x0,z0,x1,z1,multiplier=\.5/);
assert.doesNotMatch(game, /moveMultiplier:\.72,tags:\['difficult'/);
assert.doesNotMatch(game, /moveMultiplier:\.82,tags:\['difficult'/);
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
assert.match(game, /displayBasePixelRatioCap\(\).*displayLandscapeMobile\(\)\?1\.20:1\.35/);
assert.match(game, /DISPLAY_RENDER_ANTIALIAS=!DISPLAY_DEVICE_MOBILE/);
assert.match(game, /renderer\.shadowMap\.enabled=!displayLandscapeMobile\(\)/);
assert.match(game, /mobileLandscape:Object\.freeze\(\{label:'MÓVIL HORIZONTAL',fullFt:64,farFt:96,safetyFt:24,colliderFt:60,preloadCos:\.72,updateFrames:5\}\)/);
assert.match(game, /compactFarTree/);
assert.match(game, /forestMobileFarKeep/);
assert.match(game, /addForestCanopyShade\(grp,0,0,0/);
assert.match(game, /FOREST_CANOPY_SHADE_MATERIAL_CACHE/);
assert.match(game, /if\(force\|\|colliderStateChanged\)rebuildCollisionSpatialIndex\(\)/);
assert.match(game, /TREE_OCCLUSION_RUNTIME/);
assert.match(game, /DISPLAY_PERFORMANCE_RUNTIME/);
assert.match(game, /updateAdaptiveDisplayPerformance/);
assert.match(game, /targetFps:48/);
assert.match(game, /minFps:38/);
assert.match(game, /minScale:\.84/);
assert.match(game, /Math\.max\(1,displayPixelRatioCap\(\)\)/);
assert.match(game, /MOBILE_FOREST_LOW_POLY=DISPLAY_DEVICE_MOBILE/);
assert.match(game, /CAMERA_VISIBILITY_REFERENCE_ASPECT=16\/9/);
assert.match(game, /LOCAL_CAMERA_FIXED_PROFILE=Object\.freeze\(\{distance:\.42,height:\.433,fovBias:-3\.25,deadZone:\.72,lookAhead:\.62\}\)/);
assert.match(game, /function cameraFixedVisibilityFov/);
assert.match(game, /function viewportCameraProfile\(\)\{\s*return LOCAL_CAMERA_FIXED_PROFILE;\s*\}/);
assert.match(game, /const eligible=nearSafety\|\|inFrustum/);
assert.match(game, /globalCamera\.fov=cameraFixedVisibilityFov\(38,globalCamera\)/);
assert.doesNotMatch(game, /distance:\.22/);
assert.doesNotMatch(game, /THREE\.MathUtils\.lerp\(\.70,\.74,wide\)/);
assert.match(game, /cameraProfile:typeof viewportCameraProfile/);
assert.match(game, /1 tronco \+ 2 masas de copa/);
assert.match(game, /drawSamples/);
assert.match(game, /capture draw avg/);
assert.doesNotMatch(game, /material\.color\.copy\(lit\);\s*material\.needsUpdate=true/);
assert.match(game, /treeInterval=displayLandscapeMobile\(\)\?50/);
assert.match(game, /LuminousDisplayPerformance/);
assert.match(game, /DISPLAY_SHADOW_SIZE=DISPLAY_DEVICE_MOBILE\?512:1024/);
assert.match(game, /Forest Floor Ecology/);
assert.match(game, /PROCEDURAL_ZONE_SCHEMA_VERSION=6/);
assert.match(game, /GEOGRAPHY_FIELD_SCHEMA_VERSION=1/);
assert.match(game, /GEOLOGY_FIELD_SCHEMA_VERSION=1/);
assert.match(game, /window\.LuminousGeographyGeology/);
assert.match(game, /window\.BiomeValidationV2=Object\.freeze/);
assert.match(game, /version:'biome-validation-v2'/);
assert.match(game, /biomeValidationV2AuditActiveRegion/);
assert.match(game, /biomeValidationV2AuditRegion/);
assert.match(game, /biomeValidationV2AuditAll/);
assert.match(game, /qaRegionId=qp\.get\('region'\)\|\|'gC'/);
assert.match(game, /__BIOME_VALIDATION_QA__/);
assert.match(game, /const readable=ranked\.filter\(x=>x\.centerDistance<=22\)/);
assert.match(game, /signedGeography:!requiresSignedGeography/);
assert.match(game, /coast:!requiresCoast\|\|\(waterSamples>0&&landSamples>0\)/);
assert.match(game, /function riverHalfWidthAtT\(river,t\)/);
assert.match(game, /function buildRiverBankVisual\(/);
assert.match(game, /waterVisualClass='river-wet-bank'/);
assert.match(game, /waterVisualClass='river-edge-foam'/);
assert.match(game, /waterVisualClass='river-flow-streaks'/);
assert.match(game, /const riverUvRotation=Math\.PI\/2-angle/);
assert.match(game, /rotation:riverUvRotation/);
assert.match(game, /activeProceduralZone\?\.hydrology\?\.type==='river'/);
assert.match(game, /sample\?\.water\?sample\.current:null/);
assert.match(game, /source:'procedural-river-field'/);
assert.match(game, /worldFloorRepeatForTiles/);
assert.match(game, /!worldTextureId&&base\.userData\?\.paperFXSurfaceConfig/);
assert.match(game, /const count=DISPLAY_DEVICE_MOBILE\?8:18/);
assert.match(game, /forest:!requiresForest\|\|\(activeProceduralZone\.forestBiome===true&&forestCorridors>0\)/);
assert.match(game, /player-quarter-camera-v2/);
assert.match(game, /quarterDegrees:90/);
assert.match(game, /quarterRadians:Math\.PI\/2/);
assert.match(game, /function rotatePlayerCameraQuarter/);
assert.match(game, /cameraOrbitSwipeCommitted=true/);
assert.doesNotMatch(game, /dragRadiansPerPixel/);
assert.doesNotMatch(game, /keyboardRadiansPerSecond/);
assert.doesNotMatch(game, /function rotatePlayerCameraBy/);
assert.match(game, /data-player-menu-action="world-map"/);
assert.doesNotMatch(game, /id="globalReturnBtn"/);
assert.match(game, /renderer\.domElement\.addEventListener\('pointermove'/);
assert.match(game, /targetYaw\+=playerCameraYawOffset/);
assert.match(game, /target\.x\+Math\.sin\(yaw\)\*dist/);
assert.match(game, /keyboard:Object\.freeze\(\{left:'Q',right:'E'\}\)/);
assert.match(game, /version:'geography-geology-v1\.1'/);
assert.match(game, /function proceduralGenerationAudit/);
assert.match(game, /visibleGridGeometry:!!gridHelper/);
assert.match(game, /const qaProcedural=qp\.get\('qa'\)==='procedural'/);
assert.match(game, /const localEntrySector='owC'/);
assert.match(game, /loadMap\('owC',null,'exterior'\)/);
assert.match(game, /requiredSlopeDeg/);
assert.match(game, /localReliefWeight>\.10/);
assert.match(game, /localCount=localReliefWeight>\.52\?2:1/);
assert.match(game, /buildProceduralLandGroundMesh/);
assert.match(game, /zone-macro-relief-v9-signed-geography-geology/);
assert.match(game, /geographyFeatureDeltaTiles/);
assert.match(game, /geologyTraversalAudit/);
assert.match(game, /land_route_disconnected/);
assert.match(game, /makeGeologicOutcropRock/);
assert.match(game, /geology-outcrop/);
assert.match(game, /addDifficultTerrainEllipse/);
assert.match(game, /source:'geology-scree'/);
assert.match(game, /Ecology V4 bridge/);
assert.match(game, /paperBushSpeciesV2\(g,x,z,[\s\S]*true,\{mapId,field,seed:procSector\.seed\+390/);
assert.match(game, /if\(!isProceduralZone\)buildElevationModulesForSector/);
assert.doesNotMatch(game, /const raw=Math\.max\(0,base\+transition\+local\);/);
assert.match(game, /MOBILE ITEM \/ INVENTORY STANDARD/);
assert.match(game, /pointer:coarse\) and \(orientation:landscape\) and \(max-height:600px\)/);
assert.match(game, /grid-template-columns:minmax\(0,1fr\) clamp\(236px,32vw,310px\)/);
assert.match(game, /paper-inv-equipment-field[\s\S]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);


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
