(function(global){
  'use strict';
  if(global.LuminousCombatPlanSync073)return;
  const ROOT='campaña/combate';
  const clean=v=>String(v??'').trim();
  const norm=v=>clean(v).toLowerCase().replace(/[\s-]+/g,'_');
  const safe=v=>clean(v).replace(/[.#$\[\]\/]/g,'_');
  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  let chain=Promise.resolve(),lastReadySignature='',lastTargetSignature='';
  let selectedEnchantmentReaction=null;
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
    const out={unitId,scheduledBy:s.playerId,round:Math.max(1,Math.trunc(finite(s.round,1))),sourceSlotIndex:Number.isInteger(plan.sourceSlotIndex)?plan.sourceSlotIndex:index,targetId:targetId||null,targetSlotIndex:plan.targetSlotIndex==null?null:Math.max(0,Number(plan.targetSlotIndex)||0)};
    const targetSide=clean(d.targetSide||d.targetRule||plan.targetSide||plan.targetRule);if(targetSide)out.targetSide=targetSide;if(additionalTargets.length)out.additionalTargets=additionalTargets;return out;
  }
  function spellSelectionKeyFor(id,data,s){
    const selections=s?.players?.[s.playerId]?.characterBuild?.spellSelections||{};
    const requested=clean(data.spellSelectionKey||data.selectionKey);
    if(requested&&selections[requested]===id)return requested;
    // RTDB authorizes the canonical selection's key, including numeric array
    // indices. A spell id is not necessarily that key.
    const match=Object.entries(selections).find(([,value])=>value===id);
    return match?match[0]:(requested||id);
  }
  function payloadFor(plan,index,unitId,s){
    const kind=kindOf(plan),id=idOf(plan,kind),d=clone(plan?.data||{});if(!id)throw new Error(`ACTION_ID_MISSING_SLOT_${index}`);
    const out={schemaVersion:2,engineVersion:'0.7.3-live-authority',kind,unitId,scheduledBy:s.playerId,schedulerUid:s.uid,status:'planned',round:Math.max(1,Math.trunc(finite(s.round,1))),sourceSlotIndex:Number.isInteger(plan?.sourceSlotIndex)?plan.sourceSlotIndex:index,targetId:clean(plan?.targetId)||null,targetSlotIndex:Number.isInteger(plan?.targetSlotIndex)?plan.targetSlotIndex:null,actionData:d,updatedAt:global.firebase.database.ServerValue.TIMESTAMP};
    const targetSide=clean(d.targetSide||d.targetRule||plan?.targetSide||plan?.targetRule);if(targetSide)out.targetSide=targetSide;
    const displayName=clean(d.name||d.nombre||d.label);if(displayName)out.actionName=displayName;
    if(Array.isArray(plan?.additionalTargets)&&plan.additionalTargets.length)out.additionalTargets=plan.additionalTargets.map(t=>({targetId:clean(t?.targetId),targetSlotIndex:Number.isInteger(Number(t?.targetSlotIndex))?Number(t.targetSlotIndex):0})).filter(t=>t.targetId);
    if(kind==='spell'){out.spellId=id;out.spellSelectionKey=spellSelectionKeyFor(id,d,s);out.classId=clean(d.classId||d.class||'unknown');out.slotLevel=Math.max(0,Math.min(9,Math.trunc(finite(d.slotLevel??d.level,0))));out.overcast=Boolean(d.overcast);}
    else if(kind==='trait')out.traitId=id;
    else if(kind==='item'){out.itemId=id;const itemType=clean(d.itemType||d.item_type||d.type);if(itemType)out.itemType=itemType;}
    else if(kind==='global')out.actionKey=id;
    else out.skillId=id;
    return out;
  }
  function context(detail={}){
    const s=state();if(!s?.db?.ref||s.firebaseReady===false||s.role!=='player'||!s.uid||!s.playerId||!planning(s))return null;
    const authority=global.LuminousCombatAuthority073?.state?.current;
    if(Number(authority?.round)===Number(s.round)&&['sealed','running','complete'].includes(norm(authority?.phase)))return null;
    const own=ownCombatant(s);if(!own)throw new Error('PLAYER_COMBATANT_NOT_DEPLOYED');
    const unitId=own[0],plans=Array.isArray(detail.plans)?detail.plans:[],owner=safe(s.playerId),slotCount=Math.max(plans.length,Math.trunc(finite(own[1]?.actionSlots??own[1]?.activeSlots,1)),1),round=Math.max(1,Math.trunc(finite(s.round,1)));
    // Old queued UI events must never be written into a later round.
    if(detail.round!=null&&Number(detail.round)!==round)return null;
    return{s,own,unitId,plans,owner,slotCount,round};
  }
  function targetIndex(ctx){const out={};for(let i=0;i<ctx.slotCount;i+=1){const row=targetPayloadFor(ctx.plans[i],i,ctx.unitId,ctx.s);if(row)out[i]=row;}return out;}
  async function waitForReadyContext(detail){
    // The playback UI may reach TURN N before the RTDB state subscription.
    // Keep an authenticated READY choice until its canonical planning round
    // arrives instead of silently dropping it during the handoff.
    const requested=Number(detail.round);
    for(let attempt=0;attempt<50;attempt+=1){
      const ctx=context(detail);
      if(ctx)return ctx;
      const s=state();
      if(!s||s.role!=='player'||(Number.isFinite(requested)&&Number(s.round)>requested))return null;
      await new Promise(resolve=>global.setTimeout(resolve,100));
    }
    return null;
  }
  async function syncReady(detail={}){
    const ctx=detail.ready===true?await waitForReadyContext(detail):context(detail);if(!ctx)return false;
    const ready=Boolean(detail.ready);
    const reaction=ready && selectedEnchantmentReaction?.round===ctx.round
      ?selectedEnchantmentReaction.itemInstanceId:null;
    const sig=JSON.stringify(['ready',ready,ctx.round,ctx.unitId,ctx.plans,reaction]);
    // A matching local signature is not proof that Firebase still stores READY:
    // remote/queued plan redraws can race with the authenticated confirmation.
    const updates={};
    updates[`${ROOT}/readyPlayers/${ctx.owner}`]={
      ready,round:ctx.round,schedulerUid:ctx.s.uid,unitId:ctx.unitId,
      plannedSlots:ready?ctx.plans.filter(Boolean).length:0,
      ...(global.LuminousCombatPlayback && !global.LuminousCombatPlaybackCompatibility ? {playback:{schemaVersion:1,engineVersion:global.LuminousCombatPlayback.engineVersion}} : {}),
      targetIntents:targetIndex(ctx),
      ...(reaction?{enchantmentReactionItemInstanceId:reaction}:{}),
      updatedAt:global.firebase.database.ServerValue.TIMESTAMP,
    };
    // A character may gain additional Action Slots between rounds. Deleting
    // an empty slot is rejected by RTDB rules, which intentionally allow a
    // player to delete only a previously owned plan. A single invalid null
    // invalidates the entire atomic READY + plannedActions update.
    const saved=(await ctx.s.db.ref(`${ROOT}/plannedActions/${ctx.owner}`).once('value')).val()||{};
    for(let i=0;i<ctx.slotCount;i+=1){
      if(ready&&ctx.plans[i]){
        updates[`${ROOT}/plannedActions/${ctx.owner}/${i}`]=payloadFor(ctx.plans[i],i,ctx.unitId,ctx.s);
      }else if(saved[i]?.schedulerUid===ctx.s.uid&&saved[i]?.scheduledBy===ctx.owner){
        updates[`${ROOT}/plannedActions/${ctx.owner}/${i}`]=null;
      }
    }
    // Drop leftover owned slots beyond the current slot count as well.
    for(const [slot,prior] of Object.entries(saved)){
      if(Number(slot)<ctx.slotCount)continue;
      if(prior?.schedulerUid===ctx.s.uid&&prior?.scheduledBy===ctx.owner)
        updates[`${ROOT}/plannedActions/${ctx.owner}/${slot}`]=null;
    }
    await ctx.s.db.ref().update(updates);lastReadySignature=sig;return true;
  }
  async function syncLiveTargets(detail={}){
    // Late target redraws may carry ready:false captured just before READY.
    // If the player is now locked in, publish that current intention instead
    // of overwriting the RTDB record with a stale NOT READY snapshot.
    const ui=global.LuminousCombat073?.uiState?.();
    if(detail.ready===true||(ui?.ready===true&&Number(ui.round)===Number(detail.round))){
      const latest=global.LuminousCombat073?.plans?.();
      return syncReady({...detail,ready:true,plans:Array.isArray(latest)?clone(latest):detail.plans});
    }
    const ctx=context(detail);if(!ctx)return false;const targets=targetIndex(ctx),sig=JSON.stringify(['targets',ctx.round,ctx.unitId,targets]);if(sig===lastTargetSignature)return true;
    // Target previews are NOT READY transitions. Never replace a committed
    // READY row with ready:false: only the explicit CANCEL READY event may do that.
    // The transaction also handles an uninitialized planning row safely.
    await ctx.s.db.ref(`${ROOT}/readyPlayers/${ctx.owner}`).transaction(current=>{
      if(current?.ready===true&&Number(current.round)===ctx.round)return;
      return {
        ready:false,round:ctx.round,schedulerUid:ctx.s.uid,unitId:ctx.unitId,
        plannedSlots:0,targetIntents:targets,
        updatedAt:global.firebase.database.ServerValue.TIMESTAMP
      };
    },undefined,false);
    lastTargetSignature=sig;return true;
  }
  function queue(detail,mode='ready'){chain=chain.then(()=>mode==='targets'?syncLiveTargets(detail):syncReady(detail)).catch(error=>{console.error('[Combat073 PlanSync]',error);try{const n=global.document?.getElementById?.('status');if(n)n.textContent=`COMBAT · PLAN SYNC FAILED · ${error?.code||error?.message||error}`;}catch(_){}});return chain;}
  function onReactionPrepared(event){
    const s=state(),source=event?.detail?.source||{};
    if(!s||!planning(s))return;
    const id=source.enchantmentReaction===true?clean(source.instanceId):"";
    selectedEnchantmentReaction=id?{
      itemInstanceId:id,round:Math.max(1,Math.trunc(finite(s.round,1))),
    }:null;
    lastReadySignature="";
  }
  function onReady(event){queue(event?.detail||{},'ready');}
  function onPlan(event){queue(event?.detail||{},'targets');}
  function ensureEconomyReviewFixes(){if(global.LuminousCombatEconomyReviewFixes073){global.LuminousCombatEconomyReviewFixes073.install?.();return global.LuminousCombatEconomyReviewFixes073;}if(!global.document||!global.LuminousCombatEconomyMenu073)return null;const id='combat-v073-economy-review-fixes-script';let script=global.document.getElementById(id);if(script)return script;script=global.document.createElement('script');script.id=id;script.src='js/combat-v073-economy-review-fixes.js';script.async=false;global.document.head?.appendChild(script);return script;}
  function ensureEconomyMenu(){if(global.LuminousCombatEconomyMenu073){ensureEconomyReviewFixes();return global.LuminousCombatEconomyMenu073;}if(!global.document)return null;const id='combat-v073-economy-menu-script';let script=global.document.getElementById(id);if(script){script.addEventListener('load',ensureEconomyReviewFixes,{once:true});return script;}script=global.document.createElement('script');script.id=id;script.src='js/combat-v073-economy-menu.js';script.async=false;script.addEventListener('load',ensureEconomyReviewFixes,{once:true});global.document.head?.appendChild(script);return script;}
  function loadBridge(id,src,ready){
    if(ready())return Promise.resolve(true);if(!global.document?.head)return Promise.resolve(false);
    return new Promise(resolve=>{
      let script=global.document.getElementById(id);const done=()=>resolve(Boolean(ready()));
      if(script){if(ready())return done();script.addEventListener('load',done,{once:true});global.setTimeout(done,3000);return;}
      script=global.document.createElement('script');script.id=id;script.src=src;script.async=false;script.addEventListener('load',done,{once:true});script.addEventListener('error',()=>resolve(false),{once:true});global.document.head.appendChild(script);
    });
  }
  async function ensureCoreBridges(){
    await loadBridge('combat-v073-universal-library-script','js/universal-library-runtime.js',()=>Boolean(global.LuminousUniversalLibrary));
    await loadBridge('combat-v073-library-client-script','js/combat-v073-library-client.js',()=>Boolean(global.LuminousCombatLibraryClient073));
    await loadBridge('combat-deployment-runtime-script','js/combat-deployment-runtime.js',()=>Boolean(global.LuminousCombatDeploymentRuntime));
    await loadBridge('combat-v073-deployment-bridge-script','js/combat-v073-deployment-bridge.js',()=>Boolean(global.LuminousCombatDeploymentBridge073));
    await loadBridge('unit-rank-runtime-script','js/unit-rank-runtime.js',()=>Boolean(global.LuminousUnitRankRuntime));
    await loadBridge('combat-v073-authority-script','js/combat-v073-authority.js',()=>Boolean(global.LuminousCombatAuthority073));
    await loadBridge('combat-v073-runtime-hotfix-script','js/combat-v073-runtime-hotfix.js',()=>Boolean(global.LuminousCombatRuntimeHotfix073));
    return Boolean(global.LuminousUniversalLibrary&&global.LuminousCombatLibraryClient073&&global.LuminousCombatDeploymentRuntime&&global.LuminousCombatDeploymentBridge073&&global.LuminousUnitRankRuntime&&global.LuminousCombatAuthority073&&global.LuminousCombatRuntimeHotfix073);
  }
  global.addEventListener('luminous:combat073-reaction-prepared',onReactionPrepared);
  global.addEventListener('luminous:combat073-plan-ready-change',onReady);global.addEventListener('luminous:combat073-plan-change',onPlan);global.addEventListener('luminous:combat073-runtime-ready',ensureEconomyMenu);
  global.addEventListener('beforeunload',()=>{global.removeEventListener('luminous:combat073-reaction-prepared',onReactionPrepared);global.removeEventListener('luminous:combat073-plan-ready-change',onReady);global.removeEventListener('luminous:combat073-plan-change',onPlan);global.removeEventListener('luminous:combat073-runtime-ready',ensureEconomyMenu);},{once:true});
  global.LuminousCombatPlanSync073=Object.freeze({version:'0.7.3-plan-sync.12-deployment-lifecycle',ROOT,sync:syncReady,syncReady,syncLivePlans:syncLiveTargets,syncLiveTargets,queue,kindOf,payloadFor,targetPayloadFor,targetIndex,ownCombatant,ensureEconomyMenu,ensureEconomyReviewFixes,ensureCoreBridges});
  ensureEconomyMenu();global.setTimeout(()=>ensureCoreBridges().catch(error=>console.error('[Combat073 core bridges]',error)),0);
})(window);
