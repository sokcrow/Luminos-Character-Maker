(function (global) {
  "use strict";

  const IS_COMMONJS = typeof module !== "undefined" && Boolean(module.exports) && typeof require === "function";
  const HAS_DOCUMENT = Boolean(global.document);

  if (global.LuminousBattleViewerRuntime074?.version === "0.7.4") {
    if (IS_COMMONJS) module.exports = global.LuminousBattleViewerRuntime074;
    return;
  }

  const VERSION = "0.7.4";
  const WAIT_TIMEOUT_MS = 5000;
  const WAIT_INTERVAL_MS = 25;
  const scripts = [
    ["content-registry-script", "js/content-registry.js", "LuminousContentRegistry"],
    ["content-registry-bootstrap-script", "js/content-registry-bootstrap.js", "LuminousContentRegistryBootstrap"],
    ["spellcasting-runtime-script", "js/spellcasting-runtime.js", "LuminousSpellcastingRuntime"],
    ["spellcasting-basic-rules-runtime-script", "js/spellcasting-basic-rules-runtime.js", "LuminousSpellcastingRuntime"],
    ["combat-skill-schema-script", "js/combat-skill-schema.js", "CombatSkillSchema"],
    ["combat-skill-loadout-074-script", "js/combat-skill-loadout-074.js", "LuminousCombatSkillLoadout074"],
    ["combat-spell-loadout-074-script", "js/combat-spell-loadout-074.js", "LuminousCombatSpellLoadout074"],
    ["rupture-status-runtime-script", "js/status-rupture-runtime.js", "LuminousRuptureStatusRuntime"],
    ["skill-forge-g2-script", "js/skill-forge-g2.js", "LuminousSkillForgeG2"],
    ["battle-viewer-runtime-073-script", "js/battle-viewer-runtime-073.js", "LuminousBattleViewerRuntime073"],
    ["vtt-actor-library-script", "js/vtt/actor-library.js", "LuminousVttActorLibrary"],
    ["battle-viewer-ownership-074-script", "js/battle-viewer-ownership-074.js", "LuminousBattleViewerOwnership074"],
    ["battle-viewer-player-skill-planner-074-script", "js/battle-viewer-player-skill-planner-074.js", "LuminousBattleViewerPlayerSkillPlanner074"],
    ["battle-viewer-player-spell-planner-074-script", "js/battle-viewer-player-spell-planner-074.js", "LuminousBattleViewerPlayerSpellPlanner074"],
    ["battle-viewer-dm-console-074-script", "js/battle-viewer-dm-console-074.js", "LuminousBattleViewerDmConsole074"],
    ["battle-viewer-player-entry-074-script", "js/battle-viewer-player-entry-074.js", "LuminousBattleViewerPlayerEntry074"],
    ["battle-viewer-dm-console-074-magic-script", "js/battle-viewer-dm-console-074-magic.js", "LuminousBattleViewerDmMagic074"],
  ];

  function waitForGlobal(globalName, timeoutMs = WAIT_TIMEOUT_MS) {
    if (global[globalName]) return Promise.resolve(global[globalName]);
    if (typeof global.setInterval !== "function") return Promise.resolve(null);
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const timer = global.setInterval(() => {
        if (global[globalName]) {
          global.clearInterval(timer);
          resolve(global[globalName]);
          return;
        }
        if (Date.now() - startedAt >= timeoutMs) {
          global.clearInterval(timer);
          resolve(null);
        }
      }, WAIT_INTERVAL_MS);
    });
  }

  function loadScript(id, src, globalName) {
    if (global[globalName]) return Promise.resolve(global[globalName]);
    if (!global.document) return Promise.resolve(null);
    let script = global.document.getElementById(id);
    if (!script) {
      script = global.document.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      global.document.head?.appendChild(script);
    }
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value || null);
      };
      if (global[globalName]) return finish(global[globalName]);
      script.addEventListener("error", () => finish(null), { once: true });
      waitForGlobal(globalName).then(finish);
    });
  }

  function buildApi() {
    const core = global.LuminousBattleViewerRuntime073 || {};
    const skillLoadout = global.LuminousCombatSkillLoadout074 || null;
    const spellLoadout = global.LuminousCombatSpellLoadout074 || null;
    const ownership = global.LuminousBattleViewerOwnership074 || null;
    const playerSkillPlanner = global.LuminousBattleViewerPlayerSkillPlanner074 || null;
    const playerSpellPlanner = global.LuminousBattleViewerPlayerSpellPlanner074 || null;
    const dmConsole = global.LuminousBattleViewerDmConsole074 || null;
    const playerEntry = global.LuminousBattleViewerPlayerEntry074 || null;
    const dmMagic = global.LuminousBattleViewerDmMagic074 || null;
    const ruptureStatus = global.LuminousRuptureStatusRuntime || null;
    const skillForge = global.LuminousSkillForgeG2 || null;
    const api = Object.freeze({
      ...core,
      version: VERSION,
      rulesVersion: core.version || "0.7.3",
      skillLoadout,
      spellLoadout,
      ownership,
      playerSkillPlanner,
      playerSpellPlanner,
      dmConsole,
      playerEntry,
      dmMagic,
      ruptureStatus,
      skillForge,
      install,
    });
    global.LuminousBattleViewerRuntime074 = api;
    skillLoadout?.init?.();
    ruptureStatus?.install?.();
    ownership?.install?.();
    playerSkillPlanner?.init?.();
    playerSpellPlanner?.init?.();
    dmConsole?.init?.();
    playerEntry?.init?.();
    dmMagic?.install?.();
    return api;
  }

  function install() {
    if (
      global.LuminousContentRegistry
      && global.LuminousContentRegistryBootstrap
      && global.LuminousSpellcastingRuntime?.__basicRulesV1
      && global.CombatSkillSchema
      && global.LuminousCombatSkillLoadout074
      && global.LuminousCombatSpellLoadout074
      && global.LuminousRuptureStatusRuntime
      && global.LuminousSkillForgeG2
      && global.LuminousBattleViewerRuntime073
      && global.LuminousVttActorLibrary
      && global.LuminousBattleViewerOwnership074
      && global.LuminousBattleViewerPlayerSkillPlanner074
      && global.LuminousBattleViewerPlayerSpellPlanner074
      && global.LuminousBattleViewerDmConsole074
      && global.LuminousBattleViewerPlayerEntry074
      && global.LuminousBattleViewerDmMagic074
    ) return Promise.resolve(buildApi());
    return Promise.all(scripts.map(([id, src, name]) => loadScript(id, src, name))).then(() => buildApi());
  }

  if (IS_COMMONJS) {
    try { if (!global.LuminousContentRegistry) require("./content-registry.js"); } catch (_) {}
    try { if (!global.LuminousContentRegistryBootstrap) require("./content-registry-bootstrap.js"); } catch (_) {}
    try { if (!global.LuminousSpellcastingRuntime) require("./spellcasting-runtime.js"); } catch (_) {}
    try { if (!global.LuminousSpellcastingRuntime?.__basicRulesV1) require("./spellcasting-basic-rules-runtime.js"); } catch (_) {}
    try { if (!global.CombatSkillSchema) require("./combat-skill-schema.js"); } catch (_) {}
    try { if (!global.LuminousCombatSkillLoadout074) require("./combat-skill-loadout-074.js"); } catch (_) {}
    try { if (!global.LuminousCombatSpellLoadout074) require("./combat-spell-loadout-074.js"); } catch (_) {}
    try { if (!global.LuminousRuptureStatusRuntime) require("./status-rupture-runtime.js"); } catch (_) {}
    try { if (!global.LuminousSkillForgeG2) require("./skill-forge-g2.js"); } catch (_) {}
    try { if (!global.LuminousBattleViewerRuntime073) require("./battle-viewer-runtime-073.js"); } catch (_) {}
    try { if (!global.LuminousVttActorLibrary) require("./vtt/actor-library.js"); } catch (_) {}
    try { if (!global.LuminousBattleViewerOwnership074) require("./battle-viewer-ownership-074.js"); } catch (_) {}
    try { if (!global.LuminousBattleViewerPlayerSkillPlanner074) require("./battle-viewer-player-skill-planner-074.js"); } catch (_) {}
    try { if (!global.LuminousBattleViewerPlayerSpellPlanner074) require("./battle-viewer-player-spell-planner-074.js"); } catch (_) {}
    try { if (!global.LuminousBattleViewerDmConsole074) require("./battle-viewer-dm-console-074.js"); } catch (_) {}
    try { if (!global.LuminousBattleViewerPlayerEntry074) require("./battle-viewer-player-entry-074.js"); } catch (_) {}
    try { if (!global.LuminousBattleViewerDmMagic074) require("./battle-viewer-dm-console-074-magic.js"); } catch (_) {}
    const api = buildApi();
    module.exports = api;
  } else if (!HAS_DOCUMENT) {
    buildApi();
  } else {
    install();
    global.addEventListener?.("load", install, { once: true });
  }
})(typeof window !== "undefined" ? window : globalThis);