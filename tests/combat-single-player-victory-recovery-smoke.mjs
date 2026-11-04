import assert from 'node:assert/strict';
await import('../js/movement-speed-runtime.js');
await import('../js/skill-catalog-kobold-tier1.js');
await import('../js/unit-catalog-kobold-tier1.js');
await import('../js/unit-combat-instantiator.js');
await import('../js/combat-participants.js');
await import('../js/combat-mvp-runtime.js');
await import('../js/combat-xp-runtime.js');
await import('../js/combat-session-lifecycle.js');
await import('../js/battle-viewer-dm-console-074.js');

const consoleApi=globalThis.LuminousBattleViewerDmConsole074;
const xp=globalThis.LuminousCombatXpRuntime;
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
// Validate before serialization; JSON.stringify alone hides undefined fields.
function wire(value,path=''){
  assert.notEqual(value,undefined,'undefined write at '+path);
  if(typeof value==='number')assert.ok(Number.isFinite(value),'invalid amount at '+path);
  if(!value||typeof value!=='object')return value;
  const rows=Object.entries(value).map(([key,child])=>{
    assert.ok(!/[.#$\/\[\]\u0000-\u001f\u007f]/.test(key),'invalid key at '+path+'/'+key);
    return [key,wire(child,path+'/'+key)];
  }).filter(([,child])=>child!==null);
  if(!rows.length)return null; // Actual RTDB drops nulls and empty collections.
  return Array.isArray(value)?rows.reduce((a,[k,v])=>{a[k]=v;return a;},[]):Object.fromEntries(rows);
}
function database(fight){
  const data={campaña:{combate:clone(fight),jugadores:{p:{xp:10,sp:40}},estado_mundo:{instancia_activa:'combate'}}};
  const history=[],listeners=new Map();let failure=null;
  const read=path=>path.split('/').filter(Boolean).reduce((v,k)=>v?.[k],data)??null;
  const write=(path,value)=>{
    const parts=path.split('/'),last=parts.pop();let node=data;
    for(const p of parts)node=node[p]||={};
    const next=wire(value,path);if(next===null)delete node[last];else node[last]=clone(next);
    history.push(path);
  };
  const ref=path=>({
    once:async()=>({val:()=>clone(read(path))}),
    on:(_,fn)=>{listeners.set(path,(listeners.get(path)||0)+1);fn({val:()=>clone(read(path))});},
    off:()=>listeners.set(path,listeners.get(path)-1),
    set:async value=>write(path,value),
    transaction:async update=>{
      const next=update(clone(read(path)));
      if(failure?.path===path&&failure.when(next)){
        const error=failure.error;failure=null;throw error;
      }
      if(next!==undefined)write(path,next);
      return {committed:next!==undefined,snapshot:{val:()=>clone(read(path))}};
    }
  });
  return {ref,read,write,history,listeners,fail(path,when,error){failure={path,when,error};}};
}
function encounter(id,{pending=false,legacy=false}={}){
  const enemy=legacy
    ? {id:'enemy-instance',unitRef:{scope:'units',id:'kobold_dagger'},faction:'enemy',hp:0,defeated:true}
    : globalThis.LuminousUnitCombatInstantiator.instantiate('kobold_dagger',{}, {serial:id});
  enemy.hp=0;enemy.defeated=true;
  return {estado:{phase:pending?'ENDING':'PRE_COMBAT_PLANNING',active:true,encounterId:id,
    ...(pending?{ending:{uid:'dm',token:'original',result:'victory',failed:true}}:{})},
    ...(pending?{authority:{current:{phase:'running'}}}:{}),participants:{p:true},
    combatants:{hero:{isPlayer:true,playerId:'p',faction:'ally',sp:pending?20:40},enemy}};
}
let lootCalls=0,effects=0;
globalThis.LuminousLootLivePostCombatRuntime={
  ensureEncounterId:async({db})=>db.read('campaña/combate/estado/encounterId'),
  finalizeEncounterLoot:async()=>{lootCalls++;return {finalized:[],skipped:[]};}
};
globalThis.LuminousConditionRuntime={onEncounterEnd(){effects++;}};
// Only DOM/auth adapters are stubbed. The actual close, SP, XP and result
// modules execute, including the final shared Theatre transition.
globalThis.document={getElementById:id=>id==='battlefield'?{}:null};
globalThis.LuminousCombat073={combatants(){return {};}};
globalThis.firebase={auth:()=>({currentUser:{uid:'dm'}})};
async function close(db){
  consoleApi._state.db=db;consoleApi._state.authorized=true;
  return consoleApi.finishEncounter('victory',{confirm:false,displayMs:0});
}
for(const options of [{},{pending:true},{pending:true,legacy:true}]){
  const id='single-'+JSON.stringify(options).replace(/[^a-z]/gi,''),db=database(encounter(id,options));
  const before=effects;
  const result=await close(db);
  assert.equal(result.nextInstance,'teatro');
  assert.equal(db.read('campaña/combate/estado/phase'),'ENDED');
  assert.equal(db.read('campaña/estado_mundo/instancia_activa'),'teatro');
  assert.equal(db.read('campaña/jugadores/p/sp'),20);
  assert.equal(db.read('campaña/jugadores/p/xp'),38,'25 XP + 3 MVP + existing 10');
  assert.equal(db.read('campaña/combate/estado/mvp/id'),'player:p');
  assert.equal(db.read('campaña/combate/estado/rewardRows/0/xp'),28);
  assert.equal(effects-before,options.pending?0:2,'no repeated encounter effects');
  await close(db);
  assert.equal(db.read('campaña/jugadores/p/xp'),38);
  assert.ok([...db.listeners.values()].every(n=>n===0));
}

// Fail the real trigger at each write boundary, then resume the same token.
for(const stage of ['plan','payout','result']){
  const id='retry-'+stage,db=database(encounter(id));
  const permission=Object.assign(Error('permission_denied'),{code:'PERMISSION_DENIED'});
  const path=stage==='plan'?'campaña/combate/xpPlans/'+id:stage==='payout'?'campaña/jugadores/p':'campaña/combate';
  db.fail(path,next=>stage==='payout'?Boolean(next?.encounterXpAwards):stage==='result'?next?.estado?.phase==='ENDED':true,permission);
  await assert.rejects(()=>close(db),error=>error===permission&&error.encounterEndStage===(stage==='result'?'result':'experience')
    &&(stage==='result'||error.encounterXpStage===(stage==='plan'?'plan':'payout')));
  assert.equal(db.read('campaña/combate/estado/phase'),'ENDING');
  const token=db.read('campaña/combate/estado/ending/token'),before=effects;
  await close(db);
  assert.equal(effects,before);
  assert.equal(db.read('campaña/combate/estado/phase'),'ENDED');
  assert.equal(db.read('campaña/estado_mundo/instancia_activa'),'teatro');
  assert.equal(db.read('campaña/jugadores/p/xp'),38);
  assert.ok(token);
}

// Existing frozen plans remain authoritative, including legacy rich results.
const legacy=database(encounter('frozen',{pending:true}));
legacy.write('campaña/combate/xpPlans/frozen',{
  encounterId:'frozen',participantIds:['p'],mvp:null,
  recipients:[{kind:'player',id:'p',path:'campaña/jugadores/p'}],
  result:{totalXp:20,enemyXp:20,fixedEncounterXp:0,bonusXp:0,participantCount:1,xpPerParticipant:20,remainderXp:0,contributions:[{unit:{challengeRating:1}}]}
});
await close(legacy);assert.equal(legacy.read('campaña/jugadores/p/xp'),30,'never recompute an old frozen payout');
await close(legacy);assert.equal(legacy.read('campaña/jugadores/p/xp'),30);

assert.deepEqual(xp.eligibleVictoryPlayers({participants:{'invalid.id':true,'invalid/id':true,'invalid[id':true,p:true}}),['p']);
assert.ok(lootCalls>0);
console.log('Single Player / Dagger Kobold: full close to Theatre, MVP, legacy identity, frozen plan, plan/payment/result failures and idempotent retries PASS');
