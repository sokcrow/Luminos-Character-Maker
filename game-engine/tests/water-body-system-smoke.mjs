import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  DEFAULT_WATER_CONFIG,
  DEFAULT_FOAM_CONFIG,
  buildShoreFoamRibbonData,
  extractFieldShorelines,
  simplifyShoreline,
  waterCurrentImmersionFactor,
  resolveWaterBodyVisualProfile,
} from '../src/world/WaterBodySystem.js';

assert.equal(DEFAULT_WATER_CONFIG.texture,'Assets/Images/World/Water/water_seamless.png');
assert.equal(DEFAULT_FOAM_CONFIG.texture,'Assets/Images/World/Water/coast_foam_seamless.png');
assert.ok(DEFAULT_FOAM_CONFIG.renderOrder<0,'shore foam must render in the terrain/water layer before units');
assert.ok(DEFAULT_FOAM_CONFIG.yOffset<=.012,'shore foam must stay nearly coplanar with water');

const seaProfile=resolveWaterBodyVisualProfile('coast:test',{
  tileWorldSize:3,
  opacity:.74,
  roughness:.46,
},{
  width:.36,
  innerWidth:.06,
  outerWidth:.30,
  tileWorldLength:2.35,
  pulseAmplitude:.014,
});
assert.equal(seaProfile.profile,'sea');
assert.ok(seaProfile.water.tileWorldSize>3,'sea texture must render at a larger world scale');
assert.equal(seaProfile.water.opacity,.74,'explicit sea opacity must remain authoritative so the depth gradient stays visible');
assert.ok(seaProfile.water.roughness>=.48,'sea surface must retain a rough moving treatment');
assert.ok(seaProfile.foam.width>.36,'sea foam band must be broader');
assert.ok(seaProfile.foam.tileWorldLength>2.35,'sea foam texture must repeat at a larger scale');
assert.ok(seaProfile.foam.scrollSpeed>.018,'sea foam must visibly travel along the coast');
assert.ok(seaProfile.foam.pulseAmplitude>=.05,'sea foam must visibly surge/recede against the shoreline');
assert.ok(seaProfile.foam.widthVariation>=.16,'sea foam edge must stay irregular/undulating');
const riverProfile=resolveWaterBodyVisualProfile('river:test',{tileWorldSize:3},{width:.36,tileWorldLength:2.35});
assert.equal(riverProfile.profile,'default');
assert.equal(riverProfile.water.tileWorldSize,3,'river scale must not inherit the sea profile');

const currentDry=waterCurrentImmersionFactor({waterDepth:0,referenceDepth:1});
const currentEdge=waterCurrentImmersionFactor({waterDepth:.10,referenceDepth:1});
const currentMid=waterCurrentImmersionFactor({waterDepth:.50,referenceDepth:1});
const currentDeep=waterCurrentImmersionFactor({waterDepth:1,referenceDepth:1});
assert.equal(currentDry,0);
assert.ok(currentEdge<currentMid&&currentMid<currentDeep,'river current immersion must ramp with water depth');
assert.ok(currentEdge<=.08,'river edge contact must remain a light drift');
assert.ok(currentDeep>.98,'deep river water must reach full current strength');

const shoreline=[
  {x:0,y:0,z:0},
  {x:2,y:0,z:0},
  {x:4,y:0,z:0},
];
const ribbon=buildShoreFoamRibbonData({
  shoreline,
  isWaterAt:(x,z)=>z>0,
  innerWidth:.2,
  outerWidth:.8,
  baseWidth:1,
  widthVariation:0,
  foamTileWorldLength:2,
  simplifyTolerance:0,
});
assert.ok(ribbon);
assert.equal(ribbon.positions.length,18);
assert.deepEqual(ribbon.uv,[0,0,0,1,1,0,1,1,2,0,2,1]);
assert.ok(ribbon.innerEdge.every(p=>p.z<0),'innerEdge must remain land-side');
assert.ok(ribbon.outerEdge.every(p=>p.z>0),'outerEdge must point toward water');
assert.equal(ribbon.total,4);

const reversed=buildShoreFoamRibbonData({
  shoreline:[...shoreline].reverse(),
  isWaterAt:(x,z)=>z>0,
  innerWidth:.2,
  outerWidth:.8,
  baseWidth:1,
  widthVariation:0,
  foamTileWorldLength:2,
  simplifyTolerance:0,
});
assert.ok(reversed.outerEdge.every(p=>p.z>0),'normal orientation must not depend on polyline direction');

const noisy=simplifyShoreline([
  {x:0,z:0},{x:.5,z:.001},{x:1,z:0},{x:2,z:0}
],{tolerance:.01});
assert.ok(noisy.length<=3);

const contours=extractFieldShorelines({
  bounds:{x0:-2,x1:2,z0:-2,z1:2},
  resolution:32,
  isWaterAt:(x,z)=>x*x+z*z<1,
  simplifyTolerance:.03
});
assert.ok(contours.length>=1,'field contour extraction must produce shoreline');
assert.ok(contours[0].points.length>=6,'field contour must preserve curved shoreline');

