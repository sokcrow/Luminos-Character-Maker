(function (global) {
  "use strict";

  if (global.LuminousCantripBatchRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCantripBatchRuntime;
    return;
  }

  const VERSION = "0.7.4-cantrips-batch-3";
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const intOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  const STATUS_DEFINITIONS = Object.freeze({
    illusion: Object.freeze({
      name: "Illusion", type: "positive", mode: "single", maxCount: 10,
      icon: "Assets/Icons/status/cantrips/illusion.png",
      description: "Gain +3 Defense Power. On Hit, remove this effect. On Turn End, lose 1 Count."
    }),
    blade_guard: Object.freeze({
      name: "Blade Guard", type: "positive", mode: "zero",
      icon: "Assets/Icons/status/cantrips/blade_guard.png",
      description: "Gain +20% Damage Reduction. Remove this effect on Turn End."
    }),
    sword_burst: Object.freeze({
      name: "Sword Burst", type: "positive", mode: "zero",
      icon: "Assets/Icons/status/cantrips/blade_guard.png",
      description: "After each Clash, deal 3 Force Fixed Damage to the opposing Unit. Once per Clash. Remove on Turn End."
    }),
    dancing_light: Object.freeze({
      name: "Dancing Light", type: "positive", mode: "zero",
      icon: "Assets/Icons/status/cantrips/dancing_light.png",
      description: "Ignore Darkness Disadvantage. Removed when the caster loses Concentration."
    }),
    light: Object.freeze({
      name: "Light", type: "positive", mode: "zero",
      icon: "Assets/Icons/status/cantrips/light.png",
      description: "This Unit and its Adjacent Units ignore Darkness Disadvantage."
    })
  });

  const SPELL_ENTITY_NAMES = Object.freeze({
    produce_flame: "Produce Flame",
    infestation: "Infestation",
    create_bonfire: "Bonfire",
    mage_hand: "Mage Hand"
  });

  const SPELL_ENTITY_SPRITES = Object.freeze({
    infestation: "Assets/Images/SpellUnits/infestation.png",
    create_bonfire: "Assets/Images/SpellUnits/bonfire.png",
    produce_flame: "Assets/Images/SpellUnits/produce_flame.png",
    mage_hand: "Assets/Images/SpellUnits/mage_hand.png"
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
    const engineValue = statusEngine()?.getStatus?.(unit, key);
    if (engineValue) return engineValue;
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
      current.count = Math.max(0, intOr(input.count, current.count || 0));
      current.potency = Math.max(0, intOr(input.potency, current.potency || 0));
    } else {
      current.count = Math.max(0, intOr(current.count, 0) + Math.max(0, intOr(input.count, 0)));
      current.potency = Math.max(0, intOr(current.potency, 0) + Math.max(0, intOr(input.potency, 0)));
    }
    current.data = { ...(current.data || {}), ...(input.data || {}) };
    if (key === "blade_guard" && current.count <= 0 && current.potency <= 0) current.count = 1;
    unit.statusEffects[key] = current;
    return current;
  }

  function removeStatus(unit, id) {
    const key = normalizeId(id);
    if (!unit) return false;
    if (typeof statusEngine()?.removeStatus === "function") return statusEngine().removeStatus(unit, key, { from:"cantrip", ignoreProtection:true });
    if (unit.statusEffects?.[key]) { delete unit.statusEffects[key]; return true; }
    return false;
  }

  function reduceCount(unit, id, amount = 1) {
    const entry = getStatus(unit, id);
    if (!entry) return 0;
    entry.count = Math.max(0, intOr(entry.count, 0) - Math.max(0, intOr(amount, 0)));
    if (entry.count <= 0) removeStatus(unit, id);
    return entry.count;
  }

  function actorLevel(actor = {}) {
    const direct = actor.level ?? actor.Level ?? actor.characterBuild?.calculatedAtLevel;
    if (Number.isFinite(Number(direct))) return Math.max(1, intOr(direct, 1));
    const classes = Array.isArray(actor.classes) ? actor.classes : (Array.isArray(actor.characterBuild?.classes) ? actor.characterBuild.classes : []);
    return Math.max(1, classes.reduce((sum,row)=>sum+Math.max(0,intOr(row?.levels ?? row?.level,0)),0) || 1);
  }

  function spellModFromActor(actor = {}, fallback = 0) {
    const direct = actor.spellMod ?? actor.spellcastingModifier ?? actor.spellcastingMod;
    if (Number.isFinite(Number(direct))) return intOr(direct, fallback);
    const stats = actor.dndStats || actor.stats || {};
    for (const ability of ["wis","int","cha"]) {
      const mod = stats[ability+"Mod"] ?? stats[ability+"_mod"];
      if (Number.isFinite(Number(mod))) return intOr(mod, fallback);
    }
    return fallback;
  }

  function summonMaxHp(summoner = {}, explicitSpellMod = null) {
    const mod = explicitSpellMod == null ? spellModFromActor(summoner, 0) : intOr(explicitSpellMod, 0);
    return Math.max(10, 10 * mod);
  }

  function entityId(entity = {}) { return String(entity.id ?? entity.unitId ?? entity.characterId ?? "").trim(); }
  function sideOf(unit = {}) { return normalizeId(unit.side || unit.team || unit.faction || unit.allegiance || ""); }
  function sameSide(a = {}, b = {}) {
    const sa = sideOf(a), sb = sideOf(b);
    return sa && sb ? sa === sb : false;
  }

  function speedOf(unit = {}) {
    const value = unit.speed ?? unit.currentSpeed ?? unit.velocidad ?? unit.combatStats?.speed;
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function speedOrderedUnits(unitsInput = []) {
    const rows = Array.isArray(unitsInput) ? unitsInput : Object.values(unitsInput || {});
    return rows
      .map((unit,index)=>({unit,index,speed:speedOf(unit)}))
      .filter((row)=>row.unit && entityId(row.unit) && row.speed != null && numberOr(row.unit.hp ?? row.unit.currentHp ?? row.unit.hp_actual,1)>0 && !row.unit.isBackgroundUnit)
      .sort((a,b)=>b.speed-a.speed || a.index-b.index)
      .map((row)=>row.unit);
  }

  function adjacentUnits(mainUnit, unitsInput = []) {
    if (!mainUnit) return [];
    const ordered = speedOrderedUnits(unitsInput);
    const wanted = entityId(mainUnit);
    const index = ordered.findIndex((unit)=>entityId(unit)===wanted);
    if (index < 0) return [];
    return [ordered[index-1],ordered[index+1]].filter(Boolean);
  }

  function darknessOverrideOwn(unit) {
    return Boolean(getStatus(unit,"dancing_light") || getStatus(unit,"light"));
  }

  function ignoresDarknessDisadvantage(unit, unitsInput = []) {
    if (!unit) return false;
    if (darknessOverrideOwn(unit)) return true;
    const rows = Array.isArray(unitsInput) ? unitsInput : Object.values(unitsInput || {});
    return rows.some((source)=>getStatus(source,"light") && adjacentUnits(source,rows).some((adjacent)=>entityId(adjacent)===entityId(unit)));
  }

  function removeCasterStatus(caster, statusId, context = {}) {
    const casterId = entityId(caster);
    let removed = 0;
    for (const unit of Object.values(combatPool(context))) {
      const entry = getStatus(unit,statusId);
      if (!entry) continue;
      if (String(entry.data?.casterId || "") !== casterId) continue;
      if (removeStatus(unit,statusId)) removed++;
    }
    if (Array.isArray(context.units)) {
      for (const unit of context.units) {
        const entry = getStatus(unit,statusId);
        if (!entry || String(entry.data?.casterId || "") !== casterId) continue;
        if (removeStatus(unit,statusId)) removed++;
      }
    }
    return removed;
  }

  function applyLight(caster,target,context = {}) {
    if (!caster || !target) return {ok:false,reason:"target_missing"};
    removeCasterStatus(caster,"light",context);
    applyStatus(target,"light",{mode:"set",count:1,data:{sourceSpellId:"light",casterId:entityId(caster),darknessDisadvantageOverride:true}});
    return {ok:true,status:"light",targetId:entityId(target),adjacentTargetIds:adjacentUnits(target,context.units || combatPool(context)).map(entityId)};
  }

  function applyDancingLights(caster,targets = [],context = {}) {
    if (!caster) return {ok:false,reason:"caster_missing"};
    removeCasterStatus(caster,"dancing_light",context);
    const unique = [];
    for (const unit of targets || []) {
      if (!unit || (!sameSide(caster,unit) && entityId(unit)!==entityId(caster))) continue;
      if (unique.some((row)=>entityId(row)===entityId(unit))) continue;
      unique.push(unit);
      if (unique.length>=4) break;
    }
    if (!unique.length) unique.push(caster);
    unique.forEach((unit)=>applyStatus(unit,"dancing_light",{mode:"set",count:1,data:{sourceSpellId:"dancing_lights",casterId:entityId(caster),darknessDisadvantageOverride:true}}));
    return {ok:true,status:"dancing_light",count:unique.length,targetIds:unique.map(entityId)};
  }

  function isRepairableUnit(unit = {}) {
    const mode = normalizeId(unit.recoveryMode || unit.healingMode || unit.repairMode || unit.metadata?.recoveryMode);
    const creatureType = normalizeId(unit.creatureType || unit.metadata?.creatureType);
    return unit.repairable === true || ["repair","repair_only","repairable"].includes(mode) || creatureType === "construct";
  }

  function repairUnitHp(unit,amount = 5) {
    if (!unit) return {repaired:false,reason:"target_missing",amount:0};
    if (!isRepairableUnit(unit)) return {repaired:false,reason:"target_not_repairable",amount:0};
    const currentKeys = [
      [unit.combatStats,"hp_actual",["hp_max","max_hp","maxHp"]],
      [unit,"hp",["maxHp","maxHP","hp_max","hpMax"]],
      [unit,"currentHp",["maxHp","maxHP","hp_max","hpMax"]]
    ];
    for (const [owner,key,maxKeys] of currentKeys) {
      if (!owner || !Number.isFinite(Number(owner[key]))) continue;
      const maxKey = maxKeys.find((candidate)=>Number.isFinite(Number(owner[candidate])));
      const maximum = maxKey ? Number(owner[maxKey]) : Number(owner[key]);
      const before = Number(owner[key]);
      const after = Math.min(maximum,before+Math.max(0,intOr(amount,0)));
      owner[key]=after;
      return {repaired:after>before,before,after,max:maximum,amount:after-before};
    }
    return {repaired:false,reason:"hp_resource_not_found",amount:0};
  }

  function repairItemDurability(item,amount = 1) {
    if (!item || typeof item!=="object") return {repaired:false,reason:"missing_target_item",amount:0};
    const runtime = global.LuminousItemRuntime;
    if (typeof runtime?.repairItem === "function") return runtime.repairItem(item,amount);
    const max = Math.max(0,numberOr(item.conditionMax ?? item.maxCondition ?? item.maxDurability,100));
    const before = Math.max(0,Math.min(max,numberOr(item.condition ?? item.currentCondition ?? item.currentDurability ?? item.durability,max)));
    const after = Math.min(max,before+Math.max(0,intOr(amount,0)));
    if (Object.prototype.hasOwnProperty.call(item,"condition")) item.condition=after;
    else if (Object.prototype.hasOwnProperty.call(item,"currentDurability")) item.currentDurability=after;
    else if (Object.prototype.hasOwnProperty.call(item,"durability")) item.durability=after;
    else item.condition=after;
    return {repaired:after>before,before,after,max,amount:after-before};
  }

  function weatherLabel(id) {
    const def = global.LuminousWeatherEngine?.getDefinition?.(id);
    return def?.label || def?.name || String(id || "");
  }

  function buildDruidcraftForecast(hours = 24) {
    const weather = global.LuminousWeatherEngine;
    const state = weather?.getState?.();
    if (!weather || !state?.actual?.tipo) return {available:false,hours,entries:[],reason:"weather_runtime_unavailable"};
    const stepMinutes = 180;
    const steps = Math.max(1,Math.ceil((Math.max(1,Number(hours)||24)*60)/stepMinutes));
    const entries = [{etaMin:0,tipo:state.actual.tipo,label:weatherLabel(state.actual.tipo)}];
    const sim = clone(state);
    for (let index=1; index<=steps; index++) {
      const options = weather.getTransitionBreakdown?.(sim.actual?.tipo,sim) || [];
      const best = options[0];
      if (!best) break;
      sim.anterior = sim.actual?.tipo;
      sim.actual = {...(sim.actual||{}),tipo:best.target};
      entries.push({etaMin:index*stepMinutes,tipo:best.target,label:weatherLabel(best.target)});
    }
    return {available:true,hours,entries};
  }

  function druidcraftMode(action = {}) {
    const choice = action?.metadata?.spellChoice || action?.metadata?.choice || {};
    return normalizeId(choice.value || choice.druidcraftMode || choice.mode || action?.metadata?.druidcraftMode || "forecast");
  }

  function emitEvent(name,detail) {
    try {
      if (typeof global.dispatchEvent==="function" && typeof global.CustomEvent==="function") global.dispatchEvent(new global.CustomEvent(name,{detail}));
    } catch (_) {}
  }

  function handleDruidcraft(action,actor,targets,context={}) {
    const mode = druidcraftMode(action);
    const target = targets?.[0] || actor;
    if (mode==="forecast") {
      const forecast = buildDruidcraftForecast(24);
      actor.druidcraftForecast = {...forecast,visible:true,sourceSpellId:"druidcraft"};
      emitEvent("luminous:druidcraft-forecast",{actor,forecast:clone(forecast)});
      return {ok:forecast.available,mode,forecast};
    }
    if (mode==="bloom") {
      const result={ok:true,mode,targetId:entityId(target)||null,smallPlantOnly:true,createsResources:false};
      emitEvent("luminous:druidcraft-bloom",{actor,target,result,context});
      return result;
    }
    if (mode==="nature_trick") {
      const result={ok:true,mode,targetId:entityId(target)||null,harmless:true};
      emitEvent("luminous:druidcraft-nature-trick",{actor,target,result,context});
      return result;
    }
    if (mode==="fire_play") {
      const result={ok:true,mode,targetId:entityId(target)||null,smallOnly:true,nonmagicalOnly:true};
      emitEvent("luminous:druidcraft-fire-play",{actor,target,result,context});
      return result;
    }
    return {ok:false,reason:"unknown_druidcraft_mode",mode};
  }

  function maxHpOf(unit = {}) {
    return Math.max(0, numberOr(unit.maxHp ?? unit.maxHP ?? unit.hp_max ?? unit.combatStats?.hp_max, 0));
  }

  function isBelowMaxHp(unit = {}) {
    const maxHp = maxHpOf(unit);
    return maxHp > 0 && numberOr(unit.hp ?? unit.currentHp ?? unit.currentHP ?? unit.hp_actual, maxHp) < maxHp;
  }

  function combatPool(context = {}) {
    if (context.combatData && typeof context.combatData === "object") return context.combatData;
    if (global.combatData && typeof global.combatData === "object") return global.combatData;
    if (!global.combatData || typeof global.combatData !== "object") global.combatData = {};
    return global.combatData;
  }

  function rememberEntity(summoner, entity) {
    if (!summoner || !entity) return;
    if (!summoner.__luminousSpellEntities || typeof summoner.__luminousSpellEntities !== "object") summoner.__luminousSpellEntities = {};
    summoner.__luminousSpellEntities[entity.id] = entity;
  }

  function forgetEntity(summoner, entityIdValue) {
    if (summoner?.__luminousSpellEntities) delete summoner.__luminousSpellEntities[entityIdValue];
  }

  function despawnEntity(entity, context = {}) {
    if (!entity) return false;
    entity.__despawned = true;
    if (Number.isFinite(Number(entity.hp))) entity.hp = 0;
    const pool = combatPool(context);
    if (pool[entity.id] === entity || pool[entity.id]) delete pool[entity.id];
    if (Array.isArray(context.units)) {
      const index = context.units.findIndex((row) => entityId(row) === entity.id);
      if (index >= 0) context.units.splice(index, 1);
    }
    const summoner = Object.values(pool).find((row) => entityId(row) === entity.summonerId) || context.summoner || null;
    forgetEntity(summoner, entity.id);
    return true;
  }

  function despawnSpellEntities(summoner, spellId, context = {}) {
    const id = normalizeId(spellId);
    let removed = 0;
    const refs = Object.values(summoner?.__luminousSpellEntities || {});
    for (const entity of refs) {
      if (normalizeId(entity?.sourceSpellId) !== id) continue;
      if (despawnEntity(entity, context)) removed++;
    }
    return removed;
  }

  function replaceExistingSpellEntity(summoner, spellId, context = {}) {
    return despawnSpellEntities(summoner, spellId, context);
  }

  function entitySkill(spellId, summonerLevel) {
    const level = Math.max(1, intOr(summonerLevel, 1));
    if (spellId === "produce_flame") {
      return {
        id:"produce_flame_flame", name:"Flame", type:"Spell", targetingType:"focused_attack", targeting_type:"Focused Attack",
        attackWeight:1, atkWeight:1, basePower:4, coinPower:3+Math.floor(level/15), coinAmount:1, coins:1,
        summonerLevel:level, sourceSpellId:"produce_flame", resolution:"attack"
      };
    }
    if (spellId === "infestation") {
      return {
        id:"infestation_swarm", name:"Swarm", type:"Spell", targetingType:"focused_attack", targeting_type:"Focused Attack",
        attackWeight:1, atkWeight:1, basePower:4, coinPower:3+Math.floor(level/20), coinAmount:1, coins:1,
        summonerLevel:level, sourceSpellId:"infestation", resolution:"unopposed"
      };
    }
    return null;
  }

  function spawnSpellEntity(summoner, spellId, options = {}) {
    const id = normalizeId(spellId);
    const context = options.context || {};
    const kind = normalizeId(options.kind || (id === "produce_flame" ? "background_unit" : "summon"));
    replaceExistingSpellEntity(summoner, id, context);
    const summonerId = entityId(summoner) || "summoner";
    const level = Math.max(1, intOr(options.summonerLevel ?? actorLevel(summoner), 1));
    const spellMod = intOr(options.spellMod ?? spellModFromActor(summoner, 0), 0);
    const summon = kind === "summon";
    const maxHp = summon ? summonMaxHp(summoner, spellMod) : null;
    const unit = {
      id: `${kind}:${id}:${summonerId}`,
      unitId: `${kind}:${id}:${summonerId}`,
      name: SPELL_ENTITY_NAMES[id] || id,
      actorCategory: kind,
      sourceSpellId: id,
      summonerId,
      summonerLevel: level,
      summonerSpellMod: spellMod,
      side: summoner.side,
      team: summoner.team,
      faction: summoner.faction,
      isSummon: summon,
      isBackgroundUnit: kind === "background_unit",
      targetable: summon,
      hp: summon ? maxHp : null,
      maxHp: summon ? maxHp : null,
      actionSlots: 0,
      activeSlots: 0,
      statusEffects: {},
      skills: [],
      concentrationBound: options.concentrationBound === true,
      visual: {
        spriteUrl: SPELL_ENTITY_SPRITES[id] || "",
        spritePending: !SPELL_ENTITY_SPRITES[id]
      },
      combatSprite: SPELL_ENTITY_SPRITES[id] || "",
      sprite: SPELL_ENTITY_SPRITES[id] || ""
    };
    const skill = entitySkill(id, level);
    if (skill) unit.skills.push(skill);
    const pool = combatPool(context);
    pool[unit.id] = unit;
    if (Array.isArray(context.units) && !context.units.some((row)=>entityId(row)===unit.id)) context.units.push(unit);
    rememberEntity(summoner, unit);
    return unit;
  }

  function sizeAtLeastLarge(unit = {}) {
    const size = normalizeId(unit.size || unit.creatureSize || unit.creature_size || "");
    return ["large","huge","gargantuan"].includes(size);
  }

  function handleAutomaticCantrip({ action, actor, targets, context } = {}) {
    const id = normalizeId(action?.source?.id);
    if (id === "minor_illusion") {
      const target = targets?.[0] || actor;
      if (!target) return { ok:false, reason:"target_missing" };
      if (sizeAtLeastLarge(target)) return { ok:false, reason:"minor_illusion_target_too_large" };
      applyStatus(target,"illusion",{count:10,mode:"set",data:{sourceSpellId:id,casterId:entityId(actor)}});
      return { ok:true,status:"illusion",count:10,targetId:entityId(target) };
    }
    if (id === "produce_flame") {
      const entity = spawnSpellEntity(actor,id,{kind:"background_unit",summonerLevel:action?.metadata?.sourceDefinition?.materializedAtLevel || actorLevel(actor),spellMod:action?.metadata?.spellMod,concentrationBound:true,context});
      return { ok:true,entity };
    }
    if (id === "infestation") {
      const entity = spawnSpellEntity(actor,id,{kind:"summon",summonerLevel:action?.metadata?.sourceDefinition?.materializedAtLevel || actorLevel(actor),spellMod:action?.metadata?.spellMod,context});
      return { ok:true,entity };
    }
    if (id === "create_bonfire") {
      const entity = spawnSpellEntity(actor,id,{kind:"summon",summonerLevel:action?.metadata?.sourceDefinition?.materializedAtLevel || actorLevel(actor),spellMod:action?.metadata?.spellMod,concentrationBound:true,context});
      return { ok:true,entity };
    }
    if (id === "blade_ward") return { ok:true,preCombat:true };
    if (id === "sword_burst") {
      applyStatus(actor,"sword_burst",{mode:"set",count:1,data:{sourceSpellId:id,casterId:entityId(actor)}});
      return {ok:true,status:"sword_burst",targetId:entityId(actor)};
    }
    if (id === "dancing_lights") return applyDancingLights(actor,targets?.length ? targets : [actor],context);
    if (id === "light") return applyLight(actor,targets?.[0] || actor,context);
    if (id === "mending") {
      const target = targets?.[0] || null;
      if (!target) return {ok:false,reason:"target_missing"};
      const repair = repairUnitHp(target,5);
      return {ok:repair.repaired,repair,targetId:entityId(target),reason:repair.reason || null};
    }
    if (id === "druidcraft") return handleDruidcraft(action,actor,targets,context);
    return { ok:false,reason:"unsupported_cantrip_runtime" };
  }

  function applyBladeWardPlans(allUnits = []) {
    const planSources = [
      global.sharedPlannedActions,
      global.LuminousBattleViewerPlayerSpellPlanner074?.state?.plans
    ].filter((value)=>value && typeof value === "object");
    const units = Array.isArray(allUnits) ? allUnits : [];
    const byId = new Map(units.map((unit)=>[entityId(unit),unit]));
    for (const source of planSources) {
      for (const slots of Object.values(source)) {
        if (!slots || typeof slots !== "object") continue;
        for (const plan of Object.values(slots)) {
          if (normalizeId(plan?.spellId) !== "blade_ward") continue;
          const unit = byId.get(String(plan.unitId || "")) || global.combatData?.[plan.unitId];
          if (!unit) continue;
          applyStatus(unit,"blade_guard",{mode:"set",count:1,data:{sourceSpellId:"blade_ward"}});
        }
      }
    }
  }

  function applyBonfirePresence(allUnits = []) {
    const units = Array.isArray(allUnits) ? allUnits : [];
    const bonfires = units.filter((unit)=>unit?.isSummon && normalizeId(unit.sourceSpellId)==="create_bonfire" && numberOr(unit.hp,0)>0);
    for (const bonfire of bonfires) {
      const summoner = units.find((unit)=>entityId(unit)===bonfire.summonerId) || global.combatData?.[bonfire.summonerId] || null;
      if (!summoner) continue;
      for (const target of units) {
        if (!target || target===bonfire || numberOr(target.hp,1)<=0 || sameSide(summoner,target)) continue;
        applyStatus(target,"burn",{potency:1,count:1,mode:"gain",data:{sourceSpellId:"create_bonfire",summonerId:bonfire.summonerId}});
      }
    }
  }

  function onCantripHit(context = {}) {
    const attacker = context.unitAttacker || context.attacker || null;
    const target = context.currentTarget || context.defender || null;
    const skill = context.skill || {};
    if (!target) return;

    if (getStatus(target,"illusion")) removeStatus(target,"illusion");

    const skillId = normalizeId(skill.id || skill.sourceSpellId);
    const level = Math.max(1,intOr(skill.materializedAtLevel ?? skill.summonerLevel ?? actorLevel(attacker),1));

    if (skillId === "thorn_whip") {
      const amount = 1 + Math.floor(level/15);
      applyStatus(target,"bind",{count:amount,mode:"gain",data:{sourceSpellId:"thorn_whip"}});
      applyStatus(target,"rupture",{potency:amount,count:1,mode:"gain",data:{sourceSpellId:"thorn_whip"}});
    } else if (skillId === "lightning_lure") {
      const amount = 1 + Math.floor(level/15);
      applyStatus(target,"bind",{count:amount,mode:"gain",data:{sourceSpellId:"lightning_lure"}});
      applyStatus(target,"shock",{count:amount,mode:"gain",data:{sourceSpellId:"lightning_lure"}});
    } else if (skillId === "acid_splash") {
      const amount = 1 + Math.floor(level/15);
      applyStatus(target,"corrosion",{count:amount,mode:"gain",data:{sourceSpellId:"acid_splash"}});
    } else if (skillId === "ray_of_frost") {
      const amount = 1 + Math.floor(level/15);
      applyStatus(target,"bind",{count:2,mode:"gain",data:{sourceSpellId:"ray_of_frost"}});
      applyStatus(target,"chill",{count:amount,mode:"gain",data:{sourceSpellId:"ray_of_frost"}});
    } else if (skillId === "frostbite") {
      const amount = 1 + Math.floor(level/15);
      applyStatus(target,"attack_power_down",{count:1,mode:"gain",data:{sourceSpellId:"frostbite"}});
      applyStatus(target,"chill",{count:amount,mode:"gain",data:{sourceSpellId:"frostbite"}});
    } else if (skillId === "sacred_flame") {
      const amount = 1 + Math.floor(level/15);
      applyStatus(target,"radiance",{count:amount,mode:"gain",data:{sourceSpellId:"sacred_flame"}});
    } else if (skillId === "shocking_grasp") {
      const amount = 1 + Math.floor(level/15);
      applyStatus(target,"shock",{count:amount,mode:"gain",data:{sourceSpellId:"shocking_grasp"}});
    } else if (skillId === "toll_the_dead") {
      const amount = 1 + Math.floor(level/15);
      applyStatus(target,"decay",{count:amount,mode:"gain",data:{sourceSpellId:"toll_the_dead"}});
    } else if (skillId === "word_of_radiance") {
      const amount = 1 + Math.floor(level/15);
      applyStatus(target,"radiance",{count:amount,mode:"gain",data:{sourceSpellId:"word_of_radiance"}});
    } else if (skillId === "thunderclap") {
      const amount = 1 + Math.floor(level/15);
      applyStatus(target,"tremor",{potency:amount,mode:"gain",data:{sourceSpellId:"thunderclap"}});
    } else if (skillId === "sapping_sting") {
      const amount = 1 + Math.floor(level/15);
      applyStatus(target,"prone",{count:1,mode:"gain",data:{sourceSpellId:"sapping_sting"}});
      applyStatus(target,"decay",{count:amount,mode:"gain",data:{sourceSpellId:"sapping_sting"}});
    } else if (skillId === "primal_savagery") {
      const amount = 1 + Math.floor(level/15);
      applyStatus(target,"corrosion",{count:amount,mode:"gain",data:{sourceSpellId:"primal_savagery"}});
    }

    const sourceSpellId = normalizeId(attacker?.sourceSpellId || skill.sourceSpellId);
    if (sourceSpellId === "infestation") {
      const amount = 1 + Math.floor(Math.max(1,intOr(attacker?.summonerLevel ?? level,1))/15);
      applyStatus(target,"poison",{potency:amount,mode:"gain",data:{sourceSpellId:"infestation",summonerId:attacker?.summonerId}});
    } else if (sourceSpellId === "produce_flame") {
      const amount = 1 + Math.floor(Math.max(1,intOr(attacker?.summonerLevel ?? level,1))/15);
      applyStatus(target,"burn",{potency:amount,count:1,mode:"gain",data:{sourceSpellId:"produce_flame",summonerId:attacker?.summonerId}});
    }
  }

  function summonFor(actor, spellId) {
    return Object.values(actor?.__luminousSpellEntities || {}).find((entity)=>normalizeId(entity?.sourceSpellId)===normalizeId(spellId) && !entity?.__despawned) || null;
  }

  function resolveInfestationFollowUp(context = {}) {
    const engine = context.engine || global.CombatEngine;
    const summoner = context.unitAttacker || context.attacker || null;
    const target = context.currentTarget || context.defender || null;
    const skill = context.skill || {};
    if (!engine?.resolveUnilateralWithCounter || !summoner || !target) return null;
    if (summoner.isSummon || summoner.isBackgroundUnit || skill.isDefense) return null;
    const infestation = summonFor(summoner,"infestation");
    if (!infestation || numberOr(infestation.hp,0)<=0) return null;
    const swarm = clone(infestation.skills?.[0] || entitySkill("infestation",infestation.summonerLevel));
    if (!swarm) return null;
    swarm.__luminousSummonFollowUp = true;
    return engine.resolveUnilateralWithCounter(infestation,swarm,target,null,{
      skipUseHooks:false,
      combatants:context.combatants || context.units || Object.values(global.combatData || {})
    });
  }

  function reuseCountForLevel(level) { return Math.max(0,Math.min(3,Math.floor(Math.max(1,intOr(level,1))/30))); }

  function eligibleEnemyTargets(attacker, context = {}) {
    const list = Array.isArray(context.combatants) ? context.combatants : (Array.isArray(context.units) ? context.units : Object.values(global.combatData || {}));
    return list.filter((unit)=>unit && numberOr(unit.hp,1)>0 && entityId(unit)!==entityId(attacker) && !sameSide(attacker,unit));
  }

  function resolveEldritchReuses(context = {}) {
    const engine = context.engine || global.CombatEngine;
    const attacker = context.unitAttacker || context.attacker || null;
    const originalTarget = context.currentTarget || context.defender || null;
    const skill = context.skill || {};
    if (!engine?.resolveUnilateralWithCounter || !attacker || !originalTarget) return [];
    if (normalizeId(skill.id)!=="eldritch_blast" || skill.__luminousEldritchReuseChild) return [];
    const level = Math.max(1,intOr(skill.materializedAtLevel ?? actorLevel(attacker),1));
    const count = Math.max(0,intOr(skill.__luminousReuseCount,reuseCountForLevel(level)));
    if (!count) return [];
    const requestedIds = Array.isArray(skill.__luminousReuseTargetIds) ? skill.__luminousReuseTargetIds.map(String) : [];
    const enemies = eligibleEnemyTargets(attacker,context);
    const results = [];
    for (let index=0; index<count; index++) {
      let target = requestedIds[index] ? enemies.find((unit)=>entityId(unit)===requestedIds[index]) : null;
      if (!target && numberOr(originalTarget.hp,1)>0) target = originalTarget;
      if (!target) target = enemies.find((unit)=>numberOr(unit.hp,1)>0) || null;
      if (!target) break;
      const reuseSkill = clone(skill);
      reuseSkill.__luminousEldritchReuseChild = true;
      reuseSkill.__luminousReuseIndex = index + 1;
      results.push(engine.resolveUnilateralWithCounter(attacker,reuseSkill,target,null,{
        skipUseHooks:false,
        combatants:context.combatants || context.units || Object.values(global.combatData || {})
      }));
    }
    return results;
  }

  function cleanupDeadSummons(context = {}) {
    const pool = combatPool(context);
    let removed = 0;
    for (const unit of Object.values(pool)) {
      if (!unit?.isSummon) continue;
      if (numberOr(unit.hp,0)>0) continue;
      if (despawnEntity(unit,context)) removed++;
    }
    return removed;
  }

  function patchCombatEngine() {
    const engine = global.CombatEngine;
    if (!engine || engine.__cantripBatchRuntime) return Boolean(engine);

    const originalTriggerEvent = typeof engine.triggerEvent === "function" ? engine.triggerEvent : null;
    const originalTriggerPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase : null;
    const originalCalculateFinalPower = typeof engine.calculateFinalPower === "function" ? engine.calculateFinalPower : null;
    const originalCalculateCoinDamage = typeof engine.calculateCoinDamage === "function" ? engine.calculateCoinDamage : null;
    const originalResolveUnilateralWithCounter = typeof engine.resolveUnilateralWithCounter === "function" ? engine.resolveUnilateralWithCounter : null;
    const originalResolveStandardClash = typeof engine.resolveStandardClash === "function" ? engine.resolveStandardClash : null;

    if (originalCalculateFinalPower) {
      engine.calculateFinalPower = function(skill, headsFlipped, unit = null) {
        const value = originalCalculateFinalPower.call(this,skill,headsFlipped,unit);
        return skill?.isDefense && getStatus(unit,"illusion") ? value + 3 : value;
      };
    }

    if (originalCalculateCoinDamage) {
      engine.calculateCoinDamage = function(attacker,defender,skill,coinFinalPower,isCritical,clashCount,context=null) {
        let value = originalCalculateCoinDamage.call(this,attacker,defender,skill,coinFinalPower,isCritical,clashCount,context);
        const skillId = normalizeId(skill?.id || skill?.sourceSpellId);
        if (skillId === "toll_the_dead" && isBelowMaxHp(defender)) {
          const level = Math.max(1,intOr(skill?.materializedAtLevel ?? actorLevel(attacker),1));
          const bonusPercent = 20 + Math.floor(level/5);
          value = Math.max(0,Math.floor(numberOr(value,0) * (1 + bonusPercent/100)));
        }
        return getStatus(defender,"blade_guard") ? Math.max(0,Math.floor(numberOr(value,0)*0.8)) : value;
      };
    }

    if (originalResolveUnilateralWithCounter) {
      engine.resolveUnilateralWithCounter = function(unitAttacker,attackSkill,unitDefender,counterSkill,options={skipUseHooks:false,clashResult:null}) {
        const skillId = normalizeId(attackSkill?.id || attackSkill?.sourceSpellId);
        const suppressCounter = skillId === "shocking_grasp" || attackSkill?.luminousMechanics?.suppressCounter === true;
        return originalResolveUnilateralWithCounter.call(this,unitAttacker,attackSkill,unitDefender,suppressCounter ? null : counterSkill,options);
      };
    }

    if (originalResolveStandardClash) {
      engine.resolveStandardClash = function(unitA,skillA,unitB,skillB,...rest) {
        const result = originalResolveStandardClash.call(this,unitA,skillA,unitB,skillB,...rest);
        const fixed = global.LuminousFixedDamageRuntime;
        const applyBurst = (source,opponent) => {
          if (!getStatus(source,"sword_burst") || !opponent) return null;
          if (typeof fixed?.applyFixedDamage === "function") return fixed.applyFixedDamage(opponent,3,{engine:this,damageKind:"directo",skillUsed:null});
          if (typeof this.applyDamage === "function") return this.applyDamage(opponent,3,"directo",false,null);
          return null;
        };
        if (result && result.winner !== "Unclashable") {
          applyBurst(unitA,unitB);
          applyBurst(unitB,unitA);
        }
        return result;
      };
    }

    if (originalTriggerEvent) {
      engine.triggerEvent = function(tag,context,targetsHit=[]) {
        const result = originalTriggerEvent.call(this,tag,context,targetsHit);
        const key = normalizeId(tag);
        if (key==="on_hit") onCantripHit(context||{});
        if (key==="attack_end") {
          resolveInfestationFollowUp({...context,engine:this});
          resolveEldritchReuses({...context,engine:this});
        }
        return result;
      };
    }

    if (originalTriggerPhase) {
      engine.triggerPhase = function(phaseTag,allUnits=[],...rest) {
        const phase = normalizeId(phaseTag);
        if (["combat_start","round_start"].includes(phase)) applyBladeWardPlans(allUnits);
        if (["turn_start","round_start"].includes(phase)) applyBonfirePresence(allUnits);
        const result = originalTriggerPhase.call(this,phaseTag,allUnits,...rest);
        if (["turn_end","round_end"].includes(phase)) {
          for (const unit of allUnits || []) {
            if (getStatus(unit,"illusion")) reduceCount(unit,"illusion",1);
            if (getStatus(unit,"blade_guard")) removeStatus(unit,"blade_guard");
            if (getStatus(unit,"sword_burst")) removeStatus(unit,"sword_burst");
          }
          cleanupDeadSummons({units:allUnits,combatData:global.combatData});
        }
        return result;
      };
    }

    Object.defineProperty(engine,"__cantripBatchRuntime",{value:true,configurable:true});
    return true;
  }

  function patchActionAdapter() {
    const source = global.LuminousBattleViewerActionAdapter073;
    if (!source?.compilePlan || source.__cantripBatchRuntime) return Boolean(source);
    const automaticIds = new Set(["minor_illusion","produce_flame","blade_ward","infestation","create_bonfire","sword_burst","dancing_lights","light","mending","druidcraft"]);
    const wrapped = Object.freeze({
      ...source,
      __cantripBatchRuntime:true,
      compilePlan(slotId,explicitTargetSlotId=null,providedPlan=null) {
        const result = source.compilePlan(slotId,explicitTargetSlotId,providedPlan);
        const action = result?.action;
        if (!action || normalizeId(action.source?.type)!=="spell") return result;
        const id = normalizeId(action.source?.id);
        if (automaticIds.has(id)) {
          action.effects = [...(action.effects||[]),{type:"cantrip_batch_effect",spellId:id}];
          action.resolution = {type:"automatic"};
        }
        if (id==="eldritch_blast") {
          const definition = action.metadata?.sourceDefinition || {};
          const level = Math.max(1,intOr(definition.materializedAtLevel,1));
          definition.__luminousReuseCount = reuseCountForLevel(level);
          definition.__luminousReuseTargeting = "same_or_different";
          action.metadata.sourceDefinition = definition;
          action.metadata.reuseSkillCount = definition.__luminousReuseCount;
        }
        if (id==="shocking_grasp") {
          const definition = action.metadata?.sourceDefinition || {};
          definition.suppressCounter = true;
          action.metadata.sourceDefinition = definition;
          action.metadata.suppressCounter = true;
        }
        return result;
      }
    });
    global.LuminousBattleViewerActionAdapter073 = wrapped;
    return true;
  }

  function installCombatHook() {
    const current = global.LuminousBattleViewerCombatHooks073 || {};
    if (current.__cantripBatchRuntime) return true;
    global.LuminousBattleViewerCombatHooks073 = Object.freeze({
      ...current,
      __cantripBatchRuntime:true,
      effectHandlers:Object.freeze({
        ...(current.effectHandlers||{}),
        cantrip_batch_effect:handleAutomaticCantrip
      })
    });
    return true;
  }

  function patchConcentrationRuntime() {
    const source = global.LuminousSpellcastingRuntime;
    if (!source?.startConcentration || !source?.endConcentration || source.__cantripEntityConcentrationBridge) return Boolean(source);
    const wrapped = Object.freeze({
      ...source,
      __cantripEntityConcentrationBridge:true,
      startConcentration(character,spell={},options={}) {
        const previous = character?.spellcastingState?.concentration?.active?.spellId || null;
        const nextId = normalizeId(spell.id || spell.name);
        if (previous && normalizeId(previous)!==nextId) {
          despawnSpellEntities(character,previous,{combatData:global.combatData});
          if (normalizeId(previous)==="dancing_lights") removeCasterStatus(character,"dancing_light",{combatData:global.combatData});
        }
        return source.startConcentration(character,spell,options);
      },
      endConcentration(character,reason="ended") {
        const result = source.endConcentration(character,reason);
        const previous = result?.previous?.spellId;
        if (previous) {
          despawnSpellEntities(character,previous,{combatData:global.combatData});
          if (normalizeId(previous)==="dancing_lights") removeCasterStatus(character,"dancing_light",{combatData:global.combatData});
        }
        return result;
      }
    });
    global.LuminousSpellcastingRuntime = wrapped;
    return true;
  }

  function install() {
    registerStatuses();
    patchCombatEngine();
    patchActionAdapter();
    installCombatHook();
    patchConcentrationRuntime();
    return true;
  }

  const api = Object.freeze({
    version:VERSION, STATUS_DEFINITIONS,
    registerStatuses,getStatus,applyStatus,removeStatus,reduceCount,
    actorLevel,spellModFromActor,summonMaxHp,speedOf,speedOrderedUnits,adjacentUnits,ignoresDarknessDisadvantage,maxHpOf,isBelowMaxHp,
    spawnSpellEntity,despawnEntity,despawnSpellEntities,entitySkill,
    handleAutomaticCantrip,applyBladeWardPlans,applyBonfirePresence,onCantripHit,
    applyLight,applyDancingLights,isRepairableUnit,repairUnitHp,repairItemDurability,buildDruidcraftForecast,handleDruidcraft,
    resolveInfestationFollowUp,reuseCountForLevel,resolveEldritchReuses,cleanupDeadSummons,
    patchCombatEngine,patchActionAdapter,installCombatHook,patchConcentrationRuntime,install
  });

  if (!global.LuminousSpeedAdjacencyRuntime) {
    global.LuminousSpeedAdjacencyRuntime = Object.freeze({speedOf,speedOrderedUnits,adjacentUnits});
  }
  global.LuminousCantripBatchRuntime = api;
  install();
  const timer = typeof global.setInterval === "function" ? global.setInterval(install,250) : null;
  timer?.unref?.();

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
