(function (global) {
  "use strict";

  if (global.LuminousUnitRankRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousUnitRankRuntime;
    return;
  }

  const BACKUP_COMMAND_SP_MULTIPLIER = 0.5;
  const RANKS = Object.freeze({
    normal: Object.freeze({
      id: "normal",
      levelMultiplier: 1,
      minSpeedBonus: 0,
      maxSpeedBonus: 0,
      applyBonus: 0,
      basePowerBonus: 0,
      commandLevel: 0,
      aiCoordination: "independent",
      targetPriority: "random",
      turnEndSpRecovery: 0,
    }),
    captain: Object.freeze({
      id: "captain",
      levelMultiplier: 2,
      minSpeedBonus: 0,
      maxSpeedBonus: 1,
      applyBonus: 1,
      basePowerBonus: 0,
      commandLevel: 1,
      aiCoordination: "focus_fire",
      targetPriority: "lowest_hp_ratio",
      turnEndSpRecovery: 5,
    }),
    leader: Object.freeze({
      id: "leader",
      levelMultiplier: 3,
      minSpeedBonus: 1,
      maxSpeedBonus: 2,
      applyBonus: 2,
      basePowerBonus: 1,
      commandLevel: 2,
      aiCoordination: "directed_focus",
      targetPriority: "lowest_hp_ratio_then_highest_threat",
      turnEndSpRecovery: 10,
    }),
  });

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clean = (value) => String(value ?? "").trim();
  const normalizeFaction = (value) => clean(value).toLowerCase();

  function normalizeRank(value, fallback = "normal") {
    const raw = clean(value || fallback).toLowerCase();
    return RANKS[raw] ? raw : fallback;
  }

  function rankForUnit(unit = {}) {
    return normalizeRank(
      unit.rank
      ?? unit.unitRank
      ?? unit.rankId
      ?? unit.mechanics?.rank
      ?? unit.metadata?.unitRank
      ?? unit.metadata?.rank,
      "normal"
    );
  }

  function profileForRank(rank) {
    return RANKS[normalizeRank(rank)];
  }

  function profileForUnit(unit = {}) {
    return profileForRank(rankForUnit(unit));
  }

  function effectiveLevel(baseLevel, rank) {
    const level = Math.max(1, Math.floor(finite(baseLevel, 1)));
    return level * profileForRank(rank).levelMultiplier;
  }

  function factionForUnit(unit = {}) {
    return normalizeFaction(unit.faction ?? unit.faccion ?? unit.side ?? unit.team ?? "");
  }

  function currentHp(unit = {}) {
    const candidates = [unit.hp, unit.currentHp, unit.currentHP, unit.mechanics?.hp];
    const found = candidates.map(Number).find(Number.isFinite);
    return found == null ? null : found;
  }

  function maxHp(unit = {}) {
    const candidates = [unit.maxHp, unit.maxHP, unit.hpMax, unit.hp_max, unit.mechanics?.maxHp, unit.mechanics?.hp];
    const found = candidates.map(Number).find((value) => Number.isFinite(value) && value > 0);
    return found == null ? null : found;
  }

  function isActiveUnit(unit = {}) {
    if (!unit || typeof unit !== "object") return false;
    if (unit.dead === true || unit.defeated === true || unit.isDead === true || unit.removed === true) return false;
    const hp = currentHp(unit);
    return hp == null || hp > 0;
  }

  function commandProfile(units = []) {
    const active = (Array.isArray(units) ? units : []).filter(isActiveUnit);
    let best = RANKS.normal;
    let commander = null;
    active.forEach((unit) => {
      const profile = profileForUnit(unit);
      if (profile.commandLevel > best.commandLevel) {
        best = profile;
        commander = unit;
      }
    });
    return {
      rank: best.id,
      commandLevel: best.commandLevel,
      aiCoordination: best.aiCoordination,
      targetPriority: best.targetPriority,
      turnEndSpRecovery: best.turnEndSpRecovery,
      commanderId: commander ? clean(commander.id || commander.unitId || commander.actorId || commander.name) : null,
      commander: commander || null,
    };
  }

  function commandProfilesByFaction(units = []) {
    const groups = new Map();
    (Array.isArray(units) ? units : []).filter(isActiveUnit).forEach((unit) => {
      const faction = factionForUnit(unit);
      if (!faction) return;
      if (!groups.has(faction)) groups.set(faction, []);
      groups.get(faction).push(unit);
    });
    const result = {};
    groups.forEach((members, faction) => { result[faction] = commandProfile(members); });
    return result;
  }

  function readSp(unit = {}) {
    const candidates = [unit.sp, unit.currentSp, unit.currentSP, unit.mechanics?.sp];
    const found = candidates.map(Number).find(Number.isFinite);
    return found == null ? 0 : found;
  }

  function readMaxSp(unit = {}) {
    const candidates = [unit.maxSp, unit.maxSP, unit.spMax, unit.sp_max, unit.mechanics?.maxSp, unit.mechanics?.spMax];
    const found = candidates.map(Number).find(Number.isFinite);
    return found == null ? null : found;
  }

  function writeSp(unit, value) {
    const next = finite(value, 0);
    if (Object.prototype.hasOwnProperty.call(unit, "sp") || !unit.mechanics) unit.sp = next;
    if (Object.prototype.hasOwnProperty.call(unit, "currentSp")) unit.currentSp = next;
    if (Object.prototype.hasOwnProperty.call(unit, "currentSP")) unit.currentSP = next;
    if (unit.mechanics && typeof unit.mechanics === "object") unit.mechanics.sp = next;
    return next;
  }

  function recoverSp(unit, amount) {
    if (!isActiveUnit(unit)) return { unit, before: readSp(unit), after: readSp(unit), recovered: 0 };
    const before = readSp(unit);
    const max = readMaxSp(unit);
    const requested = Math.max(0, finite(amount, 0));
    const after = max == null ? before + requested : Math.min(max, before + requested);
    writeSp(unit, after);
    return { unit, before, after, recovered: Math.max(0, after - before) };
  }

  function applyTurnEndSpRecovery(units = []) {
    const active = (Array.isArray(units) ? units : []).filter(isActiveUnit);
    const byFaction = new Map();
    active.forEach((unit) => {
      const faction = factionForUnit(unit);
      if (!faction) return;
      if (!byFaction.has(faction)) byFaction.set(faction, []);
      byFaction.get(faction).push(unit);
    });

    const factions = {};
    const recoveries = [];
    byFaction.forEach((members, faction) => {
      const command = commandProfile(members);
      factions[faction] = { ...command, commander: undefined, sourceDeployment: "field" };
      if (command.turnEndSpRecovery <= 0) return;
      members.forEach((unit) => {
        const result = recoverSp(unit, command.turnEndSpRecovery);
        recoveries.push({
          faction,
          unitId: clean(unit.id || unit.unitId || unit.actorId || unit.name),
          rank: command.rank,
          sourceDeployment: "field",
          amount: command.turnEndSpRecovery,
          before: result.before,
          after: result.after,
          recovered: result.recovered,
        });
      });
    });
    return { factions, recoveries };
  }

  function entriesToUnits(entries = []) {
    return (Array.isArray(entries) ? entries : []).map((entry) => entry?.unit || entry).filter(Boolean);
  }

  function commandSpRecoveryProfile(activeUnits = [], backupUnits = []) {
    const field = commandProfile(activeUnits);
    const backup = commandProfile(backupUnits);
    const backupRecovery = backup.turnEndSpRecovery * BACKUP_COMMAND_SP_MULTIPLIER;
    if (field.turnEndSpRecovery >= backupRecovery) {
      return { ...field, sourceDeployment: "field", recoveryMultiplier: 1 };
    }
    return {
      ...backup,
      turnEndSpRecovery: backupRecovery,
      sourceDeployment: "backup",
      recoveryMultiplier: BACKUP_COMMAND_SP_MULTIPLIER,
    };
  }

  function encounterCommandContext(encounter = {}) {
    return {
      allies: commandProfile(entriesToUnits(encounter.allies?.active)),
      enemies: commandProfile(entriesToUnits(encounter.enemies?.active)),
    };
  }

  function applyEncounterTurnEndSpRecovery(encounter = {}) {
    const factions = {};
    const recoveries = [];

    [encounter.allies, encounter.enemies].forEach((team) => {
      const active = entriesToUnits(team?.active).filter(isActiveUnit);
      const backups = entriesToUnits(team?.backups).filter(isActiveUnit);
      if (!active.length) return;
      const command = commandSpRecoveryProfile(active, backups);
      const faction = active.map(factionForUnit).find(Boolean) || factionForUnit(command.commander || {});
      if (!faction) return;
      factions[faction] = { ...command, commander: undefined };
      if (command.turnEndSpRecovery <= 0) return;
      active.forEach((unit) => {
        const result = recoverSp(unit, command.turnEndSpRecovery);
        recoveries.push({
          faction,
          unitId: clean(unit.id || unit.unitId || unit.actorId || unit.name),
          rank: command.rank,
          sourceDeployment: command.sourceDeployment,
          amount: command.turnEndSpRecovery,
          before: result.before,
          after: result.after,
          recovered: result.recovered,
        });
      });
    });

    return { factions, recoveries };
  }

  function slotBaseId(slotOrId) {
    const id = typeof slotOrId === "string" ? slotOrId : clean(slotOrId?.id);
    return id.split("_slot_")[0];
  }

  function hpRatio(unit = {}) {
    const hp = currentHp(unit);
    const max = maxHp(unit);
    if (hp == null || max == null || max <= 0) return 1;
    return Math.max(0, hp / max);
  }

  function threatScore(unit = {}) {
    const speed = finite(unit.resolvedSpeed ?? unit.currentSpeed ?? unit.speedRoll ?? unit.speedValue ?? unit.speed, 0);
    const slots = finite(unit.activeSlots ?? unit.currentActionSlots ?? unit.actionSlots ?? 1, 1);
    return (slots * 10) + speed;
  }

  function orderedTargetIds(targetSlots = [], combatData = {}, command = RANKS.normal) {
    const slots = Array.from(targetSlots || []);
    const ids = [...new Set(slots.map(slotBaseId).filter(Boolean))];
    if (command.commandLevel <= 0) return ids;

    return ids.sort((a, b) => {
      const unitA = combatData[a] || {};
      const unitB = combatData[b] || {};
      const ratioDiff = hpRatio(unitA) - hpRatio(unitB);
      if (Math.abs(ratioDiff) > 0.000001) return ratioDiff;
      if (command.commandLevel >= 2) {
        const threatDiff = threatScore(unitB) - threatScore(unitA);
        if (threatDiff) return threatDiff;
      }
      return String(a).localeCompare(String(b));
    });
  }

  function assignTargetSlots({ attackSlots = [], targetSlots = [], combatData = {}, slotTargets = {}, random = Math.random } = {}) {
    const attackers = Array.from(attackSlots || []).filter((slot) => {
      const unit = combatData[slotBaseId(slot)];
      return !unit?.isImmobilized && isActiveUnit(unit || {});
    });
    const targets = Array.from(targetSlots || []).filter((slot) => isActiveUnit(combatData[slotBaseId(slot)] || {}));
    if (!attackers.length || !targets.length) return { command: commandProfile([]), assignments: [] };

    const attackerUnits = [...new Set(attackers.map((slot) => combatData[slotBaseId(slot)]).filter(Boolean))];
    const command = commandProfile(attackerUnits);
    const assignments = [];

    if (command.commandLevel <= 0) {
      attackers.forEach((slot) => {
        const index = Math.max(0, Math.min(targets.length - 1, Math.floor(finite(random(), 0) * targets.length)));
        const target = targets[index];
        slotTargets[slot.id] = target.id;
        assignments.push({ attackerSlotId: slot.id, targetSlotId: target.id, targetUnitId: slotBaseId(target) });
      });
      return { command: { ...command, commander: undefined }, assignments };
    }

    const orderedIds = orderedTargetIds(targets, combatData, command);
    const focusId = orderedIds[0];
    const focusSlots = targets.filter((slot) => slotBaseId(slot) === focusId);
    const pool = focusSlots.length ? focusSlots : targets;

    attackers.forEach((slot, index) => {
      const target = pool[index % pool.length];
      slotTargets[slot.id] = target.id;
      assignments.push({ attackerSlotId: slot.id, targetSlotId: target.id, targetUnitId: slotBaseId(target) });
    });
    return { command: { ...command, commander: undefined }, assignments };
  }

  function viewerValue(expression) {
    try {
      if (typeof global.eval === "function") return global.eval(expression);
    } catch (_) {}
    return null;
  }

  function viewerCombatData() {
    return global.combatData || viewerValue("typeof combatData !== 'undefined' ? combatData : null") || {};
  }

  function viewerSlotTargets() {
    return global.slotTargets || viewerValue("typeof slotTargets !== 'undefined' ? slotTargets : null") || null;
  }

  function installBattleViewerTargeting() {
    if (!global.document || typeof global.rollEnemyTargets !== "function") return false;
    if (global.rollEnemyTargets.__luminousUnitRankCommandWrapped) return true;
    const legacy = global.rollEnemyTargets;
    const wrapped = function rollEnemyTargetsWithCommand() {
      const combatData = viewerCombatData();
      const slotTargets = viewerSlotTargets();
      if (!slotTargets) return legacy.apply(this, arguments);
      const attackSlots = global.document.querySelectorAll('.action-slot-wrapper[data-faction="enemy"]');
      const targetSlots = global.document.querySelectorAll('.action-slot-wrapper[data-faction="ally"]');
      return assignTargetSlots({ attackSlots, targetSlots, combatData, slotTargets });
    };
    Object.defineProperty(wrapped, "__luminousUnitRankCommandWrapped", { value: true });
    Object.defineProperty(wrapped, "__legacy", { value: legacy });
    global.rollEnemyTargets = wrapped;
    return true;
  }

  function installCombatEngineRoundEnd() {
    const engine = global.CombatEngine;
    if (!engine || typeof engine.triggerPhase !== "function") return false;
    if (engine.triggerPhase.__luminousUnitRankCommandWrapped) return true;
    const original = engine.triggerPhase;
    const wrapped = function triggerPhaseWithCommand(phaseTag, allUnits, ...rest) {
      const result = original.call(this, phaseTag, allUnits, ...rest);
      if (String(phaseTag || "").trim().toLowerCase() === "[round end]") {
        this.lastUnitRankCommandRecovery = applyTurnEndSpRecovery(Array.isArray(allUnits) ? allUnits : []);
      }
      return result;
    };
    Object.defineProperty(wrapped, "__luminousUnitRankCommandWrapped", { value: true });
    engine.triggerPhase = wrapped;
    return true;
  }

  function installBrowserBridges() {
    if (!global.document) return false;
    let attempts = 0;
    const timer = global.setInterval?.(() => {
      attempts += 1;
      const targetReady = installBattleViewerTargeting();
      const engineReady = installCombatEngineRoundEnd();
      if ((targetReady && engineReady) || attempts >= 200) global.clearInterval?.(timer);
    }, 25);
    return Boolean(timer);
  }

  const api = Object.freeze({
    version: "1.1.0",
    BACKUP_COMMAND_SP_MULTIPLIER,
    RANKS,
    normalizeRank,
    rankForUnit,
    profileForRank,
    profileForUnit,
    effectiveLevel,
    factionForUnit,
    isActiveUnit,
    commandProfile,
    commandProfilesByFaction,
    readSp,
    readMaxSp,
    writeSp,
    recoverSp,
    applyTurnEndSpRecovery,
    commandSpRecoveryProfile,
    encounterCommandContext,
    applyEncounterTurnEndSpRecovery,
    slotBaseId,
    hpRatio,
    threatScore,
    orderedTargetIds,
    assignTargetSlots,
    installBattleViewerTargeting,
    installCombatEngineRoundEnd,
    installBrowserBridges,
  });

  global.LuminousUnitRankRuntime = api;
  installBrowserBridges();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
