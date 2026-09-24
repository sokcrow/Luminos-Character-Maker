(function(global){
  'use strict';
  if(global.LuminousCombatEconomyReviewFixes073)return;

  const VERSION='0.7.3-economy-review-fixes.1';
  const ECONOMY=Object.freeze({ACTION:'action',QUICK:'quick_action',REACTION:'reaction'});
  const state={installed:false,originalPlayerDeckForUnit:null,pendingTraitTarget:null,triggerPoll:null,lastWrappedTrigger:null};
  const clean=v=>String(v??'').trim();
  const norm=v=>clean(v).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  const arr=v=>v==null?[]:(Array.isArray(v)?v:[v]);
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

  function lexical(name,fallback=null){try{return typeof global.eval==='function'?(global.eval(`typeof ${name} !== 'undefined' ? ${name} : undefined`)??fallback):fallback}catch(_){return fallback}}
  function assign(name,expr){try{global.eval(`${name} = ${expr}`);return true}catch(error){console.error(`[CombatEconomyReviewFixes073] ${name}`,error);return false}}
  function api(){return global.LuminousCombatEconomyMenu073||null}
  function economy(){return global.LuminousActionEconomy||null}
  function playerId(){return clean(lexical('PLAYER_ID',global.LuminousCombat073?.playerId?.()||''))}
  function combatData(){return lexical('combatData',global.LuminousCombat073?.combatants?.()||{})||{}}
  function playerUnit(){const id=playerId();return id?combatData()?.[id]||null:null}
  function unitKits(){return lexical('UNIT_KITS',{})||{}}
  function permanent(){return lexical('permanent',{})||{}}
  function roundNumber(){return Math.max(1,Number(lexical('round',1))||1)}
  function activeMenu(){return clean(lexical('activeMenu',''))}

  function explicitEconomyValue(source={}){
    return source?.economyCost??source?.economy_cost??source?.economy?.cost??source?.actionCost??source?.action_cost??source?.activation?.actionCost??source?.activation?.action_cost??source?.activationCost??source?.activation_cost??null;
  }
  function canonicalCost(source={},fallback=ECONOMY.ACTION){
    const explicit=explicitEconomyValue(source);
    const raw=norm(explicit!=null?explicit:(source?.castingTime??source?.casting_time??fallback));
    if(['quick','quickaction','quick_action','bonus','bonus_action','bonusaction'].includes(raw))return ECONOMY.QUICK;
    if(['reaction','react','reactive'].includes(raw))return ECONOMY.REACTION;
    if(['none','free','free_action','automatic','passive','special'].includes(raw))return raw;
    return ECONOMY.ACTION;
  }
  function annotateSource(row){
    if(!row||typeof row!=='object'||explicitEconomyValue(row)!=null)return row;
    const casting=norm(row.castingTime??row.casting_time??'');
    if(['quick','quickaction','quick_action','bonus','bonus_action','bonusaction'].includes(casting))row.economyCost=ECONOMY.QUICK;
    else if(['reaction','react','reactive'].includes(casting))row.economyCost=ECONOMY.REACTION;
    else if(['action','1_action','standard_action'].includes(casting))row.economyCost=ECONOMY.ACTION;
    return row;
  }
  function annotateEconomySources(){
    Object.values(unitKits()).forEach(kit=>arr(kit?.actions).forEach(annotateSource));
    const p=permanent();arr(p?.spells).forEach(annotateSource);arr(p?.granted).forEach(annotateSource);arr(p?.global).forEach(annotateSource);
    return true;
  }

  function filteredPlayerDeckForUnit(id){
    annotateEconomySources();
    const rows=arr(unitKits()?.[id]?.actions).filter(row=>['skill','spell'].includes(norm(row?.kind||row?.type||row?.actionType))&&canonicalCost(row)===ECONOMY.ACTION);
    return rows.slice(0,3).map((row,index)=>({...row,tier:index+1}));
  }
  function refreshPlayerDeck(){
    try{const reset=lexical('resetPlayerDeckForUnit',null);if(typeof reset==='function'&&playerId())reset(playerId())}catch(_){}
  }

  function actionTraits(){
    const menu=api();
    return arr(menu?.traitDefinitionsForPlayer?.()).filter(row=>canonicalCost(row)===ECONOMY.ACTION);
  }
  function withActionTraits(callback){
    const p=permanent(),original=Array.isArray(p?.global)?p.global:[];
    if(!p||!Array.isArray(original))return callback();
    const seen=new Set(original.map(row=>norm(row?.id||row?.traitId||row?.actionKey||row?.name)));
    const extras=actionTraits().filter(row=>{const id=norm(row?.id||row?.traitId||row?.name);if(!id||seen.has(id))return false;seen.add(id);return true});
    p.global=[...original,...extras];
    try{return callback()}finally{p.global=original}
  }

  function renderCleanList(){
    const menu=api();
    if(activeMenu()==='global'&&(menu?.state?.tabByMenu?.global||ECONOMY.ACTION)===ECONOMY.ACTION){
      return withActionTraits(()=>menu?.state?.originals?.renderCleanList?.());
    }
    return menu?.renderCleanList?.();
  }
  function renderSkills(){
    const menu=api(),tab=menu?.state?.tabByMenu?.skills||ECONOMY.ACTION;
    if(tab!==ECONOMY.ACTION)return menu?.renderSkills?.();
    annotateEconomySources();
    const p=permanent(),original=Array.isArray(p?.granted)?p.granted:[];
    if(p&&Array.isArray(original))p.granted=original.filter(row=>canonicalCost(row)===ECONOMY.ACTION);
    try{return menu?.state?.originals?.renderSkills?.()}finally{if(p&&Array.isArray(original))p.granted=original}
  }
  function selectAction(sel){
    const menu=api(),source=sel?.data||{};
    if(canonicalCost(source)===ECONOMY.ACTION&&norm(source.kind)==='trait'&&sel?.type==='global'){
      return menu?.state?.originals?.selectAction?.({...sel,type:'trait'});
    }
    return menu?.selectAction?.(sel);
  }

  function targetAllegiance(source={}){
    const raw=norm(source.targeting?.allegiance||source.activation?.target||source.targetSide||(source.targetAlly===true?'ally':''));
    if(['self','ally','allies','friendly','neutral','any'].includes(raw))return raw==='allies'||raw==='friendly'?'ally':raw;
    return 'enemy';
  }
  function traitNeedsTarget(source={}){
    const allegiance=targetAllegiance(source),mode=norm(source.targeting?.mode||source.targetType||source.targetingType||source.activation?.target||'self');
    return allegiance!=='self'&&mode!=='self';
  }
  function traitCandidates(source={}){
    const actor=playerUnit(),allegiance=targetAllegiance(source);if(!actor)return[];
    if(allegiance==='self')return[actor];
    return Object.values(combatData()).filter(candidate=>{
      if(!candidate||candidate.dead||candidate.defeated||candidate.battleActive===false||Number(candidate.hp)<=0)return false;
      if(allegiance==='neutral'||allegiance==='any')return candidate.id!==actor.id;
      return allegiance==='ally'?candidate.faction===actor.faction:candidate.faction!==actor.faction;
    });
  }
  function compileTraitAction(sel,targetId=null){
    const actor=playerUnit(),adapters=global.LuminousCombatActionAdapters,schema=global.LuminousCombatAction,source=sel?.data||{};
    if(!actor||!adapters?.compileTraitToCombatAction||!schema)return null;
    return adapters.compileTraitToCombatAction(actor,source,{actorId:clean(actor.id),sourceId:source.id||source.traitId,targetId,mainTargetId:targetId,targetIds:targetId?[targetId]:[],allegiance:targetAllegiance(source),cost:ECONOMY.QUICK,selectedAt:schema.PHASES.PLANNING_PHASE_PLAYER,executesAt:schema.PHASES.PLANNING_PHASE_PLAYER,metadata:{viewer073EconomyReviewFix:true,sourceDefinition:clone(source)}});
  }
  function traitRuntimeContext(source,target,action,phase){
    const actor=playerUnit(),eco=economy();
    return {context:'combat',character:actor,self:actor,actor,target,combatAction:action,actionEconomy:{canUse(cost){return eco?.availability?.(actor,cost,{phase})?.available!==false}}};
  }
  function traitState(source){
    const menu=api(),engine=global.LuminousTraitEngine,id=norm(source.id||source.traitId||source.name);
    let value=menu?.state?.traitStateById?.get?.(id);
    if(!value){value=engine?.createState?.()||{usages:{},ruleScopes:{},counters:{}};menu?.state?.traitStateById?.set?.(id,value)}
    return value;
  }
  function status(message){try{lexical('setStatus',()=>{})(message)}catch(_){} }
  function closeToRoot(){try{lexical('goRoot',()=>{})()}catch(_){} }
  function finishTraitQuickTargeting(){
    state.pendingTraitTarget=null;
    global.document?.getElementById?.('game-container')?.classList.remove('economy-targeting');
    global.document?.querySelectorAll?.('.sprite-container.economy-target-candidate')?.forEach(node=>node.classList.remove('economy-target-candidate'));
  }
  function executeTraitQuick(sel,targetId=null){
    const source=sel?.data||{},actor=playerUnit(),eco=economy(),engine=global.LuminousTraitEngine;
    if(!actor||!eco||!engine?.canActivateTrait||!engine?.activateTrait){status('QUICK ACTION · TRAIT RUNTIME UNAVAILABLE');return false}
    const gate=eco.availability?.(actor,ECONOMY.QUICK,{phase:'planning'});if(gate?.available===false){status(`QUICK ACTION · ${gate.reason||'UNAVAILABLE'}`);return false}
    const target=targetId?combatData()?.[targetId]||null:actor,action=compileTraitAction(sel,targetId),runtime=traitRuntimeContext(source,target,action,'planning'),tState=traitState(source);
    const check=engine.canActivateTrait(source,runtime,tState);
    if(!check?.available){status(`QUICK ACTION · ${(check?.reasons||['TRAIT UNAVAILABLE']).join(' · ')}`);return false}
    const generic=arr(source.effects).length>0||arr(source.rules).length>0;
    let external=null;
    if(!generic){
      const detail={version:VERSION,action,source:clone(source),sourceType:'trait',targetId,handled:false,result:null,preflight:check};
      try{global.dispatchEvent(new CustomEvent('luminous:combat073-quick-action-request',{detail}))}catch(_){}
      if(!detail.handled){status(`QUICK ACTION · ${source.name||source.id||'Trait'} · RUNTIME NOT CONNECTED`);return false}
      external=detail.result;
    }
    const activation=engine.activateTrait(source,runtime,tState);
    if(!activation?.available){status(`QUICK ACTION · ${(activation?.reasons||['TRAIT ACTIVATION FAILED']).join(' · ')}`);return false}
    if(!eco.consume(actor,ECONOMY.QUICK,{phase:'planning'})){status('QUICK ACTION · SPEND FAILED');return false}
    if(api()?.state)api().state.quickSpentRound=roundNumber();
    api()?.syncQuickBadge?.();api()?.syncTabs?.();
    status(`QUICK ACTION · ${source.name||source.id||'Trait'} · USED`);
    try{global.dispatchEvent(new CustomEvent('luminous:combat073-quick-action-resolved',{detail:{version:VERSION,action,result:external??activation}}))}catch(_){}
    closeToRoot();return true;
  }
  function beginTraitQuick(sel){
    const source=sel?.data||{};
    if(!traitNeedsTarget(source))return executeTraitQuick(sel,playerId());
    const candidates=traitCandidates(source);if(!candidates.length){status(`QUICK ACTION · ${source.name||source.id||'Trait'} · NO VALID TARGETS`);return false}
    state.pendingTraitTarget={sel,candidateIds:new Set(candidates.map(unit=>clean(unit.id)))};
    global.document?.getElementById?.('game-container')?.classList.add('economy-targeting');
    candidates.forEach(unit=>global.document?.getElementById?.(`token-${unit.id}`)?.classList.add('economy-target-candidate'));
    status(`QUICK ACTION · ${source.name||source.id||'Trait'} · SELECT TARGET`);return true;
  }

  function onCaptureClick(event){
    if(state.pendingTraitTarget){
      const token=event.target?.closest?.('.sprite-container');if(!token)return;
      const targetId=clean(token.id).replace(/^token-/,'');if(!state.pendingTraitTarget.candidateIds.has(targetId))return;
      event.preventDefault();event.stopImmediatePropagation();const pending=state.pendingTraitTarget;finishTraitQuickTargeting();executeTraitQuick(pending.sel,targetId);return;
    }
    const confirm=event.target?.closest?.('#economy-action-confirm');if(!confirm)return;
    const sel=lexical('selected',null),source=sel?.data||{};
    if(sel?.type!=='trait'||canonicalCost(source)!==ECONOMY.QUICK)return;
    event.preventDefault();event.stopImmediatePropagation();beginTraitQuick(sel);
  }

  function reactionTriggerIds(source={}){
    const raw=source.reaction?.trigger??source.reactionTrigger??source.reaction_trigger??source.trigger??source.activation?.trigger??source.activation?.reactionTrigger??null;
    return arr(raw).flatMap(value=>typeof value==='object'?[value.id,value.type,value.event,value.trigger]:[value]).map(norm).filter(Boolean);
  }
  function tagId(tag){return norm(String(tag||'').replace(/^\[/,'').replace(/\]$/,''))}
  function matchesPreparedTrigger(source,tag){const ids=reactionTriggerIds(source);return ids.length>0&&ids.includes(tagId(tag))}

  function onReactionTrigger(event){
    const detail=event?.detail;if(!detail||detail.handled||detail.sourceType!=='trait')return;
    const source=detail.source||{},actor=playerUnit(),eco=economy(),engine=global.LuminousTraitEngine;if(!actor||!eco||!engine?.canActivateTrait||!engine?.activateTrait)return;
    const targetId=clean(detail.context?.targetId||detail.context?.context?.target?.id||detail.context?.context?.defender?.id||''),target=targetId?combatData()?.[targetId]||null:detail.context?.context?.target||detail.context?.context?.defender||actor;
    const tState=traitState(source),runtime=traitRuntimeContext(source,target,detail.action,'combat');
    const check=engine.canActivateTrait(source,runtime,tState);if(!check?.available){detail.result={available:false,reasons:check?.reasons||[]};return}
    const generic=arr(source.effects).length>0||arr(source.rules).length>0;if(!generic)return;
    const activation=engine.activateTrait(source,runtime,tState);if(!activation?.available)return;
    const trigger=tagId(detail.context?.tag||detail.context?.trigger||'');
    if(trigger&&trigger!=='on_use'){
      try{const extra=engine.dispatchTrait?.(source,trigger,runtime,tState);if(extra?.outcomes?.length)activation.triggerOutcomes=extra.outcomes}catch(_){}
    }
    detail.handled=true;detail.result=activation;
  }
  function maybeTriggerPrepared(tag,context,targetsHit){
    const menu=api(),prepared=menu?.state?.preparedReaction;if(!prepared?.sel?.data)return;
    if(!matchesPreparedTrigger(prepared.sel.data,tag))return;
    menu.triggerPreparedReaction?.({tag,trigger:tagId(tag),context,targetsHit});
  }
  function installCombatTriggerBridge(){
    const engine=global.CombatEngine;if(!engine||typeof engine.triggerEvent!=='function')return false;
    if(engine.triggerEvent.__luminousEconomyReactionBridge)return true;
    const original=engine.triggerEvent;
    function wrapped(tag,context,targetsHit=[]){
      maybeTriggerPrepared(tag,context,targetsHit);
      return original.call(this,tag,context,targetsHit);
    }
    Object.defineProperty(wrapped,'__luminousEconomyReactionBridge',{value:true});
    Object.defineProperty(wrapped,'__luminousEconomyReactionOriginal',{value:original});
    engine.triggerEvent=wrapped;state.lastWrappedTrigger=wrapped;return true;
  }

  function installLexicalPatches(){
    const menu=api();if(!menu?.state?.originals)return false;
    annotateEconomySources();
    state.originalPlayerDeckForUnit=state.originalPlayerDeckForUnit||lexical('playerDeckForUnit',null);
    assign('playerDeckForUnit','window.LuminousCombatEconomyReviewFixes073.filteredPlayerDeckForUnit');
    assign('renderCleanList','window.LuminousCombatEconomyReviewFixes073.renderCleanList');
    assign('renderSkills','window.LuminousCombatEconomyReviewFixes073.renderSkills');
    assign('selectAction','window.LuminousCombatEconomyReviewFixes073.selectAction');
    refreshPlayerDeck();return true;
  }
  function install(){
    if(state.installed)return true;if(!api())return false;
    installLexicalPatches();
    global.document?.addEventListener?.('click',onCaptureClick,true);
    global.addEventListener?.('luminous:combat073-reaction-trigger',onReactionTrigger);
    global.addEventListener?.('luminous:combat073-hydrated',()=>{annotateEconomySources();installLexicalPatches();installCombatTriggerBridge()});
    installCombatTriggerBridge();
    state.triggerPoll=global.setInterval?.(()=>installCombatTriggerBridge(),500)||null;
    state.installed=true;return true;
  }

  const reviewApi={version:VERSION,state,canonicalCost,annotateEconomySources,filteredPlayerDeckForUnit,renderCleanList,renderSkills,selectAction,executeTraitQuick,beginTraitQuick,reactionTriggerIds,matchesPreparedTrigger,installCombatTriggerBridge,install};
  global.LuminousCombatEconomyReviewFixes073=Object.freeze(reviewApi);
  global.setTimeout?.(install,0);
  if(typeof module!=='undefined'&&module.exports)module.exports=reviewApi;
})(typeof window!=='undefined'?window:globalThis);
