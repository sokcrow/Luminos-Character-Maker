(function(global){
  'use strict';
  if(global.LuminousCombatPlanSync073)return;
  const PUBLIC_ROOT='campaña/combate';
  const PRIVATE_ROOT='combat_private/plans';
  const clean=v=>String(v??'').trim();
  const norm=v=>clean(v).toLowerCase().replace(/[\s-]+/g,'_');
  const safe=v=>clean(v).replace(/[.#$\[\]\/]/g,'_');
  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  let chain=Promise.resolve(),lastReadySignature='',lastTargetSignature='';
  function adapter(){return global.LuminousCombatLiveAdapter073||null;}
  function state(){return adapter()?.state||null;}
  function planning(s){const raw=s?.combatState,phase=raw&&typeof raw==='object'?(raw.phase||raw.state||raw.status):raw;return['pre_combat_planning','planning'].includes(norm(phase));}
  function ownCombatant(s){
    if(!s?.playerId)return null;const canonical=`player:${safe(s.playerId)}`;
    if(s.combatants?.[canonical])return[canonical,s.combatants[canonical]];
    return Object.entries(s.combatants||{}).find(([,u])=>clean(u?.canonicalPlayerKey||u?.ownerPlayerId||u?.playerId)===s.playerId&&(!clean(u?.canonicalOwnerUid||u?.ownerUid)||clean(u?.canonicalOwnerUid||u?.ownerUid)===s.uid))||null;
  }
  function kindOf(plan){const t=norm(plan?.type),k=norm(plan?.data?.kind);if(t==='spells'||t==='spell'||k==='spell')return'spell';if(t==='traits'||t==='trait'||k==='trait')return'trait';if(t==='defense'||k==='defense')return'defense';if(t==='items'||t==='item'||k==='item')return'item';if(t==='global'||k==='global')return'global';return'skill';}
  function idOf(plan,kind){const d=plan?.data||{};if(kind==='spell')return clean(d.spellId||d.id||d.key);if(kind==='trait')return clean(d.traitId||d.id||d.key);if(kind==='item')return clean(d.itemId||d.id||d.key||d.name);if(kind==='global')return clean(d.actionKey||d.id||d.key||d.name);return clean(d.skillId||d.id||d.key||d.name);}
  function targetPayloadFor(plan,index,unitId,s){
    if(!plan)return null;const d=plan.data||{},targetId=clean(plan.targetId),additionalTargets=Array.isArray(plan.additionalTargets)?plan.additionalTargets.map(t=>({targetId:clean(t?.targetId),targetSlotIndex:Number.isInteger(Number(t?.targetSlotIndex))?Number(t.targetSlotIndex):0})).filter(t=>t.targetId):[];
    if(!targetId&&!additionalTargets.length)return null;
    const out={schemaVersion:1,engineVersion:'0.7.3-live',unitId,scheduledBy:s.playerId,schedulerUid:s.uid,round:Math.max(1,Math.trunc(finite(s.round,1))),sourceSlotIndex:Number.isInteger(plan.sourceSlotIndex)?plan.sourceSlotIndex:index,targetId:targetId||null,targetSlotIndex:plan.targetSlotIndex==null?null:Math.max(0,Number(plan.targetSlotIndex)||0),updatedAt:global.firebase.database.ServerValue.TIMESTAMP};
    const targetSide=clean(d.targetSide||d.targetRule||plan.targetSide||plan.targetRule);if(targetSide)out.targetSide=targetSide;if(additionalTargets.length)out.additionalTargets=additionalTargets;return out;
  }
  function payloadFor(plan,index,unitId,s){
    const kind=kindOf(plan),id=idOf(plan,kind),d=clone(plan?.data||{});if(!id)throw new Error(`ACTION_ID_MISSING_SLOT_${index}`);
    const out={schemaVersion:3,engineVersion:'0.7.3-live-authority',kind,unitId,scheduledBy:s.playerId,schedulerUid:s.uid,status:'sealed_private',round:Math.max(1,Math.trunc(finite(s.round,1))),sourceSlotIndex:Number.isInteger(plan?.sourceSlotIndex)?plan.sourceSlotIndex:index,targetId:clean(plan?.targetId)||null,targetSlotIndex:Number.isInteger(plan?.targetSlotIndex)?plan.targetSlotIndex:null,actionData:d,updatedAt:global.firebase.database.ServerValue.TIMESTAMP};
    const targetSide=clean(d.targetSide||d.targetRule||plan?.targetSide||plan?.targetRule);if(targetSide)out.targetSide=targetSide;
    const displayName=clean(d.name||d.nombre||d.label);if(displayName)out.actionName=displayName;
    if(Array.isArray(plan?.additionalTargets)&&plan.additionalTargets.length)out.additionalTargets=plan.additionalTargets.map(t=>({targetId:clean(t?.targetId),targetSlotIndex:Number.isInteger(Number(t?.targetSlotIndex))?Number(t.targetSlotIndex):0})).filter(t=>t.targetId);
    if(kind==='spell'){out.spellId=id;out.spellSelectionKey=clean(d.spellSelectionKey||d.selectionKey||id);out.classId=clean(d.classId||d.class||'unknown');out.slotLevel=Math.max(0,Math.min(9,Math.trunc(finite(d.slotLevel??d.level,0))));out.overcast=Boolean(d.overcast);}
    else if(kind==='trait')out.traitId=id;
    else if(kind==='item'){out.itemId=id;const itemType=clean(d.itemType||d.item_type||d.type);if(itemType)out.itemType=itemType;}
    else if(kind==='global')out.actionKey=id;
    else out.skillId=id;
    return out;
  }
  function context(detail={}){
    const s=state();if(!s?.db?.ref||s.role!=='player'||!s.uid||!s.playerId||!planning(s))return null;
    const own=ownCombatant(s);if(!own)throw new Error('PLAYER_COMBATANT_NOT_DEPLOYED');
    const unitId=own[0],plans=Array.isArray(detail.plans)?detail.plans:[],owner=safe(s.playerId),slotCount=Math.max(plans.length,Math.trunc(finite(own[1]?.actionSlots??own[1]?.activeSlots,1)),1),round=Math.max(1,Math.trunc(finite(s.round,1)));
    return{s,own,unitId,plans,owner,slotCount,round};
  }
  function addTargetUpdates(updates,ctx){for(let i=0;i<ctx.slotCount;i+=1)updates[`${PUBLIC_ROOT}/targetIntents/${ctx.owner}/${i}`]=targetPayloadFor(ctx.plans[i],i,ctx.unitId,ctx.s);}
  async function syncReady(detail={}){
    const ctx=context(detail);if(!ctx)return false;const ready=Boolean(detail.ready),sig=JSON.stringify(['ready',ready,ctx.round,ctx.unitId,ctx.plans]);if(sig===lastReadySignature)return true;
    const publicUpdates={};addTargetUpdates(publicUpdates,ctx);
    publicUpdates[`${PUBLIC_ROOT}/readyPlayers/${ctx.owner}`]={ready,round:ctx.round,schedulerUid:ctx.s.uid,unitId:ctx.unitId,plannedSlots:ready?ctx.plans.filter(Boolean).length:0,updatedAt:global.firebase.database.ServerValue.TIMESTAMP};
    const privateUpdates={};for(let i=0;i<ctx.slotCount;i+=1)privateUpdates[`${PRIVATE_ROOT}/${ctx.round}/${ctx.owner}/${i}`]=ready&&ctx.plans[i]?payloadFor(ctx.plans[i],i,ctx.unitId,ctx.s):null;
    await Promise.all([ctx.s.db.ref().update(publicUpdates),ctx.s.db.ref().update(privateUpdates)]);lastReadySignature=sig;return true;
  }
  async function syncLiveTargets(detail={}){
    const ctx=context(detail);if(!ctx)return false;const targets=ctx.plans.map((plan,index)=>targetPayloadFor(plan,index,ctx.unitId,ctx.s)),sig=JSON.stringify(['targets',ctx.round,ctx.unitId,targets]);if(sig===lastTargetSignature)return true;
    const updates={};for(let i=0;i<ctx.slotCount;i+=1)updates[`${PUBLIC_ROOT}/targetIntents/${ctx.owner}/${i}`]=targets[i]||null;
    await ctx.s.db.ref().update(updates);lastTargetSignature=sig;return true;
  }
  function queue(detail,mode='ready'){chain=chain.then(()=>mode==='targets'?syncLiveTargets(detail):syncReady(detail)).catch(error=>{console.error('[Combat073 PlanSync]',error);try{const n=global.document?.getElementById?.('status');if(n)n.textContent=`COMBAT · PLAN SYNC FAILED · ${error?.code||error?.message||error}`;}catch(_){}});return chain;}
  function onReady(event){queue(event?.detail||{},'ready');}
  function onPlan(event){queue(event?.detail||{},'targets');}
  function ensureEconomyReviewFixes(){if(global.LuminousCombatEconomyReviewFixes073){global.LuminousCombatEconomyReviewFixes073.install?.();return global.LuminousCombatEconomyReviewFixes073;}if(!global.document||!global.LuminousCombatEconomyMenu073)return null;const id='combat-v073-economy-review-fixes-script';let script=global.document.getElementById(id);if(script)return script;script=global.document.createElement('script');script.id=id;script.src='js/combat-v073-economy-review-fixes.js';script.async=false;global.document.head?.appendChild(script);return script;}
  function ensureEconomyMenu(){if(global.LuminousCombatEconomyMenu073){ensureEconomyReviewFixes();return global.LuminousCombatEconomyMenu073;}if(!global.document)return null;const id='combat-v073-economy-menu-script';let script=global.document.getElementById(id);if(script){script.addEventListener('load',ensureEconomyReviewFixes,{once:true});return script;}script=global.document.createElement('script');script.id=id;script.src='js/combat-v073-economy-menu.js';script.async=false;script.addEventListener('load',ensureEconomyReviewFixes,{once:true});global.document.head?.appendChild(script);return script;}
  global.addEventListener('luminous:combat073-plan-ready-change',onReady);global.addEventListener('luminous:combat073-plan-change',onPlan);global.addEventListener('luminous:combat073-runtime-ready',ensureEconomyMenu);
  global.addEventListener('beforeunload',()=>{global.removeEventListener('luminous:combat073-plan-ready-change',onReady);global.removeEventListener('luminous:combat073-plan-change',onPlan);global.removeEventListener('luminous:combat073-runtime-ready',ensureEconomyMenu);},{once:true});
  global.LuminousCombatPlanSync073=Object.freeze({version:'0.7.3-plan-sync.8-private',PUBLIC_ROOT,PRIVATE_ROOT,sync:syncReady,syncReady,syncLivePlans:syncLiveTargets,syncLiveTargets,queue,kindOf,payloadFor,targetPayloadFor,ownCombatant,ensureEconomyMenu,ensureEconomyReviewFixes});
  ensureEconomyMenu();
})(window);
