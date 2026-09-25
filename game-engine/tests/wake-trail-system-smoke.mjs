import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  DEFAULT_WAKE_CONFIG,
  relativeWaterVelocity,
  wakeStrengthForSpeed,
  resolveWakeDimensions,
  wakeTailAlpha,
  buildWakeRibbonData,
  trimWakePointsByLength,
  buildDualWakeRibbonData,
} from '../src/world/WakeTrailSystem.js';

assert.equal(DEFAULT_WAKE_CONFIG.texture,'Assets/Images/World/Water/wake_trail.png');
assert.equal(DEFAULT_WAKE_CONFIG.fadeStart,.72);

const relStatic=relativeWaterVelocity({x:0,y:0,z:0},{x:3,y:0,z:0});
assert.deepEqual(relStatic,{x:-3,y:0,z:0},'stationary obstacle must still see relative water speed');
assert.ok(wakeStrengthForSpeed(3,{minRelativeSpeed:.15,maxRelativeSpeed:3})>.99);
assert.equal(wakeStrengthForSpeed(.1,{minRelativeSpeed:.15,maxRelativeSpeed:3}),0);

const dimsLow=resolveWakeDimensions({length:5,maxExtraLength:3,width:1.4,widthMultiplier:1},1.2,0);
const dimsHigh=resolveWakeDimensions({length:5,maxExtraLength:3,width:1.4,widthMultiplier:1},1.2,1);
assert.ok(dimsHigh.length>dimsLow.length);
assert.ok(dimsHigh.length>dimsLow.length*4,'strong movement/resistance must create a much longer wake');
assert.ok(dimsLow.length<2,'near-threshold wake must stay visibly short');
assert.ok(dimsHigh.width>dimsLow.width);

assert.equal(wakeTailAlpha(0,.72),1);
assert.equal(wakeTailAlpha(.70,.72),1);
assert.ok(wakeTailAlpha(.90,.72)<.5);
assert.equal(wakeTailAlpha(1,.72),0);

const ribbon=buildWakeRibbonData([
  {x:0,y:.01,z:0},
  {x:1,y:.01,z:0},
  {x:2,y:.01,z:.2},
  {x:3,y:.01,z:.45},
],{baseWidth:1,widening:1.3,tileWorldLength:2.5});
assert.ok(ribbon);
assert.equal(ribbon.positions.length,24);
assert.equal(ribbon.uv.length,16);
assert.equal(ribbon.progress[0],0);
assert.equal(ribbon.progress.at(-1),1);
assert.ok(ribbon.uv.at(-2)>ribbon.uv[0],'U must advance along the whole trail independently of fade');
const startWidth=Math.hypot(ribbon.left[0].x-ribbon.right[0].x,ribbon.left[0].z-ribbon.right[0].z);
const mid=2;
const midWidth=Math.hypot(ribbon.left[mid].x-ribbon.right[mid].x,ribbon.left[mid].z-ribbon.right[mid].z);
assert.ok(midWidth>startWidth,'wake ribbon must open gradually');

const trimmed=trimWakePointsByLength([
  {x:0,y:.01,z:0},{x:1,y:.01,z:0},{x:2,y:.01,z:0},{x:3,y:.01,z:0}
],1.35);
assert.ok(trimmed.length>=2);
assert.ok(Math.abs(trimmed.at(-1).x-1.35)<.001,'dynamic history must be physically cut to strength-scaled wake length');

const dual=buildDualWakeRibbonData([
  {x:0,y:.01,z:0},
  {x:1,y:.01,z:0},
  {x:2,y:.01,z:.1},
  {x:3,y:.01,z:.3},
],{baseWidth:1,widening:1.3,tileWorldLength:2.5,lateralOffset:.6,lateralWidthMultiplier:.38});
assert.ok(dual);
assert.equal(dual.positions.length,48,'dual wake needs four vertices per trail point');
assert.equal(dual.uv.length,32);
assert.equal(dual.progress.length,16);
assert.ok(dual.leftInner[0].z>dual.rightInner[0].z,'two wakes must stay on opposite sides of the centerline');
assert.ok(Math.hypot(dual.leftOuter[0].x-dual.rightOuter[0].x,dual.leftOuter[0].z-dual.rightOuter[0].z)>.8);

const wakeAsset=await fs.readFile(new URL('../../Assets/Images/World/Water/wake_trail.png',import.meta.url));
assert.equal(wakeAsset[0],0x89);
assert.equal(wakeAsset.toString('ascii',1,4),'PNG');
const width=wakeAsset.readUInt32BE(16),height=wakeAsset.readUInt32BE(20),colorType=wakeAsset[25];
assert.equal(width,2172);
assert.equal(height,724);
assert.equal(colorType,6,'official wake PNG must preserve RGBA alpha');

const src=await fs.readFile(new URL('../src/world/WakeTrailSystem.js',import.meta.url),'utf8');
assert.match(src,/wake_trail\.png/);
assert.match(src,/RepeatWrapping/);
assert.match(src,/ClampToEdgeWrapping/);
assert.match(src,/SRGBColorSpace/);
assert.match(src,/ShaderMaterial/);
assert.match(src,/attribute float trailProgress/);
assert.match(src,/foamMask=sampled\.a\*max\(max\(sampled\.r,sampled\.g\),sampled\.b\)/,'official texture must remain the foam mask');
assert.match(src,/alpha=foamMask\*tailFade\*uOpacity/,'fade must multiply alpha only');
assert.match(src,/gl_FragColor=vec4\(vec3\(1\.0\),alpha\)/,'lateral trails must render white');
assert.match(src,/1\.0-smoothstep\(uFadeStart,1\.0,vTrailProgress\)/);
assert.match(src,/THREE\.NormalBlending/);
assert.doesNotMatch(src,/THREE\.AdditiveBlending/,'wake fade must not use additive glow');
assert.match(src,/relativeWaterVelocity\(actor,flow\)/);
assert.match(src,/type==='staticObstacle'/);
assert.match(src,/this\.uvOffset-finite\(this\.config\.scrollSpeed/,'texture must travel away from origin along +U');
assert.match(src,/pointSpacing/);
assert.match(src,/wakeLifetime/);
assert.match(src,/lastStaticKey/,'static obstacle geometry should not rebuild every frame');
assert.match(src,/buildDualWakeRibbonData/,'wake renderer must create two lateral ribbons');
assert.match(src,/maxVerts=maxPoints\*4/,'dual trail geometry must allocate four vertices per center point');
assert.match(src,/setDrawRange\(0,Math\.max\(0,count-1\)\*12\)/);
assert.match(src,/trimWakePointsByLength\(points,maxLength\)/,'dynamic wakes must shorten with lower relative strength');
assert.match(src,/getSurfaceHeightAt/,'wake points must sample WaterBody surface height');
assert.match(src,/findBodyAt/,'wake activation must require intersection with a WaterBody');

console.log('wake trail system smoke: ok');
