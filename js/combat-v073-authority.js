(function(global){
  'use strict';
  if(global.LuminousCombatAuthority073)return;

  const ROOT=Object.freeze({
    current:'campaña/combate/authority/current',
    state:'campaña/combate/estado',
    combatants:'campaña/combate/combatants',
    ready:'campaña/combate/readyPlayers',
    plans:'campaña/combate/plannedActions'
  });
  const nativeRandom=global.Math.random.bind(global.Math);
  const clean=v=>String(v??'').trim();
  const norm=v=>clean(v).toLowerCase().replace(/[\s-]+/g,'_');
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const state={
    started:false,current:{},seed:0,cursor:0,rngState:0,
    readyRows:{},readyLoaded:false,listenCleanup:[],lastStartError:'',planningRepair:null,
    authorityRef:null,authorityHandler:null,readyRef:null,readyHandler:null,plansRef:null,plansHandler:null,retryTimer:null,autoStartTimer:null,
    presentationTimer:null,writeFailure:null,lastCheckpointSeq:0,writeChain:Promise.resolve(),executionChain:Promise.resolve(),hooks:new Map(),localActionSeq:0,localDigests:new Map(),pendingRemoteCheckpoints:new Map(),inFlightActions:0,
    originalStartRound:null,originalBuildQueue:null,originalCoinEngine:null,runningLocal:false,preparingRound:false,remoteStart:false,autoStartedRound:0,pendingFinalSnapshot:null,resumeRuntime:null,lastExecutionJson:null,executingGeneration:null
  };

  function adapter(){return global.LuminousCombatLiveAdapter073||null;}
  function adapterState(){return adapter()?.state||null;}
  function runtime(){return global.LuminousCombat073||null;}
  function listen(ref,handler,label){
    let closed=false,retried=false,timer=null;
    const failed=error=>{
      const user=adapterState()?.user;if(closed)return;
      if(error?.code!=='PERMISSION_DENIED'||retried||!user){console.error(label,error);return;}
      retried=true;Promise.resolve().then(()=>user.getIdToken?.(true)).then(()=>{
        if(closed||adapterState()?.user!==user)return;
        timer=global.setTimeout(()=>{timer=null;if(!closed)ref.on('value',handler,failed);},250);
      }).catch(error=>{if(!closed)console.error(label,error);});
    };
    ref.on('value',handler,failed);
    state.listenCleanup.push(()=>{closed=true;if(timer)global.clearTimeout(timer);ref.off('value',handler);});
  }
  function playback(){return global.LuminousCombatPlaybackSync||null;}
  function batchMode(){return playback()?.enabled(state.current)===true;}
  function isDm(){return (adapterState()?.role==='dm'||adapterState()?.isAuthority===true);}
  function isPlayer(){return adapterState()?.role==='player';}
  function serverTime(){return global.firebase?.database?.ServerValue?.TIMESTAMP||Date.now();}
  function stateUpdates(value){return Object.fromEntries(Object.entries(value).map(([key,value])=>[`${ROOT.state}/${key}`,value]));}
  function setStatus(text){try{const node=global.document?.getElementById?.('status');if(node)node.textContent=text;}catch(_){}}
  function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object'){const out={};Object.keys(value).sort().forEach(key=>{if(value[key]!==undefined)out[key]=stable(value[key]);});return out;}return value;}
  function digest(value){const text=JSON.stringify(stable(value));let h=2166136261;for(let i=0;i<text.length;i+=1){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
  function makeSeed(round){const array=new Uint32Array(1);try{global.crypto?.getRandomValues?.(array);}catch(_){}return(array[0]||((Date.now()^Math.floor(nativeRandom()*0xffffffff))>>>0)^((Number(round)||1)*2654435761))>>>0;}
  function randomRaw(){state.rngState=(state.rngState+0x6D2B79F5)>>>0;let t=state.rngState;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);const value=((t^(t>>>14))>>>0)/4294967296;state.cursor+=1;return value;}
  function resetRandom(seed,cursor=0){state.seed=(Number(seed)||1)>>>0;state.rngState=state.seed;state.cursor=0;for(let i=0;i<Math.max(0,Math.trunc(Number(cursor)||0));i+=1)randomRaw();return state.seed;}
  function random(){return state.seed&&['sealed','running'].includes(norm(state.current?.phase))?randomRaw():nativeRandom();}
  function withAuthorityRandom(callback){if(!state.seed||!['sealed','running'].includes(norm(state.current?.phase)))return callback();const previous=global.Math.random;global.Math.random=random;try{return callback();}finally{global.Math.random=previous;}}
  function withPrivateRandom(callback){const previous=global.Math.random;global.Math.random=nativeRandom;try{return callback();}finally{global.Math.random=previous;}}

  function canonicalPlayerId(unit={}){return clean(unit.canonicalPlayerKey||unit.ownerPlayerId||unit.playerId||unit.characterLink?.playerId);}
  function classEntries(unit={}){
    const build=unit?.characterBuild&&typeof unit.characterBuild==='object'?unit.characterBuild:{};
    let raw=Array.isArray(unit.classes)?unit.classes:(Array.isArray(build.classes)?build.classes:[]);
    if(!raw.length){const levels=unit.classLevels||build.classLevels||{};raw=Object.entries(levels||{}).map(([classId,value])=>typeof value==='object'?{classId,...value}:{classId,levels:value});}
    return raw.map(entry=>({classId:norm(entry?.classId||entry?.id||entry?.name),levels:Math.max(0,Math.trunc(finite(entry?.levels??entry?.level??entry?.classLevel,0)))})).filter(entry=>entry.classId&&entry.levels>0);
  }
  function isSpellcaster(unit={}){
    const spellcasting=global.LuminousSpellcastingRuntime;if(!spellcasting?.getClassSpellcastingProfile)return false;
    return classEntries(unit).some(entry=>{
      let profile=null;try{profile=spellcasting.getClassSpellcastingProfile(entry.classId);}catch(_){}
      if(!profile)return false;
      const start=Math.max(1,Math.trunc(finite(profile.spellcastingStartLimbusLevel,1)));
      return entry.levels>=start;
    });
  }
  function validateSpellPlans(plans={}){
    const units=runtime()?.combatants?.()||{};
    for(const ownerRows of Object.values(plans||{})){
      for(const raw of Object.values(ownerRows||{})){
        if(!raw)continue;
        const kind=norm(raw.kind||raw.actionData?.kind||raw.type);
        if(kind!=='spell'&&kind!=='spells')continue;
        const unit=raw.unitId&&units[raw.unitId]?units[raw.unitId]:Object.values(units).find(row=>canonicalPlayerId(row)===clean(raw.scheduledBy));
        if(!unit)throw new Error('SPELL_PLAN_REJECTED:SPELL_ACTOR_NOT_FOUND');
        if(unit.isPlayer===true){
          if(!isSpellcaster(unit))throw new Error(`SPELL_PLAN_REJECTED_NON_CASTER:${canonicalPlayerId(unit)||unit.id||raw.unitId||'player'}`);
          const spellId=clean(raw.spellId||raw.actionData?.spellId||raw.actionData?.id||raw.data?.spellId||raw.data?.id);
          const resolver=global.LuminousCombatSpellLoadout074;
          if(!resolver?.resolveSpellForCombatant)throw new Error('SPELL_RUNTIME_NOT_READY');
          const result=resolver.resolveSpellForCombatant(unit,spellId,{classId:raw.classId||raw.actionData?.classId||null});
          if(!result.ok)throw new Error(`SPELL_PLAN_REJECTED:${result.reason||'SPELL_UNAVAILABLE'}`);
          // Only targeting and casting choices come from the Player. Definitions
          // used by the sealed executor must come from the DM's own catalog.
          const definition=clone(result.spell);
          raw.spellId=definition.spellId||definition.id||spellId;
          raw.classId=result.classId;
          raw.actionName=definition.name;
          raw.actionData={...definition,id:raw.spellId,spellId:raw.spellId,
            kind:'spell',sourceType:'spell',classId:result.classId};
          delete raw.data;

        }
      }
    }
    return true;
  }
  function queueEntryKind(entry={}){
    const plan=entry?.plan||{},bridge=global.LuminousCombatPlanSync073;
    return norm(bridge?.kindOf?.(plan)||plan?.type||plan?.data?.kind||entry?.kind);
  }
  function isItemQueueEntry(entry={}){const kind=queueEntryKind(entry);return kind==='item'||kind==='items'||kind==='item_use';}
  async function persistPlayerInventory(unit={},combatantId=''){
    if(!isDm())return{saved:false,reason:'dm_authority_required'};
    const playerId=canonicalPlayerId(unit),s=adapterState(),persistence=global.LuminousItemPersistenceRuntime;
    if(!playerId)return{saved:false,reason:'not_player_combatant'};
    if(!s?.db?.ref)return{saved:false,reason:'combat_db_unavailable'};
    if(!persistence?.saveInventoryState||!persistence?.serializeInventoryState)return{saved:false,reason:'item_persistence_runtime_unavailable'};
    const saved=await persistence.saveInventoryState(s.db,playerId,unit);
    if(!saved?.saved)return saved||{saved:false,reason:'inventory_save_failed'};
    const stateSnapshot=persistence.serializeInventoryState(unit);
    const key=clean(combatantId||unit.id||unit.combatId);
    if(key){
      const updates={};
      updates[`${ROOT.combatants}/${key}/inventario_activo`]=clone(stateSnapshot.inventario_activo||{});
      updates[`${ROOT.combatants}/${key}/inventario_stash`]=clone(stateSnapshot.inventario_stash||{});
      updates[`${ROOT.combatants}/${key}/itemInventorySchemaVersion`]=stateSnapshot.schemaVersion||saved.state?.itemInventorySchemaVersion||3;
      updates[`${ROOT.combatants}/${key}/itemEquipmentRefs`]=clone(stateSnapshot.equipmentRefs||{});
      updates[`${ROOT.combatants}/${key}/attunedItemInstanceIds`]=clone(stateSnapshot.attunedItemInstanceIds||[]);
      await s.db.ref().update(updates);
    }
    return{...saved,combatantId:key||null};
  }
  function compactUnit(unit={}){
    const independentState=unit.combatIndependentActionState?clone(unit.combatIndependentActionState):null;
    if(independentState?.runtimeFields)for(const key of Object.keys(independentState.runtimeFields))independentState.runtimeFields[key]=clone(unit[key]??null);
    const traitState=unit.combatTraitState?clone(unit.combatTraitState):null;
    if(traitState)traitState.history=[];
    // Trait engine history timestamps are local wall-clock data, not combat state.
    // Excluding them prevents DM/Player checkpoint digest divergence.
    if(independentState?.traitState)independentState.traitState.history=[];
    return{
      ...(independentState?{combatIndependentActionState:independentState}:{}),
      ...(traitState?{combatTraitState:traitState}:{}),
      ...Object.fromEntries(['inventario_activo','inventario_stash','itemEquipmentRefs','attunedItemInstanceIds','itemInventorySchemaVersion',
        'compendiumProgress','compendiumLootSnapshot','universalActionPhaseLedger','mastermindAssistGuardState','universalHelpBuffs','observationKnown','observationLastCheck','analyseUsedRound','findUsedRound','detectedInvisibleIds','invisibleAwarenessRound','xpEligible','backupRecoveryRound','combatEventState','statusProtections','superiorityCount','spellcastingState','classResources','traitUses','resources','wakePendingRound','retreatVacancy','escapeVacancy','defeated','dead',
        'deployedRound','deploymentState','replacementClaimed','equipmentEffectTurnLedger',
        'lifeState','isDowned','isDead','isRetreated','isStable','deathSaves','deathSavePower','deathSaveThreshold','deathSaveCheck','deathSaveRound','retreat','retreatSnapshot'].filter(key=>unit[key]!==undefined).map(key=>[key,clone(unit[key])])),
      ...(unit.combatDeck?{combatDeck:global.LuminousCombatSlotDeck073?.compact(unit.combatDeck)||clone(unit.combatDeck),
        combatDeckModes:global.LuminousCombatSlotDeck073?.compactModeDecks?.(unit.combatDeckModes)||clone(unit.combatDeckModes||{})}:{}),
      hp:Math.max(0,finite(unit.hp,0)),maxHp:Math.max(1,finite(unit.maxHp,1)),sp:finite(unit.sp,0),
      speed:finite(unit.speed,0),speedBaseRoll:finite(unit.speedBaseRoll,0),speedTie:finite(unit.speedTie,0),speedRollTurn:Math.max(0,Math.trunc(finite(unit.speedRollTurn,0))),
      actionSlots:Math.max(1,Math.trunc(finite(unit.actionSlots??unit.activeSlots,1))),activeSlots:Math.max(1,Math.trunc(finite(unit.activeSlots??unit.actionSlots,1))),
      statusEffects:clone(unit.statusEffects||{}),pendingStatusEffects:clone(unit.pendingStatusEffects||[]),itemRuntimeEffects:clone(unit.itemRuntimeEffects||[]),
      battleActive:unit.battleActive!==false,isBackup:unit.isBackup===true,incapacitated:unit.incapacitated===true,
      staggerStage:Math.max(0,Math.trunc(finite(unit.staggerStage,0))),staggerActivatedRound:Math.max(0,Math.trunc(finite(unit.staggerActivatedRound,0))),staggerUntilRound:Math.max(0,Math.trunc(finite(unit.staggerUntilRound,0))),
      triggeredStaggerThresholds:clone(unit.triggeredStaggerThresholds||[]),shieldPools:clone(unit.shieldPools||{}),concentration:clone(unit.concentration||null),
      x:finite(unit.x,0),y:finite(unit.y,0),retreatPendingRound:Math.max(0,Math.trunc(finite(unit.retreatPendingRound,0))),escapePendingRound:Math.max(0,Math.trunc(finite(unit.escapePendingRound,0))),
      proneSpeedRound:Math.max(0,Math.trunc(finite(unit.proneSpeedRound,0))),confusionTurnMode:unit.confusionTurnMode==null?null:clone(unit.confusionTurnMode),
      escaped:unit.escaped===true,damageTakenThisRound:Math.max(0,finite(unit.damageTakenThisRound,0)),
      quickActionRemaining:finite(unit.quickActionRemaining,unit.quickActionsRemaining??1),reactionRemaining:finite(unit.reactionRemaining,unit.reactionsRemaining??1)
    };
  }
  function snapshotRuntime(){const out={};Object.entries(runtime()?.combatants?.()||{}).forEach(([id,unit])=>{out[id]=compactUnit(unit||{});});return out;}
  function checkpointDigest(snapshot=snapshotRuntime(),round=state.current?.round||adapterState()?.round||0){return digest({round:Number(round)||0,cursor:state.cursor,combatants:snapshot});}

  function serializeRuntimePlan(plan={},unitId,slotIndex=0){
    const bridge=global.LuminousCombatPlanSync073,kind=bridge?.kindOf?.(plan)||'skill',data=clone(plan.data||{});let id='';
    if(kind==='spell')id=clean(data.spellId||data.id||data.key);else if(kind==='trait')id=clean(data.traitId||data.id||data.key);else if(kind==='item')id=clean(data.itemId||data.id||data.key||data.name);else if(kind==='global')id=clean(data.actionKey||data.id||data.key||data.name);else id=clean(data.skillId||data.id||data.key||data.name);
    const unit=runtime()?.combatants?.()?.[unitId]||{};
    const out={schemaVersion:2,engineVersion:'0.7.3-live-authority',kind,unitId,scheduledBy:canonicalPlayerId(unit)||unitId,schedulerUid:adapterState()?.uid||'',status:'planned',round:Number(adapterState()?.round)||1,sourceSlotIndex:Number.isInteger(plan.sourceSlotIndex)?plan.sourceSlotIndex:slotIndex,targetId:clean(plan.targetId)||null,targetSlotIndex:plan.targetSlotIndex==null?null:Math.max(0,Number(plan.targetSlotIndex)||0),actionData:data};
    const targetSide=clean(data.targetSide||data.targetRule||plan.targetSide||plan.targetRule);if(targetSide)out.targetSide=targetSide;if(Array.isArray(plan.additionalTargets)&&plan.additionalTargets.length)out.additionalTargets=clone(plan.additionalTargets);out.actionName=clean(data.name||data.nombre||data.label||id);
    for(const key of ['drawId','clashChoice','clashOrder','clashConfirmed'])if(plan[key]!=null)out[key]=clone(plan[key]);out.planType=plan.type||'auto';
    if(kind==='spell'){out.spellId=id;out.spellSelectionKey=clean(data.spellSelectionKey||data.selectionKey||id);out.classId=clean(data.classId||data.class)||null;out.slotLevel=Math.max(0,Math.min(9,Math.trunc(finite(data.slotLevel??data.level,0))));out.overcast=Boolean(data.overcast);}else if(kind==='trait')out.traitId=id;else if(kind==='item'){out.itemId=id;const itemType=clean(data.itemType||data.item_type||data.type);if(itemType)out.itemType=itemType;}else if(kind==='global')out.actionKey=id;else out.skillId=id;return out;
  }
  function collectAiPlans(){const out={};Object.entries(runtime()?.combatants?.()||{}).forEach(([id,unit])=>{if(unit?.controlled!=='ai'||!Array.isArray(unit.autoPlans))return;const rows={};unit.autoPlans.forEach((plan,index)=>{if(plan)rows[index]=serializeRuntimePlan(plan,id,index);});if(Object.keys(rows).length)out[id]=rows;});return out;}
  function activePlayerIds(){return global.LuminousCombatParticipants?.playerIds(adapterState()?.combatants||{})||[];}
  async function read(path){const s=adapterState();if(!s?.db?.ref)throw new Error('COMBAT_DB_UNAVAILABLE');const snap=await s.db.ref(path).once('value');return snap.val();}
  async function preparePlanningState(){
    const s=adapterState();if(!isDm()||!s?.db?.ref)return false;
    if(!['combat_active','planning'].includes(norm(s.combatState)))return false;
    if(state.planningRepair)return state.planningRepair;
    // The historical dashboard wrote COMBAT_ACTIVE without sealing a round.
    // Recover that state atomically, retaining the encounter, round and choices.
    state.planningRepair=(async()=>{
      const ref=s.db.ref('campaña/combate');let hold;
      try{
        await new Promise((resolve,reject)=>{hold=()=>resolve();ref.on('value',hold,reject);});
        const result=await ref.transaction(combat=>{
          if(!combat||['sealed','running'].includes(norm(combat.authority?.current?.phase)))return;
          const raw=combat.estado,phase=norm(raw?.phase||raw?.state||raw?.status||raw);
          if(!['combat_active','planning'].includes(phase))return;
          return {...combat,estado:{...(raw&&typeof raw==='object'?raw:{}),phase:'PRE_COMBAT_PLANNING',active:true,round:Math.max(1,Number(raw?.round||raw?.turn)||Number(s.round)||1)}};
        },undefined,false);
        return result.committed;
      }finally{if(hold)ref.off('value',hold);}
    })().finally(()=>{state.planningRepair=null;});
    return state.planningRepair;
  }
  function readyComplete(ready,plans,round,members=global.LuminousCombatParticipants?.players(adapterState()?.combatants||{})||[]){
    const missing=[];
    for(const member of members){
      const id=member.playerId,row=ready?.[id],rows=plans?.[id]||{};
      const planned=Math.max(0,Math.trunc(Number(row?.plannedSlots)||0));
      if(row?.ready!==true||Number(row.round)!==Number(round))missing.push(`${id}:READY`);
      else if(clean(row.unitId)!==clean(member.unitId))missing.push(`${id}:UNIT`);
      else if(Object.values(rows).filter(Boolean).length<planned)missing.push(`${id}:PLAN`);
    }
    return{complete:missing.length===0,missing};
  }
  async function sealRound(){
    const s=adapterState();if(!s?.db?.ref||!isDm())throw new Error('DM_AUTHORITY_REQUIRED');const round=Math.max(1,Math.trunc(Number(s.round)||1));
    // Read READY, plans and deployed identities from one RTDB snapshot. Separate
    // reads could mix different revisions and reject a legitimate 6/6 READY.
    const combat=await read('campaña/combate');
    if(Number(combat?.estado?.round||1)!==round)throw new Error('El turno está sincronizándose. Vuelve a iniciar cuando aparezca el turno actual.');
    const ready=combat?.readyPlayers||{},rawPlans=combat?.plannedActions||{};
    const members=global.LuminousCombatParticipants?.players(combat?.combatants||{})||[];
    const memberIds=members.map(member=>member.playerId);
    const plans=Object.fromEntries(members.map(member=>[member.playerId,Object.fromEntries(Object.entries(rawPlans?.[member.playerId]||{}).filter(([,plan])=>plan?.unitId===member.unitId&&Number(plan.round)===round))]));
    // Flush authenticated Player Quick/Free intents before sealing the round.
    // Their DM-authoritative mutations belong to the same Unit snapshot as AI.
    const independent=global.LuminousCombatRemoteIntents073;
    if(independent?.scheduleIndependentIntents){
      const pending=await read('campaña/combate/independentIntents');
      if(!await independent.scheduleIndependentIntents(pending||{}))throw new Error('No se pudo confirmar la habilidad pendiente. Intenta iniciar de nuevo.');
    }
    const planningWitness=clone(plans);
    const check=readyComplete(ready,plans,round,members);
    if(!check.complete){
      const unready=members.filter(member=>check.missing.includes(`${member.playerId}:READY`)).map(member=>member.name);
      const invalid=members.filter(member=>check.missing.includes(`${member.playerId}:UNIT`)).map(member=>member.name);
      const unplanned=members.filter(member=>check.missing.includes(`${member.playerId}:PLAN`)).map(member=>member.name);
      throw new Error(unready.length?`Falta confirmar READY: ${unready.join(', ')}.`:invalid.length?`Reconfirma READY para actualizar la unidad de: ${invalid.join(', ')}.`:`Faltan acciones guardadas de: ${unplanned.join(', ')}. Reconfirma READY.`);
    }validateSpellPlans(plans||{});global.LuminousCombatSlotDeck073?.validatePlans(plans||{});
    // Ready-player reactions are authenticated planning choices; DM verifies
    // Item equipment and effects again before arming their combat runtime.
    const defensiveReactions=Object.fromEntries(memberIds
      .map(playerId=>[playerId,clean(ready?.[playerId]?.enchantmentReactionItemInstanceId)])
      .filter(([,id])=>id));
    const aiPlans=collectAiPlans();
    global.LuminousCombatSlotDeck073?.validatePlans(aiPlans);
    const seed=makeSeed(round);let payload={schemaVersion:1,engineVersion:'0.7.3-authority.9-step-rng',round,phase:'sealed',seed,authorityUid:s.uid,planningWitness,plans:clone(plans||{}),aiPlans,defensiveReactions,createdAt:serverTime(),checkpoint:null};
    if(global.LuminousCompendiumProgressLive)payload.compendiumDamage=await global.LuminousCompendiumProgressLive.damageSnapshot(s.db,runtime()?.combatants?.()||{});
    if(playback()?.negotiate(ready,memberIds))payload=await playback().seal(payload,{timeline:playback().canSchedule?.(ready,memberIds)===true});
    if(!payload.playback){
      const sealed=await global.LuminousCombatSession.updateRoot(s.db,raw=>{
        if(!global.LuminousCombatSession.canSeal(raw,payload)||['sealed','running'].includes(raw.authority?.current?.phase))return;
        return {...raw,authority:{...(raw.authority||{}),current:payload},estado:{...(typeof raw.estado==='object'?raw.estado:{}),eventAuthority:'combat-event-runtime-v1',phase:'COMBAT_SEALED',active:true,round,authorityUid:s.uid,seed,updatedAt:serverTime()}};
      });
      if(!sealed.committed)throw new Error('El encuentro ya está resolviendo o finalizando.');
    }
    state.current={...payload,createdAt:Date.now()};resetRandom(seed,0);applyAuthority(payload);return payload;
  }

  function planRowsToArray(rows,unit){const converter=global.LuminousCombatRemoteIntents073?.runtimePlan;if(!converter)return[];const plans=[];Object.entries(rows||{}).forEach(([slot,raw])=>{const index=Math.max(0,Number(raw?.sourceSlotIndex??slot)||0);plans[index]=converter(raw,index,unit);});return plans;}
  function replaceLocalPlans(plans){const list=runtime()?.plans?.();if(!Array.isArray(list))return false;list.splice(0,list.length,...plans);global.renderAllPlannedSlots?.();return true;}
  function applyAuthority(data=state.current){
    const s=adapterState(),combat=runtime();if(!combat?.combatants||!s||Number(data?.round)!==Number(s.round))return false;const units=combat.combatants();if(!Object.keys(units).length)return false;
    for(const [id,ledger]of Object.entries(data.universalActionLedgers||{}))if(units[id]&&Number(units[id].universalActionPhaseLedger?.round||0)<Number(data.round))units[id].universalActionPhaseLedger=clone(ledger);
    if(s.role==='player'&&s.playerId&&data.plans?.[s.playerId]){const own=Object.values(units).find(unit=>unit?.controlled==='player'||canonicalPlayerId(unit)===s.playerId);replaceLocalPlans(planRowsToArray(data.plans[s.playerId],own));}else if(s.role==='dm')replaceLocalPlans([]);
    for(const ownerRows of Object.values(data.plans||{})){const sample=Object.values(ownerRows||{})[0];if(!sample)continue;const unit=sample.unitId&&units[sample.unitId]?units[sample.unitId]:Object.values(units).find(row=>canonicalPlayerId(row)===clean(sample.scheduledBy));if(unit?.controlled==='remote')unit.autoPlans=planRowsToArray(ownerRows,unit);}
    for(const [unitId,rows] of Object.entries(data.aiPlans||{})){const unit=units[unitId];if(unit?.controlled==='ai')unit.autoPlans=planRowsToArray(rows,unit);}
    if(!isDm()&&data.encounterStart&&data.initialStateJson&&!data.checkpoint){
      const initial=JSON.parse(data.initialStateJson);
      if(Object.entries(initial).some(([id,row])=>row.combatEventState?.encounterStarted&&units[id]?.combatEventState?.encounterStarted!==row.combatEventState.encounterStarted))applySnapshot(initial);
    }
    if(isDm()){
      const bridge=global.LuminousItemEnchantmentCombatRuntime;
      for(const [owner,id] of Object.entries(data.defensiveReactions||{})){
        const unit=Object.values(units).find(row=>canonicalPlayerId(row)===owner && row.battleActive!==false && !row.isBackup);
        if(!unit || unit.__luminousEnchantmentReactionArmedRound===Number(data.round))continue;
        const result=bridge?.queueDefensiveReaction?.(unit,id);
        if(result?.queued)
          Object.defineProperty(unit,'__luminousEnchantmentReactionArmedRound',{
            configurable:true,writable:true,enumerable:false,value:Number(data.round),
          });
      }
    }
    combat.render?.();global.LuminousWebGL2Renderer?.requestRender?.(80);return true;
  }
  function applySnapshot(snapshot={}, {deferRender=false,changes=null}={}){
    const combat=runtime(),units=combat?.combatants?.()||{};let changed=false;
    for(const [id,canonical] of Object.entries(snapshot||{})){
      const unit=units[id];if(!unit)continue;const fields=new Set();
      for(const [key,value] of Object.entries(canonical||{})){
        if(key==='actionSlots'||key==='activeSlots')continue;
        if(JSON.stringify(unit[key])!==JSON.stringify(value)){unit[key]=clone(value);fields.add(key);}
      }
      for(const [key,value] of Object.entries(canonical.combatIndependentActionState?.runtimeFields||{})){
        if(JSON.stringify(unit[key])!==JSON.stringify(value)){unit[key]=clone(value);fields.add(key);}
      }
      const economy=global.LuminousActionEconomy?.ensureState?.(unit);
      if(economy){economy.quickActionRemaining=Number(canonical.quickActionRemaining??economy.quickActionRemaining);economy.reactionRemaining=Number(canonical.reactionRemaining??economy.reactionRemaining);}
      const count=Math.max(1,Math.trunc(Number(canonical.actionSlots||canonical.activeSlots)||1));
      if(Number(unit.actionSlots)!==count){global.setUnitActionSlotCount?.(id,count);unit.actionSlots=count;unit.activeSlots=count;fields.add('actionSlots');}
      if(fields.size){changed=true;changes?.push({unitId:id,fields:[...fields]});}
    }
    // A playback burst commits every canonical mutation immediately. The viewer
    // paints its changed fields once, before the cue or next frame, rather than
    // rebuilding planning slots and the entire roster for each event.
    if(changed&&!deferRender){combat.render?.();global.LuminousCombatStepRuntime?.refreshPlayback?.();global.LuminousWebGL2Renderer?.requestRender?.(120);}return changed;
  }
  function reconcileCheckpoint(seq){
    const row=state.pendingRemoteCheckpoints.get(seq);if(!row)return false;const localDigest=state.localDigests.get(seq);if(!localDigest)return false;
    state.pendingRemoteCheckpoints.delete(seq);state.lastCheckpointSeq=Math.max(state.lastCheckpointSeq,seq);if(row.digest===localDigest)return true;
    console.warn('[Combat073 Authority] deterministic mismatch',{round:row.round,seq,expected:row.digest,actual:localDigest});
    if(seq===state.localActionSeq&&state.inFlightActions===0){if(Number.isFinite(Number(row.rngCursor)))resetRandom(state.current.seed,Number(row.rngCursor));applySnapshot(row.combatants||{});state.localDigests.set(seq,row.digest||checkpointDigest(row.combatants||{},row.round));}
    return false;
  }
  function receiveCheckpoint(row){const seq=Math.max(0,Number(row?.seq)||0);if(!seq||Number(row.round)!==Number(adapterState()?.round)||isDm())return;state.pendingRemoteCheckpoints.set(seq,clone(row));reconcileCheckpoint(seq);}
  function publishActionCheckpoint(type='action'){
    if(!isDm()||norm(state.current?.phase)!=='running')return false;flushPresentation();const s=adapterState();if(!s?.db?.ref)return false;const seq=state.localActionSeq,snapshot=snapshotRuntime(),row={round:Number(state.current.round)||Number(s.round)||1,seq,actionSeq:state.localActionSeq,type,rngCursor:state.cursor,digest:checkpointDigest(snapshot,state.current.round),combatants:snapshot,mvpCheckpoint:global.LuminousCombatMvpRuntime?.checkpoint?.()||null,updatedAt:serverTime()};state.lastCheckpointSeq=Math.max(state.lastCheckpointSeq,seq);state.current.checkpoint=row;
    if(batchMode()&&state.lastExecutionJson)row.executionJson=state.lastExecutionJson;
    const batches=batchMode()?playback().batchUpdates(row):{};
    const updates={'campaña/combate/mvpCheckpoint':row.mvpCheckpoint,[`${ROOT.current}/checkpoint`]:row,...playerVitalFirebaseUpdates(snapshot),...batches,...resourceFirebaseUpdates(snapshot)};
    state.writeChain=state.writeChain.then(()=>s.db.ref().update(batchMode()?playback().commitUpdates(updates):updates));return row;
  }
  function queueCheckpoint(type='state'){return publishActionCheckpoint(type);}
  function flushPresentation(){
    if(state.presentationTimer===null)return;
    global.clearTimeout(state.presentationTimer);state.presentationTimer=null;
    if(state.writeFailure)throw state.writeFailure;
    playback().assertOwner(state.current);
    // Events carry exact state deltas. A full roster/inventory in every visual
    // envelope repeats the same data and forces needless consumer renders.
    const row={round:Number(state.current.round),actionSeq:state.localActionSeq,type:'presentation',rngCursor:state.cursor,updatedAt:serverTime()};
    const updates=playback().batchUpdates(row);
    // Firebase queues writes in invocation order. Submit now, while animation
    // runs; drain acknowledgements at the completed-action recovery barrier.
    const pending=adapterState().db.ref().update(updates);
    state.writeChain=Promise.all([state.writeChain,pending]).then(()=>{});
    state.writeChain.catch(error=>{state.writeFailure=error;});
  }
  function publishPresentation(){
    if(!isDm()||!batchMode()||!state.runningLocal||!state.executingGeneration)return;
    if(state.writeFailure)throw state.writeFailure;
    playback().assertOwner(state.current);
    // Coalesce simultaneous Coin sides and zero-duration cues in one frame.
    // The animation clock never waits for a network acknowledgement.
    if(state.presentationTimer===null)state.presentationTimer=global.setTimeout(()=>{
      try{flushPresentation();}catch(error){state.writeFailure=error;setStatus('No se pudo confirmar el turno. Reanuda desde el último resultado confirmado.');}
    },16);
  }

  function wrapSyncMechanic(name,{deterministic=true}={}){const original=global[name];if(typeof original!=='function'||original.__luminousAuthorityWrapped)return false;const wrapped=function(...args){return deterministic?withAuthorityRandom(()=>original.apply(this,args)):withPrivateRandom(()=>original.apply(this,args));};wrapped.__luminousAuthorityWrapped=true;wrapped.__luminousAuthorityOriginal=original;global[name]=wrapped;state.hooks.set(name,original);if(global.LuminousCombatHUD?.[name]===original)global.LuminousCombatHUD[name]=wrapped;return true;}
  function wrapAsyncMechanic(name){const original=global[name];if(typeof original!=='function'||original.__luminousAuthorityWrapped)return false;const wrapped=async function(...args){return await original.apply(this,args);};wrapped.__luminousAuthorityWrapped=true;wrapped.__luminousAuthorityOriginal=original;global[name]=wrapped;state.hooks.set(name,original);return true;}
  function patchCoinEngine(){const engine=global.LuminousCoinEngine;if(!engine?.runAnimatedRoll)return false;if(engine.__luminousAuthorityCoinEngine)return true;state.originalCoinEngine=state.originalCoinEngine||engine;global.LuminousCoinEngine=Object.freeze({...engine,__luminousAuthorityCoinEngine:true,rollSide:(headsChance,rng)=>engine.rollSide(headsChance,rng||random),runAnimatedRoll:options=>engine.runAnimatedRoll({...options,rng:options?.rng||random})});return true;}
  function patchExecutionQueue(){
    const original=global.buildExecutionQueue;if(typeof original!=='function')return false;if(original.__luminousAuthorityQueue)return true;state.originalBuildQueue=state.originalBuildQueue||original;
    const wrapped=function(){const queue=original(),data=runtime()?.combatants?.()||{},existing=new Set(queue.map(entry=>`${entry.ownerId}:${entry.localIndex}`));Object.values(data).forEach(unit=>{if(unit?.controlled!=='remote'||!Array.isArray(unit.autoPlans))return;const slots=global.unitSlots?.(unit.id)||[];unit.autoPlans.forEach((plan,index)=>{if(!plan||existing.has(`${unit.id}:${index}`))return;queue.push({ownerId:unit.id,ownerName:unit.name,slot:slots[index]||null,localIndex:index,worldX:Number(unit.x)||0,plan,controller:'remote'});});});Object.values(data).forEach(unit=>{if(unit?.controlled!=='ai'||unit.battleActive===false||unit.isBackup||Number(unit.hp)<=0||queue.some(entry=>entry.ownerId===unit.id))return;const actions=global.LuminousUnitIndependentActions?.sourcesFor?.(unit)||[];if(actions.length)queue.push({ownerId:unit.id,ownerName:unit.name,slot:null,localIndex:0,worldX:Number(unit.x)||0,plan:{type:'independent'},controller:'ai_independent'});});queue.forEach(entry=>{const unit=data[entry.ownerId];entry.speed=Number(unit?.speed)||0;entry.tieSeed=Number(unit?.speedTie)||0;});queue.sort((a,b)=>{const speedDelta=b.speed-a.speed;if(speedDelta)return speedDelta;if(a.ownerId===b.ownerId)return a.localIndex-b.localIndex;return a.tieSeed-b.tieSeed;});return queue;};
    wrapped.__luminousAuthorityQueue=true;wrapped.__luminousAuthorityQueueOriginal=original;global.buildExecutionQueue=wrapped;return true;
  }
  function patchExecuteQueueEntry(){
    const original=global.executeQueueEntry;if(typeof original!=='function')return false;if(original.__luminousAuthorityQueueEntry)return true;
    const wrapped=function(entry,...rest){
      if(global.LuminousUnitUniversalActionPolicy?.definitionFor(entry?.plan?.data?.actionKey)?.phase==='on_turn_end'&&!entry._turnEnd)return Promise.resolve({deferred:true});
      const scope=this,adjusted=entry?.controller==='remote'&&entry?.plan?.type==='items'?{...entry,controller:'player'}:entry;
      const run=async()=>{
        if(state.executingGeneration)playback().assertOwner(state.current);
        state.inFlightActions+=1;
        try{
          const owner=runtime()?.combatants?.()?.[adjusted?.ownerId];
          if(!owner||owner.battleActive===false||owner.isBackup===true||owner.defeated===true||owner.dead===true||(Number.isFinite(Number(owner.hp))&&Number(owner.hp)<=0)){
            if(owner)global.LuminousUnitUniversalActionRuntime?.cancelPending(owner,Number(state.current?.round)||Number(adapterState()?.round)||1);
            return {skipped:true,reason:'owner_not_in_field',ownerId:adjusted?.ownerId||null};
          }
          const result=adjusted?.controller==='ai_independent'
            ? {resolved:true,independentOnly:true} : await original.call(scope,adjusted,...rest);
          // Skill-driven Enchantment wear touches the canonical inventory,
          // even though the combat queue entry itself is not an Item action.
          if(isDm()&&!batchMode()&&canonicalPlayerId(owner)&&
              (isItemQueueEntry(adjusted)||owner.__luminousEnchantmentInventoryDirty===true)){
            try{
              const saved=await persistPlayerInventory(owner,adjusted?.ownerId);
              if(!saved?.saved)throw new Error(saved?.reason||'inventory_save_failed');
              owner.__luminousEnchantmentInventoryDirty=false;
            }catch(error){console.error('[Combat073 Authority inventory persistence]',error);throw error;}
          }
          return result;
        }
        finally{
          state.inFlightActions=Math.max(0,state.inFlightActions-1);state.localActionSeq+=1;
          if(state.executingGeneration)playback().assertOwner(state.current);
          if(isDm()){
            try{global.LuminousCombatDeploymentBridge073?.reconcileDefeatedRuntime?.({source:'queue_entry',entry:adjusted,round:Number(state.current?.round)||Number(adapterState()?.round)||1});}
            catch(error){console.error('[Combat073 Authority deployment reconcile]',error);}
          }
          const snapshot=snapshotRuntime(),localDigest=checkpointDigest(snapshot,state.current.round);state.localDigests.set(state.localActionSeq,localDigest);
          if(isDm()){
            if(batchMode())await playback().drainPresentation?.();
            if(batchMode())state.lastExecutionJson=JSON.stringify(global.LuminousCombatStepRuntime.captureExecution(rest[0],rest[1]));
            publishActionCheckpoint(`queue_entry:${adjusted?.ownerId||'unknown'}:${adjusted?.localIndex??0}`);
            if(batchMode())await state.writeChain;
          }else reconcileCheckpoint(state.localActionSeq);
        }
      };
      const task=state.executionChain.then(run,run);state.executionChain=task.catch(()=>{});return task;
    };
    wrapped.__luminousAuthorityQueueEntry=true;wrapped.__luminousAuthorityQueueEntryOriginal=original;global.executeQueueEntry=wrapped;return true;
  }
  function installHooks(){patchCoinEngine();patchExecutionQueue();patchExecuteQueueEntry();['beginConcentration','processConditionTurnStart','processDeathSavesRoundEnd','rollCriticalHit','randomIntInclusive','rollUnitSpeed','rollPower4Save','rollAbilitySkillCheck','damageCombatant','healCombatant','damageCombatantSP','healCombatantSP','applyCombatStatus','removeCombatStatus','consumeStatusCount','setUnitActionSlotCount','rollTurnSpeeds'].forEach(name=>wrapSyncMechanic(name));['smartTargetScore','assignTargetIntents','autoActionScore','shuffle'].forEach(name=>wrapSyncMechanic(name,{deterministic:false}));['resolveSkillClash','resolveUnopposedCoinAction','resolveSaveOnlySpell'].forEach(wrapAsyncMechanic);patchStartRound();return true;}

  async function setRunning(current){
    const s=adapterState(),startedAt=serverTime(),updates={};
    let startSnapshot=null;
    const events=global.LuminousCombatEventRuntime;
    if(Number(current.round)===1){
      if(!events)throw new Error('No se pudieron cargar los efectos de inicio de combate. Recarga el encuentro.');
      resetRandom(current.seed,0);
      const planned=await events.planEncounterStart(Object.values(runtime()?.combatants?.()||{}),{
        encounterId:current.encounterId||s.encounterId||`encounter-${current.seed}`,
        round:Number(current.round)||1,
        withRandom:withAuthorityRandom
      });
      // Planning already rolled canonical Speed. Apply startup modifiers using
      // that same base and tie, before sealing the execution/playback baseline.
      const speedRule=runtime()?.speedForBaseRoll;
      for(const unit of planned.units){
        if(unit.battleActive===false||unit.isBackup||Number(unit.speedRollTurn)!==Number(current.round))continue;
        const base=finite(unit.speedBaseRoll,null);
        if(base==null||base<1)continue;
        if(typeof speedRule!=='function')throw new Error('No se pudo actualizar la velocidad inicial. Recarga el visor.');
        unit.speed=speedRule(unit,Number(current.round),base);
      }
      startSnapshot=Object.fromEntries(planned.units.map(unit=>[unit.id,compactUnit(unit)]));
      current={...current,encounterStart:{rngCursor:state.cursor},initialStateJson:JSON.stringify(startSnapshot)};
      const execution=current.initialExecutionJson?JSON.parse(current.initialExecutionJson):{queue:[],resolvedKeys:[]};
      execution.units=Object.fromEntries(planned.units.map(unit=>[unit.id,unit]));
      current.initialExecutionJson=JSON.stringify(execution);
      updates[`${ROOT.current}/encounterStart`]=current.encounterStart;
      updates[`${ROOT.current}/initialStateJson`]=current.initialStateJson;
      updates[`${ROOT.current}/initialExecutionJson`]=current.initialExecutionJson;
      Object.assign(updates,combatantFirebaseUpdates(startSnapshot));
    }
    global.LuminousCombatStepRuntime?.capturePresentation?.(false);
    if(playback()?.enabled(current))Object.assign(updates,playback().beginUpdates(current));
    updates[`${ROOT.current}/phase`]='running';updates[`${ROOT.current}/startedAt`]=startedAt;
    Object.assign(updates,stateUpdates({phase:'COMBAT',active:true,round:Number(current.round)||Number(s.round)||1,authorityUid:s.uid,seed:current.seed,updatedAt:serverTime()}));
    if(startSnapshot){
      const session=global.LuminousCombatSession;
      if(!session?.updateRoot)throw new Error('El encuentro todavía no está listo para comenzar.');
      const committed=await session.updateRoot(s.db,raw=>{
        const sealed=raw?.authority?.current;
        if(norm(sealed?.phase)!=='sealed'||Number(sealed.round)!==Number(current.round)||Number(sealed.seed)!==Number(current.seed)||sealed.id!==current.id)return;
        const next=clone(raw);
        for(const [path,value]of Object.entries(updates)){
          const parts=path.slice('campaña/combate/'.length).split('/');let node=next;
          for(const part of parts.slice(0,-1))node=node[part]||={};
          node[parts.at(-1)]=value;
        }
        return next;
      });
      if(!committed.committed)throw new Error('El inicio de este encuentro ya fue confirmado en otra pestaña.');
    }else await s.db.ref().update(updates);
    if(startSnapshot)applySnapshot(startSnapshot);
    state.current={...current,phase:'running',startedAt:Date.now(),checkpoint:null};state.lastCheckpointSeq=0;state.localActionSeq=0;state.localDigests.clear();state.pendingRemoteCheckpoints.clear();state.inFlightActions=0;state.executionChain=Promise.resolve();state.writeChain=Promise.resolve();state.writeFailure=null;resetRandom(current.seed,Number(current.encounterStart?.rngCursor)||0);return state.current;
  }
  function domRound(fallback){const node=global.document?.getElementById?.('round'),value=Math.trunc(Number(node?.textContent));return Number.isFinite(value)&&value>0?value:fallback;}
  function combatantFirebaseUpdates(snapshot){const updates={};for(const [id,row] of Object.entries(snapshot||{})){if(batchMode()&&!adapterState()?.combatants?.[id])continue;for(const [key,value] of Object.entries(row||{}))updates[`${ROOT.combatants}/${id}/${key}`]=value;updates[`${ROOT.combatants}/${id}/actionSlotIndex`]=Object.fromEntries(Array.from({length:Math.max(1,Number(row.actionSlots)||1)},(_,i)=>[String(i),true]));}return updates;}
  function resourceFirebaseUpdates(snapshot){
    const updates={},units=runtime()?.combatants?.()||{};
    for(const [id,row]of Object.entries(snapshot||{})){
      const playerId=canonicalPlayerId(units[id]);if(!playerId)continue;
      for(const key of ['inventario_activo','inventario_stash','itemEquipmentRefs','attunedItemInstanceIds','itemInventorySchemaVersion','spellcastingState','classResources','traitUses','resources','combatTraitState']){
        if(row[key]===undefined)continue;
        updates[`campaña/jugadores/${playerId}/${key}`]=clone(row[key]);
        if(!batchMode()||adapterState()?.combatants?.[id])updates[`${ROOT.combatants}/${id}/${key}`]=clone(row[key]);
      }
    }
    return updates;
  }
  function playerVitalSnapshot(snapshot={}){
    const live=runtime()?.combatants?.()||{},out={};
    for(const [id,row] of Object.entries(snapshot||{})){
      const source=live[id]||{};
      out[id]={
        ...row,
        isPlayer:source.isPlayer===true,
        actorCategory:source.actorCategory,
        category:source.category,
        canonicalScope:source.canonicalScope,
        canonicalPlayerKey:source.canonicalPlayerKey,
        ownerPlayerId:source.ownerPlayerId,
        playerId:source.playerId,
        characterLink:clone(source.characterLink||null),
        actorRef:clone(source.actorRef||null)
      };
    }
    return out;
  }
  function playerVitalFirebaseUpdates(snapshot){try{return global.LuminousPlayerVitalsRealtimeBridge?.firebaseUpdatesForSnapshot?.(playerVitalSnapshot(snapshot))||{};}catch(error){console.error('[Combat073 Authority vitals]',error);return{};}}
  async function afterRound({completedRound,nextRound}={}){
    if(state.executingGeneration)playback().assertOwner(state.current);
    if(!isDm())return false;flushPresentation();await state.writeChain;const s=adapterState();if(!s?.db?.ref)return false;const done=Math.max(1,Number(completedRound)||Number(state.current.round)||1),next=Math.max(done+1,Number(nextRound)||done+1),snapshot=snapshotRuntime(),row={round:done,seq:state.lastCheckpointSeq+1,type:'round_complete',actionSeq:state.localActionSeq,rngCursor:state.cursor,digest:checkpointDigest(snapshot,done),combatants:snapshot,mvpCheckpoint:global.LuminousCombatMvpRuntime?.checkpoint?.()||null,updatedAt:serverTime()};const updates={'campaña/combate/mvpCheckpoint':row.mvpCheckpoint,...combatantFirebaseUpdates(snapshot),...playerVitalFirebaseUpdates(snapshot),...resourceFirebaseUpdates(snapshot),...(batchMode()?playback().batchUpdates(row):{})};updates[`${ROOT.current}/phase`]='complete';updates[`${ROOT.current}/resultDigest`]=row.digest;updates[`${ROOT.current}/checkpoint`]=row;Object.assign(updates,stateUpdates({phase:'PRE_COMBAT_PLANNING',active:true,round:next,authorityUid:s.uid,updatedAt:serverTime()}));updates[ROOT.ready]=null;updates[ROOT.plans]=null;await s.db.ref().update(batchMode()?playback().commitUpdates(updates):updates);state.current={...state.current,phase:'complete',resultDigest:row.digest,checkpoint:row};state.lastCheckpointSeq=row.seq;return row;
  }
  async function requestStartRound(){
    state.lastStartError='';
    if(state.runningLocal||state.preparingRound)return false;const s=adapterState(),original=state.originalStartRound;if(!s?.db?.ref||typeof original!=='function')return false;if(isPlayer()&&!isDm()&&!state.remoteStart){setStatus('COMBAT · esperando resolución autoritativa del DM');return false;}
    state.preparingRound=true;
    try{
      // Drain the child transaction before claiming the encounter parent.
      // Otherwise a reinforcement's new Speed roll can invalidate every seal
      // retry while both transactions are being replayed by the Firebase SDK.
      if(isDm())await global.LuminousCombatSpeedAuthority073?.ensureRoundSpeeds?.({preparing:true});
      if(isDm()&&global.LuminousCombatRemoteIntents073?.publishPlanningAi){
        // Keep hydration available while the sparse Skill catalog loads. A
        // READY received during DM boot must not seal placeholder enemy plans.
        state.preparingRound=true;let prepared=false;
        for(let attempt=0;attempt<80;attempt++){
          if((Number(state.current?.round)===Number(s.round)&&['sealed','running'].includes(norm(state.current?.phase)))||await global.LuminousCombatRemoteIntents073.publishPlanningAi()){prepared=true;break;}
          await new Promise(resolve=>global.setTimeout(resolve,100));
        }
        if(!prepared)throw new Error('No se pudieron cargar las habilidades enemigas. Recarga el encuentro antes de iniciar el turno.');
      }
      state.runningLocal=true;state.preparingRound=false;
      let current=state.current;
      if(isDm()){
        if(Number(current?.round)!==Number(s.round)||!['sealed','running'].includes(norm(current?.phase)))current=await sealRound();
        if(playback()?.enabled(current)){
          playback().assertOwner(current);
          if(norm(current.phase)==='running'&&!state.resumeRuntime)throw new Error('Este turno ya fue iniciado. Espera a que la pestaña original confirme los resultados.');
        }
        if(norm(current.phase)!=='running')current=await setRunning(current);
      }else{state.remoteStart=false;if(batchMode())return false;if(Number(current?.round)!==Number(s.round)||norm(current?.phase)!=='running')return false;state.autoStartedRound=Number(current.round);state.inFlightActions=0;state.executionChain=Promise.resolve();resetRandom(current.seed,Number(current.encounterStart?.rngCursor)||0);}
      state.executingGeneration=current.playback?current.id:null;
      if(isDm()){const saved=await read('campaña/combate/mvpCheckpoint');global.LuminousCombatMvpRuntime?.restore?.(saved);}
      await global.LuminousCombatEventRuntime?.prepare(Object.values(runtime()?.combatants?.()||{}));
      applyAuthority(current);const completedRound=Number(current.round)||Number(s.round)||1;await original();await state.executionChain;
      const nextRound=domRound(completedRound);
      if(nextRound<=completedRound)throw new Error('No se pudo completar el turno. Vuelve a abrir el combate.');
      if(isDm()){await state.writeChain;await afterRound({completedRound,nextRound});}else if(state.pendingFinalSnapshot){applySnapshot(state.pendingFinalSnapshot.combatants||{});if(Number.isFinite(Number(state.pendingFinalSnapshot.rngCursor)))resetRandom(current.seed,Number(state.pendingFinalSnapshot.rngCursor));state.pendingFinalSnapshot=null;}
      return true;
    }catch(error){console.error('[Combat073 Authority start]',error);state.lastStartError=error?.message||'No se pudo continuar el turno. Vuelve a abrir el combate.';setStatus(state.lastStartError);return false;}finally{if(state.presentationTimer!==null){global.clearTimeout(state.presentationTimer);state.presentationTimer=null;}state.preparingRound=false;state.runningLocal=false;state.resumeRuntime=null;state.executingGeneration=null;if(adapterState()?.firebaseReady)adapter()?.scheduleHydrate?.();}
  }
  function patchStartRound(){const hud=global.LuminousCombatHUD,original=state.originalStartRound||hud?.startRound||global.startRound;if(typeof original!=='function')return false;state.originalStartRound=original.__luminousAuthorityStartOriginal||original;requestStartRound.__luminousAuthorityStart=true;requestStartRound.__luminousAuthorityStartOriginal=state.originalStartRound;global.startRound=requestStartRound;if(hud)hud.startRound=requestStartRound;const button=global.document?.getElementById?.('start-round');if(button)button.onclick=requestStartRound;return true;}
  function allReadySnapshot(rows={}){const round=Number(adapterState()?.round)||1,ids=activePlayerIds();return ids.length>0&&ids.every(id=>rows?.[id]?.ready===true&&Number(rows[id].round)===round);}
  function maybeAutoStart(rows={}){
    if(!isDm()||state.runningLocal||state.preparingRound||!allReadySnapshot(rows))return false;
    if(!['pre_combat_planning','planning'].includes(norm(adapterState()?.combatState)))return false;
    if(state.autoStartTimer)return true;
    state.autoStartTimer=global.setTimeout(async()=>{
      state.autoStartTimer=null;
      try{
        // READY can reach the DM before its associated actions or roster change.
        // Verify a single canonical snapshot before resolving, never just 6/6.
        const combat=await read('campaña/combate'),round=Number(combat?.estado?.round)||1;
        if(!['pre_combat_planning','planning'].includes(norm(combat?.estado?.phase||combat?.estado)))return;
        if(round!==Number(adapterState()?.round)||state.runningLocal||state.preparingRound)return;
        const members=global.LuminousCombatParticipants?.players(combat?.combatants||{})||[];
        if(!members.length||!members.every(member=>combat.readyPlayers?.[member.playerId]?.ready===true&&Number(combat.readyPlayers[member.playerId].round)===round))return;
        const plans=Object.fromEntries(members.map(member=>[member.playerId,Object.fromEntries(Object.entries(combat.plannedActions?.[member.playerId]||{}).filter(([,plan])=>plan?.unitId===member.unitId&&Number(plan.round)===round))]));
        const check=readyComplete(combat.readyPlayers,plans,round,members);
        if(!check.complete){
          const waiting=members.filter(member=>check.missing.some(key=>key.startsWith(member.playerId+':'))).map(member=>member.name);
          setStatus(`TURN ${round} · Esperando acciones confirmadas de ${waiting.join(', ')}`);
          return;
        }
        await requestStartRound();
      }catch(error){console.error('[Combat073 Ready start]',error);}
    },120);
    return true;
  }
  function onAuthority(snapshot){
    const data=snapshot.val()||{},previous=state.current,previousSeed=previous?.seed,previousRound=previous?.round;state.current=data;if(data.seed&&Number(data.round)===Number(adapterState()?.round)&&!state.runningLocal&&(data.seed!==previousSeed||data.round!==previousRound))resetRandom(data.seed,Number(data.encounterStart?.rngCursor)||0);applyAuthority(data);if(data.checkpoint)receiveCheckpoint(data.checkpoint);
    if(previous?.playback&&!data.playback&&isPlayer()){
      playback()?.disconnectConsumer();state.runningLocal=false;
      global.LuminousCombatStepRuntime?.lockPlanning(false);adapter()?.scheduleHydrate?.();
    }
    playback()?.refreshRecoveryControl(data);
    if(playback()?.enabled(data)&&isPlayer()){
      playback().observe(data).catch(error=>console.error('[Combat playback]',error));
      return;
    }
    if(isPlayer()&&norm(data.phase)==='running'&&Number(data.round)===Number(adapterState()?.round)&&state.autoStartedRound!==Number(data.round)){
      if(Number(data.checkpoint?.seq)>0&&data.checkpoint?.combatants){state.autoStartedRound=Number(data.round);applySnapshot(data.checkpoint.combatants);resetRandom(data.seed,Number(data.checkpoint.rngCursor)||0);setStatus(`TURN ${data.round} · COMBAT · sincronizado al checkpoint ${data.checkpoint.seq}`);}
      else{state.remoteStart=true;global.setTimeout(requestStartRound,80);}
    }
    if(isPlayer()&&norm(data.phase)==='complete'&&data.checkpoint?.combatants){if(state.runningLocal)state.pendingFinalSnapshot=clone(data.checkpoint);else{applySnapshot(data.checkpoint.combatants);if(Number.isFinite(Number(data.checkpoint.rngCursor))&&data.seed)resetRandom(data.seed,Number(data.checkpoint.rngCursor));}}
  }
  function bindPlanningUpdates(){
    const s=adapterState();
    if(!isDm()||state.plansRef||!s?.db?.ref||!s.user)return;
    state.plansRef=s.db.ref(ROOT.plans);
    state.plansHandler=()=>{if(state.readyLoaded)maybeAutoStart(state.readyRows);};
    listen(state.plansRef,state.plansHandler,'[Combat073 Authority plans]');
  }
  function bind(){
    const s=adapterState();if(!s?.db?.ref||!s.user)return false;if(state.authorityRef)return true;
    playback()?.start(global.LuminousCombatAuthority073);
    state.authorityRef=s.db.ref(ROOT.current);state.authorityHandler=onAuthority;
    listen(state.authorityRef,state.authorityHandler,'[Combat073 Authority]');
    state.readyLoaded=false;state.readyRef=s.db.ref(ROOT.ready);
    state.readyHandler=snapshot=>{
      state.readyRows=snapshot.val()||{};state.readyLoaded=true;
      global.LuminousCombatHudMotion073?.refresh?.();maybeAutoStart(state.readyRows);
    };
    listen(state.readyRef,state.readyHandler,'[Combat073 Authority ready]');
    // A late plan does not change READY or the adapter hydration signature.
    // Wake the same debounced, snapshot-validated start path on its arrival.
    // Only the DM needs this subscription; Players already receive shared plans.
    bindPlanningUpdates();
    void preparePlanningState().catch(error=>console.error('[Combat073 planning recovery]',error));return true;
  }
  function start(){if(state.started)return true;state.started=true;installHooks();const attempt=()=>{installHooks();if(bind())return true;state.retryTimer=global.setTimeout(attempt,200);return false;};attempt();return true;}
  function stop(){if(state.presentationTimer!==null){global.clearTimeout(state.presentationTimer);state.presentationTimer=null;}state.listenCleanup.splice(0).forEach(off=>off());state.readyLoaded=false;if(state.retryTimer)global.clearTimeout(state.retryTimer);if(state.autoStartTimer)global.clearTimeout(state.autoStartTimer);state.retryTimer=state.autoStartTimer=null;if(state.authorityRef&&state.authorityHandler)state.authorityRef.off('value',state.authorityHandler);if(state.readyRef&&state.readyHandler)state.readyRef.off('value',state.readyHandler);playback()?.stop();state.authorityRef=state.authorityHandler=state.readyRef=state.readyHandler=state.plansRef=state.plansHandler=null;state.started=false;}

  global.addEventListener('luminous:combat073-runtime-ready',()=>{installHooks();applyAuthority();});global.addEventListener('luminous:combat073-hydrated',()=>{installHooks();applyAuthority();if(state.started)bindPlanningUpdates();void preparePlanningState().catch(error=>console.error('[Combat073 planning recovery]',error));if(state.readyLoaded)maybeAutoStart(state.readyRows);});global.addEventListener('beforeunload',stop,{once:true});
  global.LuminousCombatAuthority073=Object.freeze({version:'0.7.3-authority.9-step-rng',ROOT,state,start,stop,isDm,isPlayer,random,resetRandom,withAuthorityRandom,canonicalPlayerId,classEntries,isSpellcaster,validateSpellPlans,queueEntryKind,isItemQueueEntry,persistPlayerInventory,compactUnit,snapshotRuntime,digest,checkpointDigest,queueCheckpoint,publishPresentation,sealRound,applyAuthority,applySnapshot,combatantFirebaseUpdates,playerVitalSnapshot,playerVitalFirebaseUpdates,afterRound,installHooks,requestStartRound,serializeRuntimePlan,preparePlanningState,readyComplete,allReadySnapshot,maybeAutoStart});
  start();
})(window);


