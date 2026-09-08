(function (global, factory) {
  "use strict";
  const api = factory(global);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) global.LuminousBattleViewerOwnership074 = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const VERSION = "0.7.4";
  const FALLBACK_DM_UID = "e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1";

  const clean = (value) => String(value ?? "").trim();
  const safeKey = (value, fallback = "player") => clean(value).replace(/[.#$\[\]\/]/g, "_") || fallback;

  function canonicalCombatantIdForPlayer(playerId) {
    const id = clean(playerId);
    return id ? `player:${safeKey(id)}` : null;
  }

  function playerRecord(playerId, players = {}) {
    const id = clean(playerId);
    if (!id) return null;
    const player = players?.[id];
    return player && typeof player === "object" ? { id, player } : null;
  }

  function playerUid(player = {}) {
    return clean(player?.uid || player?.vinculado_a || player?.vinculo_jugador) || null;
  }

  function isDmUid(uid, dmMap = {}, configuredDmUid = null) {
    const id = clean(uid);
    if (!id) return false;
    const configured = clean(configuredDmUid);
    return id === FALLBACK_DM_UID || (configured && id === configured) || dmMap?.[id] === true;
  }

  function isPlayerCombatant(unit = {}) {
    const category = clean(unit?.actorCategory || unit?.category || unit?.type).toLowerCase();
    return unit?.isPlayer === true || category === "player" || clean(unit?.canonicalScope).toLowerCase() === "player";
  }

  function canonicalPlayerId(unit = {}) {
    if (!isPlayerCombatant(unit)) return null;
    return clean(unit?.canonicalPlayerKey || unit?.ownerPlayerId || unit?.playerId || unit?.characterLink?.playerId) || null;
  }

  function canonicalOwnerUid(unit = {}) {
    if (!isPlayerCombatant(unit)) return null;
    return clean(unit?.canonicalOwnerUid || unit?.ownerUid || unit?.characterLink?.uid) || null;
  }

  function unitIdentity(unit = {}, fallbackKey = null) {
    return clean(unit?.id || unit?.unitId || unit?.combatId || fallbackKey) || null;
  }

  function actionSlotCount(unit = {}) {
    const raw = unit?.activeSlots ?? unit?.actionSlots ?? unit?.action_slots_count;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  }

  function actionSlotIndex(unit = {}) {
    const explicit = unit?.actionSlotIndex;
    if (explicit && typeof explicit === "object" && !Array.isArray(explicit)) {
      const result = {};
      for (const [key, enabled] of Object.entries(explicit)) {
        if (enabled === true && /^\d+$/.test(clean(key))) result[clean(key)] = true;
      }
      if (Object.keys(result).length) return result;
    }
    const count = actionSlotCount(unit);
    return Object.fromEntries(Array.from({ length: count }, (_, index) => [String(index), true]));
  }

  function isAuthorizedActionSlot(unit = {}, slotIndex) {
    const key = clean(slotIndex);
    if (!/^\d+$/.test(key)) return false;
    const index = actionSlotIndex(unit);
    return index[key] === true;
  }

  function resolveCombatantForPlanOwner(ownerPlayerId, combatants = {}, players = {}, options = {}) {
    const ownerId = clean(ownerPlayerId);
    if (!ownerId) return { ok: false, reason: "OWNER_PLAYER_REQUIRED", unit: null, unitId: null };
    const player = playerRecord(ownerId, players);
    if (!player && options.requirePlayerRecord !== false) return { ok: false, reason: "PLAYER_NOT_FOUND", unit: null, unitId: null };

    const canonicalId = canonicalCombatantIdForPlayer(ownerId);
    const exact = canonicalId ? combatants?.[canonicalId] : null;
    if (exact) {
      if (!isPlayerCombatant(exact)) return { ok: false, reason: "NOT_PLAYER_COMBATANT", unit: null, unitId: null };
      if (canonicalPlayerId(exact) !== ownerId) return { ok: false, reason: "OWNER_PLAYER_MISMATCH", unit: null, unitId: null };
      const expectedUid = player ? playerUid(player.player) : null;
      const unitUid = canonicalOwnerUid(exact);
      if (expectedUid && unitUid && expectedUid !== unitUid) return { ok: false, reason: "OWNER_UID_MISMATCH", unit: null, unitId: null };
      return { ok: true, reason: null, unit: exact, unitId: canonicalId, ownerPlayerId: ownerId, ownerUid: unitUid || expectedUid || null };
    }

    if (options.allowLegacy === false) return { ok: false, reason: "COMBATANT_NOT_FOUND", unit: null, unitId: null };
    const matches = Object.entries(combatants || {}).filter(([, unit]) => isPlayerCombatant(unit) && canonicalPlayerId(unit) === ownerId);
    if (!matches.length) return { ok: false, reason: "COMBATANT_NOT_FOUND", unit: null, unitId: null };
    if (matches.length > 1) return { ok: false, reason: "AMBIGUOUS_COMBATANT", unit: null, unitId: null };
    const [key, unit] = matches[0];
    const expectedUid = player ? playerUid(player.player) : null;
    const unitUid = canonicalOwnerUid(unit);
    if (expectedUid && unitUid && expectedUid !== unitUid) return { ok: false, reason: "OWNER_UID_MISMATCH", unit: null, unitId: null };
    return { ok: true, reason: null, unit, unitId: unitIdentity(unit, key) || key, ownerPlayerId: ownerId, ownerUid: unitUid || expectedUid || null, legacy: true };
  }

  function canControlCombatant({ authUid, ownerPlayerId, unit, players = {}, dmMap = {}, configuredDmUid = null } = {}) {
    const uid = clean(authUid);
    if (isDmUid(uid, dmMap, configuredDmUid)) return { ok: true, reason: null, role: "dm" };
    if (!uid) return { ok: false, reason: "AUTH_REQUIRED", role: "player" };
    const ownerId = clean(ownerPlayerId || canonicalPlayerId(unit));
    const record = playerRecord(ownerId, players);
    if (!record) return { ok: false, reason: "PLAYER_NOT_FOUND", role: "player" };
    const expectedUid = playerUid(record.player);
    if (!expectedUid || expectedUid !== uid) return { ok: false, reason: "AUTH_UID_MISMATCH", role: "player" };
    if (!isPlayerCombatant(unit)) return { ok: false, reason: "NOT_PLAYER_COMBATANT", role: "player" };
    if (canonicalPlayerId(unit) !== ownerId) return { ok: false, reason: "OWNER_PLAYER_MISMATCH", role: "player" };
    const unitUid = canonicalOwnerUid(unit);
    if (!unitUid || unitUid !== uid) return { ok: false, reason: "OWNER_UID_MISMATCH", role: "player" };
    return { ok: true, reason: null, role: "player", ownerPlayerId: ownerId, ownerUid: uid };
  }

  function validatePlanIntegrity({ ownerPlayerId, slotIndex = null, action, combatants = {}, players = {}, allowLegacy = true } = {}) {
    const ownerId = clean(ownerPlayerId);
    if (!action || typeof action !== "object") return { ok: false, reason: "ACTION_REQUIRED" };
    const resolved = resolveCombatantForPlanOwner(ownerId, combatants, players, { allowLegacy });
    if (!resolved.ok) return resolved;
    const plannedUnitId = clean(action.unitId);
    if (!plannedUnitId) return { ok: false, reason: "SOURCE_UNIT_REQUIRED" };
    const acceptedIds = new Set([
      clean(resolved.unitId),
      clean(resolved.unit?.id),
      clean(resolved.unit?.unitId),
      clean(resolved.unit?.combatId),
    ].filter(Boolean));
    if (!acceptedIds.has(plannedUnitId)) return { ok: false, reason: "SOURCE_UNIT_MISMATCH", unit: resolved.unit, unitId: resolved.unitId };
    if (action.scheduledBy != null && clean(action.scheduledBy) !== ownerId) return { ok: false, reason: "SCHEDULED_BY_MISMATCH", unit: resolved.unit, unitId: resolved.unitId };
    const requestedSlot = slotIndex != null ? slotIndex : action.slotIndex;
    if (requestedSlot == null || clean(requestedSlot) === "") return { ok: false, reason: "ACTION_SLOT_REQUIRED", unit: resolved.unit, unitId: resolved.unitId };
    if (!isAuthorizedActionSlot(resolved.unit, requestedSlot)) return { ok: false, reason: "ACTION_SLOT_NOT_OWNED", unit: resolved.unit, unitId: resolved.unitId, slotIndex: requestedSlot };
    return { ok: true, reason: null, unit: resolved.unit, unitId: resolved.unitId, slotIndex: Number(requestedSlot), ownerPlayerId: ownerId, ownerUid: resolved.ownerUid || null };
  }

  function authorizePlanWrite({ authUid, ownerPlayerId, slotIndex = null, action, combatants = {}, players = {}, dmMap = {}, configuredDmUid = null, allowLegacy = true } = {}) {
    const uid = clean(authUid);
    const dm = isDmUid(uid, dmMap, configuredDmUid);
    if (dm) return { ok: true, reason: null, role: "dm" };
    const integrity = validatePlanIntegrity({ ownerPlayerId, slotIndex, action, combatants, players, allowLegacy });
    if (!integrity.ok) return integrity;
    const control = canControlCombatant({ authUid: uid, ownerPlayerId, unit: integrity.unit, players, dmMap, configuredDmUid });
    if (!control.ok) return control;
    if (clean(action?.status) !== "planned") return { ok: false, reason: "PLAYER_STATUS_FORBIDDEN", role: "player" };
    if (clean(action?.schedulerUid) !== uid) return { ok: false, reason: "SCHEDULER_UID_MISMATCH", role: "player" };
    return { ...integrity, ok: true, reason: null, role: "player" };
  }

  return Object.freeze({
    version: VERSION,
    FALLBACK_DM_UID,
    clean,
    safeKey,
    canonicalCombatantIdForPlayer,
    playerRecord,
    playerUid,
    isDmUid,
    isPlayerCombatant,
    canonicalPlayerId,
    canonicalOwnerUid,
    unitIdentity,
    actionSlotCount,
    actionSlotIndex,
    isAuthorizedActionSlot,
    resolveCombatantForPlanOwner,
    canControlCombatant,
    validatePlanIntegrity,
    authorizePlanWrite,
  });
});
