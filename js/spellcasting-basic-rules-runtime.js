(function (global) {
  "use strict";

  if (global.LuminousSpellcastingRuntime?.__basicRulesV1) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousSpellcastingRuntime;
    return;
  }

  const base = global.LuminousSpellcastingRuntime || (typeof require === "function" ? require("./spellcasting-runtime.js") : null);
  if (!base) return;

  const SCHEMA_VERSION = 1;
  const STATE_KEY = "spellcastingState";
  const OVERCAST_SP_PER_SLOT_LEVEL = 15;
  const VALID_TARGET_TYPES = Object.freeze(["self", "single", "multi", "area", "allies", "enemies", "special"]);
  const ABILITY_ALIASES = Object.freeze({
    str: ["str", "strength", "fuerza"], dex: ["dex", "dexterity", "destreza"],
    con: ["con", "constitution", "constitucion"], int: ["int", "intelligence", "inteligencia"],
    wis: ["wis", "wisdom", "sabiduria"], cha: ["cha", "charisma", "carisma"],
  });
  const ABILITY_VARIABLES = base.ABILITY_VARIABLES || Object.freeze({
    str: "StrengthMod", dex: "DexterityMod", con: "ConstitutionMod",
    int: "IntelligenceMod", wis: "WisdomMod", cha: "CharismaMod",
  });

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const intOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  let restListenerBound = false;

  function normalizeAbility(value) {
    const raw = normalizeId(value);
    for (const [abilityId, aliases] of Object.entries(ABILITY_ALIASES)) {
      if (aliases.includes(raw)) return abilityId;
    }
    return null;
  }

  function classEntries(character = {}) {
    const build = character?.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    return (Array.isArray(character.classes) ? character.classes : (Array.isArray(build.classes) ? build.classes : []))
      .filter((entry) => entry && typeof entry === "object");
  }

  function classEntry(character, classId) {
    const id = normalizeId(classId);
    return classEntries(character).find((entry) => normalizeId(entry.classId || entry.id) === id) || null;
  }

  function classSpellcastingAbility(character = {}, classId) {
    const entry = classEntry(character, classId);
    return normalizeAbility(
      entry?.spellcastingAbility ?? entry?.spellcasting_ability ?? entry?.spellcasting?.abilityId
      ?? entry?.spellcasting?.ability ?? entry?.spellcasting?.stat,
    ) || base.getClassSpellcastingAbility(classId);
  }

  function statModifier(character = {}, abilityId) {
    const ability = normalizeAbility(abilityId);
    if (!ability) return 0;
    const stats = character.stats || character.dndStats || {};
    const score = ABILITY_ALIASES[ability].map((alias) => stats?.[alias] ?? character?.[alias])
      .find((value) => Number.isFinite(Number(value)));
    return Math.floor((numberOr(score, 10) - 10) / 2);
  }

  function resolveSpellcasting(character = {}, classId, runtime = {}, variables = {}) {
    const normalizedClassId = normalizeId(classId);
    const abilityId = classSpellcastingAbility(character, normalizedClassId);
    if (!abilityId) return null;
    const variableName = ABILITY_VARIABLES[abilityId];
    const spellMod = Number.isFinite(Number(variables?.[variableName]))
      ? Number(variables[variableName])
      : (Number.isFinite(Number(runtime?.[variableName])) ? Number(runtime[variableName]) : statModifier(character, abilityId));
    const baseResolved = base.resolveSpellcasting(character, normalizedClassId, runtime, variables);
    const proficiency = numberOr(variables?.Proficiency ?? runtime?.Proficiency ?? character.proficiency ?? baseResolved?.proficiency, 0);
    return { classId: normalizedClassId, abilityId, spellMod, proficiency, spellDC: 8 + spellMod + proficiency };
  }

  function resolveForTrait(character = {}, trait = {}, runtime = {}, variables = {}) {
    return resolveSpellcasting(character, base.classIdForTrait(trait, runtime), runtime, variables);
  }

  function normalizeSlotTable(source = {}) {
    const table = {};
    Object.entries(source && typeof source === "object" ? source : {}).forEach(([rawLevel, rawValue]) => {
      const parsed = intOr(String(rawLevel).replace(/[^0-9-]/g, ""), 0);
      if (parsed <= 0) return;
      const maximum = Math.max(0, intOr(rawValue?.maximum ?? rawValue?.max ?? rawValue?.total ?? rawValue, 0));
      if (maximum > 0) table[parsed] = maximum;
    });
    return table;
  }

  function slotTableForClass(character = {}, classId, explicit = null) {
    if (explicit && typeof explicit === "object") return normalizeSlotTable(explicit);
    const id = normalizeId(classId), entry = classEntry(character, id);
    const candidates = [entry?.spellSlots, entry?.spell_slots, entry?.spellcasting?.slots,
      character?.spellSlotsByClass?.[id], character?.spellSlots?.[id], character?.characterBuild?.spellSlotsByClass?.[id]];
    return normalizeSlotTable(candidates.find((value) => value && typeof value === "object" && Object.keys(value).length) || {});
  }

  function ensureSpellcastingState(character) {
    if (!character || typeof character !== "object") throw new Error("Spellcasting Runtime requires a character object.");
    if (!character[STATE_KEY] || typeof character[STATE_KEY] !== "object" || Array.isArray(character[STATE_KEY])) character[STATE_KEY] = {};
    const state = character[STATE_KEY];
    state.schemaVersion = SCHEMA_VERSION;
    if (!state.slotsByClass || typeof state.slotsByClass !== "object" || Array.isArray(state.slotsByClass)) state.slotsByClass = {};
    if (!state.concentration || typeof state.concentration !== "object" || Array.isArray(state.concentration)) state.concentration = {};
    if (!state.concentrationChecks || typeof state.concentrationChecks !== "object" || Array.isArray(state.concentrationChecks)) state.concentrationChecks = {};
    return state;
  }

  function reconcileSlotPool(character, classId, explicitTable = null) {
    const state = ensureSpellcastingState(character), id = normalizeId(classId), maxima = slotTableForClass(character, id, explicitTable);
    if (!id) throw new Error("Spell Slot pool requires classId.");
    if (!state.slotsByClass[id]?.levels) state.slotsByClass[id] = { levels: {} };
    const levels = state.slotsByClass[id].levels;
    Object.entries(maxima).forEach(([level, maximum]) => {
      const current = levels[level] || { spent: 0 };
      levels[level] = { maximum, spent: Math.max(0, Math.min(maximum, intOr(current.spent, 0))) };
    });
    Object.keys(levels).forEach((level) => { if (!Object.prototype.hasOwnProperty.call(maxima, level)) delete levels[level]; });
    return state.slotsByClass[id];
  }

  function spellSlotPool(character, classId, explicitTable = null) {
    const id = normalizeId(classId), pool = reconcileSlotPool(character, id, explicitTable), levels = {};
    Object.entries(pool.levels).forEach(([level, entry]) => {
      const maximum = Math.max(0, intOr(entry.maximum, 0)), spent = Math.max(0, Math.min(maximum, intOr(entry.spent, 0)));
      levels[level] = { level: Number(level), maximum, spent, available: maximum - spent };
    });
    return { classId: id, levels };
  }

  function canSpendSpellSlot(character, classId, slotLevel, explicitTable = null) {
    const level = Math.max(0, intOr(slotLevel, 0));
    if (level === 0) return { available: true, cantrip: true, classId: normalizeId(classId), slotLevel: 0 };
    const pool = spellSlotPool(character, classId, explicitTable), levelPool = pool.levels[level] || { maximum: 0, spent: 0, available: 0 };
    return { available: levelPool.available > 0, cantrip: false, classId: pool.classId, slotLevel: level, levelPool, pool,
      reason: levelPool.available > 0 ? null : `No Level ${level} Spell Slots available for ${pool.classId}.` };
  }

  function spendSpellSlot(character, classId, slotLevel, explicitTable = null) {
    const check = canSpendSpellSlot(character, classId, slotLevel, explicitTable);
    if (!check.available || check.cantrip) return { ...check, spent: 0 };
    ensureSpellcastingState(character).slotsByClass[check.classId].levels[String(check.slotLevel)].spent += 1;
    return { ...check, spent: 1, pool: spellSlotPool(character, classId, explicitTable), reason: null };
  }

  function syncSpellSlotPools(character) {
    return classEntries(character).map((entry) => {
      const classId = normalizeId(entry.classId || entry.id), table = slotTableForClass(character, classId);
      return classId && Object.keys(table).length ? spellSlotPool(character, classId, table) : null;
    }).filter(Boolean);
  }

  function restoreSpellSlots(character, classId = null) {
    syncSpellSlotPools(character);
    const state = ensureSpellcastingState(character), ids = classId ? [normalizeId(classId)] : Object.keys(state.slotsByClass), changes = [];
    ids.forEach((id) => {
      if (!state.slotsByClass[id]?.levels) return;
      Object.values(state.slotsByClass[id].levels).forEach((entry) => { entry.spent = 0; });
      changes.push(spellSlotPool(character, id));
    });
    return changes;
  }

  function readCurrentSp(entity = {}) {
    const combat = entity?.combatStats || {};
    const found = [entity.sp, entity.currentSp, entity.currentSP, entity.sp_actual, combat.sp_actual, combat.currentSp]
      .find((value) => Number.isFinite(Number(value)));
    return found == null ? null : Number(found);
  }

  function writeCurrentSp(entity, value) {
    if (!entity || typeof entity !== "object") return null;
    const next = Number(value); let wrote = false;
    for (const key of ["sp", "currentSp", "currentSP", "sp_actual"]) if (Object.prototype.hasOwnProperty.call(entity, key)) { entity[key] = next; wrote = true; }
    if (entity.combatStats && typeof entity.combatStats === "object") {
      for (const key of ["sp_actual", "currentSp"]) if (Object.prototype.hasOwnProperty.call(entity.combatStats, key)) { entity.combatStats[key] = next; wrote = true; }
    }
    if (!wrote) entity.currentSp = next;
    return next;
  }

  function fixedDamageRuntime() {
    if (global.LuminousFixedDamageRuntime) return global.LuminousFixedDamageRuntime;
    if (typeof require === "function") { try { return require("./fixed-damage-runtime.js"); } catch (_) {} }
    return null;
  }

  function applyOvercast(character, slotLevel, options = {}) {
    const level = Math.max(1, intOr(slotLevel, 1)), cost = Math.max(0, intOr(options.spCost, level * OVERCAST_SP_PER_SLOT_LEVEL));
    const current = readCurrentSp(character);
    if (current == null) return { success: false, reason: "Overcast requires a readable SP resource.", slotLevel: level, spCost: cost };
    const spSpent = Math.min(Math.max(0, current), cost), overflow = Math.max(0, cost - spSpent);
    writeCurrentSp(character, current - spSpent);
    const fixed = options.fixedDamageRuntime || fixedDamageRuntime();
    const fixedDamage = overflow > 0 && fixed?.applyFixedDamage
      ? fixed.applyFixedDamage(options.damageTarget || character, overflow, { engine: options.engine, damageKind: "directo", skillUsed: options.skillUsed || options.spell || null })
      : (overflow > 0 ? { applied: false, amount: overflow, reason: "Fixed Damage Runtime unavailable." } : null);
    return { success: true, slotLevel: level, spCost: cost, spBefore: current, spSpent, spAfter: readCurrentSp(character), overflowFixedDamage: overflow, fixedDamage };
  }

  function normalizeTargetType(value) {
    const id = normalizeId(value || "single");
    return VALID_TARGET_TYPES.includes(id) ? id : "special";
  }

  function normalizeSave(spell = {}) {
    const raw = spell.save || spell.savingThrow || spell.saving_throw || {};
    const abilityId = normalizeAbility(raw.abilityId || raw.ability || raw.stat || spell.saveAbility || spell.save_ability);
    if (!abilityId) return null;
    const onSuccess = normalizeId(raw.onSuccess || raw.on_success || spell.saveOnSuccess || "negates");
    return { abilityId, onSuccess: ["negates", "half", "reduced", "special"].includes(onSuccess) ? onSuccess : "special" };
  }

  function resolveSpellSave(character, classId, spell = {}, runtime = {}, variables = {}) {
    const save = normalizeSave(spell), casting = resolveSpellcasting(character, classId, runtime, variables);
    return save && casting ? { ...save, dc: casting.spellDC, classId: casting.classId, spellMod: casting.spellMod } : null;
  }

  function normalizeUpcast(spell = {}) {
    const raw = spell.upcast || spell.upcastScaling || spell.upcast_scaling || {};
    return { finalPower: numberOr(raw.finalPower ?? raw.final_power, 0), coinPower: numberOr(raw.coinPower ?? raw.coin_power, 0),
      atkWeight: numberOr(raw.atkWeight ?? raw.atk_weight, 0), duration: numberOr(raw.duration ?? raw.durationRounds ?? raw.duration_rounds, 0) };
  }

  function resolveUpcast(spell = {}, slotLevel = null) {
    const baseSlotLevel = Math.max(0, intOr(spell.slotLevel ?? spell.level ?? spell.spellLevel, 0));
    const usedSlotLevel = slotLevel == null ? baseSlotLevel : Math.max(baseSlotLevel, intOr(slotLevel, baseSlotLevel));
    const extraLevels = Math.max(0, usedSlotLevel - baseSlotLevel), perLevel = normalizeUpcast(spell);
    return { baseSlotLevel, slotLevel: usedSlotLevel, extraLevels, finalPower: perLevel.finalPower * extraLevels,
      coinPower: perLevel.coinPower * extraLevels, atkWeight: perLevel.atkWeight * extraLevels, duration: perLevel.duration * extraLevels, perLevel };
  }

  function normalizeCastingTimeSeconds(spell = {}) {
    const seconds = spell.castingTimeSeconds ?? spell.casting_time_seconds;
    if (Number.isFinite(Number(seconds)) && Number(seconds) >= 0) return Math.ceil(Number(seconds));
    const rounds = spell.castingTimeRounds ?? spell.casting_time_rounds;
    if (Number.isFinite(Number(rounds)) && Number(rounds) > 0) return Math.ceil(Number(rounds) * 6);
    const raw = normalizeId(spell.castingTime || spell.casting_time || spell.actionCost || "action");
    if (["none", "instant", "free"].includes(raw)) return 0;
    if (["quick_action", "bonus_action", "quick"].includes(raw)) return 3;
    return 6;
  }

  function buildCastingActionMessage(spell = {}, actorId, options = {}) {
    const seconds = normalizeCastingTimeSeconds(spell);
    if (seconds <= 0) return null;
    return { tipo_dialogo: "actuar", actorId: String(actorId || options.actorId || ""), mensaje: options.message || `Cast ${spell.name || spell.id || "Spell"}`,
      actionDurationSeconds: seconds, actionBucket: seconds <= 2 ? "instant" : (seconds <= 3 ? "normal" : (seconds <= 6 ? "complete" : "prolonged")),
      spellId: normalizeId(spell.id || spell.name), source: "spellcasting" };
  }

  function startConcentration(character, spell = {}, options = {}) {
    const state = ensureSpellcastingState(character), requires = spell.concentration === true || spell.requiresConcentration === true || spell.requires_concentration === true;
    if (!requires) return { started: false, concentration: clone(state.concentration.active || null) };
    state.concentration.active = { spellId: normalizeId(spell.id || spell.name), spellName: String(spell.name || spell.id || "Spell"),
      startedAt: options.startedAt ?? Date.now(), sourceClassId: normalizeId(options.classId || spell.classId || spell.sourceClassId) };
    return { started: true, concentration: clone(state.concentration.active) };
  }

  function endConcentration(character, reason = "ended") {
    const state = ensureSpellcastingState(character), previous = clone(state.concentration.active || null);
    delete state.concentration.active;
    return { ended: Boolean(previous), previous, reason: normalizeId(reason) || "ended" };
  }

  function concentrationCheckForSkill(character, input = {}) {
    const state = ensureSpellcastingState(character);
    if (!state.concentration.active) return { required: false, reason: "not_concentrating" };
    const eventId = String(input.skillEventId || input.eventId || input.skillId || "").trim();
    if (eventId && state.concentrationChecks[eventId]) return { ...clone(state.concentrationChecks[eventId]), required: false, duplicate: true };
    const values = Array.isArray(input.finalPowers) ? input.finalPowers
      : (Array.isArray(input.hits) ? input.hits.map((hit) => hit?.finalPower ?? hit?.final_power) : [input.finalPower ?? input.final_power]);
    const highestFinalPower = values.reduce((max, value) => Math.max(max, numberOr(value, 0)), 0);
    if (highestFinalPower <= 0) return { required: false, reason: "no_damaging_final_power" };
    const check = { required: true, duplicate: false, skillEventId: eventId || null, abilityId: "con", dc: highestFinalPower,
      highestFinalPower, concentration: clone(state.concentration.active) };
    if (eventId) state.concentrationChecks[eventId] = clone(check);
    const keys = Object.keys(state.concentrationChecks); if (keys.length > 100) keys.slice(0, keys.length - 100).forEach((key) => delete state.concentrationChecks[key]);
    return check;
  }

  function resolveConcentrationCheck(character, check = {}, total) {
    const success = numberOr(total, 0) >= numberOr(check.dc, 0);
    if (!success) endConcentration(character, "failed_concentration_check");
    return { success, total: numberOr(total, 0), dc: numberOr(check.dc, 0), concentrationEnded: !success };
  }

  function normalizeSpell(spell = {}, options = {}) {
    const slotLevel = Math.max(0, intOr(spell.slotLevel ?? spell.level ?? spell.spellLevel, 0));
    return { ...spell, id: normalizeId(spell.id || spell.name), slotLevel, cantrip: slotLevel === 0 || spell.cantrip === true,
      sourceClassId: normalizeId(spell.sourceClassId || spell.classId || options.classId), targetType: normalizeTargetType(spell.targetType || spell.target_type),
      save: normalizeSave(spell), concentration: spell.concentration === true || spell.requiresConcentration === true || spell.requires_concentration === true,
      castingTimeSeconds: normalizeCastingTimeSeconds(spell), upcast: normalizeUpcast(spell) };
  }

  function castSpell(character, spellInput = {}, options = {}) {
    const spell = normalizeSpell(spellInput, options), classId = normalizeId(options.classId || spell.sourceClassId);
    if (!classId) return { success: false, reason: "Spell has no source Class.", spell };
    const requestedSlotLevel = spell.cantrip ? 0 : Math.max(spell.slotLevel, intOr(options.slotLevel, spell.slotLevel));
    let resource = { type: "cantrip", spent: 0 };
    if (!spell.cantrip) {
      const slot = spendSpellSlot(character, classId, requestedSlotLevel, options.slotTable);
      if (slot.available) resource = { type: "slot", spent: slot.spent, slotLevel: requestedSlotLevel, pool: slot.pool };
      else if (options.overcast === true) {
        const overcast = applyOvercast(character, requestedSlotLevel, { ...options, spell });
        if (!overcast.success) return { success: false, reason: overcast.reason, spell, slot, overcast };
        resource = { type: "overcast", slotLevel: requestedSlotLevel, overcast };
      } else return { success: false, reason: slot.reason, spell, slot };
    }
    const casting = resolveSpellcasting(character, classId, options.runtime || {}, options.variables || {});
    return { success: true, spell, classId, casting, save: resolveSpellSave(character, classId, spell, options.runtime || {}, options.variables || {}),
      resource, upcast: resolveUpcast(spell, requestedSlotLevel), concentration: startConcentration(character, spell, { classId, startedAt: options.startedAt }),
      castingAction: buildCastingActionMessage(spell, options.actorId || character.actorId || character.id, options) };
  }

  function persistSpellcastingState(character) {
    const db = global.firebase?.database?.(), playerId = String(global.localStorage?.getItem?.("playerId") || character?.playerId || character?.player_id || "").trim();
    if (!db || !playerId || !character) return null;
    const promise = db.ref(`campaña/jugadores/${playerId}`).update({ spellcastingState: clone(character[STATE_KEY] || {}) });
    promise?.catch?.((error) => console.warn("Spellcasting state persistence:", error));
    return promise;
  }

  function handleRestCompleted(event) {
    const detail = event?.detail || {};
    if (normalizeId(detail.type) !== "long_rest") return null;
    const character = detail.character || global.LuminousPlayerTraitRuntime?.getCharacter?.() || global.datosJugador || null;
    if (!character) return null;
    const restored = restoreSpellSlots(character); persistSpellcastingState(character); return restored;
  }

  function bindRestIntegration() {
    if (restListenerBound || !global.addEventListener) return false;
    global.addEventListener("luminous:rest-completed", handleRestCompleted); restListenerBound = true; return true;
  }

  function wrapTraitEngine() {
    const source = global.LuminousTraitEngine;
    if (!source?.buildVariables || source.__spellcastingBasicRulesWrapped) return Boolean(source?.__spellcastingBasicRulesWrapped);
    const original = source.buildVariables.bind(source);
    global.LuminousTraitEngine = Object.freeze({ ...source, __spellcastingBasicRulesWrapped: true,
      buildVariables(character = {}, runtime = {}, trait = {}) {
        const variables = original(character, runtime, trait), resolved = resolveForTrait(character, trait, runtime, variables);
        return resolved ? { ...variables, SpellMod: resolved.spellMod, SpellDC: resolved.spellDC } : variables;
      } });
    return true;
  }

  function install() { bindRestIntegration(); return wrapTraitEngine(); }

  const api = Object.freeze({ ...base, __basicRulesV1: true, SCHEMA_VERSION, STATE_KEY, OVERCAST_SP_PER_SLOT_LEVEL, VALID_TARGET_TYPES,
    normalizeAbility, classSpellcastingAbility, resolveSpellcasting, resolveForTrait, normalizeSlotTable, slotTableForClass, ensureSpellcastingState,
    reconcileSlotPool, spellSlotPool, canSpendSpellSlot, spendSpellSlot, syncSpellSlotPools, restoreSpellSlots, readCurrentSp, writeCurrentSp,
    applyOvercast, normalizeTargetType, normalizeSave, resolveSpellSave, normalizeUpcast, resolveUpcast, normalizeCastingTimeSeconds,
    buildCastingActionMessage, startConcentration, endConcentration, concentrationCheckForSkill, resolveConcentrationCheck, normalizeSpell, castSpell,
    persistSpellcastingState, handleRestCompleted, bindRestIntegration, wrapTraitEngine, install });

  global.LuminousSpellcastingRuntime = api;
  install();
  if (global.document && global.setInterval) { const timer = global.setInterval(install, 800); timer?.unref?.(); }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
