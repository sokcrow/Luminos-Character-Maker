import assert from 'node:assert/strict';
await import('../js/combat-participants.js');
await import('../js/combat-xp-runtime.js');
await import('../js/combat-session-lifecycle.js');

const xp=globalThis.LuminousCombatXpRuntime;
const session=globalThis.LuminousCombatSession;
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const invalidKey=/[.#$/\[\]]/;
function assertFirebaseData(value,path='value'){
  if(value===undefined||typeof value==='function'||typeof value==='symbol'
    ||(typeof value==='number'&&!Number.isFinite(value)))throw Error('Invalid Firebase value at '+path);
  if(value&&typeof value==='object'){
    for(const [key,child] of Object.entries(value)){
      if(invalidKey.test(key))throw Error('Invalid Firebase key at '+path+'/'+key);
      assertFirebaseData(child,path+'/'+key);
    }
  }
}
function fake(initial){
  const values=clone(initial),history=[];
  const pieces=path=>String(path||'').split('/').filter(Boolean);
  const read=path=>pieces(path).reduce((node,key)=>node?.[key],values)??null;
  const write=(path,value)=>{
    const keys=pieces(path),last=keys.pop();let node=values;
    for(const key of keys)node=node[key]??={};
    if(value==null)delete node[last];else node[last]=clone(value);
  };
  const ref=path=>({
    once:async()=>({val:()=>clone(read(path))}),
    on:(_event,handler)=>handler({val:()=>clone(read(path))}),
    off:()=>{},
    set:async value=>{assertFirebaseData(value,path);write(path,value)},
    transaction:async update=>{
      const next=update(clone(read(path)));
      if(next!==undefined){assertFirebaseData(next,path);write(path,next);history.push(path);}
      return {committed:next!==undefined,snapshot:{val:()=>clone(read(path))}};
    }
  });
  return {ref,read,history};
}
const encounterId='recovery-xp-limbo';
const state={
  campaña:{
    combate:{
      estado:{phase:'ENDING',active:true,encounterId,ending:{uid:'dm',result:'victory',token:'original',startedAt:1,failed:true}},
      authority:{current:{phase:'running'}},
      participants:{p:true},
      combatants:{
        player:{isPlayer:true,playerId:'p',faction:'ally'},
        defeatedEnemy:{id:'enemy-no-cr',faction:'enemy',hp:0,defeated:true},
        validEnemy:{id:'rated',faction:'enemy',hp:0,defeated:true,challengeRating:1}
      }
    },
    jugadores:{p:{xp:10}},
    estado_mundo:{instancia_activa:'combate'}
  }
};
const db=fake(state);

// Proof of the original bug: the rich calculation carries an optional
// undefined Unit field, which Firebase refuses inside a frozen plan.
const oldEnemyData=await xp.enemyDefinitionsForVictory(db,state.campaña.combate);
const rich=xp.resolveEncounterXp({enemies:oldEnemyData.enemies,participants:[{id:'player:p'}]});
assert.throws(()=>assertFirebaseData(rich),/Invalid Firebase value.*challengeRating/);

let effectCalls=0;
const resumed=await session.claimEnd({db,uid:'dm',result:'victory',applyEffects:()=>{effectCalls++;}});
assert.equal(effectCalls,0,'do not reapply encounter-end effects to the player');
assert.equal(resumed.estado.ending.token,'original');
const award=await xp.awardVictoryXp({db,encounter:resumed});
assert.equal(award.xpPerParticipant,200);
assert.equal(db.read('campaña/jugadores/p/xp'),210);
const plan=db.read('campaña/combate/xpPlans/'+encounterId);
assert.ok(plan);
assert.equal(plan.result.contributions,undefined);
assert.equal(plan.result.participants,undefined);
assert.deepEqual(Object.keys(plan.result).sort(),['bonusXp','enemyXp','fixedEncounterXp','participantCount','remainderXp','totalXp','xpPerParticipant']);
assert.doesNotThrow(()=>assertFirebaseData(plan));

const ended=await session.commitEnd({db,uid:'dm',result:'victory',token:'original',xpAward:award});
assert.equal(ended.phase,'ENDED');
assert.equal(db.read('campaña/combate/estado/active'),false);
const replay=await xp.awardVictoryXp({db,encounter:db.read('campaña/combate')});
assert.equal(replay.awards[0].awarded,false,'durable receipt must prohibit duplicate XP');
assert.equal(db.read('campaña/jugadores/p/xp'),210);

await session.start({db,uid:'dm'});
assert.equal(db.read('campaña/combate/estado/phase'),'PRE_COMBAT_PLANNING');
assert.equal(db.read('campaña/estado_mundo/instancia_activa'),'combate');
assert.equal(db.read('campaña/jugadores/p/xp'),210);
assert.equal(db.read('campaña/combate/xpPlans'),null,'next combat must not inherit frozen payout plans');
console.log('XP limbo recovery: compact RTDB plan, durable award, ENDING to ENDED, next encounter PASS');
