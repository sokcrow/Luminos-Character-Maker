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
    return (runtime()?.kit?.(unit.id)?.actions||[]).filter(row=>row.kind==='skill');
  }
  function eligible(row){return Boolean(engine()?.isDeckEligible(row)&&engine()?.copiesForSkill(row)>0);}
  function definition(unit){return skills(unit).filter(eligible);}
  function ensure(unit,turn=runtime()?.uiState?.().round||adapter().round||1){
    const Deck=engine();if(!Deck||!unit||!['player','remote'].includes(unit.controlled))return null;
    const rows=definition(unit);if(!rows.length){delete unit.combatDeck;return null;}
    const signature=String(hash(JSON.stringify(rows))),scope=String(adapter().encounterId||'active');
    let deck=unit.combatDeck;
    if(deck?.scope==='active'&&scope!=='active')deck.scope=scope;
    if(!deck||deck.signature!==signature||deck.scope!==scope){
      const actor={id:unit.id};
      Deck.initDeck(actor,rows,{requireFull:false});
      deck=unit.combatDeck={...actor.skillDeck,signature,scope,rngState:hash(`${scope}|${unit.id}|${signature}`)};
    }
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
    Deck.onTurnStart({id:unit.id,skillDeck:deck},{round:Number(turn),slotCount:Number(unit.actionSlots)||1,random});
    return deck;
  }
  function syncAll(turn){for(const unit of Object.values(runtime()?.combatants?.()||{}))ensure(unit,turn);}
  function hand(unitId,index){
    const unit=runtime()?.combatants?.()?.[unitId];if(!ensure(unit))return[];
    return engine().getSlotHand({skillDeck:unit.combatDeck},`${unitId}_slot_${index}`);
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
  function validatePlans(plans){
    for(const rows of Object.values(plans||{}))for(const [index,plan]of Object.entries(rows||{})){
      if(plan?.kind!=='skill')continue;
      const unit=runtime()?.combatants?.()?.[plan.unitId];if(!unit)continue;
      const skill=skills(unit).find(row=>id(row)===String(plan.skillId));
      if(!eligible(skill))continue;
      const slot=Number(plan.sourceSlotIndex??index),card=hand(unit.id,slot).find(row=>row.drawId===plan.drawId&&row.skillId===plan.skillId);
      if(!card)throw new Error(`La Skill elegida por ${unit.name||'un jugador'} ya no está disponible en el Slot ${slot+1}. Debe volver a elegirla y marcar READY.`);
      plan.planType='deck';plan.actionData=copy(card.skill);
    }
    return true;
  }
  global.LuminousCombatSlotDeck073=Object.freeze({skills,eligible,definition,ensure,syncAll,hand,mark,compact,validatePlans});
  global.addEventListener('luminous:combat073-hydrated',()=>syncAll());
})(window);
