(function(global){
  'use strict';
  const ROOT='campaña/combate',INSTANCE='campaña/estado_mundo/instancia_activa';
  const blocked=raw=>['sealed','running'].includes(String(raw?.authority?.current?.phase||'').toLowerCase())||String(raw?.estado?.phase||'').toUpperCase()==='ENDING';
  const live=raw=>raw?.estado?.active!==false&&!['ENDED','SETUP'].includes(String(raw?.estado?.phase||'').toUpperCase());
  function nextEncounter(raw,{id,uid,time}){
    if(blocked(raw))return;
    // Reopening is idempotent: do not replace an active encounter or its plans.
    if(raw?.estado?.encounterId&&live(raw))return;
    if(raw?.estado&&live(raw)&&Object.keys(raw.combatants||{}).length)
      return {...raw,estado:{...(typeof raw.estado==='object'?raw.estado:{}),encounterId:id,encounterCreatedAt:time,active:true}};
    return {...(raw||{}),combatants:null,reserves:null,departed:null,plannedActions:null,readyPlayers:null,authority:null,playback:null,
      estado:{encounterId:id,encounterCreatedAt:time,phase:'PRE_COMBAT_PLANNING',active:true,round:1,presentation:'full',createdBy:uid,updatedAt:time},
      planningStartedAt:time,planningDuration:60};
  }
  function nextPresentation(raw,presentation){
    if(!raw||blocked(raw)||!['full','simple'].includes(presentation))return;
    if(Object.keys(raw.plannedActions||{}).length||Object.values(raw.readyPlayers||{}).some(row=>row?.ready))return;
    return {...raw,estado:{...(raw.estado||{}),presentation}};
  }
  function nextEnd(raw,{result,uid,time}){
    if(!raw||blocked(raw)||!['victory','defeat','cancelled'].includes(result))return;
    return {...raw,plannedActions:null,readyPlayers:null,estado:{...(raw.estado||{}),phase:'ENDED',active:false,result,outcome:result,
      transition:'auto_theatre',endedBy:uid,endedAt:time,updatedAt:time}};
  }
  async function updateRoot(db,update){
    const ref=db.ref(ROOT);let listener;
    try{
      // The entry page observes small child paths. Retain a complete parent
      // subscription while transacting: otherwise the SDK may first invoke the
      // updater with an uncached null and abort a valid between-round action.
      await new Promise((resolve,reject)=>{listener=()=>resolve();ref.on('value',listener,reject);});
      // The SDK cancels an ancestor transaction when this same client writes
      // an AI preview or speed child with set/update. Re-evaluate the guarded
      // transition against the latest state instead of failing the combat.
      for(let attempt=0;attempt<3;attempt++){
        try{return await ref.transaction(update,undefined,false);}
        catch(error){if(error?.message!=='set'||attempt===2)throw error;}
      }
    }finally{if(listener)ref.off('value',listener);}
  }
  function canSeal(raw,payload){
    if(!raw||!['PRE_COMBAT_PLANNING','PLANNING'].includes(String(raw.estado?.phase||raw.estado).toUpperCase())||Number(raw.estado?.round||1)!==payload.round)return false;
    const members=global.LuminousCombatParticipants?.players(raw.combatants)||[];
    if(members.length!==Object.keys(payload.plans||{}).length)return false;
    const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>k!=='updatedAt').map(k=>[k,stable(v[k])])):v;
    return members.every(member=>{
      const ready=raw.readyPlayers?.[member.playerId];
      if(!ready?.ready||Number(ready.round)!==payload.round||ready.unitId!==member.unitId)return false;
      const plans=Object.fromEntries(Object.entries(raw.plannedActions?.[member.playerId]||{}).filter(([,p])=>p?.unitId===member.unitId&&Number(p.round)===payload.round));
      return JSON.stringify(stable(plans))===JSON.stringify(stable((payload.planningWitness||payload.plans)[member.playerId]||{}));
    });
  }
  async function start({db,uid}){
    const id=`encounter-${global.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    const result=await updateRoot(db,raw=>nextEncounter(raw,{id,uid,time:Date.now()}));
    if(!result.committed&&blocked(result.snapshot.val()))throw Error('Espera a que termine la ronda antes de abrir otro encuentro.');
    await db.ref(INSTANCE).set('combate');
    return result.snapshot.val()?.estado;
  }
  async function end({result,finishEncounter}){
    if(typeof finishEncounter!=='function')throw Error('El visor aún no está listo para finalizar el encuentro.');
    return finishEncounter(result,{confirm:false});
  }
  async function claimEnd({db,uid,result,applyEffects}){
    const token=global.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;
    const response=await updateRoot(db,raw=>{
      if(!raw||['sealed','running'].includes(String(raw.authority?.current?.phase||'').toLowerCase()))return;
      if(raw.estado?.phase==='ENDING')return raw.estado.ending?.uid===uid&&raw.estado.ending?.result===result?raw:undefined;
      if(raw.estado?.phase==='ENDED'||!['victory','defeat','cancelled'].includes(result))return;
      const combatants=JSON.parse(JSON.stringify(raw.combatants||{}));
      applyEffects?.(combatants);
      return {...raw,combatants:JSON.parse(JSON.stringify(combatants)),estado:{...(raw.estado||{}),phase:'ENDING',ending:{token,uid,result}},plannedActions:null,readyPlayers:null};
    });
    if(!response.committed)throw Error('Espera a que termine la ronda antes de finalizar el encuentro.');
    return response.snapshot.val();
  }
  async function commitEnd({db,uid,result,token}){
    const response=await updateRoot(db,raw=>{
      if(raw?.estado?.phase!=='ENDING'||raw.estado.ending?.token!==token||raw.estado.ending?.uid!==uid||raw.estado.ending?.result!==result)return;
      return {...raw,estado:{...raw.estado,ending:null,phase:'ENDED',active:false,result,outcome:result,transition:'result',endedBy:uid,endedAt:Date.now(),updatedAt:Date.now()}};
    });
    if(!response.committed)throw Error('El encuentro cambió antes de confirmar el resultado.');
    return response.snapshot.val().estado;
  }
  async function presentation({db,value}){
    const response=await updateRoot(db,raw=>nextPresentation(raw,value));
    if(!response.committed)throw Error('Cambia la presentación entre rondas, antes de elegir acciones.');
    return value;
  }
  global.LuminousCombatSession=Object.freeze({ROOT,INSTANCE,blocked,live,nextEncounter,nextEnd,nextPresentation,start,end,claimEnd,commitEnd,updateRoot,canSeal,presentation});
})(typeof window!=='undefined'?window:globalThis);
