(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttEnvironmentLightBridge = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
  'use strict';

  function hostWindow(root = browserRoot) {
    if (!root) return null;
    try {
      if (root.parent && root.parent !== root && root.parent.document) return root.parent;
    } catch (_) {}
    return root;
  }

  function createBridge({ mapData, onChanged, root = browserRoot } = {}) {
    if (!mapData) throw new Error('MAP_DATA_REQUIRED');
    const host = hostWindow(root);
    let unsubscribe = null;
    let started = false;
    let resolveQueued = false;

    function resolve() {
      const lighting = root?.LuminousVttLightingEngine || browserRoot?.LuminousVttLightingEngine;
      if (!lighting) return null;
      const weatherEngine = host?.LuminousWeatherEngine || root?.LuminousWeatherEngine;
      const environmentEngine = host?.LuminousEnvironmentEngine || root?.LuminousEnvironmentEngine;
      const weatherState = weatherEngine?.getState?.() || null;
      const calendar = weatherEngine?.getCalendar?.() || {};
      const daylightHours = mapData.lighting?.daylightHours || lighting.DEFAULT_DAYLIGHT_HOURS;
      const overrideLevel = mapData.lighting?.ambientOverride || null;
      const environment = lighting.exteriorEnvironment({
        weatherState,
        calendar,
        environmentEngine,
        daylightHours,
        overrideLevel,
      });
      mapData.lighting ||= {};
      mapData.lighting.environment = environment;
      mapData.lighting.weatherState = weatherState;
      mapData.lighting.calendar = calendar;
      mapData.ambientLight ||= {};
      mapData.ambientLight.level = environment?.state?.light || mapData.ambientLight.level || 'bright';
      if (typeof onChanged === 'function') onChanged(environment);
      return environment;
    }

    function scheduleResolve() {
      if (resolveQueued) return;
      resolveQueued = true;
      const schedule = typeof queueMicrotask === 'function' ? queueMicrotask : (fn) => Promise.resolve().then(fn);
      schedule(() => {
        resolveQueued = false;
        if (started) resolve();
      });
    }

    function start() {
      if (started) return true;
      started = true;
      const weatherEngine = host?.LuminousWeatherEngine || root?.LuminousWeatherEngine;
      if (weatherEngine?.onChange) unsubscribe = weatherEngine.onChange(scheduleResolve);
      scheduleResolve();
      return Boolean(weatherEngine);
    }

    function stop() {
      try { unsubscribe?.(); } catch (_) {}
      unsubscribe = null;
      resolveQueued = false;
      started = false;
    }

    return Object.freeze({ start, stop, resolve, scheduleResolve, getEnvironment: () => mapData.lighting?.environment || null });
  }

  return Object.freeze({ hostWindow, createBridge });
});