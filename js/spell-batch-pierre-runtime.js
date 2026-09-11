(function (global) {
  "use strict";

  if (global.LuminousPierreSpellBatchRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousPierreSpellBatchRuntime;
    return;
  }

  const VERSION = "0.7.4-pierre-batch-1";
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const intOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;

  const STATUS_DEFINITIONS = Object.freeze({
    mind_sliver: Object.freeze({
      name: "Mind Sliver", type: "negative", mode: "single",
      icon: "https://imgur.com/TtkSypG.png", maxCount: 3,
      description: "Saves have -2 Final Power. On Turn End lose 1 Count. On Save End lose 1 Count. The penalty does not scale with Count."
    }),
    elemental_absorption: Object.freeze({
      name: "Elemental Absorption", type: "positive", mode: "single",
      icon: "https://imgur.com/N6HONrV.png", maxCount: 9,
      description: "Stores one absorbed Element. On the next Melee Hit, inflict Potency and Count of that Element's Status equal to this Count, then remove Elemental Absorption."
    }),
    crown_of_madness: Object.freeze({
      name: "Crown of Madness", type: "negative", mode: "single",
      icon: "https://imgur.com/fIGa7J3.png", maxCount: 10,
      description: "Seal all but one Action Slot. The remaining slot makes an Attack Assist against the last target attacked by the caster. At Turn End repeat the stored WIS Save and lose 1 Count."
    }),
    suggestion: Object.freeze({
      name: "Suggestion", type: "negative", mode: "single", maxCount: 1,
      description: "While the source maintains Concentration, enforce the selected command on one Action Slot: Attack, Assist, Defend, Retreat, or Do Nothing."
    })
  });

  const ELEMENT_STATUS = Object.freeze({
    acid: "corrosion", cold: "chill", fire: "burn", lightning: "shock", thunder: "tremor"
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
    current.count = Math.max(0, numberOr(current.count, 0) + Math.max(0, numberOr(input.count, 1)));
    current.potency = Math.max(0, numberOr(current.potency, 0) + Math.max(0, numberOr(input.potency, 0)));
    current.data = { ...(current.data || {}), ...(input.data || {}) };
    const maxCount = registry()[key]?.maxCount;
    if (Number.isFinite(Number(maxCount))) current.count = Math.min(Number(maxCount), current.count);
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
    const key = normalizeId(id);
    if (typeof elementalRuntime()?.reduceCount === "function") return elementalRuntime().reduceCount(unit, key, amount);
    const entry = unit?.statusEffects?.[key];
    if (!entry || typeof entry !== "object") return 0;
    entry.count = Math.max(0, numberOr(entry.count, 0) - Math.max(0, numberOr(amount, 0)));
    if (entry.count <= 0) removeStatus(unit, key);
    return entry.count;
  }

  function readSp(unit = {}) {
    if (typeof elementalRuntime()?.readSp === "function") return elementalRuntime().readSp(unit);
    const combat = unit.combatStats || {};
    return numberOr(unit.sp ?? unit.currentSp ?? unit.currentSP ?? combat.sp_actual ?? combat.sp, 0);
  }

  function spellId(skill = {}) { return normalizeId(skill.id || skill.spellId || skill.sourceId || skill.libraryKey); }
  function slotLevel(skill = {}) { return Math.max(0, intOr(skill.slotLevel ?? skill.spellLevel ?? skill.level, 0)); }
  function spellMod(skill = {}) { return intOr(skill.spellMod, 0); }
  function targetFromContext(context = {}) { return context.currentTarget || context.defender || context.target || null; }
  function attackerFromContext(context = {}) { return context.unitAttacker || context.attacker || context.self || null; }

  function applyTremorBurst(target, context = {}) {
    const tremor = getStatus(target, "tremor");
    const potency = Math.max(0, intOr(tremor?.potency, 0));
    if (!target || !tremor || potency <= 0) return { applied: false, potency: 0 };
    const engine = context.engine || global.CombatEngine;
    if (typeof engine?.modifyNextStaggerThreshold === "function") engine.modifyNextStaggerThreshold(target, potency);
    else if (Number.isFinite(Number(target.nextStaggerThreshold))) target.nextStaggerThreshold += potency;
    reduceCount(target, "tremor", 1);
    return { applied: true, potency };
  }

  function elementalStatusPayload(element, count) {
    const status = ELEMENT_STATUS[normalizeId(element)] || null;
    const amount = Math.max(0, intOr(count, 0));
    return status ? { status, potency: amount, count: amount } : null;
  }

  function consumeElementalAbsorptionOnMeleeHit(attacker, target, skill = {}) {
    const entry = getStatus(attacker, "elemental_absorption");
    if (!entry || !target) return null;
    const rawRange = skill.skillRange ?? skill.range;
    if (!Number.isFinite(Number(rawRange))) return null;
    const range = numberOr(rawRange, 99);
    if (range > 1 || skill.isMelee === false || skill.isRanged === true) return null;
    const amount = Math.max(0, intOr(entry.count, 0));
    const element = normalizeId(entry.data?.element || entry.element);
    const payload = elementalStatusPayload(element, amount);
    if (!payload || amount <= 0) return null;
    applyStatus(target, payload.status, { potency: payload.potency, count: payload.count, mode: "gain", element, sourceElement: element, data: { sourceStatus: "elemental_absorption" } });
    removeStatus(attacker, "elemental_absorption");
    return payload;
  }

  function markForcedRetreat(target, sourceUnitId = null) {
    if (!target) return false;
    target.__luminousForcedRetreatAtTurnEnd = { sourceUnitId: sourceUnitId || null, reason: "dissonant_whispers" };
    return true;
  }

  function executeForcedRetreat(target) {
    const pending = target?.__luminousForcedRetreatAtTurnEnd;
    if (!target || !pending) return false;
    delete target.__luminousForcedRetreatAtTurnEnd;
    target.actionQueue = [];
    target.lifeState = "retreated";
    target.isRetreated = true;
    target.isBackup = true;
    try {
      global.dispatchEvent?.(new global.CustomEvent("luminous:condition-retreat", { detail: { unit: target, reason: pending.reason || "dissonant_whispers", sourceUnitId: pending.sourceUnitId || null } }));
    } catch (_) {}
    return true;
  }

  function repeatCrownSave(engine, unit, crown) {
    const dc = numberOr(crown?.data?.saveDC, NaN);
    if (!engine?.resolveSpell || !Number.isFinite(dc)) return null;
    const probability = typeof engine.getCoinProbability === "function" ? numberOr(engine.getCoinProbability(readSp(unit)), 50) : 50;
    const heads = Array.from({ length: 5 }, () => Math.random() * 100 < probability);
    const result = engine.resolveSpell({ id: "crown_of_madness_repeat_save", statUsed: "wis", saveDC: dc }, unit, heads);
    if (result?.isSuccess === true) removeStatus(unit, "crown_of_madness");
    return result || null;
  }

  function onSpellTrigger(tag, context = {}) {
    const key = String(tag || "");
    const skill = context.skill || {};
    const id = spellId(skill);
    const target = targetFromContext(context);
    const attacker = attackerFromContext(context);
    if (!target && key !== "[On Hit]") return null;

    if (key === "[On Hit]" && attacker && target) consumeElementalAbsorptionOnMeleeHit(attacker, target, skill);

    if (id === "mind_sliver" && key === "[On Hit]") {
      return applyStatus(target, "mind_sliver", { count: 1, mode: "gain", sourceUnitId: attacker?.id || attacker?.unitId || null });
    }
    if (id === "chill_touch" && key === "[On Hit]") {
      const amount = Math.max(1, Math.floor(spellMod(skill) / 2));
      return applyStatus(target, "decay", { count: amount, mode: "gain", element: "necrotic", sourceElement: "necrotic" });
    }
    if (id === "thunderwave" && key === "[On Hit]") {
      const amount = 2 + Math.max(1, slotLevel(skill));
      return applyStatus(target, "tremor", { potency: amount, count: amount, mode: "gain", element: "thunder", sourceElement: "thunder" });
    }
    if (id === "thunderwave" && key === "[On Hit without Cracking]") {
      const amount = 2 + Math.max(1, slotLevel(skill));
      applyStatus(target, "tremor", { potency: amount, count: amount, mode: "gain", element: "thunder", sourceElement: "thunder" });
      return applyTremorBurst(target, { engine: global.CombatEngine });
    }
    if (id === "dissonant_whispers" && key === "[On Hit]") {
      const amount = 4 + Math.max(1, slotLevel(skill));
      return applyStatus(target, "sinking", { potency: amount, count: amount, mode: "gain", element: "psychic", sourceElement: "psychic" });
    }
    if (id === "dissonant_whispers" && key === "[On Hit without Cracking]" && readSp(target) < -10) {
      return markForcedRetreat(target, attacker?.id || attacker?.unitId || null);
    }
    return null;
  }

  function patchCombatEngine() {
    const engine = global.CombatEngine;
    if (!engine || engine.__pierreSpellBatchRuntime) return Boolean(engine);

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
        const sliver = getStatus(target, "mind_sliver");
        if (sliver && intOr(sliver.count, 0) > 0) {
          result.savePower = numberOr(result.savePower, 0) - 2;
          result.isSuccess = result.savePower >= numberOr(result.dc ?? spellSkill?.saveDC, 0);
          result.winner = result.isSuccess ? "Target" : "Caster";
          result.mindSliverFinalPowerPenalty = -2;
          reduceCount(target, "mind_sliver", 1);
        }

        if (result.isSuccess === false) {
          const id = spellId(spellSkill || {});
          const sourceUnitId = spellSkill?.sourceUnitId || spellSkill?.casterId || null;
          if (id === "crown_of_madness") {
            applyStatus(target, "crown_of_madness", { count: 10, mode: "set", sourceUnitId, data: { sourceUnitId, saveAbility: "wis", saveDC: spellSkill?.saveDC } });
          } else if (id === "suggestion") {
            applyStatus(target, "suggestion", { count: 1, mode: "set", sourceUnitId, data: { sourceUnitId, command: normalizeId(spellSkill?.selectedSuggestionCommand), concentrationSpellId: "suggestion" } });
          } else if (id === "animal_friendship") {
            applyStatus(target, "charmed", { count: 99, mode: "set", sourceUnitId, data: { sourceUnitId, sourceSpellId: "animal_friendship", breakOnDamageFromCasterOrAlly: true } });
          }
        }
        return result;
      };
    }

    if (originalApplyDamage) {
      engine.applyDamage = function (unit, damage, tipoDano = "directo", isCritical = false, skillUsed = null, damageContext = null) {
        const pending = unit?.__luminousAbsorbElementsPending;
        let nextDamage = damage;
        if (pending) {
          nextDamage = Math.floor(Math.max(0, numberOr(damage, 0)) / 2);
          delete unit.__luminousAbsorbElementsPending;
          applyStatus(unit, "elemental_absorption", { count: pending.count, mode: "set", duration: "next_turn_end", data: { element: pending.element, sourceSpellId: "absorb_elements" } });
        }
        return originalApplyDamage.call(this, unit, nextDamage, tipoDano, isCritical, skillUsed, damageContext);
      };
    }

    if (originalTriggerPhase) {
      engine.triggerPhase = function (phaseTag, allUnits = [], ...rest) {
        const result = originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);
        const phase = normalizeId(phaseTag).replace(/^_+|_+$/g, "");
        if (["turn_end", "round_end"].includes(phase)) {
          (allUnits || []).forEach((unit) => {
            const crown = getStatus(unit, "crown_of_madness");
            if (crown) {
              repeatCrownSave(this, unit, crown);
              if (getStatus(unit, "crown_of_madness")) reduceCount(unit, "crown_of_madness", 1);
            }
            if (getStatus(unit, "mind_sliver")) reduceCount(unit, "mind_sliver", 1);
            executeForcedRetreat(unit);
            if (unit.__luminousEphemeralSpellShield) {
              const remove = Math.min(Math.max(0, numberOr(unit.shield, 0)), Math.max(0, numberOr(unit.__luminousEphemeralSpellShield, 0)));
              unit.shield = Math.max(0, numberOr(unit.shield, 0) - remove);
              delete unit.__luminousEphemeralSpellShield;
            }
          });
        }
        return result;
      };
    }

    Object.defineProperty(engine, "__pierreSpellBatchRuntime", { value: true, configurable: true });
    return true;
  }

  function prepareAbsorbElements(unit, element, castLevel = 1) {
    const key = normalizeId(element);
    if (!ELEMENT_STATUS[key]) return { ok: false, reason: "unsupported_element" };
    unit.__luminousAbsorbElementsPending = { element: key, count: Math.max(1, intOr(castLevel, 1)) };
    return { ok: true, element: key, count: unit.__luminousAbsorbElementsPending.count };
  }

  function grantShield(unit, castLevel = 1) {
    if (!unit) return 0;
    const amount = 20 * Math.max(1, intOr(castLevel, 1));
    unit.shield = Math.max(0, numberOr(unit.shield, 0)) + amount;
    unit.__luminousEphemeralSpellShield = Math.max(0, numberOr(unit.__luminousEphemeralSpellShield, 0)) + amount;
    return amount;
  }

  function patchSpellAdapter() {
    const source = global.LuminousBattleViewerActionAdapter073;
    if (!source?.compilePlan || !source.__spellAdapter074) return false;
    if (source.__pierreSpellBatchRuntime) return true;
    const wrapped = Object.freeze({
      ...source,
      __pierreSpellBatchRuntime: true,
      compilePlan(slotId, explicitTargetSlotId = null, providedPlan = null) {
        const result = source.compilePlan(slotId, explicitTargetSlotId, providedPlan);
        const action = result?.action;
        if (!action || normalizeId(action.source?.type) !== "spell") return result;
        const definition = action.metadata?.sourceDefinition || {};
        definition.sourceUnitId = action.actorId || definition.sourceUnitId || null;
        const id = normalizeId(action.source?.id || definition.id);
        const castLevel = Math.max(0, intOr(action.metadata?.slotLevel ?? definition.slotLevel ?? definition.level, 0));
        const baseLevel = Math.max(0, intOr(definition.level ?? definition.spellLevel, 0));
        const extraLevels = Math.max(0, castLevel - baseLevel);

        if (definition.upcast?.finalPowerPerLevel) {
          action.modifiers = [...(action.modifiers || []), { source: `${id}_upcast`, type: "final_power", amount: extraLevels * numberOr(definition.upcast.finalPowerPerLevel, 0) }];
        }
        if (normalizeId(definition.castingTime) === "reaction") {
          action.economy = { ...(action.economy || {}), cost: "reaction" };
          action.resolution = { type: "automatic" };
        }
        if (id === "suggestion") {
          const plan = action.metadata?.viewerPlan || providedPlan || {};
          const command = normalizeId(plan.suggestionCommand || plan.command || plan.choice?.command);
          const allowed = ["attack", "assist", "defend", "retreat", "do_nothing"];
          if (!allowed.includes(command)) return { action: null, plan, reason: "spell_choice_required", kind: "spell", spellId: id, choices: allowed };
          definition.selectedSuggestionCommand = command;
          action.metadata.sourceDefinition = definition;
        }
        if (id === "absorb_elements") {
          const element = normalizeId(definition.selectedElement || action.metadata?.spellChoice?.element);
          if (element) action.effects = [...(action.effects || []), { type: "pierre_absorb_elements", element, castLevel }];
        }
        if (id === "shield") action.effects = [...(action.effects || []), { type: "pierre_shield", castLevel }];
        return result;
      }
    });
    global.LuminousBattleViewerActionAdapter073 = wrapped;
    return true;
  }

  function patchCombatActionResolver() {
    const source = global.LuminousCombatActionResolver;
    if (!source?.resolveCombatAction || source.__pierreSpellBatchRuntime) return Boolean(source);
    const wrapped = Object.freeze({
      ...source,
      __pierreSpellBatchRuntime: true,
      resolveCombatAction(input = {}, context = {}) {
        const result = source.resolveCombatAction(input, {
          ...context,
          effectHandlers: {
            ...(context.effectHandlers || {}),
            pierre_absorb_elements({ actor, effect }) { return prepareAbsorbElements(actor, effect.element, effect.castLevel); },
            pierre_shield({ actor, effect }) { return { shieldGranted: grantShield(actor, effect.castLevel) }; }
          }
        });
        return result;
      }
    });
    global.LuminousCombatActionResolver = wrapped;
    return true;
  }

  function install() {
    registerStatuses();
    patchCombatEngine();
    patchSpellAdapter();
    patchCombatActionResolver();
    return true;
  }

  const api = Object.freeze({
    version: VERSION, STATUS_DEFINITIONS, ELEMENT_STATUS,
    registerStatuses, getStatus, applyStatus, removeStatus, reduceCount, readSp,
    applyTremorBurst, elementalStatusPayload, consumeElementalAbsorptionOnMeleeHit,
    markForcedRetreat, executeForcedRetreat, repeatCrownSave, onSpellTrigger, prepareAbsorbElements, grantShield,
    patchCombatEngine, patchSpellAdapter, patchCombatActionResolver, install
  });

  global.LuminousPierreSpellBatchRuntime = api;
  install();
  const timer = typeof global.setInterval === "function" ? global.setInterval(install, 250) : null;
  timer?.unref?.();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
