(function(global){
 'use strict';
 const PATH='campaña/mvp_sesion/actual',PLAYERS='campaña/jugadores';
 const clean=v=>String(v??'').trim();
 const validKey=v=>v&&!/[.#$\/\[\]]/.test(v);
 const xpForLevel=level=>Math.max(100,100*Math.floor(Math.max(1,Math.floor(Number(level)||1))/5));
 const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
 const candidateList=players=>Object.entries(players||{}).filter(([id,p])=>validKey(id)&&p&&p.uid&&p.active!==false&&p.activo!==false&&p.disabled!==true).map(([id,p])=>({id,uid:p.uid,name:clean(p.nombre||p.name||p.characterName||id),portrait:clean(p.splashArt||p.portrait||p.avatar||p.imageUrl),level:Math.max(1,Math.floor(Number(p.level)||1))}));
 function tally(current={}){
   const counts={};Object.keys(current.candidates||{}).forEach(id=>counts[id]=0);
   for(const [voterId,id] of Object.entries(current.votes||{}))
     if(current.candidates?.[voterId]&&Object.hasOwn(counts,id)&&id!==voterId)counts[id]++;
   const max=Math.max(0,...Object.values(counts));
   return {counts,leaders:Object.keys(counts).filter(id=>counts[id]===max).sort()};
 }
 async function start({db,uid,selectedIds}){
   if(!db?.ref||!uid)throw Error('MVP_CONTEXT_REQUIRED');
   const [players,config,current]=await Promise.all([db.ref(PLAYERS).once('value').then(s=>s.val()||{}),
     db.ref('campaña/config/dm_uid').once('value').then(s=>s.val()),
     db.ref(PATH).once('value').then(s=>s.val())]);
   if(uid!==config&&uid!=='e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1')throw Error('MVP_DM_ONLY');
   if(current&&['voting','coins','awarding'].includes(current.phase))throw Error('MVP_ALREADY_ACTIVE');
   const roster=candidateList(players).filter(x=>!selectedIds||selectedIds.includes(x.id));
   if(roster.length<2)throw Error('MVP_MINIMUM_TWO_PLAYERS');
   const id='session-'+(global.crypto?.randomUUID?.()||Date.now().toString(36));
   const next={id,phase:'voting',createdAt:Date.now(),createdBy:uid,
     candidates:Object.fromEntries(roster.map(x=>[x.id,x])),votes:{}};
   const tx=await db.ref(PATH).transaction(prev=>{
     if(prev&&['voting','coins','awarding'].includes(prev.phase))return;
     return next;
   },undefined,false);
   if(!tx.committed)throw Error('MVP_ALREADY_ACTIVE');
   return tx.snapshot.val();
 }
 async function vote({db,uid,voterId,candidateId}){
   const current=(await db.ref(PATH).once('value')).val();
   if(current?.phase!=='voting'||!current.candidates?.[voterId]||!current.candidates?.[candidateId]||
     voterId===candidateId||current.candidates[voterId].uid!==uid)throw Error('MVP_INVALID_VOTE');
   const tx=await db.ref(PATH+'/votes/'+voterId).transaction(old=>old==null?candidateId:undefined,undefined,false);
   if(!tx.committed)throw Error('MVP_ALREADY_VOTED');
   return candidateId;
 }
 async function close({db,uid}){
   const dm=(await db.ref('campaña/config/dm_uid').once('value')).val();
   if(uid!==dm&&uid!=='e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1')throw Error('MVP_DM_ONLY');
   const tx=await db.ref(PATH).transaction(old=>{
     if(old?.phase!=='voting')return;
     const {counts,leaders}=tally(old);
     if(!Object.keys(old.votes||{}).length)return;
     return {...old,counts,phase:leaders.length===1?'awarding':'coins',
       winnerId:leaders.length===1?leaders[0]:null,tiedIds:leaders.length>1?leaders:null,tiedCandidates:leaders.length>1?Object.fromEntries(leaders.map(id=>[id,true])):null,
       coinRound:leaders.length>1?1:0,coinClicks:null,coinFaces:null};
   },undefined,false);
   if(!tx.committed)throw Error('MVP_VOTING_NOT_CLOSED');
   return tx.snapshot.val();
 }
 async function clickCoin({db,uid,voterId}){
   const state=(await db.ref(PATH).once('value')).val();
   if(state?.phase!=='coins'||!state.tiedIds?.includes(voterId)||state.candidates?.[voterId]?.uid!==uid)throw Error('MVP_COIN_NOT_ELIGIBLE');
   const tx=await db.ref(PATH+'/coinClicks/'+voterId).transaction(old=>old==null?state.coinRound:undefined,undefined,false);
   if(!tx.committed)throw Error('MVP_COIN_ALREADY_CLICKED');
   return true;
 }
 function secureHeads(){
   if(!global.crypto?.getRandomValues)throw Error('MVP_SECURE_RANDOM_UNAVAILABLE');
   const a=new Uint32Array(1),limit=4294967296-(4294967296%2);
   do{global.crypto.getRandomValues(a)}while(a[0]>=limit);
   return a[0]%2===0;
 }
 async function resolveCoins({db,uid}){
   const dm=(await db.ref('campaña/config/dm_uid').once('value')).val();
   if(uid!==dm&&uid!=='e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1')throw Error('MVP_DM_ONLY');
   const tx=await db.ref(PATH).transaction(old=>{
     if(old?.phase!=='coins'||!old.tiedIds?.length||
       !old.tiedIds.every(id=>old.coinClicks?.[id]===old.coinRound))return;
     const faces=Object.fromEntries(old.tiedIds.map(id=>[id,secureHeads()?'Heads':'Tails']));
     const heads=old.tiedIds.filter(id=>faces[id]==='Heads');
     const next=heads.length?heads:old.tiedIds;
     const winnerId=next.length===1?next[0]:null;
     return {...old,previousCoinRound:old.coinRound,coinFaces:faces,
       coinHistory:{...(old.coinHistory||{}),['round_'+old.coinRound]:faces},
       phase:winnerId?'awarding':'coins',winnerId,
       tiedIds:winnerId?null:next,tiedCandidates:winnerId?null:Object.fromEntries(next.map(id=>[id,true])),coinRound:winnerId?old.coinRound:old.coinRound+1,
       coinClicks:null};
   },undefined,false);
   if(!tx.committed)throw Error('MVP_COINS_PENDING');
   return tx.snapshot.val();
 }
 async function award({db,uid}){
   const dm=(await db.ref('campaña/config/dm_uid').once('value')).val();
   if(uid!==dm&&uid!=='e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1')throw Error('MVP_DM_ONLY');
   const old=(await db.ref(PATH).once('value')).val();
   if(old?.phase==='completed')return old;
   if(old?.phase!=='awarding'||!validKey(old.winnerId)||!validKey(old.id)||!old.candidates?.[old.winnerId])throw Error('MVP_NOT_READY');
   const reward=xpForLevel(old.candidates[old.winnerId].level);
   const ref=db.ref(PLAYERS+'/'+old.winnerId);
   const paid=await ref.transaction(current=>{
     if(!current||current.uid!==old.candidates[old.winnerId].uid)return;
     if(current.sessionMvpAwards?.[old.id])return;
     return {...current,xp:Math.max(0,Number(current.xp)||0)+reward,
       sessionMvpAwards:{...(current.sessionMvpAwards||{}),[old.id]:{xp:reward,level:old.candidates[old.winnerId].level,awardedAt:Date.now()}}};
   },undefined,false);
   const receipt=paid.snapshot?.val()?.sessionMvpAwards?.[old.id];
   if(!receipt||receipt.xp!==reward)throw Error('MVP_REWARD_RECEIPT_MISMATCH');
   const tx=await db.ref(PATH).transaction(current=>{
     if(current?.id!==old.id||current.winnerId!==old.winnerId||!['awarding','completed'].includes(current.phase))return;
     return {...current,phase:'completed',rewardXp:reward,completedAt:current.completedAt||Date.now()};
   },undefined,false);
   if(!tx.committed)throw Error('MVP_FINALIZE_RETRY');
   return tx.snapshot.val();
 }
 const api=Object.freeze({PATH,candidateList,tally,xpForLevel,start,vote,close,clickCoin,resolveCoins,award});
 global.LuminousSessionMvpRuntime=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
