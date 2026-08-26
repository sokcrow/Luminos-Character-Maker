(function (global) {
  "use strict";

  if (global.LuminousEnvironmentRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousEnvironmentRuntime;
    return;
  }

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  let bridgedSource = null;

  function environmentEngine() {
    if (global.LuminousEnvironmentEngine) return global.LuminousEnvironmentEngine;
    if (typeof require === "function") {
      try { return require("./environment-engine.js"); } catch (_) { return null; }
    }
    return null;
  }

  function weatherEngine() {
    return global.LuminousWeatherEngine || null;
  }

  function calendarIsDay(calendar) {
    const source = calendar && typeof calendar === "object" ? calendar : {};
    if (!source.timestamp) return null;
    const date = new Date(source.timestamp);
    if (Number.isNaN(date.getTime())) return null;
    const hour = date.getHours();
    return hour >= 6 && hour < 18;
  }

  function overridesFromRuntime(runtime = {}) {
    const context = runtime.environmentContext && typeof runtime.environmentContext === "object"
      ? runtime.environmentContext
      : {};
    const overrides = { ...context };
    ["encounterType", "exposure", "water", "effects", "state", "stateOrigins", "isDay"].forEach((key) => {
      if (runtime[key] !== undefined && overrides[key] === undefined) overrides[key] = runtime[key];
    });
    return overrides;
  }

  function currentEnvironment(options = {}) {
    const environment = environmentEngine();
    if (!environment?.resolveEnvironment) return null;
    const weather = weatherEngine();
    const weatherState = options.weather ?? weather?.getState?.() ?? null;
    const calendar = options.calendar ?? weather?.getCalendar?.() ?? null;
    const isDay = options.isDay !== undefined ? options.isDay : calendarIsDay(calendar);
    if (!weatherState && options.weatherId === undefined && options.weather === undefined) return null;
    return environment.resolveEnvironment({
      ...options,
      ...(weatherState ? { weather: weatherState } : {}),
      ...(isDay == null ? {} : { isDay }),
    });
  }

  function augmentRuntime(runtime = {}) {
    if (!runtime || typeof runtime !== "object") return runtime;
    if (runtime.environment) return runtime;
    const resolved = currentEnvironment(overridesFromRuntime(runtime));
    if (resolved) runtime.environment = resolved;
    return runtime;
  }

  function wrapTheatreCheck(source, payload = {}) {
    const character = payload.character || {};
    const traits = payload.traits || [];
    const state = payload.state || source.createState();
    const runtime = augmentRuntime({
      context: "theatre",
      character,
      self: character,
      check: Object.assign({ difficulty: 0, abilityPower: 0, finalPower: 0 }, clone(payload.check || {})),
      ...(payload.environment ? { environment: clone(payload.environment) } : {}),
      ...(payload.environmentContext ? { environmentContext: clone(payload.environmentContext) } : {}),
      ...(payload.encounterType !== undefined ? { encounterType: payload.encounterType } : {}),
      ...(payload.exposure !== undefined ? { exposure: payload.exposure } : {}),
      ...(payload.water !== undefined ? { water: clone(payload.water) } : {}),
    });
    source.dispatchTraits(traits, "passive", runtime, state);
    const result = source.dispatchTraits(traits, "before_check", runtime, state);
    return { check: runtime.check, state: result.state, outcomes: result.outcomes };
  }

  function installTraitBridge() {
    const source = global.LuminousTraitEngine;
    if (!source || source.__environmentRuntimeBridge) return Boolean(source);
    if (source === bridgedSource) return true;

    const wrapped = Object.freeze({
      ...source,
      __environmentRuntimeBridge: true,
      dispatchTrait(input, trigger, runtime = {}, state) {
        return source.dispatchTrait(input, trigger, augmentRuntime(runtime), state);
      },
      dispatchTraits(traits, trigger, runtime = {}, state) {
        return source.dispatchTraits(traits, trigger, augmentRuntime(runtime), state);
      },
      canActivateTrait(input, runtime = {}, state) {
        return source.canActivateTrait(input, augmentRuntime(runtime), state);
      },
      activateTrait(input, runtime = {}, state) {
        return source.activateTrait(input, augmentRuntime(runtime), state);
      },
      listAvailableTraitActions(traits, runtime = {}, state) {
        return source.listAvailableTraitActions(traits, augmentRuntime(runtime), state);
      },
      resolveTheatreCheck(payload = {}) {
        return wrapTheatreCheck(source, payload);
      },
      dispatchCombatEvent(trigger, payload = {}) {
        const next = { ...payload };
        if (!next.environment) {
          const resolved = currentEnvironment(overridesFromRuntime(next));
          if (resolved) next.environment = resolved;
        }
        return source.dispatchCombatEvent(trigger, next);
      },
    });

    bridgedSource = source;
    global.LuminousTraitEngine = wrapped;
    return true;
  }

  const api = Object.freeze({
    currentEnvironment,
    augmentRuntime,
    installTraitBridge,
  });

  global.LuminousEnvironmentRuntime = api;

  if (!installTraitBridge() && global.document) {
    let attempts = 0;
    const timer = global.setInterval(() => {
      attempts += 1;
      if (installTraitBridge() || attempts >= 100) global.clearInterval(timer);
    }, 50);
  }

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
