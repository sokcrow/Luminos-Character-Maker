(function(global){
  'use strict';
  if(global.LuminousCompendiumProgression){if(typeof module!=='undefined'&&module.exports)module.exports=global.LuminousCompendiumProgression;return;}
  const FACTS=Object.freeze(['hp','sp','speed','action','targeting','resistances','equipment']);
  const BRANCHES=Object.freeze(['materials','money','quality']);
  const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
  const clean=x=>String(x??'').trim();
  function unitId(unit={}){return clean(unit.libraryUnitId||unit.canonicalUnitId||unit.definitionId||unit.unitRef?.id||unit.sourceUnitId||(!unit.combatId&&!unit.isPlayer?unit.id:'')).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');}
  function playerId(actor={}){return clean(actor.canonicalPlayerKey||actor.ownerPlayerId||actor.playerId||actor.characterLink?.playerId);}
  function knownFacts(record={}){return FACTS.filter(f=>record.known?.[f]===true);}
  function levelFromFacts(facts=[]){const n=new Set(facts.filter(f=>FACTS.includes(f))).size;return n===0?0:n>=7?5:Math.min(4,1+Math.floor(n*4/7));}
  function level(record={}){return Math.min(5,Math.max(levelFromFacts(knownFacts(record)),Math.max(0,Math.min(3,Math.trunc(Number(record.rangerFloor)||0)))));}
  function observe(record={},fact,unit={}){
    if(!FACTS.includes(fact))throw Error('OBSERVATION_FACT_INVALID');
    const next=clone(record)||{};next.encountered=true;next.known={...(next.known||{}),[fact]:true};next.schemaVersion=1;next.unitId=unitId(unit)||next.unitId;
    if(unit.name)next.name=String(unit.name);next.level=level(next);return next;
  }
  function choose(record={},slot,branch){
    slot=Number(slot);if(!Number.isInteger(slot)||slot<1||slot>level(record)||!BRANCHES.includes(branch))throw Error('COMPENDIUM_CHOICE_INVALID');
    if(record.choices?.[slot]){if(record.choices[slot]===branch)return clone(record);throw Error('COMPENDIUM_CHOICE_ALREADY_SPENT');}
    return {...clone(record),choices:{...(record.choices||{}),[slot]:branch}};
  }
  function bonuses(record={}){
    const l=level(record),points={materials:0,money:0,quality:0};
    for(let i=1;i<=l;i++)if(BRANCHES.includes(record.choices?.[i]))points[record.choices[i]]++;
    return {level:l,damagePercent:l*3,points,materialsPercent:points.materials*10,moneyPercent:points.money*10,qualityChance:points.quality*.1,unspent:l-Object.values(points).reduce((a,b)=>a+b,0)};
  }
  function favored(character,target){const ranger=global.LuminousRangerClassRuntime;return Boolean(ranger?.rangerLevel?.(character)>0&&ranger?.favoredEnemyMatches?.(character,target));}
  function withRanger(record={},character={},target={}){const next={...clone(record),rangerFloor:favored(character,target)?3:0};next.level=level(next);return next;}
  function hash(seed){let h=2166136261;for(const c of String(seed))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
  function recoveryCount(base,percent,seed){const exact=Math.max(0,Math.trunc(base))*Math.max(0,Math.min(50,Number(percent)||0))/100;return Math.trunc(base)+Math.floor(exact)+(hash(seed)%10000<Math.round((exact%1)*10000)?1:0);}
  function tier(value){if(typeof value==='number'&&Number.isInteger(value))return value;if(/^[1-5]$/.test(String(value)))return Number(value);return ({I:1,II:2,III:3,IV:4,V:5})[String(value||'').toUpperCase()]||0;}
  // This is item rarity/tier, never qualityTier. Only authored replacement pairs are eligible.
  function replacement(definition,profile={},chance=0,roll=1,resolve=()=>null){
    if(!(roll<Math.max(0,Math.min(.5,chance))))return null;
    const from=tier(definition?.tier);if(from<1||from>=5)return null;
    const cap=tier(profile.maxRewardTier);if(!cap||cap>5)return null;
    const pair=(Array.isArray(profile.observationUpgrades)?profile.observationUpgrades:[]).find(p=>p?.fromItemId===(definition.id||definition.definitionId));
    if(!pair)return null;const next=resolve(pair.toItemId);const to=tier(next?.tier);
    return next&&to===from+1&&to<=cap?next:null;
  }
  const api=Object.freeze({FACTS,BRANCHES,unitId,playerId,knownFacts,levelFromFacts,level,observe,choose,bonuses,favored,withRanger,recoveryCount,replacement,tier});
  global.LuminousCompendiumProgression=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
