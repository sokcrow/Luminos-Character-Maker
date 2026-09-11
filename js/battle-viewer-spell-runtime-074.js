(function (global, factory) {
  "use strict";
  const api = factory(global);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) {
    if (global.document && api?.ready && typeof api.ready.then === "function") {
      api.ready.then(() => { global.LuminousBattleViewerSpellRuntime074 = api; });
    } else global.LuminousBattleViewerSpellRuntime074 = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  const VERSION = "0.7.4";
  const OVERCAST_PREFIX = "__overcast__";
  const clean = (value) => String(value ?? "").trim();
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  let baseSpellcastingRuntime = null;

  function loadScript(id, src, globalName) {
    if (global?.[globalName]) return Promise.resolve(global[globalName]);
    if (!global?.document) return Promise.resolve(null);
    let script = global.document.getElementById(id);
    if (!script) {
      script = global.document.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      global.document.head?.appendChild(script);
    }
    return new Promise((resolve) => {
      if (global?.[globalName]) return resolve(global[globalName]);
      script.addEventListener?.("load", () => resolve(global?.[globalName] || null), { once: true });
      script.addEventListener?.("error", () => resolve(null), { once: true });
    });
  }

  async function ensureSupplementalSpellFiles() {
    if (typeof require === "function") {
      try { if (!global.LuminousSpellCatalog) global.LuminousSpellCatalog = require("./spell-catalog-core.js"); } catch (_) {}
      try { if (!global.LuminousRoleSpellCatalog) global.LuminousRoleSpellCatalog = require("./role-spell-catalog-core.js"); } catch (_) {}
      try { if (!global.LuminousPierreSpellBatchRuntime) global.LuminousPierreSpellBatchRuntime = require("./spell-batch-pierre-runtime.js"); } catch (_) {}
    }
    if (global.document) {
      await loadScript("spell-catalog-core-script", "js/spell-catalog-core.js", "LuminousSpellCatalog");
      await loadScript("role-spell-catalog-core-script", "js/role-spell-catalog-core.js", "LuminousRoleSpellCatalog");
      await loadScript("spell-batch-pierre-runtime-script", "js/spell-batch-pierre-runtime.js", "LuminousPierreSpellBatchRuntime");
    }
    global.LuminousContentRegistryBootstrap?.registerAvailableCore?.({ modules: {
      spellCatalog: global.LuminousSpellCatalog,
      roleSpellCatalog: global.LuminousRoleSpellCatalog,
    }});
    return Boolean(global.LuminousSpellCatalog);
  }

  function pierreBatchRuntime() { return global.LuminousPierreSpellBatchRuntime || null; }

  function spellcastingRuntime() {
    if (baseSpellcastingRuntime) return baseSpellcastingRuntime;
    const current = global?.LuminousSpellcastingRuntime;
    if (current && !current.__combatSpellResource074) return current;
    if (typeof require === "function") {
      try { return require("./spellcasting-basic-rules-runtime.js"); } catch (_) {}
      try { return require("./spellcasting-runtime.js"); } catch (_) {}
    }
    return current || null;
  }

  function parseResourceClassId(classId) {
    const raw = clean(classId);
    return raw.startsWith(OVERCAST_PREFIX)
      ? { overcast: true, classId: raw.slice(OVERCAST_PREFIX.length) }
      : { overcast: false, classId: raw };
  }

  function overcastAvailability(runtime, character, slotLevel) {
    const level = Math.max(1, Math.trunc(numberOr(slotLevel, 1)));
    const cost = level * Math.max(1, numberOr(runtime?.OVERCAST_SP_PER_SLOT_LEVEL, 15));
    const current = runtime?.readCurrentSp?.(character);
    if (current == null) return { available: false, reason: "Overcast requires a readable SP resource.", overcast: true, slotLevel: level, spCost: cost };
    const overflow = Math.max(0, cost - Math.max(0, Number(current)));
    if (overflow > 0 && typeof global.LuminousFixedDamageRuntime?.applyFixedDamage !== "function") {
      return { available: false, reason: "Fixed Damage Runtime is required for Overcast overflow.", overcast: true, slotLevel: level, spCost: cost, spBefore: current, overflowFixedDamage: overflow };
    }
    return { available: true, reason: null, overcast: true, slotLevel: level, spCost: cost, spBefore: current, overflowFixedDamage: overflow };
  }

  function installSpellcastingResourceBridge() {
    const base = spellcastingRuntime();
    if (!base) return false;
    if (global.LuminousSpellcastingRuntime?.__combatSpellResource074) return true;
    baseSpellcastingRuntime = base;
    const wrapped = Object.freeze({
      ...base,
      __combatSpellResource074: true,
      canSpendSpellSlot(character, classId, slotLevel, explicitTable = null) {
        const parsed = parseResourceClassId(classId);
        if (!parsed.overcast) return base.canSpendSpellSlot?.(character, parsed.classId, slotLevel, explicitTable) || { available: false, reason: "spell_slot_validator_unavailable" };
        return { ...overcastAvailability(base, character, slotLevel), classId: parsed.classId };
      },
      spendSpellSlot(character, classId, slotLevel, explicitTable = null) {
        const parsed = parseResourceClassId(classId);
        if (!parsed.overcast) return base.spendSpellSlot?.(character, parsed.classId, slotLevel, explicitTable) || { success: false, consumed: false, reason: "spell_slot_consumer_unavailable" };
        const gate = overcastAvailability(base, character, slotLevel);
        if (!gate.available) return { ...gate, success: false, consumed: false, classId: parsed.classId };
        const result = base.applyOvercast?.(character, slotLevel, { fixedDamageRuntime: global.LuminousFixedDamageRuntime, engine: global.CombatEngine }) || { success: false, reason: "overcast_runtime_unavailable" };
        return { ...gate, ...result, classId: parsed.classId, overcast: true, consumed: result.success === true, spent: result.success === true ? 1 : 0 };
      },
    });
    global.LuminousSpellcastingRuntime = wrapped;
    return true;
  }

  function spellCastEffect({ action, actor, effect, context } = {}) {
    const runtime = global.LuminousSpellcastingRuntime || spellcastingRuntime();
    const spell = action?.metadata?.sourceDefinition || {};
    const classId = clean(effect?.classId || action?.metadata?.sourceClassId);
    const slotLevel = Math.max(0, Math.trunc(numberOr(effect?.slotLevel ?? action?.metadata?.slotLevel, 0)));
    let concentration = null;
    if (effect?.concentration === true || spell.concentration === true || spell.requiresConcentration === true || spell.requires_concentration === true) {
      concentration = runtime?.startConcentration?.(actor, spell, { classId, startedAt: Date.now() }) || null;
    }
    const castingAction = runtime?.buildCastingActionMessage?.(spell, actor?.id || actor?.unitId || action?.actorId, { classId, slotLevel }) || null;
    try {
      global.dispatchEvent?.(new global.CustomEvent("luminous:spell-cast-resolved", { detail: { action, actor, spell, classId, slotLevel, concentration, castingAction, context } }));
    } catch (_) {}
    return { resolved: true, spellId: clean(action?.source?.id || effect?.spellId), classId, slotLevel, concentration, castingAction };
  }

  function absorbElementsEffect({ actor, effect } = {}) {
    const batch = pierreBatchRuntime();
    return batch?.prepareAbsorbElements?.(actor, effect?.element, effect?.castLevel) || { ok: false, reason: "pierre_spell_batch_runtime_required" };
  }

  function shieldEffect({ actor, effect } = {}) {
    const batch = pierreBatchRuntime();
    const shieldGranted = batch?.grantShield?.(actor, effect?.castLevel) || 0;
    return { resolved: shieldGranted > 0, shieldGranted };
  }

  function installCombatHook() {
    const current = global.LuminousBattleViewerCombatHooks073 || {};
    if (current.__spellRuntime074) return true;
    global.LuminousBattleViewerCombatHooks073 = Object.freeze({
      ...current,
      __spellRuntime074: true,
      effectHandlers: Object.freeze({
        ...(current.effectHandlers || {}),
        viewer_spell_cast: spellCastEffect,
        pierre_absorb_elements: absorbElementsEffect,
        pierre_shield: shieldEffect,
      }),
    });
    return true;
  }

  function installCore() {
    const resource = installSpellcastingResourceBridge();
    const hook = installCombatHook();
    pierreBatchRuntime()?.install?.();
    return resource && hook;
  }

  function install() {
    if (!global.document) {
      return ensureSupplementalSpellFiles().then(() => installCore());
    }
    return ensureSupplementalSpellFiles().then(() => installCore());
  }

  let readyResolve;
  const ready = new Promise((resolve) => { readyResolve = resolve; });
  ensureSupplementalSpellFiles().then(() => installCore()).then((ok) => readyResolve(ok)).catch(() => readyResolve(false));

  const api = Object.freeze({
    version: VERSION, OVERCAST_PREFIX, parseResourceClassId, overcastAvailability,
    ensureSupplementalSpellFiles, pierreBatchRuntime,
    installSpellcastingResourceBridge, spellCastEffect, absorbElementsEffect, shieldEffect,
    installCombatHook, install, ready
  });
  return api;
});
