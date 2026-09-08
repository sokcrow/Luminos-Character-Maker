(function (global) {
  "use strict";

  if (global.LuminousOroshLineageCompleteRuntime) return;

  const ARCHETYPE_ID = "orosh_lineage";
  const CLASS_ID = "sorcerer";
  const PLAYER_ROOT = "campaña/jugadores";
  const PATCH_INTERVAL_MS = 250;
  const DETECT_EMOTIONS_ID = "detect_emotions";
  const TRAITS = Object.freeze({
    TERMOSENSE: "orosh_lineage_termosense",
    EMOTIONAL_ECHO: "orosh_lineage_emotional_echo",
    FRAGMENTED_BLESSING: "orosh_lineage_fragmented_blessing",
    PRIMORDIAL_BOND: "orosh_lineage_primordial_bond",
    VOICE_OF_THE_FIRST: "orosh_lineage_voice_of_the_first",
    ASCENSION: "orosh_lineage_ascension_of_the_heiress",
  });
  const VISUAL_OBSCUREMENT = Object.freeze(new Set([
    "normal_darkness",
    "magical_darkness",
    "visual_camouflage",
    "invisible",
  ]));
  const VOICE_SINS = Object.freeze(["wrath", "envy", "gloom", "pride", "gluttony", "lust", "sloth"]);

  const local = {
    traitSource: null,
    combatSource: null,
    conditionSource: null,
    statusSource: null,
    spellcastingSource: null,
    sorcererSource: null,
    listenersBound: false,
    hydratedRecords: typeof WeakSet === "function" ? new WeakSet() : null,
    spellAffectedByKey: new Map(),
    spellAffectedByObject: typeof WeakMap === "function" ? new WeakMap() : null,
    activeSkillContexts: [],
    spGuardDepth: 0,
    spGuardSnapshots: null,
  };

  function base() {
    return global.LuminousOroshLineageRuntime || null;
  }

  function normalizeId(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function numberOr(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function intOr(value, fallback = 0) {
    return Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function emit(name, detail) {
    try {
      if (typeof global.CustomEvent === "function" && typeof global.dispatchEvent === "function") {
        global.dispatchEvent(new global.CustomEvent(name, { detail }));
      }
    } catch (_) {}
    return detail;
  }

  function currentCharacter() {
    return base()?.currentCharacter?.() || global.LuminousPlayerTraitRuntime?.getCharacter?.() || global.datosJugador || null;
  }

  function characterFor(entity = null) {
    return base()?.characterFor?.(entity) || entity || currentCharacter() || {};
  }

  function isSelected(character = currentCharacter() || {}) {
    return Boolean(base()?.isSelected?.(characterFor(character)));
  }

  function levelOf(character = currentCharacter() || {}) {
    return Math.max(0, numberOr(base()?.getLevel?.(characterFor(character)), 0));
  }

  function identityValues(entity = {}) {
    return [
      entity.id, entity.playerId, entity.player_id, entity.characterId, entity.character_id,
      entity.combatId, entity.combat_id, entity.unitId, entity.unit_id, entity.actorId, entity.actor_id,
      entity.uid, entity.vinculo_jugador,
    ].filter((value) => value != null && String(value).trim() !== "").map((value) => String(value).trim());
  }

  function entityName(entity = {}) {
    return normalizeId(entity.characterName || entity.character_name || entity.nombre || entity.name || "");
  }

  function entityKey(entity = {}) {
    const resolved = characterFor(entity);
    return identityValues(resolved)[0] || entityName(resolved) || null;
  }

  function sameEntity(a, b) {
    return Boolean(base()?.sameEntity?.(a, b)) || a === b;
  }

  function stateFor(character = currentCharacter() || {}) {
    const resolved = characterFor(character);
    const record = base()?.getState?.(resolved);
    if (!record) return null;

    if (local.hydratedRecords && !local.hydratedRecords.has(record)) {
      const persisted = resolved?.archetypeResources?.[ARCHETYPE_ID]
        || currentCharacter()?.archetypeResources?.[ARCHETYPE_ID]
        || null;
      if (persisted && typeof persisted === "object") {
        if (persisted.selectedFragment != null) record.selectedFragment = normalizeId(persisted.selectedFragment) || null;
        if (typeof persisted.fragmentSelectionAvailable === "boolean") record.fragmentSelectionAvailable = persisted.fragmentSelectionAvailable;
        if (typeof persisted.fragmentCheckBonusUsed === "boolean") record.fragmentCheckBonusUsed = persisted.fragmentCheckBonusUsed;
        if (typeof persisted.detectEmotionsUsed === "boolean") record.detectEmotionsUsed = persisted.detectEmotionsUsed;
        if (typeof persisted.primordialBondUsedThisTurn === "boolean") record.primordialBondUsedThisTurn = persisted.primordialBondUsedThisTurn;
        if (persisted.emotionalEchoes && typeof persisted.emotionalEchoes === "object") {
          VOICE_SINS.forEach((sin) => { record.emotionalEchoes[sin] = Math.min(1, Math.max(0, intOr(persisted.emotionalEchoes[sin], 0))); });
        }
        if (persisted.ascension && typeof persisted.ascension === "object") {
          record.ascension.available = persisted.ascension.available !== false;
          record.ascension.active = persisted.ascension.active === true;
          record.ascension.roundsRemaining = Math.max(0, intOr(persisted.ascension.roundsRemaining, 0));
          record.ascension.slotRecoveryUsedThisTurn = persisted.ascension.slotRecoveryUsedThisTurn === true;
        }
      }
      local.hydratedRecords.add(record);
    }
    return record;
  }

  function serializableState(record = {}) {
    return {
      selectedFragment: record.selectedFragment || null,
      fragmentSelectionAvailable: record.fragmentSelectionAvailable !== false,
      fragmentCheckBonusUsed: record.fragmentCheckBonusUsed === true,
      detectEmotionsUsed: record.detectEmotionsUsed === true,
      primordialBondUsedThisTurn: record.primordialBondUsedThisTurn === true,
      emotionalEchoes: Object.fromEntries(VOICE_SINS.map((sin) => [sin, Math.min(1, Math.max(0, intOr(record.emotionalEchoes?.[sin], 0)))])),
      ascension: {
        available: record.ascension?.available !== false,
        active: record.ascension?.active === true,
        roundsRemaining: Math.max(0, intOr(record.ascension?.roundsRemaining, 0)),
        slotRecoveryUsedThisTurn: record.ascension?.slotRecoveryUsedThisTurn === true,
      },
    };
  }

  function persistState(character = currentCharacter() || {}) {
    const resolved = characterFor(character);
    const canonical = currentCharacter() && sameEntity(currentCharacter(), resolved) ? currentCharacter() : resolved;
    const record = stateFor(resolved);
    if (!record || !canonical || typeof canonical !== "object") return null;
    const payload = serializableState(record);
    if (!canonical.archetypeResources || typeof canonical.archetypeResources !== "object") canonical.archetypeResources = {};
    canonical.archetypeResources[ARCHETYPE_ID] = clone(payload);

    const db = global.firebase?.database?.();
    const playerId = String(global.localStorage?.getItem?.("playerId") || canonical.playerId || canonical.player_id || "").trim();
    if (db && playerId) {
      const promise = db.ref(`${PLAYER_ROOT}/${playerId}/archetypeResources/${ARCHETYPE_ID}`).set(clone(payload));
      promise?.catch?.((error) => console.warn("Orosh state persistence:", error));
      return promise;
    }
    return payload;
  }

  function spellId(spell = {}) {
    return normalizeId(spell.id || spell.spellId || spell.spell_id || spell.name || "");
  }

  function canonicalSin(value) {
    const id = normalizeId(value);
    const aliases = {
      ira: "wrath", envidia: "envy", melancolia: "gloom", orgullo: "pride",
      gula: "gluttony", lujuria: "lust", pereza: "sloth",
    };
    return aliases[id] || id;
  }

  function skillSin(skill = {}) {
    return canonicalSin(skill.sinAffinity ?? skill.affinity ?? skill.sin ?? skill.pecado ?? "");
  }

  function isSpell(skill = {}, runtime = {}) {
    return Boolean(base()?.mindOrEmotionSpell && (
      normalizeId(skill.type || skill.skillType || runtime.actionType || runtime.sourceType) === "spell"
      || normalizeId(skill.sourceType || skill.source_type) === "spell"
      || runtime.spell
      || skill.spellId
      || skill.spell_id
    ));
  }

  function mindEmotionIllusionPsychicSpell(spell = {}, runtime = {}) {
    if (!isSpell(spell, runtime)) return false;
    if (spell.affectsMind === true || spell.affectsEmotion === true || spell.affectsEmotions === true) return true;
    const school = normalizeId(spell.school || spell.spellSchool || spell.spell_school || "");
    if (school === "illusion") return true;
    const tags = [
      ...(Array.isArray(spell.tags) ? spell.tags : []),
      ...(Array.isArray(spell.spellTags) ? spell.spellTags : []),
      ...(Array.isArray(spell.descriptors) ? spell.descriptors : []),
      ...(Array.isArray(runtime.tags) ? runtime.tags : []),
    ].map(normalizeId);
    return tags.some((tag) => [
      "mind", "mental", "emotion", "emotions", "illusion", "psychic",
      "mente", "emocion", "emociones", "ilusion", "psiquico", "psiquica",
    ].includes(tag));
  }

  function readSp(unit = {}) {
    const runtime = global.LuminousSpellcastingRuntime;
    if (runtime?.readCurrentSp) return numberOr(runtime.readCurrentSp(unit), 0);
    return numberOr(unit.sp ?? unit.currentSp ?? unit.sp_actual ?? unit.combatStats?.sp_actual, 0);
  }

  function rawWriteSp(unit = {}, value) {
    const next = Math.max(-45, Math.min(45, numberOr(value, 0)));
    if (Object.prototype.hasOwnProperty.call(unit, "sp")) unit.sp = next;
    else if (Object.prototype.hasOwnProperty.call(unit, "currentSp")) unit.currentSp = next;
    else if (Object.prototype.hasOwnProperty.call(unit, "sp_actual")) unit.sp_actual = next;
    else if (unit.combatStats && Object.prototype.hasOwnProperty.call(unit.combatStats, "sp_actual")) unit.combatStats.sp_actual = next;
    else unit.sp = next;
    return next;
  }

  function ascended(character = currentCharacter() || {}) {
    const record = stateFor(characterFor(character));
    return Boolean(isSelected(character) && levelOf(character) >= 85 && record?.ascension?.active && record.ascension.roundsRemaining > 0);
  }

  function mitigatedSpValue(unit, requested) {
    const before = readSp(unit);
    let next = numberOr(requested, before);
    if (next < before && ascended(unit)) next = Math.min(before, next + 5);
    return next;
  }

  function writeSp(unit = {}, value) {
    const runtime = global.LuminousSpellcastingRuntime;
    const next = mitigatedSpValue(unit, value);
    if (runtime?.writeCurrentSp && runtime.writeCurrentSp !== writeSp) return runtime.writeCurrentSp(unit, next);
    return rawWriteSp(unit, next);
  }

  function addSp(unit = {}, amount = 0) {
    const before = readSp(unit);
    const after = writeSp(unit, before + numberOr(amount, 0));
    return { before, after, changed: after - before };
  }

  function loseSp(unit = {}, amount = 0) {
    const before = readSp(unit);
    const after = writeSp(unit, before - Math.max(0, numberOr(amount, 0)));
    return { before, after, lost: Math.max(0, before - after) };
  }

  function currentHp(unit = {}) {
    return numberOr(unit.hp ?? unit.currentHp ?? unit.current_hp ?? unit.combatStats?.hp_actual, 0);
  }

  function maxHp(unit = {}) {
    return Math.max(1, numberOr(unit.maxHp ?? unit.max_hp ?? unit.hp_max ?? unit.combatStats?.hp_max, currentHp(unit) || 1));
  }

  function setHp(unit = {}, value) {
    const next = Math.max(0, Math.min(maxHp(unit), numberOr(value, 0)));
    if (Object.prototype.hasOwnProperty.call(unit, "hp")) unit.hp = next;
    else if (Object.prototype.hasOwnProperty.call(unit, "currentHp")) unit.currentHp = next;
    else if (Object.prototype.hasOwnProperty.call(unit, "current_hp")) unit.current_hp = next;
    else if (unit.combatStats && Object.prototype.hasOwnProperty.call(unit.combatStats, "hp_actual")) unit.combatStats.hp_actual = next;
    else unit.hp = next;
    return next;
  }

  function healHp(unit = {}, amount = 0) {
    const before = currentHp(unit);
    const after = setHp(unit, before + Math.max(0, numberOr(amount, 0)));
    return { before, after, healed: Math.max(0, after - before) };
  }

  function applyStatus(unit, statusId, input = {}) {
    if (!unit) return null;
    const engine = global.LuminousStatusEngine;
    if (engine?.applyStatus) return engine.applyStatus(unit, statusId, input);
    if (!unit.statusEffects || typeof unit.statusEffects !== "object" || Array.isArray(unit.statusEffects)) unit.statusEffects = {};
    const id = normalizeId(statusId);
    const existing = unit.statusEffects[id] || null;
    const mode = normalizeId(input.mode || "gain");
    const next = {
      id,
      name: input.name || existing?.name || id,
      count: mode === "gain" && existing ? numberOr(existing.count, 0) + Math.max(0, numberOr(input.count, 1)) : Math.max(0, numberOr(input.count, existing?.count ?? 1)),
      potency: mode === "gain" && existing ? numberOr(existing.potency, 0) + numberOr(input.potency, 0) : numberOr(input.potency, existing?.potency ?? 0),
      duration: input.duration || existing?.duration || "until_removed",
      sourceTraitId: input.sourceTraitId || existing?.sourceTraitId || null,
      sourceUnitId: input.sourceUnitId || existing?.sourceUnitId || null,
      data: { ...(existing?.data || {}), ...(input.data || {}) },
    };
    unit.statusEffects[id] = next;
    return clone(next);
  }

  function spellAffectStore(target = {}, create = true) {
    const key = entityKey(target);
    if (key) {
      if (create && !local.spellAffectedByKey.has(key)) local.spellAffectedByKey.set(key, new Set());
      return local.spellAffectedByKey.get(key) || null;
    }
    if (local.spellAffectedByObject && target && typeof target === "object") {
      if (create && !local.spellAffectedByObject.has(target)) local.spellAffectedByObject.set(target, new Set());
      return local.spellAffectedByObject.get(target) || null;
    }
    return null;
  }

  function markSpellAffected(owner, target, spell = {}) {
    if (!owner || !target || !isSpell(spell, { spell })) return false;
    const ownerKey = entityKey(owner);
    const store = spellAffectStore(target, true);
    if (!ownerKey || !store) return false;
    store.add(ownerKey);
    return true;
  }

  function wasAffectedByOwnSpell(owner, target) {
    const ownerKey = entityKey(owner);
    const store = spellAffectStore(target, false);
    return Boolean(ownerKey && store?.has(ownerKey));
  }

  function clearSpellAffected(target) {
    const key = entityKey(target);
    if (key) local.spellAffectedByKey.delete(key);
    if (local.spellAffectedByObject && target && typeof target === "object") local.spellAffectedByObject.delete(target);
  }

  function acquireEmotionalEcho(character, sin) {
    const resolved = characterFor(character);
    if (!isSelected(resolved) || levelOf(resolved) < 70) return { gained: false, reason: "voice_unavailable" };
    const id = canonicalSin(sin);
    if (!VOICE_SINS.includes(id)) return { gained: false, reason: "invalid_sin" };
    const record = stateFor(resolved);
    const before = Math.min(1, Math.max(0, intOr(record.emotionalEchoes[id], 0)));
    record.emotionalEchoes[id] = 1;
    persistState(resolved);
    if (!before) emit("luminous:orosh-emotional-echo-gained", { character: resolved, sin: id, state: record });
    return { gained: before === 0, sin: id, count: 1, state: record };
  }

  function hasEcho(character, sin) {
    const record = stateFor(characterFor(character));
    return Boolean(levelOf(character) >= 70 && record?.emotionalEchoes?.[canonicalSin(sin)] >= 1);
  }

  function voiceOnHit(character, runtime = {}) {
    const resolved = characterFor(character);
    if (!isSelected(resolved) || levelOf(resolved) < 70) return null;
    const skill = runtime.skill || {};
    const sin = skillSin(skill);
    if (!VOICE_SINS.includes(sin)) return null;
    const target = runtime.target || runtime.defender || runtime.targetsHit?.[0] || null;
    const echo = acquireEmotionalEcho(resolved, sin);
    const effect = { sin, echo, target, traitId: TRAITS.VOICE_OF_THE_FIRST };

    if (sin === "gloom" && target) effect.sp = loseSp(target, 4);
    if (sin === "gluttony" && runtime.self) {
      const amount = Math.max(0, Math.floor(numberOr(runtime.damageDealt, 0) * 0.15));
      if (amount > 0) effect.hp = healHp(runtime.self, amount);
    }
    if (sin === "sloth" && target) {
      effect.status = applyStatus(target, "bind", {
        mode: "gain",
        count: 2,
        potency: 0,
        duration: "until_removed",
        sourceTraitId: TRAITS.VOICE_OF_THE_FIRST,
        sourceUnitId: identityValues(resolved)[0] || null,
      });
    }

    emit("luminous:orosh-voice-effect", { character: resolved, runtime, effect, state: stateFor(resolved) });
    return effect;
  }

  function voiceOnClashWin(character, runtime = {}) {
    const resolved = characterFor(character);
    if (!hasEcho(resolved, "pride")) return null;
    const self = runtime.self || runtime.character || resolved;
    const sp = addSp(self, 7);
    const effect = { sin: "pride", sp, traitId: TRAITS.VOICE_OF_THE_FIRST };
    emit("luminous:orosh-voice-effect", { character: resolved, runtime, effect, state: stateFor(resolved) });
    return effect;
  }

  function activateAscension(character = currentCharacter() || {}, options = {}) {
    const resolved = characterFor(character);
    if (!isSelected(resolved) || levelOf(resolved) < 85) return { activated: false, reason: "ascension_unavailable" };
    const record = stateFor(resolved);
    if (record.ascension.active) return { activated: false, reason: "ascension_already_active", state: record };
    if (!record.ascension.available) return { activated: false, reason: "ascension_spent_until_long_rest", state: record };

    if (options.skipEconomy !== true && options.actionEconomy) {
      const economy = options.actionEconomy;
      let consumed = true;
      if (typeof economy.consume === "function") consumed = economy.consume(options.self || resolved, "action", { phase: options.phase || "combat" });
      else if (typeof economy.spendAction === "function") consumed = economy.spendAction(options.self || resolved) !== false;
      else if (typeof economy.consumeAction === "function") consumed = economy.consumeAction(options.self || resolved) !== false;
      if (!consumed) return { activated: false, reason: "action_unavailable", state: record };
    }

    record.ascension.available = false;
    record.ascension.active = true;
    record.ascension.roundsRemaining = 10;
    record.ascension.slotRecoveryUsedThisTurn = false;
    persistState(resolved);
    const self = options.self || character;
    if (self && typeof self === "object") {
      applyStatus(self, "orosh_ascension", {
        mode: "set",
        count: 1,
        potency: 0,
        duration: "until_removed",
        sourceTraitId: TRAITS.ASCENSION,
        sourceUnitId: identityValues(resolved)[0] || null,
        data: { roundsRemaining: 10 },
      });
    }
    emit("luminous:orosh-ascension-started", { character: resolved, self, state: record });
    renderControls();
    return { activated: true, roundsRemaining: 10, state: record };
  }

  function endAscension(character = currentCharacter() || {}, reason = "duration") {
    const resolved = characterFor(character);
    const record = stateFor(resolved);
    if (!record?.ascension?.active) return { ended: false, reason, state: record };
    record.ascension.active = false;
    record.ascension.roundsRemaining = 0;
    record.ascension.slotRecoveryUsedThisTurn = false;
    persistState(resolved);
    emit("luminous:orosh-ascension-ended", { character: resolved, reason, state: record });
    renderControls();
    return { ended: true, reason, state: record };
  }

  function advanceAscensionRound(character = currentCharacter() || {}) {
    const resolved = characterFor(character);
    const record = stateFor(resolved);
    if (!record?.ascension?.active) return record;
    record.ascension.roundsRemaining = Math.max(0, intOr(record.ascension.roundsRemaining, 0) - 1);
    if (record.ascension.roundsRemaining <= 0) endAscension(resolved, "duration");
    else persistState(resolved);
    return record;
  }

  function recoverSpellSlots(character = currentCharacter() || {}, amount = 3, maxLevel = 5, preferredLevels = []) {
    const resolved = characterFor(character);
    const runtime = global.LuminousSpellcastingRuntime;
    if (!runtime) return { recovered: 0, reason: "spellcasting_runtime_unavailable", levels: [] };
    const state = runtime.ensureSpellcastingState?.(resolved) || resolved.spellcastingState || null;
    if (!state) return { recovered: 0, reason: "spellcasting_state_unavailable", levels: [] };

    for (let level = 1; level <= Math.max(1, intOr(maxLevel, 5)); level += 1) {
      try { runtime.spellSlotPool?.(resolved, CLASS_ID, level); } catch (_) {}
    }
    const levels = state.slotsByClass?.[CLASS_ID]?.levels || {};
    const explicit = (Array.isArray(preferredLevels) ? preferredLevels : [])
      .map((value) => intOr(value, 0))
      .filter((value) => value >= 1 && value <= maxLevel);
    const fallback = Array.from({ length: maxLevel }, (_, index) => maxLevel - index);
    const order = [...explicit, ...fallback.filter((value) => !explicit.includes(value))];
    let remaining = Math.max(0, intOr(amount, 3));
    const recoveredLevels = [];

    for (const level of order) {
      const pool = levels[level] || levels[String(level)];
      if (!pool || remaining <= 0) continue;
      while (remaining > 0 && numberOr(pool.spent, 0) > 0) {
        pool.spent = Math.max(0, numberOr(pool.spent, 0) - 1);
        recoveredLevels.push(level);
        remaining -= 1;
      }
    }
    runtime.persistSpellcastingState?.(resolved);
    return { recovered: recoveredLevels.length, levels: recoveredLevels, remaining };
  }

  function ascensionOnKill(character, runtime = {}) {
    const resolved = characterFor(character);
    const record = stateFor(resolved);
    if (!ascended(resolved) || record.ascension.slotRecoveryUsedThisTurn) return null;
    const target = runtime.target || runtime.defender || runtime.killedUnit || runtime.targetsHit?.[0] || null;
    if (!target || !wasAffectedByOwnSpell(resolved, target)) return null;
    const recovery = recoverSpellSlots(resolved, 3, 5, runtime.recoverSlotLevels || []);
    if (recovery.recovered <= 0) return { recovered: 0, reason: "no_spent_slots" };
    record.ascension.slotRecoveryUsedThisTurn = true;
    persistState(resolved);
    clearSpellAffected(target);
    emit("luminous:orosh-ascension-slot-recovery", { character: resolved, target, recovery, state: record });
    return recovery;
  }

  function freeDetectEmotionsSpell(spell = {}) {
    return {
      ...spell,
      id: DETECT_EMOTIONS_ID,
      name: spell.name || "Detect Emotions",
      sourceClassId: CLASS_ID,
      classId: CLASS_ID,
      level: 0,
      spellLevel: 0,
      slotLevel: 0,
      cantrip: true,
      __oroshFreeCast: true,
      originalSpellLevel: Math.max(1, intOr(spell.slotLevel ?? spell.level ?? spell.spellLevel, 2)),
    };
  }

  function castDetectEmotions(character = currentCharacter() || {}, spell = {}, options = {}) {
    const resolved = characterFor(character);
    if (!isSelected(resolved) || levelOf(resolved) < 1) return { success: false, reason: "emotional_echo_unavailable" };
    const record = stateFor(resolved);
    if (record.detectEmotionsUsed) return { success: false, reason: "detect_emotions_spent_until_long_rest" };
    const runtime = global.LuminousSpellcastingRuntime;
    if (!runtime?.castSpell) return { success: false, reason: "spellcasting_runtime_unavailable" };
    const freeSpell = freeDetectEmotionsSpell(spell);
    const result = runtime.castSpell(resolved, freeSpell, {
      ...options,
      classId: CLASS_ID,
      slotLevel: 0,
      overcast: false,
      runtime: { ...(options.runtime || {}), oroshFreeCast: true },
    });
    if (!result?.success) return result || { success: false, reason: "free_cast_failed" };
    record.detectEmotionsUsed = true;
    persistState(resolved);
    emit("luminous:orosh-detect-emotions-cast", { character: resolved, spell: freeSpell, result, state: record });
    renderControls();
    return { ...result, oroshFreeCast: true, spentSpellSlot: false };
  }

  function obscurementValues(target = {}, options = {}) {
    return [
      options.obscurement,
      options.obscurementType,
      options.visualObscurement,
      target.obscurement,
      target.obscurementType,
      target.visualObscurement,
      ...(Array.isArray(options.obscurements) ? options.obscurements : []),
      ...(Array.isArray(target.obscurements) ? target.obscurements : []),
    ].filter(Boolean).map(normalizeId);
  }

  function termosenseCanIgnore(unit, target = {}, options = {}, reason = "") {
    if (!isSelected(unit) || levelOf(unit) < 1) return false;
    const values = obscurementValues(target, options);
    if (values.some((value) => VISUAL_OBSCUREMENT.has(value))) return true;
    const id = normalizeId(reason);
    if (["invisible_weight_3_or_less", "normal_darkness", "magical_darkness", "visual_camouflage"].includes(id)) return true;
    return Boolean(target?.statusEffects?.invisible || target?.statuses?.invisible);
  }

  function activeContext() {
    return local.activeSkillContexts.at(-1) || null;
  }

  function withSkillContext(context, callback) {
    const usable = context && typeof context === "object" ? context : null;
    if (usable) local.activeSkillContexts.push(usable);
    try { return callback(); }
    finally { if (usable) local.activeSkillContexts.pop(); }
  }

  function spUnitsFromContext(context = {}) {
    const list = [context.attacker, context.unitAttacker, context.defender, context.currentTarget, context.target, ...(Array.isArray(context.targetsHit) ? context.targetsHit : [])].filter(Boolean);
    const seen = new Set();
    return list.filter((unit) => {
      const key = entityKey(unit) || unit;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function snapshotSp(units = []) {
    const map = new Map();
    units.forEach((unit) => map.set(unit, readSp(unit)));
    return map;
  }

  function refundAscensionSpLoss(snapshots) {
    if (!snapshots) return;
    snapshots.forEach((before, unit) => {
      const after = readSp(unit);
      if (after >= before || !ascended(unit)) return;
      const repaired = Math.min(before, after + 5);
      rawWriteSp(unit, repaired);
      emit("luminous:orosh-ascension-sp-mitigation", { character: characterFor(unit), unit, before, requestedAfter: after, after: repaired, prevented: repaired - after });
    });
  }

  function withSpLossGuard(context, callback) {
    const root = local.spGuardDepth === 0;
    if (root) local.spGuardSnapshots = snapshotSp(spUnitsFromContext(context || {}));
    local.spGuardDepth += 1;
    try { return callback(); }
    finally {
      local.spGuardDepth = Math.max(0, local.spGuardDepth - 1);
      if (root) {
        const snapshots = local.spGuardSnapshots;
        local.spGuardSnapshots = null;
        refundAscensionSpLoss(snapshots);
      }
    }
  }

  function handleTraitTrigger(trait, trigger, runtime = {}) {
    const traitId = normalizeId(trait?.id || trait?.name);
    if (!Object.values(TRAITS).includes(traitId)) return;
    const character = characterFor(runtime.character || runtime.self || null);
    if (!isSelected(character)) return;
    const event = normalizeId(trigger);
    const record = stateFor(character);

    if ((event === "on_hit" || event === "after_skill") && isSpell(runtime.skill || runtime.spell || {}, runtime)) {
      const target = runtime.target || runtime.defender || runtime.targetsHit?.[0] || null;
      if (target) markSpellAffected(character, target, runtime.skill || runtime.spell || {});
    }

    if (traitId === TRAITS.VOICE_OF_THE_FIRST && event === "on_hit") voiceOnHit(character, runtime);
    if (traitId === TRAITS.VOICE_OF_THE_FIRST && event === "clash_win") voiceOnClashWin(character, runtime);

    if (traitId === TRAITS.ASCENSION) {
      if (event === "on_use" && levelOf(character) >= 85 && record.ascension.available && !record.ascension.active) {
        activateAscension(character, { self: runtime.self || character, skipEconomy: true });
      }
      if (event === "turn_start") {
        record.ascension.slotRecoveryUsedThisTurn = false;
        persistState(character);
      }
      if (event === "turn_end" && record.ascension.active) advanceAscensionRound(character);
      if (event === "on_kill") ascensionOnKill(character, runtime);
    }
  }

  function installTraitBridge() {
    const source = global.LuminousTraitEngine;
    if (!source?.dispatchTrait) return false;
    if (source.__oroshLineageCompleteIntegrated) {
      local.traitSource = source;
      return true;
    }
    if (local.traitSource === source) return true;
    const wrapped = Object.freeze({
      ...source,
      __oroshLineageCompleteIntegrated: true,
      dispatchTrait(trait, trigger, runtime = {}, traitState) {
        const result = source.dispatchTrait.call(source, trait, trigger, runtime, traitState);
        handleTraitTrigger(trait, trigger, result?.runtime || runtime);
        return result;
      },
    });
    global.LuminousTraitEngine = wrapped;
    local.traitSource = wrapped;
    return true;
  }

  function installCombatBridge() {
    const engine = global.CombatEngine;
    if (!engine) return false;
    if (engine.__oroshLineageCompleteIntegrated) {
      local.combatSource = engine;
      return true;
    }
    if (local.combatSource === engine) return true;

    const originalFinalPower = typeof engine.calculateFinalPower === "function" ? engine.calculateFinalPower : null;
    if (originalFinalPower) {
      engine.calculateFinalPower = function (skill, headsFlipped, unit = null, ...rest) {
        let value = originalFinalPower.call(this, skill, headsFlipped, unit, ...rest);
        const character = characterFor(unit);
        if (unit && isSelected(character) && levelOf(character) >= 70 && hasEcho(character, "envy")) value = numberOr(value, 0) + 2;
        if (unit && ascended(character) && isSpell(skill, { self: unit })) value = numberOr(value, 0) + 6;
        return value;
      };
    }

    const originalCoinDamage = typeof engine.calculateCoinDamage === "function" ? engine.calculateCoinDamage : null;
    if (originalCoinDamage) {
      engine.calculateCoinDamage = function (attacker, defender, skill, ...rest) {
        let value = originalCoinDamage.call(this, attacker, defender, skill, ...rest);
        const character = characterFor(attacker);
        if (typeof value === "number" && attacker && isSelected(character) && levelOf(character) >= 70 && hasEcho(character, "wrath")) {
          value = Math.max(0, value * 1.30);
        }
        return value;
      };
    }

    const originalTriggerEvent = typeof engine.triggerEvent === "function" ? engine.triggerEvent : null;
    if (originalTriggerEvent) {
      engine.triggerEvent = function (tag, context = {}, targetsHit = []) {
        const enriched = context && typeof context === "object" ? context : {};
        if (!Array.isArray(enriched.targetsHit) && Array.isArray(targetsHit)) enriched.targetsHit = targetsHit;
        return withSkillContext(enriched, () => withSpLossGuard(enriched, () => originalTriggerEvent.call(this, tag, enriched, targetsHit)));
      };
    }

    const originalProcessStatuses = typeof engine.processStatusEffects === "function" ? engine.processStatusEffects : null;
    if (originalProcessStatuses) {
      engine.processStatusEffects = function (unit, triggerKey, context = {}) {
        const enriched = { ...(context || {}), target: context?.target || unit };
        return withSkillContext(enriched, () => withSpLossGuard(enriched, () => originalProcessStatuses.call(this, unit, triggerKey, context)));
      };
    }

    try { Object.defineProperty(engine, "__oroshLineageCompleteIntegrated", { value: true, configurable: true }); }
    catch (_) { engine.__oroshLineageCompleteIntegrated = true; }
    local.combatSource = engine;
    return true;
  }

  function installConditionBridge() {
    const source = global.LuminousConditionRuntime;
    if (!source?.canTarget) return false;
    if (source.__oroshTermosenseIntegrated) {
      local.conditionSource = source;
      return true;
    }
    if (local.conditionSource === source) return true;
    const wrapped = Object.freeze({
      ...source,
      __oroshTermosenseIntegrated: true,
      canTarget(unit, target, skill = {}, options = {}) {
        const orosh = isSelected(unit) && levelOf(unit) >= 1;
        const patched = orosh && termosenseCanIgnore(unit, target, options)
          ? { ...options, ignoreInvisible: true, ignoreNormalDarkness: true, ignoreMagicalDarkness: true, ignoreVisualCamouflage: true }
          : options;
        const result = source.canTarget.call(source, unit, target, skill, patched) || { allowed: true, reason: null };
        if (result.allowed === false && termosenseCanIgnore(unit, target, options, result.reason)) {
          return { ...result, allowed: true, reason: null, ignoredBy: TRAITS.TERMOSENSE };
        }
        return result;
      },
    });
    global.LuminousConditionRuntime = wrapped;
    local.conditionSource = wrapped;
    return true;
  }

  function installStatusBridge() {
    const source = global.LuminousStatusEngine;
    if (!source?.applyStatus) return false;
    if (source.__oroshVoicePotencyIntegrated) {
      local.statusSource = source;
      return true;
    }
    if (local.statusSource === source) return true;
    const wrapped = Object.freeze({
      ...source,
      __oroshVoicePotencyIntegrated: true,
      applyStatus(unit, statusId, input = {}) {
        const context = activeContext();
        const attacker = context?.attacker || context?.unitAttacker || context?.self || context?.character || null;
        const skill = context?.skill || null;
        let nextInput = input;
        if (attacker && skill && unit && !sameEntity(attacker, unit) && isSelected(attacker) && levelOf(attacker) >= 70 && hasEcho(attacker, "lust")) {
          nextInput = { ...input, potency: numberOr(input.potency, 0) + 3 };
        }
        return source.applyStatus.call(source, unit, statusId, nextInput);
      },
    });
    global.LuminousStatusEngine = wrapped;
    local.statusSource = wrapped;
    return true;
  }

  function installSpellcastingBridge() {
    const source = global.LuminousSpellcastingRuntime;
    if (!source) return false;
    if (source.__oroshAscensionIntegrated) {
      local.spellcastingSource = source;
      return true;
    }
    if (local.spellcastingSource === source) return true;
    const wrapped = Object.freeze({
      ...source,
      __oroshAscensionIntegrated: true,
      writeCurrentSp(character, value) {
        const before = source.readCurrentSp ? numberOr(source.readCurrentSp(character), 0) : readSp(character);
        let requested = numberOr(value, before);
        if (requested < before && ascended(character)) requested = Math.min(before, requested + 5);
        return source.writeCurrentSp ? source.writeCurrentSp.call(source, character, requested) : rawWriteSp(character, requested);
      },
      resolveSpellSave(character, classId, spell = {}, runtime = {}, variables = {}) {
        const result = source.resolveSpellSave
          ? source.resolveSpellSave.call(source, character, classId, spell, runtime, variables)
          : null;
        if (!result || !ascended(character) || !mindEmotionIllusionPsychicSpell(spell, runtime)) return result;
        return { ...result, dc: numberOr(result.dc, 0) + 4, thresholdBonus: numberOr(result.thresholdBonus, 0) + 4, oroshAscension: true };
      },
    });
    global.LuminousSpellcastingRuntime = wrapped;
    local.spellcastingSource = wrapped;
    return true;
  }

  function installSorcererBridge() {
    const source = global.LuminousSorcererClassRuntime;
    if (!source?.castSorcererSpell) return false;
    if (source.__oroshDetectEmotionsIntegrated) {
      local.sorcererSource = source;
      return true;
    }
    if (local.sorcererSource === source) return true;
    const wrapped = Object.freeze({
      ...source,
      __oroshDetectEmotionsIntegrated: true,
      castSorcererSpell(character, spell = {}, options = {}) {
        const resolved = characterFor(character);
        const record = stateFor(resolved);
        if (
          spellId(spell) === DETECT_EMOTIONS_ID
          && isSelected(resolved)
          && levelOf(resolved) >= 1
          && !record?.detectEmotionsUsed
          && options.forceSpendSlot !== true
        ) {
          return castDetectEmotions(resolved, spell, options);
        }
        return source.castSorcererSpell.call(source, character, spell, options);
      },
    });
    global.LuminousSorcererClassRuntime = wrapped;
    local.sorcererSource = wrapped;
    return true;
  }

  function resolveDetectEmotionsSpell() {
    const candidates = [
      global.LuminousSpellCatalog?.getSpell?.(DETECT_EMOTIONS_ID),
      global.LuminousSpellCatalog?.get?.(DETECT_EMOTIONS_ID),
      global.SPELL_REGISTRY?.[DETECT_EMOTIONS_ID],
      global.SPELLS?.[DETECT_EMOTIONS_ID],
    ].filter(Boolean);
    return candidates[0] || { id: DETECT_EMOTIONS_ID, name: "Detect Emotions", level: 2, slotLevel: 2, sourceClassId: CLASS_ID, type: "Spell", tags: ["emotion"], concentration: true };
  }

  function renderControls() {
    const doc = global.document;
    if (!doc) return false;
    const host = doc.getElementById("player-trait-runtime-host");
    let panel = doc.getElementById("player-orosh-lineage-controls");
    const character = currentCharacter();
    if (!host || !character || !isSelected(character)) {
      panel?.remove?.();
      return false;
    }
    if (!panel) {
      panel = doc.createElement("section");
      panel.id = "player-orosh-lineage-controls";
      panel.className = "player-archetype-selector player-orosh-lineage-controls";
      host.prepend(panel);
    }
    const record = stateFor(character);
    const level = levelOf(character);
    panel.replaceChildren();

    const head = doc.createElement("div");
    head.className = "player-archetype-selector__head";
    const title = doc.createElement("strong");
    title.textContent = "OROSH LINEAGE";
    const stateText = doc.createElement("span");
    stateText.textContent = record.selectedFragment ? `Fragment: ${record.selectedFragment.toUpperCase()}` : "Choose a Fragment after Long Rest.";
    head.append(title, stateText);
    panel.appendChild(head);

    const row = doc.createElement("div");
    row.className = "player-archetype-selector__row";
    const choices = doc.createElement("div");
    choices.className = "player-archetype-selector__choices";

    if (record.fragmentSelectionAvailable) {
      const select = doc.createElement("select");
      select.id = "player-orosh-fragment-select";
      VOICE_SINS.forEach((sin) => {
        const option = doc.createElement("option");
        option.value = sin;
        option.textContent = sin.toUpperCase();
        select.appendChild(option);
      });
      const choose = doc.createElement("button");
      choose.type = "button";
      choose.className = "player-archetype-selector__choice";
      choose.textContent = "CHOOSE FRAGMENT";
      choose.addEventListener("click", () => {
        const result = base()?.selectFragment?.(character, select.value);
        if (!result?.selected) return global.alert?.(result?.reason || "Could not choose Fragment.");
        persistState(character);
        renderControls();
      });
      choices.append(select, choose);
    } else {
      const badge = doc.createElement("span");
      badge.className = "player-archetype-selector__selected";
      badge.textContent = `FRAGMENT · ${(record.selectedFragment || "NONE").toUpperCase()}`;
      choices.appendChild(badge);
    }

    if (level >= 1) {
      const detect = doc.createElement("button");
      detect.type = "button";
      detect.className = "player-archetype-selector__choice";
      detect.disabled = record.detectEmotionsUsed;
      detect.textContent = record.detectEmotionsUsed ? "DETECT EMOTIONS · USED" : "DETECT EMOTIONS · FREE";
      detect.addEventListener("click", () => {
        const result = castDetectEmotions(character, resolveDetectEmotionsSpell(), { actorId: character.actorId || character.id });
        if (!result?.success) global.alert?.(result?.reason || "Could not cast Detect Emotions.");
        renderControls();
      });
      choices.appendChild(detect);
    }

    if (level >= 70) {
      const echo = doc.createElement("span");
      echo.className = "player-archetype-selector__selected";
      const active = VOICE_SINS.filter((sin) => record.emotionalEchoes?.[sin]).map((sin) => sin.toUpperCase());
      echo.textContent = `ECHOES · ${active.length ? active.join(" / ") : "NONE"}`;
      choices.appendChild(echo);
    }

    if (level >= 85) {
      const asc = doc.createElement("span");
      asc.className = "player-archetype-selector__selected";
      asc.textContent = record.ascension.active
        ? `ASCENSION · ${record.ascension.roundsRemaining} ROUNDS`
        : (record.ascension.available ? "ASCENSION · READY" : "ASCENSION · USED");
      choices.appendChild(asc);
    }

    row.appendChild(choices);
    panel.appendChild(row);
    return true;
  }

  function bindEvents() {
    if (local.listenersBound || !global.addEventListener) return false;
    local.listenersBound = true;
    global.addEventListener("luminous:orosh-fragment-selected", (event) => {
      persistState(event?.detail?.character || currentCharacter());
      renderControls();
    });
    global.addEventListener("luminous:orosh-fragment-selection-required", (event) => {
      persistState(event?.detail?.character || currentCharacter());
      renderControls();
    });
    global.addEventListener("luminous:traits-refreshed", () => {
      install();
      renderControls();
    });
    global.addEventListener("luminous:rest-completed", (event) => {
      const detail = event?.detail || {};
      if (normalizeId(detail.type) !== "long_rest") return;
      const character = detail.character || currentCharacter();
      if (!character || !isSelected(character)) return;
      persistState(character);
      renderControls();
    });
    return true;
  }

  function install() {
    if (!base()) return { ready: false };
    bindEvents();
    const trait = installTraitBridge();
    const combat = installCombatBridge();
    const condition = installConditionBridge();
    const status = installStatusBridge();
    const spellcasting = installSpellcastingBridge();
    const sorcerer = installSorcererBridge();
    renderControls();
    return { ready: true, trait, combat, condition, status, spellcasting, sorcerer };
  }

  const api = Object.freeze({
    ARCHETYPE_ID,
    CLASS_ID,
    TRAITS,
    VOICE_SINS,
    VISUAL_OBSCUREMENT,
    stateFor,
    serializableState,
    persistState,
    acquireEmotionalEcho,
    hasEcho,
    voiceOnHit,
    voiceOnClashWin,
    activateAscension,
    endAscension,
    advanceAscensionRound,
    ascended,
    recoverSpellSlots,
    markSpellAffected,
    wasAffectedByOwnSpell,
    ascensionOnKill,
    castDetectEmotions,
    termosenseCanIgnore,
    mindEmotionIllusionPsychicSpell,
    renderControls,
    installTraitBridge,
    installCombatBridge,
    installConditionBridge,
    installStatusBridge,
    installSpellcastingBridge,
    installSorcererBridge,
    install,
  });

  global.LuminousOroshLineageCompleteRuntime = api;
  install();
  if (global.setInterval) {
    const timer = global.setInterval(install, PATCH_INTERVAL_MS);
    timer?.unref?.();
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);