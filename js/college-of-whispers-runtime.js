(function (global) {
  "use strict";

  if (global.LuminousCollegeOfWhispersRuntime) return;

  const ARCHETYPE_ID = "college_of_whispers";
  const CLASS_ID = "bard";
  const PATCH_INTERVAL_MS = 500;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const intOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  const runtimeStateByKey = new Map();
  const runtimeStateByObject = typeof WeakMap === "function" ? new WeakMap() : null;
  const stateRecords = new Set();
  const pendingSaves = new Map();
  let nextSaveRequestId = 1;
  let listenersBound = false;

  function identityValues(entity = {}) {
    return [
      entity.combatId, entity.combat_id, entity.unitId, entity.unit_id,
      entity.id, entity.playerId, entity.player_id, entity.characterId, entity.character_id,
      entity.actorId, entity.actor_id, entity.uid, entity.vinculo_jugador,
    ].filter((value) => value != null && String(value).trim() !== "").map((value) => String(value).trim());
  }

  function entityName(entity = {}) {
    return String(entity.characterName || entity.character_name || entity.nombre || entity.name || "Unknown").trim() || "Unknown";
  }

  function sameEntity(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const ids = new Set(identityValues(a));
    if (identityValues(b).some((id) => ids.has(id))) return true;
    const aName = normalizeId(entityName(a));
    const bName = normalizeId(entityName(b));
    return Boolean(aName && bName && aName === bName);
  }

  function characterKey(character = {}) {
    return identityValues(character)[0] || normalizeId(entityName(character)) || null;
  }

  function createRuntimeState(owner) {
    const record = {
      owner,
      mantleUsedSinceLongRest: false,
      pendingShadow: null,
      storedShadow: null,
      assumedIdentity: null,
      activeShadowLore: [],
    };
    stateRecords.add(record);
    return record;
  }

  function whispersState(character = {}) {
    const key = characterKey(character);
    if (key) {
      if (!runtimeStateByKey.has(key)) runtimeStateByKey.set(key, createRuntimeState(character));
      const record = runtimeStateByKey.get(key);
      record.owner = character;
      return record;
    }
    if (runtimeStateByObject && character && typeof character === "object") {
      if (!runtimeStateByObject.has(character)) runtimeStateByObject.set(character, createRuntimeState(character));
      return runtimeStateByObject.get(character);
    }
    return createRuntimeState(character);
  }

  function normalizedCharacter(character = {}) {
    if (Array.isArray(character.classes)) return character;
    if (Array.isArray(character.characterBuild?.classes)) return { ...character, classes: character.characterBuild.classes };
    return character;
  }

  function currentCharacter() {
    return global.LuminousPlayerTraitRuntime?.getCharacter?.() || global.datosJugador || null;
  }

  function bardLevel(character = {}) {
    const normalized = normalizedCharacter(character);
    const engine = global.LuminousArchetypeEngine;
    if (engine?.getClassLevel) return Math.max(0, intOr(engine.getClassLevel(normalized, CLASS_ID), 0));
    const classes = Array.isArray(normalized.classes) ? normalized.classes : [];
    const found = classes.find((entry) => normalizeId(entry?.classId || entry?.id || entry?.name) === CLASS_ID);
    return Math.max(0, intOr(found?.levels ?? found?.level, 0));
  }

  function selectedCollege(character = {}) {
    const engine = global.LuminousArchetypeEngine;
    if (engine?.isSelected) return Boolean(engine.isSelected(character, ARCHETYPE_ID, CLASS_ID));
    const selections = Array.isArray(character.characterBuild?.archetypes) ? character.characterBuild.archetypes : [];
    return selections.some((entry) => normalizeId(entry?.classId || entry?.parentClassId) === CLASS_ID && normalizeId(entry?.archetypeId || entry?.subclassId || entry?.id) === ARCHETYPE_ID);
  }

  function hasCollegeLevel(character, level) {
    return selectedCollege(character) && bardLevel(character) >= Number(level || 0);
  }

  function traitId(trait = {}) {
    return normalizeId(trait.baseTraitId || trait.id || trait.name);
  }

  function hasTrait(traits = [], id) {
    const wanted = normalizeId(id);
    return (traits || []).some((trait) => traitId(trait) === wanted);
  }

  function statusStore(unit = {}) {
    if (!unit || typeof unit !== "object") return null;
    if (global.LuminousStatusEngine?.ensureStore) return global.LuminousStatusEngine.ensureStore(unit);
    if (!unit.statusEffects || typeof unit.statusEffects !== "object" || Array.isArray(unit.statusEffects)) unit.statusEffects = {};
    return unit.statusEffects;
  }

  function getStatus(unit, statusId) {
    const id = normalizeId(statusId);
    const fromEngine = global.LuminousStatusEngine?.getStatus?.(unit, id);
    if (fromEngine) return fromEngine;
    return clone(statusStore(unit)?.[id] || null);
  }

  function applyStatus(unit, statusId, input = {}) {
    if (!unit) return null;
    const id = normalizeId(statusId);
    if (global.LuminousStatusEngine?.applyStatus) return global.LuminousStatusEngine.applyStatus(unit, id, input);
    const store = statusStore(unit);
    const existing = store?.[id] || null;
    const mode = normalizeId(input.mode || input.action || "set");
    const count = numberOr(input.count, existing?.count ?? 1);
    const next = {
      id,
      name: input.name || existing?.name || id,
      count: ["gain", "add", "inflict", "apply"].includes(mode) && existing ? numberOr(existing.count, 0) + count : count,
      potency: numberOr(input.potency, existing?.potency ?? 0),
      duration: normalizeId(input.duration || existing?.duration || "until_removed"),
      sourceTraitId: input.sourceTraitId || existing?.sourceTraitId || null,
      sourceUnitId: input.sourceUnitId || existing?.sourceUnitId || null,
      data: { ...(existing?.data || {}), ...(input.data || {}) },
    };
    store[id] = next;
    return clone(next);
  }

  function removeStatus(unit, statusId) {
    if (!unit) return false;
    const id = normalizeId(statusId);
    if (global.LuminousStatusEngine?.removeStatus) return global.LuminousStatusEngine.removeStatus(unit, id, { from: "self", ignoreProtection: true })?.removed === true;
    const store = statusStore(unit);
    const removed = Boolean(store && Object.prototype.hasOwnProperty.call(store, id));
    if (removed) delete store[id];
    return removed;
  }

  function readSp(unit = {}) {
    const value = unit.sp ?? unit.currentSp ?? unit.sp_actual ?? unit.combatStats?.sp_actual;
    return numberOr(value, 0);
  }

  function writeSp(unit = {}, value) {
    const next = Math.max(0, numberOr(value, 0));
    if (Object.prototype.hasOwnProperty.call(unit, "sp")) unit.sp = next;
    else if (Object.prototype.hasOwnProperty.call(unit, "currentSp")) unit.currentSp = next;
    else if (Object.prototype.hasOwnProperty.call(unit, "sp_actual")) unit.sp_actual = next;
    else if (unit.combatStats && Object.prototype.hasOwnProperty.call(unit.combatStats, "sp_actual")) unit.combatStats.sp_actual = next;
    else unit.sp = next;
    return next;
  }

  function formulaValue(trait, runtime = {}, formula) {
    const engine = global.LuminousTraitEngine;
    const character = normalizedCharacter(runtime.character || runtime.self || {});
    if (!engine?.evaluateFormula || !engine?.buildVariables) return numberOr(formula, 0);
    const variables = engine.buildVariables(character, { ...runtime, sourceClassId: CLASS_ID }, trait || {});
    variables.ClassLevel = bardLevel(character);
    return numberOr(engine.evaluateFormula(formula, variables), 0);
  }

  function bardicInspirationInfo(character = {}, runtime = {}, traitState = {}) {
    const engine = global.LuminousTraitEngine;
    const catalog = global.LuminousTraitCatalogCore;
    const definition = catalog?.getDefinition?.("bardic_inspiration") || null;
    const normalized = normalizedCharacter(character);
    const vars = engine?.buildVariables ? engine.buildVariables(normalized, { ...runtime, sourceClassId: CLASS_ID }, definition || {}) : {};
    vars.ClassLevel = bardLevel(normalized);
    const formula = definition?.activation?.uses?.formula || "max(1, CharismaMod) + min(1, floor(ClassLevel / 25))";
    const maximum = engine?.evaluateFormula ? Math.max(0, Math.floor(engine.evaluateFormula(formula, vars))) : Math.max(1, numberOr(vars.CharismaMod, 0)) + (vars.ClassLevel >= 25 ? 1 : 0);
    if (!traitState.usages) traitState.usages = {};
    const record = traitState.usages.bardic_inspiration || (traitState.usages.bardic_inspiration = { used: 0, reset: "long_rest" });
    const used = Math.max(0, intOr(record.used, 0));
    return { maximum, used, remaining: Math.max(0, maximum - used), record };
  }

  function consumeBardicInspiration(character = {}, runtime = {}, traitState = {}) {
    const info = bardicInspirationInfo(character, runtime, traitState);
    if (info.remaining <= 0) return { consumed: false, ...info };
    info.record.used = info.used + 1;
    return { consumed: true, ...info, usedAfter: info.record.used, remainingAfter: Math.max(0, info.maximum - info.record.used) };
  }

  function applyPsychicBlade(trait, runtime = {}, traitState = {}) {
    const self = runtime.self || runtime.character;
    if (!self) return null;
    const formula = trait?.mechanics?.gainCountFormula || "CharismaMod + ClassLevel / 20";
    const count = formulaValue(trait, runtime, formula);
    const status = applyStatus(self, "psychic_blade", {
      mode: "gain",
      name: "Psychic Blade",
      count,
      potency: 0,
      duration: "until_removed",
      sourceTraitId: trait?.id || "psychic_blade",
      sourceUnitId: identityValues(self)[0] || null,
      data: { onHitSpReductionFormula: trait?.mechanics?.onHitSpReductionFormula || "CharismaMod / 2 + ClassLevel / 25" },
    });
    return { type: "psychic_blade_gained", traitId: trait?.id || "psychic_blade", count, status };
  }

  function applyPsychicBladeOnHit(trait, runtime = {}) {
    const self = runtime.self || runtime.character;
    const target = runtime.target || runtime.defender || runtime.targetsHit?.[0];
    if (!self || !target) return null;
    const status = getStatus(self, "psychic_blade");
    if (!status || numberOr(status.count, 0) <= 0) return null;
    const formula = status.data?.onHitSpReductionFormula || trait?.mechanics?.onHitSpReductionFormula || "CharismaMod / 2 + ClassLevel / 25";
    const amount = Math.max(0, formulaValue(trait, runtime, formula));
    const before = readSp(target);
    const after = writeSp(target, before - amount);
    const remaining = numberOr(status.count, 0) - 1;
    if (remaining <= 0) removeStatus(self, "psychic_blade");
    else applyStatus(self, "psychic_blade", { mode: "set", name: status.name || "Psychic Blade", count: remaining, potency: status.potency || 0, duration: status.duration || "until_removed", sourceTraitId: status.sourceTraitId || trait?.id, data: status.data || {} });
    return { type: "psychic_blade_on_hit", traitId: trait?.id || "psychic_blade", target, spReduced: before - after, spBefore: before, spAfter: after, countBefore: status.count, countAfter: Math.max(0, remaining) };
  }

  function spellDCFor(trait, runtime = {}) {
    const character = normalizedCharacter(runtime.character || runtime.self || {});
    const engine = global.LuminousTraitEngine;
    const variables = engine?.buildVariables?.(character, { ...runtime, sourceClassId: CLASS_ID }, trait || {}) || {};
    if (Number.isFinite(Number(variables.SpellDC))) return Number(variables.SpellDC);
    const resolved = global.LuminousSpellcastingRuntime?.resolveForTrait?.(character, trait || {}, { ...runtime, sourceClassId: CLASS_ID }, variables);
    return numberOr(resolved?.spellDC, 8 + numberOr(variables.CharismaMod, 0) + numberOr(variables.Proficiency, 0));
  }

  function savePassedFromRuntime(runtime = {}) {
    for (const value of [runtime.savePassed, runtime.save?.passed, runtime.check?.passed]) {
      if (typeof value === "boolean") return value;
    }
    return null;
  }

  function applyFailedSave(request) {
    if (!request?.target) return null;
    if (request.traitId === "words_of_terror") {
      const status = applyStatus(request.target, "frightened", {
        mode: "set",
        name: "Frightened",
        count: 1,
        potency: 0,
        duration: "until_removed",
        sourceTraitId: "words_of_terror",
        sourceUnitId: identityValues(request.owner)[0] || null,
      });
      return { type: "spell_save_failed", traitId: request.traitId, abilityId: "wis", dc: request.dc, statusId: "frightened", status };
    }
    if (request.traitId === "shadow_lore") {
      const status = applyStatus(request.target, "charmed", {
        mode: "set",
        name: "Charmed",
        count: 1,
        potency: 0,
        duration: "until_removed",
        sourceTraitId: "shadow_lore",
        sourceUnitId: identityValues(request.owner)[0] || null,
        data: {
          durationHours: 8,
          believesDarkestSecretKnown: true,
          treatsCasterAsTrustedAlly: true,
          willNotRiskLifeUnlessAlreadyInclined: true,
          casterLearnsSecret: false,
          endsIfCasterOrAlliesDamageTarget: true,
        },
      });
      const ownerState = whispersState(request.owner || {});
      ownerState.activeShadowLore = ownerState.activeShadowLore.filter((entry) => !sameEntity(entry.target, request.target));
      ownerState.activeShadowLore.push({ target: request.target, remainingHours: 8 });
      return { type: "spell_save_failed", traitId: request.traitId, abilityId: "wis", dc: request.dc, statusId: "charmed", durationHours: 8, status };
    }
    return null;
  }

  function requestWisSave(trait, runtime = {}) {
    const target = runtime.target || runtime.defender || null;
    if (!target) return { requested: false, reason: "Target required." };
    const owner = runtime.self || runtime.character || {};
    const request = {
      requestId: `college_whispers_save_${nextSaveRequestId++}`,
      traitId: traitId(trait),
      abilityId: "wis",
      dc: spellDCFor(trait, runtime),
      owner,
      target,
    };
    const passed = savePassedFromRuntime(runtime);
    if (passed === false) return { requested: false, resolved: true, passed: false, request, outcome: applyFailedSave(request) };
    if (passed === true) return { requested: false, resolved: true, passed: true, request, outcome: null };
    pendingSaves.set(request.requestId, request);
    emit("luminous:spell-save-requested", clone({ requestId: request.requestId, traitId: request.traitId, abilityId: request.abilityId, dc: request.dc, targetId: identityValues(target)[0] || null, targetName: entityName(target) }));
    return { requested: true, resolved: false, request };
  }

  function resolvePendingSave(requestId, passed) {
    const id = String(requestId || "");
    const request = pendingSaves.get(id);
    if (!request) return { resolved: false, reason: "Unknown save request." };
    pendingSaves.delete(id);
    if (passed === true) return { resolved: true, passed: true, request: clone({ ...request, owner: undefined, target: undefined }), outcome: null };
    return { resolved: true, passed: false, request: clone({ ...request, owner: undefined, target: undefined }), outcome: applyFailedSave(request) };
  }

  function isHumanoid(unit = {}) {
    const values = [];
    [unit.tags, unit.unitTags, unit.labels, unit.markers, unit.race?.tags].forEach((list) => { if (Array.isArray(list)) values.push(...list); });
    values.push(unit.creatureType, unit.creature_type, unit.type, unit.unitType, unit.raceType, unit.race?.type);
    return values.filter(Boolean).some((value) => normalizeId(value?.id || value?.name || value) === "humanoid");
  }

  function shadowIdentity(unit = {}) {
    return {
      id: identityValues(unit)[0] || null,
      name: entityName(unit),
      actorId: unit.actorId || unit.actor_id || null,
      characterId: unit.characterId || unit.character_id || null,
      appearance: clone({
        sprite: unit.current_sprite || unit.sprite || null,
        defaultSprite: unit.default_sprite || unit.defaultSprite || null,
        portrait: unit.portrait || unit.avatar || null,
      }),
    };
  }

  function shadowStatusId(shadow) {
    return `shadow_of_${normalizeId(shadow?.name || "unknown") || "unknown"}`;
  }

  function captureShadow(deadUnit, character = currentCharacter()) {
    if (!character || !hasCollegeLevel(character, 30)) return { captured: false, reason: "Mantle of Whispers is not available." };
    if (!deadUnit || !isHumanoid(deadUnit)) return { captured: false, reason: "Target is not a Humanoid." };
    const state = whispersState(character);
    if (state.mantleUsedSinceLongRest) return { captured: false, reason: "Mantle of Whispers is Once Per Long Rest." };
    const shadow = shadowIdentity(deadUnit);
    state.mantleUsedSinceLongRest = true;
    state.pendingShadow = null;
    state.storedShadow = shadow;
    const statusId = shadowStatusId(shadow);
    applyStatus(character, statusId, {
      mode: "set",
      name: `Shadow of ${shadow.name}`,
      count: 1,
      potency: 0,
      duration: "until_removed",
      sourceTraitId: "mantle_of_whispers",
      data: { shadow: clone(shadow), activatable: true, expiresOnLongRestIfUnused: true },
    });
    const result = { captured: true, shadow: clone(shadow), statusId, effectName: `Shadow of ${shadow.name}` };
    emit("luminous:mantle-of-whispers-shadow-gained", result);
    return result;
  }

  function declinePendingShadow(character = currentCharacter()) {
    if (!character) return false;
    const state = whispersState(character);
    const hadPending = Boolean(state.pendingShadow);
    state.pendingShadow = null;
    return hadPending;
  }

  function useStoredShadow(character = currentCharacter()) {
    if (!character) return { used: false, reason: "No character available." };
    const state = whispersState(character);
    if (!state.storedShadow) return { used: false, reason: "No Stored Shadow." };
    const shadow = state.storedShadow;
    removeStatus(character, shadowStatusId(shadow));
    state.storedShadow = null;
    state.assumedIdentity = { shadow: clone(shadow), remainingHours: 1 };
    character.assumedIdentity = { source: "mantle_of_whispers", ...clone(shadow), remainingHours: 1 };
    applyStatus(character, "mantle_of_whispers_disguise", {
      mode: "set",
      name: `Identity: ${shadow.name}`,
      count: 1,
      potency: 0,
      duration: "until_removed",
      sourceTraitId: "mantle_of_whispers",
      data: { identity: clone(shadow), durationHours: 1, deceptionPowerAgainstInsight: 5 },
    });
    const result = { used: true, identity: clone(shadow), durationHours: 1, deceptionPowerAgainstInsight: 5 };
    emit("luminous:mantle-of-whispers-identity-assumed", result);
    return result;
  }

  function clearAssumedIdentity(state) {
    if (!state?.assumedIdentity) return false;
    const owner = state.owner;
    state.assumedIdentity = null;
    if (owner && owner.assumedIdentity?.source === "mantle_of_whispers") delete owner.assumedIdentity;
    removeStatus(owner, "mantle_of_whispers_disguise");
    emit("luminous:mantle-of-whispers-identity-ended", { characterId: identityValues(owner)[0] || null });
    return true;
  }

  function resetMantleOnLongRest(character) {
    if (!character) return false;
    const state = whispersState(character);
    if (state.storedShadow) removeStatus(character, shadowStatusId(state.storedShadow));
    state.storedShadow = null;
    state.pendingShadow = null;
    state.mantleUsedSinceLongRest = false;
    clearAssumedIdentity(state);
    return true;
  }

  function identityDeceptionCheck(check = {}) {
    const skill = normalizeId(check.skillId || check.skill || check.actionId);
    if (!["deception", "engano", "enga_o"].includes(skill)) return false;
    const context = [
      check.opposedBy, check.opposedSkillId, check.against, check.saveAgainst,
      check.condition, check.label, ...(Array.isArray(check.tags) ? check.tags : []),
    ].filter(Boolean).map(normalizeId).join(" ");
    return context.includes("insight") || context.includes("perspicacia") || context.includes("identity") || context.includes("disguise");
  }

  function applyDisguiseDeceptionBonus(character, check = {}) {
    const state = whispersState(character || {});
    if (!state.assumedIdentity || check.__mantleOfWhispersDeceptionApplied || !identityDeceptionCheck(check)) return null;
    check.finalPower = numberOr(check.finalPower, 0) + 5;
    check.__mantleOfWhispersDeceptionApplied = true;
    return { type: "mantle_of_whispers_deception", bonus: 5 };
  }

  function advanceWorldHours(hours) {
    const elapsed = Math.max(0, numberOr(hours, 0));
    if (!elapsed) return 0;
    let changed = 0;
    stateRecords.forEach((state) => {
      if (state.assumedIdentity) {
        state.assumedIdentity.remainingHours -= elapsed;
        if (state.owner?.assumedIdentity?.source === "mantle_of_whispers") state.owner.assumedIdentity.remainingHours = Math.max(0, state.assumedIdentity.remainingHours);
        if (state.assumedIdentity.remainingHours <= 0 && clearAssumedIdentity(state)) changed += 1;
      }
      state.activeShadowLore = state.activeShadowLore.filter((entry) => {
        entry.remainingHours -= elapsed;
        if (entry.remainingHours > 0) return true;
        const charmed = getStatus(entry.target, "charmed");
        if (normalizeId(charmed?.sourceTraitId) === "shadow_lore") removeStatus(entry.target, "charmed");
        changed += 1;
        return false;
      });
    });
    return changed;
  }

  function sameFaction(a = {}, b = {}) {
    const aFaction = a.faction ?? a.faccion;
    const bFaction = b.faction ?? b.faccion;
    return aFaction != null && bFaction != null && String(aFaction) === String(bFaction);
  }

  function breakShadowLoreFromDamage(detail = {}) {
    const attacker = detail.attacker || detail.source || detail.unitAttacker || null;
    const target = detail.target || detail.defender || detail.unit || detail.unitDefender || null;
    if (!attacker || !target) return 0;
    let broken = 0;
    stateRecords.forEach((state) => {
      state.activeShadowLore = state.activeShadowLore.filter((entry) => {
        if (!sameEntity(entry.target, target)) return true;
        if (!sameEntity(attacker, state.owner) && !sameFaction(attacker, state.owner)) return true;
        const charmed = getStatus(entry.target, "charmed");
        if (normalizeId(charmed?.sourceTraitId) === "shadow_lore") removeStatus(entry.target, "charmed");
        broken += 1;
        return false;
      });
    });
    return broken;
  }

  function emit(name, detail) {
    try {
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") global.dispatchEvent(new global.CustomEvent(name, { detail }));
    } catch (_) {}
  }

  function onHumanoidDeath(detail = {}) {
    const character = currentCharacter();
    const deadUnit = detail.unit || detail.target || null;
    if (!character || !deadUnit || !hasCollegeLevel(character, 30) || !isHumanoid(deadUnit)) return null;
    const state = whispersState(character);
    if (state.mantleUsedSinceLongRest) return null;
    state.pendingShadow = shadowIdentity(deadUnit);
    const choice = {
      traitId: "mantle_of_whispers",
      archetypeId: ARCHETYPE_ID,
      characterId: identityValues(character)[0] || null,
      targetId: identityValues(deadUnit)[0] || null,
      targetName: entityName(deadUnit),
      effectName: `Shadow of ${entityName(deadUnit)}`,
    };
    emit("luminous:mantle-of-whispers-choice", choice);
    return choice;
  }

  function applyPsychicAfterTrigger(traits, trigger, runtime, outcomes) {
    if (normalizeId(trigger) !== "on_hit" || !hasTrait(traits, "psychic_blade")) return;
    const trait = (traits || []).find((entry) => traitId(entry) === "psychic_blade");
    const outcome = applyPsychicBladeOnHit(trait, runtime);
    if (outcome) outcomes.push(outcome);
  }

  function extraActivationAvailability(source, trait, runtime, traitState) {
    const id = traitId(trait);
    if (["words_of_terror", "shadow_lore"].includes(id) && !(runtime.target || runtime.defender)) return "Target required.";
    if (id === "psychic_blade") {
      const character = runtime.character || runtime.self || {};
      const info = bardicInspirationInfo(character, runtime, traitState);
      if (info.remaining <= 0) return "No Bardic Inspiration Uses remaining.";
    }
    return null;
  }

  function patchTraitEngine() {
    const source = global.LuminousTraitEngine;
    if (!source?.activateTrait || !source?.dispatchTrait) return false;
    if (source.__collegeOfWhispersRuntimeWrapped) return true;

    const wrapped = Object.freeze({
      ...source,
      __collegeOfWhispersRuntimeWrapped: true,
      canActivateTrait(trait, runtime = {}, traitState) {
        const state = traitState || source.createState?.();
        const base = source.canActivateTrait(trait, runtime, state);
        if (!base?.available) return base;
        const reason = extraActivationAvailability(source, base.trait || trait, runtime, state);
        return reason ? { ...base, available: false, reasons: [...(base.reasons || []), reason] } : base;
      },
      activateTrait(trait, runtime = {}, traitState) {
        const state = traitState || source.createState?.();
        const normalized = source.normalizeTrait?.(trait) || trait;
        const reason = extraActivationAvailability(source, normalized, runtime, state);
        if (reason) return { available: false, reasons: [reason], trait: normalized, state, runtime, outcomes: [] };
        const result = source.activateTrait(trait, runtime, state);
        if (!result?.available || result?.scheduled) return result;
        const id = traitId(result.trait || trait);
        const outcomes = [...(result.outcomes || [])];
        if (id === "psychic_blade") {
          const consumption = consumeBardicInspiration(runtime.character || runtime.self || {}, runtime, result.state || state);
          if (!consumption.consumed) return { ...result, available: false, reasons: ["No Bardic Inspiration Uses remaining."], outcomes: [] };
          const gained = applyPsychicBlade(result.trait || trait, result.runtime || runtime, result.state || state);
          outcomes.push({ type: "bardic_inspiration_spent", traitId: "psychic_blade", usedAfter: consumption.usedAfter, remainingAfter: consumption.remainingAfter });
          if (gained) outcomes.push(gained);
        } else if (["words_of_terror", "shadow_lore"].includes(id)) {
          const save = requestWisSave(result.trait || trait, result.runtime || runtime);
          if (save.outcome) outcomes.push(save.outcome);
          else if (save.requested) outcomes.push({ type: "spell_save_requested", traitId: id, requestId: save.request.requestId, abilityId: "wis", dc: save.request.dc });
        }
        return { ...result, outcomes };
      },
      dispatchTrait(trait, trigger, runtime = {}, traitState) {
        const result = source.dispatchTrait(trait, trigger, runtime, traitState);
        if (traitId(result?.trait || trait) !== "psychic_blade" || normalizeId(trigger) !== "on_hit") return result;
        const outcomes = [...(result.outcomes || [])];
        const extra = applyPsychicBladeOnHit(result.trait || trait, result.runtime || runtime);
        if (extra) outcomes.push(extra);
        return { ...result, outcomes };
      },
      dispatchTraits(traits = [], trigger, runtime = {}, traitState) {
        const result = source.dispatchTraits(traits, trigger, runtime, traitState);
        const outcomes = [...(result.outcomes || [])];
        applyPsychicAfterTrigger(traits, trigger, result.runtime || runtime, outcomes);
        return { ...result, outcomes };
      },
      dispatchCombatEvent(trigger, input = {}) {
        const result = source.dispatchCombatEvent(trigger, input);
        const outcomes = [...(result?.outcomes || [])];
        applyPsychicAfterTrigger(input.traits || [], trigger, result?.runtime || input, outcomes);
        return result ? { ...result, outcomes } : result;
      },
      resolveTheatreCheck(input = {}) {
        const result = source.resolveTheatreCheck(input);
        if (!result?.check) return result;
        const extra = applyDisguiseDeceptionBonus(input.character || {}, result.check);
        return extra ? { ...result, outcomes: [...(result.outcomes || []), extra] } : result;
      },
    });
    global.LuminousTraitEngine = wrapped;
    return true;
  }

  function isCollegeTrait(trait = {}) {
    const source = trait.source || {};
    return ["archetype", "subclass", "class_archetype"].includes(normalizeId(source.type || trait.sourceType)) && normalizeId(source.archetypeId || source.id) === ARCHETYPE_ID;
  }

  function patchArchetypeRuntime() {
    const source = global.LuminousArchetypeRuntime;
    if (!source?.syncArchetypeTraitsForUnit) return false;
    if (source.__collegeOfWhispersRuntimeWrapped) return true;
    const originalSync = source.syncArchetypeTraitsForUnit.bind(source);
    const wrapped = Object.freeze({
      ...source,
      __collegeOfWhispersRuntimeWrapped: true,
      syncArchetypeTraitsForUnit(unit = {}) {
        const result = originalSync(unit) || [];
        const catalog = global.LuminousArchetypeTraitCatalog;
        if (!catalog?.resolveTraitGrants || !unit) return result;
        const character = normalizedCharacter(unit);
        const granted = catalog.resolveTraitGrants(character) || [];
        const collegeGranted = granted.filter(isCollegeTrait);
        const existing = Array.isArray(unit.traitDefinitions) ? unit.traitDefinitions : [];
        const byId = new Map();
        [...existing.filter((trait) => !isCollegeTrait(trait)), ...collegeGranted].forEach((trait) => {
          const id = normalizeId(trait?.id || trait?.name);
          if (id && !byId.has(id)) byId.set(id, trait);
        });
        unit.traitDefinitions = [...byId.values()];
        return granted;
      },
    });
    global.LuminousArchetypeRuntime = wrapped;
    return true;
  }

  function bindListeners() {
    if (listenersBound || typeof global.addEventListener !== "function") return false;
    listenersBound = true;
    global.addEventListener("luminous:unit-dead", (event) => onHumanoidDeath(event?.detail || {}));
    global.addEventListener("luminous:rest-completed", (event) => {
      const detail = event?.detail || {};
      if (normalizeId(detail.type) === "long_rest") resetMantleOnLongRest(detail.character || currentCharacter());
    });
    global.addEventListener("luminous:world-time-advance-requested", (event) => advanceWorldHours(event?.detail?.hours));
    ["luminous:damage-taken", "luminous:damage-dealt", "luminous:unit-damaged"].forEach((name) => global.addEventListener(name, (event) => breakShadowLoreFromDamage(event?.detail || {})));
    return true;
  }

  function install() {
    bindListeners();
    patchTraitEngine();
    patchArchetypeRuntime();
    return true;
  }

  const api = Object.freeze({
    ARCHETYPE_ID,
    CLASS_ID,
    bardLevel,
    selectedCollege,
    hasCollegeLevel,
    whispersState,
    bardicInspirationInfo,
    consumeBardicInspiration,
    applyPsychicBlade,
    applyPsychicBladeOnHit,
    spellDCFor,
    requestWisSave,
    resolvePendingSave,
    isHumanoid,
    captureShadow,
    declinePendingShadow,
    useStoredShadow,
    resetMantleOnLongRest,
    applyDisguiseDeceptionBonus,
    advanceWorldHours,
    breakShadowLoreFromDamage,
    onHumanoidDeath,
    patchTraitEngine,
    patchArchetypeRuntime,
    install,
  });

  global.LuminousCollegeOfWhispersRuntime = api;
  install();
  if (global.document && global.setInterval) global.setInterval(install, PATCH_INTERVAL_MS);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
