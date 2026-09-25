import assert from 'node:assert/strict';
import {
  WORLD_WATER_ASSETS,normalizeWaterBodyConfig,resolveWorldWaterTextureUrl,simplifyShoreline,
  polygonSignedArea,pointInPolygon,buildShoreFoamRibbonData,traceWaterShorelinesFromSampler,applyPlanarWorldUVs,createWorldWaterTextureCache,
} from '../src/world/WorldWaterBodies.js';

assert.equal(WORLD_WATER_ASSETS.water,'Assets/Images/World/Water/water_seamless.png');
assert.equal(WORLD_WATER_ASSETS.foam,'Assets/Images/World/Water/coast_foam_seamless.png');
assert.ok(resolveWorldWaterTextureUrl(WORLD_WATER_ASSETS.water,'https://example.test/game-engine/src/world/WorldWaterBodies.js').endsWith('/Assets/Images/World/Water/water_seamless.png'));

const cfg=normalizeWaterBodyConfig({water:{tileWorldSize:4,scrollSpeed:{x:.1,y:.2}},foam:{width:.5,tileWorldLength:2,pulseAmplitude:99,detail:{enabled:true}}});
assert.equal(cfg.water.tileWorldSize,4);
assert.equal(cfg.foam.tileWorldLength,2);
assert.equal(cfg.foam.pulseAmplitude,.1);
assert.equal(cfg.foam.detail.enabled,true);
assert.equal(cfg.water.detail.enabled,false);

const ccw=[{x:0,z:0},{x:4,z:0},{x:4,z:4},{x:0,z:4}],cw=[...ccw].reverse();
assert.ok(polygonSignedArea(ccw)>0);
assert.ok(polygonSignedArea(cw)<0);
assert.equal(pointInPolygon({x:2,z:2},ccw),true);
assert.equal(pointInPolygon({x:5,z:2},ccw),false);

const ribbonA=buildShoreFoamRibbonData(ccw,{closed:true,width:1,landWidthRatio:.25,tileWorldLength:2,waterY:3,widthVariation:0,waterSide:'inside'});
const ribbonB=buildShoreFoamRibbonData(cw,{closed:true,width:1,landWidthRatio:.25,tileWorldLength:2,waterY:3,widthVariation:0,waterSide:'inside'});
assert.equal(ribbonA.totalLength,16);
assert.equal(ribbonA.repeats,8);
assert.equal(ribbonA.uvs.at(-2),8);
assert.equal(ribbonA.uvs.at(-1),1);
assert.equal(ribbonA.positions.length,(ccw.length+1)*2*3);
function outerAtOrigin(r){for(let i=0;i<r.points.length;i++)if(r.points[i].x===0&&r.points[i].z===0){const n=i*6;return{x:r.positions[n+3],z:r.positions[n+5]}}}
for(const r of [ribbonA,ribbonB]){const p=outerAtOrigin(r);assert.ok(p.x>=0&&p.z>=0,'outer edge must point toward enclosed water')}

const island=buildShoreFoamRibbonData(ccw,{closed:true,width:1,landWidthRatio:.25,tileWorldLength:2,widthVariation:0,waterSide:'outside'});
const islandOuter=outerAtOrigin(island);
assert.ok(islandOuter.x<=0||islandOuter.z<=0,'island outer edge must point into surrounding water');

const open=[{x:0,z:0},{x:2,z:0},{x:4,z:0}];
const openRibbon=buildShoreFoamRibbonData(open,{closed:false,width:1,tileWorldLength:1,widthVariation:0,isWaterAt:(x,z)=>z>0});
for(let i=0;i<openRibbon.points.length;i++)assert.ok(openRibbon.positions[i*6+5]>openRibbon.points[i].z);


const tracedLake=traceWaterShorelinesFromSampler({
  bounds:{x0:-5,x1:5,z0:-5,z1:5},columns:40,rows:40,refineSteps:4,minLength:4,
  isWaterAt:(x,z)=>(x*x/9+z*z/4)<1,
});
assert.equal(tracedLake.length,1,'ellipse field should trace one closed shoreline');
assert.equal(tracedLake[0].closed,true);
assert.ok(tracedLake[0].length>12&&tracedLake[0].length<18);

const tracedRiver=traceWaterShorelinesFromSampler({
  bounds:{x0:-5,x1:5,z0:-3,z1:3},columns:48,rows:24,refineSteps:3,minLength:3,
  isWaterAt:(x,z)=>Math.abs(z-Math.sin(x*.7)*.35)<.75,
});
assert.ok(tracedRiver.length>=2,'river crossing bounds should expose two bank polylines');
assert.ok(tracedRiver.some(c=>c.closed===false));

const noisy=[{x:0,z:0},{x:1,z:.001},{x:2,z:0},{x:2,z:2},{x:0,z:2}];
assert.ok(simplifyShoreline(noisy,.01,{closed:true}).length<noisy.length);

class Attr{constructor(array,itemSize){this.array=array;this.itemSize=itemSize;this.count=array.length/itemSize}getX(i){return this.array[i*this.itemSize]}getY(i){return this.array[i*this.itemSize+1]}getZ(i){return this.array[i*this.itemSize+2]}}
class Geo{constructor(){this.attributes={position:new Attr(new Float32Array([0,0,0,4,0,0,4,2,0]),3)}}getAttribute(k){return this.attributes[k]}setAttribute(k,v){this.attributes[k]=v}}
const geo=new Geo();applyPlanarWorldUVs(geo,{tileWorldSize:2,axes:'xy'});
assert.deepEqual(Array.from(geo.attributes.uv.array),[0,0,2,0,2,1]);

class Texture{constructor(url){this.url=url;this.userData={}}dispose(){}}
class Loader{setCrossOrigin(){}load(url,onLoad){queueMicrotask(()=>onLoad(new Texture(url)))}}
const THREE={TextureLoader:Loader,RepeatWrapping:'repeat',ClampToEdgeWrapping:'clamp',SRGBColorSpace:'srgb',LinearFilter:'linear',LinearMipmapLinearFilter:'mipmap'};
const cache=createWorldWaterTextureCache({THREE,baseUrl:'https://example.test/game-engine/src/world/WorldWaterBodies.js'});
const p1=cache.load(WORLD_WATER_ASSETS.water,'water'),p2=cache.load(WORLD_WATER_ASSETS.water,'water');
assert.equal(p1,p2,'same asset must share one load promise/texture');
const water=await p1;assert.equal(water,cache.texture(WORLD_WATER_ASSETS.water,'water'));assert.equal(water.wrapS,'repeat');assert.equal(water.wrapT,'repeat');
const foam=await cache.load(WORLD_WATER_ASSETS.foam,'foam');assert.equal(foam.wrapS,'repeat');assert.equal(foam.wrapT,'clamp');

console.log('game engine world water bodies smoke: ok');
