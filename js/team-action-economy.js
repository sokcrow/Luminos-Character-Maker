(function (global) {
  "use strict";

  if (global.LuminousTeamActionEconomy) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousTeamActionEconomy;
    return;
  }

  const DEFAULT_ACTION_CAP = 12;
  const DEFAULT_BALANCE_TOLERANCE = 1;
  const ALLY_TRIPLE_SLOT_LIMIT = 2;
  const MAX_REDISTRIBUTION_PER_ROUND = 1;

  const PHASES = Object.freeze({
    PLANNING_PLAYER: "planning_player",
    PLANNING_AI: "planning_ai",
    COMBAT: "combat",
    TURN_END: "turn_end",
  });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const finiteInt = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  function idFor(unit = {}, fallback = "unit") {
    return String(unit.id || unit.unitId || unit.characterId || unit.actorId || unit.name || fallback);
  }

  function numericSpeed(unit = {}) {
    const candidates = [unit.resolvedSpeed, unit.currentSpeed, unit.speedRoll, unit.speedValue, unit.speed_value, unit.speed];
    const found = candidates.map(Number).find(Number.isFinite);
    return found == null ? 0 : found;
  }

  function slotData(unit = {}) {
    const nested = unit.actionSlotState && typeof unit.actionSlotState === "object" ? unit.actionSlotState
      : unit.actionSlots && typeof unit.actionSlots === "object" ? unit.actionSlots
        : {};
    const scalarActionSlots = Number.isFinite(Number(unit.actionSlots)) ? Number(unit.actionSlots) : null;
    const initial = finiteInt(
      nested.initial ?? unit.initialActionSlots ?? unit.initial_action_slots ?? scalarActionSlots ?? unit.activeSlots,
      1
    );
    const current = finiteInt(
      nested.current ?? unit.currentActionSlots ?? unit.current_action_slots ?? initial,
      initial
    );
    const max = finiteInt(
      nested.max ?? unit.maxActionSlots ?? unit.max_action_slots ?? Math.max(initial, current, 1),
      Math.max(initial, current, 1)
    );
    return {
      initial: Math.max(0, initial),
      current: Math.max(0, current),
      max: Math.max(0, max),
    };
  }

  function scalingRule(unit = {}) {
    const raw = unit.slotScaling || unit.actionSlotRule || unit.action_slot_rule || unit.actionSlotsRule || null;
    if (!raw || typeof raw !== "object") return null;
    const type = normalizeId(raw.type || raw.mode);
    if (!["opponent_relative", "opponentrelative"].includes(type)) return null;
    return {
      type: "opponent_relative",
      offset: finiteInt(raw.offset, 0),
    };
  }

  function buildProfile(unit, side, index) {
    const slots = slotData(unit);
    return {
      id: idFor(unit, `${side}_${index}`),
      unit,
      side,
      speed: numericSpeed(unit),
      initialActionSlots: slots.initial,
      currentActionSlots: clamp(slots.current, 0, Math.max(slots.max, slots.current)),
      maxActionSlots: Math.max(slots.max, slots.initial, slots.current),
      usableActionSlots: 0,
      balanceLockedSlots: 0,
      statusLockedSlots: 0,
      scaling: scalingRule(unit),
    };
  }

  function createTeam(side, units = [], backups = [], options = {}) {
    const normalizedSide = normalizeId(side) === "enemy" || normalizeId(side) === "enemies" ? "enemies" : "allies";
    const profiles = (Array.isArray(units) ? units : []).map((unit, index) => buildProfile(unit, normalizedSide, index));
    const backupProfiles = (Array.isArray(backups) ? backups : []).map((unit, index) => buildProfile(unit, normalizedSide, index + profiles.length));
    return {
      side: normalizedSide,
      actionCap: Math.max(1, finiteInt(options.actionCap, DEFAULT_ACTION_CAP)),
      active: profiles,
      backups: backupProfiles,
      quickActionRemaining: 1,
      helpRemaining: 1,
      pendingRedistribution: Math.max(0, finiteInt(options.pendingRedistribution, 0)),
      heldVacatedSlots: Math.max(0, finiteInt(options.heldVacatedSlots, 0)),
      roundGrowthEnabled: options.roundGrowthEnabled ?? (normalizedSide === "enemies"),
      ready: false,
    };
  }

  function speedOrder(team) {
    return [...team.active].sort((a, b) => (b.speed - a.speed) || String(a.id).localeCompare(String(b.id)));
  }

  function alliedEffectiveMax(team, profile) {
    const ordered = speedOrder(team);
    const tripleEligible = new Set(ordered.slice(0, ALLY_TRIPLE_SLOT_LIMIT).map((entry) => entry.id));
    const sideCap = tripleEligible.has(profile.id) ? 3 : 2;
    return Math.min(profile.maxActionSlots, sideCap);
  }

  function effectiveMax(team, profile) {
    return team.side === "allies" ? alliedEffectiveMax(team, profile) : profile.maxActionSlots;
  }

  function totalAllocated(team) {
    return team.active.reduce((sum, profile) => sum + Math.max(0, finiteInt(profile.currentActionSlots, 0)), 0);
  }

  function totalUsable(team) {
    return team.active.reduce((sum, profile) => sum + Math.max(0, finiteInt(profile.usableActionSlots, 0)), 0);
  }

  function distributeAlliedSlots(team) {
    if (team.side !== "allies") return team;
    for (const profile of team.active) {
      const max = effectiveMax(team, profile);
      profile.currentActionSlots = clamp(Math.max(profile.initialActionSlots, profile.currentActionSlots), 0, max);
    }
    for (const profile of speedOrder(team)) {
      const max = effectiveMax(team, profile);
      while (profile.currentActionSlots < max && totalAllocated(team) < team.actionCap) {
        profile.currentActionSlots += 1;
      }
      if (totalAllocated(team) >= team.actionCap) break;
    }
    return team;
  }

  function applyOpponentRelativeScaling(team, opponentAllocated) {
    const relative = team.active.filter((profile) => profile.scaling?.type === "opponent_relative");
    if (!relative.length) return team;
    for (const profile of relative) {
      const target = clamp(opponentAllocated + profile.scaling.offset, profile.initialActionSlots, effectiveMax(team, profile));
      profile.currentActionSlots = target;
    }
    return team;
  }

  function grantOneSlot(team, options = {}) {
    if (totalAllocated(team) >= team.actionCap) return null;
    const preferred = options.preferredUnitId ? String(options.preferredUnitId) : null;
    const ordered = speedOrder(team);
    if (preferred) ordered.sort((a, b) => (a.id === preferred ? -1 : b.id === preferred ? 1 : 0));
    const recipient = ordered.find((profile) => profile.currentActionSlots < effectiveMax(team, profile));
    if (!recipient) return null;
    recipient.currentActionSlots += 1;
    return recipient;
  }

  function applyRoundGrowth(team) {
    let growth = null;
    if (team.roundGrowthEnabled) growth = grantOneSlot(team);
    let redistributed = null;
    if (team.pendingRedistribution > 0 && team.backups.length === 0) {
      redistributed = grantOneSlot(team);
      if (redistributed) team.pendingRedistribution = Math.max(0, team.pendingRedistribution - MAX_REDISTRIBUTION_PER_ROUND);
    }
    return { growth, redistributed };
  }

  function allocationForBalance(team, usableCap) {
    const ordered = speedOrder(team);
    const byId = new Map(ordered.map((profile) => [profile.id, profile]));
    const usable = new Map(team.active.map((profile) => [profile.id, profile.currentActionSlots]));
    let current = totalAllocated(team);
    const slowest = [...ordered].reverse();
    while (current > usableCap) {
      let changed = false;
      for (const profile of slowest) {
        const value = usable.get(profile.id) || 0;
        if (value <= 1) continue;
        usable.set(profile.id, value - 1);
        current -= 1;
        changed = true;
        if (current <= usableCap) break;
      }
      if (current <= usableCap) break;
      if (!changed) {
        for (const profile of slowest) {
          const value = usable.get(profile.id) || 0;
          if (value <= 0) continue;
          usable.set(profile.id, value - 1);
          current -= 1;
          changed = true;
          if (current <= usableCap) break;
        }
      }
      if (!changed) break;
    }

    for (const [id, profile] of byId.entries()) {
      const balanced = Math.max(0, usable.get(id) || 0);
      const statusLock = clamp(profile.statusLockedSlots, 0, balanced);
      profile.usableActionSlots = Math.max(0, balanced - statusLock);
      profile.balanceLockedSlots = Math.max(0, profile.currentActionSlots - balanced);
    }
    return team;
  }

  function reconcileBalance(encounter) {
    const tolerance = Math.max(0, finiteInt(encounter.balanceTolerance, DEFAULT_BALANCE_TOLERANCE));
    const allyAllocated = totalAllocated(encounter.allies);
    const enemyAllocated = totalAllocated(encounter.enemies);
    const allyCap = Math.min(allyAllocated, enemyAllocated + tolerance);
    const enemyCap = Math.min(enemyAllocated, allyAllocated + tolerance);
    allocationForBalance(encounter.allies, allyCap);
    allocationForBalance(encounter.enemies, enemyCap);
    encounter.balance = {
      tolerance,
      allocatedDifference: allyAllocated - enemyAllocated,
      usableDifference: totalUsable(encounter.allies) - totalUsable(encounter.enemies),
    };
    return encounter.balance;
  }

  function syncUnitAliases(team) {
    for (const profile of team.active) {
      const unit = profile.unit;
      if (!unit || typeof unit !== "object") continue;
      unit.initialActionSlots = profile.initialActionSlots;
      unit.currentActionSlots = profile.currentActionSlots;
      unit.maxActionSlots = profile.maxActionSlots;
      unit.activeSlots = profile.usableActionSlots;
      unit.actionSlotState = {
        initial: profile.initialActionSlots,
        current: profile.currentActionSlots,
        max: profile.maxActionSlots,
        usable: profile.usableActionSlots,
        balanceLocked: profile.balanceLockedSlots,
        statusLocked: profile.statusLockedSlots,
      };
    }
  }

  function syncEncounter(encounter) {
    reconcileBalance(encounter);
    syncUnitAliases(encounter.allies);
    syncUnitAliases(encounter.enemies);
    return encounter;
  }

  function createEncounter(config = {}) {
    const allies = createTeam("allies", config.allies || [], config.allyBackups || config.alliedBackups || [], config.alliesOptions || {});
    const enemies = createTeam("enemies", config.enemies || [], config.enemyBackups || [], config.enemiesOptions || {});
    const encounter = {
      id: String(config.id || `encounter_${Date.now()}`),
      round: Math.max(1, finiteInt(config.round, 1)),
      phase: PHASES.PLANNING_PLAYER,
      balanceTolerance: Math.max(0, finiteInt(config.balanceTolerance, DEFAULT_BALANCE_TOLERANCE)),
      allies,
      enemies,
      turnEndQueue: [],
      history: [],
    };
    distributeAlliedSlots(allies);
    applyOpponentRelativeScaling(enemies, totalAllocated(allies));
    applyOpponentRelativeScaling(allies, totalAllocated(enemies));
    resetPlanningResources(encounter);
    return syncEncounter(encounter);
  }

  function resetPlanningResources(encounter) {
    for (const team of [encounter.allies, encounter.enemies]) {
      team.quickActionRemaining = 1;
      team.helpRemaining = 1;
      team.ready = false;
    }
    return encounter;
  }

  function teamForSide(encounter, side) {
    return normalizeId(side).startsWith("enem") ? encounter.enemies : encounter.allies;
  }

  function profileForUnit(encounter, unitOrId) {
    const wanted = typeof unitOrId === "object" ? idFor(unitOrId) : String(unitOrId ?? "");
    for (const team of [encounter.allies, encounter.enemies]) {
      const profile = team.active.find((entry) => entry.id === wanted || entry.unit === unitOrId);
      if (profile) return { team, profile };
    }
    return null;
  }

  function consumeQuickAction(encounter, side) {
    const team = teamForSide(encounter, side);
    if (![PHASES.PLANNING_PLAYER, PHASES.PLANNING_AI].includes(encounter.phase)) return { consumed: false, reason: "quick_action_planning_only" };
    if (team.quickActionRemaining <= 0) return { consumed: false, reason: "team_quick_action_spent" };
    team.quickActionRemaining = 0;
    return { consumed: true, remaining: 0 };
  }

  function consumeHelp(encounter, side) {
    const team = teamForSide(encounter, side);
    if (team.helpRemaining <= 0) return { consumed: false, reason: "team_help_spent" };
    team.helpRemaining = 0;
    return { consumed: true, remaining: 0 };
  }

  function lockUnitSlots(encounter, unitOrId, count = 1, reason = "status") {
    const found = profileForUnit(encounter, unitOrId);
    if (!found) return { locked: false, reason: "unit_not_active" };
    found.profile.statusLockedSlots = clamp(found.profile.statusLockedSlots + Math.max(0, finiteInt(count, 1)), 0, found.profile.currentActionSlots);
    syncEncounter(encounter);
    return { locked: true, reason, count: found.profile.statusLockedSlots, usable: found.profile.usableActionSlots };
  }

  function unlockUnitSlots(encounter, unitOrId, count = 1) {
    const found = profileForUnit(encounter, unitOrId);
    if (!found) return false;
    found.profile.statusLockedSlots = Math.max(0, found.profile.statusLockedSlots - Math.max(0, finiteInt(count, 1)));
    syncEncounter(encounter);
    return true;
  }

  function registerVacatedSlots(encounter, side, count, options = {}) {
    const team = teamForSide(encounter, side);
    const amount = Math.max(0, finiteInt(count, 0));
    const hasBackup = options.hasBackup ?? (team.backups.length > 0);
    if (hasBackup) team.heldVacatedSlots += amount;
    else team.pendingRedistribution += amount;
    return { held: team.heldVacatedSlots, pending: team.pendingRedistribution };
  }

  function inheritReplacementSlots(encounter, side, outgoingUnitOrId, incomingUnit, options = {}) {
    const team = teamForSide(encounter, side);
    const outgoingFound = profileForUnit(encounter, outgoingUnitOrId);
    const outgoingSlots = outgoingFound?.profile?.currentActionSlots || finiteInt(options.outgoingSlots, 1);
    const incoming = buildProfile(incomingUnit, team.side, team.active.length + team.backups.length);
    const cap = Math.max(1, finiteInt(options.cap, 2));
    incoming.currentActionSlots = Math.min(outgoingSlots, cap, effectiveMax(team, incoming));
    incoming.initialActionSlots = Math.min(incoming.initialActionSlots, incoming.currentActionSlots || incoming.initialActionSlots);
    return incoming;
  }

  function queueTurnEndAction(encounter, entry = {}) {
    const queued = {
      id: String(entry.id || `turn_end_${encounter.round}_${encounter.turnEndQueue.length}`),
      type: normalizeId(entry.type || "effect"),
      unitId: entry.unitId == null ? null : String(entry.unitId),
      payload: entry.payload && typeof entry.payload === "object" ? { ...entry.payload } : {},
      cancelled: false,
      cancelReason: null,
    };
    encounter.turnEndQueue.push(queued);
    return queued;
  }

  function cancelTurnEndActionsForUnit(encounter, unitOrId, reason = "cancelled") {
    const wanted = typeof unitOrId === "object" ? idFor(unitOrId) : String(unitOrId ?? "");
    let count = 0;
    for (const entry of encounter.turnEndQueue) {
      if (entry.unitId !== wanted || entry.cancelled) continue;
      entry.cancelled = true;
      entry.cancelReason = reason;
      count += 1;
    }
    return count;
  }

  function resolveTurnEndQueue(encounter, handlers = {}) {
    const results = [];
    for (const entry of encounter.turnEndQueue) {
      if (entry.cancelled) {
        results.push({ entry, resolved: false, reason: entry.cancelReason || "cancelled" });
        continue;
      }
      const handler = handlers[entry.type] || handlers.default;
      if (typeof handler !== "function") {
        results.push({ entry, resolved: false, reason: "missing_handler" });
        continue;
      }
      results.push({ entry, resolved: true, result: handler(entry, encounter) });
    }
    encounter.turnEndQueue = [];
    return results;
  }

  function playerReady(encounter, options = {}) {
    if (encounter.phase !== PHASES.PLANNING_PLAYER) return { ready: false, reason: "not_player_planning" };
    encounter.allies.ready = true;
    encounter.phase = PHASES.PLANNING_AI;
    let aiResult = null;
    if (typeof options.aiPlanner === "function") aiResult = options.aiPlanner(encounter);
    return { ready: true, phase: encounter.phase, aiResult };
  }

  function aiReady(encounter) {
    if (encounter.phase !== PHASES.PLANNING_AI) return { ready: false, reason: "not_ai_planning" };
    encounter.enemies.ready = true;
    encounter.phase = PHASES.COMBAT;
    return { ready: true, phase: encounter.phase };
  }

  function beginTurnEnd(encounter) {
    if (encounter.phase !== PHASES.COMBAT) return { started: false, reason: "combat_phase_required" };
    encounter.phase = PHASES.TURN_END;
    return { started: true, phase: encounter.phase };
  }

  function beginNextRound(encounter) {
    encounter.round += 1;
    const allyGrowth = applyRoundGrowth(encounter.allies);
    const enemyGrowth = applyRoundGrowth(encounter.enemies);
    applyOpponentRelativeScaling(encounter.enemies, totalAllocated(encounter.allies));
    applyOpponentRelativeScaling(encounter.allies, totalAllocated(encounter.enemies));
    resetPlanningResources(encounter);
    encounter.phase = PHASES.PLANNING_PLAYER;
    syncEncounter(encounter);
    return { round: encounter.round, phase: encounter.phase, allyGrowth, enemyGrowth };
  }

  function endRound(encounter, handlers = {}) {
    if (encounter.phase === PHASES.COMBAT) beginTurnEnd(encounter);
    if (encounter.phase !== PHASES.TURN_END) return { ended: false, reason: "turn_end_phase_required" };
    const turnEndResults = resolveTurnEndQueue(encounter, handlers);
    const next = beginNextRound(encounter);
    return { ended: true, turnEndResults, ...next };
  }

  function snapshot(encounter) {
    const teamSnapshot = (team) => ({
      side: team.side,
      actionCap: team.actionCap,
      allocated: totalAllocated(team),
      usable: totalUsable(team),
      quickActionRemaining: team.quickActionRemaining,
      helpRemaining: team.helpRemaining,
      pendingRedistribution: team.pendingRedistribution,
      heldVacatedSlots: team.heldVacatedSlots,
      active: team.active.map((profile) => ({
        id: profile.id,
        speed: profile.speed,
        initial: profile.initialActionSlots,
        current: profile.currentActionSlots,
        max: profile.maxActionSlots,
        usable: profile.usableActionSlots,
        balanceLocked: profile.balanceLockedSlots,
        statusLocked: profile.statusLockedSlots,
      })),
      backups: team.backups.map((profile) => profile.id),
    });
    return {
      id: encounter.id,
      round: encounter.round,
      phase: encounter.phase,
      balance: { ...(encounter.balance || {}) },
      allies: teamSnapshot(encounter.allies),
      enemies: teamSnapshot(encounter.enemies),
      turnEndQueue: encounter.turnEndQueue.map((entry) => ({ ...entry, payload: { ...entry.payload } })),
    };
  }

  const api = Object.freeze({
    DEFAULT_ACTION_CAP,
    DEFAULT_BALANCE_TOLERANCE,
    ALLY_TRIPLE_SLOT_LIMIT,
    MAX_REDISTRIBUTION_PER_ROUND,
    PHASES,
    idFor,
    numericSpeed,
    slotData,
    scalingRule,
    createTeam,
    createEncounter,
    speedOrder,
    effectiveMax,
    totalAllocated,
    totalUsable,
    distributeAlliedSlots,
    applyOpponentRelativeScaling,
    grantOneSlot,
    applyRoundGrowth,
    reconcileBalance,
    syncEncounter,
    teamForSide,
    profileForUnit,
    consumeQuickAction,
    consumeHelp,
    lockUnitSlots,
    unlockUnitSlots,
    registerVacatedSlots,
    inheritReplacementSlots,
    queueTurnEndAction,
    cancelTurnEndActionsForUnit,
    resolveTurnEndQueue,
    playerReady,
    aiReady,
    beginTurnEnd,
    beginNextRound,
    endRound,
    snapshot,
  });

  global.LuminousTeamActionEconomy = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
