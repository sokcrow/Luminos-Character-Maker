(function (global) {
  "use strict";

  if (global.LuminousBattleViewerDmMagic074?.version === "0.7.4") {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousBattleViewerDmMagic074;
    return;
  }

  const VERSION = "0.7.4";
  const PATCH_INTERVAL_MS = 250;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function consoleApi() {
    return global.LuminousBattleViewerDmConsole074 || null;
  }

  function conditionRuntime() {
    return global.LuminousConditionRuntime || null;
  }

  function entityLabel(id, entity = {}) {
    return String(entity.characterName || entity.character_name || entity.nombre || entity.name || id || "UNIT").trim() || "UNIT";
  }

  function findCombatant(combatants, unitId) {
    const api = consoleApi();
    const key = api?.combatantKey?.(unitId, combatants || {});
    return key && combatants?.[key] ? { key, unit: combatants[key] } : null;
  }

  function canonicalUnitId(found) {
    const api = consoleApi();
    return api?.identityValues?.(found?.unit || {})?.[0] || found?.key || null;
  }

  function activeConcentration(unit) {
    return conditionRuntime()?.getConcentration?.(unit) || (unit?.concentration?.active ? unit.concentration : null);
  }

  function startConcentration(combatants, unitId, options = {}) {
    const found = findCombatant(combatants, unitId);
    if (!found) throw new Error("Select a valid combatant before starting Concentration.");
    const runtime = conditionRuntime();
    if (typeof runtime?.startConcentration !== "function") throw new Error("Condition Concentration runtime is not available.");
    const concentration = runtime.startConcentration(found.unit, {
      concentrationId: options.concentrationId || undefined,
      source: options.source || "dm_console",
    });
    return { unitId: found.key, canonicalUnitId: canonicalUnitId(found), concentration };
  }

  function magicSourceContext(combatants, sourceUnitId) {
    const found = findCombatant(combatants, sourceUnitId);
    if (!found) throw new Error("Magic Conditions require a valid source combatant.");
    const concentration = activeConcentration(found.unit);
    if (!concentration?.active || !concentration.id) {
      throw new Error(`${entityLabel(found.key, found.unit)} is not Concentrating. Start Concentration first.`);
    }
    return { ...found, canonicalUnitId: canonicalUnitId(found), concentration };
  }

  function magicConditionInput(combatants, sourceUnitId, input = {}) {
    const source = magicSourceContext(combatants, sourceUnitId);
    return {
      ...input,
      sourceType: "magic",
      sourceUnitId: source.canonicalUnitId,
      removalMode: "concentration",
      concentrationId: source.concentration.id,
    };
  }

  function surfaceError(error, source = "magic_condition") {
    console.error("[DM Magic 0.7.4]", error);
    const doc = global.document;
    const terminal = doc?.getElementById?.("combat-log-terminal");
    if (terminal) {
      const line = doc.createElement("div");
      line.className = "log-entry interrupt";
      line.textContent = `> [ DM 0.7.4 ] ERROR · ${error?.message || error}`;
      terminal.appendChild(line);
      terminal.scrollTop = terminal.scrollHeight;
    }
    try {
      if (typeof global.CustomEvent === "function") global.dispatchEvent?.(new global.CustomEvent("luminous:dm-console-error", { detail: { error, source } }));
    } catch (_) {}
    return false;
  }

  function replaceSourceInput(panel) {
    const existing = panel?.querySelector?.("#dm074-source-unit");
    if (!existing) return null;
    if (existing.tagName === "SELECT") return existing;
    const select = global.document.createElement("select");
    select.id = existing.id;
    select.title = "Source combatant for Conditions; Magic requires active Concentration.";
    existing.replaceWith(select);
    return select;
  }

  function populateSourceSelect(select) {
    const api = consoleApi();
    if (!select || !api) return false;
    const combatants = api._state?.combatants || {};
    const previous = select.value;
    select.replaceChildren();
    const blank = global.document.createElement("option");
    blank.value = "";
    blank.textContent = "— Source Unit —";
    select.appendChild(blank);
    Object.entries(combatants)
      .sort((a, b) => entityLabel(a[0], a[1]).localeCompare(entityLabel(b[0], b[1])))
      .forEach(([key, unit]) => {
        const option = global.document.createElement("option");
        option.value = key;
        option.textContent = `${entityLabel(key, unit)}${activeConcentration(unit)?.active ? " · CONC" : ""}`;
        select.appendChild(option);
      });
    if (previous && combatants[previous]) select.value = previous;
    return true;
  }

  function ensureStartButton(panel) {
    if (!panel) return null;
    let button = panel.querySelector("#dm074-start-conc");
    if (button) return button;
    const breakButton = panel.querySelector("#dm074-break-conc");
    if (!breakButton?.parentElement) return null;
    button = global.document.createElement("button");
    button.id = "dm074-start-conc";
    button.type = "button";
    button.className = "good";
    button.textContent = "START CONC.";
    breakButton.parentElement.insertBefore(button, breakButton);
    return button;
  }

  function overrideApplyStatus(panel) {
    const api = consoleApi();
    const button = panel?.querySelector?.("#dm074-apply-status");
    if (!api || !button || button.dataset.magic074Bound === "true") return false;
    button.dataset.magic074Bound = "true";
    button.onclick = () => {
      const $ = (id) => panel.querySelector(`#${id}`);
      api.mutateSelected((unit, all) => {
        const id = $("dm074-status-id")?.value;
        const sourceType = normalizeId($("dm074-source-type")?.value || "normal");
        const thresholdRaw = $("dm074-threshold")?.value ?? "";
        const sourceUnitId = $("dm074-source-unit")?.value || null;
        const base = {
          mode: "set",
          potency: numberOr($("dm074-potency")?.value, 0),
          count: numberOr($("dm074-count")?.value, 1),
          sourceType,
          sourceUnitId,
          saveThreshold: thresholdRaw === "" ? null : numberOr(thresholdRaw, 0),
        };
        const input = sourceType === "magic" ? magicConditionInput(all, sourceUnitId, base) : base;
        const entry = api.applyStatusToUnit(unit, id, input);
        if (!entry) throw new Error(`${id} was rejected by its application rules or immunity gate.`);
        return { id, sourceType, sourceUnitId: input.sourceUnitId || null, concentrationId: input.concentrationId || null, entry };
      }, { type: "apply_status", label: "APPLY STATUS" }).catch((error) => surfaceError(error, "magic_condition"));
    };
    return true;
  }

  function bindStartConcentration(panel, button) {
    const api = consoleApi();
    if (!api || !button || button.dataset.magic074Bound === "true") return false;
    button.dataset.magic074Bound = "true";
    button.onclick = () => api.mutateSelected((unit, all, key) => startConcentration(all, key), {
      type: "start_concentration",
      label: "START CONCENTRATION",
    }).then(() => {
      const select = panel.querySelector("#dm074-source-unit");
      populateSourceSelect(select);
    }).catch((error) => surfaceError(error, "start_concentration"));
    return true;
  }

  function patchUi() {
    const doc = global.document;
    const api = consoleApi();
    if (!doc || !api) return false;
    const panel = doc.getElementById("dm-dashboard");
    if (!panel?.classList?.contains("dm074")) return false;
    const source = replaceSourceInput(panel);
    populateSourceSelect(source);
    const start = ensureStartButton(panel);
    bindStartConcentration(panel, start);
    overrideApplyStatus(panel);
    return true;
  }

  function install() {
    patchUi();
    return true;
  }

  const api = Object.freeze({
    version: VERSION,
    findCombatant,
    canonicalUnitId,
    activeConcentration,
    startConcentration,
    magicSourceContext,
    magicConditionInput,
    populateSourceSelect,
    surfaceError,
    patchUi,
    install,
  });

  global.LuminousBattleViewerDmMagic074 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (global.document) {
    install();
    const timer = global.setInterval?.(install, PATCH_INTERVAL_MS) || null;
    timer?.unref?.();
  }
})(typeof window !== "undefined" ? window : globalThis);
