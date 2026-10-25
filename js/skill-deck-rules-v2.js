/* Skill Deck V2: explicit cards and a ten-point budget. Legacy 3/2/1 stays readable. */
(function(global,factory){
  "use strict";
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(global)global.LuminousSkillDeckRulesV2=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  const VERSION=2,CAPACITY=10;
  const LIMITS=Object.freeze({1:3,2:2,3:1});
  const id=value=>String(value??"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  const clean=value=>String(value??"").trim();
  const tier=value=>{
    const raw=clean(value).toUpperCase();
    return raw==="I"?1:raw==="II"?2:raw==="III"?3:([1,2,3].includes(Number(raw))?Number(raw):null);
  };
  function normalizeDeck(raw={}){
    const source=raw&&typeof raw==="object"?raw:{};
    let entries=[];
    if(Number(source.schemaVersion)>=VERSION&&Array.isArray(source.entries)){
      entries=source.entries.map((value,i)=>({
        entryId:clean(value?.entryId)||"entry_"+(i+1),
        skillId:id(value?.skillId||value?.id),
        tier:tier(value?.tier)
      }));
    }else{
      const legacy=[
        [source.tier1??source.t1??source["1"]??source.skill1,1,3],
        [source.tier2??source.t2??source["2"]??source.skill2,2,2],
        [source.tier3??source.t3??source["3"]??source.skill3,3,1]
      ];
      for(const [rawId,level,copies] of legacy){
        const skillId=id(rawId);if(!skillId)continue;
        for(let i=0;i<copies;i++)entries.push({entryId:"legacy_"+level+"_"+(i+1),skillId,tier:level});
      }
    }
    return {schemaVersion:VERSION,capacity:CAPACITY,entries};
  }
  const slotIds=raw=>normalizeDeck(raw).entries.map(row=>row.skillId).filter(Boolean);
  const points=raw=>normalizeDeck(raw).entries.reduce((sum,row)=>sum+(tier(row.tier)||0),0);
  function validateDeck(raw,available=[],options={}){
    const deck=normalizeDeck(raw),problems=[];
    const known=new Map((Array.isArray(available)?available:[]).map(s=>[id(s?.id||s?.skillId),s]));
    const perSkill=new Map(),entries=new Set();let tier3=0,spent=0;
    for(const entry of deck.entries){
      const name=entry.skillId,level=tier(entry.tier),skill=known.get(name);
      if(!name||!level){problems.push("Carta del Deck sin Skill o Tier válido.");continue;}
      if(entries.has(entry.entryId)){problems.push("Hay cartas con identificadores duplicados.");continue;}
      entries.add(entry.entryId);
      spent+=level;
      if(level===3)tier3++;
      const count=(perSkill.get(name)||0)+1;perSkill.set(name,count);
      if(count>LIMITS[level])problems.push("Se excedió el límite de copias de "+name+".");
      if(!skill){problems.push("La Skill "+name+" no está aprendida o disponible.");continue;}
      if(tier(skill.tier??skill.skillTier)!==level)problems.push("El Tier de "+name+" no coincide con el catálogo.");
      const defensive=skill.isDefense===true||clean(skill.type).toLowerCase()==="defense"||
        Boolean(clean(skill.defenseType||skill.defenseSubtype));
      const availability=clean(skill.availability?.type||skill.availabilityType).toLowerCase();
      if(defensive||skill.deck?.enabled===false||skill.inDeck===false||
        ["granted","free","off_deck","offdeck","defensive","defense"].includes(availability)){
        problems.push("La Skill "+name+" se utiliza fuera del Deck.");
      }
    }
    if(tier3>1)problems.push("Solo se permite una Skill Tier III en todo el Deck.");
    if(spent>CAPACITY)problems.push("El Deck supera los "+CAPACITY+" puntos.");
    if(options.requireFull!==false&&spent!==CAPACITY)problems.push("Completa "+CAPACITY+" puntos para guardar el Deck.");
    return {valid:!problems.length,errors:[...new Set(problems)],deck,spent,remaining:CAPACITY-spent,tier3};
  }
  function addCard(raw,skill,available=[]){
    const deck=normalizeDeck(raw),skillId=id(skill?.id||skill?.skillId),level=tier(skill?.tier??skill?.skillTier);
    if(!skillId||!level)return {valid:false,errors:["Skill sin Tier válido."],deck};
    const used=new Set(deck.entries.map(row=>row.entryId));
    let serial=1;while(used.has("card_"+serial))serial++;
    deck.entries.push({entryId:"card_"+serial,skillId,tier:level});
    return validateDeck(deck,available,{requireFull:false});
  }
  function removeCard(raw,entryId){
    const deck=normalizeDeck(raw);
    deck.entries=deck.entries.filter(row=>row.entryId!==clean(entryId));
    return deck;
  }
  return Object.freeze({VERSION,CAPACITY,LIMITS,id,tier,normalizeDeck,slotIds,points,validateDeck,addCard,removeCard});
});