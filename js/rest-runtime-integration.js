(function (global) {
  "use strict";

  if (global.LuminousRestRuntime) return;

  const restEngine = global.LuminousRestEngine || (typeof require === "function" ? require("./rest-engine.js") : null);
  if (!restEngine) return;

  const PATCH_INTERVAL_MS = 250;
  const PLAYER_ROOT = "campaña/jugadores";
  const PLAYER_ID_STORAGE_KEY = "playerId";
  const state = {
    traitEngineSource: null,
    traitStateByOwner: typeof WeakMap === "function" ? new WeakMap() : null,
    listenersBound: false,
  };

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function identityValues(entity = {}) {
    return [
      entity?.id, entity?.playerId, entity?.player_id, entity?.characterId, entity?.character_id,
      entity?.actorId, entity?.actor_id, entity?.uid, entity?.vinculo_jugador,
    ].filter((value) => value != null && String(value).trim() !== "").map((value) => String(value).trim());
  }

  function sameEntity(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const ids = new Set(identityValues(a));
    if (identityValues(b).some((id) => ids.has(id))) return true;
    const aName = normalizeId(a.characterName || a.character_name || a.nombre || a.name);
    const bName = normalizeId(b.characterName || b.character_name || b.nombre || b.name);
    return Boolean(aName && bName && aName === bName);
  }

  function currentPlayerCharacter() {
    return global.LuminousPlayerTraitRuntime?.getCharacter?.() || global.datosJugador || null;
  }

  function resourceOwnerForRuntime(runtime = {}) {
    const self = runtime.self || null;
    const character = runtime.character || null;
    const player = currentPlayerCharacter();
    if (player && (sameEntity(player, self) || sameEntity(player, character))) return player;
    return self || character;
  }

  function healTargetForRuntime(runtime = {}) {
    return runtime.self || runtime.character || resourceOwnerForRuntime(runtime);
  }

  function rememberTraitState(runtime, traitState) {
    if (!state.traitStateByOwner || !traitState || typeof traitState !== "object") return traitState;
    const owner = resourceOwnerForRuntime(runtime || {});
    const self = runtime?.self;
    const character = runtime?.character;
    [owner, self, character].filter((entry) => entry && typeof entry === "object").forEach((entry) => state.traitStateByOwner.set(entry, traitState));
    return traitState;
  }

  function traitStateFor(character) {
    return state.traitStateByOwner?.get(character) || null;
  }

  function recoverMechanics(trait = {}) {
    const mechanics = trait?.mechanics || {};
    const count = Math.max(0, Number.parseInt(mechanics.spendRecoverSlot, 10) || 0);
    if (!count || mechanics.performRecoverImmediately !== true) return null;
    return {
      count,
      classId: normalizeId(mechanics.recoverClassId || trait?.source?.classId || trait?.classId),
      blockLongRests: Math.max(0, Number.parseInt(mechanics.blockUsedRecoverSlotLongRests, 10) || 0),
      sourceTraitId: normalizeId(trait?.id || trait?.name),
    };
  }

  function recoverAvailability(trait, runtime = {}) {
    const mechanics = recoverMechanics(trait);
    if (!mechanics) return { available: true, mechanics: null, reason: null };
    const owner = resourceOwnerForRuntime(runtime);
    if (!owner) return { available: false, mechanics, reason: "Recover has no character resource owner." };
    if (!mechanics.classId) return { available: false, mechanics, reason: "Recover Trait has no source Class." };
    const check = restEngine.canSpendRecoverSlots(owner, mechanics.classId, mechanics.count);
    return { available: check.available, mechanics, owner, check, reason: check.reason };
  }

  function persistPlayerRestState(character, options = {}) {
    const player = currentPlayerCharacter();
    if (!character || !player || !sameEntity(character, player)) return null;
    const db = global.firebase?.database?.();
    const playerId = String(global.localStorage?.getItem?.(PLAYER_ID_STORAGE_KEY) || character.playerId || character.player_id || "").trim();
    if (!db || !playerId) return null;
    const updates = { restResources: clone(character.restResources || {}) };
    if (options.includeHp !== false) {
      if (character.combatStats && Object.prototype.hasOwnProperty.call(character.combatStats, "hp_actual")) updates["combatStats/hp_actual"] = character.combatStats.hp_actual;
      else if (Object.prototype.hasOwnProperty.call(character, "currentHp")) updates.currentHp = character.currentHp;
      else if (Object.prototype.hasOwnProperty.call(character, "hp_actual")) updates.hp_actual = character.hp_actual;
      else if (Object.prototype.hasOwnProperty.call(character, "hp")) updates.hp = character.hp;
    }
    const promise = db.ref(`${PLAYER_ROOT}/${playerId}`).update(updates);
    promise?.catch?.((error) => console.warn("Rest Runtime persistence:", error));
    return promise;
  }

  function emit(name, detail) {
    if (typeof global.CustomEvent !== "function") return;
    global.dispatchEvent?.(new global.CustomEvent(name, { detail }));
  }

  function emitRestCompleted(result, character) {
    if (!result?.success) return result;
    const detail = { ...result, character };
    emit("luminous:rest-completed", detail);
    emit("luminous:world-time-advance-requested", {
      source: "rest",
      restType: result.type,
      hours: result.worldHoursAdvanced,
      characterId: identityValues(character)[0] || null,
    });
    return result;
  }

  function completeShortRest(character = currentPlayerCharacter(), options = {}) {
    if (!character) return { success: false, type: "short_rest", reason: "No character available." };
    const traits = options.traits || global.LuminousPlayerTraitRuntime?.getTraits?.() || [];
    const traitState = options.traitState || traitStateFor(character);
    const result = restEngine.performShortRest(character, { ...options, traits, traitState });
    if (result.success) persistPlayerRestState(character, { includeHp: true });
    return emitRestCompleted(result, character);
  }

  function completeLongRest(character = currentPlayerCharacter(), options = {}) {
    if (!character) return { success: false, type: "long_rest", reason: "No character available." };
    const traits = options.traits || global.LuminousPlayerTraitRuntime?.getTraits?.() || [];
    const traitState = options.traitState || traitStateFor(character);
    const result = restEngine.performLongRest(character, { ...options, traits, traitState });
    if (result.success) persistPlayerRestState(character, { includeHp: true });
    return emitRestCompleted(result, character);
  }

  function wrapTraitEngine(source) {
    const wrapped = { ...source, __luminousRestIntegrationWrapped: true };

    if (typeof source.dispatchTrait === "function") {
      wrapped.dispatchTrait = function (trait, trigger, runtime = {}, traitState) {
        rememberTraitState(runtime, traitState);
        const result = source.dispatchTrait.call(source, trait, trigger, runtime, traitState);
        rememberTraitState(result?.runtime || runtime, result?.state || traitState);
        return result;
      };
    }

    if (typeof source.dispatchTraits === "function") {
      wrapped.dispatchTraits = function (traits, trigger, runtime = {}, traitState) {
        rememberTraitState(runtime, traitState);
        const result = source.dispatchTraits.call(source, traits, trigger, runtime, traitState);
        rememberTraitState(result?.runtime || runtime, result?.state || traitState);
        return result;
      };
    }

    if (typeof source.dispatchCombatEvent === "function") {
      wrapped.dispatchCombatEvent = function (trigger, input = {}) {
        rememberTraitState(input, input?.state);
        const result = source.dispatchCombatEvent.call(source, trigger, input);
        rememberTraitState(result?.runtime || input, result?.state || input?.state);
        return result;
      };
    }

    if (typeof source.canActivateTrait === "function") {
      wrapped.canActivateTrait = function (trait, runtime = {}, traitState) {
        rememberTraitState(runtime, traitState);
        const base = source.canActivateTrait.call(source, trait, runtime, traitState);
        if (!base?.available) return base;
        const recovery = recoverAvailability(base.trait || trait, runtime);
        if (recovery.available) return base;
        return { ...base, available: false, reasons: [...(base.reasons || []), recovery.reason || "No Recover Slots available."] };
      };
    }

    if (typeof source.activateTrait === "function") {
      wrapped.activateTrait = function (trait, runtime = {}, traitState) {
        rememberTraitState(runtime, traitState);
        const recovery = recoverAvailability(trait, runtime);
        if (!recovery.available) {
          const normalized = source.normalizeTrait?.(trait) || trait;
          return {
            available: false,
            reasons: [recovery.reason || "No Recover Slots available."],
            maximum: null,
            remaining: null,
            actionCost: normalized?.activation?.actionCost || "none",
            trait: normalized,
            state: traitState,
            runtime,
            outcomes: [],
          };
        }

        const result = source.activateTrait.call(source, trait, runtime, traitState);
        rememberTraitState(result?.runtime || runtime, result?.state || traitState);
        if (!result?.available || result?.scheduled || !recovery.mechanics) return result;

        const owner = recovery.owner || resourceOwnerForRuntime(result.runtime || runtime);
        const healTarget = healTargetForRuntime(result.runtime || runtime);
        const recoverResult = restEngine.performRecover(owner, recovery.mechanics.classId, recovery.mechanics.count, {
          context: "combat",
          healTarget,
          includeAugments: false,
          blockLongRests: recovery.mechanics.blockLongRests,
          sourceTraitId: recovery.mechanics.sourceTraitId,
        });
        if (!recoverResult.success) return { ...result, available: false, reasons: [recoverResult.reason], restRecover: recoverResult };
        persistPlayerRestState(owner, { includeHp: false });
        const outcome = {
          type: "recover",
          traitId: recovery.mechanics.sourceTraitId,
          classId: recoverResult.classId,
          slotsUsed: recoverResult.slotsUsed,
          healedHp: recoverResult.healedHp,
          blockedForLongRests: recoverResult.blockedForLongRests,
        };
        const next = { ...result, restRecover: recoverResult, outcomes: [...(result.outcomes || []), outcome] };
        emit("luminous:recover-performed", { character: owner, target: healTarget, result: recoverResult, trait: next.trait || trait });
        return next;
      };
    }

    return Object.freeze(wrapped);
  }

  function installTraitEngineBridge() {
    const source = global.LuminousTraitEngine;
    if (!source) return false;
    if (source.__luminousRestIntegrationWrapped) {
      state.traitEngineSource = source;
      return true;
    }
    if (state.traitEngineSource === source) return true;
    const wrapped = wrapTraitEngine(source);
    global.LuminousTraitEngine = wrapped;
    state.traitEngineSource = wrapped;
    return true;
  }

  function bindRequestEvents() {
    if (state.listenersBound || !global.addEventListener) return false;
    state.listenersBound = true;
    global.addEventListener("luminous:request-short-rest", (event) => {
      const detail = event?.detail || {};
      completeShortRest(detail.character || currentPlayerCharacter(), detail);
    });
    global.addEventListener("luminous:request-long-rest", (event) => {
      const detail = event?.detail || {};
      completeLongRest(detail.character || currentPlayerCharacter(), detail);
    });
    return true;
  }

  function ensureHealthEquipmentAssets() {
    if (!global.document) return null;
    const ensureScript = (id, src) => {
      let script = global.document.getElementById(id);
      if (script) return script;
      script = global.document.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      global.document.head?.appendChild(script);
      return script;
    };
    if (global.LuminousAnatomyEquipmentEngine) {
      return { anatomy: null, injury: global.LuminousInjuryEngine ? null : ensureScript("injury-engine-script", "js/injury-engine.js") };
    }
    const anatomy = ensureScript("anatomy-equipment-engine-script", "js/anatomy-equipment-engine.js");
    const ensureInjury = () => {
      if (!global.LuminousInjuryEngine) ensureScript("injury-engine-script", "js/injury-engine.js");
    };
    anatomy?.addEventListener?.("load", ensureInjury, { once: true });
    return { anatomy };
  }

  function install() {
    bindRequestEvents();
    ensureHealthEquipmentAssets();
    return installTraitEngineBridge();
  }

  const api = Object.freeze({
    sameEntity,
    resourceOwnerForRuntime,
    healTargetForRuntime,
    rememberTraitState,
    traitStateFor,
    recoverMechanics,
    recoverAvailability,
    persistPlayerRestState,
    completeShortRest,
    completeLongRest,
    installTraitEngineBridge,
    ensureHealthEquipmentAssets,
    install,
  });

  global.LuminousRestRuntime = api;
  install();
  if (global.document) global.setInterval?.(install, PATCH_INTERVAL_MS);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
