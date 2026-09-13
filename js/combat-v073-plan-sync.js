(function(global){
  'use strict';
  if(global.LuminousCombatPlanSync073)return;
  const ROOT='campaña/combate';
  const clean=v=>String(v??'').trim();
  const norm=v=>clean(v).toLowerCase().replace(/[\s-]+/g,'_');
  const safe=v=>clean(v).replace(/[.#$\[\]\/]/g,'_');
  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  let chain=Promise.resolve(),lastSignature='';
  function adapter(){return global.LuminousCombatLiveAdapter073||null}
  function state(){return adapter()?.state||null}
  function planning(s){const raw=s?.combatState,phase=raw&&typeof raw==='object'?(raw.phase||raw.state||raw.status):raw;return ['pre_combat_planning','planning'].includes(norm(phase))}
  function ownCombatant(s){
    if(!s?.playerId)return null;
    const canonical=`player:${safe(s.playerId)}`;
    if(s.combatants?.[canonical])return[canonical,s.combatants[canonical]];
    return Object.entries(s.combatants||{}).find(([,u])=>clean(u?.canonicalPlayerKey||u?.ownerPlayerId||u?.playerId)===s.playerId&&(!clean(u?.canonicalOwnerUid||u?.ownerUid)||clean(u?.canonicalOwnerUid||u?.ownerUid)===s.uid))||null;
  }
  function kindOf(plan){const t=norm(plan?.type),k=norm(plan?.data?.kind);if(t==='spells'||k==='spell')return'spell';if(t==='traits'||k==='trait')return'trait';if(t==='defense'||k==='defense')return'defense';if(t==='items'||k==='item')return'item';if(t==='global'||k==='global')return'global';return'skill'}
  function idOf(plan,kind){const d=plan?.data||{};if(kind==='spell')return clean(d.spellId||d.id||d.key);if(kind==='trait')return clean(d.traitId||d.id||d.key);if(kind==='item')return clean(d.itemId||d.id||d.key||d.name);if(kind==='global')return clean(d.actionKey||d.id||d.key||d.name);return clean(d.skillId||d.id||d.key||d.name)}
  function payloadFor(plan,index,unitId,s){
    const kind=kindOf(plan),id=idOf(plan,kind),d=plan?.data||{};
    if(!id)throw new Error(`ACTION_ID_MISSING_SLOT_${index}`);
    const out={schemaVersion:2,engineVersion:'0.7.3-live',kind,unitId,scheduledBy:s.playerId,schedulerUid:s.uid,status:'planned',round:Math.max(1,Math.trunc(finite(s.round,1))),sourceSlotIndex:Number.isInteger(plan?.sourceSlotIndex)?plan.sourceSlotIndex:index,targetId:clean(plan?.targetId)||null,targetSlotIndex:Number.isInteger(plan?.targetSlotIndex)?plan.targetSlotIndex:null,updatedAt:global.firebase.database.ServerValue.TIMESTAMP};
    const targetSide=clean(d.targetSide||d.targetRule||plan?.targetSide||plan?.targetRule);if(targetSide)out.targetSide=targetSide;
    const displayName=clean(d.name||d.nombre||d.label);if(displayName)out.actionName=displayName;
    if(Array.isArray(plan?.additionalTargets)&&plan.additionalTargets.length)out.additionalTargets=plan.additionalTargets.map(t=>({targetId:clean(t?.targetId),targetSlotIndex:Number.isInteger(t?.targetSlotIndex)?t.targetSlotIndex:0})).filter(t=>t.targetId);
    if(kind==='spell'){out.spellId=id;out.spellSelectionKey=clean(d.spellSelectionKey||d.selectionKey||id);out.classId=clean(d.classId||d.class||'unknown');out.slotLevel=Math.max(0,Math.min(9,Math.trunc(finite(d.slotLevel??d.level,0))));out.overcast=Boolean(d.overcast)}
    else if(kind==='trait')out.traitId=id;
    else if(kind==='item'){out.itemId=id;const itemType=clean(d.itemType||d.item_type||d.type);if(itemType)out.itemType=itemType}
    else if(kind==='global')out.actionKey=id;
    else out.skillId=id;
    return out;
  }
  function context(detail={}){
    const s=state();
    if(!s?.db?.ref||s.role!=='player'||!s.uid||!s.playerId)return null;
    if(!planning(s))return null;
    const own=ownCombatant(s);if(!own)throw new Error('PLAYER_COMBATANT_NOT_DEPLOYED');
    const unitId=own[0],plans=Array.isArray(detail.plans)?detail.plans:[],owner=safe(s.playerId),slotCount=Math.max(plans.length,Math.trunc(finite(own[1]?.actionSlots??own[1]?.activeSlots,1)),1);
    return{s,own,unitId,plans,owner,slotCount};
  }
  async function syncReady(detail={}){
    const ctx=context(detail);if(!ctx)return false;
    const{s,unitId,plans,owner,slotCount}=ctx,ready=Boolean(detail.ready),sig=JSON.stringify(['ready',ready,s.round,unitId,plans]);if(sig===lastSignature)return true;
    const updates={};
    for(let i=0;i<slotCount;i+=1)updates[`${ROOT}/plannedActions/${owner}/${i}`]=plans[i]?payloadFor(plans[i],i,unitId,s):null;
    updates[`${ROOT}/readyPlayers/${owner}`]={ready,round:Math.max(1,Math.trunc(finite(s.round,1))),schedulerUid:s.uid,unitId,plannedSlots:ready?plans.filter(Boolean).length:0,updatedAt:global.firebase.database.ServerValue.TIMESTAMP};
    await s.db.ref().update(updates);lastSignature=sig;return true;
  }
  async function syncLivePlans(detail={}){
    const ctx=context(detail);if(!ctx)return false;
    const{s,unitId,plans,owner,slotCount}=ctx;
    if(!plans.some(Boolean))return false;
    const sig=JSON.stringify(['live',s.round,unitId,plans]);if(sig===lastSignature)return true;
    const updates={};
    for(let i=0;i<slotCount;i+=1)updates[`${ROOT}/plannedActions/${owner}/${i}`]=plans[i]?payloadFor(plans[i],i,unitId,s):null;
    await s.db.ref().update(updates);lastSignature=sig;return true;
  }
  function queue(detail,mode='ready'){chain=chain.then(()=>mode==='live'?syncLivePlans(detail):syncReady(detail)).catch(error=>{console.error('[Combat073 PlanSync]',error);try{const n=global.document?.getElementById?.('status');if(n)n.textContent=`COMBAT · PLAN SYNC FAILED · ${error?.code||error?.message||error}`}catch(_){}});return chain}
  function onReady(event){queue(event?.detail||{},'ready')}
  function onPlan(event){queue(event?.detail||{},'live')}
  global.addEventListener('luminous:combat073-plan-ready-change',onReady);
  global.addEventListener('luminous:combat073-plan-change',onPlan);
  global.addEventListener('beforeunload',()=>{global.removeEventListener('luminous:combat073-plan-ready-change',onReady);global.removeEventListener('luminous:combat073-plan-change',onPlan)},{once:true});
  global.LuminousCombatPlanSync073=Object.freeze({version:'0.7.3-plan-sync.4',sync:syncReady,syncReady,syncLivePlans,queue,kindOf,payloadFor,ownCombatant});
})(window);
