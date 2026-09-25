import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  DEFAULT_WATER_CONFIG,
  DEFAULT_FOAM_CONFIG,
  buildShoreFoamRibbonData,
  extractFieldShorelines,
  simplifyShoreline,
} from '../src/world/WaterBodySystem.js';

assert.equal(DEFAULT_WATER_CONFIG.texture,'Assets/Images/World/Water/water_seamless.png');
assert.equal(DEFAULT_FOAM_CONFIG.texture,'Assets/Images/World/Water/coast_foam_seamless.png');

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

const lab=await fs.readFile(new URL('../lab/game/forest-0.3.3.1.html',import.meta.url),'utf8');
assert.match(lab,/createWaterBodySystem/);
assert.match(lab,/coastWaterBodyShoreline/);
assert.match(lab,/riverWaterBodyShorelines/);
assert.match(lab,/fieldWaterBodyShorelines/);
assert.match(lab,/waterBodyRiverUvWorld/);
assert.match(lab,/waterBodySystem\.update\(dt\)/);
assert.match(lab,/showShoreFoamRibbon/);
assert.match(lab,/scrollSpeed:\{x:-\.035,y:0\}/);

console.log('water body system smoke: ok');
