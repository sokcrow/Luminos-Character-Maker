(function(global){
  'use strict';
  if(global.LuminousCombatFirebaseActions073)return;
  const VERSION='0.7.3-live.2';
  const clean=v=>String(v??'').trim();
  const safeKey=v=>clean(v).replace(/[.#$\[\]\/]/g,'_');
  let lastSignature='';
  let writeChain=Promise.resolve();

  function adapter(){return global.LuminousCombatLiveAdapter073||null}
  function state(){return adapter()?.state||null}
  function isPlanning(raw){
    const phase=raw&&typeof raw==='object'?(raw.phase||raw.state||raw.status):raw;
    return ['PRE_COMBAT_PLANNING','PLANNING'].includes(clean(phase).toUpperCase());
  }
  function ownedCombatant(){
    const s=state(); if(!s||s.role!=='player'||!s.playerId||!s.uid)return null;
    const entries=Object.entries(s.combatants||{});
    const match=entries.find(([key,u])=>{
      u=u||{};
      const player=clean(u.canonicalPlayerKey||u.ownerPlayerId||u.playerId||u.characterLink?.playerId);
      const uid=clean(u.canonicalOwnerUid||u.ownerUid||u.characterLink?.uid);
      return player===s.playerId&&(!uid||uid===s.uid)&&(u.isPlayer===true||clean(u.actorCategory).toLowerCase()==='player'||key===`player:${safeKey(s.playerId)}`);
    });
    return match?{key:match[0],unit:match[1]||{}}:null;
  }
  function actionKind(plan){
    const raw=clean(plan?.type||plan?.data?.kind||plan?.data?.type).toLowerCase();
    if(raw==='skills')return 'skill'; if(raw==='spells')return 'spell'; if(raw==='items')return 'item';
    if(['skill','spell','trait','defense','item','global'].includes(raw))return raw;
    return raw||'skill';
  }
  function actionPayload(plan,slotIndex,unitId,s){
    if(!plan)return null;
    const data=plan.data||{}, kind=actionKind(plan);
    const payload={
      schemaVersion:2, engineVersion:VERSION, kind,
      unitId, scheduledBy:s.playerId, schedulerUid:s.uid, status:'planned',
      round:Math.max(1,Number(s.round)||1), sourceSlotIndex:Number.isFinite(Number(plan.sourceSlotIndex))?Number(plan.sourceSlotIndex):slotIndex,
      targetId:clean(plan.targetId)||null,
      targetSlotIndex:Number.isFinite(Number(plan.targetSlotIndex))?Number(plan.targetSlotIndex):null,
      actionName:clean(data.name||data.nombre||data.id||kind)
    };
    const id=clean(data.id||data.skillId||data.spellId||data.itemId||data.traitId);
    if(kind==='skill'||kind==='defense')payload.skillId=id;
    else if(kind==='spell'){
      payload.spellId=clean(data.spellId||data.id);
      payload.spellSelectionKey=clean(data.spellSelectionKey||data.selectionKey||data.id);
      payload.classId=clean(data.classId||data.class_id);
      payload.slotLevel=Math.max(0,Math.min(9,Number(data.slotLevel??data.level??0)||0));
      payload.overcast=Boolean(data.overcast);
    }else if(kind==='trait')payload.traitId=id;
    else if(kind==='item')payload.itemId=id;
    else if(kind==='global')payload.actionKey=clean(data.actionKey||data.id||plan.actionKey||'global');
    return payload;
  }
  async function publish(detail){
    const a=adapter(),s=state();
    if(!a||!s?.db?.ref||s.role!=='player'||!s.uid||!s.playerId)return;
    if(!isPlanning(s.combatState))throw new Error('COMBAT_NOT_IN_PLANNING');
    const owned=ownedCombatant(); if(!owned)throw new Error('OWNED_COMBATANT_NOT_FOUND');
    const plans=Array.isArray(detail?.plans)?detail.plans:[];
    const signature=JSON.stringify([s.uid,s.playerId,s.round,Boolean(detail?.ready),plans]);
    if(signature===lastSignature)return;
    const ownerPath=safeKey(s.playerId),unitId=owned.key;
    const updates={};
    plans.forEach((plan,index)=>{updates[`${a.ROOTS.plannedActions}/${ownerPath}/${index}`]=actionPayload(plan,index,unitId,s)});
    const slotCount=Math.max(1,Number(owned.unit.actionSlots||owned.unit.activeSlots)||plans.length||1);
    for(let i=plans.length;i<slotCount;i+=1)updates[`${a.ROOTS.plannedActions}/${ownerPath}/${i}`]=null;
    updates[`campaña/combate/readyPlayers/${ownerPath}`]={ready:Boolean(detail?.ready),round:Math.max(1,Number(s.round)||1),schedulerUid:s.uid,unitId};
    await s.db.ref().update(updates);
    lastSignature=signature;
  }
  function onChange(event){
    writeChain=writeChain.then(()=>publish(event?.detail||{})).catch(error=>{
      console.error('[Combat073 Firebase Actions]',error);
      try{const n=global.document?.getElementById?.('status');if(n)n.textContent=`COMBAT · FIREBASE PLAN ERROR · ${error?.code||error?.message||error}`}catch(_){}
    });
  }
  global.addEventListener('luminous:combat073-plan-ready-change',onChange);
  global.addEventListener('beforeunload',()=>global.removeEventListener('luminous:combat073-plan-ready-change',onChange),{once:true});
  global.LuminousCombatFirebaseActions073=Object.freeze({version:VERSION,publish,ownedCombatant,actionPayload});
})(window);
