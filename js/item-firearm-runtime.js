(function (global) {
  "use strict";

  if (global.LuminousFirearmRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousFirearmRuntime;
    return;
  }

  const VERSION = 1;
  const CADENCE_MODES = Object.freeze({
    single:Object.freeze({id:"single",ammoPerCoin:1,damageMultiplier:1.00,powerPenalty:0}),
    rapid:Object.freeze({id:"rapid",ammoPerCoin:2,damageMultiplier:1.10,powerPenalty:-1}),
    burst:Object.freeze({id:"burst",ammoPerCoin:3,damageMultiplier:1.20,powerPenalty:-2}),
    full:Object.freeze({id:"full",ammoPerCoin:4,damageMultiplier:1.30,powerPenalty:-3}),
  });
  const RANGE_PROFILES = Object.freeze(["fastest","slowest","faster","slower"]);
  const FORBIDDEN_AMMO_STATUS = Object.freeze(["decay","radiance"]);

  function normalizeId(value) { return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,""); }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

  function getCadenceMode(id) { const row=CADENCE_MODES[normalizeId(id)]; return row ? clone(row) : null; }

  function resolveCadence(profile, requestedMode) {
    const mode=getCadenceMode(requestedMode || "single");
    if (!mode) return Object.freeze({valid:false,reason:"unknown_cadence_mode"});
    const supported=(profile?.cadenceModes || ["single"]).map(normalizeId);
    if (!supported.includes(mode.id)) return Object.freeze({valid:false,reason:"unsupported_cadence_mode",mode:mode.id});
    const reliability=Number(profile?.reliability || 0);
    const reliabilityRequirement=mode.id === "full" ? 3 : mode.id === "burst" ? 2 : 0;
    if (reliability < reliabilityRequirement) return Object.freeze({valid:false,reason:"insufficient_reliability",mode:mode.id,reliabilityRequirement});
    return Object.freeze({valid:true,...mode,reliabilityRequirement});
  }

  function distributeInteger(total,count) {
    const n=Math.max(1,Math.floor(Number(count)||1));
    const value=Math.max(0,Math.round(Number(total)||0));
    const base=Math.floor(value/n), remainder=value-(base*n);
    return Object.freeze(Array.from({length:n},(_,i)=>base+(i<remainder?1:0)));
  }

  function resolveCoinBallistics(baseHitDamage, cadenceMode, ammoDamagePercents = []) {
    const mode=typeof cadenceMode === "string" ? getCadenceMode(cadenceMode) : cadenceMode;
    if (!mode) return Object.freeze({valid:false,reason:"unknown_cadence_mode"});
    const damagePool=Math.max(0,Math.round(Number(baseHitDamage||0)*Number(mode.damageMultiplier||1)));
    const slices=distributeInteger(damagePool,mode.ammoPerCoin);
    const bulletDamage=slices.map((base,i)=>Math.max(0,Math.round(base*(1+Number(ammoDamagePercents[i] ?? ammoDamagePercents[0] ?? 0)/100))));
    return Object.freeze({
      valid:true,baseHitDamage:Number(baseHitDamage||0),mode:mode.id,ammoSpent:mode.ammoPerCoin,powerPenalty:mode.powerPenalty,damagePool,
      baseBulletDamage:slices,bulletDamage:Object.freeze(bulletDamage),totalDamage:bulletDamage.reduce((a,b)=>a+b,0),
      coinEffectsResolveOnce:true,onHitEffectsResolveOnce:true,statusEffectsResolveOnce:true,
    });
  }

  function applyControl(controlRating,incomingClashPowerLoss) {
    const control=Math.max(0,Math.floor(Number(controlRating)||0));
    const incoming=Math.max(0,Math.floor(Number(incomingClashPowerLoss)||0));
    const absorbed=Math.min(control,incoming);
    return Object.freeze({incomingLoss:incoming,absorbed,remainingLoss:incoming-absorbed,remainingControl:control-absorbed});
  }

  function rangeRelation(profile,userSpeed,targetSpeed,allTargetSpeeds = []) {
    const id=normalizeId(profile);
    if (!RANGE_PROFILES.includes(id)) return "neutral";
    const user=Number(userSpeed),target=Number(targetSpeed),pool=(allTargetSpeeds || []).map(Number).filter(Number.isFinite);
    if (!Number.isFinite(target)) return "neutral";
    if (id === "faster") return Number.isFinite(user) ? (target>user?"optimal":target<user?"inefficient":"neutral") : "neutral";
    if (id === "slower") return Number.isFinite(user) ? (target<user?"optimal":target>user?"inefficient":"neutral") : "neutral";
    if (!pool.length) return "neutral";
    if (id === "fastest") return target === Math.max(...pool) ? "optimal" : "inefficient";
    if (id === "slowest") return target === Math.min(...pool) ? "optimal" : "inefficient";
    return "neutral";
  }

  function rangeDamagePercent(profile,userSpeed,targetSpeed,allTargetSpeeds,efficiencyPercent) {
    const relation=rangeRelation(profile,userSpeed,targetSpeed,allTargetSpeeds);
    const value=Math.max(0,Number(efficiencyPercent)||0);
    return Object.freeze({relation,damagePercent:relation==="optimal"?value:relation==="inefficient"?-value:0});
  }

  function resolveReloadPlan(weaponState = {}, availableAmmo = 0) {
    const capacity=Math.max(0,Math.floor(Number(weaponState.capacity)||0));
    const loaded=Math.max(0,Math.min(capacity,Math.floor(Number(weaponState.loadedAmmo)||0)));
    const available=Math.max(0,Math.floor(Number(availableAmmo)||0));
    const reload=weaponState.reload || {};
    const missing=Math.max(0,capacity-loaded);
    if (!missing) return Object.freeze({valid:false,reason:"already_full",amount:0});
    if (!available) return Object.freeze({valid:false,reason:"no_compatible_active_inventory_ammo",amount:0});
    const mode=normalizeId(reload.mode || "full");
    const requested=mode === "incremental" ? Math.max(1,Math.floor(Number(reload.amount)||1)) : missing;
    const amount=Math.min(missing,available,requested);
    return Object.freeze({valid:true,economy:normalizeId(reload.economy || "action"),mode,amount,loadedAfter:loaded+amount,inventoryAfter:available-amount,requiresActiveInventory:true});
  }

  function validateAmmoStatus(statusId) {
    const id=normalizeId(statusId);
    return Object.freeze({valid:!FORBIDDEN_AMMO_STATUS.includes(id),statusId:id});
  }

  const API=Object.freeze({VERSION,CADENCE_MODES,RANGE_PROFILES,FORBIDDEN_AMMO_STATUS,normalizeId,getCadenceMode,resolveCadence,distributeInteger,resolveCoinBallistics,applyControl,rangeRelation,rangeDamagePercent,resolveReloadPlan,validateAmmoStatus});
  global.LuminousFirearmRuntime=API;
  if (typeof module !== "undefined" && module.exports) module.exports=API;
})(typeof globalThis !== "undefined" ? globalThis : window);
