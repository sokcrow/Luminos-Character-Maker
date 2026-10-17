import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { functionSource, source, harness, unit } from './fixtures/combat-phase1-harness.mjs';
const moduleText=fs.readFileSync(new URL('../js/combat-v073-steps.js',import.meta.url),'utf8');
assert.doesNotMatch(moduleText,/\bdocument\b|\bsetTimeout\s*\(|\bDate\.|\bMath\.random\s*\(|\bfirebase\./);
// In the live path logical Speed order is independent of animation/wall-clock duration.
for(const delayed of [false,true]){
  const trace=[],keys=new Set();
  const events=[{id:'fast',participants:['a','target']},{id:'middle',participants:['a','b']},{id:'slow',participants:['c','target']}];
  const run=vm.runInNewContext(functionSource('executeCombatTimeline')+'\nexecuteCombatTimeline',{
    window:{LuminousCombatLiveMode:true},buildTimelineEvents:()=>events,
    setTimelineVisualFocus(){},clearTimelineVisualFocus(){},
    performance:{now(){throw new Error('wall clock consulted in live rules');}},
    async executeTimelineEvent(event){if(delayed)await new Promise(resolve=>setImmediate(resolve));trace.push(event.id);}
  });
  await run([],keys);assert.deepEqual(trace,['fast','middle','slow']);
}
// A rendered/replayed Coin uses its supplied result and consumes zero rules RNG.
{
  const makeNode=()=>({style:{},dataset:{},classList:{add(){},remove(){}},appendChild(){},append(){},replaceChildren(){},addEventListener(){}});
  const doc={createElement:makeNode,createDocumentFragment:makeNode};
  const win={Math,document:doc,setTimeout:fn=>queueMicrotask(fn)};win.window=win;
  const start=source.indexOf('(function (global) {',source.indexOf('<script>\n(function'));
  vm.runInNewContext(source.slice(start,source.indexOf('</script>',start)),win);
  let draws=0;
  for(let replay=0;replay<2;replay++){
    const result=await win.LuminousCoinEngine.runAnimatedRoll({document:doc,container:makeNode(),coinCount:1,resolvedCoins:[{side:'head'}],rng:()=>{draws++;throw new Error('presentation used rules RNG');},silent:true});
    assert.equal(result.coins[0].side,'head');
  }
  assert.equal(draws,0);
}
// A real authority wrapper supplies Concentration's ID random draw and a clock-free stamp.
{
  const h=harness({units:{a:unit('a')}}),w=h.sandbox;
  w.addEventListener=()=>{};w.setTimeout=()=>0;w.LuminousCombatLiveAdapter073={state:{}};
  w.Date={now(){throw new Error('wall time used for a sealed Concentration ID');}};
  vm.runInContext(fs.readFileSync(new URL('../js/combat-v073-authority.js',import.meta.url),'utf8'),vm.createContext(w));
  const authority=w.LuminousCombatAuthority073;
  authority.state.current={phase:'running',round:1};authority.resetRandom(123);
  authority.withAuthorityRandom(()=>w.shuffle([1,2,3]));
  assert.equal(authority.state.cursor,0,'private deck shuffle must not consume sealed rules RNG, even inside a rules scope');
  const first=w.beginConcentration('a','Spell');assert.equal(authority.state.cursor,1);
  h.data.a.concentration=null;authority.resetRandom(123);
  const second=w.beginConcentration('a','Spell');assert.equal(second.id,first.id);
}
// The step journal is a detached, serializable value, not mutable state or DOM references.
{
  const h=harness({units:{a:unit('a')}});h.steps.emit('ActionFinished',{ownerId:'a',localIndex:0,plan:{}});
  const events=h.steps.events();events[0].type='tampered';assert.equal(h.steps.events()[0].type,'RoundSealed');
  assert.doesNotThrow(()=>JSON.stringify(h.steps.events()));
}
console.log('Phase 1: logical timeline, pre-resolved/replayed Coin RNG, seeded Concentration IDs and event isolation passed');
// RTDB emits optimistic local writes even when rules later deny them. A rolled-back
// provisional 'running' must not consume the client's once-per-round start marker.
{
  const callbacks=new Map(),timers=[],round={textContent:'1'};let starts=0;
  const units={a:{id:'a',hp:100,maxHp:100,sp:0}};
  const s={role:'player',playerId:'a',uid:'uid-a',user:{uid:'uid-a'},round:1,firebaseReady:true,
    db:{ref(path){return{on(event,callback){callbacks.set(path,callback);},off(){}};}}};
  const w={Math:Object.create(Math),console,addEventListener(){},setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){},
    document:{getElementById:id=>id==='round'?round:null},
    LuminousCombatLiveAdapter073:{state:s,scheduleHydrate(){}},
    LuminousCombat073:{combatants:()=>units,plans:()=>[],render(){}},
    LuminousCombatHUD:{async startRound(){starts++;round.textContent='2';}}};w.window=w;
  vm.runInNewContext(fs.readFileSync(new URL('../js/combat-v073-authority.js',import.meta.url),'utf8'),w);
  const a=w.LuminousCombatAuthority073,onAuthority=callbacks.get(a.ROOT.current);
  onAuthority({val:()=>({round:1,phase:'running',seed:999})});
  onAuthority({val:()=>({})}); // denied write rolls back before its scheduled start
  await timers.find(t=>t.ms===80).fn();
  assert.equal(a.state.autoStartedRound,0);assert.equal(starts,0);
  onAuthority({val:()=>({round:1,phase:'running',seed:123,authorityUid:'dm'})});
  await timers.filter(t=>t.ms===80).at(-1).fn();
  // The scheduled callback invokes the async compatibility entry point.
  await a.state.executionChain;await Promise.resolve();
  assert.equal(starts,1);assert.equal(a.state.autoStartedRound,1);
}
console.log('Phase 1: rejected optimistic authority write cannot block the real DM turn');
