import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {harness,unit,entry} from './fixtures/combat-phase1-harness.mjs';
const observed=[],cues=[];
const results=[];
for(const mode of ['none','view','broken']){
  const observers=mode==='none'?{}:{onEvent(event){observed.push(event);if(mode==='broken')throw Error('view unavailable');},onPresentation(cue){cues.push(cue);if(mode==='broken')throw Error('view unavailable');}};
  const h=harness({units:{a:unit('a'),b:unit('b')},seed:42,observers});
  await h.steps.hits(entry('a','b'),'b',3);
  results.push({data:h.snapshot(),cursor:h.cursor(),events:JSON.parse(JSON.stringify(h.steps.events()))});
}
assert.deepEqual(results[0],results[1]);assert.deepEqual(results[0],results[2]);
assert.ok(observed.some(event=>event.type==='DamageApplied'));assert.ok(cues.includes('hitMotion'));
let notifications=0;
const h=harness({enabled:false,units:{a:unit('a'),b:unit('b')},observers:{onPresentation(){notifications++;}}});
await h.steps.hits(entry('a','b'),'b',1);assert.equal(notifications,0);
const snapshot=h.snapshot(),cursor=h.cursor();h.steps.setPresentationEnabled(true);
await h.steps.present('hitMotion',[entry('a','b'),'b']);assert.equal(notifications,1);assert.deepEqual(h.snapshot(),snapshot);assert.equal(h.cursor(),cursor);
// Same immutable event reaches the DM observer and a Player's accepted journal.
const event=h.steps.events()[0];const accepted=[];
const receiver=harness({observers:{onEvent(event){accepted.push(event.sequence);}}});accepted.length=0;receiver.steps.acceptEvent(event);assert.deepEqual(accepted,[event.sequence]);
const nodes={},units={a:{id:'a',name:'Hero',hp:100,maxHp:100,sp:0}},classes=new Set();
const host={classList:{contains:value=>classes.has(value)}};
const window={innerWidth:390,innerHeight:844,document:{getElementById:id=>nodes[id]||null,querySelectorAll:()=>[]},LuminousCombat073:{combatants:()=>units,playerId:()=> 'a',uiState:()=>({running:true})},matchMedia:()=>({matches:false}),LuminousCombatStepRuntime:{presentationEnabled:()=>true}};
vm.runInNewContext(fs.readFileSync('js/combat-v073-hud-motion.js','utf8'),{window});
const hud=window.LuminousCombatHudMotion073;
nodes['game-container']=host;const hidden=new Set();nodes['token-a']={classList:{contains:value=>hidden.has(value)}};
assert.equal(hud.compact(),true);assert.equal(hud.canRead('a'),true);hidden.add('invisible-hidden');assert.equal(hud.canRead('a'),false);hidden.clear();classes.add('player-blinded');assert.equal(hud.canRead('enemy'),false);assert.equal(hud.canRead('a'),true);
assert.equal(hud.entryPose({plan:{type:'spells',data:{name:'Healing'}}}),'cast');assert.equal(hud.entryPose({plan:{data:{defenseType:'guard'}}}),'guard');
let animations=0;nodes['sprite-a']={dataset:{},animate(){animations++;return{cancel(){}};}};
const plan={ownerId:'a',plan:{data:{name:'Triple',coinAmount:3}}};hud.cue('hitsStart',[plan,1],{quiet:true});hud.event({roundId:'r1',sequence:1,type:'Presentation',cue:'hitsStart',args:[plan,1]});hud.event({roundId:'r1',sequence:2,type:'CoinRolled',ownerId:'a',coinIndex:2,side:'head'});assert.equal(hud.state.sides.get('a').count,1);assert.equal(hud.state.sides.get('a').coins[0],'head');
const before=JSON.stringify(units);hud.cue('hitMotion',[{ownerId:'a',plan:{data:{}}},'a']);assert.ok(animations>0);assert.equal(JSON.stringify(units),before);
window.matchMedia=()=>({matches:true});const previous=animations;hud.cue('hitMotion',[{ownerId:'a',plan:{data:{}}},'a']);assert.equal(animations,previous);
console.log('Phase 4: observer failures preserve rule state/RNG/journal, presentation replay is read-only, private visibility and reduced motion passed');
