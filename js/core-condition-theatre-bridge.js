(function (global) {
  "use strict";

  if (global.LuminousConditionTheatreBridge) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousConditionTheatreBridge;
    return;
  }

  const PATCH_INTERVAL_MS = 250;
  const state = { rollsSource: null };
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const conditionRuntime = () => global.LuminousConditionRuntime || null;

  function currentCharacter() {
    try {
      return global.LuminousPlayerTraitRuntime?.getCharacter?.() || global.datosJugador || null;
    } catch (_) {
      return global.datosJugador || null;
    }
  }

  function currentConditionUnit() {
    const runtime = conditionRuntime();
    const character = currentCharacter();
    const combatants = Object.values(global.combatData || {}).filter(Boolean);
    if (character && runtime?.sameUnit) {
      const combatUnit = combatants.find((unit) => runtime.sameUnit(unit, character));
      if (combatUnit) return combatUnit;
    }
    return character || combatants[0] || null;
  }

  function abilities() {
    return global.LuminousTheatreCheckCoordinator?.ABILITIES || [];
  }

  function inferRollSpec(input = {}) {
    const explicit = input.rollSpec || input.roll_spec || null;
    if (explicit && (explicit.kind || explicit.abilityId || explicit.skillId)) {
      return {
        kind: normalizeId(explicit.kind || (explicit.skillId ? "skill" : "ability")),
        abilityId: normalizeId(explicit.abilityId || explicit.ability || ""),
        skillId: explicit.skillId ? normalizeId(explicit.skillId) : null,
        label: explicit.label || null,
      };
    }

    const doc = global.document;
    if (!doc) return null;
    const panel = doc.querySelector?.("#stats-modal .player-ability-console") || doc.querySelector?.(".player-ability-console");
    const abilityId = normalizeId(panel?.dataset?.activeStat || "");
    const ability = abilities().find((entry) => normalizeId(entry.id) === abilityId) || null;
    if (!ability) return abilityId ? { kind: "ability", abilityId, skillId: null, label: null } : null;

    const promptTitle = String(doc.querySelector?.("#theatre-check-command-prompt strong")?.textContent || "").trim();
    if (promptTitle) {
      if (promptTitle.toLowerCase() === String(ability.name || "").toLowerCase()) {
        return { kind: "ability", abilityId: ability.id, skillId: null, label: promptTitle };
      }
      if (promptTitle.toLowerCase() === `${String(ability.name || "").toLowerCase()} saving throw`) {
        return { kind: "save", abilityId: ability.id, skillId: null, label: promptTitle };
      }
      const skill = (ability.skills || []).find((entry) => String(entry.name || "").toLowerCase() === promptTitle.toLowerCase());
      if (skill) return { kind: "skill", abilityId: ability.id, skillId: skill.id, label: promptTitle };
    }

    return { kind: "ability", abilityId: ability.id, skillId: null, label: ability.name || null };
  }

  function applyConditionThreshold(checkInput = {}, options = {}) {
    const runtime = conditionRuntime();
    const unit = options.unit || currentConditionUnit();
    const spec = options.rollSpec || inferRollSpec(checkInput) || {};
    const check = {
      ...(checkInput || {}),
      kind: normalizeId(checkInput.kind || spec.kind || (spec.skillId ? "skill" : "ability")),
      abilityId: normalizeId(checkInput.abilityId || spec.abilityId || ""),
      skillId: checkInput.skillId || spec.skillId || null,
    };
    if (!runtime?.applyCheckThreshold || !unit) return { check, modifier: 0, unit, spec };
    const result = runtime.applyCheckThreshold(unit, check, { target: options.target || checkInput.target || null });
    return { ...result, unit, spec };
  }

  function install() {
    const source = global.LuminousTheatreRolls;
    if (!source || !conditionRuntime()) return false;
    if (source.__luminousConditionThresholdWrapped) {
      state.rollsSource = source;
      return true;
    }
    if (state.rollsSource === source) return true;
    if (typeof source.armCheck !== "function") return false;

    const wrapped = {
      ...source,
      __luminousConditionThresholdWrapped: true,
      armCheck(options = {}) {
        const resolved = applyConditionThreshold(options);
        return source.armCheck.call(source, resolved.check);
      },
    };
    global.LuminousTheatreRolls = Object.freeze(wrapped);
    state.rollsSource = global.LuminousTheatreRolls;
    return true;
  }

  const api = Object.freeze({
    currentCharacter,
    currentConditionUnit,
    inferRollSpec,
    applyConditionThreshold,
    install,
  });

  global.LuminousConditionTheatreBridge = api;
  install();
  if (global.document) global.setInterval?.(install, PATCH_INTERVAL_MS);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
