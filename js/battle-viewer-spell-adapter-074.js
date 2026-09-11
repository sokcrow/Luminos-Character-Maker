(function (global, factory) {
  "use strict";
  const api = factory(global);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global && api) global.LuminousBattleViewerSpellAdapter074 = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  const VERSION = "0.7.4";
  const OVERCAST_PREFIX = "__overcast__";
  const clean = (value) => String(value ?? "").trim();
  const normalizeId = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  let installedBase = null;

  function baseAdapter() {
    if (installedBase) return installedBase;
    if (global?.LuminousBattleViewerActionAdapter073 && !global.LuminousBattleViewerActionAdapter073.__spellAdapter074) return global.LuminousBattleViewerActionAdapter073;
    if (typeof require === "function") { try { return require("./battle-viewer-action-adapter-073.js"); } catch (_) {} }
    return null;
  }
  function spellLoadoutRuntime() {
    if (global?.LuminousCombatSpellLoadout074) return global.LuminousCombatSpellLoadout074;
    if (typeof require === "function") { try { return require("./combat-spell-loadout-074.js"); } catch (_) {} }
    return null;
  }
  function spellcastingRuntime() {
    if (global?.LuminousSpellcastingRuntime) return global.LuminousSpellcastingRuntime;
    if (typeof require === "function") {
      try { return require("./spellcasting-runtime.js"); } catch (_) {}
      try { return require("./spellcasting-basic-rules-runtime.js"); } catch (_) {}
    }
    return null;
  }

  function combatData(base) { return base?.combatData?.() || global.combatData || {}; }
  function unitIdFromSlot(base, slotId) { return base?.unitIdFromSlot?.(slotId) || clean(slotId).split("_slot_")[0]; }
  function planForSlot(base, slotId) { return base?.planForSlot?.(slotId) || null; }
  function spellIdForPlan(plan = {}, data = {}) { return normalizeId(plan.spellId || plan.sourceId || data.libraryKey || data.spellId || data.id); }
  function planKind(plan = {}, data = {}) { return normalizeId(plan.type || plan.kind || data.kind || data.type); }
  function isSpellPlan(plan = {}, data = {}) {
    const kind = planKind(plan, data);
    return ["spell", "spells", "magic"].includes(kind) || (kind === "auto" && normalizeId(data.kind) === "spell") || Boolean(plan.spellId);
  }

  function trustedSpell(actor = {}, plan = {}, data = {}) {
    const spellId = spellIdForPlan(plan, data);
    if (!spellId) return { ok: false, reason: "spell_id_required", spellId: null, spell: null };
    const runtime = spellLoadoutRuntime();
    if (!runtime?.resolveSpellForCombatant) return { ok: false, reason: "spell_loadout_runtime_required", spellId, spell: null };
    const result = runtime.resolveSpellForCombatant(actor, spellId, { classId: plan.classId });
    return result.ok
      ? { ok: true, reason: null, spellId: result.spellId || spellId, spell: result.spell, classId: result.classId, entry: result.entry || null }
      : { ok: false, reason: String(result.reason || "spell_unavailable").toLowerCase(), spellId, spell: null, classId: null };
  }

  function requestedSlotLevel(plan = {}, spell = {}) {
    const baseLevel = Math.max(0, Math.trunc(Number(spell.level ?? spell.spellLevel ?? spell.slotLevel ?? 0) || 0));
    if (spell.cantrip === true || baseLevel === 0) return 0;
    const requested = Number(plan.slotLevel ?? plan.castLevel);
    return Math.max(baseLevel, Number.isFinite(requested) ? Math.trunc(requested) : baseLevel);
  }

  function canonicalCastResource(classId, slotLevel, overcast) {
    return {
      owner: "source", type: "spell_slot",
      id: overcast === true ? `${OVERCAST_PREFIX}${clean(classId)}` : clean(classId),
      amount: 1,
      metadata: { classId: clean(classId), slotLevel: Math.max(0, Number(slotLevel) || 0), overcast: overcast === true }
    };
  }

  function actorLevel(actor = {}) {
    const direct = actor.Level ?? actor.level ?? actor.characterBuild?.calculatedAtLevel;
    if (Number.isFinite(Number(direct))) return Math.max(0, Math.trunc(Number(direct)));
    const classes = Array.isArray(actor.classes) ? actor.classes : (Array.isArray(actor.characterBuild?.classes) ? actor.characterBuild.classes : []);
    return classes.reduce((sum, row) => sum + Math.max(0, Math.trunc(Number(row?.levels ?? row?.level ?? 0) || 0)), 0);
  }

  function spellcastingValues(actor, classId) {
    const runtime = spellcastingRuntime();
    try {
      if (typeof runtime?.resolveSpellcasting === "function") return runtime.resolveSpellcasting(actor, classId) || null;
    } catch (_) {}
    return null;
  }

  function resolvedStatusEffect(status, potency = 0, count = 0, trigger = "on_hit", target = "target", extra = {}) {
    return {
      trigger, target, type: "status", status: normalizeId(status),
      potency: Math.max(0, Math.trunc(Number(potency) || 0)),
      count: Math.max(0, Math.trunc(Number(count) || 0)),
      timing: "immediate", ...clone(extra)
    };
  }

  function materializeSpell(actor, classId, spell, slotLevel, plan = {}) {
    const definition = clone(spell) || {};
    const mechanics = definition.mechanics || {};
    const baseLevel = Math.max(0, Math.trunc(Number(definition.level ?? definition.spellLevel ?? 0) || 0));
    const extraLevels = Math.max(0, slotLevel - baseLevel);
    const casting = spellcastingValues(actor, classId) || {};
    const spellMod = Number(casting.spellMod) || 0;
    const level = actorLevel(actor);

    if (mechanics.levelCoinPower?.every) {
      const every = Math.max(1, Number(mechanics.levelCoinPower.every) || 20);
      const amount = Number(mechanics.levelCoinPower.amount) || 0;
      definition.coinPower = Number(definition.coinPower || 0) + Math.floor(level / every) * amount;
    }
    if (definition.upcast?.coinPowerPerLevel) {
      definition.coinPower = Number(definition.coinPower || 0) + extraLevels * Number(definition.upcast.coinPowerPerLevel || 0);
    }
    if (definition.upcast?.atkWeightPerLevel) {
      definition.attackWeight = Math.max(1, Number(definition.attackWeight || definition.atkWeight || 1) + extraLevels * Number(definition.upcast.atkWeightPerLevel || 0));
      definition.atkWeight = definition.attackWeight;
    }
    if (definition.upcast?.coinsPerLevel) {
      definition.coinAmount = Math.max(1, Number(definition.coinAmount || definition.coins || 1) + extraLevels * Number(definition.upcast.coinsPerLevel || 0));
      definition.coins = definition.coinAmount;
    }

    const effects = [];
    const modStatus = mechanics.onHitStatusFromSpellMod;
    if (modStatus?.status) {
      const divisor = Math.max(1, Number(modStatus.potencyDivisor) || 1);
      const minimum = Math.max(0, Number(modStatus.minimum) || 0);
      const potency = Math.max(minimum, Math.floor(spellMod / divisor));
      effects.push(resolvedStatusEffect(modStatus.status, potency, 0, "on_hit", "target", {
        doubleIfTargetHasStatus: modStatus.doubleIfTargetHasStatus ? normalizeId(modStatus.doubleIfTargetHasStatus) : undefined
      }));
    }
    if (mechanics.onHitStatus?.status) {
      effects.push(resolvedStatusEffect(mechanics.onHitStatus.status, mechanics.onHitStatus.potency, mechanics.onHitStatus.count, "on_hit", "target", {
        perCoin: mechanics.onHitStatus.perCoin === true
      }));
    }
    if (mechanics.onFailedSave?.status) {
      effects.push(resolvedStatusEffect(
        mechanics.onFailedSave.status,
        mechanics.onFailedSave.potency,
        mechanics.onFailedSave.count,
        "on_failed_save",
        mechanics.onFailedSave.target || "target",
        { breakOnDamageFromCasterOrAlly: mechanics.breakCharmOnDamageFromCasterOrAlly === true }
      ));
    }
    if (mechanics.onUse?.status) {
      effects.push(resolvedStatusEffect(mechanics.onUse.status, mechanics.onUse.potency, mechanics.onUse.count, "on_use", mechanics.onUse.target || "self"));
    }
    if (mechanics.whileConcentratingTurnStart?.status) {
      effects.push(resolvedStatusEffect(
        mechanics.whileConcentratingTurnStart.status,
        mechanics.whileConcentratingTurnStart.potency,
        mechanics.whileConcentratingTurnStart.count,
        "turn_start",
        mechanics.whileConcentratingTurnStart.target || "self",
        { requiresConcentration: true, spellId: definition.id }
      ));
    }

    if (mechanics.requiresChoice?.key === "element") {
      const element = normalizeId(plan.element || plan.elementId || plan.choice?.element);
      const allowed = mechanics.requiresChoice.values || [];
      if (!element || !allowed.includes(element)) {
        return { ok: false, reason: "spell_choice_required", choiceKey: "element", choices: clone(allowed) };
      }
      const elementEffect = mechanics.elementalStatus?.[element];
      if (elementEffect?.status) effects.push(resolvedStatusEffect(elementEffect.status, elementEffect.potency, elementEffect.count, "on_hit", "target", { element }));
      definition.selectedElement = element;
    }

    definition.effects = [...(Array.isArray(definition.effects) ? definition.effects : []), ...effects];
    definition.spellMod = spellMod;
    definition.spellDC = Number(casting.spellDC) || 0;
    definition.materializedAtLevel = level;
    definition.slotLevel = slotLevel;
    definition.luminousMechanics = clone(mechanics);

    return { ok: true, definition, spellMod, spellDC: definition.spellDC, extraLevels };
  }

  function applyCanonicalSave(action, actor, classId, spell) {
    if (action?.resolution?.type !== "save") return action;
    const runtime = spellcastingRuntime();
    let resolved = null;
    try {
      if (typeof runtime?.resolveSpellSave === "function") resolved = runtime.resolveSpellSave(actor, classId, spell);
      if (!resolved && typeof runtime?.resolveSpellcasting === "function") {
        const casting = runtime.resolveSpellcasting(actor, classId);
        if (casting) resolved = { dc: casting.spellDC };
      }
    } catch (_) {}
    if (resolved && Number.isFinite(Number(resolved.dc))) action.resolution.save.dc = Number(resolved.dc);
    return action;
  }

  function applyCanonicalMetadata(action, definition, slotLevel, plan) {
    if (!action) return action;
    action.metadata = {
      ...(action.metadata || {}),
      basePower: Number(definition.basePower ?? definition.base_power ?? 0),
      coinPower: Number(definition.coinPower ?? definition.coin_power ?? 0),
      coinAmount: Math.max(0, Math.trunc(Number(definition.coinAmount ?? definition.coins ?? definition.coin_count ?? 0) || 0)),
      damageType: definition.damageType || definition.dmgType || null,
      sinAffinity: definition.sinAffinity || definition.affinity || null,
      slotLevel,
      sourceDefinition: clone(definition),
      spellChoice: clone(plan.choice || (definition.selectedElement ? { element: definition.selectedElement } : null))
    };
    if (action.targeting) action.targeting.attackWeight = Math.max(1, Number(definition.attackWeight || definition.atkWeight || action.targeting.attackWeight || 1));
    if (normalizeId(definition.castingTime) === "quick_action" && action.economy) action.economy.cost = "quick_action";
    return action;
  }

  function explicitTarget(base, explicitTargetSlotId, plan = {}, actor = {}) {
    const data = combatData(base);
    const selfTarget = normalizeId(plan?.data?.targetType || plan?.data?.targetingType) === "self";
    const targetId = selfTarget
      ? clean(actor.id || actor.unitId)
      : clean(plan.targetId || unitIdFromSlot(base, explicitTargetSlotId));
    return { targetId, target: data[targetId] || (targetId === clean(actor.id || actor.unitId) ? actor : null) };
  }

  function validateExplicitSpellTarget(base, explicitTargetSlotId, plan, actor, spell) {
    const runtime = spellLoadoutRuntime();
    if (!runtime?.validateSpellTarget) return { valid: false, reason: "spell_targeting_language_required" };
    const resolved = explicitTarget(base, explicitTargetSlotId, plan, actor);
    if (!resolved.target) return { valid: true, reason: null, ...resolved };
    const validation = runtime.validateSpellTarget(spell, resolved.target);
    return { ...validation, ...resolved };
  }

  function compileCanonicalSpell(base, slotId, explicitTargetSlotId, plan, actor, data) {
    const embedded = plan.combatAction || (plan.schemaVersion && plan.source && plan.resolution ? plan : null);
    if (embedded) return { action: null, plan, reason: "embedded_spell_action_forbidden" };

    const trusted = trustedSpell(actor, plan, data);
    if (!trusted.ok) return { action: null, plan, reason: trusted.reason, kind: "spell", spellId: trusted.spellId };
    const slotLevel = requestedSlotLevel(plan, trusted.spell);
    if (slotLevel > 9) return { action: null, plan, reason: "spell_slot_level_invalid", kind: "spell", spellId: trusted.spellId };

    const materialized = materializeSpell(actor, trusted.classId, trusted.spell, slotLevel, plan);
    if (!materialized.ok) return { action: null, plan, reason: materialized.reason, kind: "spell", spellId: trusted.spellId, choices: materialized.choices || [] };

    const targetValidation = validateExplicitSpellTarget(base, explicitTargetSlotId, { ...plan, data: materialized.definition }, actor, materialized.definition);
    if (!targetValidation.valid) {
      return { action: null, plan, reason: String(targetValidation.reason || "spell_target_invalid_creature_type").toLowerCase(), kind: "spell", spellId: trusted.spellId, targetValidation };
    }

    const trustedPlan = {
      ...clone(plan), type: "spell", kind: "spell", spellId: trusted.spellId,
      classId: trusted.classId, slotLevel, data: clone(materialized.definition),
      spell: undefined, definition: undefined, sourceDefinition: undefined, combatAction: undefined
    };
    const compiled = base.compilePlan(slotId, explicitTargetSlotId, trustedPlan);
    if (!compiled?.action) return compiled;

    compiled.action.source = { type: "spell", id: trusted.spellId };
    compiled.action.resources = trusted.spell.cantrip === true || slotLevel === 0 ? [] : [canonicalCastResource(trusted.classId, slotLevel, plan.overcast === true)];
    compiled.action.effects = [
      { type: "viewer_spell_cast", spellId: trusted.spellId, classId: trusted.classId, slotLevel, concentration: trusted.spell.concentration === true },
      ...(compiled.action.effects || [])
    ];
    compiled.action.metadata = {
      ...(compiled.action.metadata || {}),
      loadoutSpellId: trusted.spellId,
      canonicalSpell: true,
      sourceClassId: trusted.classId,
      slotLevel,
      overcast: plan.overcast === true,
      viewerPlan: clone(plan),
      spellMod: materialized.spellMod,
      spellDC: materialized.spellDC,
      luminousSpellMechanics: clone(materialized.definition.luminousMechanics)
    };
    applyCanonicalMetadata(compiled.action, materialized.definition, slotLevel, plan);
    applyCanonicalSave(compiled.action, actor, trusted.classId, materialized.definition);
    return { ...compiled, source: "spell", spellId: trusted.spellId, canonicalSpell: true };
  }

  function install() {
    const base = baseAdapter();
    if (!base?.compilePlan) return false;
    if (global.LuminousBattleViewerActionAdapter073?.__spellAdapter074) return true;
    installedBase = base;
    const wrapped = Object.freeze({
      ...base,
      __spellAdapter074: true,
      spellIdForPlan, isSpellPlan, trustedSpell, requestedSlotLevel, canonicalCastResource, materializeSpell,
      validateExplicitSpellTarget,
      compilePlan(slotId, explicitTargetSlotId = null, providedPlan = null) {
        const plan = providedPlan || planForSlot(base, slotId);
        if (!plan) return base.compilePlan(slotId, explicitTargetSlotId, providedPlan);
        const actor = combatData(base)[unitIdFromSlot(base, slotId)] || null;
        if (!actor) return base.compilePlan(slotId, explicitTargetSlotId, providedPlan);
        const data = plan.data || plan.sourceDefinition || plan.definition || plan.spell || plan;
        if (isSpellPlan(plan, data)) return compileCanonicalSpell(base, slotId, explicitTargetSlotId, plan, actor, data);
        return base.compilePlan(slotId, explicitTargetSlotId, providedPlan);
      }
    });
    global.LuminousBattleViewerActionAdapter073 = wrapped;
    return true;
  }

  const api = Object.freeze({
    version: VERSION, OVERCAST_PREFIX, spellIdForPlan, isSpellPlan, trustedSpell, requestedSlotLevel,
    canonicalCastResource, actorLevel, spellcastingValues, materializeSpell, applyCanonicalSave,
    applyCanonicalMetadata, validateExplicitSpellTarget, compileCanonicalSpell, install
  });
  install();
  return api;
});