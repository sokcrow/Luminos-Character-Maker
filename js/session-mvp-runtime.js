(function(global){
 'use strict';
 const PATH='campaña/mvp_sesion/actual',PLAYERS='campaña/jugadores',BALLOTS='sessionMvpBallots';
 const clean=v=>String(v??'').trim();
 const validKey=v=>typeof v==='string'&&v.length>0&&!/[.#$\/\[\]]/.test(v);
 const xpForLevel=level=>Math.max(100,100*Math.floor(Math.max(1,Math.floor(Number(level)||1))/5));
 const activePhases=['voting','closing','coins','awarding'];
 const candidateList=players=>Object.entries(players||{}).filter(([id,p])=>validKey(id)&&p&&validKey(p.uid)&&p.active!==false&&p.activo!==false&&p.disabled!==true).map(([id,p])=>({id,uid:p.uid,name:clean(p.nombre||p.name||p.characterName||id),portrait:clean(p.splashArt||p.portrait||p.avatar||p.imageUrl),level:Math.max(1,Math.floor(Number(p.level)||1))}));
 async function requireDm(db,uid){
   const dm=(await db.ref('campaña/config/dm_uid').once('value')).val();
   if(!uid||(uid!==dm&&uid!=='e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1'))throw Error('MVP_DM_ONLY');
 }
  // Keep the complete value cached until the guarded transaction finishes.
  // once() detaches immediately; the SDK may otherwise call the updater with
  // an uncached null and abort before it reaches the server.
  async function cachedTransaction(ref, update) {
    let listener;
    try {
      if (typeof ref.on === 'function') {
        await new Promise((resolve, reject) => {
          listener = () => resolve();
          ref.on('value', listener, reject);
        });
      } else await ref.once('value');
      return await ref.transaction(update, undefined, false);
    } finally {
      if (listener) ref.off('value', listener);
    }
  }
 function tally(current={}){
   const counts={},accounts=new Set();Object.keys(current.candidates||{}).forEach(id=>counts[id]=0);
   for(const [voterId,id] of Object.entries(current.votes||{})){
     const voter=current.candidates?.[voterId],target=current.candidates?.[id];
     if(voter&&target&&Object.hasOwn(counts,id)&&id!==voterId&&(!voter.uid||voter.uid!==target.uid)&&!accounts.has(voter.uid||voterId)){
       counts[id]++;accounts.add(voter.uid||voterId);
     }
   }
   const max=Math.max(0,...Object.values(counts));
   return {counts,leaders:Object.keys(counts).filter(id=>counts[id]===max).sort()};
 }
 async function start({db,uid,selectedIds}){
   if(!db?.ref||!uid)throw Error('MVP_CONTEXT_REQUIRED');
   await requireDm(db,uid);
   const players=(await db.ref(PLAYERS).once('value')).val()||{};
   // One selected character per account; filtering first preserves the DM's choice.
   const accounts=new Set();
   const roster=candidateList(players).filter(x=>!selectedIds||selectedIds.includes(x.id)).filter(x=>{
     if(accounts.has(x.uid))return false;accounts.add(x.uid);return true;
   });
   if(roster.length<2)throw Error('MVP_MINIMUM_TWO_PLAYERS');
   const id='session-'+(global.crypto?.randomUUID?.()||Date.now().toString(36));
   const next={schemaVersion:2,id,phase:'voting',createdAt:Date.now(),createdBy:uid,
     candidates:Object.fromEntries(roster.map(x=>[x.id,x])),voters:Object.fromEntries(roster.map(x=>[x.uid,x.id]))};
   const tx=await cachedTransaction(db.ref(PATH), prev=>prev&&activePhases.includes(prev.phase)?undefined:next);
   if(!tx.committed)throw Error('MVP_ALREADY_ACTIVE');
   return tx.snapshot.val();
 }
 async function vote({db,uid,voterId,candidateId,sessionId}){
   const current=(await db.ref(PATH).once('value')).val();
   if(current?.schemaVersion!==2||current.phase!=='voting'||sessionId&&sessionId!==current.id||
     current.voters?.[uid]!==voterId||!current.candidates?.[candidateId]||current.candidates[candidateId].uid===uid)throw Error('MVP_INVALID_VOTE');
   const tx=await cachedTransaction(db.ref(BALLOTS+'/'+current.id+'/'+uid), old=>old==null?candidateId:undefined);
   if(!tx.committed)throw Error('MVP_ALREADY_VOTED');
   return candidateId;
 }
 async function close({db,uid}){
   await requireDm(db,uid);
   // Freeze submissions before reading the private ballots. A retry can resume
   // closing after a disconnect without reopening or discarding votes.
   const frozen=await cachedTransaction(db.ref(PATH), old=>{
     if(!old||!['voting','closing'].includes(old.phase))return;
     return {...old,phase:'closing'};
   });
   if(!frozen.committed)throw Error('MVP_VOTING_NOT_CLOSED');
   const current=frozen.snapshot.val();
   const ballots=(await db.ref(BALLOTS+'/'+current.id).once('value')).val()||{};
   const votes=current.schemaVersion===2?Object.fromEntries(Object.entries(ballots).filter(([account])=>current.voters?.[account]).map(([account,id])=>[current.voters[account],id])):current.votes||{};
   const {counts,leaders}=tally({...current,votes});
   const validVotes=Object.values(counts).reduce((a,b)=>a+b,0);
   const tx=await cachedTransaction(db.ref(PATH), old=>{
     if(old?.id!==current.id||old.phase!=='closing')return;
     const {votes:discarded,...publicState}=old;
     return {...publicState,counts,phase:!validVotes?'cancelled':leaders.length===1?'awarding':'coins',
       winnerId:validVotes&&leaders.length===1?leaders[0]:null,
       tiedIds:validVotes&&leaders.length>1?leaders:null,
       tiedCandidates:validVotes&&leaders.length>1?Object.fromEntries(leaders.map(id=>[id,true])):null,
       coinRound:validVotes&&leaders.length>1?1:0,coinClicks:null,coinFaces:null};
   });
   if(!tx.committed)throw Error('MVP_VOTING_NOT_CLOSED');
   return tx.snapshot.val();
 }
 async function cancel({db,uid}){
   await requireDm(db,uid);
   const tx=await cachedTransaction(db.ref(PATH), old=>{
     if(!old||!['voting','closing','coins'].includes(old.phase))return;
     const {votes:discarded,...publicState}=old;
     return {...publicState,phase:'cancelled',cancelledAt:Date.now()};
   });
   if(!tx.committed)throw Error('MVP_NOT_CANCELLABLE');
   return tx.snapshot.val();
 }
 async function clickCoin({db,uid,voterId,sessionId}){
   const state=(await db.ref(PATH).once('value')).val();
   if(state?.phase!=='coins'||sessionId&&sessionId!==state.id||!state.tiedIds?.includes(voterId)||state.candidates?.[voterId]?.uid!==uid)throw Error('MVP_COIN_NOT_ELIGIBLE');
   const tx=await cachedTransaction(db.ref(PATH+'/coinClicks/'+voterId), old=>old==null?state.coinRound:undefined);
   if(!tx.committed)throw Error('MVP_COIN_ALREADY_CLICKED');
   return true;
 }
 function secureHeads(){
   if(!global.crypto?.getRandomValues)throw Error('MVP_SECURE_RANDOM_UNAVAILABLE');
   const a=new Uint32Array(1);global.crypto.getRandomValues(a);return a[0]%2===0;
 }
 async function resolveCoins({db,uid,includeAbsent=false}){
   await requireDm(db,uid);
   // Randomness is sampled once per attempt, outside the retriable updater.
   const expected=(await db.ref(PATH).once('value')).val();
   if(expected?.phase!=='coins'||!expected.tiedIds?.length)throw Error('MVP_COINS_PENDING');
   const absent=expected.tiedIds.filter(id=>expected.coinClicks?.[id]!==expected.coinRound);
   if(absent.length&&!includeAbsent)throw Error('MVP_COINS_PENDING');
   const faces=Object.fromEntries(expected.tiedIds.map(id=>[id,secureHeads()?'Heads':'Tails']));
   const tx=await cachedTransaction(db.ref(PATH), old=>{
     if(old?.id!==expected.id||old.phase!=='coins'||old.coinRound!==expected.coinRound||JSON.stringify(old.tiedIds)!==JSON.stringify(expected.tiedIds))return;
     if(!includeAbsent&&!old.tiedIds.every(id=>old.coinClicks?.[id]===old.coinRound))return;
     const heads=old.tiedIds.filter(id=>faces[id]==='Heads'),next=heads.length?heads:old.tiedIds;
     const winnerId=next.length===1?next[0]:null;
     return {...old,previousCoinRound:old.coinRound,coinFaces:faces,
       coinHistory:{...(old.coinHistory||{}),['round_'+old.coinRound]:faces},
       absentCoinHistory:{...(old.absentCoinHistory||{}),['round_'+old.coinRound]:Object.fromEntries(absent.map(id=>[id,true]))},
       phase:winnerId?'awarding':'coins',winnerId,tiedIds:winnerId?null:next,
       tiedCandidates:winnerId?null:Object.fromEntries(next.map(id=>[id,true])),coinRound:winnerId?old.coinRound:old.coinRound+1,coinClicks:null};
   });
   if(!tx.committed)throw Error('MVP_COINS_PENDING');
   return tx.snapshot.val();
 }
 async function award({db,uid}){
   await requireDm(db,uid);
   const old=(await db.ref(PATH).once('value')).val();
   if(old?.phase==='completed')return old;
   if(old?.phase!=='awarding'||!validKey(old.winnerId)||!validKey(old.id)||!old.candidates?.[old.winnerId])throw Error('MVP_NOT_READY');
   const reward=xpForLevel(old.candidates[old.winnerId].level);
   const paid=await cachedTransaction(db.ref(PLAYERS+'/'+old.winnerId), current=>{
     if(!current||current.uid!==old.candidates[old.winnerId].uid)return;
     if(current.sessionMvpAwards?.[old.id])return;
     return {...current,xp:Math.max(0,Number(current.xp)||0)+reward,
       sessionMvpAwards:{...(current.sessionMvpAwards||{}),[old.id]:{xp:reward,level:old.candidates[old.winnerId].level,awardedAt:Date.now()}}};
   });
   const receipt=paid.snapshot?.val()?.sessionMvpAwards?.[old.id];
   if(!receipt||receipt.xp!==reward)throw Error('MVP_REWARD_RECEIPT_MISMATCH');
   const tx=await cachedTransaction(db.ref(PATH), current=>{
     if(current?.id!==old.id||current.winnerId!==old.winnerId||!['awarding','completed'].includes(current.phase))return;
     return {...current,phase:'completed',rewardXp:reward,completedAt:current.completedAt||Date.now()};
   });
   if(!tx.committed)throw Error('MVP_FINALIZE_RETRY');
   return tx.snapshot.val();
 }
 function errorMessage(error){
   const code=String(error?.code||'').toLowerCase(),msg=String(error?.message||'');
   if(code.includes('permission'))return 'No se pudo guardar. Comprueba que entraste con la cuenta correcta y que las reglas están actualizadas.';
   const messages={MVP_DM_ONLY:'Solo el DM puede realizar esta acción.',MVP_MINIMUM_TWO_PLAYERS:'Selecciona al menos dos cuentas distintas.',MVP_ALREADY_ACTIVE:'Ya hay una votación activa. Puedes retomarla o cancelarla.',MVP_INVALID_VOTE:'Elige a otro participante de la votación actual.',MVP_ALREADY_VOTED:'Tu voto ya está registrado.',MVP_COINS_PENDING:'La ronda cambió o quedan monedas pendientes. Revisa el estado e inténtalo otra vez.',MVP_COIN_NOT_ELIGIBLE:'Tu personaje no participa en este desempate.',MVP_COIN_ALREADY_CLICKED:'Tu moneda ya está preparada.',MVP_NOT_CANCELLABLE:'La entrega ya comenzó. Confirma la recompensa para terminar.',MVP_VOTING_NOT_CLOSED:'La votación cambió. Revisa su estado y vuelve a intentarlo.'};
   return messages[msg]||'No se pudo completar la acción. Revisa tu conexión y vuelve a intentarlo; los premios confirmados se conservan.';
 }
 const api=Object.freeze({PATH,BALLOTS,candidateList,tally,xpForLevel,start,vote,close,cancel,clickCoin,resolveCoins,award,errorMessage});
 global.LuminousSessionMvpRuntime=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
