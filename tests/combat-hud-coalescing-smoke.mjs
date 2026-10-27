import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const nodes=new Map(),frames=new Map(),handlers={},writes=[],poses=[];let serial=0,reads=0;
function node(id=''){const classes=new Set();return{id,hidden:false,style:{setProperty:(k,v)=>writes.push([id,k,v])},classList:{contains:k=>classes.has(k),toggle(k,v){if(v)classes.add(k);else classes.delete(k)},add:k=>classes.add(k)},dataset:{},setAttribute(){},appendChild(n){nodes.set(n.id,n)},querySelector(){return null},replaceChildren(){},get clientWidth(){reads++;return 390}};}
nodes.set('game-container',node('game-container'));nodes.set('status',{textContent:'Resolviendo turno…'});
nodes.set('sprite-a',{dataset:{},animate(){poses.push('animated');return{cancel(){poses.push('cancelled')}}}});
const c=vm.createContext({console,Math,Map,Set,innerWidth:390,innerHeight:844,
 document:{getElementById:id=>nodes.get(id),createElement:()=>node(),querySelectorAll:()=>[]},
 requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial},cancelAnimationFrame:id=>frames.delete(id),
 addEventListener:(name,fn)=>{handlers[name]=fn},matchMedia:()=>({matches:false,addEventListener(){}}),
 LuminousCombat073:{uiState:()=>({running:true,nav:'root',round:1}),combatants:()=>({a:{id:'a',hp:10}}),playerId:()=> 'a'},
 LuminousCombatLiveAdapter073:{state:{role:'player'}},LuminousWebGL2Renderer:{requestRender:()=>poses.push('render')},
});c.window=c;
vm.runInContext(fs.readFileSync('js/combat-v073-hud-motion.js','utf8'),c);
const api=c.LuminousCombatHudMotion073;
// Settle mount layout, then exercise the event burst and real motion entry.
for(let i=0;i<5&&frames.size;i++){const rows=[...frames];frames.clear();rows.forEach(([,fn])=>fn())}reads=0;writes.length=0;
for(let i=1;i<=500;i++)api.event({roundId:'same-round',sequence:i,type:'CoinRolled'});
assert.equal(reads,0,'Journal events cannot force synchronous layout');assert.equal(frames.size,1,'Burst requests one HUD refresh');
api.cue('powerStart',[{ownerId:'a',plan:{type:'skill',data:{}}}]);assert.equal(nodes.get('sprite-a').dataset.combatPose,'attack');assert.ok(poses.includes('animated'),'Motion still starts immediately');
for(let i=0;i<5&&frames.size;i++){const rows=[...frames];frames.clear();rows.forEach(([,fn])=>fn())}
assert.equal(reads,1,'One width read for the entire event burst');assert.equal(nodes.get('combat-phase-label').textContent,'Resolviendo turno');assert.ok(writes.some(x=>x[1]==='--clash-mobile-scale'),'Mobile HUD layout remains updated');
api.event({roundId:'same-round',sequence:501,type:'CoinRolled'});handlers.beforeunload();assert.equal(frames.size,0,'Teardown cancels queued layout');
console.log('HUD event burst: 500 journal events → one layout; live pose, mobile layout, phase label and teardown preserved.');
