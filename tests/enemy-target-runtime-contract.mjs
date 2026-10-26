import fs from 'node:fs';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import vm from 'node:vm';
await import('../js/combat-deployment-runtime.js');

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

if(process.env.ENEMY_TARGET_DIAGNOSTICS==='1')for(const needle of [
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

// The shipped speed layout now calls the shared size-aware formation. Check
// actual packed functions and positions instead of retired bootstrap literals.
assert.ok(viewer.includes('COMBAT_SIZE_FORMATION_MISSING'),'Bootstrap must guard the shared formation integration');
assert.match(html, /<script src="js\/combat-deployment-runtime\.js(?:\?[^"]+)?"><\/script>/, 'Packed viewer must load the shared deployment runtime');
const formationStart=html.indexOf('function formationSort(');
const formationEnd=html.indexOf('\nfunction rollTurnSpeeds(',formationStart);
assert.ok(formationStart>=0&&formationEnd>formationStart,'Packed viewer must contain the real formation functions');
const formationSource=html.slice(formationStart,formationEnd);
assert.ok(formationSource.includes('deployment?.formationPoints(units,side)'), 'Speed layout must use the canonical size-aware formation');

function runFormation(units){
  const combatData=Object.fromEntries(units.map(unit=>[unit.id,{hp:10,battleActive:true,speed:1,...unit}]));
  const context={combatData,window:{LuminousCombatLiveMode:true,LuminousCombatDeploymentRuntime:globalThis.LuminousCombatDeploymentRuntime},unitHasStatus:()=>false,$:()=>null};
  vm.runInNewContext(formationSource+'\nlayoutSpeedFormation();',context);
  return combatData;
}
for(const side of ['ally','enemy']){
  const normal=runFormation(Array.from({length:8},(_,i)=>({id:side+i,faction:side,size:'medium',speed:8-i})));
  const expected=[[10,18],[10,42],[19,18],[19,42],[28,18],[28,42],[37,18],[37,42]];
  Object.values(normal).forEach((unit,index)=>{
    const [x,y]=expected[index];
    assert.deepEqual([unit.x,unit.y],[side==='enemy'?100-x:x,y], `${side} normal bodies retain their alternating depth rows`);
  });
  const tiny=runFormation(Array.from({length:16},(_,i)=>({id:'tiny'+i,faction:side,size:'tiny',speed:16-i})));
  assert.equal(new Set(Object.values(tiny).map(unit=>unit.x+':'+unit.y)).size,16,'Packed speed layout must not stack the ninth through sixteenth Tiny bodies');
  assert.equal(tiny.tiny0.y,tiny.tiny1.y,'Tiny pairs share a field cell');
  assert.equal(Math.abs(tiny.tiny0.x-tiny.tiny1.x),4.5);
  const mixed=runFormation([
    {id:'g',faction:side,size:'gargantuan'}, {id:'h',faction:side,size:'huge'},
    {id:'large',faction:side,size:'large'}, {id:'a',faction:side,size:'tiny'},
    {id:'b',faction:side,size:'tiny'}, {id:'m',faction:side,size:'medium'},
    {id:'summon',faction:side,size:'huge',isSummon:true},
  ]);
  assert.equal(new Set(Object.values(mixed).map(unit=>unit.x+':'+unit.y)).size,7);
  assert.ok(mixed.summon.y>Math.max(...Object.values(mixed).filter(unit=>!unit.isSummon).map(unit=>unit.y)),'Summons use a separate row');
}
const pinned=runFormation([{id:'manual',faction:'enemy',size:'huge',positionPinned:true,x:65,y:29}]);
assert.deepEqual([pinned.manual.x,pinned.manual.y],[65,29],'DM positions remain authoritative');
console.log('LIVE_BATTLE_SIZE_FORMATION_CONTRACT ok: packed layout, both factions, normal zigzag, 16 Tiny, mixed bodies, summons and DM positions');
