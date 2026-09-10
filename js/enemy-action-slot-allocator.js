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
    return clean(unit.id ?? unit.unitId ?? unit.characterId ?? unit.actorId ?? unit.name);
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
    return {
      source: "unit",
      minSlots: Math.max(1, finiteInt(raw.minSlots ?? raw.minimumSlots ?? raw.baseSlots, 1)),
      maxSlots: Math.max(1, finiteInt(raw.maxSlots ?? raw.maximumSlots ?? raw.slotCap, 1)),
    };
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
    return { source: raw.source || "catalog", minSlots, maxSlots };
  }

  function speedFor(unit = {}, options = {}) {
    const id = unitIdOf(unit);
    const source = options.speedByUnitId;
    let explicit;
    if (typeof source === "function") explicit = source(unit, id);
    else if (source && typeof source === "object") explicit = source[id];
    if (Number.isFinite(Number(explicit))) return Number(explicit);

    const candidates = [unit.resolvedSpeed, unit.currentSpeed, unit.speedRoll, unit.speedValue, unit.speed];
    const found = candidates.map(Number).find(Number.isFinite);
    return found == null ? null : found;
  }

  function syncSlotObjects(unit, count) {
    const existing = Array.isArray(unit.slots) ? unit.slots : [];
    unit.slots = Array.from({ length: count }, (_, index) => ({
      id: `${unitIdOf(unit) || "unit"}_slot_${index}`,
      slotWeight: 1,
      isTargetedThisRound: false,
      ...(existing[index] && typeof existing[index] === "object" ? existing[index] : {}),
      id: `${unitIdOf(unit) || "unit"}_slot_${index}`,
    }));
    return unit.slots;
  }

  function applySlotCount(unit, count, row = null) {
    const next = Math.max(0, finiteInt(count, 0));
    unit.activeSlots = next;
    unit.currentActionSlots = next;
    unit.actionSlots = next;
    syncSlotObjects(unit, next);
    unit.actionSlotAllocation = {
      roundScoped: true,
      slots: next,
      speed: row?.speed ?? null,
      minSlots: row?.minSlots ?? next,
      maxSlots: row?.maxSlots ?? next,
      bonusSlots: row?.bonusSlots ?? Math.max(0, next - (row?.minSlots ?? next)),
      profileSource: row?.profileSource ?? null,
    };
    return next;
  }

  function allocateEnemySlots(units = [], options = {}) {
    const teamSlotCap = Math.max(1, finiteInt(options.teamSlotCap, DEFAULT_TEAM_SLOT_CAP));
    const bonusRecipientLimit = Math.max(0, finiteInt(options.bonusRecipientLimit, DEFAULT_BONUS_RECIPIENT_LIMIT));
    const enemies = (Array.isArray(units) ? units : [])
      .map((unit, deploymentIndex) => ({ unit, deploymentIndex }))
      .filter(({ unit }) => isEnemy(unit) && isActive(unit));

    const rows = enemies.map(({ unit, deploymentIndex }) => {
      const profile = profileFor(unit, { ...options, teamSlotCap });
      return {
        unit,
        unitId: unitIdOf(unit),
        deploymentIndex,
        speed: speedFor(unit, options),
        minSlots: profile.minSlots,
        maxSlots: profile.maxSlots,
        slots: profile.minSlots,
        bonusSlots: 0,
        profileSource: profile.source,
        bonusEligible: false,
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

    if (options.apply !== false) rows.forEach((row) => applySlotCount(row.unit, row.slots, row));

    const missingSpeed = rows.filter((row) => row.speed == null && row.maxSlots > row.minSlots).map((row) => row.unitId);
    const resultRows = rows.map((row) => ({
      unitId: row.unitId,
      deploymentIndex: row.deploymentIndex,
      speed: row.speed,
      minSlots: row.minSlots,
      maxSlots: row.maxSlots,
      slots: row.slots,
      bonusSlots: row.bonusSlots,
      profileSource: row.profileSource,
      bonusEligible: row.bonusEligible,
    }));

    return {
      allocated: true,
      teamSlotCap,
      bonusRecipientLimit,
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
    const allocation = allocateEnemySlots(units, options);
    if (!allocation.allocated) return { allocation, planning: [] };
    const economy = actionEconomy();
    const planning = [];
    for (const row of allocation.rows) {
      const unit = units.find((candidate) => unitIdOf(candidate) === row.unitId);
      if (!unit) continue;
      const snapshot = economy?.beginPlanning?.(unit) || null;
      planning.push({ unitId: row.unitId, slots: row.slots, snapshot: snapshot ? clone(snapshot) : null });
    }
    return { allocation, planning };
  }

  function allocateAndPlan(units = [], options = {}) {
    const round = beginEnemyPlanningRound(units, options);
    if (!round.allocation.allocated) return { ...round, plans: [] };
    const adapter = kitAdapter();
    if (!adapter?.planUnitTurn) return { ...round, plans: [], reason: "unit_ai_kit_adapter_unavailable" };

    const targetIds = Array.isArray(options.targetIds) ? options.targetIds : undefined;
    const targets = Array.isArray(options.targets) ? options.targets : undefined;
    const plans = round.allocation.rows.map((row) => {
      const actor = units.find((candidate) => unitIdOf(candidate) === row.unitId);
      const plan = adapter.planUnitTurn({
        ...(options.planOptions || {}),
        actor,
        availableSlots: row.slots,
        ...(targetIds ? { targetIds } : {}),
        ...(targets ? { targets } : {}),
      });
      return { unitId: row.unitId, slots: row.slots, plan };
    });
    return { ...round, plans };
  }

  const api = Object.freeze({
    version: "1.0.0",
    DEFAULT_TEAM_SLOT_CAP,
    DEFAULT_BONUS_RECIPIENT_LIMIT,
    unitIdOf,
    factionOf,
    isEnemy,
    isActive,
    profileFor,
    speedFor,
    applySlotCount,
    allocateEnemySlots,
    beginEnemyPlanningRound,
    allocateAndPlan,
  });

  global.LuminousEnemyActionSlotAllocator = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
