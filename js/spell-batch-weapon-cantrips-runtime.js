(function (global) {
  "use strict";

  if (global.LuminousWeaponCantripBatchRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousWeaponCantripBatchRuntime;
    return;
  }

  const VERSION = "0.7.4-weapon-cantrips-batch-2";
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const intOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  const STATUS_DEFINITIONS = Object.freeze({
    booming: Object.freeze({
      name: "Booming", type: "negative", mode: "single",
      icon: "Assets/Icons/status/cantrips/booming.png", maxCount: 99,
      description: "After every Clash, raise Stagger Threshold by 2 and lose 1 Count. On Turn End, inflict Tremor equal to remaining Booming Count, then remove this effect."
    }),
    shillelagh: Object.freeze({
      name: "Shillelagh", type: "positive", mode: "single",
      icon: "Assets/Icons/status/cantrips/shillelagh.png", maxCount: 10,
      description: "Melee Skills deal (1, (Level/15) + (2 × WIS Mod))% Main Damage as Fixed Damage on Hit. On Turn End, lose 1 Count."
    })
  });

  function registry() {
    if (!global.STATUS_REGISTRY || typeof global.STATUS_REGISTRY !== "object") global.STATUS_REGISTRY = {};
    return global.STATUS_REGISTRY;
  }
  function registerStatuses() {
    const target = registry();
    Object.entries(STATUS_DEFINITIONS).forEach(([id, definition]) => {
      target[id] = { ...(target[id] || {}), ...definition };
    });
    return target;
  }
  function statusEngine() { return global.LuminousStatusEngine || null; }
  function getStatus(unit, id) {
    const key = normalizeId(id);
    const viaEngine = statusEngine()?.getStatus?.(unit, key);
    if (viaEngine) return viaEngine;
    const raw = unit?.statusEffects?.[key];
    return raw && typeof raw === "object" ? raw : null;
  }
  function applyStatus(unit, id, input = {}) {
    if (!unit) return null;
    const key = normalizeId(id);
    if (typeof statusEngine()?.applyStatus === "function") return statusEngine().applyStatus(unit, key, input);
    if (!unit.statusEffects || typeof unit.statusEffects !== "object" || Array.isArray(unit.statusEffects)) unit.statusEffects = {};
    const current = unit.statusEffects[key] || { id:key, count:0, potency:0, data:{} };
    const mode = normalizeId(input.mode || "gain");
    if (mode === "set") {
      current.count = Math.max(0, intOr(input.count, 1));
      current.potency = Math.max(0, intOr(input.potency, 0));
    } else {
      current.count = Math.max(0, intOr(current.count, 0) + Math.max(0, intOr(input.count, 1)));
      current.potency = Math.max(0, intOr(current.potency, 0) + Math.max(0, intOr(input.potency, 0)));
    }
    current.data = { ...(current.data || {}), ...(input.data || {}) };
    const maxCount = registry()[key]?.maxCount;
    if (Number.isFinite(Number(maxCount))) current.count = Math.min(Number(maxCount), current.count);
    unit.statusEffects[key] = current;
    return current;
  }
  function removeStatus(unit, id) {
    const key = normalizeId(id);
    if (!unit) return false;
    if (typeof statusEngine()?.removeStatus === "function") return statusEngine().removeStatus(unit, key, { from:"spell", ignoreProtection:true });
    if (unit.statusEffects?.[key]) { delete unit.statusEffects[key]; return true; }
    return false;
  }
  function reduceCount(unit, id, amount = 1) {
    const key = normalizeId(id), entry = unit?.statusEffects?.[key];
    if (!entry || typeof entry !== "object") return 0;
    entry.count = Math.max(0, intOr(entry.count, 0) - Math.max(0, intOr(amount, 0)));
    if (entry.count <= 0) removeStatus(unit, key);
    return entry.count;
  }

  function actorLevel(actor = {}) {
    const direct = actor.Level ?? actor.level ?? actor.characterBuild?.calculatedAtLevel;
    if (Number.isFinite(Number(direct))) return Math.max(1, intOr(direct, 1));
    const classes = Array.isArray(actor.classes) ? actor.classes : (Array.isArray(actor.characterBuild?.classes) ? actor.characterBuild.classes : []);
    return Math.max(1, classes.reduce((sum,row)=>sum+Math.max(0,intOr(row?.levels ?? row?.level,0)),0) || 1);
  }
  function abilityModifier(unit = {}, ability = "wis") {
    const key = normalizeId(ability);
    const direct = unit?.abilityMods?.[key] ?? unit?.abilityModifiers?.[key] ?? unit?.modifiers?.[key] ?? unit?.dndStats?.[key+"Mod"] ?? unit?.dndStats?.[key+"_mod"];
    if (Number.isFinite(Number(direct))) return intOr(direct,0);
    const score = unit?.dndStats?.[key] ?? unit?.stats?.[key] ?? unit?.abilities?.[key] ?? unit?.[key];
    return Number.isFinite(Number(score)) ? Math.floor((Number(score)-10)/2) : 0;
  }
  function isMeleeSkill(skill = {}) {
    const range = Number(skill.skillRange ?? skill.range ?? skill.rangeTiles ?? 1);
    const type = normalizeId(skill.type);
    return (!Number.isFinite(range) || range <= 1) && !["guard","evade","counter","clashable_guard","clashable_counter","spell","roll","save"].includes(type);
  }
  function skillWeight(skill = {}) { return Math.max(1, intOr(skill.atkWeight ?? skill.attackWeight ?? skill.weight, 1)); }
  function enchantments(skill = {}) { return Array.isArray(skill.__luminousSlotEnchantments) ? skill.__luminousSlotEnchantments : []; }
  function enchantment(skill, id) { return enchantments(skill).find((row) => normalizeId(row?.id || row?.spellId) === normalizeId(id)) || null; }

  function materializeSlotEnchantments(actor, skill, rows = [], action = null) {
    const next = clone(skill) || {};
    if (!rows.length) return { ok:true, skill:next, action };
    if (!isMeleeSkill(next)) return { ok:false, reason:"slot_enchantment_requires_melee_attack" };
    const level = actorLevel(actor);
    const resolved = [];
    for (const raw of rows) {
      const id = normalizeId(raw?.spellId || raw?.id);
      if (id === "green_flame_blade" && skillWeight(next) !== 1) return { ok:false, reason:"green_flame_blade_requires_1_atk_weight" };
      if (id === "booming_blade") resolved.push({ id, level, boomingCount:Math.max(1,Math.floor(level/5)), school:normalizeId(raw?.school || "evocation"), castingTime:normalizeId(raw?.castingTime || "quick_action") });
      if (id === "green_flame_blade") resolved.push({ id, level, secondaryDamagePct:20+Math.floor(level/4), burn:1+Math.floor(level/15), school:normalizeId(raw?.school || "evocation"), castingTime:normalizeId(raw?.castingTime || "quick_action") });
      if (id === "true_strike") resolved.push({ id, level, damagePct:2+Math.floor(level/10), radiance:1, school:normalizeId(raw?.school || "divination"), castingTime:normalizeId(raw?.castingTime || "quick_action") });
      if (id === "divine_smite") resolved.push({
        id,
        slotLevel: Math.max(1,intOr(raw?.slotLevel,1)),
        classId: normalizeId(raw?.classId || "paladin"),
        spellSelectionKey: raw?.spellSelectionKey ?? null,
        overcast: raw?.overcast === true,
        wizardFreeCast: raw?.wizardFreeCast || null,
        school: normalizeId(raw?.school || "evocation"),
        castingTime: normalizeId(raw?.castingTime || "quick_action"),
        targetDrawId: String(raw?.targetDrawId || "").trim() || null,
        targetSkillId: String(raw?.targetSkillId || "").trim() || null,
        finalPowerIfTargetHasRadiance: 1,
        fixedDamageBase: 4,
        fixedDamagePerSlot: 4,
        radiance: 2,
        fiendUndeadMultiplier: 1.5
      });
    }
    next.__luminousSlotEnchantments = resolved;
    if (action) {
      action.metadata = { ...(action.metadata||{}), sourceDefinition:next, slotEnchantments:clone(resolved) };
      const green = resolved.find((row)=>row.id==="green_flame_blade");
      if (green) {
        action.targeting = { ...(action.targeting||{}), attackWeight:2 };
        next.attackWeight = 2; next.atkWeight = 2;
        next.__luminousGreenFlamePrimaryTargetId = action.targeting?.mainTargetId || null;
        action.metadata.sourceDefinition = clone(next);
      }
    }
    return { ok:true, skill:next, action };
  }

  function queueBoomingForNextTurn(target, count, sourceUnitId = null) {
    if (!target) return null;
    const pending = target.__luminousBoomingNextTurn || { count:0, sourceUnitId:null };
    pending.count = Math.min(99, intOr(pending.count,0) + Math.max(1,intOr(count,1)));
    pending.sourceUnitId = sourceUnitId || pending.sourceUnitId || null;
    target.__luminousBoomingNextTurn = pending;
    return pending;
  }
  function activateQueuedBooming(unit) {
    const pending = unit?.__luminousBoomingNextTurn;
    if (!pending) return null;
    delete unit.__luminousBoomingNextTurn;
    return applyStatus(unit,"booming",{count:Math.max(1,intOr(pending.count,1)),mode:"gain",sourceUnitId:pending.sourceUnitId||null,data:{sourceSpellId:"booming_blade"}});
  }
  function resolveBoomingClash(unit, engine = global.CombatEngine) {
    const booming = getStatus(unit,"booming");
    if (!booming || intOr(booming.count,0)<=0) return null;
    if (typeof engine?.modifyNextStaggerThreshold === "function") engine.modifyNextStaggerThreshold(unit,2);
    const remaining=reduceCount(unit,"booming",1);
    return {raised:2,remaining};
  }
  function resolveBoomingTurnEnd(unit) {
    const booming=getStatus(unit,"booming");
    if (!booming) return null;
    const amount=Math.max(0,intOr(booming.count,0));
    if (amount>0) applyStatus(unit,"tremor",{potency:amount,count:1,mode:"gain",data:{sourceSpellId:"booming_blade"}});
    removeStatus(unit,"booming");
    return {tremor:amount};
  }
  function shillelaghFixedPercent(unit) {
    if (!getStatus(unit,"shillelagh")) return 0;
    return Math.max(1, Math.floor(actorLevel(unit)/15) + (2*abilityModifier(unit,"wis")));
  }
  function prepareCantrip(actor, cantripId) {
    const id=normalizeId(cantripId);
    if (id==="shillelagh") {
      applyStatus(actor,"shillelagh",{count:10,mode:"set",data:{sourceSpellId:id}});
      return {ok:true,spellId:id,count:10};
    }
    return {ok:false,reason:"slot_enchantment_must_be_attached_to_skill_plan",spellId:id};
  }
  function onHit(context = {}) {
    const attacker=context.unitAttacker || context.attacker || null;
    const target=context.currentTarget || context.defender || null;
    const skill=context.skill || {};
    if (!attacker || !target) return;
    const booming=enchantment(skill,"booming_blade");
    if (booming) queueBoomingForNextTurn(target,booming.boomingCount,attacker.id||attacker.unitId||null);
    const green=enchantment(skill,"green_flame_blade");
    if (green) applyStatus(target,"burn",{potency:green.burn,count:1,mode:"gain",data:{sourceSpellId:"green_flame_blade"}});
    const truth=enchantment(skill,"true_strike");
    if (truth) applyStatus(target,"radiance",{count:1,mode:"gain",data:{sourceSpellId:"true_strike"}});
    const shPct=isMeleeSkill(skill)?shillelaghFixedPercent(attacker):0;
    if (shPct>0 && numberOr(context.damageDealt,0)>0) {
      const amount=Math.max(1,Math.floor(numberOr(context.damageDealt,0)*shPct/100));
      if (typeof global.LuminousFixedDamageRuntime?.applyFixedDamage === "function") global.LuminousFixedDamageRuntime.applyFixedDamage(target,amount,{damageKind:"directo",skillUsed:null});
      else if (typeof context.engine?.applyDamage === "function") context.engine.applyDamage(target,amount,"fixed",false,null);
    }
  }

  function patchCombatEngine() {
    const engine=global.CombatEngine;
    if (!engine || engine.__weaponCantripBatchRuntime) return Boolean(engine);
    const originalTriggerEvent=typeof engine.triggerEvent==="function"?engine.triggerEvent:null;
    const originalResolveStandardClash=typeof engine.resolveStandardClash==="function"?engine.resolveStandardClash:null;
    const originalTriggerPhase=typeof engine.triggerPhase==="function"?engine.triggerPhase:null;
    const originalCalculateCoinDamage=typeof engine.calculateCoinDamage==="function"?engine.calculateCoinDamage:null;

    if (originalTriggerEvent) engine.triggerEvent=function(tag,context,targetsHit=[]){
      const result=originalTriggerEvent.call(this,tag,context,targetsHit);
      if (normalizeId(tag)==="on_hit") onHit(context||{});
      return result;
    };
    if (originalResolveStandardClash) engine.resolveStandardClash=function(unitA,skillA,unitB,skillB,...rest){
      const result=originalResolveStandardClash.call(this,unitA,skillA,unitB,skillB,...rest);
      resolveBoomingClash(unitA,this); resolveBoomingClash(unitB,this); return result;
    };
    if (originalTriggerPhase) engine.triggerPhase=function(phaseTag,allUnits=[],...rest){
      const phase=normalizeId(phaseTag);
      if (["turn_start","round_start"].includes(phase)) for (const unit of allUnits||[]) activateQueuedBooming(unit);
      const result=originalTriggerPhase.call(this,phaseTag,allUnits,...rest);
      if (["turn_end","round_end"].includes(phase)) for (const unit of allUnits||[]) {
        resolveBoomingTurnEnd(unit);
        if (getStatus(unit,"shillelagh")) reduceCount(unit,"shillelagh",1);
      }
      return result;
    };
    if (originalCalculateCoinDamage) engine.calculateCoinDamage=function(attacker,defender,skill,coinFinalPower,isCritical,clashCount,context=null){
      let base=originalCalculateCoinDamage.call(this,attacker,defender,skill,coinFinalPower,isCritical,clashCount,context);
      const truth=enchantment(skill,"true_strike");
      if (truth) base=Math.floor(numberOr(base,0)*(1+truth.damagePct/100));
      const green=enchantment(skill,"green_flame_blade");
      const defenderId=String(defender?.id||defender?.unitId||"");
      const primaryId=String(skill?.__luminousGreenFlamePrimaryTargetId||"");
      if (green && primaryId && defenderId && defenderId!==primaryId) base=Math.floor(numberOr(base,0)*(green.secondaryDamagePct/100));
      return base;
    };
    Object.defineProperty(engine,"__weaponCantripBatchRuntime",{value:true,configurable:true});
    return true;
  }

  function patchActionAdapter() {
    const source=global.LuminousBattleViewerActionAdapter073;
    if (!source?.compilePlan || source.__weaponCantripBatchRuntime) return Boolean(source);
    const wrapped=Object.freeze({
      ...source,
      __weaponCantripBatchRuntime:true,
      compilePlan(slotId, explicitTargetSlotId=null, providedPlan=null) {
        const result=source.compilePlan(slotId,explicitTargetSlotId,providedPlan);
        const action=result?.action, plan=result?.plan || providedPlan || {};
        if (!action) return result;
        if (normalizeId(action.source?.type)==="skill" && Array.isArray(plan.enchantments) && plan.enchantments.length) {
          const actor=source.combatData?.()?.[source.unitIdFromSlot?.(slotId)] || null;
          const materialized=materializeSlotEnchantments(actor, action.metadata?.sourceDefinition || {}, plan.enchantments, action);
          if (!materialized.ok) return {...result,action:null,reason:materialized.reason};

          const deck=global.LuminousDeckEngine;
          if (plan.deckSelection?.drawId && deck?.bindActionToCard) {
            try { deck.bindActionToCard(action,actor,plan.deckSelection.slotId || slotId,plan.deckSelection.drawId); }
            catch (error) { return {...result,action:null,reason:error?.message || "deck_card_not_in_hand"}; }
          }

          const spellAdapter=global.LuminousBattleViewerSpellAdapter074;
          const spellResources=[];
          const economyAddons=[];
          for (const enchantment of plan.enchantments) {
            const enchantmentLevel=Math.max(0,intOr(enchantment?.slotLevel,0));
            if (enchantmentLevel>0) {
              const resource=typeof spellAdapter?.canonicalCastResource==="function"
                ? spellAdapter.canonicalCastResource(enchantment.classId,enchantmentLevel,enchantment.overcast===true,enchantment)
                : {owner:"source",type:"spell_slot",id:enchantment.classId,amount:1,metadata:{slotLevel:enchantmentLevel}};
              spellResources.push(resource);
            }
            const addon=normalizeId(enchantment?.economyAddon);
            if (addon) economyAddons.push(addon);
          }
          if (spellResources.length) action.resources=[...(action.resources||[]),...spellResources];
          if (economyAddons.length) action.metadata={...(action.metadata||{}),economyAddons:[...new Set(economyAddons)]};
          action.metadata={...(action.metadata||{}),slotEnchantmentSchools:[...new Set(plan.enchantments.map((row)=>normalizeId(row?.school)).filter(Boolean))]};
        }
        if (normalizeId(action.source?.type)==="spell" && normalizeId(action.source?.id)==="shillelagh") {
          action.effects=[...(action.effects||[]),{type:"weapon_cantrip_prepare",cantripId:"shillelagh"}];
          action.resolution={type:"automatic"};
          action.economy={...(action.economy||{}),cost:"quick_action"};
        }
        return result;
      }
    });
    global.LuminousBattleViewerActionAdapter073=wrapped;
    return true;
  }

  function patchCombatActionResolver() {
    const source=global.LuminousCombatActionResolver;
    if (!source?.resolveCombatAction || source.__weaponCantripBatchRuntime) return Boolean(source);
    global.LuminousCombatActionResolver=Object.freeze({
      ...source,
      __weaponCantripBatchRuntime:true,
      resolveCombatAction(input={},context={}) {
        return source.resolveCombatAction(input,{...context,effectHandlers:{...(context.effectHandlers||{}),weapon_cantrip_prepare({actor,effect}){return prepareCantrip(actor,effect?.cantripId);}}});
      }
    });
    return true;
  }

  function install() {
    registerStatuses(); patchCombatEngine(); patchActionAdapter(); patchCombatActionResolver(); return true;
  }
  const api=Object.freeze({
    version:VERSION,STATUS_DEFINITIONS,registerStatuses,getStatus,applyStatus,removeStatus,reduceCount,
    actorLevel,abilityModifier,isMeleeSkill,skillWeight,enchantments,enchantment,materializeSlotEnchantments,
    queueBoomingForNextTurn,activateQueuedBooming,resolveBoomingClash,resolveBoomingTurnEnd,shillelaghFixedPercent,
    prepareCantrip,onHit,patchCombatEngine,patchActionAdapter,patchCombatActionResolver,install
  });
  global.LuminousWeaponCantripBatchRuntime=api;
  install();
  const timer=typeof global.setInterval==="function"?global.setInterval(install,250):null; timer?.unref?.();
  if (typeof module!=="undefined" && module.exports) module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
