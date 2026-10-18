import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {harness,unit,entry} from './fixtures/combat-phase1-harness.mjs';
const files=['js/combat-v073-animation-profiles.js','js/combat-v073-audiovisual.js'];
function environment(){
  const nodes=new Map(),events=new Map(),timers=new Map(),motions=[];let timerSerial=0;
  class Node{
    constructor(){this.children=[];this.dataset={};this.values=new Map();this.style={setProperty:(k,v)=>this.values.set(k,v)};this.classList={add(){}};this.offsetWidth=140;}
    set id(value){this._id=value;nodes.set(value,this);}get id(){return this._id;}
    set innerHTML(value){for(const id of value.matchAll(/id="([^"]+)"/g)){const node=new Node();node.id=id[1];}}
    setAttribute(){}appendChild(node){this.children.push(node);node.parent=this;}remove(){this.parent?.children.splice(this.parent.children.indexOf(this),1);if(this.id)nodes.delete(this.id);}
    getBoundingClientRect(){return this.rect||{left:0,top:0,right:1365,bottom:768,width:1365,height:768};}
    animate(frames,options){const a={frames,options,cancel(){a.oncancel?.();}};motions.push(a);return a;}
  }
  const host=new Node();host.id='game-container';
  for(const [id,x]of [['a',200],['b',650]]){const n=new Node();n.id=`sprite-${id}`;n.rect={left:x,top:200,right:x+100,bottom:400,width:100,height:200};}
  const visible=new Set(['a','b']);
  const w={document:{hidden:false,getElementById:id=>nodes.get(id),createElement:()=>new Node(),addEventListener:(n,cb)=>events.set(n,cb)},
    LuminousCombat073:{},LuminousCombatHudMotion073:{canRead:id=>visible.has(id)},LuminousCombatStepRuntime:{presentationEnabled:()=>true},
    matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener:(n,cb)=>events.set(n,cb),
    setTimeout:(cb,ms)=>{const id=++timerSerial;timers.set(id,{cb,ms});return id;},clearTimeout:id=>timers.delete(id),localStorage:{getItem:()=>null,setItem(){}}};
  const context=vm.createContext({window:w,Math:Object.assign(Object.create(Math),{random(){throw Error('VIEW_USED_RULE_RNG');}})});
  files.forEach(p=>vm.runInContext(fs.readFileSync(p,'utf8'),context));
  return{w,av:w.LuminousCombatAudiovisual073,profiles:w.LuminousCombatAnimationProfiles073,nodes,events,timers,motions,visible};
}
const e=environment(),{av,profiles}=e;
assert.equal(profiles.resolve({plan:{data:{id:'fire_bolt'}}}).id,'fire_bolt');
assert.equal(profiles.resolve({plan:{data:{damageType:'Contundente'}}}).id,'blunt');
assert.equal(profiles.resolve({plan:{type:'spells',data:{id:'unknown'}}}).id,'arcane');
assert.equal(profiles.resolve({plan:{data:{isRanged:true}}}).id,'projectile');
assert.equal(profiles.resolve({plan:{data:{id:'missing'}}}).id,'slash');
assert.ok(Object.isFrozen(profiles.profiles.fire_bolt));
const fire={ownerId:'a',localIndex:0,plan:{data:{id:'fire_bolt',name:'<b>Fire Bolt</b>'},targetId:'b'}};
av.cue('hitStart',[fire]);assert.equal(e.nodes.get('combat-av-cutin').textContent,'<b>Fire Bolt</b>');
av.cue('hitMotion',[fire,'b']);assert.ok([...av.state.nodes].some(n=>n.dataset.marker==='projectile'));
const projectile=e.motions.at(-1);projectile.onfinish();assert.ok([...av.state.nodes].some(n=>n.dataset.marker==='impact'));
av.clear();assert.equal(av.state.nodes.size,0);assert.equal(av.state.animations.size,0);assert.equal(e.timers.size,0);
e.visible.delete('b');av.cue('hitMotion',[fire,'b']);assert.equal(av.state.nodes.size,0);e.visible.add('b');
e.w.matchMedia=()=>({matches:true});av.cue('hitMotion',[fire,'b']);assert.equal(av.state.nodes.size,0);e.w.matchMedia=()=>({matches:false});
av.preferences({quality:'off',speed:2});assert.equal(av.duration(400),200);av.cue('hitMotion',[fire,'b']);assert.equal(av.state.nodes.size,0);
av.preferences({quality:'low',speed:1});for(let i=0;i<40;i++)av.cue('hitMotion',[fire,'b']);assert.ok(av.state.nodes.size<=6);av.clear();
// Receiving events alone must not animate stale/silent playback or unlock audio.
av.event({sequence:1,roundId:'r',type:'Presentation',cue:'hitMotion',args:[fire,'b']});
av.event({sequence:2,roundId:'r',type:'SaveResolved',ownerId:'a',unitId:'b'});assert.equal(av.state.nodes.size,0);assert.equal(av.state.context,null);
e.w.AudioContext=class{constructor(){throw Error('AUDIO_UNAVAILABLE');}};assert.doesNotThrow(()=>e.events.get('pointerdown')({isTrusted:true}));
// Actual voice lifecycle is bounded, with fail-safe disconnect and no random noise.
let audioStarted=0,audioStopped=0;
e.w.AudioContext=class{constructor(){this.state='running';this.currentTime=0;this.destination={};}close(){this.state='closed';return Promise.resolve();}createOscillator(){return{frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){},start(){audioStarted++;},stop(){audioStopped++;}};}createGain(){return{gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}};
e.events.get('pointerdown')({isTrusted:true});av.preferences({quality:'full'});
for(let i=0;i<20;i++)av.cue('hitMotion',[{ownerId:'a',plan:{data:{damageType:'Slash'}}},'b']);
assert.equal(av.state.voices.size,6);assert.equal(audioStarted,6);av.preferences({sound:false});assert.equal(av.state.voices.size,0);assert.ok(audioStopped>=6);av.clear();
// View failures and output modes do not change the resolver's state or RNG.
const results=[];
for(const mode of ['full','low','off','broken']){
 const env=environment();env.av.preferences({quality:mode,speed:mode==='low'?2:1});
 const h=harness({units:{a:unit('a'),b:unit('b')},seed:42,observers:{onEvent:event=>env.av.event(event),onPresentation:(cue,args)=>{if(mode==='broken')throw Error('visual missing');env.av.cue(cue,args);}}});
 await h.steps.hits(entry('a','b'),'b',3);results.push({state:h.snapshot(),cursor:h.cursor(),journal:JSON.parse(JSON.stringify(h.steps.events()))});env.av.clear();
}
for(const result of results.slice(1))assert.deepEqual(result,results[0]);
console.log('Phase 5: profiles/fallbacks, privacy, reduced motion, stale playback, bounded VFX/audio cleanup and unchanged rules/RNG passed');

// Live spell plans must name the canonical array key required by RTDB rules.
const planWindow={document:null,addEventListener(){},setTimeout(){}};
vm.runInNewContext(fs.readFileSync('js/combat-v073-plan-sync.js','utf8'),{window:planWindow});
planWindow.firebase={database:{ServerValue:{TIMESTAMP:1}}};
const plan=planWindow.LuminousCombatPlanSync073.payloadFor({type:'spells',data:{id:'fire_bolt'},targetId:'b'},0,'a',{playerId:'a',uid:'uid-a',round:1,players:{a:{characterBuild:{spellSelections:['ray_of_frost','fire_bolt']}}}});
assert.equal(plan.spellSelectionKey,'1');assert.equal(plan.spellId,'fire_bolt');
// A scheduled menu recovery may reveal the surface, never replace a chosen detail.
const economyText=fs.readFileSync('js/combat-v073-economy-menu.js','utf8');
const refreshText=economyText.slice(economyText.indexOf('  function refreshOpenedMenu('),economyText.indexOf('  function openCompactMenu('));
for(const nav of ['category','action']){
 const scheduled=[];let rendered=0;
 const refresh=vm.runInNewContext(refreshText+'\nrefreshOpenedMenu',{
  state:{menuRefreshGeneration:0},global:{setTimeout:fn=>scheduled.push(fn)},activeMenu:()=> 'spells',clean:String,lexical:()=>nav,
  ensureCategorySurfaceOpen(){},renderActiveMenuBody(){rendered++;},syncTabs(){},updateCategoryContext(){},syncSpellMenuVisibility(){},syncQuickBadge(){},syncResponsiveMenuLayout(){}
 });refresh('spells');scheduled.forEach(fn=>fn());assert.equal(rendered,nav==='category'?1:0);
}

// Canonical spell catalogs use numeric `coins`; the HUD must still name the Skill.
const hudWindow={innerWidth:390,innerHeight:844,document:{getElementById:()=>null,querySelectorAll:()=>[]},LuminousCombat073:{combatants:()=>({}),uiState:()=>({running:true})},matchMedia:()=>({matches:false})};
vm.runInNewContext(fs.readFileSync('js/combat-v073-hud-motion.js','utf8'),{window:hudWindow});
const hud=hudWindow.LuminousCombatHudMotion073;
hud.event({roundId:'r',sequence:1,type:'CoinRolled',ownerId:'a',coinIndex:0,side:'head'});
assert.doesNotThrow(()=>hud.cue('powerStart',[{ownerId:'a',plan:{data:{id:'fire_bolt',name:'Fire Bolt',coins:1,coinAmount:1}}},1,13]));
assert.equal(hud.state.sides.get('a').skill,'Fire Bolt');
