(function (global, factory) {
  "use strict";
  const api = factory(global);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) global.LuminousCombatSkillLoadout074 = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  const VERSION = "0.7.4";
  const ROOTS = Object.freeze({
    skills: "campaña/base_datos_skills",
    units: "campaña/base_datos_unidades",
  });

  const state = {
    db: null,
    skills: {},
    units: {},
    subscriptions: [],
    started: false,
  };

  const clean = (value) => String(value ?? "").trim();
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function skillSchema() {
    if (global?.CombatSkillSchema) return global.CombatSkillSchema;
    if (typeof require === "function") {
      try { return require("./combat-skill-schema.js"); } catch (_) {}
    }
    return null;
  }

  function firstLoadoutSource(source = {}) {
    if (source.action_slots != null) return source.action_slots;
    if (source.skillSlotIds != null) return source.skillSlotIds;
    if (source.skillIds != null) return source.skillIds;
    if (source.skill_ids != null) return source.skill_ids;
    if (source.mechanics?.skills != null) return source.mechanics.skills;
    return [];
  }

  function skillSlotEntries(source = {}) {
    const raw = firstLoadoutSource(source);
    if (Array.isArray(raw)) {
      return raw
        .map((value, index) => ({ index, skillId: clean(value) }))
        .filter((row) => row.skillId);
    }
    if (raw && typeof raw === "object") {
      return Object.entries(raw)
        .map(([key, value]) => ({ index: Number(key), key, skillId: clean(value) }))
        .filter((row) => Number.isInteger(row.index) && row.index >= 0 && row.skillId)
        .sort((a, b) => a.index - b.index)
        .map(({ index, skillId }) => ({ index, skillId }));
    }
    return [];
  }

  function skillSlotIdsFor(source = {}) {
    return skillSlotEntries(source).map((row) => row.skillId);
  }

  function skillIdsFor(source = {}) {
    const ids = skillSlotIdsFor(source);
    if (!ids.length && source.equippedSkillIndex && typeof source.equippedSkillIndex === "object") {
      return Object.entries(source.equippedSkillIndex)
        .filter(([, enabled]) => enabled === true)
        .map(([id]) => clean(id))
        .filter(Boolean);
    }
    return [...new Set(ids)];
  }

  function buildEquippedSkillIndex(sourceOrIds = {}) {
    const ids = Array.isArray(sourceOrIds)
      ? [...new Set(sourceOrIds.map(clean).filter(Boolean))]
      : skillIdsFor(sourceOrIds);
    return Object.fromEntries(ids.map((id) => [id, true]));
  }

  function isPlayerUnit(unit = {}) {
    const category = clean(unit.actorCategory || unit.category || unit.type).toLowerCase();
    return unit.isPlayer === true || category === "player" || clean(unit.canonicalScope).toLowerCase() === "player";
  }

  function playerSignals(actor = {}) {
    return {
      ownerUid: clean(actor.ownerUid || actor.canonicalOwnerUid || actor.uid || actor.raw?.uid),
      playerId: clean(actor.playerId || actor.canonicalPlayerKey || actor.sourceId || actor.raw?.playerId || actor.raw?.id),
      actorId: clean(actor.linkedActorId || actor.actorId || actor.raw?.actorId),
      unitId: clean(actor.unitId || actor.unitRef?.id || actor.raw?.unitId || actor.raw?.unit_id),
    };
  }

  function unitSignals(unit = {}, unitId = "") {
    return {
      unitId: clean(unit.id || unit.unitId || unit.unit_id || unitId),
      ownerUid: clean(unit.ownerUid || unit.canonicalOwnerUid || unit.playerUid || unit.player_uid),
      playerId: clean(unit.playerId || unit.ownerPlayerId || unit.linkedPlayerId || unit.linked_player_id),
      actorId: clean(unit.actorId || unit.linkedActorId || unit.linked_actor_id),
      linkedPlayerUID: clean(unit.linkedPlayerUID || unit.linkedPlayerUid || unit.linked_player_uid),
    };
  }

  function scorePlayerUnit(actor = {}, unit = {}, unitId = "") {
    if (!isPlayerUnit(unit)) return 0;
    const player = playerSignals(actor);
    const candidate = unitSignals(unit, unitId);
    let score = 1;

    if (player.unitId && candidate.unitId === player.unitId) score += 10000;
    if (player.ownerUid && candidate.linkedPlayerUID === player.ownerUid) score += 5000;
    if (player.ownerUid && candidate.ownerUid === player.ownerUid) score += 4500;
    if (player.playerId && candidate.linkedPlayerUID === player.playerId) score += 4000;
    if (player.playerId && candidate.playerId === player.playerId) score += 4000;
    if (player.actorId && candidate.actorId === player.actorId) score += 3000;

    return score > 1 ? score : 0;
  }

  function resolvePlayerUnit(actor = {}, units = state.units) {
    const matches = Object.entries(units || {})
      .map(([unitId, unit]) => ({ unitId, unit: unit || {}, score: scorePlayerUnit(actor, unit || {}, unitId) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || clean(a.unitId).localeCompare(clean(b.unitId)));

    if (!matches.length) return { ok: false, reason: "PLAYER_UNIT_NOT_FOUND", unitId: null, unit: null, matches: [] };
    const topScore = matches[0].score;
    const top = matches.filter((row) => row.score === topScore);
    if (top.length > 1) {
      return {
        ok: false,
        reason: "AMBIGUOUS_PLAYER_UNIT",
        unitId: null,
        unit: null,
        matches: top.map((row) => row.unitId),
      };
    }
    return { ok: true, reason: null, unitId: matches[0].unitId, unit: clone(matches[0].unit), score: matches[0].score, matches: [matches[0].unitId] };
  }

  function rawNumber(raw = {}, keys = []) {
    for (const key of keys) {
      if (raw[key] === undefined || raw[key] === null || raw[key] === "") continue;
      const value = Number(raw[key]);
      if (Number.isFinite(value)) return value;
    }
    return null;
  }

  function validateSkillRecord(skillId, rawSkill) {
    const id = clean(skillId);
    if (!id) return { ok: false, reason: "SKILL_ID_REQUIRED" };
    if (!rawSkill || typeof rawSkill !== "object" || Array.isArray(rawSkill)) return { ok: false, reason: "SKILL_RECORD_INVALID" };
    const name = clean(rawSkill.name || rawSkill.nombre);
    if (!name) return { ok: false, reason: "SKILL_NAME_REQUIRED" };
    const basePower = rawNumber(rawSkill, ["basePower", "base_power"]);
    const coinPower = rawNumber(rawSkill, ["coinPower", "coin_power"]);
    const coinAmount = rawNumber(rawSkill, ["coinAmount", "coin_count", "coinCount"]);
    if (basePower == null) return { ok: false, reason: "SKILL_BASE_POWER_INVALID" };
    if (coinPower == null) return { ok: false, reason: "SKILL_COIN_POWER_INVALID" };
    if (coinAmount == null || !Number.isInteger(coinAmount) || coinAmount < 1) return { ok: false, reason: "SKILL_COIN_AMOUNT_INVALID" };
    return { ok: true, reason: null };
  }

  function normalizeSkillRecord(skillId, rawSkill) {
    const validation = validateSkillRecord(skillId, rawSkill);
    if (!validation.ok) return { ...validation, skillId: clean(skillId), skill: null };
    const schema = skillSchema();
    if (!schema?.normalizeCombatSkill) return { ok: false, reason: "COMBAT_SKILL_SCHEMA_REQUIRED", skillId: clean(skillId), skill: null };
    const definitionId = clean(rawSkill.id || rawSkill.skillId) || clean(skillId);
    const normalized = schema.normalizeCombatSkill(rawSkill);
    const id = clean(skillId);
    const skill = {
      ...normalized,
      id,
      sourceId: clean(normalized.sourceId) || id,
      libraryKey: id,
      definitionId,
      schemaVersion: Number(schema.VERSION) || 2,
    };
    return { ok: true, reason: null, skillId: id, skill };
  }

  function hydrateLoadout(source = {}, skills = state.skills) {
    const entries = skillSlotEntries(source);
    const slots = [];
    const skillsById = {};
    const missingIds = [];
    const invalidIds = [];

    for (const entry of entries) {
      const raw = skills?.[entry.skillId];
      if (!raw) {
        slots.push({ ...entry, status: "missing", skill: null, reason: "SKILL_NOT_FOUND" });
        if (!missingIds.includes(entry.skillId)) missingIds.push(entry.skillId);
        continue;
      }
      const normalized = normalizeSkillRecord(entry.skillId, raw);
      if (!normalized.ok) {
        slots.push({ ...entry, status: "invalid", skill: null, reason: normalized.reason });
        if (!invalidIds.includes(entry.skillId)) invalidIds.push(entry.skillId);
        continue;
      }
      skillsById[entry.skillId] = normalized.skill;
      slots.push({ ...entry, status: "ready", skill: normalized.skill, reason: null });
    }

    const skillIds = [...new Set(entries.map((row) => row.skillId))];
    return {
      slotIds: entries.map((row) => row.skillId),
      skillIds,
      equippedSkillIndex: buildEquippedSkillIndex(skillIds),
      slots,
      skillsById,
      skills: skillIds.map((id) => skillsById[id]).filter(Boolean),
      missingIds,
      invalidIds,
      ready: missingIds.length === 0 && invalidIds.length === 0,
      hasErrors: missingIds.length > 0 || invalidIds.length > 0,
    };
  }

  function ownsSkill(source = {}, skillId) {
    const id = clean(skillId);
    if (!id) return false;
    if (source.equippedSkillIndex && typeof source.equippedSkillIndex === "object") return source.equippedSkillIndex[id] === true;
    return skillIdsFor(source).includes(id);
  }

  function resolveSkillForCombatant(combatant = {}, skillId, skills = state.skills) {
    const id = clean(skillId);
    if (!id) return { ok: false, reason: "SKILL_ID_REQUIRED", skillId: id, skill: null };
    if (!ownsSkill(combatant, id)) return { ok: false, reason: "SKILL_NOT_EQUIPPED", skillId: id, skill: null };
    const raw = skills?.[id];
    if (!raw) return { ok: false, reason: "SKILL_NOT_FOUND", skillId: id, skill: null };
    return normalizeSkillRecord(id, raw);
  }

  function applySkills(value) { state.skills = value && typeof value === "object" ? value : {}; return state.skills; }
  function applyUnits(value) { state.units = value && typeof value === "object" ? value : {}; return state.units; }
  function skillLibrary() { return state.skills; }
  function unitLibrary() { return state.units; }

  function subscribe(path, assign) {
    if (!state.db?.ref) return;
    const ref = state.db.ref(path);
    const handler = (snapshot) => assign(snapshot.val() || {});
    ref.on("value", handler);
    state.subscriptions.push(() => ref.off("value", handler));
  }

  function init(options = {}) {
    if (state.started) return true;
    state.db = options.db || state.db || (global.firebase?.database ? global.firebase.database() : null);
    if (!state.db && global.document) return false;
    state.started = true;
    if (state.db) {
      subscribe(ROOTS.skills, applySkills);
      subscribe(ROOTS.units, applyUnits);
    }
    return true;
  }

  function stop() {
    state.subscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
    state.started = false;
  }

  return Object.freeze({
    version: VERSION,
    ROOTS,
    skillSlotEntries,
    skillSlotIdsFor,
    skillIdsFor,
    buildEquippedSkillIndex,
    isPlayerUnit,
    playerSignals,
    unitSignals,
    scorePlayerUnit,
    resolvePlayerUnit,
    validateSkillRecord,
    normalizeSkillRecord,
    hydrateLoadout,
    ownsSkill,
    resolveSkillForCombatant,
    applySkills,
    applyUnits,
    skillLibrary,
    unitLibrary,
    init,
    stop,
  });
});
