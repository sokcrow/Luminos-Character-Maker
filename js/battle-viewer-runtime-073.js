(function (global) {
  "use strict";
  if (global.LuminousBattleViewerRuntime073) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousBattleViewerRuntime073;
    global.LuminousBattleViewerRuntime073Ready ||= Promise.resolve(global.LuminousBattleViewerRuntime073);
    return;
  }

  const VERSION = "0.7.3";
  const scripts = [
    ["combat-action-schema-script", "js/combat-action-schema.js", "./combat-action-schema.js", "LuminousCombatAction"],
    ["combat-action-queue-script", "js/combat-action-queue.js", "./combat-action-queue.js", "LuminousCombatActionQueue"],
    ["combat-action-engine-bridge-script", "js/combat-action-engine-bridge.js", "./combat-action-engine-bridge.js", "LuminousCombatActionEngineBridge"],
    ["combat-action-resolver-script", "js/combat-action-resolver.js", "./combat-action-resolver.js", "LuminousCombatActionResolver"],
    ["combat-action-adapters-script", "js/combat-action-adapters.js", "./combat-action-adapters.js", "LuminousCombatActionAdapters"],
    ["team-action-economy-script", "js/team-action-economy.js", "./team-action-economy.js", "LuminousTeamActionEconomy"],
    ["combat-runtime-integration-script", "js/combat-runtime-integration.js", "./combat-runtime-integration.js", "LuminousCombatRuntimeIntegration"],
    ["skill-forge-g2-script", "js/skill-forge-g2.js", "./skill-forge-g2.js", "LuminousSkillForgeG2"],
    ["skill-forge-runtime-g2-script", "js/skill-forge-runtime-g2.js", "./skill-forge-runtime-g2.js", "LuminousSkillForgeRuntimeG2"],
    ["battle-viewer-action-adapter-073-script", "js/battle-viewer-action-adapter-073.js", "./battle-viewer-action-adapter-073.js", "LuminousBattleViewerActionAdapter073"],
    ["battle-viewer-runtime-073-forecast-script", "js/battle-viewer-runtime-073-forecast.js", "./battle-viewer-runtime-073-forecast.js", "LuminousBattleViewerForecast073"],
    ["battle-viewer-runtime-073-timeline-script", "js/battle-viewer-runtime-073-timeline.js", "./battle-viewer-runtime-073-timeline.js", "LuminousBattleViewerTimeline073"],
  ];

  function loadScript(id, src, globalName) {
    if (global[globalName]) return Promise.resolve(global[globalName]);
    if (!global.document) return Promise.resolve(null);
    let script = global.document.getElementById(id);
    if (!script) {
      script = global.document.createElement("script");
      script.id = id; script.src = src; script.async = false;
      global.document.head?.appendChild(script);
    }
    return new Promise((resolve) => {
      if (global[globalName]) return resolve(global[globalName]);
      script.addEventListener("load", () => resolve(global[globalName] || null), { once: true });
      script.addEventListener("error", () => resolve(null), { once: true });
    });
  }

  async function loadDependency(row) {
    const [id, browserSrc, moduleSrc, globalName] = row;
    if (global[globalName]) return global[globalName];
    if (global.document) return loadScript(id, browserSrc, globalName);
    try { await import(moduleSrc); } catch (error) {
      if (global.console?.error) global.console.error(`[BattleViewer073] No se pudo cargar ${moduleSrc}`, error);
    }
    return global[globalName] || null;
  }

  async function loadDependencies() {
    const loaded = [];
    for (const row of scripts) loaded.push(await loadDependency(row));
    return loaded;
  }

  function installTimelineAuthority(timeline) {
    if (typeof timeline?.executeCombatTimeline !== "function") return false;
    global.executeCombatTimeline = timeline.executeCombatTimeline;
    try { delete global.__luminousLegacyExecuteCombatTimeline; } catch (_) { global.__luminousLegacyExecuteCombatTimeline = undefined; }
    global.__luminousCombatTimelineAuthority = "v0.7.3-combat-action-runtime";
    return true;
  }

  function buildApi() {
    const forecast = global.LuminousBattleViewerForecast073 || {}, timeline = global.LuminousBattleViewerTimeline073 || {};
    global.LuminousSkillForgeRuntimeG2?.install?.(global.CombatEngine);
    const api = Object.freeze({
      ...forecast,
      ...timeline,
      version: VERSION,
      authority: "combat-action-runtime",
      actionSchema: global.LuminousCombatAction || null,
      actionResolver: global.LuminousCombatActionResolver || null,
      actionRuntime: global.LuminousCombatRuntimeIntegration || null,
      actionAdapter: global.LuminousBattleViewerActionAdapter073 || null,
      skillForge: global.LuminousSkillForgeG2 || null,
      skillForgeRuntime: global.LuminousSkillForgeRuntimeG2 || null,
      install,
    });
    global.LuminousBattleViewerRuntime073 = api;
    forecast.installClashLevelBridge?.();
    timeline.ensureStyle?.(); timeline.ensureModal?.();
    installTimelineAuthority(timeline);
    return api;
  }

  function install() {
    if (global.LuminousBattleViewerTimeline073 && global.LuminousBattleViewerActionAdapter073 && global.LuminousCombatActionResolver && global.LuminousSkillForgeG2 && global.LuminousSkillForgeRuntimeG2) return Promise.resolve(buildApi());
    return loadDependencies().then(buildApi);
  }

  const commonJs = typeof module !== "undefined" && module.exports && typeof require === "function";
  if (commonJs) {
    try { if (!global.LuminousCombatAction) require("./combat-action-schema.js"); } catch (_) {}
    try { if (!global.LuminousCombatActionQueue) require("./combat-action-queue.js"); } catch (_) {}
    try { if (!global.LuminousCombatActionEngineBridge) require("./combat-action-engine-bridge.js"); } catch (_) {}
    try { if (!global.LuminousCombatActionResolver) require("./combat-action-resolver.js"); } catch (_) {}
    try { if (!global.LuminousCombatActionAdapters) require("./combat-action-adapters.js"); } catch (_) {}
    try { if (!global.LuminousTeamActionEconomy) require("./team-action-economy.js"); } catch (_) {}
    try { if (!global.LuminousCombatRuntimeIntegration) require("./combat-runtime-integration.js"); } catch (_) {}
    try { if (!global.LuminousSkillForgeG2) require("./skill-forge-g2.js"); } catch (_) {}
    try { if (!global.LuminousSkillForgeRuntimeG2) require("./skill-forge-runtime-g2.js"); } catch (_) {}
    try { if (!global.LuminousBattleViewerActionAdapter073) require("./battle-viewer-action-adapter-073.js"); } catch (_) {}
    try { if (!global.LuminousBattleViewerForecast073) require("./battle-viewer-runtime-073-forecast.js"); } catch (_) {}
    try { if (!global.LuminousBattleViewerTimeline073) require("./battle-viewer-runtime-073-timeline.js"); } catch (_) {}
    const api = buildApi();
    global.LuminousBattleViewerRuntime073Ready = Promise.resolve(api);
    module.exports = api;
  } else {
    global.LuminousBattleViewerRuntime073Ready = install();
    global.addEventListener?.("load", () => { global.LuminousBattleViewerRuntime073Ready = install(); }, { once: true });
  }
})(typeof window !== "undefined" ? window : globalThis);
