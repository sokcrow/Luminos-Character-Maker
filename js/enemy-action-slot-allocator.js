(function (global) {
  "use strict";

  if (global.LuminousEnemyActionSlotAllocator) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousEnemyActionSlotAllocator;
    return;
  }

  const safeRequire = (path) => {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  };

  const profileCatalog = () => global.LuminousUnitActionEconomyCatalog || safeRequire("./unit-action-economy-catalog.js");
  const actionEconomy = () => global.LuminousActionEconomy || safeRequire("./universal-action-economy.js");
  const kitAdapter = () => global.LuminousUnitAiKitAdapter || safeRequire("./unit-ai-kit-adapter.js");

  const DEFAULT_TEAM_SLOT_CAP = 12;
  const DEFAULT_BONUS_RECIPIENT_LIMIT = 2;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const clean = (value) => String(value ?? "").trim();
  const normalizeId = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const finiteInt = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
  const clampInt = (value, min, max) => Math.max(min, Math.min(max, finiteInt(value, min)));

  function unitIdOf(unit = {}) {
    return clean(unit.id ?? unit.unitId ?? unit.characterId ?? unit.actorId);
  }

  function factionOf(unit = {}) {
    return normalizeId(unit.faction ?? unit.faccion ?? unit.side ?? unit.team ?? unit.actorCategory ?? unit.unitType);
  }

  function isEnemy(unit = {}) {
    return ["enemy", "enemies", "boss", "hostile"].includes(factionOf(unit));
  }

  function currentHp(unit = {}) {
    const values = [unit.hp, unit.currentHp, unit.currentHP, unit.mechanics?.hp];
    const found = values.map(Number).find(Number.isFinite);
    return found == null ? null : found;
  }

  function isActive(unit = {}) {
    if (!unit || typeof unit !== "object") return false;
    if (unit.dead === true || unit.defeated === true || unit.isDead === true || unit.removed === true) return false;
    const hp = currentHp(unit);
    return hp == null || hp > 0;
  }

  function embeddedProfile(unit = {}) {
    const raw = unit.actionEconomy || unit.mechanics?.actionEconomy || unit.ai?.actionEconomy || null;
    if (!raw || typeof raw !== "object") return null;
    const minSlots = Math.max(1, finiteInt(raw.minSlots ?? raw.minimumSlots ?? raw.baseSlots, 1));
    const maxSlots = Math.max(minSlots, finiteInt(raw.maxSlots ?? raw.maximumSlots ?? raw.slotCap, minSlots));
    return { source: "unit", minSlots, maxSlots };
  }

  function legacyProfile(unit = {}) {
    const minRaw = unit.mechanics?.actionSlots ?? unit.baseActionSlots ?? 1;
    const maxRaw = unit.mechanics?.maxSlotsLimit ?? unit.maxActionSlots ?? minRaw;
    const minSlots = Math.max(1, finiteInt(minRaw, 1));
    const maxSlots = Math.max(minSlots, finiteInt(maxRaw, minSlots));
    return { source: "legacy", minSlots, maxSlots };
  }

  function profileFor(unit = {}, options = {}) {
    const embedded = embeddedProfile(unit);
    const catalog = profileCatalog()?.get?.(unit);
    const raw = embedded || (catalog ? { source: "catalog", ...catalog } : null) || legacyProfile(unit);
    const teamCap = Math.max(1, finiteInt(options.teamSlotCap, DEFAULT_TEAM_SLOT_CAP));
    const minSlots = clampInt(raw.minSlots, 1, teamCap);
    const maxSlots = clampInt(raw.maxSlots, minSlots, teamCap);
    return {
      source: raw.source || "catalog",
      profileId: raw.id || profileCatalog()?.canonicalUnitId?.(unit) || null,
      minSlots,
      maxSlots,
    };
  }

  function speedInfoFor(unit = {}, options = {}) {
    const id = unitIdOf(unit);
    const source = options.speedByUnitId;
    let explicit;
    if (typeof source === "function") explicit = source(unit, id);
    else if (source && typeof source === "object") explicit = source[id];
    if (Number.isFinite(Number(explicit))) return { value: Number(explicit), source: "round_override" };

    const candidates = [
      ["resolvedSpeed", unit.resolvedSpeed],
      ["currentSpeed", unit.currentSpeed],
      ["speedRoll", unit.speedRoll],
      ["speedValue", unit.speedValue],
      ["speed", unit.speed],
    ];
    for (const [field, value] of candidates) {
      if (Number.isFinite(Number(value))) return { value: Number(value), source: field };
    }
    return { value: null, source: null };
  }

  function speedFor(unit = {}, options = {}) {
    return speedInfoFor(unit, options).value;
  }

  function validateEnemyIds(entries = []) {
    const seen = new Set();
    for (const entry of entries) {
      const id = unitIdOf(entry.unit);
      if (!id) return { valid: false, reason: "enemy_unit_id_required", deploymentIndex: entry.deploymentIndex };
      if (seen.has(id)) return { valid: false, reason: "duplicate_enemy_unit_id", unitId: id };
      seen.add(id);
    }
    return { valid: true, reason: null };
  }

  function slotIdsFor(unit, count = null) {
    const id = unitIdOf(unit);
    const max = count == null
      ? Math.max(0, finiteInt(unit.activeSlots ?? unit.currentActionSlots ?? unit.actionSlots, 0))
      : Math.max(0, finiteInt(count, 0));
    return Array.from({ length: max }, (_, index) => `${id}_slot_${index}`);
  }

  function syncSlotObjects(unit, count) {
    const existing = Array.isArray(unit.slots) ? unit.slots : [];
    unit.slots = Array.from({ length: count }, (_, index) => ({
      ...(existing[index] && typeof existing[index] === "object" ? existing[index] : {}),
      id: `${unitIdOf(unit)}_slot_${index}`,
      slotWeight: Number.isFinite(Number(existing[index]?.slotWeight)) ? Number(existing[index].slotWeight) : 1,
      isTargetedThisRound: false,
    }));
    return unit.slots;
  }

  function applySlotCount(unit, count, row = null, options = {}) {
    const next = Math.max(0, finiteInt(count, 0));
    unit.activeSlots = next;
    unit.currentActionSlots = next;
    unit.actionSlots = next;
    syncSlotObjects(unit, next);
    unit.actionSlotAllocation = {
      roundScoped: true,
      roundId: options.roundId ?? row?.roundId ?? null,
      slots: next,
      speed: row?.speed ?? null,
      speedSource: row?.speedSource ?? null,
      minSlots: row?.minSlots ?? next,
      maxSlots: row?.maxSlots ?? next,
      bonusSlots: row?.bonusSlots ?? Math.max(0, next - (row?.minSlots ?? next)),
      profileId: row?.profileId ?? null,
      profileSource: row?.profileSource ?? null,
      bonusEligible: row?.bonusEligible === true,
    };
    return next;
  }

  function allocateEnemySlots(units = [], options = {}) {
    const teamSlotCap = Math.max(1, finiteInt(options.teamSlotCap, DEFAULT_TEAM_SLOT_CAP));
    const bonusRecipientLimit = Math.max(0, finiteInt(options.bonusRecipientLimit, DEFAULT_BONUS_RECIPIENT_LIMIT));
    const allEnemies = (Array.isArray(units) ? units : [])
      .map((unit, deploymentIndex) => ({ unit, deploymentIndex }))
      .filter(({ unit }) => isEnemy(unit));
    const activeEnemies = allEnemies.filter(({ unit }) => isActive(unit));

    const idCheck = validateEnemyIds(activeEnemies);
    if (!idCheck.valid) {
      return {
        allocated: false,
        reason: idCheck.reason,
        teamSlotCap,
        bonusRecipientLimit,
        totalSlots: 0,
        minimumTotal: 0,
        rows: [],
        ...idCheck,
      };
    }

    const rows = activeEnemies.map(({ unit, deploymentIndex }) => {
      const profile = profileFor(unit, { ...options, teamSlotCap });
      const speedInfo = speedInfoFor(unit, options);
      return {
        unit,
        unitId: unitIdOf(unit),
        deploymentIndex,
        speed: speedInfo.value,
        speedSource: speedInfo.source,
        minSlots: profile.minSlots,
        maxSlots: profile.maxSlots,
        slots: profile.minSlots,
        bonusSlots: 0,
        profileId: profile.profileId,
        profileSource: profile.source,
        bonusEligible: false,
        roundId: options.roundId ?? null,
      };
    });

    const minimumTotal = rows.reduce((sum, row) => sum + row.minSlots, 0);
    if (minimumTotal > teamSlotCap) {
      return {
        allocated: false,
        reason: "minimum_slots_exceed_team_cap",
        teamSlotCap,
        minimumTotal,
        totalSlots: 0,
        activeEnemyCount: rows.length,
        inactiveEnemyCount: allEnemies.length - rows.length,
        bonusRecipientLimit,
        rows: rows.map((row) => ({ ...row, unit: undefined })),
      };
    }

    const eligible = rows
      .filter((row) => row.speed != null && row.maxSlots > row.minSlots)
      .sort((a, b) => (b.speed - a.speed) || (a.deploymentIndex - b.deploymentIndex) || a.unitId.localeCompare(b.unitId))
      .slice(0, bonusRecipientLimit);
    eligible.forEach((row) => { row.bonusEligible = true; });

    let totalSlots = minimumTotal;
    let progress = true;
    while (totalSlots < teamSlotCap && progress && eligible.length) {
      progress = false;
      for (const row of eligible) {
        if (totalSlots >= teamSlotCap) break;
        if (row.slots >= row.maxSlots) continue;
        row.slots += 1;
        row.bonusSlots += 1;
        totalSlots += 1;
        progress = true;
      }
    }

    if (options.apply !== false) rows.forEach((row) => applySlotCount(row.unit, row.slots, row, options));

    const missingSpeed = rows.filter((row) => row.speed == null && row.maxSlots > row.minSlots).map((row) => row.unitId);
    const resultRows = rows.map((row) => ({
      unitId: row.unitId,
      deploymentIndex: row.deploymentIndex,
      speed: row.speed,
      speedSource: row.speedSource,
      minSlots: row.minSlots,
      maxSlots: row.maxSlots,
      slots: row.slots,
      bonusSlots: row.bonusSlots,
      profileId: row.profileId,
      profileSource: row.profileSource,
      bonusEligible: row.bonusEligible,
      slotIds: slotIdsFor(row.unit, row.slots),
    }));

    return {
      allocated: true,
      roundId: options.roundId ?? null,
      teamSlotCap,
      bonusRecipientLimit,
      activeEnemyCount: rows.length,
      inactiveEnemyCount: allEnemies.length - rows.length,
      minimumTotal,
      totalSlots,
      unusedSlots: Math.max(0, teamSlotCap - totalSlots),
      missingSpeed,
      tieBreak: "deployment_order_then_unit_id",
      bonusRecipients: eligible.map((row) => row.unitId),
      rows: resultRows,
    };
  }

  function beginEnemyPlanningRound(units = [], options = {}) {
    // Preflight allocation without mutating live Units. Planning state is only touched
    // after ids, caps, Speed input and the Universal Action Economy contract are valid.
    const allocation = allocateEnemySlots(units, { ...options, apply: false });
    if (!allocation.allocated) return { allocation, planningReady: false, planning: [] };

    const economy = actionEconomy();
    if (!economy?.beginPlanning || !economy?.actionSlotMaximum) {
      return { allocation, planningReady: false, reason: "action_economy_unavailable", planning: [] };
    }

    const unitById = new Map((Array.isArray(units) ? units : []).map((unit) => [unitIdOf(unit), unit]));
    for (const row of allocation.rows) {
      if (!unitById.has(row.unitId)) {
        return { allocation, planningReady: false, reason: "allocated_unit_missing", unitId: row.unitId, planning: [] };
      }
    }

    for (const row of allocation.rows) {
      applySlotCount(unitById.get(row.unitId), row.slots, row, options);
    }

    const planning = [];
    for (const row of allocation.rows) {
      const unit = unitById.get(row.unitId);
      const snapshot = economy.beginPlanning(unit);
      const maximum = economy.actionSlotMaximum(unit);
      if (!snapshot || maximum !== row.slots || snapshot.actionSlots !== row.slots || snapshot.action !== row.slots) {
        return {
          allocation,
          planningReady: false,
          reason: "action_economy_slot_mismatch",
          unitId: row.unitId,
          expectedSlots: row.slots,
          actualSlots: maximum,
          snapshot: snapshot ? clone(snapshot) : null,
          planning,
        };
      }
      planning.push({ unitId: row.unitId, slots: row.slots, slotIds: row.slotIds.slice(), snapshot: clone(snapshot) });
    }
    return { allocation, planningReady: true, planning };
  }

  function allocateAndPlan(units = [], options = {}) {
    const round = beginEnemyPlanningRound(units, options);
    if (!round.allocation.allocated || !round.planningReady) return { ...round, plans: [] };

    const adapter = kitAdapter();
    if (!adapter?.planUnitTurn) return { ...round, plans: [], reason: "unit_ai_kit_adapter_unavailable" };

    const targetIds = Array.isArray(options.targetIds) ? options.targetIds : undefined;
    const targets = Array.isArray(options.targets) ? options.targets : undefined;
    const unitById = new Map((Array.isArray(units) ? units : []).map((unit) => [unitIdOf(unit), unit]));
    const plans = round.allocation.rows.map((row) => {
      const actor = unitById.get(row.unitId);
      const plan = adapter.planUnitTurn({
        ...(options.planOptions || {}),
        actor,
        slotIds: row.slotIds.slice(),
        availableSlots: row.slots,
        ...(targetIds ? { targetIds } : {}),
        ...(targets ? { targets } : {}),
      });
      return {
        unitId: row.unitId,
        slots: row.slots,
        slotIds: row.slotIds.slice(),
        plannedActions: Array.isArray(plan?.actions) ? plan.actions.length : 0,
        unusedSlots: Math.max(0, row.slots - (Array.isArray(plan?.actions) ? plan.actions.length : 0)),
        plan,
      };
    });
    return { ...round, plans };
  }

  const api = Object.freeze({
    version: "1.1.1",
    DEFAULT_TEAM_SLOT_CAP,
    DEFAULT_BONUS_RECIPIENT_LIMIT,
    unitIdOf,
    factionOf,
    isEnemy,
    isActive,
    profileFor,
    speedInfoFor,
    speedFor,
    validateEnemyIds,
    slotIdsFor,
    applySlotCount,
    allocateEnemySlots,
    beginEnemyPlanningRound,
    allocateAndPlan,
  });

  global.LuminousEnemyActionSlotAllocator = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
