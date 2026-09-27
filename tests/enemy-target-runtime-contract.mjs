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

function excerpts(needle,after=3200,before=900,max=8){
  const rows=[];
  let from=0;
  while(rows.length<max){
    const at=html.indexOf(needle,from);
    if(at<0)break;
    rows.push(html.slice(Math.max(0,at-before),Math.min(html.length,at+after)));
    from=at+needle.length;
  }
  return rows;
}

const targetFunctionNames=[...html.matchAll(/function\s+([A-Za-z0-9_$]*(?:target|Target)[A-Za-z0-9_$]*)\s*\(/g)].map(match=>match[1]);
const targetVariableNames=[...html.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_$]*(?:target|Target)[A-Za-z0-9_$]*)\s*=/g)].map(match=>match[1]);
console.log('REAL_BATTLE_TARGET_FUNCTIONS '+JSON.stringify([...new Set(targetFunctionNames)]));
console.log('REAL_BATTLE_TARGET_VARIABLES '+JSON.stringify([...new Set(targetVariableNames)]));

for(const needle of [
  'hydrate','payload.combatants','combatants.forEach','combatants.map','addCombatant','spawnCombatant','spawnUnit','createCombatant','style.bottom','style.left','moveUnitTowardTarget','unit.y=','unit.x=','c.style.bottom','d.y','planTargetRule','validTargetUnits','assignTargetIntents','smartTargetScore','smartTargetForPlan','autoActionScore','autoPlans',
  'targetId','mainTargetId','renderSprites','sprite-container','style.left','style.top',
  'unit.x','unit.y','combatData'
]){
  const rows=excerpts(needle,2600,700,4);
  console.log(`REAL_BATTLE_OCCURRENCES ${needle} COUNT=${rows.length}`);
  rows.forEach((row,index)=>console.log(`--- ${needle} #${index+1} ---\n${row}`));
}
assert.ok(excerpts('action-slot-wrapper',400,100,1).length>0,'real Battle runtime must contain action slots');
assert.ok(excerpts('combatData',400,100,1).length>0,'real Battle runtime must contain combat data');

const viewer=fs.readFileSync('Battle-viewer.html','utf8');
assert.ok(viewer.includes('COMBAT_NORMAL_ENEMY_TARGET_PATCH_MISSING'),'Battle bootstrap must patch the live normal-enemy target selector');
assert.ok(viewer.includes('luminousStableTargetRoll'),'live normal-enemy target selection must be stable across viewers');
assert.ok(viewer.includes("owner?.rank||owner?.unitRank||owner?.mechanics?.rank||'normal'"),'live target patch must preserve rank-specific behavior');
console.log('LIVE_BATTLE_TARGET_PATCH_CONTRACT ok');
