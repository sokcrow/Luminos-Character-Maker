/* Slot hands use the existing DeckEngine. Drawing never consumes combat RNG. */
(function(global){
  'use strict';
  if(global.LuminousCombatSlotDeck073)return;
  const engine=()=>global.LuminousDeckEngine, runtime=()=>global.LuminousCombat073;
  const adapter=()=>global.LuminousCombatLiveAdapter073?.state||{};
  const copy=value=>JSON.parse(JSON.stringify(value));
  const id=row=>String(row?.skillId||row?.id||'');
  function hash(value){let n=2166136261;for(const char of value){n^=char.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
  function skills(unit){
    return (runtime()?.kit?.(unit?.id)?.actions||[]).filter(row=>row.kind==='skill');
  }
  function eligible(row){return Boolean(engine()?.isDeckEligible(row)&&engine()?.copiesForSkill(row)>0);}
  function definition(unit){return skills(unit).filter(eligible);}
  function ensure(unit,turn=runtime()?.uiState?.().round||adapter().round||1){
    const Deck=engine();if(!Deck||!unit||unit.battleActive===false||unit.isBackup===true||unit.escaped===true)return null;
    const rows=definition(unit);if(!rows.length){delete unit.combatDeck;return null;}
    const activeMode=global.LuminousEquipmentLoadouts?.active?.(unit,unit);
    const modeKey=activeMode?activeMode.instanceId+":"+activeMode.modeId:"canonical";
    const savedSelection=unit.characterBuild?.skillDeck||unit.skillDeck;
    const deckEntries=modeKey==='canonical'&&Number(savedSelection?.schemaVersion)>=2
      ?Object.values(savedSelection.entries||{}):null;
    // Menu annotations and refreshed Skill text/effects do not rebuild a hand.
    // Only its card composition changes the deterministic draw sequence.
    const composition=rows.map(row=>({id:id(row),tier:Deck.tierOf(row),copies:Deck.copiesForSkill(row)}));
    const signature=String(hash(JSON.stringify({rows:composition,deckEntries}))),scope=String(adapter().encounterId||'active');
    const cache=unit.combatDeckModes||(unit.combatDeckModes={});
    let deck=unit.combatDeck;
    if(deck?.scope==='active'&&scope!=='active')deck.scope=scope;
    if(deck&&deck.modeKey&&deck.modeKey!==modeKey)cache[deck.modeKey]=deck;
    if(!deck||deck.signature!==signature||deck.scope!==scope||deck.modeKey!==modeKey){
      const saved=cache[modeKey];
      if(saved&&saved.signature===signature&&(saved.scope===scope||saved.scope==="active")){
        deck=unit.combatDeck=saved;
        deck.scope=scope;
      }else{
        const actor={id:unit.id};
        try{Deck.initDeck(actor,rows,deckEntries?{requireFull:true,deckEntries}:{requireFull:false,
          capacity:Math.max(Deck.DEFAULT_CAPACITY,rows.reduce((sum,row)=>sum+Deck.copiesForSkill(row),0)),
          maxUniqueSkills:Math.max(Deck.DEFAULT_MAX_UNIQUE_SKILLS,rows.length)});}
        catch(error){console.warn('[LuminousDeck] V2 inválido; no se usarán cartas no autorizadas.',error?.message);delete unit.combatDeck;return null;}
        deck=unit.combatDeck={...actor.skillDeck,signature,scope,modeKey,
          rngState:hash(scope+"|"+unit.id+"|"+signature)};
      }
    }
    cache[modeKey]=deck;
    const byId=new Map(rows.map(row=>[id(row),row]));
    // RTDB removes empty arrays/objects. An exhausted draw pile comes back
    // without a drawPile property; restore it before DeckEngine inspects it.
    const cards=value=>Array.isArray(value)?value:Object.values(value||{});
    deck.slots=deck.slots||{};
    for(const slot of Object.values(deck.slots)){
      slot.hand=cards(slot.hand);slot.drawPile=cards(slot.drawPile);
    }
    for(const card of deck.definition.cards)card.skill=byId.get(card.skillId);
    for(const slot of Object.values(deck.slots||{}))for(const card of [...(slot.hand||[]),...(slot.drawPile||[])])card.skill=byId.get(card.skillId);
    const random=()=>{
      deck.rngState=(Number(deck.rngState)+0x6D2B79F5)>>>0;
      let n=deck.rngState;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);
      return((n^(n>>>14))>>>0)/4294967296;
    };
    // A checkpoint can arrive before the local UI's round label catches up.
    // Reading that hand must never age it backwards into the previous round.
    const deckRound=Math.max(Number(turn)||1,Number(deck.lastTurnStartRound)||1);
    Deck.onTurnStart({id:unit.id,skillDeck:deck},{round:deckRound,slotCount:unit.actionSlots??unit.activeSlots??1,random});
    return deck;
  }
  function syncAll(turn){for(const unit of Object.values(runtime()?.combatants?.()||{}))ensure(unit,turn);}
  function hand(unitId,index){
    const unit=runtime()?.combatants?.()?.[unitId];if(!ensure(unit))return[];
    return engine().getSlotHand({skillDeck:unit.combatDeck},`${unitId}_slot_${index}`);
  }
  // Human menus and automatic planners share the same legal Skill options.
  // Untiered legacy NPC actions remain usable only without an explicit V2 deck.
  function actionOptions(unitId,index,actions=runtime()?.kit?.(unitId)?.actions||[]){
    const unit=runtime()?.combatants?.()?.[unitId];if(!unit)return[];
    const selection=unit.characterBuild?.skillDeck||unit.skillDeck;
    const explicit=Number(selection?.schemaVersion)>=2;
    const permanent=actions.filter(row=>row.kind!=='skill'||(!eligible(row)&&
      (!explicit||!engine()?.isDeckEligible(row))));
    return [...hand(unitId,index).map(card=>({...card.skill,__deckCard:{drawId:card.drawId,slotIndex:Number(index)}})),...permanent];
  }
  function mark(entry){
    const unit=runtime()?.combatants?.()?.[entry?.ownerId];
    if(!entry?.plan?.drawId||!ensure(unit))return false;
    return engine().markCardUsed({skillDeck:unit.combatDeck},`${unit.id}_slot_${entry.localIndex}`,entry.plan.drawId).used;
  }
  function compact(deck){
    if(!deck)return null;const value=copy(deck);
    for(const card of value.definition?.cards||[])delete card.skill;
    for(const slot of Object.values(value.slots||{}))for(const card of [...(slot.hand||[]),...(slot.drawPile||[])])delete card.skill;
    return value;
  }
  function compactModeDecks(value){return Object.fromEntries(
    Object.entries(value||{}).map(([key,deck])=>[key,compact(deck)]));}
  function validatePlans(plans){
    for(const rows of Object.values(plans||{}))for(const [index,plan]of Object.entries(rows||{})){
      if(plan?.kind!=='skill')continue;
      const unit=runtime()?.combatants?.()?.[plan.unitId];if(!unit)continue;
      const skill=skills(unit).find(row=>id(row)===String(plan.skillId));
      if(!skill)throw new Error(`La habilidad elegida por ${unit.name||'la unidad'} ya no está equipada.`);
      const selection=unit.characterBuild?.skillDeck||unit.skillDeck;
      if(!eligible(skill)&&!(Number(selection?.schemaVersion)>=2&&engine()?.isDeckEligible(skill)))continue;
      const slot=Number(plan.sourceSlotIndex??index),card=hand(unit.id,slot).find(row=>row.drawId===plan.drawId&&row.skillId===plan.skillId);
      if(!card)throw new Error(`La Skill elegida por ${unit.name||'la unidad'} ya no está disponible en el Slot ${slot+1}. Debe volver a elegirla y marcar READY.`);
      plan.planType='deck';plan.actionData=copy(card.skill);
    }
    return true;
  }
  global.LuminousCombatSlotDeck073=Object.freeze({skills,eligible,definition,ensure,syncAll,hand,actionOptions,mark,compact,compactModeDecks,validatePlans});
  global.addEventListener('luminous:combat073-hydrated',()=>syncAll());
})(window);
