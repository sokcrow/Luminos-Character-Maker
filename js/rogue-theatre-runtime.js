(function (global) {
  "use strict";

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const RETRY_KEY = "__luminousRogueStrokeOfLuckRetry";

  function runtime() { return global.LuminousRogueClassRuntime || (typeof require === "function" ? require("./rogue-class-runtime.js") : null); }
  function playerCharacter() { return global.datosJugador || global.currentCharacter || global.characterData || {}; }

  function effectiveCheckForRogue(character = {}, check = {}) {
    const rogue = runtime();
    if (!rogue) return { ...check };
    const finalPowerBonus = rogue.reliableTalentFinalPower(character, check);
    const headsProbabilityBonus = rogue.headsProbabilityBonus(character);
    const next = { ...check, rogueFinalPowerBonus: finalPowerBonus, rogueHeadsProbabilityBonus: headsProbabilityBonus };
    if (finalPowerBonus && Number.isFinite(Number(next.thresholdRaw ?? next.threshold))) {
      if (next.thresholdRaw != null) next.thresholdRaw = Math.max(0, Number(next.thresholdRaw) - finalPowerBonus);
      else next.threshold = Math.max(0, Number(next.threshold) - finalPowerBonus);
    }
    return next;
  }

  function wrapTheatreRolls() {
    const source = global.LuminousTheatreRolls;
    const rogue = runtime();
    if (!source || !rogue || source.__rogueTheatreWrapped) return Boolean(source && rogue);
    const originalArm = source.armCheck?.bind(source);
    const originalPublish = source.publishRoll?.bind(source);
    const wrapped = Object.freeze({
      ...source,
      __rogueTheatreWrapped: true,
      armCheck(options = {}) {
        const character = playerCharacter();
        rogue.ensureThievesCantOnCharacter(character);
        const check = effectiveCheckForRogue(character, options);
        return originalArm ? originalArm(check) : check;
      },
      async publishRoll(payload = {}) {
        const result = originalPublish ? await originalPublish(payload) : { published: false, payload };
        const character = playerCharacter();
        const outcome = normalizeId(payload.outcome || result?.outcome || payload.checkOutcome || result?.checkOutcome);
        const failed = ["failed", "fail", "failure"].includes(outcome);
        if (!failed || rogue.rogueLevel(character) < 100 || payload[RETRY_KEY] === true) return result;
        const detail = { character, sourceTraitId: "stroke_of_luck", originalPayload: payload, retryOnce: true, retryKey: RETRY_KEY };
        if (typeof global.LuminousTheatreRogueRetryHandler === "function") {
          const retryResult = await global.LuminousTheatreRogueRetryHandler(detail);
          return { ...result, rogueStrokeOfLuck: { requested: true, retried: true, retryResult } };
        }
        if (typeof global.CustomEvent === "function" && global.document?.dispatchEvent) global.document.dispatchEvent(new global.CustomEvent("luminous:rogue-stroke-of-luck-retry", { detail }));
        return { ...result, rogueStrokeOfLuck: { requested: true, retried: false, reason: "theatre_retry_handler_required" } };
      },
    });
    global.LuminousTheatreRolls = wrapped;
    return true;
  }

  function wrapLanguageCatalog() {
    const source = global.LuminousLanguageCatalog;
    const rogue = runtime();
    if (!source || !rogue || source.__rogueLanguageCatalogWrapped) return Boolean(source && rogue);
    const originalList = source.list?.bind(source) || (() => []);
    const originalGet = source.get?.bind(source) || (() => null);
    const definition = rogue.THIEVES_CANT_DEFINITION;
    const wrapped = Object.freeze({
      ...source,
      __rogueLanguageCatalogWrapped: true,
      list() {
        const values = originalList();
        if (!values.some((entry) => normalizeId(entry?.languageId) === rogue.LANGUAGE_ID)) values.push({ languageId: rogue.LANGUAGE_ID, definition: { ...definition } });
        return values;
      },
      get(languageId) {
        if (normalizeId(languageId) === rogue.LANGUAGE_ID) return { ...definition };
        return originalGet(languageId);
      },
    });
    global.LuminousLanguageCatalog = wrapped;
    return true;
  }

  function enforceThievesCant(character = playerCharacter()) {
    const rogue = runtime();
    if (!rogue) return false;
    if (rogue.hasThievesCant(character)) return rogue.ensureThievesCantOnCharacter(character);
    const languages = character?.languages;
    if (languages && typeof languages === "object" && Object.prototype.hasOwnProperty.call(languages, rogue.LANGUAGE_ID)) delete languages[rogue.LANGUAGE_ID];
    return false;
  }

  function wrapCharacterManager() {
    const source = global.LuminousCharacterManager;
    const rogue = runtime();
    if (!source || !rogue || source.__rogueLanguageAccessWrapped) return Boolean(source && rogue);
    const originalListLanguages = source.listLanguages?.bind(source);
    if (!originalListLanguages) return false;
    global.LuminousCharacterManager = Object.freeze({
      ...source,
      __rogueLanguageAccessWrapped: true,
      listLanguages() {
        const values = originalListLanguages();
        if (!values.some((entry) => normalizeId(entry?.languageId) === rogue.LANGUAGE_ID)) values.push({ languageId: rogue.LANGUAGE_ID, language: { ...rogue.THIEVES_CANT_DEFINITION } });
        return values;
      },
    });
    return true;
  }

  function install() {
    const rogue = runtime();
    if (!rogue) return false;
    enforceThievesCant();
    const rolls = wrapTheatreRolls();
    const languages = wrapLanguageCatalog();
    const manager = wrapCharacterManager();
    return rolls || languages || manager;
  }

  const api = Object.freeze({ install, effectiveCheckForRogue, wrapTheatreRolls, wrapLanguageCatalog, wrapCharacterManager, enforceThievesCant });
  global.LuminousRogueTheatreRuntime = api;
  install();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global.setInterval) global.setInterval(install, 800);
})(typeof window !== "undefined" ? window : globalThis);
