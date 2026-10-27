import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
const c={console:{error(){}},setTimeout:()=>1,clearTimeout(){},addEventListener(){},removeEventListener(){}};
c.window=c;
vm.runInNewContext(read('js/combat-v073-live-adapter.js'),c);
const normalize=c.LuminousCombatLiveAdapter073.normalizeSkill;
for(const row of [{kind:'skill',type:'Evade'},{isDefense:true,type:'Counter'},{kind:'skill',defenseSubtype:'clashable_guard'}]){
  const skill=normalize('catalog-key',{id:'definition-key',...row});
  assert.equal(skill.kind,'defense');
  assert.equal(skill.skillId,'catalog-key');
  assert.notEqual(skill.defenseType,'defense');
}
const source=read('combat/source/combat-v073-live.html');
const render=source.slice(source.indexOf('function renderDefenseSkills(){'),source.indexOf('function rowAccent'));
const choices=[];
const node=()=>({children:[],style:{setProperty(){}},appendChild(n){this.children.push(n)}});
const body=node();
Object.assign(c,{$:()=>body,document:{createElement:node},UNIT_KITS:{p:{actions:[normalize('equipped-evade',{type:'Evade',name:'Equipped'})]}},PLAYER_ID:'p',permanent:{defense:['Evade','Guard','Counter'].map(name=>({name,defenseType:name.toLowerCase()}))},sinInfo:()=>({color:''}),skillOptionMarkup:()=>'',COMBAT_ICONS:{evade:'',guard:'',counter:''},selectedSlotIndex:0,selectAction:choice=>choices.push(choice)});
vm.runInNewContext(render,c);
for(const [width,height] of [[360,800],[390,844],[844,390],[768,1024],[1280,720],[1920,1080]]){
  Object.assign(c,{innerWidth:width,innerHeight:height});c.renderDefenseSkills();
  const buttons=body.children.at(-1).children;
  assert.equal(buttons.length,4,'live menu includes equipped and all three basic defenses');
  for(let i=1;i<4;i++){buttons[i].onclick();assert.equal(choices.at(-1).data.skillId,['Evade','Guard','Counter'][i-1]);}
  buttons[0].onclick();assert.equal(choices.at(-1).data.skillId,'equipped-evade');
}
c.UNIT_KITS.p.actions=[];c.renderDefenseSkills();
assert.equal(body.children.at(-1).children.length,3,'basic defenses remain available with no equipped Skills');
for(const button of body.children.at(-1).children){button.onclick();assert.ok(['Evade','Guard','Counter'].includes(choices.at(-1).data.skillId));}
// Run the actual READY queue against an authenticated permission rejection.
delete c.document;
let ui={round:1,ready:true,running:false},restored;
c.LuminousCombat073={uiState:()=>ui,restorePlanning(plans,ready){restored=plans;ui.ready=ready}};
c.LuminousCombatParticipants={isField:()=>true};
Object.assign(c.LuminousCombatLiveAdapter073.state,{role:'player',uid:'u',playerId:'p',round:1,firebaseReady:true,combatState:'PRE_COMBAT_PLANNING',combatants:{'player:p':{isPlayer:true,canonicalPlayerKey:'p',canonicalOwnerUid:'u',actionSlots:1}},db:{ref(){return{once:async()=>({val:()=>null}),update:async()=>{throw Object.assign(new Error('denied'),{code:'PERMISSION_DENIED'})}}}}});
c.firebase={database:{ServerValue:{TIMESTAMP:1}}};
vm.runInNewContext(read('js/combat-v073-plan-sync.js'),c);
const plan={type:'defense',data:normalize('equipped-evade',{type:'Evade'})};
const api=c.LuminousCombatPlanSync073;
assert.equal(api.payloadFor(plan,0,'player:p',c.LuminousCombatLiveAdapter073.state).skillId,'equipped-evade');
assert.equal(await api.queue({round:1,ready:true,plans:[plan]}),false);
assert.equal(ui.ready,false,'denied READY must allow editing');
assert.equal(restored[0].data.skillId,'equipped-evade','keep the selected plans');
console.log('defensive selection and READY rejection: ok');
