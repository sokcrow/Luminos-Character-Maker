import fs from 'node:fs';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';

const parts=[
  'combat/combat-v073-live.bundle.part01','combat/combat-v073-live.bundle.part02','combat/combat-v073-live.bundle.part03',
  'combat/combat-v073-live.bundle.part04','combat/combat-v073-live.bundle.part05','combat/combat-v073-live.bundle.part06',
  'combat/repair/combat-v073-live.bundle.part07.r1','combat/repair/combat-v073-live.bundle.part07.r2','combat/repair/combat-v073-live.bundle.part07.r3',
  'combat/combat-v073-live.bundle.part08','combat/combat-v073-live.bundle.part09','combat/combat-v073-live.bundle.part10','combat/combat-v073-live.bundle.part11'
];
const encoded=parts.map(path=>fs.readFileSync(path,'utf8')).join('').replace(/\s+/g,'');
const html=zlib.gunzipSync(Buffer.from(encoded,'base64')).toString('utf8');

function excerpt(needle,after=5000,before=800){
  const at=html.indexOf(needle);
  assert.ok(at>=0,`missing real Battle runtime signature: ${needle}`);
  return html.slice(Math.max(0,at-before),Math.min(html.length,at+after));
}

const target=excerpt('function rollEnemyTargets');
const positions=excerpt('function renderSprites',7000,1200);
console.log('REAL_BATTLE_ROLL_ENEMY_TARGETS\n'+target);
console.log('REAL_BATTLE_RENDER_SPRITES\n'+positions);
