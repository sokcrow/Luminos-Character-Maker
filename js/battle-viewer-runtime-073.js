(function (global) {
  "use strict";
  if (global.LuminousBattleViewerRuntime073) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousBattleViewerRuntime073;
    return;
  }
  const VERSION = "0.7.3";
  const scripts = [
    ["battle-viewer-runtime-073-forecast-script", "js/battle-viewer-runtime-073-forecast.js", "LuminousBattleViewerForecast073"],
    ["battle-viewer-runtime-073-timeline-script", "js/battle-viewer-runtime-073-timeline.js", "LuminousBattleViewerTimeline073"],
  ];
  function loadScript(id, src, globalName) {
    if (global[globalName]) return Promise.resolve(global[globalName]);
    if (!global.document) return Promise.resolve(null);
    let script = global.document.getElementById(id);
    if (!script) { script = global.document.createElement("script"); script.id = id; script.src = src; script.async = false; global.document.head?.appendChild(script); }
    return new Promise((resolve) => { if (global[globalName]) return resolve(global[globalName]); script.addEventListener("load", () => resolve(global[globalName] || null), { once: true }); script.addEventListener("error", () => resolve(null), { once: true }); });
  }
  function buildApi() {
    const forecast = global.LuminousBattleViewerForecast073 || {}, timeline = global.LuminousBattleViewerTimeline073 || {};
    const api = Object.freeze({ version: VERSION, ...forecast, ...timeline, install });
    global.LuminousBattleViewerRuntime073 = api;
    forecast.installClashLevelBridge?.(); timeline.ensureStyle?.(); timeline.ensureModal?.();
    if (typeof global.executeCombatTimeline === "function" && global.executeCombatTimeline !== timeline.executeCombatTimeline) {
      if (!global.__luminousLegacyExecuteCombatTimeline) global.__luminousLegacyExecuteCombatTimeline = global.executeCombatTimeline;
      global.executeCombatTimeline = timeline.executeCombatTimeline;
    }
    return api;
  }
  function install() {
    if (global.LuminousBattleViewerForecast073 && global.LuminousBattleViewerTimeline073) return Promise.resolve(buildApi());
    return Promise.all(scripts.map(([id, src, name]) => loadScript(id, src, name))).then(buildApi);
  }

  const commonJs = typeof module !== "undefined" && module.exports && typeof require === "function";
  if (commonJs) {
    try { if (!global.LuminousBattleViewerForecast073) require("./battle-viewer-runtime-073-forecast.js"); } catch (_) {}
    try { if (!global.LuminousBattleViewerTimeline073) require("./battle-viewer-runtime-073-timeline.js"); } catch (_) {}
    const api = buildApi();
    module.exports = api;
  } else {
    install(); global.addEventListener?.("load", install, { once: true });
  }
})(typeof window !== "undefined" ? window : globalThis);
