(function (global) {
  "use strict";

  if (global.LuminousWeatherPostMergeHotfix) return;

  const ROOT = "campaña/clima";
  const LEGACY_FORECAST_PATH = "campaña/worldData/weatherForecast";
  const REPAIR_DELAY_MS = 120;

  let db = null;
  let engine = null;
  let unsubscribe = null;
  let legacyForecastHandler = null;
  let initialized = false;
  let repairingPrevious = false;
  let rebuildAfterPreviousRepair = false;
  let repairingForecast = false;
  let forecastRepairTimer = null;

  function normalizeProbability(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  }

  function repairedPreviousState(sourceState) {
    if (!sourceState || typeof sourceState !== "object") return sourceState;
    const current = sourceState.actual?.tipo;
    if (!current || sourceState.anterior) return sourceState;
    return { ...sourceState, anterior: current };
  }

  function legacyForecastFromState(sourceState, sourceEngine) {
    const source = sourceState && typeof sourceState === "object" ? sourceState : {};
    const weatherEngine = sourceEngine || engine;
    const forecast = Array.isArray(source.pronostico) ? source.pronostico.slice(0, 3) : [];
    return forecast.map((entry) => {
      const def = weatherEngine?.getDefinition?.(entry.tipo) || {};
      return {
        clima: def.label || String(entry.tipo || "Soleado"),
        probabilidad: normalizeProbability(entry.probabilidad)
      };
    });
  }

  function normalizeLegacyForecast(raw) {
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : Object.keys(raw).sort().map((key) => raw[key]);
    return list.filter(Boolean).map((entry) => ({
      clima: String(entry.clima || entry.tipo || ""),
      probabilidad: normalizeProbability(entry.probabilidad)
    }));
  }

  function forecastsEqual(left, right) {
    const a = normalizeLegacyForecast(left);
    const b = normalizeLegacyForecast(right);
    if (a.length !== b.length) return false;
    return a.every((entry, index) => (
      entry.clima === b[index].clima
      && Math.abs(entry.probabilidad - b[index].probabilidad) < 0.001
    ));
  }

  async function repairMissingPrevious(state) {
    if (!db || !engine || repairingPrevious || !state?.actual?.tipo || state.anterior) return false;
    repairingPrevious = true;
    rebuildAfterPreviousRepair = true;
    try {
      const repaired = repairedPreviousState(state);
      await db.ref(`${ROOT}/anterior`).set(repaired.anterior);
      return true;
    } catch (error) {
      rebuildAfterPreviousRepair = false;
      console.warn("Weather hotfix: no se pudo reparar el clima anterior inicial.", error);
      return false;
    } finally {
      repairingPrevious = false;
    }
  }

  async function rebuildForecastAfterPreviousRepair(state) {
    if (!rebuildAfterPreviousRepair || !state?.anterior || !engine?.updateEnvironment) return false;
    rebuildAfterPreviousRepair = false;
    try {
      await engine.updateEnvironment({});
      return true;
    } catch (error) {
      console.warn("Weather hotfix: no se pudo recalcular el pronóstico tras reparar anterior.", error);
      return false;
    }
  }

  function scheduleLegacyForecastRepair(rawForecast) {
    if (!db || !engine || repairingForecast) return;
    const state = engine.getState?.();
    if (!state) return;
    const expected = legacyForecastFromState(state, engine);
    if (forecastsEqual(rawForecast, expected)) return;

    if (forecastRepairTimer) global.clearTimeout(forecastRepairTimer);
    forecastRepairTimer = global.setTimeout(async () => {
      forecastRepairTimer = null;
      if (repairingForecast) return;
      const latestState = engine.getState?.();
      if (!latestState) return;
      const latestExpected = legacyForecastFromState(latestState, engine);
      repairingForecast = true;
      try {
        await db.ref(LEGACY_FORECAST_PATH).set(latestExpected);
      } catch (error) {
        console.warn("Weather hotfix: no se pudo resincronizar el forecast legacy.", error);
      } finally {
        global.setTimeout(() => { repairingForecast = false; }, REPAIR_DELAY_MS);
      }
    }, REPAIR_DELAY_MS);
  }

  function handleStateChange(state) {
    if (!state) return;
    if (!state.anterior) {
      repairMissingPrevious(state);
      return;
    }
    rebuildForecastAfterPreviousRepair(state);
  }

  function bind() {
    if (!db || !engine || unsubscribe) return;
    unsubscribe = engine.onChange?.(handleStateChange) || null;
    legacyForecastHandler = (snapshot) => {
      if (repairingForecast) return;
      scheduleLegacyForecastRepair(snapshot.val());
    };
    db.ref(LEGACY_FORECAST_PATH).on("value", legacyForecastHandler);
  }

  function boot() {
    if (initialized) return;
    engine = global.LuminousWeatherEngine;
    if (!engine || engine.readOnly || !global.firebase?.apps?.length || !global.firebase?.database) {
      global.setTimeout(boot, 60);
      return;
    }
    db = global.firebase.database();
    initialized = true;
    bind();
  }

  function destroy() {
    unsubscribe?.();
    unsubscribe = null;
    if (db && legacyForecastHandler) db.ref(LEGACY_FORECAST_PATH).off("value", legacyForecastHandler);
    legacyForecastHandler = null;
    if (forecastRepairTimer) global.clearTimeout(forecastRepairTimer);
    forecastRepairTimer = null;
    initialized = false;
  }

  global.LuminousWeatherPostMergeHotfix = Object.freeze({
    ROOT,
    LEGACY_FORECAST_PATH,
    repairedPreviousState,
    legacyForecastFromState,
    forecastsEqual,
    destroy
  });

  if (global.document) boot();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      repairedPreviousState,
      legacyForecastFromState,
      forecastsEqual,
      normalizeLegacyForecast
    };
  }
})(typeof window !== "undefined" ? window : globalThis);
