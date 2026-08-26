(function (global) {
  "use strict";

  if (global.LuminousRacialTraitRuntimeBridge) return;

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  const state = {
    traitEngineSource: null,
    combatDamageSource: null,
    pendingDamageOverride: null,
    racialSkillScriptRequested: false,
  };

  function ensureScript(id, src) {
    if (!global.document) return null;
    const existing = global.document.getElementById(id);
    if (existing) return existing;
    const script = global.document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = false;
    global.document.head?.appendChild(script);
    return script;
  }

  function ensureRacialSkillRuntime() {
    if (global.LuminousRacialSkillRuntime) {
      global.LuminousRacialSkillRuntime.installCombatBridge?.();
      return true;
    }

    if (typeof require === "function") {
      try {
        require("./racial-skill-runtime.js");
        if (global.LuminousRacialSkillRuntime) {
          global.LuminousRacialSkillRuntime.installCombatBridge?.();
          return true;
        }
      } catch (_) {}
    }

    if (!global.document || state.racialSkillScriptRequested) return false;
    state.racialSkillScriptRequested = true;
    const existing = global.document.getElementById("racial-skill-runtime-script");
    if (existing) return false;
    const script = global.document.createElement("script");
    script.id = "racial-skill-runtime-script";
    script.src = "js/racial-skill-runtime.js";
    script.async = false;
    script.addEventListener("load", () => global.LuminousRacialSkillRuntime?.installCombatBridge?.(), { once: true });
    global.document.head?.appendChild(script);
    return false;
  }

  function ensureHalfDemonRuntime() {
    if (global.LuminousHalfDemonCombatRuntime) {
      global.LuminousHalfDemonRacialTraits?.install?.();
      global.LuminousHalfDemonCombatRuntime.installCombatBridge?.();
      return true;
    }

    if (typeof require === "function") {
      try {
        if (!global.LuminousCanonicalRacialTraits) require("./canonical-racial-traits.js");
        if (!global.LuminousHalfDemonRacialTraits) require("./half-demon-racial-traits.js");
        const runtime = require("./half-demon-combat-runtime.js");
        runtime?.installCombatBridge?.();
        return Boolean(global.LuminousHalfDemonCombatRuntime || runtime);
      } catch (_) {}
    }

    if (!global.document || !global.LuminousTraitEngine || !global.LuminousRacialTraitCatalog) return false;
    if (!global.LuminousCanonicalRacialTraits) {
      ensureScript("canonical-racial-traits-script", "js/canonical-racial-traits.js");
      return false;
    }
    if (!global.LuminousHalfDemonRacialTraits) {
      ensureScript("half-demon-racial-traits-script", "js/half-demon-racial-traits.js");
      return false;
    }
    if (!global.LuminousHalfDemonCombatRuntime) {
      ensureScript("half-demon-combat-runtime-script", "js/half-demon-combat-runtime.js");
      return false;
    }
    global.LuminousHalfDemonRacialTraits.install?.();
    global.LuminousHalfDemonCombatRuntime.installCombatBridge?.();
    return true;
  }

  function installTraitDamageContextBridge() {
    const source = global.LuminousTraitEngine;
    if (!source || typeof source.dispatchCombatEvent !== "function") return false;
    if (source.__racialDamageContextBridge) return true;
    if (state.traitEngineSource === source) return true;

    const wrapped = Object.freeze({
      ...source,
      __racialDamageContextBridge: true,
      dispatchCombatEvent(trigger, input = {}) {
        if (normalizeId(trigger) !== "damage_dealt") {
          return source.dispatchCombatEvent.call(source, trigger, input);
        }

        const self = input.self || input.attacker || input.character || null;
        const damage = input.damage && typeof input.damage === "object"
          ? input.damage
          : { amount: Math.max(0, numberOr(input.damageDealt, 0)) };
        const originalDamage = numberOr(damage.amount, numberOr(input.damageDealt, 0));
        const previousSelfDamage = self && Object.prototype.hasOwnProperty.call(self, "damage") ? self.damage : undefined;
        const hadSelfDamage = Boolean(self && Object.prototype.hasOwnProperty.call(self, "damage"));

        if (self) self.damage = damage;
        const result = source.dispatchCombatEvent.call(source, trigger, {
          ...(input || {}),
          damage,
          variables: {
            ...(input.variables || {}),
            DamageDealt: originalDamage,
          },
        });

        const adjusted = Math.max(0, numberOr(result?.runtime?.damage?.amount ?? damage.amount, originalDamage));
        state.pendingDamageOverride = {
          attacker: self,
          skill: input.skill || null,
          original: originalDamage,
          adjusted,
        };

        if (self) {
          if (hadSelfDamage) self.damage = previousSelfDamage;
          else delete self.damage;
        }
        return result;
      },
    });

    global.LuminousTraitEngine = wrapped;
    state.traitEngineSource = wrapped;
    return true;
  }

  function installCombatDamageReturnBridge() {
    const engine = global.CombatEngine;
    if (!engine || !engine.__universalModifierBridge || typeof engine.calculateCoinDamage !== "function") return false;
    if (engine.calculateCoinDamage.__racialDamageReturnBridge) return true;
    if (state.combatDamageSource === engine.calculateCoinDamage) return true;

    const source = engine.calculateCoinDamage;
    const wrapped = function (attacker, defender, skill, ...rest) {
      state.pendingDamageOverride = null;
      const baseDamage = source.call(this, attacker, defender, skill, ...rest);
      const pending = state.pendingDamageOverride;
      state.pendingDamageOverride = null;
      if (!pending) return baseDamage;
      if (pending.attacker !== attacker) return baseDamage;
      if (pending.skill && skill && pending.skill !== skill) return baseDamage;
      return Math.max(0, numberOr(pending.adjusted, baseDamage));
    };
    Object.defineProperty(wrapped, "__racialDamageReturnBridge", { value: true });
    engine.calculateCoinDamage = wrapped;
    state.combatDamageSource = wrapped;
    return true;
  }

  function installAll() {
    ensureRacialSkillRuntime();
    ensureHalfDemonRuntime();
    installTraitDamageContextBridge();
    installCombatDamageReturnBridge();
  }

  const api = Object.freeze({
    installAll,
    ensureRacialSkillRuntime,
    ensureHalfDemonRuntime,
    installTraitDamageContextBridge,
    installCombatDamageReturnBridge,
    getPendingDamageOverride: () => state.pendingDamageOverride ? { ...state.pendingDamageOverride } : null,
  });

  global.LuminousRacialTraitRuntimeBridge = api;
  installAll();
  if (global.document && typeof global.setInterval === "function") global.setInterval(installAll, 400);

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
