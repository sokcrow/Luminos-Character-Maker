import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('js/combat-v073-dm-observer.js','utf8');

assert.ok(source.includes("return value==='left'||value==='right'?value:'right'"),'unknown sprites must default to right-facing source art');
assert.ok(source.includes("faction==='enemy'||faction==='enemigo'||faction==='hostile'?'left':'right'"),'battlefield convention must face enemies left and allies right');
assert.ok(source.includes("const source=sourceFacing(unit),desired=desiredFacing(unit,token),flip=source!==desired"),'flip decision must compare source art orientation to desired battlefield orientation');
assert.ok(source.includes("token.dataset.luminousBattleFacing=desired"),'runtime must expose final facing for field diagnostics');
assert.ok(source.includes("global.LuminousWebGL2Renderer?.requestRender?.(120)"),'facing changes must invalidate WebGL because GPU sprite rendering reads the DOM transform');

console.log('combat v0.7.3 Limbus facing runtime contract: ok');
