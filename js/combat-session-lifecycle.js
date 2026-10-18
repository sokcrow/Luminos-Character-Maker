(function(global){
  'use strict';
  const ROOT='campaña/combate',INSTANCE='campaña/estado_mundo/instancia_activa';
  const blocked=raw=>['sealed','running'].includes(String(raw?.authority?.current?.phase||'').toLowerCase());
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
      return await ref.transaction(update,undefined,false);
    }finally{if(listener)ref.off('value',listener);}
  }
  async function start({db,uid}){
    const id=`encounter-${global.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    const result=await updateRoot(db,raw=>nextEncounter(raw,{id,uid,time:Date.now()}));
    if(!result.committed&&blocked(result.snapshot.val()))throw Error('Espera a que termine la ronda antes de abrir otro encuentro.');
    await db.ref(INSTANCE).set('combate');
    return result.snapshot.val()?.estado;
  }
  async function end({db,uid,result}){
    const response=await updateRoot(db,raw=>nextEnd(raw,{result,uid,time:Date.now()}));
    if(!response.committed)throw Error('Espera a que termine la ronda antes de finalizar el encuentro.');
    await db.ref(INSTANCE).set('teatro');
    return response.snapshot.val()?.estado;
  }
  async function presentation({db,value}){
    const response=await updateRoot(db,raw=>nextPresentation(raw,value));
    if(!response.committed)throw Error('Cambia la presentación entre rondas, antes de elegir acciones.');
    return value;
  }
  global.LuminousCombatSession=Object.freeze({ROOT,INSTANCE,blocked,live,nextEncounter,nextEnd,nextPresentation,start,end,presentation});
})(typeof window!=='undefined'?window:globalThis);
