(function (global) {
  "use strict";

  const PHASE_COMBAT = "combat_phase";
  const SIDE_A = "allies";
  const SIDE_B = "enemies";

  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const finiteNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function entityId(entity = {}) {
    return String(entity.id ?? entity.unitId ?? entity.characterId ?? entity.actorId ?? "").trim();
  }

  function sideOf(entity = {}) {
    const raw = normalizeId(entity.side || entity.team || entity.faction || entity.faccion);
    return raw.includes("enemy") || raw.includes("enem") ? SIDE_B : SIDE_A;
  }

  function partIdOf(action = {}) {
    return String(
      action.partId ?? action.abnormalityPartId ?? action.metadata?.partId ?? action.metadata?.abnormalityPartId ?? ""
    ).trim() || null;
  }

  function numericSpeed(entity = {}) {
    const candidates = [entity.resolvedSpeed, entity.currentSpeed, entity.speedRoll, entity.speedValue, entity.speed_value, entity.speed];
    const found = candidates.map(Number).find(Number.isFinite);
    return found == null ? 0 : found;
  }

  function partCollection(unit = {}) {
    const raw = unit.parts || unit.abnormalityParts || unit.bodyParts || unit.body_parts || [];
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === "object") return Object.entries(raw).map(([id, value]) => ({ id, ...(value || {}) }));
    return [];
  }

  function findPart(unit = {}, partId) {
    if (!partId) return null;
    const wanted = String(partId);
    return partCollection(unit).find((part) => String(part.id ?? part.partId ?? part.key ?? part.name ?? "") === wanted) || null;
  }

  function speedSourceKey(actorId, partId) {
    return partId ? `${actorId}::part::${partId}` : `${actorId}::unit`;
  }

  function resolveRoundSpeed(unit = {}, action = {}) {
    const partId = partIdOf(action);
    const part = findPart(unit, partId);
    return part ? numericSpeed(part) : numericSpeed(unit);
  }

  function slotIndexOf(action = {}, fallback = 0) {
    const raw = action.metadata?.actionSlotIndex ?? action.slotIndex ?? action.actionSlotIndex;
    if (Number.isFinite(Number(raw))) return Math.max(0, Math.trunc(Number(raw)));
    const match = String(action.actionSlotId || "").match(/(?:slot[_-]?)?(\d+)$/i);
    return match ? Math.max(0, Number(match[1])) : fallback;
  }

  function terminal(action = {}) {
    return action.state === "resolved" || action.state === "cancelled";
  }

  function queueable(action = {}) {
    const executesAt = normalizeId(action.phase?.executesAt || action.executesAt || PHASE_COMBAT);
    return executesAt === PHASE_COMBAT && !terminal(action);
  }

  function unitMap(units = []) {
    return new Map(asArray(units).map((unit) => [entityId(unit), unit]).filter(([id]) => id));
  }

  function buildRoundOrder(config = {}) {
    const random = typeof config.random === "function" ? config.random : Math.random;
    const unitsById = unitMap(config.units);
    const sourceState = new Map();
    const entries = [];

    asArray(config.actions).forEach((action, inputIndex) => {
      if (!queueable(action)) return;
      const actorId = String(action.actorId || "");
      const unit = unitsById.get(actorId);
      if (!unit) return;
      const partId = partIdOf(action);
      const key = speedSourceKey(actorId, partId);
      let source = sourceState.get(key);
      if (!source) {
        source = {
          key,
          actorId,
          partId,
          side: sideOf(unit),
          speed: resolveRoundSpeed(unit, action),
          tieRoll: finiteNumber(random(), 0),
          inputIndex,
        };
        sourceState.set(key, source);
      }
      entries.push({
        action,
        actionId: String(action.id || `action_${inputIndex}`),
        actorId,
        partId,
        sourceKey: key,
        side: source.side,
        speed: source.speed,
        tieRoll: source.tieRoll,
        slotIndex: slotIndexOf(action, inputIndex),
        inputIndex,
      });
    });

    const compareExecution = (a, b) =>
      (b.speed - a.speed) ||
      (a.tieRoll - b.tieRoll) ||
      (a.sourceKey === b.sourceKey ? a.slotIndex - b.slotIndex : 0) ||
      (a.inputIndex - b.inputIndex);

    entries.sort(compareExecution);

    const sourceList = [...sourceState.values()];
    const sideA = sourceList
      .filter((source) => source.side === SIDE_A)
      .sort((a, b) => (b.speed - a.speed) || (a.tieRoll - b.tieRoll) || (a.inputIndex - b.inputIndex));
    const sideB = sourceList
      .filter((source) => source.side === SIDE_B)
      .sort((a, b) => (a.speed - b.speed) || (a.tieRoll - b.tieRoll) || (a.inputIndex - b.inputIndex));

    return {
      phase: PHASE_COMBAT,
      entries,
      layout: { [SIDE_A]: sideA, [SIDE_B]: sideB },
      speedSources: Object.fromEntries(sourceList.map((source) => [source.key, { ...source }])),
      getEntry(actionId) {
        return entries.find((entry) => entry.actionId === String(actionId)) || null;
      },
      getSpeed(actorId, partId = null) {
        return sourceState.get(speedSourceKey(String(actorId), partId))?.speed ?? null;
      },
    };
  }

  function actionTargetsActor(action = {}, actorId) {
    const wanted = String(actorId ?? "");
    if (!wanted) return false;
    const ids = asArray(action.targeting?.targetIds).map(String);
    const main = action.targeting?.mainTargetId == null ? null : String(action.targeting.mainTargetId);
    return main === wanted || ids.includes(wanted);
  }

  function canForceClash(config = {}) {
    const interceptor = config.interceptorEntry || config.interceptor;
    const target = config.targetEntry || config.target;
    if (!interceptor || !target) return false;
    if (interceptor.actorId === target.actorId) return false;
    if (actionTargetsActor(target.action || target, interceptor.actorId)) return true;
    const interceptorSpeed = finiteNumber(interceptor.speed, 0);
    const targetSpeed = finiteNumber(target.speed, 0);
    return interceptorSpeed > targetSpeed;
  }

  function cancelActorActions(queue, actorId, reason = { type: "stagger" }, options = {}) {
    const wanted = String(actorId ?? "");
    const partId = options.partId == null ? null : String(options.partId);
    const cancelled = [];
    for (const entry of queue?.entries || []) {
      if (entry.actorId !== wanted) continue;
      if (partId != null && entry.partId !== partId) continue;
      const action = entry.action;
      if (terminal(action)) continue;
      action.state = "cancelled";
      action.cancelReason = typeof reason === "string" ? { type: normalizeId(reason) || "cancelled" } : { ...(reason || { type: "cancelled" }) };
      cancelled.push(action.id);
    }
    return cancelled;
  }

  function isTargetAvailable(target = {}) {
    if (!target || !entityId(target)) return false;
    if (target.defeated === true || target.dead === true || target.removed === true || target.escaped === true) return false;
    if (Number.isFinite(Number(target.hp)) && Number(target.hp) <= 0) return false;
    return true;
  }

  function sameSide(a = {}, b = {}) {
    return sideOf(a) === sideOf(b);
  }

  function volleyMode(action = {}) {
    const raw = normalizeId(
      action.targeting?.volley ||
      action.metadata?.volley ||
      action.metadata?.sourceDefinition?.volley ||
      action.metadata?.sourceDefinition?.volleyMode ||
      action.metadata?.sourceDefinition?.targetingType ||
      action.metadata?.sourceDefinition?.targeting_type ||
      "focused"
    );
    return raw.includes("unfocused") ? "unfocused" : "focused";
  }

  function initialMarkedTargetIds(action = {}) {
    const ids = [];
    const main = action.targeting?.mainTargetId;
    if (main != null) ids.push(String(main));
    for (const id of asArray(action.targeting?.targetIds)) {
      const value = String(id);
      if (value && !ids.includes(value)) ids.push(value);
    }
    return ids.filter((id) => id !== String(action.actorId || ""));
  }

  function targetPool(action = {}, units = [], options = {}) {
    const actor = asArray(units).find((unit) => entityId(unit) === String(action.actorId || "")) || null;
    const available = asArray(units).filter((unit) => entityId(unit) !== String(action.actorId || "") && (options.isAvailable || isTargetAvailable)(unit));
    const weight = Math.max(1, Math.trunc(Number(action.targeting?.attackWeight || 1)));
    const marked = initialMarkedTargetIds(action);

    if (weight > 1 && marked.length) {
      const markedSet = new Set(marked);
      return available.filter((unit) => markedSet.has(entityId(unit)));
    }

    const indiscriminate = action.targeting?.indiscriminate === true || normalizeId(action.targeting?.mode) === "indiscriminate";
    if (indiscriminate) return available;

    const allegiance = normalizeId(action.targeting?.allegiance || "enemy");
    if (!actor) return available;
    if (allegiance === "ally") return available.filter((unit) => sameSide(actor, unit));
    if (allegiance === "neutral") return available.filter((unit) => normalizeId(unit.faction || unit.side || unit.team) === "neutral");
    return available.filter((unit) => !sameSide(actor, unit));
  }

  function selectCoinTarget(action = {}, units = [], state = {}, options = {}) {
    const mode = volleyMode(action);
    const availableById = new Map(asArray(units).filter((unit) => (options.isAvailable || isTargetAvailable)(unit)).map((unit) => [entityId(unit), unit]));

    if (mode === "focused") {
      const targetId = String(state.focusedTargetId || action.targeting?.mainTargetId || initialMarkedTargetIds(action)[0] || "");
      if (!targetId || targetId === String(action.actorId || "") || !availableById.has(targetId)) {
        return { targetId: null, cancelled: true, reason: "focused_target_unavailable", state: { ...state, focusedTargetId: targetId || null } };
      }
      return { targetId, cancelled: false, state: { ...state, focusedTargetId: targetId, previousTargetId: targetId } };
    }

    const pool = targetPool(action, units, options);
    if (!pool.length) return { targetId: null, cancelled: true, reason: "no_available_targets", state: { ...state } };
    const previous = String(state.previousTargetId || "");
    let choices = pool;
    if (pool.length > 1 && previous) {
      const withoutPrevious = pool.filter((unit) => entityId(unit) !== previous);
      if (withoutPrevious.length) choices = withoutPrevious;
    }
    const random = typeof options.random === "function" ? options.random : Math.random;
    const index = Math.min(choices.length - 1, Math.floor(Math.max(0, finiteNumber(random(), 0)) * choices.length));
    const targetId = entityId(choices[index]);
    return { targetId, cancelled: false, state: { ...state, previousTargetId: targetId } };
  }

  function retargetStatus(action = {}, units = [], options = {}) {
    const mode = volleyMode(action);
    const pool = targetPool(action, units, options);
    if (mode === "unfocused") return pool.length ? { executable: true, mode, requiresRetarget: false } : { executable: false, mode, reason: "no_available_targets" };
    const mainId = String(action.targeting?.mainTargetId || "");
    const target = asArray(units).find((unit) => entityId(unit) === mainId);
    if (target && (options.isAvailable || isTargetAvailable)(target)) return { executable: true, mode, requiresRetarget: false };
    return pool.length
      ? { executable: false, mode, requiresRetarget: true, candidates: pool.map(entityId) }
      : { executable: false, mode, requiresRetarget: false, reason: "no_available_targets" };
  }

  const api = Object.freeze({
    PHASE_COMBAT,
    SIDE_A,
    SIDE_B,
    entityId,
    sideOf,
    partIdOf,
    resolveRoundSpeed,
    buildRoundOrder,
    actionTargetsActor,
    canForceClash,
    cancelActorActions,
    volleyMode,
    targetPool,
    selectCoinTarget,
    retargetStatus,
    isTargetAvailable,
  });

  global.LuminousCombatActionQueue = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
