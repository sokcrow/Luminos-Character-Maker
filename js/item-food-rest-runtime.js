(function (global) {
  "use strict";

  if (global.LuminousFoodRestRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousFoodRestRuntime;
    return;
  }

  const VERSION=1;
  const SHORT_REST_COOLDOWN_HOURS=2;
  const LONG_REST_SLEEP_HOURS=8;

  function safeRequire(path) {
    if (typeof require!=="function") return null;
    try { return require(path); } catch(_) { return null; }
  }
  function cooking(){ return global.LuminousCookingEngine || safeRequire("./item-cooking-engine.js"); }
  function inventory(){ return global.LuminousItemInventoryRuntime || safeRequire("./item-inventory-runtime.js"); }
  function itemRuntime(){ return global.LuminousItemRuntime || safeRequire("./item-runtime-engine.js"); }
  function normalizeId(value){ return String(value??"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,""); }
  function clone(value){ return value==null?value:JSON.parse(JSON.stringify(value)); }
  function objectEntries(value){
    if(Array.isArray(value)) return value.map((item,index)=>[String(index),item]);
    return value&&typeof value==="object"?Object.entries(value):[];
  }
  function quantityOf(item={}){
    const raw=Number(item.quantity ?? item.qty ?? item.cantidad ?? item.stack ?? item.count ?? 1);
    return Math.max(0,Number.isFinite(raw)?Math.trunc(raw):0);
  }
  function itemId(item={}){
    return String(item.instanceId || item.instance_id || item.definitionId || item.itemId || item.id || item.key || "").trim();
  }

  function ensureState(unit={}) {
    if(!unit.culinarySurvival || typeof unit.culinarySurvival!=="object") unit.culinarySurvival={};
    const state=unit.culinarySurvival;
    const maxHunger=Math.max(1,Math.trunc(Number(state.maxHungerSlots ?? cooking()?.MEDIUM_HUNGER_SLOTS ?? 3)||3));
    const maxHydration=Math.max(1,Math.trunc(Number(state.maxHydrationSlots ?? cooking()?.MEDIUM_HYDRATION_SLOTS ?? 3)||3));
    state.maxHungerSlots=maxHunger;
    state.maxHydrationSlots=maxHydration;
    if(!Number.isFinite(Number(state.hungerSlots))) state.hungerSlots=maxHunger;
    if(!Number.isFinite(Number(state.hydrationSlots))) state.hydrationSlots=maxHydration;
    state.hungerSlots=Math.max(0,Math.min(maxHunger,Math.trunc(Number(state.hungerSlots)||0)));
    state.hydrationSlots=Math.max(0,Math.min(maxHydration,Math.trunc(Number(state.hydrationSlots)||0)));
    state.decayAccumulatorHours=Math.max(0,Number(state.decayAccumulatorHours)||0);
    state.completedRequiredLongRest=state.completedRequiredLongRest===true;
    return state;
  }

  function itemTags(item={}) {
    return [
      ...(Array.isArray(item.tags)?item.tags:[]),
      ...(Array.isArray(item.itemTags)?item.itemTags:[]),
      item.family,item.category,item.itemType,item.dishFamily
    ].map(normalizeId).filter(Boolean);
  }

  function isFood(item={}) {
    const tags=itemTags(item);
    return normalizeId(item.category)==="food" ||
      normalizeId(item.family)==="food" ||
      tags.includes("food") ||
      Number(item.hungerSlotsRestored)>0 ||
      Number(item.hydrationSlotsRestored)>0 ||
      Array.isArray(item.culinaryEffects);
  }

  function foodProfile(item={}) {
    return Object.freeze({
      hungerSlotsRestored:Math.max(0,Math.trunc(Number(item.hungerSlotsRestored ?? item.defaultHungerSlotsRestored ?? 0)||0)),
      hydrationSlotsRestored:Math.max(0,Math.trunc(Number(item.hydrationSlotsRestored ?? item.defaultHydrationSlotsRestored ?? 0)||0)),
      spRestore:Number.isFinite(Number(item.spRestore ?? item.sp)) ? Number(item.spRestore ?? item.sp) : 0,
      culinaryEffects:Object.freeze((Array.isArray(item.culinaryEffects)?item.culinaryEffects:[]).map(clone)),
      taste:Number.isFinite(Number(item.taste))?Number(item.taste):null,
      stars:Number.isFinite(Number(item.stars))?Number(item.stars):null,
    });
  }

  function locateFood(unit={},ref,options={}) {
    if(ref && typeof ref==="object") {
      for(const [containerType,container] of [
        ["active",unit.inventario_activo || unit.activeInventory || unit.inventory || unit.inventario],
        ["stash",unit.inventario_stash || unit.stashInventory || unit.stash]
      ]) {
        for(const [key,item] of objectEntries(container)) if(item===ref) return {item,container,key,containerType};
      }
      return {item:ref,container:null,key:null,containerType:null};
    }
    const wanted=String(ref??"").trim();
    if(!wanted) return null;
    const inv=inventory();
    for(const [containerType,container] of [
      ["active",inv?.activeContainer?.(unit,false)?.value || unit.inventario_activo || unit.activeInventory || unit.inventory || unit.inventario],
      ["stash",inv?.stashContainer?.(unit,false)?.value || unit.inventario_stash || unit.stashInventory || unit.stash]
    ]) {
      for(const [key,item] of objectEntries(container)) {
        if(!item) continue;
        const ids=[key,itemId(item),item.definitionId,item.itemId,item.id].map(v=>String(v??"").trim());
        if(ids.includes(wanted)) return {item,container,key,containerType};
      }
    }
    return null;
  }

  function deleteEntry(container,key,item) {
    if(!container) return;
    if(Array.isArray(container)) {
      const index=Number(key);
      if(Number.isInteger(index)&&index>=0&&index<container.length) container.splice(index,1);
      else {
        const found=container.indexOf(item);
        if(found>=0) container.splice(found,1);
      }
    } else delete container[key];
  }

  function replaceCulinaryEffects(unit,item,effects,options={}) {
    const now=Number(options.now ?? Date.now());
    const incoming=effects.map((effect,index)=>({
      id:`culinary_${normalizeId(itemId(item)||item.recipeId||"food")}_${normalizeId(effect.target)}_${now}_${index}`,
      sourceItemId:item.definitionId || item.itemId || item.id || null,
      sourceRecipeId:item.recipeId || null,
      kind:"culinary_final_power",
      target:normalizeId(effect.target),
      power:Number(effect.power)||0,
      affinity:Number(effect.affinity)||0,
      remainingHours:Math.max(0,Number(effect.durationHours ?? item.durationHours ?? 0)||0),
      active:true,
    })).filter(effect=>effect.target&&effect.power&&effect.remainingHours>0);

    const active=(Array.isArray(unit.culinaryEffects)?unit.culinaryEffects:[])
      .filter(effect=>effect&&effect.active!==false&&Number(effect.remainingHours)>0)
      .map(clone);

    for(const next of incoming) {
      const index=active.findIndex(current=>normalizeId(current.target)===next.target);
      if(index<0) {
        active.push(next);
        continue;
      }
      const current=active[index];
      const currentPower=Number(current.power)||0;
      if(next.power>currentPower) active[index]=next;
      else if(next.power===currentPower) {
        current.remainingHours=Math.max(Number(current.remainingHours)||0,next.remainingHours);
        current.affinity=Math.max(Number(current.affinity)||0,next.affinity);
      }
    }

    unit.culinaryEffects=active;
    return active;
  }

  function applyFood(unit,item,options={}) {
    const state=ensureState(unit);
    const profile=foodProfile(item);
    const before={hungerSlots:state.hungerSlots,hydrationSlots:state.hydrationSlots};

    state.hungerSlots=cooking()?.restoreSurvivalSlots
      ? cooking().restoreSurvivalSlots(state.hungerSlots,profile.hungerSlotsRestored,state.maxHungerSlots)
      : Math.min(state.maxHungerSlots,state.hungerSlots+profile.hungerSlotsRestored);
    state.hydrationSlots=cooking()?.restoreSurvivalSlots
      ? cooking().restoreSurvivalSlots(state.hydrationSlots,profile.hydrationSlotsRestored,state.maxHydrationSlots)
      : Math.min(state.maxHydrationSlots,state.hydrationSlots+profile.hydrationSlotsRestored);

    let sp=null;
    if(profile.spRestore>0 && itemRuntime()?.recoverResource) sp=itemRuntime().recoverResource(unit,"sp",profile.spRestore);
    const effects=profile.culinaryEffects.length
      ? replaceCulinaryEffects(unit,item,profile.culinaryEffects,options)
      : [];
    state.lastEatDrinkAtMs=Number(options.now ?? Date.now());

    return Object.freeze({
      applied:true,
      profile,
      before:Object.freeze(before),
      after:Object.freeze({hungerSlots:state.hungerSlots,hydrationSlots:state.hydrationSlots}),
      sp:sp?Object.freeze(clone(sp)):null,
      culinaryEffects:Object.freeze(clone(effects)),
    });
  }

  function consumeFood(unit={},ref,options={}) {
    const found=locateFood(unit,ref,options);
    if(!found?.item) return Object.freeze({consumed:false,reason:"food_not_found"});
    if(!isFood(found.item)) return Object.freeze({consumed:false,reason:"item_not_food"});
    if(quantityOf(found.item)<=0) return Object.freeze({consumed:false,reason:"insufficient_quantity"});

    const applied=applyFood(unit,found.item,options);
    const rt=itemRuntime();
    const consumption=rt?.consumeQuantity
      ? rt.consumeQuantity(found.item,1)
      : {consumed:true,before:quantityOf(found.item),after:(found.item.quantity=quantityOf(found.item)-1),amount:1};
    if(!consumption.consumed) return Object.freeze({consumed:false,reason:consumption.reason,applied});
    if(quantityOf(found.item)<=0) deleteEntry(found.container,found.key,found.item);

    const result=Object.freeze({
      consumed:true,
      itemId:itemId(found.item),
      containerType:found.containerType,
      application:applied,
      consumption:Object.freeze(clone(consumption)),
    });
    try {
      if(typeof global.dispatchEvent==="function"&&typeof global.CustomEvent==="function") {
        global.dispatchEvent(new global.CustomEvent("luminous:food-consumed",{detail:result}));
      }
    } catch(_){}
    return result;
  }

  function advanceCulinaryEffects(unit={},hours=0) {
    const elapsed=Math.max(0,Number(hours)||0);
    if(!elapsed) return [];
    const changed=[];
    unit.culinaryEffects=(Array.isArray(unit.culinaryEffects)?unit.culinaryEffects:[]).filter(effect=>{
      if(!effect||effect.active===false) return false;
      const before=Math.max(0,Number(effect.remainingHours)||0);
      effect.remainingHours=Math.max(0,before-elapsed);
      effect.active=effect.remainingHours>0;
      changed.push({id:effect.id,before,after:effect.remainingHours,expired:!effect.active});
      return effect.active;
    });
    itemRuntime()?.advanceTime?.(unit,elapsed);
    return changed;
  }

  function advanceSurvivalTime(unit={},hours=0) {
    const state=ensureState(unit);
    const elapsed=Math.max(0,Number(hours)||0);
    state.decayAccumulatorHours+=elapsed;
    const step=Math.max(1,Number(cooking()?.SURVIVAL_DECAY_HOURS || 6));
    const ticks=Math.floor(state.decayAccumulatorHours/step);
    if(ticks>0) {
      state.hungerSlots=Math.max(0,state.hungerSlots-ticks);
      state.hydrationSlots=Math.max(0,state.hydrationSlots-ticks);
      state.decayAccumulatorHours-=ticks*step;
    }
    advanceCulinaryEffects(unit,elapsed);
    return Object.freeze({ticks,state:Object.freeze(clone(state))});
  }

  function resourceSlot(unit,kind) {
    const key=normalizeId(kind);
    if(key==="hp") {
      if(Number.isFinite(Number(unit.hp))) return {owner:unit,key:"hp",max:Number(unit.hp_max ?? unit.maxHp ?? unit.effectiveMaxHp ?? unit.hp)};
      if(unit.combatStats&&Number.isFinite(Number(unit.combatStats.hp_actual))) return {owner:unit.combatStats,key:"hp_actual",max:Number(unit.combatStats.hp_max ?? unit.combatStats.hp_actual)};
    }
    if(key==="sp") {
      if(Number.isFinite(Number(unit.sp))) return {owner:unit,key:"sp",max:Number(unit.sp_max ?? unit.maxSp ?? 45)};
      if(unit.combatStats&&Number.isFinite(Number(unit.combatStats.sp_actual))) return {owner:unit.combatStats,key:"sp_actual",max:Number(unit.combatStats.sp_max ?? 45)};
    }
    return null;
  }

  function applyLegacyRestRecovery(unit,type) {
    const hp=resourceSlot(unit,"hp");
    const sp=resourceSlot(unit,"sp");
    if(type==="short") {
      if(hp) hp.owner[hp.key]=Math.min(hp.max,Number(hp.owner[hp.key]||0)+Math.floor(hp.max*0.34));
      if(sp) sp.owner[sp.key]=0;
      unit.stagger_1_active="1"; unit.stagger_2_active="1"; unit.stagger_3_active="1";
    } else {
      if(hp) hp.owner[hp.key]=hp.max;
      if(sp) sp.owner[sp.key]=0;
    }
  }

  function performRest(unit={},restType,options={}) {
    const type=normalizeId(restType);
    if(!["short","short_rest","long","long_rest"].includes(type)) return Object.freeze({completed:false,reason:"unknown_rest_type"});
    const isShort=type.startsWith("short");
    const normalizedType=isShort?"short":"long";
    const now=Number(options.now ?? Date.now());
    const state=ensureState(unit);
    const choice=normalizeId(options.choice || "activity");

    if(!["activity","eat_drink"].includes(choice)) return Object.freeze({completed:false,reason:"invalid_rest_choice"});
    if(isShort && state.lastShortRestAtMs!=null) {
      const elapsedHours=(now-Number(state.lastShortRestAtMs))/(60*60*1000);
      if(elapsedHours<SHORT_REST_COOLDOWN_HOURS && options.ignoreCooldown!==true) {
        return Object.freeze({completed:false,reason:"short_rest_cooldown",remainingHours:SHORT_REST_COOLDOWN_HOURS-elapsedHours});
      }
    }

    let food=null;
    if(choice==="eat_drink") {
      if(!options.foodRef) return Object.freeze({completed:false,reason:"eat_drink_requires_food"});
      const candidate=locateFood(unit,options.foodRef,options);
      if(!candidate?.item) return Object.freeze({completed:false,reason:"food_not_found"});
      if(!isFood(candidate.item)) return Object.freeze({completed:false,reason:"item_not_food"});
      if(quantityOf(candidate.item)<=0) return Object.freeze({completed:false,reason:"insufficient_quantity"});
    }

    applyLegacyRestRecovery(unit,normalizedType);

    if(choice==="eat_drink") {
      food=consumeFood(unit,options.foodRef,{...options,now});
      if(!food.consumed) return Object.freeze({completed:false,reason:food.reason,food});
    }
    if(isShort) state.lastShortRestAtMs=now;
    else {
      state.lastLongRestAtMs=now;
      state.completedRequiredLongRest=true;
    }
    state.lastRestChoice=choice;
    state.lastRestType=normalizedType;

    const survival=cooking()?.dailySurvivalExhaustion
      ? cooking().dailySurvivalExhaustion(state)
      : {sleepPenalty:0,sustenancePenalty:(state.hungerSlots>=1&&state.hydrationSlots>=1?0:1),total:0};

    const result=Object.freeze({
      completed:true,
      restType:normalizedType,
      choice,
      food,
      sleepRequired:!isShort,
      sleepHours:!isShort?LONG_REST_SLEEP_HOURS:0,
      survival:Object.freeze(clone(state)),
      dailyExhaustion:Object.freeze(clone(survival)),
    });
    try {
      if(typeof global.dispatchEvent==="function"&&typeof global.CustomEvent==="function") {
        global.dispatchEvent(new global.CustomEvent("luminous:rest-completed",{detail:result}));
      }
    } catch(_){}
    return result;
  }

  function listEdibleInventory(unit={},options={}) {
    const rows=[];
    const inv=inventory();
    for(const [containerType,container] of [
      ["active",inv?.activeContainer?.(unit,false)?.value || unit.inventario_activo || unit.activeInventory || unit.inventory || unit.inventario],
      ["stash",inv?.stashContainer?.(unit,false)?.value || unit.inventario_stash || unit.stashInventory || unit.stash]
    ]) {
      if(containerType==="stash"&&options.includeStash===false) continue;
      for(const [key,item] of objectEntries(container)) {
        if(item&&quantityOf(item)>0&&isFood(item)) rows.push(Object.freeze({
          key,containerType,item:Object.freeze(clone(item)),profile:foodProfile(item)
        }));
      }
    }
    return rows;
  }

  const API=Object.freeze({
    VERSION,SHORT_REST_COOLDOWN_HOURS,LONG_REST_SLEEP_HOURS,
    ensureState,isFood,foodProfile,locateFood,listEdibleInventory,
    applyFood,consumeFood,replaceCulinaryEffects,advanceCulinaryEffects,advanceSurvivalTime,performRest,
  });

  global.LuminousFoodRestRuntime=API;
  if(typeof module!=="undefined"&&module.exports) module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:window);
