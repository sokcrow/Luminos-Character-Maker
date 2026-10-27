import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
let now=0,serial=0;
const timers=new Map(),moves=[],closed=[],warnings=[];
const timer=(fn,ms)=>{const id=++serial;timers.set(id,{at:now+ms,fn});return id;};
const c=vm.createContext({console:{warn:(...x)=>warnings.push(x),error:console.error},Math,JSON,Map,Set,Promise,
  Date:{now:()=>now},setTimeout:timer,clearTimeout:id=>timers.delete(id),addEventListener(){},
  roundRunning:true,round:1,combatData:{a:{hp:10},b:{hp:10}},COMBAT_PACE:{spAward:900,clashMotion:230},
  CLASH_MOTION:{hitMinGap:12,finalLosePush:20},clashData:()=>({}),isRangeAction:()=>false,
  moveUnitAlongCombatLine:(...args)=>moves.push({at:now,args}),closeFloatingClashHud:entry=>closed.push(entry.ownerId),
});c.window=c;
for(const file of ['combat-v073-playback','combat-v073-steps','combat-v073-playback-sync','combat-v073-audiovisual'])
  vm.runInContext(fs.readFileSync(`js/${file}.js`,'utf8'),c);
const sync=c.LuminousCombatPlaybackSync;
sync.state.authority={state:{runningLocal:true}};sync.state.presentationRate=2;
c.LuminousCombatAudiovisual073.preferences({speed:1,sound:false});
assert.equal(c.LuminousCombatAudiovisual073.state.settings.speed,1,'Do not overwrite private preference');
assert.equal(c.LuminousCombatAudiovisual073.duration(900),450,'Player follows DM 2x round');
c.LuminousCombatAudiovisual073.preferences({speed:2});
c.LuminousCombatAudiovisual073.preferences({speed:1});
assert.equal(c.LuminousCombatAudiovisual073.duration(900),450,'Preference changes cannot change sealed timing');
const html=fs.readFileSync('combat/source/combat-v073-live.html','utf8');
const factory=html.slice(html.indexOf('let combatStepsInstance=null;'),html.indexOf('async function rollClashPower('));
const wait=html.match(/^function wait\(ms,visual\).*$/m)[0];
const defeat=html.slice(html.indexOf('async function animateClashDefeat('),html.indexOf('async function animateHitMotion('));
vm.runInContext(`${wait}\n${defeat}\n${factory}`,c);
const renderer=c.combatStepRuntime();
const a={ownerId:'a',plan:{data:{}}},b={ownerId:'b',plan:{data:{}}};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function advance(target){
  await settle();
  while(true){
    const next=[...timers].filter(([,v])=>v.at<=target).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];
    if(!next)break;
    const [id,value]=next;now=value.at;timers.delete(id);value.fn();await settle();
  }
  now=target;await settle();
}
const clock=c.LuminousCombatPlayback.createPresentationClock({now:()=>now,setTimer:timer,clearTimer:id=>timers.delete(id)});
const left=clock.stamp('powerCoin',[a,{index:0}]);
const right=clock.stamp('powerCoin',[b,{index:0}]);
assert.equal(left.phase,right.phase,'Both Coin sides share a cancellation scope');
assert.ok(clock.stamp('powerCoin',[a,{index:1}]).phase>left.phase,'Next Coin advances the phase');
const first=clock.run('clashDefeat',{playAt:0,phase:1},visual=>renderer.present('clashDefeat',[a,b],visual));
await advance(565);await first;
assert.equal(moves.length,2);assert.ok(moves.every(move=>move.at===450),'Defeat motion starts before the next DM attack');
assert.deepEqual(closed,['b']);
// Reproduce a delayed/suspended visual that is still waiting when hits begin.
const second=clock.run('clashDefeat',{playAt:565,phase:2},visual=>renderer.present('clashDefeat',[a,b],visual));
await advance(600);
await clock.run('hitsStart',{playAt:600,phase:3},()=>{});
await advance(1600);await second;
assert.equal(moves.length,2,'Obsolete defeat cannot move sprites during the following hit phase');
assert.equal(closed.length,1,'Obsolete continuation cannot close the next HUD');
// Both sides share one phase and remain live; teardown cancels pending holds.
const sides=[];
const pair=[0,1].map(side=>clock.run('powerCoin',{playAt:1600,phase:4},async visual=>{await visual.wait(80);sides.push(side)}));
await advance(1680);await Promise.all(pair);assert.deepEqual(sides,[0,1]);
const stopped=clock.run('clashDefeat',{playAt:1680,phase:5},visual=>renderer.present('clashDefeat',[a,b],visual));
await settle();clock.stop();await stopped;assert.equal(timers.size,0,'teardown cancels waits');
sync.state.authority.state.runningLocal=false;
assert.equal(c.LuminousCombatAudiovisual073.duration(900),900,'Restore private 1x outside the round');
assert.deepEqual(warnings,[],'Expected phase cancellation is not an error');
// Exercise the production sealer, so the shared rate cannot be merely a test
// fixture field that the DM never actually publishes.
c.LuminousCombatLiveAdapter073={state:{db:{},role:'dm'}};
c.LuminousCombatSession={canSeal:()=>true,async updateRoot(_db,update){
  const result=update({estado:{encounterId:'rate-test'},authority:{}});
  return {committed:true,snapshot:{val:()=>result}};
}};
sync.state.authority.snapshotRuntime=()=>({a:{hp:10}});
c.LuminousCombatAudiovisual073.preferences({speed:2});
const sealed=await sync.seal({round:1,seed:42},{timeline:true});
assert.equal(sealed.playback.presentationSpeed,2);
c.LuminousCombatAudiovisual073.preferences({speed:1});
assert.equal(sealed.playback.presentationSpeed,2,'Sealed rate is independent of later preference changes');
console.log('Production Clash defeat: shared DM speed, stale continuation cancellation, parallel Coins, private preference restoration and teardown passed.');
