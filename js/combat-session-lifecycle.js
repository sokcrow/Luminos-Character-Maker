(function(global){
  'use strict';
  const ROOT='campaña/combate',INSTANCE='campaña/estado_mundo/instancia_activa';
  const blocked=raw=>['sealed','running'].includes(String(raw?.authority?.current?.phase||'').toLowerCase())||String(raw?.estado?.phase||'').toUpperCase()==='ENDING';
  const live=raw=>raw?.estado?.active!==false&&!['ENDED','SETUP'].includes(String(raw?.estado?.phase||'').toUpperCase());
  function nextEncounter(raw,{id,uid,time}){
    // A finished encounter can still retain its last sealed authority snapshot.
    // That old seal belongs to the ENDED fight and must never prevent a fresh
    // round-one encounter; only an *active* sealed/running encounter is locked.
    const ended=String(raw?.estado?.phase||'').toUpperCase()==='ENDED'||raw?.estado?.active===false;
    if(!ended&&blocked(raw))return;
    // Reopening is idempotent: do not replace an active encounter or its plans.
    if(raw?.estado?.encounterId&&live(raw))return;
    if(raw?.estado&&live(raw)&&Object.keys(raw.combatants||{}).length)
      return {...raw,estado:{...(typeof raw.estado==='object'?raw.estado:{}),encounterId:id,encounterCreatedAt:time,active:true}};
    return {...(raw||{}),combatants:null,reserves:null,defeated:null,departed:null,participants:null,plannedActions:null,readyPlayers:null,independentIntents:null,independentReceipts:null,authority:null,playback:null,
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
  async function updatePath(db,path,update){
    const ref=db.ref(path);let listener;
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
  const updateRoot=(db,update)=>updatePath(db,ROOT,update);
  function canSeal(raw,payload){
    if(!raw||!['PRE_COMBAT_PLANNING','PLANNING'].includes(String(raw.estado?.phase||raw.estado).toUpperCase())||Number(raw.estado?.round||1)!==payload.round)return false;
    if(Object.entries(raw.independentIntents||{}).some(([owner,rows])=>Object.entries(rows||{}).some(([id,row])=>Number(row.round)===Number(payload.round)&&(!raw.independentReceipts?.[owner]?.[id]||raw.independentReceipts[owner][id].pendingInventory))))return false;
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
    // Returning from a mid-combat Theatre interlude must never create a new
    // encounter or transact its running/sealed authority state.
    const current=(await db.ref(`${ROOT}/estado`).once('value')).val();
    if(current?.encounterId&&current.active!==false&&current.phase!=='ENDED'){
      if(current.phase==='ENDING')throw Error('Ya se está finalizando este encuentro.');
      await db.ref(INSTANCE).set('combate');
      return current;
    }
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
  function participantIndex(raw={}){
    const result={...(raw.participants||{})};
    for(const unit of Object.values({...raw.defeated,...raw.departed,...raw.combatants})){
      const id=global.LuminousCombatParticipants?.playerId(unit);
      if(id&&global.LuminousCombatParticipants?.isPlayer(unit))result[id]=true;
    }
    return result;
  }
  async function deploy({db,units}){
    const deployment=global.LuminousCombatDeploymentRuntime;
    if(!deployment)throw Error('Espera a que cargue el encuentro.');
    units=units.map(unit=>global.LuminousNpcBelongings?.initialize(unit)||unit);
    const response=await updateRoot(db,raw=>{
      if(!raw||blocked(raw)||!['PRE_COMBAT_PLANNING','PLANNING','SETUP'].includes(String(raw.estado?.phase||raw.estado).toUpperCase()))return;
      const combatants={...(raw.combatants||{})},reserves={...(raw.reserves||{})};
      let changed=false;
      for(const unit of units){
        const id=deployment.unitId(unit);if(!id||combatants[id]||reserves[id])continue;
        changed=true;
        const side=deployment.sideOf(unit);
        if(deployment.canEnterField(combatants,side,deployment.FIELD_CAP_PER_SIDE,unit))combatants[id]=deployment.markField(unit,{round:raw.estado?.round||1});
        else reserves[id]=deployment.markBackup(unit,{queueOrder:deployment.nextQueueOrder(reserves,side),round:raw.estado?.round||1,reason:'field_full'});
      }
      return changed?{...raw,combatants,reserves,participants:participantIndex({...raw,combatants}),plannedActions:null,readyPlayers:null}:raw;
    });
    if(!response.committed)throw Error('Espera a que termine la ronda antes de cambiar los combatientes.');
    const saved=response.snapshot.val();
    return units.map(unit=>saved.combatants?.[unit.id]||saved.reserves?.[unit.id]);
  }
  function endErrorMessage(error){
    const message=String(error?.message||''),code=String(error?.code||'').toLowerCase();
    if(message.startsWith('Espera a que termine la ronda')||message.startsWith('Ya se está finalizando'))return message;
    if(code.includes('permission'))return 'Firebase rechazó guardar los resultados del encuentro. Publica las reglas actualizadas de combate y botín y vuelve a finalizar.';
    if(message.startsWith('LOOT_'))return 'No se pudo preparar el botín. Puedes volver a finalizar el encuentro sin repetir sus efectos.';
    if(message==='DM_ONLY')return 'Entra con la cuenta del DM para finalizar este encuentro.';
    if(code.includes('network')||code.includes('unavailable'))return 'No se pudo conectar. Revisa tu conexión y vuelve a finalizar el encuentro.';
    return 'No se pudo finalizar el encuentro. Vuelve a intentarlo; los resultados confirmados se conservan.';
  }
  async function claimEnd({db,uid,result,applyEffects}){
    const token=global.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;
    const response=await updateRoot(db,raw=>{
      if(!raw||['sealed','running'].includes(String(raw.authority?.current?.phase||'').toLowerCase()))return;
      if(!['victory','defeat','cancelled'].includes(result))return;
      if(raw.estado?.phase==='ENDING'){
        const ending=raw.estado.ending;
        if(ending?.uid!==uid)return;
        // Failed (and legacy) closing attempts can select another outcome.
        // Encounter-end effects are already committed and must not run twice.
        if(ending.result!==result&&ending.failed!==true&&ending.startedAt)return;
        return {...raw,estado:{...raw.estado,ending:{token:ending.result===result?ending.token:token,uid,result,startedAt:Date.now()}}};
      }
      if(raw.estado?.phase==='ENDED')return raw.estado.endedBy===uid&&raw.estado.result===result?raw:undefined;
      const combatants=JSON.parse(JSON.stringify(raw.combatants||{}));
      applyEffects?.(combatants);
      return {...raw,participants:participantIndex(raw),combatants:JSON.parse(JSON.stringify(combatants)),estado:{...(raw.estado||{}),phase:'ENDING',ending:{token,uid,result,startedAt:Date.now()}},plannedActions:null,readyPlayers:null};
    });
    if(!response.committed)throw Error('Espera a que termine la ronda antes de finalizar el encuentro.');
    return response.snapshot.val();
  }
  async function failEnd({db,uid,token}){
    return updateRoot(db,raw=>{
      if(raw?.estado?.phase!=='ENDING'||raw.estado.ending?.token!==token||raw.estado.ending?.uid!==uid)return;
      return {...raw,estado:{...raw.estado,ending:{...raw.estado.ending,failed:true}}};
    });
  }
  async function commitEnd({db,uid,result,token,xpAward=null}){
    const response=await updateRoot(db,raw=>{
      if(raw?.estado?.phase!=='ENDING'||raw.estado.ending?.token!==token||raw.estado.ending?.uid!==uid||raw.estado.ending?.result!==result)return;
      if(result==='victory'&&(!xpAward||xpAward.encounterId!==raw.estado.encounterId))return;
      return {...raw,estado:{...raw.estado,ending:null,completedRound:raw.estado.completedRound||raw.estado.round||1,round:1,phase:'ENDED',active:false,result,outcome:result,transition:'result',endedBy:uid,endedAt:Date.now(),updatedAt:Date.now(),...(result==='victory'?{xpAward:{encounterId:xpAward.encounterId,totalXp:xpAward.totalXp,participantCount:xpAward.participantCount,xpPerParticipant:xpAward.xpPerParticipant,remainderXp:xpAward.remainderXp,missingCr:xpAward.missingCr||[]}}:{})}};
    });
    if(!response.committed)throw Error('El encuentro cambió antes de confirmar el resultado.');
    return response.snapshot.val().estado;
  }
  async function presentation({db,value}){
    const response=await updateRoot(db,raw=>nextPresentation(raw,value));
    if(!response.committed)throw Error('Cambia la presentación entre rondas, antes de elegir acciones.');
    return value;
  }
  global.LuminousCombatSession=Object.freeze({ROOT,INSTANCE,blocked,live,nextEncounter,nextEnd,nextPresentation,start,end,deploy,participantIndex,claimEnd,commitEnd,failEnd,endErrorMessage,updatePath,updateRoot,canSeal,presentation});
})(typeof window!=='undefined'?window:globalThis);
