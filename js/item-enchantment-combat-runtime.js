(function (global) {
  "use strict";

  if (global.LuminousItemEnchantmentCombatRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemEnchantmentCombatRuntime;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const Magic = global.LuminousItemMagicRuntime || safeRequire("./item-magic-runtime.js");
  if (!Magic) throw new Error("LuminousItemMagicRuntime is required before LuminousItemEnchantmentCombatRuntime.");

  const VERSION = 2;
  const BRIDGE_FLAG = "__luminousItemEnchantmentCombatBridge";
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  function deliveryType(skill = {}) {
    const explicit = normalizeId(skill.deliveryType || skill.delivery || skill.rangeType);
    if (["melee","ranged"].includes(explicit)) return explicit;
    const range = Number(skill.skillRange ?? skill.range ?? skill.metadata?.skillRange);
    return Number.isFinite(range) && range > 1 ? "ranged" : "melee";
  }

  function sourceItem(attacker = {}, skill = {}, context = {}) {
    const candidates = [
      context.item,
      context.sourceItem,
      context.weapon,
      skill.sourceItem,
      skill.item,
      skill.weapon,
      attacker.equippedWeapon,
      attacker.weapon,
      attacker.mainHand,
      attacker.equipment?.mainHand,
      attacker.equipment?.main_hand,
    ];
    const equipped=candidates.find((entry) => entry && typeof entry === "object") || null;
    if(!equipped) return null;
    // Combat hydration clones equipped slots separately from the Player inventory.
    // Enchantment activation MUST consume the canonical inventory Item, not the
    // decorative equipment clone that Firebase will never serialize.
    const id=String(equipped.instanceId || equipped.instance_id || "");
    const active=attacker?.inventario_activo;
    const stash=attacker?.inventario_stash;
    if(id){
      for(const container of [active,stash]){
        if(!container || typeof container!=="object")continue;
        const canonical=container[id] || Object.values(container).find(row=>
          row && typeof row==="object" && String(row.instanceId || row.instance_id || "")===id);
        if(canonical) return canonical;
      }
    }
    return equipped;
  }

  function selectedChannels(skill = {}, context = {}) {
    return context.selectedEnchantmentChannels ||
      context.selectedChannels ||
      skill.selectedEnchantmentChannels ||
      skill.selectedChannels ||
      {};
  }

  function resolve(item, attacker, defender, skill = {}, context = {}) {
    if (!item) return { active:false, reason:"no_source_magic_item", effects:[], magicHit:false, totalDamagePercent:0 };
    const summary = Magic.enchantmentCombatSummary(attacker || {}, item, {
      trigger:"on_skill",
      selectedChannels:selectedChannels(skill, context),
      skill,
      defender,
      sourceItem:context.sourceItem || context.item || context.weapon || null,
      sourceItemInstanceId:context.sourceItemInstanceId || null,
      selectedDamageChannel:context.selectedDamageChannel || skill.selectedDamageChannel || null,
      requireEquipped:true,
      requireLivingActor:true,
    });
    if (summary.resolved === false) {
      return {...summary,item,delivery:deliveryType(skill)};
    }
    const resourcePlan=Magic.activationResourcePlan?.(summary,item) || {charges:0,magicalDurability:0,sp:0};
    const resourceGate=Magic.canPayActivationResources?.(attacker || {},item,resourcePlan) || {allowed:true};
    if (!resourceGate.allowed) {
      return {
        active:false,
        resolved:false,
        suppressed:true,
        reason:resourceGate.reason,
        effects:[],
        magicHit:false,
        damageFlat:0,
        totalDamagePercent:0,
        item,
        delivery:deliveryType(skill),
        resourcePlan,
        resourceGate,
      };
    }
    return {
      ...summary,
      item,
      delivery:deliveryType(skill),
      resourcePlan,
      resourceGate,
    };
  }

  function adjustedDamage(baseDamage, attacker, defender, skill = {}, context = {}) {
    const item = sourceItem(attacker, skill, context);
    // A Skill's activation is decided once. If its first Coin spends the last
    // point of Magical Durability, its remaining Coins keep the same approved
    // snapshot; a NEW Skill must resolve again and can see depletion.
    const actionContext = context && typeof context === "object" ? context : null;
    const cached = actionContext?.__luminousEnchantmentSkillSnapshot || null;
    const sameAction = cached?.skill === skill &&
      cached?.item === item &&
      cached?.attacker === attacker;
    if (actionContext && cached && !sameAction) {
      delete actionContext.__luminousEnchantmentActivationSpent;
      delete actionContext.__luminousEnchantmentWearSpent;
    }
    const actorStillActive = Magic.actorCanEmitMagic?.(attacker) !== false;
    const itemStillEquipped = !item || Magic.itemEquippedBy?.(attacker, item) !== false;
    const resolution = sameAction && actorStillActive && itemStillEquipped
      ? cached.resolution
      : resolve(item, attacker, defender, skill, context);
    if (actionContext && (!sameAction || !actorStillActive || !itemStillEquipped)) {
      actionContext.__luminousEnchantmentSkillSnapshot = {skill,item,attacker,resolution};
    }
    let damage = Math.max(0, Number(baseDamage) || 0);

    if (resolution.active && resolution.resolved !== false) {
      const flat = Number(resolution.damageFlat) || 0;
      if (flat) damage += flat;
      const percent = Number(resolution.totalDamagePercent) || 0;
      if (percent) damage *= 1 + percent / 100;
    }

    const defense = Magic.applyNonMagicHitDefense(damage, defender || {}, {
      magicHit:resolution.magicHit === true,
      delivery:resolution.delivery,
      actionType:"skill",
    });

    return {
      damage:Math.max(0, Math.floor(defense.damage)),
      baseDamage:Math.max(0, Number(baseDamage) || 0),
      item,
      resolution,
      defense,
    };
  }


  function spendActivationOnce(attacker,item,resolution,skill={},context={}) {
    if (!item || !resolution?.effects?.length) return {activated:false,reason:"no_enchantment_effects"};
    if (context && context.__luminousEnchantmentActivationSpent===true) {
      return {activated:true,skipped:true,reason:"activation_resources_already_spent_for_action"};
    }
    const result=Magic.activateEnchantmentEffects?.(attacker || {},item,{
      trigger:"on_skill",
      selectedChannels:selectedChannels(skill,context),
      requireEquipped:true,
      requireLivingActor:true,
    }) || {activated:true,skipped:true,reason:"activation_runtime_unavailable"};
    if (context && result?.activated) context.__luminousEnchantmentActivationSpent=true;
    if(result?.activated && !result?.skipped && (
      Number(result?.plan?.charges)>0 || Number(result?.plan?.magicalDurability)>0
    )) attacker.__luminousEnchantmentInventoryDirty=true;
    return result;
  }

  function spendWearOnce(item, resolution, context = {}) {
    if (!item || !resolution?.effects?.length) return { spent:false, reason:"no_enchantment_effects" };
    if (context && context.__luminousEnchantmentWearSpent === true) {
      return { spent:true, skipped:true, reason:"wear_already_spent_for_action" };
    }
    const result = Magic.spendResolvedEnchantmentWear(item, resolution, { specialUse:false });
    if (context && result?.spent) context.__luminousEnchantmentWearSpent = true;
    return result;
  }

  function approvedResistanceReductions(defender={}, skill={}) {
    const results={physical:0,sin:0};
    if(!defender?.equipment || Magic.actorCanEmitMagic?.(defender)===false) return results;
    let passive=null;
    try { passive=Magic.aggregateEquippedPassiveModifiers?.(defender); } catch (_) { return results; }
    const phys=String(skill?.attackType || skill?.physicalDamageType || "").trim().toLowerCase();
    const sin=String(skill?.sinAffinity || skill?.sin || "").trim().toLowerCase();
    for(const source of passive?.sources || []){
      for(const effect of source.effects || []){
        if(String(effect.type)!=="resistance_multiplier_reduction") continue;
        const axis=String(effect.axis || "").trim().toLowerCase();
        const kind=String(effect.damageType || "").trim().toLowerCase();
        const value=Number(effect.value);
        if(!Number.isFinite(value) || value<=0 || value>1) continue;
        if(axis==="physical" && kind===phys) results.physical=Math.max(results.physical,value);
        if(axis==="sin" && kind===sin) results.sin=Math.max(results.sin,value);
      }
    }
    return results;
  }

  function withDefenderResistanceInput(defender={},skill={},calculate) {
    // Apply before the canonical resistance calculation, not as post-HP damage
    // reduction. Never silently apply the physical 0.30 cap to SIN.
    const strongest=approvedResistanceReductions(defender,skill);
    const edits=[];
    const set=(key,next)=>{
      const own=Object.prototype.hasOwnProperty.call(defender,key);
      edits.push({key,own,old:defender[key]});
      defender[key]=next;
    };
    if(strongest.physical>0 && defender.isStaggered!==true) {
      const raw=Number(defender.physRes ?? 1);
      if(Number.isFinite(raw)) set("physRes",Math.max(0.30,raw-strongest.physical));
    }
    if(strongest.sin>0) {
      const raw=Number(defender.sinRes ?? 1);
      if(Number.isFinite(raw)) set("sinRes",Math.max(0,raw-strongest.sin));
    }
    try { return calculate(); }
    finally {
      for(const edit of edits){
        if(edit.own) defender[edit.key]=edit.old;
        else delete defender[edit.key];
      }
    }
  }

  // Non-Skill effects run only from canonical CombatEngine events. No UI or
  // arbitrary Item metadata may choose a trigger, apply a Status or spend MD.
  function canonicalEquippedItem(user={},equipped=null) {
    if(!equipped || typeof equipped!=="object") return null;
    const id=String(equipped.instanceId || equipped.instance_id || "");
    if(!id)return equipped;
    for(const container of [user.inventario_activo,user.inventario_stash]){
      if(!container || typeof container!=="object")continue;
      const item=container[id] || Object.values(container).find(entry=>
        entry && String(entry.instanceId || entry.instance_id || "")===id);
      if(item)return item;
    }
    return equipped;
  }

  function triggerStatusTarget(effect,actor,target,trigger) {
    const defensive=trigger==="on_damage_received" || trigger==="before_getting_hit";
    const where=normalizeId(effect.target || (defensive?"self":"target"));
    if(["self","wielder","wearer","owner"].includes(where))return actor;
    if(["target","enemy","defender"].includes(where))return target;
    return null;
  }

  function triggerCombatEffects(actor,item,target,trigger,context={}) {
    const kind=normalizeId(trigger);
    if(!["on_hit","on_damage_received","before_getting_hit"].includes(kind))
      return {activated:false,reason:"unsupported_combat_trigger"};
    if(!actor || !item || Magic.actorCanEmitMagic?.(actor)===false)
      return {activated:false,reason:"actor_cannot_emit_magic"};
    const channels=["on_damage_received","before_getting_hit"].includes(kind)
      ? (context.defenderSelectedEnchantmentChannels || {})
      : selectedChannels(context.skill || {},context);
    const resolution=Magic.enchantmentEffectResolution?.(actor,item,{
      trigger:kind,selectedChannels:channels,
      requireEquipped:true,requireLivingActor:true,specialUse:true,
    });
    if(!resolution?.resolved)return {activated:false,reason:resolution?.reason || "effect_resolution_failed"};
    if(!resolution.effects?.length)return {activated:false,reason:"no_triggered_effects"};
    const status=global.LuminousStatusEngine || safeRequire("./status-engine.js");
    if(!status?.applyStatus)return {activated:false,reason:"status_runtime_unavailable"};
    const actions=[];
    for(const effect of resolution.effects){
      if(normalizeId(effect.type)!=="status_apply" || !normalizeId(effect.statusId))
        return {activated:false,reason:"unsupported_trigger_effect"};
      const destination=triggerStatusTarget(effect,actor,target,kind);
      if(!destination || typeof destination!=="object")
        return {activated:false,reason:"invalid_trigger_target"};
      if(global.LuminousConditionRuntime?.canApplyStatus?.(destination,effect.statusId,{
        sourceUnitId:actor.id,sourceTraitId:effect.sourceEnchantmentId,
      })?.allowed===false) return {activated:false,reason:"trigger_status_blocked"};
      actions.push({effect,destination});
    }
    const plan=Magic.activationResourcePlan?.(resolution,item) || {};
    const gate=Magic.canPayActivationResources?.(actor,item,plan);
    if(gate?.allowed!==true)return {activated:false,reason:gate?.reason || "trigger_resources_unavailable"};
    // Preserve all affected Item/actor/target resources, including legacy
    // mirrors. A Status adapter failure must not leave a partial activation.
    const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
    const savedItem=clone(item);
    const savedSp=actor.sp;
    const targets=[...new Set(actions.map(action=>action.destination))];
    const savedTargets=targets.map(unit=>({
      unit,had:Object.prototype.hasOwnProperty.call(unit,"statusEffects"),
      statusEffects:clone(unit.statusEffects),
    }));
    const restore=()=>{
      for(const key of Object.keys(item))delete item[key];
      Object.assign(item,savedItem);
      if(savedSp===undefined)delete actor.sp;
      else actor.sp=savedSp;
      for(const row of savedTargets){
        if(!row.had)delete row.unit.statusEffects;
        else row.unit.statusEffects=clone(row.statusEffects);
      }
    };
    // A payment adapter may fail or throw after touching SP/Charges/MD.
    // Restore every provisional field, not only failed Status applications.
    let payment;
    try {
      payment=Magic.payActivationResourcePlan?.(actor,item,plan);
    } catch(error) {
      restore();
      return {activated:false,rolledBack:true,
        reason:String(error?.message||"trigger_payment_failed")};
    }
    if(!payment?.paid){
      restore();
      return {activated:false,rolledBack:true,
        reason:payment?.reason || "trigger_payment_failed"};
    }
    try{
      for(const {effect,destination} of actions){
        const applied=status.applyStatus(destination,effect.statusId,{
          mode:"gain",
          count:Number.isFinite(Number(effect.stacks))?Math.max(0,Number(effect.stacks)):1,
          potency:Number.isFinite(Number(effect.value))?Number(effect.value):0,
          ...(effect.duration?{duration:effect.duration}:{}),
          sourceTraitId:effect.sourceEnchantmentId || null,
          sourceUnitId:actor.id || null,
        });
        if(!applied)throw new Error("trigger_status_application_failed");
      }
      const wear=Magic.spendResolvedEnchantmentWear?.(item,resolution,{specialUse:false});
      if(wear?.spent===false)throw new Error(wear.reason || "trigger_wear_failed");
      if(Number(plan.magicalDurability)>0 || Number(plan.charges)>0 ||
        (wear?.spent && Number(wear.amount)>0))
        actor.__luminousEnchantmentInventoryDirty=true;
      return {activated:true,trigger:kind,applied:actions.length,plan,wear};
    }catch(error){
      restore();
      return {activated:false,rolledBack:true,reason:String(error?.message || error)};
    }
  }

  // The selection is an intentional combat action, never a passive reaction.
  // It is stored only on the live combat unit and is consumed at first use.
  function queueDefensiveReaction(defender,itemInstanceId){
    const id=String(itemInstanceId||"");
    if(!defender || !id || Magic.actorCanEmitMagic?.(defender)===false)
      return {queued:false,reason:"reaction_actor_unavailable"};
    const item=(Magic.equippedMagicItems?.(defender)||[])
      .map(entry=>canonicalEquippedItem(defender,entry))
      .find(entry=>String(entry?.instanceId||entry?.instance_id||"")===id);
    if(!item)return {queued:false,reason:"reaction_item_not_equipped"};
    const effect=Magic.enchantmentEffectResolution?.(defender,item,{
      trigger:"before_getting_hit",requireEquipped:true,requireLivingActor:true,
      specialUse:true,
    });
    if(!effect?.resolved || !effect.effects?.length)
      return {queued:false,reason:effect?.reason||"no_authored_predamage_reaction"};
    if(effect.effects.some(row=>normalizeId(row.type)!=="status_apply"))
      return {queued:false,reason:"unsupported_reaction_effect"};
    Object.defineProperty(defender,"__luminousSelectedEnchantmentReaction",{
      configurable:true,writable:true,enumerable:false,value:id,
    });
    return {queued:true,itemInstanceId:id};
  }

  function dispatchSelectedDefensiveReaction(context={},engine=null){
    if(context.enchantmentPreDamageWindow!==true || !context.defender ||
      !Number.isFinite(Number(context.incomingDamage)) ||
      Number(context.incomingDamage)<=0)return {activated:false,reason:"no_positive_predamage"};
    const defender=context.defender,attacker=context.attacker;
    const selected=String(defender.__luminousSelectedEnchantmentReaction||"");
    if(!selected)return {activated:false,reason:"defensive_reaction_not_selected"};
    // Consume the selection at this actual incoming hit. It cannot repeat for
    // every Coin in a Multi-Coin Skill or on a second simultaneous action.
    delete defender.__luminousSelectedEnchantmentReaction;
    const item=(Magic.equippedMagicItems?.(defender)||[])
      .map(entry=>canonicalEquippedItem(defender,entry))
      .find(entry=>String(entry?.instanceId||entry?.instance_id||"")===selected);
    if(!item)return {activated:false,reason:"reaction_item_no_longer_equipped"};
    const economy=global.LuminousActionEconomy || safeRequire("./universal-action-economy.js");
    if(!economy?.availability || !economy?.consume)
      return {activated:false,reason:"authoritative_reaction_budget_unavailable"};
    const phase=engine?.currentState || "COMBAT";
    const gate=economy.availability(defender,"reaction",{phase});
    if(!gate.available)return {activated:false,reason:gate.reason||"reaction_unavailable"};
    const originalState=defender.__luminousActionEconomyState;
    const savedState=originalState?JSON.parse(JSON.stringify(originalState)):null;
    if(!economy.consume(defender,"reaction",{phase}))
      return {activated:false,reason:"reaction_spend_failed"};
    let result;
    try{
      result=triggerCombatEffects(defender,item,attacker,"before_getting_hit",context);
    }catch(error){
      result={activated:false,reason:String(error?.message||error)};
    }
    if(!result?.activated){
      // Recover the Action Economy if a status, MD, SP or wear gate failed.
      if(savedState && defender.__luminousActionEconomyState)
        Object.assign(defender.__luminousActionEconomyState,savedState);
      return {activated:false,rolledBack:true,reason:result?.reason||"reaction_effect_failed"};
    }
    return {...result,reactionSpent:true};
  }

  function dispatchCombatEvent(tag,context={},engine=null) {
    if(tag==="[Before Getting Hit]" && context?.enchantmentPreDamageWindow===true)
      return dispatchSelectedDefensiveReaction(context,engine);

    if(tag!=="[On Hit]" || !context || !context.attacker || !context.defender ||
      !Number.isFinite(Number(context.damageDealt)) || Number(context.damageDealt)<=0)
      return [];
    const results=[];
    const attacker=context.attacker,defender=context.defender;
    const combatLink=global.LuminousEnchantmentCombatLink || safeRequire("./item-enchantment-combat-link.js");
    const authoredWeapon=Boolean(context.skill?.sourceItemInstanceId || context.skill?.weaponInstanceId);
    const weaponSkill=combatLink?.isWeaponSkill?.(context.skill || {})===true || authoredWeapon;
    const weapon=weaponSkill?sourceItem(attacker,context.skill || {},context):null;
    if(weapon){
      const result=triggerCombatEffects(attacker,weapon,defender,"on_hit",context);
      if(result.activated)results.push(result);
    }
    const seen=new Set();
    for(const equipped of Magic.equippedMagicItems?.(defender) || []){
      const item=canonicalEquippedItem(defender,equipped);
      const id=String(item?.instanceId || item?.instance_id || "");
      if((id && seen.has(id)) || !item)continue;
      if(id)seen.add(id);
      const result=triggerCombatEffects(defender,item,attacker,"on_damage_received",context);
      if(result.activated)results.push(result);
    }
    return results;
  }

  function patchCombatEngine(engine = global.CombatEngine) {
    if (!engine || typeof engine.calculateCoinDamage !== "function") {
      return { installed:false, reason:"combat_engine_unavailable" };
    }
    if (engine[BRIDGE_FLAG]) return { installed:true, alreadyInstalled:true };

    const original = engine.calculateCoinDamage;
    const originalTriggerEvent=typeof engine.triggerEvent==="function"?engine.triggerEvent:null;
    if(originalTriggerEvent){
      engine.triggerEvent=function(tag,context,targetsHit) {
        const result=originalTriggerEvent.call(this,tag,context,targetsHit);
        dispatchCombatEvent(tag,context,this);
        return result;
      };
    }
    engine.calculateCoinDamage = function (attacker, defender, skill, coinFinalPower, isCritical, clashCount, context = null) {
      const base = withDefenderResistanceInput(defender,skill,()=>original.call(this, attacker, defender, skill, coinFinalPower, isCritical, clashCount, context));
      const runtimeContext = context && typeof context === "object" ? context : {};
      const adjusted = adjustedDamage(base, attacker, defender, skill, runtimeContext);
      if (adjusted.item && adjusted.resolution?.effects?.length && adjusted.damage > 0) {
        adjusted.activation = spendActivationOnce(attacker,adjusted.item,adjusted.resolution,skill,runtimeContext);
        if (adjusted.activation?.activated === false) return base;
        adjusted.wear = spendWearOnce(adjusted.item, adjusted.resolution, runtimeContext);
        if(adjusted.wear?.spent && !adjusted.wear?.skipped && Number(adjusted.wear?.amount)>0)
          attacker.__luminousEnchantmentInventoryDirty=true;
      }
      if (context && typeof context === "object") {
        context.enchantmentMagicHit = adjusted.resolution?.magicHit === true;
        context.enchantmentDamagePercent = adjusted.resolution?.totalDamagePercent || 0;
        context.enchantmentDamageAdjusted = adjusted.damage;
      }
      return adjusted.damage;
    };

    Object.defineProperty(engine, BRIDGE_FLAG, {
      value:Object.freeze({originalCalculateCoinDamage:original,originalTriggerEvent}),
      configurable:true,
      enumerable:false,
    });
    return { installed:true, alreadyInstalled:false };
  }

  function uninstallCombatEngine(engine = global.CombatEngine) {
    const state = engine?.[BRIDGE_FLAG];
    if (!engine || !state?.originalCalculateCoinDamage) return false;
    engine.calculateCoinDamage = state.originalCalculateCoinDamage;
    if(state.originalTriggerEvent)engine.triggerEvent=state.originalTriggerEvent;
    try { delete engine[BRIDGE_FLAG]; } catch (_) {}
    return true;
  }

  const API = Object.freeze({
    VERSION,
    BRIDGE_FLAG,
    deliveryType,
    sourceItem,
    selectedChannels,
    resolve,
    adjustedDamage,
    spendActivationOnce,
    spendWearOnce,
    canonicalEquippedItem,
    triggerCombatEffects,
    queueDefensiveReaction,
    dispatchSelectedDefensiveReaction,
    dispatchCombatEvent,
    approvedResistanceReductions,
    withDefenderResistanceInput,
    patchCombatEngine,
    uninstallCombatEngine,
  });

  global.LuminousItemEnchantmentCombatRuntime = API;
  if (global.CombatEngine) patchCombatEngine(global.CombatEngine);
  if (global.addEventListener) {
    global.addEventListener("luminous:combat073-runtime-ready", () => patchCombatEngine(global.CombatEngine));
  }

  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