const catalog=JSON.parse(await fs.readFile(new URL('../../Assets/Images/World/Water/catalog.json',import.meta.url),'utf8'));
assert.equal(catalog.runtimeMode,'repository-local');
assert.equal(catalog.assetCount,2);
const water=catalog.assets.find(x=>x.id==='water_seamless');
const foam=catalog.assets.find(x=>x.id==='coast_foam_seamless');
assert.ok(water?.path.endsWith('/water_seamless.png'));
assert.ok(foam?.path.endsWith('/coast_foam_seamless.png'));
assert.equal(foam.hasAlpha,true,'coast foam PNG must preserve alpha');

const moduleSource=await fs.readFile(new URL('../src/world/WaterBodySystem.js',import.meta.url),'utf8');
assert.doesNotMatch(moduleSource,/https?:\/\/(?:i\.)?imgur\.com/i,'runtime WaterBody module must not reference Imgur');
assert.match(moduleSource,/RepeatWrapping/);
assert.match(moduleSource,/ClampToEdgeWrapping/);
assert.match(moduleSource,/foamDistance/);
assert.match(moduleSource,/uPulseAmplitude/);
assert.match(moduleSource,/showShoreFoamRibbon/);
assert.match(moduleSource,/flowWorldSpeed/);
assert.match(moduleSource,/patternMask/);
assert.match(moduleSource,/makePatternMaskWaterMaterial/);
assert.match(moduleSource,/mix\(uBackground,uWater,pattern\)/,'mask mode must remap source darkness instead of rendering black water');
assert.match(moduleSource,/waterCurrentImmersionFactor/);
assert.match(moduleSource,/containsPoint\(position\)/);
assert.match(moduleSource,/getSurfaceHeightAt\(position\)/);
assert.match(moduleSource,/getFlowAt\(position\)/);
assert.match(moduleSource,/findBodyAt\(position\)/);
assert.match(moduleSource,/scrollX:0,scrollY:0,wrapT:THREE\.ClampToEdgeWrapping/,'foam texture cache must not double-apply per-mesh current scroll');

const lab=await fs.readFile(new URL('../lab/game/forest-0.3.3.1.html',import.meta.url),'utf8');
assert.match(lab,/createWaterBodySystem/);
assert.match(lab,/coastWaterBodyShoreline/);
assert.match(lab,/riverWaterBodyShorelines/);
assert.match(lab,/fieldWaterBodyShorelines/);
assert.match(lab,/waterBodyRiverUvWorld/);
assert.match(lab,/waterBodySystem\.update\(dt\)/);
assert.match(lab,/showShoreFoamRibbon/);
assert.match(lab,/riverCalmShoulderWidthAtT/);
assert.match(lab,/riverWaterHalfWidthAtT/);
assert.match(lab,/includeCalmShoulder:true/);
assert.match(lab,/id:\`river:\$\{id\}\`/);
assert.match(lab,/backgroundColor:0x3278de/,'river pattern background must be white');
assert.match(lab,/waterColor:0xffffff/,'river mask water must be blue');
assert.match(lab,/patternMask:\{/,'river must use the seamless texture as a mask, not raw RGB');
assert.match(lab,/opacity:1/,'river water must be opaque');
assert.match(lab,/flowWorldSpeed:\{x:-wt\(riverVisualCurrentSpeed\)\*\.30,y:0\}/);
assert.match(lab,/foamCurrentScroll=-\.020\*Math\.max\(\.5,riverVisualCurrentSpeed\)/);
assert.match(lab,/width:TILE\*\.48/,'river foam must be slightly larger');
assert.match(lab,/surface:\{renderOrder:-4,depthWrite:true\}/);
assert.match(lab,/geometryAuthority='procedural-river-single-surface'/);
assert.match(lab,/riverTerminalCaps:!!terminalCaps/,'river geometry must seal its visible start/end without adding gameplay colliders');
assert.doesNotMatch(lab,/id:\`river-calm:/,'river calm water must not be a separate plate');
assert.doesNotMatch(lab,/id:\`river-current:/,'river current must not be a second stacked plate');
assert.match(lab,/waterCurrentImmersionFactor/);
assert.match(lab,/currentSpeed,currentStrength:currentSpeed/);
assert.match(lab,/baseStrength:Number\(current\.baseStrength/);
assert.match(lab,/id:'canal-water'/,'canal waterStrip must use WaterBody');
assert.match(lab,/id:\`water-rect:/,'waterRect must use WaterBody');
assert.match(lab,/id:\`swim-water:/,'irregular authored swim shapes must use WaterBody');
assert.match(lab,/attachAuthoredWaterBody/);
assert.match(lab,/waterBodyPointInTilePolygon/);
assert.match(lab,/waterBodyFlowUvWorld/);
assert.doesNotMatch(lab,/for\(const z of \[-1\.92,1\.92\]\).*foamStrips\.push/s,'legacy rectangular canal foam strips must be removed');

console.log('water body system smoke: ok');
