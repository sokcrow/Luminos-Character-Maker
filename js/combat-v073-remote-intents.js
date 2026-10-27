(function(global){
  'use strict';
  if(global.LuminousCombatRemoteIntents073)return;

  const READY_ROOT='campaña/combate/readyPlayers';
  const PLANS_ROOT='campaña/combate/plannedActions',AI_ROOT='campaña/combate/planningAi';
  const AUTH_ROOT='campaña/combate/authority/current',INDEPENDENT_ROOT='campaña/combate/independentIntents';
  const clean=value=>String(value??'').trim();
  const norm=value=>clean(value).toLowerCase().replace(/[\s-]+/g,'_');
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const state={started:false,readyRef:null,readyHandler:null,authRef:null,authHandler:null,rawTargets:{},ready:{},plans:{},planningAi:{},authority:{},extraSubs:[],publishingAi:false,restoreOwn:false,readyLoaded:false,plansLoaded:false,aiTimer:null,aiAttempts:0,retryTimer:null,renderTimer:null,independentIntents:{},independentChain:Promise.resolve(),independentRetryTimer:null,independentRetryCount:0};
  function adapter(){return global.LuminousCombatLiveAdapter073||null;}
  function adapterState(){return adapter()?.state||null;}
  function runtime(){return global.LuminousCombat073||null;}
  function listen(ref,handler,label){
    let closed=false,retried=false,timer=null;
    const failed=error=>{
      const user=adapterState()?.user;
      if(closed)return;
      if(error?.code!=='PERMISSION_DENIED'||retried||!user){console.error(label,error);return;}
      retried=true;
      Promise.resolve().then(()=>user.getIdToken?.(true)).then(()=>{
        if(closed||adapterState()?.user!==user)return;
        timer=global.setTimeout(()=>{timer=null;if(!closed)ref.on('value',handler,failed);},250);
      }).catch(error=>{if(!closed)console.error(label,error);});
    };
    ref.on('value',handler,failed);
    state.extraSubs.push(()=>{closed=true;if(timer)global.clearTimeout(timer);ref.off('value',handler);});
  }
  function combatantForPersistedPlan(raw={}){
    const data=runtime()?.combatants?.()||{},explicit=clean(raw.unitId);if(explicit&&data[explicit])return data[explicit];
    const playerId=clean(raw.scheduledBy);if(!playerId)return null;
    return Object.values(data).find(unit=>clean(unit?.canonicalPlayerKey||unit?.ownerPlayerId||unit?.playerId||unit?.characterLink?.playerId)===playerId)||null;
  }
  function inferTargetSide(unit,raw={}){const explicit=clean(raw.targetSide);if(explicit)return explicit;const target=runtime()?.combatants?.()?.[clean(raw.targetId)];if(!unit||!target)return'';return unit.faction===target.faction?'ally':'enemy';}
  function commonPlan(raw={},slotIndex=0){return{...Object.fromEntries(['drawId','clashChoice','clashOrder','clashConfirmed'].filter(key=>raw[key]!=null).map(key=>[key,clone(raw[key])])),sourceSlotIndex:Number.isInteger(Number(raw.sourceSlotIndex))?Number(raw.sourceSlotIndex):slotIndex,targetId:clean(raw.targetId)||null,targetSlotIndex:raw.targetSlotIndex==null?null:Math.max(0,Number(raw.targetSlotIndex)||0),additionalTargets:Array.isArray(raw.additionalTargets)?clone(raw.additionalTargets):[]};}
  function intentPlan(raw={},slotIndex=0,unit=null){const targetSide=inferTargetSide(unit,raw);return{...commonPlan(raw,slotIndex),type:'intent',data:{kind:'target_intent',id:'target_intent',name:'TARGET',targetSide}};}
  function runtimePlan(raw={},slotIndex=0,unit=null){
    const kind=norm(raw.kind||'skill'),common=commonPlan(raw,slotIndex),targetSide=inferTargetSide(unit,raw),skills=adapterState()?.skills||{},embedded=clone(raw.actionData||{});
    if(kind==='skill'||kind==='defense'){
      const skillId=clean(raw.skillId),source=Object.keys(embedded).length?embedded:(skillId&&skills[skillId]?adapter()?.normalizeSkill?.(skillId,skills[skillId]):null);
      const data={...(source||{}),kind,skillId,id:skillId||clean(source?.id||raw.actionName),name:clean(raw.actionName||source?.name||skillId)};if(targetSide)data.targetSide=targetSide;return{...common,type:kind==='defense'?'defense':raw.planType==='deck'||raw.drawId?'deck':raw.planType==='auto'?'auto':'granted',data};
    }
    if(kind==='spell'){
      const spellId=clean(raw.spellId),data={...embedded,classId:raw.classId||embedded.classId||null,kind:'spell',spellId,id:spellId||clean(embedded.id),name:clean(raw.actionName||embedded.name||spellId),targetSide:targetSide||embedded.targetSide||'enemy',slotLevel:Number(raw.slotLevel??embedded.slotLevel)||0,overcast:Boolean(raw.overcast??embedded.overcast)};return{...common,type:'spells',data};
    }
    if(kind==='item'){
      const itemId=clean(raw.itemId),itemType=clean(raw.itemType||embedded.itemType||embedded.item_type)||(targetSide==='ally'?'hp_healing':'offensive'),data={...embedded,kind:'item',itemId,id:itemId||clean(embedded.id),name:clean(raw.actionName||embedded.name||itemId),itemType,targetSide:targetSide||embedded.targetSide};return{...common,type:'items',data};
    }
    if(kind==='global'){
      const actionKey=clean(raw.actionKey)||clean(embedded.actionKey),data={...embedded,kind:'global',actionKey,id:actionKey||clean(embedded.id),name:clean(raw.actionName||embedded.name||actionKey),targetSide:targetSide||embedded.targetSide};return{...common,type:'global',data};
    }
    if(kind==='trait'){
      const traitId=clean(raw.traitId),data={...embedded,kind:'trait',traitId,id:traitId||clean(embedded.id),name:clean(raw.actionName||embedded.name||traitId),targetSide:targetSide||embedded.targetSide};return{...common,type:'traits',data};
    }
    return{...common,type:'auto',data:{...embedded,kind,id:clean(embedded.id||raw.actionName||raw.skillId||raw.itemId||raw.actionKey),targetSide:targetSide||embedded.targetSide}};
  }
  function rowsFromReady(ready={}){
    const out={};
    for(const [owner,row] of Object.entries(ready||{})){
      const targets=row?.targetIntents;if(!targets||typeof targets!=='object')continue;
      out[owner]={};
      for(const [slot,target] of Object.entries(targets))if(target&&typeof target==='object')out[owner][slot]={...clone(target),scheduledBy:clean(target.scheduledBy||owner),unitId:clean(target.unitId||row.unitId),round:Number(target.round||row.round)||0};
    }
    return out;
  }
  function canRenderNow() {
    const combat=runtime(),s=adapterState();
    if (!combat?.render || !s?.hydratedOnce) return false;
    const focusId=clean(combat.playerId?.()||"");
    if (!focusId || !global.document?.getElementById) return true;
    return Boolean(global.document.getElementById(`sprite-${focusId}`));
  }
  function scheduleRender(){
    if(state.renderTimer)return true;
    state.renderTimer=global.setTimeout(()=>{
      state.renderTimer=null;
      const combat=runtime();
      if(!canRenderNow())return;
      combat.render?.();
      renderPlanLabels();
      global.LuminousWebGL2Renderer?.requestRender?.(80);
    },0);
    return true;
  }
  function applyRows(rows,fullPlans){
    const combat=runtime(),s=adapterState();if(!combat?.combatants||!s)return false;const data=combat.combatants();
    Object.values(data).forEach(unit=>{if(unit?.controlled==='remote')unit.autoPlans=[];});
    for(const ownerRows of Object.values(rows||{})){
      if(!ownerRows||typeof ownerRows!=='object')continue;
      for(const [slotKey,raw] of Object.entries(ownerRows)){
        if(!raw||typeof raw!=='object'||Number(raw.round)&&Number(raw.round)!==Number(s.round))continue;
        const unit=combatantForPersistedPlan(raw);if(!unit||unit.controlled!=='remote')continue;
        const slotIndex=Math.max(0,Number(raw.sourceSlotIndex??slotKey)||0);unit.autoPlans=Array.isArray(unit.autoPlans)?unit.autoPlans:[];unit.autoPlans[slotIndex]=fullPlans?runtimePlan(raw,slotIndex,unit):intentPlan(raw,slotIndex,unit);
      }
    }
    scheduleRender();return true;
  }
  function aiSignature(){
    const s=adapterState();
    return JSON.stringify([s?.encounterId||'',Number(s?.round)||1,Object.values(runtime()?.combatants?.()||{})
      .sort((a,b)=>String(a.id).localeCompare(String(b.id))).map(unit=>[
        unit.id,unit.faction,unit.hp,unit.maxHp,unit.sp,unit.actionSlots,
        unit.battleActive,unit.isBackup,unit.dead,unit.defeated,unit.escaped,unit.removed,unit.incapacitated,
        unit.scores,unit.abilityScores,unit.stats,unit.attributes,unit.statusEffects,unit.confusionTurnMode,
        adapter()?.inventoryHydrationSignature?.(unit)||unit.inventario_activo||{},
        unit.controlled==='ai'?runtime()?.kit?.(unit.id)?.actions||[]:[]
      ])]);
  }
  function applyPlanningAi(){
    const s=adapterState();if(!s||state.planningAi.signature!==aiSignature())return false;
    for(const [id,rows]of Object.entries(state.planningAi.plans||{})){
      const unit=runtime()?.combatants?.()?.[id];if(unit?.controlled!=='ai')continue;
      unit.autoPlans=[];
      for(const [index,raw]of Object.entries(rows||{}))unit.autoPlans[Number(index)]=runtimePlan(raw,Number(index),unit);
    }
    return true;
  }
  function retryPlanningAi(){
    if(state.aiTimer||++state.aiAttempts>120)return;
    state.aiTimer=global.setTimeout(()=>{state.aiTimer=null;publishPlanningAi();},250);
  }
  async function publishPlanningAi(){
    const s=adapterState(),authority=state.authority;
    if((s?.role!=='dm'&&!s?.isAuthority)||!s.hydratedOnce||state.publishingAi||global.LuminousCombatAuthority073?.state?.runningLocal||!['planning','pre_combat_planning'].includes(norm(s.combatState))||
       (Number(authority?.round)===Number(s.round)&&['sealed','running'].includes(norm(authority?.phase))))return false;
    if(applyPlanningAi())return true;
    // Wait until the authored skills are loaded; do not publish placeholder kits.
    const bridge=global.LuminousCombatLiveAdapter073;
    // AI preparation depends on AI kits, not on every Player's optional or
    // class-granted Skill catalog entry. Six Players may already be READY while
    // one Player Skill is still unavailable from the sparse library.
    for(const unit of Object.values(s.combatants||{}).filter(unit=>global.LuminousCombatParticipants?.isField(unit)&&!global.LuminousCombatParticipants?.isPlayer(unit)))if(bridge?.skillIdsFor?.(unit).some(id=>!s.skills?.[id])){retryPlanningAi();return false;}
    const serialize=global.LuminousCombatAuthority073?.serializeRuntimePlan;if(!serialize){retryPlanningAi();return false;}
    if(!global.LuminousUnitUniversalActionRuntime?.planAiRoster(runtime()?.combatants?.()||{},{round:Number(s.round)||1})){retryPlanningAi();return false;}
    const plans={};
    for(const unit of Object.values(runtime()?.combatants?.()||{}))if(unit.controlled==='ai'){
      plans[unit.id]={};(unit.autoPlans||[]).forEach((plan,index)=>{if(plan)plans[unit.id][index]=serialize(plan,unit.id,index);});
    }
    const row={round:Number(s.round)||1,signature:aiSignature(),plans};state.publishingAi=true;
    try{await s.db.ref(AI_ROOT).set(row);state.planningAi=row;apply();
      // READY may have arrived before the AI catalog finished loading. Trigger
      // one new eligibility check when AI preparation actually completes.
      const authorityBridge=global.LuminousCombatAuthority073;
      authorityBridge?.maybeAutoStart?.(authorityBridge.state?.readyRows||{});
      return true;}
    catch(error){console.error('[Combat073 Planning AI]',error);return false;}
    finally{state.publishingAi=false;if(row.signature!==aiSignature())retryPlanningAi();}
  }
  function renderPlanLabels(){
    const s=adapterState(),doc=global.document,combat=runtime();if(!doc?.createElement||!combat)return;
    for(const unit of Object.values(combat.combatants?.()||{})){
      const own=unit.controlled==='player',owner=global.LuminousCombatLiveAdapter073?.canonicalPlayerId?.(unit);
      const ready=own?combat.uiState?.().ready:state.ready?.[owner]?.ready===true&&Number(state.ready[owner].round)===Number(s?.round);
      const known=(s?.role==='dm'||s?.isAuthority)||(unit.controlled==='ai'&&global.observationKnown?.(unit,'action'))||ready;
      for(const [index,slot]of [...(global.unitSlots?.(unit.id)||[])].entries()){
        const plan=global.plannedActionAt?.(unit.id,index);
        const visible=known&&plan&&plan.type!=='intent'&&!combat.uiState?.().running;
        let label=slot.querySelector('.slot-intent-label');
        if(!visible){label?.remove();if(slot.hasAttribute('data-public-plan')){slot.removeAttribute('aria-label');slot.removeAttribute('title');}slot.removeAttribute('data-public-plan');continue;}
        if(!label){label=doc.createElement('span');label.className='slot-intent-label';slot.appendChild(label);}
        const target=combat.combatants?.()?.[plan.targetId];
        const clash=plan.clashConfirmed===true&&global.isClashIntent?.(unit.id,index,plan);
        const text=`${ready?'✓ ':''}${plan.data?.name||'Acción'}${target?` · ${clash?'CLASH ↔':'→'} ${target.name} (${Number(plan.targetSlotIndex)+1})`:''}`;
        if(label.textContent!==text)label.textContent=text;
        slot.dataset.publicPlan='true';label.style.setProperty('--intent-row',index);
        slot.setAttribute('aria-label',text);slot.setAttribute('title',text);
      }
    }
  }
  function restoreOwnPlanning(){
    const s=adapterState();if(!state.restoreOwn||s?.role!=='player'||!state.readyLoaded||!state.plansLoaded)return;
    const row=state.ready[s.playerId];if(row?.ready!==true||Number(row.round)!==Number(s.round))return;
    const unit=Object.values(runtime()?.combatants?.()||{}).find(unit=>unit.controlled==='player'),plans=[];
    if(!unit||typeof runtime()?.restorePlanning!=='function'||Number(runtime()?.uiState?.().round)!==Number(s.round))return;
    for(const [index,raw]of Object.entries(state.plans[s.playerId]||{}))if(Number(raw.round)===Number(s.round))plans[Number(index)]=runtimePlan(raw,Number(index),unit);
    if(plans.filter(Boolean).length<Number(row.plannedSlots||0))return;
    state.restoreOwn=false;
    runtime()?.restorePlanning?.(plans,true);
  }
  function apply(){
    const s=adapterState(),phase=norm(state.authority?.phase),round=Number(state.authority?.round)||0,full=round===Number(s?.round)&&['sealed','running'].includes(phase);
    if(!full){restoreOwnPlanning();applyPlanningAi();}
    applyRows(full?(state.authority?.plans||{}):state.rawTargets,full);
    if(full)return true;
    const committed={};
    for(const [owner,row]of Object.entries(state.ready))if(row?.ready===true&&Number(row.round)===Number(s?.round))committed[owner]=state.plans[owner]||{};
    // Targets remain a preview until the owner explicitly marks READY.
    for(const rows of Object.values(committed))for(const [index,raw]of Object.entries(rows)){
      const unit=combatantForPersistedPlan(raw);if(unit?.controlled!=='remote'||Number(raw.round)!==Number(s?.round))continue;
      unit.autoPlans[Number(raw.sourceSlotIndex??index)]=runtimePlan(raw,Number(index),unit);
    }
    scheduleRender();return true;
  }
  function trustedIndependentSources(unit){
    const live=runtime(),s=adapterState()||{},kit=live?.kit?.(unit.id)||{};
    const actions=(kit.actions||[]).map(definition=>({
      sourceType:norm(definition?.kind||definition?.sourceType)==='spell'?'spell':'skill',definition
    }));
    const spells=global.LuminousSpellCatalog?.allDefinitions?.()||{};
    for(const spellId of unit.spellIds||unit.spellSelectionIds||[]){
      const definition=spells[spellId]||global.LuminousSpellCatalog?.get?.(spellId);
      if(definition)actions.push({sourceType:'spell',definition:{...definition,id:spellId}});
    }
    const inventory=unit.inventario_activo||{};
    for(const [instanceId,item]of Object.entries(inventory)){
      if(item&&typeof item==='object'&&Number(item.quantity??1)>0)
        actions.push({sourceType:'item',definition:{...item,id:clean(item.instanceId||item.instance_id||instanceId),instanceId}});
    }
    return global.LuminousUnitIndependentActions?.sourcesFor?.(unit,{sources:actions})||[];
  }
  const stable=value=>JSON.stringify(value,function(_key,row){return row&&typeof row==='object'&&!Array.isArray(row)?Object.fromEntries(Object.keys(row).sort().map(key=>[key,row[key]])):row;});
  const activeInventory=player=>player?.inventario_activo||player?.activeInventory||player?.inventory||{};
  function inventoryDelivery(before,after,encounterId,intentId){
    const changes=[];
    for(const key of new Set([...Object.keys(before||{}),...Object.keys(after||{})])){
      if(stable(before?.[key])!==stable(after?.[key]))changes.push({key,before:clone(before?.[key]??null),after:clone(after?.[key]??null)});
    }
    return changes.length?{key:encodeURIComponent(`${encounterId}:${intentId}`).replace(/\./g,'%2E'),changes}:null;
  }
  async function finishInventory(s,playerId,intentId,receipt){
    if(!receipt.pendingInventory)return true;
    const session=global.LuminousCombatSession,delivery=receipt.inventoryDelivery;
    if(!delivery?.key||!Array.isArray(delivery.changes)||!session?.updatePath)throw Error('independent_inventory_delivery_missing');
    const saved=await session.updatePath(s.db,`campaña/jugadores/${playerId}`,player=>{
      if(!player)return;
      if(player.independentItemReceipts?.[delivery.key])return;
      const next=clone(player),inventory=clone(activeInventory(player));
      for(const {key,before,after}of delivery.changes){
        const current=inventory[key];
        // Rebase quantity consumption over unrelated inventory edits, while
        // guarding every other changed field against concurrent modification.
        if(!before||!after){
          if(stable(current??null)!==stable(before))return;
          if(after)inventory[key]=clone(after);else delete inventory[key];
          continue;
        }
        if(!current)return;
        for(const field of new Set([...Object.keys(before),...Object.keys(after)])){
          if(stable(before[field])===stable(after[field]))continue;
          if(['quantity','qty','cantidad','stack','count'].includes(field)&&Number.isFinite(before[field])&&Number.isFinite(after[field])&&Number.isFinite(current[field])){
            const value=current[field]+after[field]-before[field];if(value<0)return;current[field]=value;
          }else{
            if(stable(current[field])!==stable(before[field]))return;
            if(after[field]===undefined)delete current[field];else current[field]=clone(after[field]);
          }
        }
      }
      next.inventario_activo=inventory;next.independentItemReceipts ||= {};next.independentItemReceipts[delivery.key]=true;return next;
    });
    const player=saved.snapshot?.val();
    if(!player?.independentItemReceipts?.[delivery.key])throw Error('independent_inventory_save_pending');
    if(s.players)s.players[playerId]=clone(player);
    const finalized=await session.updateRoot(s.db,current=>{
      const row=current?.independentReceipts?.[playerId]?.[intentId];
      if(!row?.pendingInventory||row.inventoryDelivery?.key!==delivery.key)return;
      const next=clone(current);next.independentReceipts[playerId][intentId]={...row,applied:true,pendingInventory:false};
      if(next.combatants?.[row.unitId])next.combatants[row.unitId].inventario_activo=clone(activeInventory(player));
      delete next.independentReceipts[playerId][intentId].inventoryDelivery;
      return next;
    });
    if(!finalized.committed){
      const row=(await s.db.ref(`campaña/combate/independentReceipts/${playerId}/${intentId}`).once('value')).val();
      if(!row?.applied||row.pendingInventory)throw Error('independent_inventory_confirmation_pending');
    }
    return true;
  }
  async function processIndependentIntents(pendingOverride=null){
    const s=adapterState(),controller=global.LuminousUnitIndependentActions,session=global.LuminousCombatSession,authority=global.LuminousCombatAuthority073;
    if(!s?.db?.ref||!controller||!session?.updateRoot||!authority?.compactUnit||(s.role!=='dm'&&!s.isAuthority))return false;
    const pending=[];
    for(const [playerId,rows]of Object.entries(pendingOverride||state.independentIntents||{}))for(const [intentId,row]of Object.entries(rows||{}))pending.push({playerId,intentId,row});
    pending.sort((a,b)=>(Number(a.row?.createdAt)||0)-(Number(b.row?.createdAt)||0)||a.intentId.localeCompare(b.intentId));
    for(const {playerId,intentId}of pending){
      let committed=false;
      for(let attempt=0;attempt<3&&!committed;attempt++){
        const raw=(await s.db.ref('campaña/combate').once('value')).val();
        if(!raw)return false;
        if(raw.independentReceipts?.[playerId]?.[intentId]){await finishInventory(s,playerId,intentId,raw.independentReceipts[playerId][intentId]);committed=true;break;}
        const row=raw.independentIntents?.[playerId]?.[intentId];
        if(!row){committed=true;break;}
        const phase=norm(raw.estado?.phase||raw.estado?.state||raw.estado?.status||raw.estado),turn=Number(raw.estado?.round||s.round)||1;
        const sealed=['sealed','running'].includes(norm(raw.authority?.current?.phase));
        const live=runtime()?.combatants?.()||{};
        let units=Object.entries(raw.combatants||{}).map(([id,unit])=>({...clone(live[id]||{}),...clone(unit),id}));
        let unit=units.find(unit=>unit.id===clean(row.unitId)),result,inventoryBefore=null;
        if(!['planning','pre_combat_planning'].includes(phase)||sealed||Number(row.round)!==turn||row.encounterId!==(raw.estado?.encounterId||s.encounterId))result={used:false,reason:'turn_closed'};
        else if(raw.readyPlayers?.[playerId]?.ready===true&&Number(raw.readyPlayers[playerId].round)===turn)result={used:false,reason:'turn_closed'};
        else if(!unit||clean(row.playerId)!==playerId||clean(unit.canonicalPlayerKey||unit.ownerPlayerId||unit.playerId)!==playerId||clean(unit.canonicalOwnerUid||unit.ownerUid)!==clean(row.schedulerUid))result={used:false,reason:'not_owner'};
        else {
          if(norm(row.sourceType)==='item'){
            const player=(await s.db.ref(`campaña/jugadores/${playerId}`).once('value')).val();
            if(!player)throw Error('independent_player_inventory_missing');
            inventoryBefore=clone(activeInventory(player));unit.inventario_activo=clone(inventoryBefore);
          }
          await controller.prepare(units);
          if(turn===1){
            const encounterId=raw.estado?.encounterId||s.encounterId;
            if(!encounterId)throw new Error('Encounter identity is not ready');
            units=(await global.LuminousCombatEventRuntime.planEncounterStart(units,{encounterId,round:turn})).units;
            unit=units.find(entry=>entry.id===clean(row.unitId));
          }
          if(norm(row.sourceType)==='universal'){
            Object.assign(unit,controller.characterFor(unit));
            const u=global.LuminousUnitUniversalActionRuntime,key=clean(row.sourceId),variant=row.variant||null,allowed=(['analyse','find'].includes(key)&&row.cost==='free_action'&&!variant)||(key==='help'&&row.cost==='quick_action'&&variant==='mastermind_quick'),drafts=Object.fromEntries(units.map(entry=>[entry.id,entry])),plans=u?.plansFromRaw(raw),target=units.find(entry=>entry.id===clean(row.targetId));
            result=!allowed||!u?{used:false,reason:'unknown_universal_action'}:u.useInstant(unit,key,{round:turn,phase:'planning',variant,choice:row.choice,target,targetSlotIndex:row.targetSlotIndex,targetActionSlotId:row.targetSlotIndex==null?null:u.slotId(row.targetId,row.targetSlotIndex),units:drafts,plans,resolve:global.resolveUniversalFreeDraft,random:authority.random});
          }else{
          const choice=trustedIndependentSources(unit).find(candidate=>norm(candidate.sourceType)===norm(row.sourceType)&&clean(candidate.definition?.instanceId||candidate.definition?.id)===clean(row.sourceId)&&candidate.cost===row.cost);
          const target=units.find(entry=>entry.id===clean(row.targetId));
          result=!choice?{used:false,reason:'ability_not_granted'}:row.targetId&&!target?{used:false,reason:'invalid_target'}:
            controller.execute(unit,choice,{round:turn,phase:'planning',units,target,silent:true});
          }
        }
        const snapshot=result.used?Object.fromEntries(units.map(entry=>{
          if(Number(entry.speedRollTurn)===turn&&Number(entry.speedBaseRoll)>0&&runtime()?.speedForBaseRoll)entry.speed=runtime().speedForBaseRoll(entry,turn,Number(entry.speedBaseRoll));
          return [entry.id,authority.compactUnit(entry)];
        })):null;
        const delivery=result.used&&inventoryBefore?inventoryDelivery(inventoryBefore,unit.inventario_activo,row.encounterId,intentId):null;
        const expected=stable([raw.combatants,raw.estado,row,raw.readyPlayers,raw.plannedActions,raw.planningAi]);
        const transaction=await session.updateRoot(s.db,current=>{
          if(!current||current.independentReceipts?.[playerId]?.[intentId]||stable([current.combatants,current.estado,current.independentIntents?.[playerId]?.[intentId],current.readyPlayers,current.plannedActions,current.planningAi])!==expected)return;
          if(result.used&&['sealed','running'].includes(norm(current.authority?.current?.phase)))return;
          const next=clone(current);
          if(snapshot)for(const [id,canonical]of Object.entries(snapshot)){
            Object.assign(next.combatants[id],canonical);
            next.combatants[id].actionSlotIndex=Object.fromEntries(Array.from({length:canonical.actionSlots},(_,index)=>[index,true]));
          }
          next.independentReceipts ||= {};next.independentReceipts[playerId] ||= {};
          next.independentReceipts[playerId][intentId]={encounterId:row.encounterId||null,round:turn,unitId:row.unitId,sourceId:row.sourceId,cost:row.cost,applied:result.used===true&&!delivery,result:clone(result),
            ...(delivery?{pendingInventory:true,inventoryDelivery:delivery}:{})};
          if(snapshot)delete next.planningAi;
          return next;
        });
        committed=transaction.committed;
        if(committed&&delivery)await finishInventory(s,playerId,intentId,{pendingInventory:true,inventoryDelivery:delivery});
        if(committed&&snapshot)authority.applySnapshot(snapshot);
      }
      if(!committed)return false;
    }
    return true;
  }
  function scheduleIndependentIntents(pendingOverride=null){
    const retry=()=>{
      const s=adapterState();
      if((s?.role!=='dm'&&!s?.isAuthority)||state.independentRetryTimer||state.independentRetryCount>=3)return;
      state.independentRetryCount++;
      state.independentRetryTimer=global.setTimeout(()=>{state.independentRetryTimer=null;scheduleIndependentIntents();},750);
    };
    state.independentChain=state.independentChain.catch(()=>false).then(()=>processIndependentIntents(pendingOverride)).then(result=>{
      if(result)state.independentRetryCount=0;else retry();return result;
    }).catch(error=>{console.error('[Independent Actions] Persistence failed',error);retry();return false;});
    return state.independentChain;
  }
  function bind(){
    const s=adapterState();if(!s?.db?.ref||!s.user)return false;if(state.readyRef||state.authRef)return true;
    state.readyLoaded=state.plansLoaded=false;state.restoreOwn=true;
    state.readyRef=s.db.ref(READY_ROOT);state.readyHandler=snapshot=>{
      const previous=state.ready[s.playerId];state.ready=snapshot.val()||{};state.readyLoaded=true;
      const own=state.ready[s.playerId];
      if(s.role==='player'&&JSON.stringify(previous)!==JSON.stringify(own)){
        // The same character may be open on a phone and a PC. Both surfaces
        // follow the shared choice, including an explicit READY cancellation.
        state.restoreOwn=true;
        if(previous?.ready===true&&own?.ready===false&&Number(own.round)===Number(s.round)&&!runtime()?.uiState?.().running)
          runtime()?.restorePlanning?.(runtime()?.plans?.()||[],false);
      }
      state.rawTargets=rowsFromReady(state.ready);apply();
    };listen(state.readyRef,state.readyHandler,'[Combat073 TargetIntents]');
    state.authRef=s.db.ref(AUTH_ROOT);state.authHandler=snapshot=>{state.authority=snapshot.val()||{};apply();};listen(state.authRef,state.authHandler,'[Combat073 AuthorityPlans]');
    for(const [path,key]of [['definitions','definitions'],['grants','grants']]){
      listen(s.db.ref(`campaña/config/traits/${path}`),snapshot=>global.LuminousUnitIndependentActions?.configureCatalog({[key]:snapshot.val()||{}}),'[Combat Trait catalog]');
    }
    const independentRef=s.db.ref(INDEPENDENT_ROOT);
    listen(independentRef,snapshot=>{state.independentIntents=snapshot.val()||{};scheduleIndependentIntents();},'[Combat073 Independent choices]');
    for(const [path,key]of [[PLANS_ROOT,'plans'],[AI_ROOT,'planningAi']]){
      const ref=s.db.ref(path),handler=snapshot=>{state[key]=snapshot.val()||{};if(key==='plans')state.plansLoaded=true;apply();};
      listen(ref,handler,'[Combat073 Shared plans]');
    }
    return true;
  }
  function onHydrated(){state.aiAttempts=0;state.restoreOwn=true;apply();publishPlanningAi();scheduleIndependentIntents();}
  function start(){if(state.started)return true;state.started=true;const attempt=()=>{if(bind())return true;state.retryTimer=global.setTimeout(attempt,250);return false;};attempt();return true;}
  function stop(){if(state.independentRetryTimer)global.clearTimeout(state.independentRetryTimer);state.independentRetryTimer=null;if(state.aiTimer)global.clearTimeout(state.aiTimer);state.aiTimer=null;state.extraSubs.splice(0).forEach(off=>off());if(state.retryTimer)global.clearTimeout(state.retryTimer);if(state.renderTimer)global.clearTimeout(state.renderTimer);state.retryTimer=state.renderTimer=null;if(state.readyRef&&state.readyHandler)state.readyRef.off('value',state.readyHandler);if(state.authRef&&state.authHandler)state.authRef.off('value',state.authHandler);state.readyRef=state.readyHandler=state.authRef=state.authHandler=null;state.started=false;}
  global.addEventListener('luminous:combat073-hydrated',onHydrated);global.addEventListener('luminous:combat073-runtime-ready',apply);global.addEventListener('beforeunload',stop,{once:true});
  global.LuminousCombatRemoteIntents073=Object.freeze({version:'0.7.3-remote-intents.6-reentry',READY_ROOT,AUTH_ROOT,INDEPENDENT_ROOT,state,start,stop,bind,apply,processIndependentIntents,scheduleIndependentIntents,applyRows,canRenderNow,scheduleRender,rowsFromReady,runtimePlan,intentPlan,inferTargetSide,publishPlanningAi,applyPlanningAi,renderPlanLabels});
  global.addEventListener('luminous:combat073-plan-ready-change',scheduleRender);
  for(const event of ['online','focus'])global.addEventListener(event,()=>{state.independentRetryCount=0;scheduleIndependentIntents();});
  start();
})(window);
