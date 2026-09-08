(function (global) {
  "use strict";
  if (global.LuminousBattleViewerActionAdapter073) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousBattleViewerActionAdapter073;
    return;
  }

  const schema = global.LuminousCombatAction || (typeof require === "function" ? require("./combat-action-schema.js") : null);
  const adapters = global.LuminousCombatActionAdapters || (typeof require === "function" ? require("./combat-action-adapters.js") : null);
  if (!schema || !adapters) return;

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  function lexical(name, fallback = null) {
    try { return typeof global.eval === "function" ? global.eval(`typeof ${name} !== 'undefined' ? ${name} : undefined`) ?? fallback : fallback; }
    catch (_) { return fallback; }
  }
  function combatData() { return global.combatData || lexical("combatData", {}) || {}; }
  function sharedPlans() { return global.sharedPlannedActions || lexical("sharedPlannedActions", {}) || {}; }
  function attackVectors() { return global.attackVectors || lexical("attackVectors", {}) || {}; }
  function unitIdFromSlot(slotId) {
    const raw = String(slotId || ""), marker = "_slot_", splitAt = raw.lastIndexOf(marker);
    return splitAt >= 0 ? raw.slice(0, splitAt) : raw;
  }
  function slotIndexFromId(slotId) {
    const raw = String(slotId || ""), marker = "_slot_", splitAt = raw.lastIndexOf(marker);
    if (splitAt < 0) return 0;
    const index = Number(raw.slice(splitAt + marker.length));
    return Number.isInteger(index) ? index : 0;
  }
  function combatUnitId(unit = {}) { return String(unit.id || unit.unitId || unit.characterId || unit.actorId || "").trim(); }
  function combatUnitForOwner(ownerPlayerId) {
    const wanted = String(ownerPlayerId || "");
    return Object.values(combatData()).find((unit) => String(unit?.playerId || unit?.ownerPlayerId || unit?.uid || unit?.ownerUid || "") === wanted) || null;
  }
  function sharedPlanForSlot(slotId) {
    const unitId = unitIdFromSlot(slotId), slotIndex = slotIndexFromId(slotId);
    for (const [ownerPlayerId, slots] of Object.entries(sharedPlans())) {
      const ownerUnit = combatUnitForOwner(ownerPlayerId);
      if (!ownerUnit || combatUnitId(ownerUnit) !== unitId) continue;
      const plan = slots?.[slotIndex] || slots?.[String(slotIndex)] || null;
      if (plan) return { ...plan, __ownerPlayerId: ownerPlayerId };
    }
    return null;
  }
  function plannedSlotIds() {
    const ids = [];
    for (const [ownerPlayerId, slots] of Object.entries(sharedPlans())) {
      const ownerUnit = combatUnitForOwner(ownerPlayerId), unitId = combatUnitId(ownerUnit || {});
      if (!unitId || !slots || typeof slots !== "object") continue;
      Object.keys(slots).forEach((index) => { if (/^\d+$/.test(String(index))) ids.push(`${unitId}_slot_${Number(index)}`); });
    }
    return [...new Set(ids)];
  }
  function localPlanForSlot(slotId) {
    const actor = combatData()[unitIdFromSlot(slotId)], slotIndex = slotIndexFromId(slotId);
    const economy = global.LuminousActionEconomy;
    if (!actor || typeof economy?.getPlannedAction !== "function") return null;
    try { return economy.getPlannedAction(actor, slotIndex) || null; } catch (_) { return null; }
  }
  function vectorPlanForSlot(slotId) {
    const vector = attackVectors()[slotId] || {};
    return vector.combatAction || vector.action || vector.plan || vector.skill || null;
  }
  function planForSlot(slotId) {
    return vectorPlanForSlot(slotId) || sharedPlanForSlot(slotId) || localPlanForSlot(slotId) || null;
  }
  function targetIdsFor(plan = {}, explicitTargetId = null) {
    const ids = [];
    const add = (value) => { const id = String(value || "").trim(); if (id && !ids.includes(id)) ids.push(id); };
    add(explicitTargetId);
    add(plan.targetId || plan.targetUnitId || plan.targeting?.mainTargetId);
    (plan.additionalTargets || plan.targeting?.targetIds || []).forEach((row) => add(row?.targetId || row));
    return ids;
  }
  function targetAllegiance(plan = {}, data = {}) {
    const raw = normalizeId(plan.targetSide || data.targetSide || data.targetAlly && "ally" || "enemy");
    if (["ally", "allies", "friendly", "friend"].includes(raw)) return "ally";
    if (raw === "self") return "self";
    if (["neutral", "any"].includes(raw)) return "neutral";
    return "enemy";
  }
  function optionsFor(slotId, plan = {}, explicitTargetId = null) {
    const ids = targetIdsFor(plan, explicitTargetId), data = plan.data || plan.sourceDefinition || plan.definition || plan.skill || plan.spell || plan;
    return {
      actorId: unitIdFromSlot(slotId),
      actionSlotId: slotId,
      isAi: String((combatData()[unitIdFromSlot(slotId)] || {}).controlled || "").toLowerCase() === "ai",
      targetId: ids[0] || null,
      mainTargetId: ids[0] || null,
      targetIds: ids,
      allegiance: targetAllegiance(plan, data),
      metadata: {
        viewer073: true,
        viewerPlanType: plan.type || plan.kind || data.kind || null,
        viewerSlotIndex: slotIndexFromId(slotId),
        sharedOwnerPlayerId: plan.__ownerPlayerId || null,
      },
    };
  }
  function normalizeExistingAction(raw, slotId, explicitTargetId) {
    const action = schema.normalizeCombatAction(raw);
    action.actorId = action.actorId || unitIdFromSlot(slotId);
    action.actionSlotId = action.actionSlotId || slotId;
    action.phase.executesAt = schema.PHASES.COMBAT_PHASE;
    if (!action.targeting.mainTargetId && explicitTargetId) action.targeting.mainTargetId = String(explicitTargetId);
    if (action.targeting.mainTargetId && !action.targeting.targetIds.includes(action.targeting.mainTargetId)) action.targeting.targetIds.unshift(action.targeting.mainTargetId);
    action.metadata = { ...(action.metadata || {}), viewer073: true, viewerSlotIndex: slotIndexFromId(slotId) };
    return action;
  }
  function trustedTrait(actor, traitId) {
    try { return global.CombatEngine?.resolveTrustedTraitForUnit?.(actor, traitId) || null; } catch (_) { return null; }
  }
  function compileItem(actor, data, slotId, plan, explicitTargetId) {
    const options = optionsFor(slotId, plan, explicitTargetId), sourceId = data.id || data.itemId || data.name || "item";
    const effects = Array.isArray(data.effects) ? clone(data.effects) : [{ type: "viewer_item", item: clone(data) }];
    return schema.createCombatAction({
      actorId: options.actorId,
      actionSlotId: slotId,
      source: { type: "item", id: String(sourceId) },
      phase: { selectedAt: options.isAi ? schema.PHASES.PLANNING_PHASE_AI : schema.PHASES.PLANNING_PHASE_PLAYER, executesAt: schema.PHASES.COMBAT_PHASE },
      economy: { cost: schema.ECONOMY_COSTS.ACTION },
      targeting: { allegiance: options.allegiance, mode: options.targetIds.length > 1 ? "multi" : "single", mainTargetId: options.mainTargetId, targetIds: options.targetIds, attackWeight: Math.max(1, Number(data.attackWeight || data.atkWeight || 1)) },
      resolution: { type: "automatic" },
      effects,
      metadata: { ...options.metadata, name: data.name || sourceId, sourceDefinition: clone(data) },
    });
  }
  function compileDefense(actor, data, slotId, plan, explicitTargetId) {
    const options = optionsFor(slotId, plan, explicitTargetId), subtype = normalizeId(data.defenseType || data.defenseSubtype || data.name || "defense");
    return schema.createCombatAction({
      actorId: options.actorId,
      actionSlotId: slotId,
      source: { type: "skill", id: String(data.id || data.skillId || subtype || "defense") },
      phase: { selectedAt: options.isAi ? schema.PHASES.PLANNING_PHASE_AI : schema.PHASES.PLANNING_PHASE_PLAYER, executesAt: schema.PHASES.COMBAT_PHASE },
      economy: { cost: schema.ECONOMY_COSTS.ACTION },
      targeting: { allegiance: "self", mode: "self", mainTargetId: options.actorId, targetIds: [options.actorId] },
      resolution: { type: "automatic" },
      effects: [{ type: "viewer_defense", defenseType: subtype, definition: clone(data) }],
      metadata: { ...options.metadata, name: data.name || subtype || "Defense", defenseSubtype: subtype, sourceDefinition: clone(data) },
    });
  }
  function compilePlan(slotId, explicitTargetSlotId = null, providedPlan = null) {
    const actor = combatData()[unitIdFromSlot(slotId)] || null;
    if (!actor) return { action: null, plan: null, reason: "actor_missing" };
    const plan = providedPlan || planForSlot(slotId);
    if (!plan) return { action: null, plan: null, reason: "combat_action_missing" };
    const explicitTargetId = explicitTargetSlotId ? unitIdFromSlot(explicitTargetSlotId) : null;
    const embedded = plan.combatAction || (plan.schemaVersion && plan.source && plan.resolution ? plan : null);
    if (embedded) return { action: normalizeExistingAction(embedded, slotId, explicitTargetId), plan, source: "combat_action" };

    const data = plan.data || plan.sourceDefinition || plan.definition || plan.skill || plan.spell || plan;
    const kind = normalizeId(plan.type || data.kind || plan.kind || data.type);
    const options = optionsFor(slotId, plan, explicitTargetId);
    let action = null;
    if (["deck", "granted", "skill", "attack"].includes(kind) || (kind === "auto" && normalizeId(data.kind) === "skill")) {
      action = adapters.compileSkillToCombatAction(actor, data, options);
    } else if (["spells", "spell", "magic"].includes(kind) || (kind === "auto" && normalizeId(data.kind) === "spell")) {
      action = adapters.compileSpellToCombatAction(actor, data, options);
    } else if (["defense", "guard", "evade", "counter"].includes(kind) || (kind === "auto" && normalizeId(data.kind) === "defense")) {
      action = compileDefense(actor, data, slotId, plan, explicitTargetId);
    } else if (["items", "item"].includes(kind) || (kind === "auto" && normalizeId(data.kind) === "item")) {
      action = compileItem(actor, data, slotId, plan, explicitTargetId);
    } else if (["global", "universal", "universal_action"].includes(kind) || data.actionKey) {
      action = adapters.compileUniversalAction(actor, data.actionKey || data.id || plan.actionKey || "action", { ...options, targetUnitId: options.mainTargetId, metadata: { ...options.metadata, sourceDefinition: clone(data), name: data.name || data.actionKey || "Action" } });
    } else if (plan.traitId || kind === "trait") {
      const traitId = plan.traitId || data.traitId || data.id;
      const definition = trustedTrait(actor, traitId) || data;
      action = adapters.compileTraitToCombatAction(actor, definition, { ...options, sourceId: traitId, resolution: { type: "automatic" }, effects: [{ type: "viewer_trait_action", plannedAction: clone(plan), slotIndex: slotIndexFromId(slotId) }], metadata: { ...options.metadata, sharedPlannedAction: true, sourceDefinition: clone(definition) } });
    }
    if (!action) return { action: null, plan, reason: "unsupported_plan_type", kind };
    action.metadata = { ...(action.metadata || {}), viewer073: true, viewerPlan: clone(plan) };
    return { action, plan, source: kind || "unknown" };
  }

  const api = Object.freeze({
    combatData, sharedPlans, attackVectors, unitIdFromSlot, slotIndexFromId, sharedPlanForSlot, plannedSlotIds, localPlanForSlot,
    vectorPlanForSlot, planForSlot, compilePlan,
  });
  global.LuminousBattleViewerActionAdapter073 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
