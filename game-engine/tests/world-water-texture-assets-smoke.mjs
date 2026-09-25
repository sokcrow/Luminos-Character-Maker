import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const dir=path.join(root,'Assets','Images','World','Water');
const catalog=JSON.parse(await fs.readFile(path.join(dir,'catalog.json'),'utf8'));
assert.equal(catalog.runtimeMode,'repository-local');
assert.equal(catalog.assetCount,2);
const expected=new Map([
  ['water_seamless','Assets/Images/World/Water/water_seamless.png'],
  ['coast_foam_seamless','Assets/Images/World/Water/coast_foam_seamless.png'],
]);
for(const asset of catalog.assets){
  assert.equal(asset.path,expected.get(asset.id));
  const bytes=await fs.readFile(path.join(root,asset.path));
  assert.deepEqual(Array.from(bytes.subarray(0,8)),[137,80,78,71,13,10,26,10]);
  assert.equal(bytes.length,asset.bytes);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  assert.ok(asset.width>0&&asset.height>0);
}
const water=catalog.assets.find(x=>x.id==='water_seamless');
assert.equal(water.hasAlphaChannel,true,'water texture must retain its alpha/mask channel');
assert.equal(water.transparentPixelsDetected,true,'water texture must retain transparent mask pixels');
const foam=catalog.assets.find(x=>x.id==='coast_foam_seamless');
assert.equal(foam.hasAlphaChannel,true,'coast foam must retain an alpha channel');
assert.equal(foam.transparentPixelsDetected,true,'coast foam must contain transparent pixels');

const runtime=await fs.readFile(path.join(root,'game-engine','src','world','WorldWaterBodies.js'),'utf8');
assert.ok(!/imgur\.com/i.test(runtime),'runtime module must not depend on Imgur');
assert.match(runtime,/Assets\/Images\/World\/Water\/water_seamless\.png/);
assert.match(runtime,/Assets\/Images\/World\/Water\/coast_foam_seamless\.png/);
assert.match(runtime,/transparent:true,opacity:cfg\.opacity,alphaTest:\.001/,'water material must respect PNG alpha even at full opacity');
assert.match(runtime,/opacity:0,alphaTest:\.001/,'foam must not render as a solid white ribbon before its PNG loads');
assert.match(runtime,/luminousTargetOpacity/,'foam opacity must be restored only after the texture is ready');

const forest=await fs.readFile(path.join(root,'game-engine','lab','game','forest-0.3.3.1.html'),'utf8');
assert.match(forest,/color:visual\.waterBase/,'procedural coast must preserve biome water tint');
assert.match(forest,/color:profile\.baseColor/,'procedural inland water must preserve its hydrology profile tint');
assert.match(forest,/id:`canal-water-\$\{mapWaterBodies\.length\}`[\s\S]{0,1400}color:0x368fa0/,'canal water must retain its blue/teal base');
assert.match(forest,/id:`authored-\$\{mapId\}-\$\{waterStyle\}-\$\{mapWaterBodies\.length\}`[\s\S]{0,1400}color:flowing\?0x368fa0:0x4b9aa2/,'authored water must retain river/lake tint');

console.log('game engine world water texture assets smoke: ok');
