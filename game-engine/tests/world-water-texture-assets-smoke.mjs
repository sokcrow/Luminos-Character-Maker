import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
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
const foam=catalog.assets.find(x=>x.id==='coast_foam_seamless');
assert.equal(foam.hasAlphaChannel,true,'coast foam must retain an alpha channel');
assert.equal(foam.transparentPixelsDetected,true,'coast foam must contain transparent pixels');
const runtime=await fs.readFile(path.join(root,'game-engine','src','world','WorldWaterBodies.js'),'utf8');
assert.ok(!/imgur\.com/i.test(runtime),'runtime module must not depend on Imgur');
assert.match(runtime,/Assets\/Images\/World\/Water\/water_seamless\.png/);
assert.match(runtime,/Assets\/Images\/World\/Water\/coast_foam_seamless\.png/);
console.log('game engine world water texture assets smoke: ok');
