(function(global){
 'use strict';if(global.LuminousCompendiumProgressLive)return;
 const ROOT='campaña/compendium_progress',core=()=>global.LuminousCompendiumProgression;
 const clone=x=>x==null?x:JSON.parse(JSON.stringify(x)),safe=x=>String(x||'').replace(/[.#$\[\]\/]/g,'_');
 const stores=new WeakMap();let attached=null,authorityDb=null,grantBusy=false,grantAgain=false;const sightings=new Set();
 const adapter=()=>global.LuminousCombatLiveAdapter073?.state;
 function store(db){if(!stores.has(db))stores.set(db,{records:{},promise:null});return stores.get(db);}
 function watch(db){
  const s=store(db);if(s.promise)return s.promise;
  s.promise=new Promise((resolve,reject)=>{db.ref(ROOT).on('value',snapshot=>{s.records=snapshot.val()||{};resolve(s.records);global.LuminousCombat073?.refreshObservation?.();global.dispatchEvent?.(new CustomEvent('luminous:compendium-progress',{detail:{db}}));},reject);}).catch(error=>{s.promise=null;s.records={};throw error;});return s.promise;
 }
 function character(actor={}){return adapter()?.players?.[core().playerId(actor)]||actor;}
 function record(actor,target){const db=adapter()?.db,id=core().unitId(target),pid=core().playerId(actor);
  const raw=db?store(db).records?.[pid]?.units?.[id]:actor.compendiumProgress?.units?.[id];return core().withRanger(raw||{},character(actor),target);
 }
 function effectiveLevel(actor,target){return core().level(record(actor,target));}
 function knows(actor,target,fact){return record(actor,target).known?.[fact]===true;}
 function damageMultiplier(actor,target){
  if(!actor||!target||actor.faction===target.faction||!core().playerId(actor)||!core().unitId(target))return 1;
  const authority=global.LuminousCombatAuthority073?.state?.current;
  const sealed=authority?.compendiumDamage;
  if(sealed&&['sealed','running','complete'].includes(authority.phase))return 1+Math.max(0,Math.min(15,Number(sealed[core().playerId(actor)]?.[core().unitId(target)])||0))/100;
  return 1+core().bonuses(record(actor,target)).damagePercent/100;
 }
 async function damageSnapshot(db,units){
  const records=(await db.ref(ROOT).once('value')).val()||{},snapshot={};
  for(const actor of Object.values(units||{})){
   const pid=core().playerId(actor);if(!pid)continue;snapshot[pid]={};
   for(const target of Object.values(units||{})){const id=core().unitId(target);if(id&&target.faction!==actor.faction)snapshot[pid][id]=core().bonuses(core().withRanger(records[pid]?.units?.[id]||{},character(actor),target)).damagePercent;}
  }return snapshot;
 }
 async function recordObservation(db,playerId,delivery){
  const id=core().unitId(delivery.target);if(!id||!core().FACTS.includes(delivery.fact))throw Error('COMPENDIUM_OBSERVATION_INVALID');
  const tx=await db.ref(`${ROOT}/${safe(playerId)}/units/${safe(id)}`).transaction(raw=>core().observe(raw||{},delivery.fact,delivery.target),undefined,false);
  const cache=store(db);cache.records[playerId] ||= {units:{}};cache.records[playerId].units ||= {};cache.records[playerId].units[id]=tx.snapshot.val();
 }
 async function finishObservation(s,playerId,intentId,receipt){
  if(!receipt.pendingObservation)return;
  await recordObservation(s.db,playerId,receipt.observationDelivery);
  const confirmation=await global.LuminousCombatSession.updateRoot(s.db,raw=>{
   const row=raw?.independentReceipts?.[playerId]?.[intentId];if(!row?.pendingObservation)return;
   const next=clone(raw),entry=next.independentReceipts[playerId][intentId];entry.pendingObservation=false;entry.applied=!entry.pendingInventory;delete entry.observationDelivery;return next;
  });
  if(!confirmation.committed){const row=(await s.db.ref(`campaña/combate/independentReceipts/${playerId}/${intentId}`).once('value')).val();if(row?.pendingObservation)throw Error('No se pudo confirmar el progreso de observación.');}
 }
 function localObservation(actor,target,fact){if(adapter()?.db)return;actor.compendiumProgress ||= {units:{}};actor.compendiumProgress.units ||= {};const id=core().unitId(target);if(id)actor.compendiumProgress.units[id]=core().observe(actor.compendiumProgress.units[id]||{},fact,target);}
 async function choose(db,pid,unitId,slot,branch){
  if(!core().BRANCHES.includes(branch)||!Number.isInteger(slot)||slot<1||slot>5)throw Error('Elige una mejora disponible.');
  const tx=await db.ref(`${ROOT}/${safe(pid)}/units/${safe(unitId)}/choices/${slot}`).transaction(raw=>raw==null?branch:undefined,undefined,false);
  if(!tx.committed)throw Error('Esta mejora ya fue elegida. Actualiza el Compendio.');return branch;
 }
 async function syncRangers(s,units){
  if(grantBusy){grantAgain=true;return;}grantBusy=true;
  try{do{grantAgain=false;if(s.stopped)return;
   for(const [pid,player]of Object.entries(s.players||{})){
    const existing=store(s.db).records?.[pid]?.units||{};
    for(const [key,unit]of Object.entries(units||{})){
     const id=core().unitId({...unit,libraryUnitId:unit.libraryUnitId||key});if(!id)continue;
     const match=core().favored(player,unit),old=existing[id];if(!match&&!old?.rangerFloor)continue;
     if((old?.rangerFloor||0)===(match?3:0)&&old?.name===(unit.name||id))continue;
     await s.db.ref(`${ROOT}/${safe(pid)}/units/${safe(id)}`).transaction(raw=>{
      const next=core().withRanger(raw||{},player,unit);next.schemaVersion=1;next.unitId=id;next.name=unit.name||id;
      return JSON.stringify(next)===JSON.stringify(raw)?undefined:next;
     },undefined,false);
    }
   }
  }while(grantAgain);}finally{grantBusy=false;}
 }
 async function prepareLoot(db,units,party=[]){
  await watch(db);
  const ids=[...new Set(party.map(unit=>core().playerId(unit)).filter(Boolean))];
  const players=Object.fromEntries(await Promise.all(ids.map(async id=>[id,(await db.ref(`campaña/jugadores/${safe(id)}`).once('value')).val()||{}])));
  const records=(await db.ref(ROOT).once('value')).val()||{};
  return units.map(raw=>{
   const unit=clone(raw);if(core().playerId(unit)||!unit.npcBelongings?.canCarry||unit.compendiumLootSnapshot)return unit;
   let moneyPercent=0,qualityChance=0;
   for(const id of ids){const rewards=core().bonuses(core().withRanger(records[id]?.units?.[core().unitId(unit)]||{},players[id],unit));moneyPercent=Math.max(moneyPercent,rewards.moneyPercent);qualityChance=Math.max(qualityChance,rewards.qualityChance);}
   unit.compendiumLootSnapshot={schemaVersion:1,moneyPercent,qualityChance,participants:ids};
   if(unit.carriedCurrency&&unit.lootProfile?.currency?.amount==null){const base=Math.max(0,Math.trunc(Number(unit.carriedCurrency.amount)||0));unit.carriedCurrency={...unit.carriedCurrency,amount:Math.floor(base*(1+moneyPercent/100))};}
   const inventory=global.LuminousItemInventoryRuntime,resolve=id=>inventory?.resolveDefinition?.(id)||global.LuminousHpHealingCatalog?.get?.(id)||null;
   const rng=global.LuminousNpcBelongings.randomFor(`compendium:${unit.id}`);
   for(const [key,item]of Object.entries(unit.inventario_activo||{})){
    if(item.provenance?.sourceMethod!=='npc_encounter_belongings')continue;
    const definition=resolve(item.definitionId||item.id),upgrade=core().replacement(definition,unit.lootProfile,qualityChance,rng(),resolve);
    if(upgrade){
     const created=inventory.createItemInstance(upgrade,{instanceId:item.instanceId||key,quantity:item.quantity||1,currentOwnerId:unit.id,provenance:{...item.provenance,observationUpgradeFrom:definition.id}});
     unit.inventario_activo[key]={...clone(upgrade),...created};
    }
   }
   return unit;
  });
 }
 async function recordSightings(s){
  const units=global.LuminousCombat073?.combatants?.()||{};
  const party=Object.values(units).filter(u=>core().playerId(u)&&u.battleActive!==false&&!u.isBackup&&!u.escaped);
  for(const actor of party)for(const target of Object.values(units)){
   if(target.faction===actor.faction||target.battleActive===false||target.isBackup||target.escaped)continue;
   const invisible=target.statusEffects?.invisible||Object.values(target.statusEffects||{}).some(row=>row?.id==='invisible');
   if(invisible&&!(actor.detectedInvisibleIds||[]).includes(target.id))continue;
   const pid=core().playerId(actor),id=core().unitId(target);if(!id)continue;
   const key=`${s.encounterId}:${pid}:${id}`;if(sightings.has(key))continue;sightings.add(key);
   try{await s.db.ref(`${ROOT}/${safe(pid)}/units/${safe(id)}`).transaction(raw=>raw?.encountered?undefined:{...(raw||{}),schemaVersion:1,unitId:id,name:target.name||id,encountered:true,level:core().level(raw||{})},undefined,false);}catch(error){sightings.delete(key);throw error;}
  }
 }
 async function startAuthority(db){
  await watch(db);const cache=store(db);if(cache.authority)return;
  const s={db,players:{},units:{},role:'dm',stopped:false};cache.authority=s;
  const refresh=()=>{if(!s.stopped)syncRangers(s,s.units).catch(error=>global.console?.error(error));};
  s.playersRef=db.ref('campaña/jugadores');s.playersHandler=snapshot=>{s.players=snapshot.val()||{};refresh();};
  s.unitsRef=db.ref('campaña/base_datos_unidades');s.unitsHandler=snapshot=>{s.units=snapshot.val()||{};refresh();};
  s.playersRef.on('value',s.playersHandler);s.unitsRef.on('value',s.unitsHandler);
 }
 function stopAuthority(db){const cache=store(db),s=cache.authority;if(!s)return;s.stopped=true;s.playersRef.off('value',s.playersHandler);s.unitsRef.off('value',s.unitsHandler);cache.authority=null;}
 function start(){const s=adapter();if(!s?.db||!core()||(!s.user&&!s.uid&&!s.isAuthority))return;watch(s.db).catch(error=>global.console?.error(error));
  attached=s.db;
  if((s.role==='dm'||s.isAuthority)&&authorityDb!==s.db){authorityDb=s.db;s.db.ref('campaña/base_datos_unidades').on('value',snapshot=>{s.__compendiumUnits=snapshot.val()||{};syncRangers(s,s.__compendiumUnits).catch(error=>global.console?.error(error));});}
 }
 global.addEventListener?.('luminous:combat073-hydrated',()=>{start();const s=adapter();if(s?.role==='dm'||s?.isAuthority)recordSightings(s).catch(error=>global.console?.error(error));if((s?.role==='dm'||s?.isAuthority)&&s.__compendiumUnits)syncRangers(s,s.__compendiumUnits).catch(error=>global.console?.error(error));});
 global.LuminousCompendiumProgressLive=Object.freeze({ROOT,watch,record,knows,effectiveLevel,damageMultiplier,damageSnapshot,recordObservation,finishObservation,localObservation,choose,prepareLoot,syncRangers,startAuthority,stopAuthority,start});start();
})(typeof window!=='undefined'?window:globalThis);
