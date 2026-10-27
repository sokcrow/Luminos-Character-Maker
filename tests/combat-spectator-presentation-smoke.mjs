import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('combat/source/combat-v073-live.html','utf8');
const focus=[],cameras=[],moves=[],holds=[],huds=[];
const c=vm.createContext({console,Math,JSON,Map,Set,Promise,setTimeout,clearTimeout,
  PLAYER_ID:'spectator',timelineResolutionActive:true,LuminousCombatLiveMode:true,round:1,
  combatData:{a:{id:'a',hp:20,x:1,y:2},b:{id:'b',hp:20,x:3,y:4}},
  unitCombatAnchor:u=>({x:u.x,y:u.y}),setCombatCameraPoint:(p,s)=>cameras.push({p,s}),
  setTimelineVisualFocus:ids=>focus.push([...ids]),timelineParticipantsForEntries:rows=>[...new Set(rows.flatMap(r=>[r.ownerId,r.plan?.targetId]).filter(Boolean))],
  moveClashUnitsToMidpoint:(a,b)=>moves.push(['clash',a.ownerId,b.ownerId]),
  moveEntryForAction:e=>moves.push(['approach',e.ownerId]),focusCombatCameraOnPlayer:()=>{throw Error('Spectator must not focus their own character')},
  wait:async ms=>holds.push(ms),COMBAT_PACE:{cameraSettle:520,clashApproach:610,actionGap:100},
  setFloatingClashHud:(e,n)=>huds.push([e.ownerId,n]),markEntryStarted(){},
  clashData:p=>p.data,resolveRemainingCoinHits:async()=>{},closeFloatingClashHud(){},
  $:()=>null,isRangeAction:()=>false,addEventListener(){},
});c.window=c;
vm.runInContext(fs.readFileSync('js/combat-v073-steps.js','utf8'),c);
vm.runInContext(html.slice(html.indexOf('function focusCombatCameraOnClash('),html.indexOf('function playerSlotId(')),c);
vm.runInContext(html.slice(html.indexOf('let combatStepsInstance=null;'),html.indexOf('async function rollClashPower(')),c);
vm.runInContext(html.slice(html.indexOf('async function resolveUnopposedCoinAction('),html.indexOf('function isEvadePlan(')),c);
const a={ownerId:'a',plan:{targetId:'b',data:{coinAmount:3}}},b={ownerId:'b',plan:{targetId:'a',data:{coinAmount:3}}};
c.focusCombatCameraOnClash(a,b);assert.equal(cameras.length,1,'A nonparticipant follows the live Clash');
c.timelineResolutionActive=false;c.focusCombatCameraOnClash(a,b);assert.equal(cameras.length,1,'Private camera outside resolution is preserved');c.timelineResolutionActive=true;
c.LuminousCombatLiveMode=false;c.focusCombatCameraOnClash(a,b);assert.equal(cameras.length,1,'Offline parallel timeline keeps its original local focus');c.LuminousCombatLiveMode=true;
const runtime=c.combatStepRuntime();
await runtime.present('actionStart',[a]);assert.deepEqual(focus.at(-1),['a','b']);
await runtime.present('actionApproach',[a,'attack']);assert.equal(holds.at(-1),520);assert.deepEqual(moves.at(-1),['approach','a']);assert.deepEqual(huds.at(-1),['a',3]);
await runtime.present('actionApproach',[b,'counter']);assert.equal(holds.at(-1),220,'Counter preserves its existing fixed approach duration');
await runtime.present('clashStart',[a,b,3,3]);assert.deepEqual(focus.at(-1),['a','b']);assert.deepEqual(moves.at(-1),['clash','a','b']);
runtime.capturePresentation(true);await c.resolveUnopposedCoinAction(a);
assert.equal(runtime.events().filter(e=>e.type==='Presentation'&&e.cue==='actionApproach').length,1,'The real unopposed resolver publishes its approach, not just its hit result');
console.log('Spectator presentation: shared camera/focus, fixed approach durations and actual unopposed resolver capture pass.');
