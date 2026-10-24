import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('combat/source/combat-v073-live.html','utf8');
const hudSource=fs.readFileSync('js/combat-v073-hud-motion.js','utf8');
const slot=(id,index=0,left=0)=>({id:`${id}_slot_${index}`,dataset:{ownerId:id,slotIndex:String(index)},classList:{contains:value=>value==='target-valid'},getBoundingClientRect:()=>({left,right:left+13,top:100,bottom:113,width:13,height:13})});
let choices=[slot('tiny-a',0,0),slot('tiny-b',0,20),slot('huge',0,400),slot('huge',1,420)];
let selected=[],value={targeting:true,running:false},units={'tiny-a':{name:'Tiny A'},'tiny-b':{name:'Tiny B'},huge:{name:'Huge'}};
const targetList={hidden:true,dataset:{},children:[],replaceChildren(){this.children=[]},appendChild(node){this.children.push(node)}};
const tokens=()=>({classList:{contains:()=>false}});
const doc={getElementById(id){if(id==='combat-target-list')return targetList;if(id.startsWith('token-'))return tokens();return null},querySelectorAll:()=>choices,createElement:()=>({dataset:{}})};
const context={document:doc,innerWidth:1920,innerHeight:1080,window:null,LuminousCombat073:{uiState:()=>value,combatants:()=>units,chooseTarget:(id,index)=>selected.push({id,index})}};context.window=context;
vm.runInNewContext(hudSource,context);
const hud=context.LuminousCombatHudMotion073;
for(const [width,height] of [[360,800],[390,844],[844,390],[768,1024],[1280,720],[1920,1080]]){
  context.innerWidth=width;context.innerHeight=height;targetList.dataset.choices='';hud.refreshTargets();
  assert.equal(targetList.hidden,false,`${width}x${height}: selection list available regardless of body/control visibility`);
  assert.equal(targetList.children.length,4);
  targetList.children[3].onclick();assert.deepEqual(selected.pop(),{id:'huge',index:1},'Every Action Slot remains independently selectable');
}
value.targeting=false;hud.refreshTargets();assert.equal(targetList.hidden,true);
value.targeting=true;value.running=true;hud.refreshTargets();assert.equal(targetList.hidden,true);
value.running=false;choices=[];hud.refreshTargets();assert.match(targetList.children[0].textContent,/No hay objetivos válidos/);
choices=[slot('tiny-a')];hud.refreshTargets();
units['tiny-a'].name='New name';hud.refreshTargets();assert.match(targetList.children[0].textContent,/New name/,'Labels refresh without requiring different slot IDs');

// Execute the shipped capture handler. Old DOM-order hit testing chose Tiny A.
let pointerHandler;
const pointerSource=source.slice(source.indexOf("document.addEventListener('pointerdown',e=>{\n  if(!targetingModeActive)return;"),source.indexOf("},true);$('back').onclick"))+"},true);";
vm.runInNewContext(pointerSource,{targetingModeActive:true,document:{addEventListener:(_type,handler)=>pointerHandler=handler,querySelectorAll:()=>choices},choosePlayerTarget:node=>selected.push(node.id)});
choices=[slot('tiny-a',0,0),slot('tiny-b',0,20)];
const event=(x,target,pointerType='mouse')=>({clientX:x,clientY:106,target,pointerType,preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true}});
const field={closest:()=>null};
pointerHandler(event(19,field));assert.equal(selected.pop(),'tiny-b_slot_0','Overlapping padding must choose the nearest Tiny slot');
pointerHandler(event(5,{closest:selector=>selector.includes('#combat-target-list')?{}:null}));assert.equal(selected.length,0,'A screen-space button cannot be intercepted by an underlying slot');
pointerHandler(event(5,{closest:selector=>selector==='.action-slot-wrapper'?choices[1]:null}));assert.equal(selected.pop(),'tiny-b_slot_0','The directly clicked slot outranks padded neighbors');
pointerHandler(event(19,field,'touch'));assert.equal(selected.pop(),'tiny-b_slot_0');

// The real API resolves current nodes and rechecks the canonical targeting rule.
const apiSource=source.match(/  chooseTarget\(ownerId,slotIndex=0\)\{[\s\S]*?\n  \},/)[0].trim().replace(/,$/,'');
const apiContext={targetingModeActive:true,pendingTargetPlan:{},combatData:{player:{}},PLAYER_ID:'player',unitSlots:id=>choices.filter(node=>node.dataset.ownerId===id),targetSlotIsValid:()=>true,planTargetRule:()=> 'enemy',choosePlayerTarget:node=>selected.push(node)};
const api=vm.runInNewContext('({'+apiSource+'})',apiContext);
const current=slot('tiny-b',0,800);choices=[current];api.chooseTarget('tiny-b',0);assert.equal(selected.pop(),current);
apiContext.targetSlotIsValid=()=>false;assert.equal(api.chooseTarget('tiny-b',0),false);assert.equal(selected.length,0,'No bypass for invalid or condition-blocked targets');
apiContext.targetingModeActive=false;assert.equal(api.chooseTarget('tiny-b',0),false);
console.log('Target selection: six viewport modes, explicit slot choice, live-node resolution, direct-hit priority, nearest Tiny padding, touch and screen-space button isolation passed.');
