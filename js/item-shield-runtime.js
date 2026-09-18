(function (global) {
  "use strict";

  if (global.LuminousShieldRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousShieldRuntime;
    return;
  }

  function safeRequire(path) { if (typeof require !== "function") return null; try { return require(path); } catch (_) { return null; } }
  const Composition = global.LuminousShieldCompositionEngine || safeRequire("./item-shield-composition-engine.js");
  const Wear = global.LuminousDefensiveWearRuntime || safeRequire("./item-defensive-wear-runtime.js");
  if (!Composition || !Wear) throw new Error("Shield composition and defensive wear runtimes are required before LuminousShieldRuntime.");

  const VERSION = 1;
  const STR_RELIEF_THRESHOLD = 3;
  const QUALITY_ORDER = Composition.QUALITY_ORDER || ["ruined","poor","standard","fine","exceptional"];

  function normalizeId(value) { return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,""); }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function itemId(item = {}) { return String(item.instanceId || item.instance_id || item.definitionId || item.itemId || item.id || item.key || "").trim(); }
  function isShield(item = {}) { return normalizeId(item.itemType || item.category || item.equipment?.kind) === "shield" || String(item.chassisId || "").startsWith("shield_"); }
  function dedupe(items) { const out=[]; const ids=new Set(); for(const item of items){ if(!item||!isShield(item))continue; const id=itemId(item)||String(out.length); if(ids.has(id))continue; ids.add(id); out.push(item); } return out; }
  function equippedShields(unit = {}) {
    const e=unit.equipment||{};
    return dedupe([e.mainHand,e.offHand,e.shield,...(Array.isArray(e.shields)?e.shields:[])]);
  }
  function sourceRef(input = {}) {
    return String(input.shieldSourceId || input.equipmentSourceId || input.sourceItemId || input.itemSourceId || input.metadata?.shieldSourceId || input.metadata?.equipmentSourceId || "").trim();
  }
  function resolveShieldSource(unit = {}, input = {}) {
    if (isShield(input)) return input;
    const shields=equippedShields(unit), wanted=sourceRef(input);
    if (wanted) return shields.find((shield)=>[itemId(shield),shield.definitionId,shield.itemId,shield.id,shield.chassisId].map((v)=>String(v||"")).includes(wanted)) || null;
    return shields.length===1 ? shields[0] : null;
  }
  function proficiencyLevel(value) { return Math.max(0,Math.trunc(Number(value)||0)); }
  function guardValue(shield, proficiency = 0) { return Math.max(0,Number(shield?.guard||0)+2*proficiencyLevel(proficiency)); }
  function physicalResistanceSupport(proficiency = 0) {
    const support=Math.min(0.08,0.02+0.02*proficiencyLevel(proficiency));
    return Object.freeze({support,internalDelta:-support});
  }
  function hasStrengthRelief(shield, strengthScore, threshold = STR_RELIEF_THRESHOLD) { return Number(strengthScore)>=Number(shield?.strengthTarget||0)+Number(threshold||0); }
  function relieveWeightEffect(effect, relief) { const n=Number(effect)||0; if(!relief||n>=0)return n; const halved=Math.floor(Math.abs(n)/2); return halved===0?0:-halved; }
  function effectiveWeightEffect(shield, strengthScore, threshold = STR_RELIEF_THRESHOLD) {
    const relief=hasStrengthRelief(shield,strengthScore,threshold), raw=shield?.weightEffect||{min:0,max:0};
    return Object.freeze({strengthRelief:relief,min:relieveWeightEffect(raw.min,relief),max:relieveWeightEffect(raw.max,relief)});
  }
  function attackMode(shield, modeId = "bash") { return (shield?.attackModes||[]).find((mode)=>normalizeId(mode.id)===normalizeId(modeId)) || null; }
  function parryProfile(shield) { const p=shield?.parry||{}; return Object.freeze({enabled:p.enabled===true,tier:Math.max(1,Math.trunc(Number(p.tier)||1)),skillType:"ClashableGuard"}); }

  function prepareSkill(unit, skill = {}, metadata = {}) {
    const out=clone(skill), shield=resolveShieldSource(unit,{...metadata,...skill});
    if(!shield)return out;
    out.__shieldSourceId=itemId(shield)||shield.chassisId;
    out.__shieldSourceObject=shield;
    const wantsParry=metadata.parry===true||skill.parry===true||normalizeId(skill.shieldMode)==="parry";
    const parry=parryProfile(shield);
    if(wantsParry&&parry.enabled){ out.type="ClashableGuard"; out.defenseSubtype="ClashableGuard"; out.isDefense=true; out.isClashable=true; out.tier=skill.tier??parry.tier; }
    if(normalizeId(out.type)==="clashableguard"||normalizeId(out.defenseSubtype)==="clashableguard"){
      out.__shieldClashModifier=Number(shield.clashModifier||0);
      out.__shieldCrackedPower=Number(shield.shieldCrackedPower||0);
      out.__shieldStaggerBonus=Number(shield.staggerOnCrashWin||0);
      out.__shieldExtraCrashWear=Number(shield.extraWearOnCrashContact||0);
    }
    return out;
  }

  function conditionState(shield = {}) {
    const max=Math.max(0,Number(shield.maxDurability??shield.conditionMax??shield.maxCondition??shield.durability??0)||0);
    const current=Math.max(0,Math.min(max,Number(shield.currentDurability??shield.condition??shield.currentCondition??shield.durability??max)||0));
    return {current,max};
  }
  function writeCondition(shield, current, max) {
    shield.maxDurability=max; shield.currentDurability=current;
    if(Object.prototype.hasOwnProperty.call(shield,"conditionMax"))shield.conditionMax=max;
    if(Object.prototype.hasOwnProperty.call(shield,"condition"))shield.condition=current;
    if(Object.prototype.hasOwnProperty.call(shield,"currentCondition"))shield.currentCondition=current;
    shield.durability=current;
  }
  function nextLowerQuality(quality) { const i=QUALITY_ORDER.indexOf(normalizeId(quality)); return i>0?QUALITY_ORDER[i-1]:null; }
  function maxDurabilityForQuality(shield, quality) {
    const raw=Number(shield.rawDurability||0), mult=Number(Composition.QUALITY_DURABILITY?.[quality]||1);
    if(raw>0)return Math.max(1,Math.floor(raw*mult));
    return Math.max(1,conditionState(shield).max);
  }
  function degradeAfterBreak(shield) {
    const quality=normalizeId(shield.quality||"standard"), lower=nextLowerQuality(quality);
    if(!lower){ shield.destroyed=true; writeCondition(shield,0,conditionState(shield).max); return {destroyed:true,quality}; }
    shield.quality=lower;
    const max=maxDurabilityForQuality(shield,lower);
    writeCondition(shield,max,max);
    return {destroyed:false,quality:lower,maxDurability:max};
  }
  function applyWear(shield, amount) {
    if(!shield||shield.destroyed)return Object.freeze({applied:false,reason:"missing_or_destroyed_shield",wear:0});
    const wear=Math.max(0,Math.trunc(Number(amount)||0)); if(!wear)return Object.freeze({applied:false,reason:"zero_wear",wear:0});
    const before=conditionState(shield); let after=Math.max(0,before.current-wear); writeCondition(shield,after,before.max);
    let degradation=null;
    if(after<=0)degradation=degradeAfterBreak(shield);
    return Object.freeze({applied:true,wear,before:before.current,after:conditionState(shield).current,max:conditionState(shield).max,degradation});
  }
  function eventSeen(shield,eventId){ if(!eventId)return false; const ids=Array.isArray(shield.__shieldWearEventIds)?shield.__shieldWearEventIds:[]; return ids.includes(String(eventId)); }
  function rememberEvent(shield,eventId){ if(!eventId)return; const ids=Array.isArray(shield.__shieldWearEventIds)?shield.__shieldWearEventIds.slice():[]; ids.push(String(eventId)); shield.__shieldWearEventIds=ids.slice(-32); }
  function applySkillContactWear(shield,{eventId=null,damage=0,damageType="",crashable=false}={}){
    if(!shield)return Object.freeze({applied:false,reason:"missing_shield",wear:0});
    if(eventSeen(shield,eventId))return Object.freeze({applied:false,reason:"event_already_counted",wear:0});
    const extra=crashable?Number(shield.extraWearOnCrashContact||0):0;
    const wear=Wear.resolveShieldWear({contact:true,damage,damageType,elementalWear:shield.elementalWear,flatReduction:shield.elementalWearFlatReduction,extraContactWear:extra});
    rememberEvent(shield,eventId); return applyWear(shield,wear);
  }
  function protectionRouting(shield,{contact=false}={}) { return Object.freeze({shieldReceivesWear:Boolean(shield&&contact),armorWearBlocked:Boolean(shield&&contact),weaponWearBlocked:Boolean(shield&&contact),otherEquipmentWearBlocked:Boolean(shield&&contact)}); }

  function installCombatBridge(engine = global.CombatEngine) {
    if(!engine||typeof engine!=="object")return false;
    if(engine.__luminousPhysicalShieldPatched)return true;
    const originalCalculate=engine.calculateFinalPower, originalClash=engine.resolveStandardClash, originalGuard=engine.resolveGuard, originalApplyDamage=engine.applyDamage, originalUnilateral=engine.resolveUnilateralWithCounter;
    if(typeof originalCalculate==="function"){
      engine.calculateFinalPower=function(skill,heads,unit){ const value=originalCalculate.call(this,skill,heads,unit); if((skill?.type==="ClashableGuard"||skill?.defenseSubtype==="ClashableGuard")&&Number(skill.__shieldClashModifier||0))return value+Number(skill.__shieldClashModifier||0); return value; };
    }
    if(typeof originalGuard==="function"){
      engine.resolveGuard=function(unitDefender,guardSkill){ const result=originalGuard.call(this,unitDefender,guardSkill); if(guardSkill?.__shieldSourceObject){ unitDefender.__activeGuardShield=guardSkill.__shieldSourceObject; unitDefender.__activeGuardShieldSourceId=guardSkill.__shieldSourceId||itemId(guardSkill.__shieldSourceObject); } return result; };
    }
    if(typeof originalApplyDamage==="function"){
      engine.applyDamage=function(unit,damage,damageType,isCritical,skillUsed){
        const active=unit?.__activeGuardShield;
        const shieldBefore=Number(unit?.shield||0);
        const eventId=String(skillUsed?.__shieldWearEventId||skillUsed?.__combatActionId||"");
        if(active&&shieldBefore>0&&eventId){
          if(!unit.__shieldWearDamage)unit.__shieldWearDamage={};
          const key=eventId;
          const row=unit.__shieldWearDamage[key]||{damage:0,damageType:""};
          row.damage+=Math.max(0,Number(damage)||0);
          row.damageType=normalizeId(skillUsed?.damageType||skillUsed?.attackType||damageType||row.damageType);
          unit.__shieldWearDamage[key]=row;
        }
        return originalApplyDamage.call(this,unit,damage,damageType,isCritical,skillUsed);
      };
    }
    if(typeof originalUnilateral==="function"){
      let legacyEventCounter=0;
      engine.resolveUnilateralWithCounter=function(unitAttacker,attackSkill,unitDefender,counterSkill,options){
        if(unitDefender?.__activeGuardShield&&attackSkill&&!attackSkill.__shieldWearEventId){
          legacyEventCounter+=1;
          attackSkill.__shieldWearEventId=attackSkill.__combatActionId||\`shield_skill_\${legacyEventCounter}\`;
        }
        const eventId=String(attackSkill?.__shieldWearEventId||attackSkill?.__combatActionId||"");
        const result=originalUnilateral.call(this,unitAttacker,attackSkill,unitDefender,counterSkill,options);
        const row=eventId&&unitDefender?.__shieldWearDamage?.[eventId];
        if(row&&unitDefender.__activeGuardShield){
          result.shieldWear=applySkillContactWear(unitDefender.__activeGuardShield,{eventId,damage:row.damage,damageType:row.damageType,crashable:false});
          delete unitDefender.__shieldWearDamage[eventId];
        }
        return result;
      };
    }

    if(typeof originalClash==="function"){
      engine.resolveStandardClash=function(unitA,skillA,unitB,skillB){
        const result=originalClash.call(this,unitA,skillA,unitB,skillB);
        const winner=result?.winner;
        if(winner==="A"||winner==="B"){
          const winnerSkill=winner==="A"?skillA:skillB, loserSkill=winner==="A"?skillB:skillA, loserUnit=winner==="A"?unitB:unitA;
          if(loserSkill?.type==="ClashableGuard"&&Number(loserSkill.__shieldCrackedPower||0)){
            const extra=Number(loserSkill.__shieldCrackedPower||0); result.mitigationPenalty=Number(result.mitigationPenalty||0)+extra; result.shieldCrackedApplied=extra;
          }
          if(winnerSkill?.type==="ClashableGuard"&&Number(winnerSkill.__shieldStaggerBonus||0)&&typeof this.modifyNextStaggerThreshold==="function"){
            const bonus=Number(winnerSkill.__shieldStaggerBonus||0); this.modifyNextStaggerThreshold(loserUnit,bonus); result.shieldStaggerBonusApplied=bonus;
          }
        }
        const event=\`clash_\${Date.now()}_\${Math.random().toString(36).slice(2,8)}\`;
        if(skillA?.__shieldSourceObject)applySkillContactWear(skillA.__shieldSourceObject,{eventId:\`\${event}_a\`,crashable:skillA.type==="ClashableGuard"});
        if(skillB?.__shieldSourceObject)applySkillContactWear(skillB.__shieldSourceObject,{eventId:\`\${event}_b\`,crashable:skillB.type==="ClashableGuard"});
        return result;
      };
    }
    Object.defineProperty(engine,"__luminousPhysicalShieldPatched",{value:true,enumerable:false,configurable:true});
    return true;
  }

  const API=Object.freeze({VERSION,STR_RELIEF_THRESHOLD,equippedShields,resolveShieldSource,guardValue,physicalResistanceSupport,hasStrengthRelief,relieveWeightEffect,effectiveWeightEffect,attackMode,parryProfile,prepareSkill,conditionState,applyWear,applySkillContactWear,protectionRouting,installCombatBridge});
  global.LuminousShieldRuntime=API;
  if(global.CombatEngine) installCombatBridge(global.CombatEngine);
  if(typeof module!=="undefined"&&module.exports)module.exports=API;
})(typeof globalThis!=="undefined"?globalThis:window);
