(function (global) {
  "use strict";

  if (global.LuminousAngeloSpellBatchRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousAngeloSpellBatchRuntime;
    return;
  }

  const VERSION = "0.7.4-angelo-batch-1";
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const intOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;

  const STATUS_DEFINITIONS = Object.freeze({
    mirror_image: Object.freeze({
      name: "Mirror Image", type: "positive", mode: "double",
      icon: "https://imgur.com/GGpUQv0.png", maxPotency: 3, maxCount: 10,
      description: "Potency is remaining Images; Count is duration. Before getting hit, consume 1 Potency and use Evade with +50 Defense Power. Lose 1 Count at Turn End and remove at Encounter End."
    }),
    hypnotic_pattern: Object.freeze({
      name: "Hypnotic Pattern", type: "negative", mode: "single",
      icon: "https://imgur.com/MKPqZ8j.png", maxCount: 10,
      description: "Lock all Action Slots, set Speed to 1, and prevent Actions. Taking Damage or allied Assist removes the effect. Lose 1 Count at Turn End."
    }),
    silvery_barbs_bad: Object.freeze({
      name: "Silvery Barbs", variant: "bad", type: "negative", mode: "single",
      icon: "https://imgur.com/zDToyxB.png", maxCount: 1, finalPowerModifier: -2,
      description: "-2 Final Power. On Clash, Save, or Check End lose 1 Count."
    }),
    silvery_barbs_good: Object.freeze({
      name: "Silvery Barbs", variant: "good", type: "positive", mode: "single",
      icon: "https://imgur.com/WLAtTRS.png", maxCount: 1, finalPowerModifier: 2,
      description: "+2 Final Power. On Clash, Save, or Check End lose 1 Count."
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
  function elementalRuntime() { return global.LuminousElementalStatusRuntime || null; }

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
    if (typeof elementalRuntime()?.applyStatus === "function") return elementalRuntime().applyStatus(unit, key, input);
    if (typeof statusEngine()?.applyStatus === "function") return statusEngine().applyStatus(unit, key, input);
    if (!unit.statusEffects || typeof unit.statusEffects !== "object" || Array.isArray(unit.statusEffects)) unit.statusEffects = {};
    const current = unit.statusEffects[key] || { id: key, count: 0, potency: 0, data: {} };
    const mode = normalizeId(input.mode || "gain");
    const count = Math.max(0, numberOr(input.count, 0));
    const potency = Math.max(0, numberOr(input.potency, 0));
    current.count = mode === "set" ? count : Math.max(0, numberOr(current.count, 0) + count);
    current.potency = mode === "set" ? potency : Math.max(0, numberOr(current.potency, 0) + potency);
    current.data = { ...(current.data || {}), ...(input.data || {}) };
    const definition = registry()[key] || {};
    if (Number.isFinite(Number(definition.maxCount))) current.count = Math.min(Number(definition.maxCount), current.count);
    if (Number.isFinite(Number(definition.maxPotency))) current.potency = Math.min(Number(definition.maxPotency), current.potency);
    unit.statusEffects[key] = current;
    return current;
  }

  function removeStatus(unit, id) {
    if (!unit) return false;
    const key = normalizeId(id);
    if (typeof statusEngine()?.removeStatus === "function") return statusEngine().removeStatus(unit, key, { from: "spell", ignoreProtection: true });
    if (unit.statusEffects?.[key]) { delete unit.statusEffects[key]; return true; }
    return false;
  }

  function reduceCount(unit, id, amount = 1) {
    const entry = getStatus(unit, id);
    if (!entry) return 0;
    entry.count = Math.max(0, numberOr(entry.count, 0) - Math.max(0, numberOr(amount, 0)));
    if (entry.count <= 0) removeStatus(unit, id);
    return entry.count;
  }

  function reducePotency(unit, id, amount = 1) {
    const entry = getStatus(unit, id);
    if (!entry) return 0;
    entry.potency = Math.max(0, numberOr(entry.potency, 0) - Math.max(0, numberOr(amount, 0)));
    return entry.potency;
  }

  function readSp(unit = {}) {
    if (typeof elementalRuntime()?.readSp === "function") return elementalRuntime().readSp(unit);
    const combat = unit.combatStats || {};
    return numberOr(unit.sp ?? unit.currentSp ?? unit.currentSP ?? combat.sp_actual ?? combat.sp, 0);
  }

  function writeSp(unit, value) {
    if (!unit) return null;
    const next = numberOr(value, 0);
    let wrote = false;
    for (const key of ["sp", "currentSp", "currentSP", "sp_actual"]) {
      if (Object.prototype.hasOwnProperty.call(unit, key)) { unit[key] = next; wrote = true; }
    }
    if (unit.combatStats && typeof unit.combatStats === "object") {
      for (const key of ["sp_actual", "sp", "currentSp"]) {
        if (Object.prototype.hasOwnProperty.call(unit.combatStats, key)) { unit.combatStats[key] = next; wrote = true; }
      }
    }
    if (!wrote) unit.sp = next;
    return next;
  }

  function spellId(skill = {}) { return normalizeId(skill.id || skill.spellId || skill.sourceId || skill.libraryKey); }
  function targetFromContext(context = {}) { return context.currentTarget || context.defender || context.target || null; }
  function attackerFromContext(context = {}) { return context.unitAttacker || context.attacker || context.self || null; }
  function unitId(unit = {}) { return String(unit.id || unit.unitId || unit.characterId || ""); }

  function viciousMockeryAmount(skill = {}, attacker = {}) {
    const level = Math.max(1, intOr(skill.characterLevel ?? skill.unitLevel ?? attacker.level ?? attacker.characterLevel, 1));
    return 1 + Math.floor(level / 20);
  }

  function applyViciousMockery(target, skill = {}, attacker = {}) {
    if (!target) return null;
    const amount = viciousMockeryAmount(skill, attacker);
    applyStatus(target, "sinking", { potency: amount, count: amount, mode: "gain", data: { sourceSpellId: "vicious_mockery" } });
    applyStatus(target, "clash_power_down", { count: 2, mode: "gain", data: { sourceSpellId: "vicious_mockery", expiresOnNextClash: true } });
    return { sinking: amount, sinkingCount: amount, clashPowerDown: 2 };
  }

  function grantMirrorImage(unit) {
    return applyStatus(unit, "mirror_image", { potency: 3, count: 10, mode: "set", data: { sourceSpellId: "mirror_image" } });
  }

  function consumeMirrorImageForHit(unit, context = {}) {
    const mirror = getStatus(unit, "mirror_image");
    if (!mirror || numberOr(mirror.potency, 0) <= 0) return null;
    reducePotency(unit, "mirror_image", 1);
    const defense = { type: "evade", defensePowerBonus: 50, sourceStatus: "mirror_image" };
    context.forceDefense = defense;
    context.mirrorImageDefense = defense;
    return defense;
  }

  function applySilveryBarbs(badUnit, goodUnit) {
    if (!badUnit || !goodUnit || badUnit === goodUnit || unitId(badUnit) && unitId(badUnit) === unitId(goodUnit)) {
      return { ok: false, reason: "distinct_units_required" };
    }
    applyStatus(badUnit, "silvery_barbs_bad", { count: 1, mode: "set", data: { sourceSpellId: "silvery_barbs" } });
    applyStatus(goodUnit, "silvery_barbs_good", { count: 1, mode: "set", data: { sourceSpellId: "silvery_barbs" } });
    return { ok: true };
  }

  function silveryBarbsFinalPowerModifier(unit) {
    if (getStatus(unit, "silvery_barbs_bad")) return -2;
    if (getStatus(unit, "silvery_barbs_good")) return 2;
    return 0;
  }

  function consumeSilveryBarbs(unit) {
    if (getStatus(unit, "silvery_barbs_bad")) return reduceCount(unit, "silvery_barbs_bad", 1);
    if (getStatus(unit, "silvery_barbs_good")) return reduceCount(unit, "silvery_barbs_good", 1);
    return 0;
  }

  function applyHypnoticPattern(target, sourceUnitId = null) {
    return applyStatus(target, "hypnotic_pattern", {
      count: 10, mode: "set",
      data: { sourceSpellId: "hypnotic_pattern", concentrationSpellId: "hypnotic_pattern", sourceUnitId }
    });
  }

  function removeHypnoticPattern(target) { return removeStatus(target, "hypnotic_pattern"); }
  function assistRemoveHypnoticPattern(target) { return removeHypnoticPattern(target); }

  function headsProbability(unit) {
    const engine = global.CombatEngine;
    return typeof engine?.getCoinProbability === "function" ? numberOr(engine.getCoinProbability(readSp(unit)), 50) : 50;
  }

  function rollHypnoticTargetingCoin(caster, rng = Math.random) {
    const probability = Math.max(0, Math.min(100, headsProbability(caster)));
    const heads = Number(rng()) * 100 < probability;
    return { heads, tails: !heads, probability };
  }

  function resolveHypnoticTargets(caster, intendedEnemies = [], alliedUnits = [], rng = Math.random) {
    const coin = rollHypnoticTargetingCoin(caster, rng);
    const targets = coin.heads ? [...intendedEnemies] : [...intendedEnemies, ...alliedUnits, caster];
    return { ...coin, indiscriminate: coin.tails, targets: [...new Set(targets.filter(Boolean))] };
  }

  function concentrationSpellId(unit) {
    return normalizeId(unit?.spellcastingState?.concentration?.active?.spellId || unit?.spellcastingState?.concentration?.spellId);
  }

  function concentrationStillActive(units, statusEntry) {
    const sourceUnitId = String(statusEntry?.data?.sourceUnitId || "");
    const requiredSpell = normalizeId(statusEntry?.data?.concentrationSpellId);
    if (!sourceUnitId || !requiredSpell) return true;
    const source = (units || []).find((unit) => unitId(unit) === sourceUnitId);
    return source ? concentrationSpellId(source) === requiredSpell : true;
  }

  function cleanupConcentrationStatuses(units = []) {
    for (const unit of units) {
      for (const id of ["hypnotic_pattern", "paralyzed"]) {
        const entry = getStatus(unit, id);
        if (entry?.data?.concentrationSpellId && !concentrationStillActive(units, entry)) removeStatus(unit, id);
      }
    }
  }

  function sameSide(a, b) {
    if (!a || !b) return false;
    if (a === b || unitId(a) && unitId(a) === unitId(b)) return true;
    const pairs = [["team", "team"], ["side", "side"], ["faction", "faction"], ["combatSide", "combatSide"]];
    for (const [ka, kb] of pairs) {
      const av = a[ka], bv = b[kb];
      if (av != null && bv != null) return String(av) === String(bv);
    }
    return false;
  }

  function calmUnit(unit) {
    writeSp(unit, 0);
    removeStatus(unit, "charmed");
    removeStatus(unit, "frightened");
    return true;
  }

  function startCalmEmotions(caster, saveDC = null) {
    if (!caster) return false;
    caster.__luminousCalmEmotions = { saveDC: Number.isFinite(Number(saveDC)) ? Number(saveDC) : null, sourceUnitId: unitId(caster) };
    return true;
  }

  function applyCalmEmotionsTurn(engine, caster, units = []) {
    if (!caster?.__luminousCalmEmotions || concentrationSpellId(caster) !== "calm_emotions") return false;
    const saveDC = numberOr(caster.__luminousCalmEmotions.saveDC, NaN);
    for (const unit of units) {
      if (!unit) continue;
      if (sameSide(caster, unit)) {
        calmUnit(unit);
        continue;
      }
      if (!Number.isFinite(saveDC) || typeof engine?.resolveSpell !== "function") continue;
      const result = engine.resolveSpell({ id: "calm_emotions_turn", statUsed: "cha", saveDC, sourceUnitId: unitId(caster) }, unit, []);
      if (result?.isSuccess === false) calmUnit(unit);
    }
    return true;
  }

  function repeatHoldPersonSave(engine, unit, paralyzed) {
    if (normalizeId(paralyzed?.data?.sourceSpellId) !== "hold_person") return null;
    const dc = numberOr(paralyzed?.data?.saveDC, NaN);
    if (!Number.isFinite(dc) || typeof engine?.resolveSpell !== "function") return null;
    const result = engine.resolveSpell({ id: "hold_person_repeat_save", statUsed: "wis", saveDC: dc }, unit, []);
    if (result?.isSuccess === true) removeStatus(unit, "paralyzed");
    else reduceCount(unit, "paralyzed", 1);
    return result || null;
  }

  function onSpellTrigger(tag, context = {}) {
    const key = String(tag || "");
    const skill = context.skill || {};
    const id = spellId(skill);
    const target = targetFromContext(context);
    const attacker = attackerFromContext(context);

    if (key === "[Before Getting Hit]" && target) consumeMirrorImageForHit(target, context);
    if (key === "[On Assist]" && target && getStatus(target, "hypnotic_pattern")) assistRemoveHypnoticPattern(target);
    if (["[On Clash End]", "[On Save End]", "[On Check End]"].includes(key) && attacker) consumeSilveryBarbs(attacker);
    if (key === "[On Clash End]" && attacker) {
      const clashDown = getStatus(attacker, "clash_power_down");
      if (normalizeId(clashDown?.data?.sourceSpellId) === "vicious_mockery") removeStatus(attacker, "clash_power_down");
    }
    if (id === "vicious_mockery" && key === "[On Hit]" && target) return applyViciousMockery(target, skill, attacker);
    return null;
  }

  function patchCombatEngine() {
    const engine = global.CombatEngine;
    if (!engine || engine.__angeloSpellBatchRuntime) return Boolean(engine);

    const originalTriggerEvent = typeof engine.triggerEvent === "function" ? engine.triggerEvent : null;
    const originalResolveSpell = typeof engine.resolveSpell === "function" ? engine.resolveSpell : null;
    const originalTriggerPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase : null;
    const originalApplyDamage = typeof engine.applyDamage === "function" ? engine.applyDamage : null;

    if (originalTriggerEvent) {
      engine.triggerEvent = function (tag, context, targetsHit = []) {
        const result = originalTriggerEvent.call(this, tag, context, targetsHit);
        onSpellTrigger(tag, context || {});
        return result;
      };
    }

    if (originalResolveSpell) {
      engine.resolveSpell = function (spellSkill, target, targetHeadsFlipped) {
        const result = originalResolveSpell.call(this, spellSkill, target, targetHeadsFlipped) || {};
        const modifier = silveryBarbsFinalPowerModifier(target);
        if (modifier) {
          if (Number.isFinite(Number(result.savePower))) result.savePower = Number(result.savePower) + modifier;
          else if (Number.isFinite(Number(result.finalPower))) result.finalPower = Number(result.finalPower) + modifier;
          const power = Number.isFinite(Number(result.savePower)) ? Number(result.savePower) : Number(result.finalPower);
          const dc = numberOr(result.dc ?? spellSkill?.saveDC, NaN);
          if (Number.isFinite(power) && Number.isFinite(dc)) {
            result.isSuccess = power >= dc;
            result.winner = result.isSuccess ? "Target" : "Caster";
          }
          result.silveryBarbsFinalPowerModifier = modifier;
          consumeSilveryBarbs(target);
        }

        if (result.isSuccess === false) {
          const id = spellId(spellSkill || {});
          const sourceUnitId = spellSkill?.sourceUnitId || spellSkill?.casterId || null;
          if (id === "hold_person") {
            applyStatus(target, "paralyzed", { count: 10, mode: "set", data: { sourceSpellId: "hold_person", concentrationSpellId: "hold_person", sourceUnitId, saveAbility: "wis", saveDC: spellSkill?.saveDC } });
          } else if (id === "hypnotic_pattern") {
            applyHypnoticPattern(target, sourceUnitId);
          }
        }
        return result;
      };
    }

    if (originalApplyDamage) {
      engine.applyDamage = function (unit, damage, tipoDano = "directo", isCritical = false, skillUsed = null, damageContext = null) {
        const result = originalApplyDamage.call(this, unit, damage, tipoDano, isCritical, skillUsed, damageContext);
        if (numberOr(damage, 0) > 0 && getStatus(unit, "hypnotic_pattern")) removeHypnoticPattern(unit);
        return result;
      };
    }

    if (originalTriggerPhase) {
      engine.triggerPhase = function (phaseTag, allUnits = [], ...rest) {
        const result = originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);
        const phase = normalizeId(phaseTag);
        if (["turn_start", "round_start"].includes(phase)) {
          for (const caster of allUnits || []) applyCalmEmotionsTurn(this, caster, allUnits || []);
        }
        if (["turn_end", "round_end"].includes(phase)) {
          for (const unit of allUnits || []) {
            const paralyzed = getStatus(unit, "paralyzed");
            if (normalizeId(paralyzed?.data?.sourceSpellId) === "hold_person") repeatHoldPersonSave(this, unit, paralyzed);
            if (getStatus(unit, "mirror_image")) reduceCount(unit, "mirror_image", 1);
            if (getStatus(unit, "hypnotic_pattern")) reduceCount(unit, "hypnotic_pattern", 1);
          }
          cleanupConcentrationStatuses(allUnits || []);
        }
        if (["encounter_end", "on_encounter_end"].includes(phase)) {
          for (const unit of allUnits || []) removeStatus(unit, "mirror_image");
        }
        return result;
      };
    }

    Object.defineProperty(engine, "__angeloSpellBatchRuntime", { value: true, configurable: true });
    return true;
  }

  function install() {
    registerStatuses();
    patchCombatEngine();
    return true;
  }

  const api = Object.freeze({
    version: VERSION, STATUS_DEFINITIONS,
    registerStatuses, getStatus, applyStatus, removeStatus, reduceCount, reducePotency,
    readSp, writeSp, viciousMockeryAmount, applyViciousMockery,
    grantMirrorImage, consumeMirrorImageForHit,
    applySilveryBarbs, silveryBarbsFinalPowerModifier, consumeSilveryBarbs,
    applyHypnoticPattern, removeHypnoticPattern, assistRemoveHypnoticPattern,
    headsProbability, rollHypnoticTargetingCoin, resolveHypnoticTargets,
    concentrationSpellId, cleanupConcentrationStatuses,
    calmUnit, startCalmEmotions, applyCalmEmotionsTurn,
    repeatHoldPersonSave, onSpellTrigger, patchCombatEngine, install
  });

  global.LuminousAngeloSpellBatchRuntime = api;
  install();
  const timer = typeof global.setInterval === "function" ? global.setInterval(install, 250) : null;
  timer?.unref?.();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
