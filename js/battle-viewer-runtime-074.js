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

  const bootstrapScripts = [
    ["content-registry-script", "js/content-registry.js", "LuminousContentRegistry"],
    ["content-registry-bootstrap-script", "js/content-registry-bootstrap.js", "LuminousContentRegistryBootstrap"],
    ["spellcasting-runtime-script", "js/spellcasting-runtime.js", "LuminousSpellcastingRuntime"],
  ];

  const runtimeScripts = [
    ["battle-viewer-firebase-session-074-script", "js/battle-viewer-firebase-session-074.js", "LuminousBattleViewerFirebaseSession074"],
    ["combat-skill-schema-script", "js/combat-skill-schema.js", "CombatSkillSchema"],
    ["combat-skill-loadout-074-script", "js/combat-skill-loadout-074.js", "LuminousCombatSkillLoadout074"],
    ["combat-spell-loadout-074-script", "js/combat-spell-loadout-074.js", "LuminousCombatSpellLoadout074"],
    ["rupture-status-runtime-script", "js/status-rupture-runtime.js", "LuminousRuptureStatusRuntime"],
    ["skill-forge-g2-script", "js/skill-forge-g2.js", "LuminousSkillForgeG2"],
    ["battle-viewer-runtime-073-script", "js/battle-viewer-runtime-073.js", "LuminousBattleViewerRuntime073"],
    ["battle-viewer-spell-adapter-074-script", "js/battle-viewer-spell-adapter-074.js", "LuminousBattleViewerSpellAdapter074"],
    ["battle-viewer-spell-runtime-074-script", "js/battle-viewer-spell-runtime-074.js", "LuminousBattleViewerSpellRuntime074"],
    ["vtt-actor-library-script", "js/vtt/actor-library.js", "LuminousVttActorLibrary"],
    ["battle-viewer-ownership-074-script", "js/battle-viewer-ownership-074.js", "LuminousBattleViewerOwnership074"],
    ["battle-viewer-player-skill-planner-074-script", "js/battle-viewer-player-skill-planner-074.js", "LuminousBattleViewerPlayerSkillPlanner074"],
    ["battle-viewer-player-spell-planner-074-script", "js/battle-viewer-player-spell-planner-074.js", "LuminousBattleViewerPlayerSpellPlanner074"],
    ["battle-viewer-dm-console-074-script", "js/battle-viewer-dm-console-074.js", "LuminousBattleViewerDmConsole074"],
    ["battle-viewer-player-entry-074-script", "js/battle-viewer-player-entry-074.js", "LuminousBattleViewerPlayerEntry074"],
    ["battle-viewer-dm-console-074-magic-script", "js/battle-viewer-dm-console-074-magic.js", "LuminousBattleViewerDmMagic074"],
  ];

  function waitForReady(isReady, valueGetter = null, timeoutMs = WAIT_TIMEOUT_MS) {
    try {
      if (isReady()) return Promise.resolve(valueGetter ? valueGetter() : true);
    } catch (_) {}
    if (typeof global.setInterval !== "function") return Promise.resolve(null);
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const timer = global.setInterval(() => {
        let ready = false;
        try { ready = Boolean(isReady()); } catch (_) {}
        if (ready) {
          global.clearInterval(timer);
          resolve(valueGetter ? valueGetter() : true);
          return;
        }
        if (Date.now() - startedAt >= timeoutMs) {
          global.clearInterval(timer);
          resolve(null);
        }
      }, WAIT_INTERVAL_MS);
    });
  }

  function loadScript(id, src, globalName, readyPredicate = null) {
    const isReady = readyPredicate || (() => Boolean(global[globalName]));
    try { if (isReady()) return Promise.resolve(global[globalName] || true); } catch (_) {}
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
      script.addEventListener("error", () => finish(null), { once: true });
      waitForReady(isReady, () => global[globalName] || true).then(finish);
    });
  }

  function loadSpellcastingBasicRules() {
    return loadScript(
      "spellcasting-basic-rules-runtime-script",
      "js/spellcasting-basic-rules-runtime.js",
      "LuminousSpellcastingRuntime",
      () => Boolean(global.LuminousSpellcastingRuntime?.__basicRulesV1),
    );
  }

  async function loadDependencies() {
    for (const [id, src, name] of bootstrapScripts) await loadScript(id, src, name);
    await loadSpellcastingBasicRules();
    for (const [id, src, name] of runtimeScripts) await loadScript(id, src, name);
  }

  function emitBootstrapError(result = {}) {
    const reason = result.reason || result.error?.code || "FIREBASE_SESSION_FAILED";
    try {
      if (typeof global.addLogEntry === "function") global.addLogEntry(`[ FIREBASE BLOCKED ] ${reason}`, "interrupt");
      else global.console?.error?.(`[BattleViewer074] Firebase preflight blocked multiplayer UI: ${reason}`, result.error || "");
    } catch (_) {}
  }

  function initializeSharedRuntime(parts = {}) {
    parts.skillLoadout?.init?.();
    parts.ruptureStatus?.install?.();
    parts.spellAdapter?.install?.();
    parts.spellRuntime?.install?.();
    parts.ownership?.install?.();
  }

  function initializeConfiguredDmConsole(dmConsole, result = {}) {
    if (!dmConsole) return false;
    const scoped = { db: result.db, auth: result.auth };
    if (!HAS_DOCUMENT || !result?.ok || result.role !== "dm") return dmConsole.init?.(scoped) !== false;

    // The original DM console predates campaña/config/dm_uid and still contains the historical UID.
    // Keep that path untouched for the legacy DM, but trust the Firebase session preflight for a configured DM.
    if (!result.uid || result.uid === dmConsole.DM_UID) return dmConsole.init?.(scoped) !== false;

    const dmState = dmConsole._state;
    if (!dmState || !result.db?.ref) return dmConsole.init?.(scoped) !== false;
    dmState.db = result.db;
    dmState.authorized = true;

    if (!dmState.__configuredDmListenersBound) {
      dmState.__configuredDmListenersBound = true;
      const refresh = () => {
        if (dmState.authorized) dmConsole.mount?.();
      };
      result.db.ref(dmConsole.ROOTS.players).on("value", (snapshot) => {
        dmState.players = snapshot.val() || {};
        refresh();
      });
      result.db.ref(dmConsole.ROOTS.combatants).on("value", (snapshot) => {
        dmState.combatants = snapshot.val() || {};
        if (dmState.selectedUnitId && !dmState.combatants[dmState.selectedUnitId]) dmState.selectedUnitId = null;
        refresh();
      });
    }
    dmConsole.mount?.();
    return true;
  }

  function initializeRoleRuntime(parts = {}, sessionResult = null) {
    const options = sessionResult?.ok ? { db: sessionResult.db, auth: sessionResult.auth } : {};
    if (!HAS_DOCUMENT) {
      parts.playerSkillPlanner?.init?.(options);
      parts.playerSpellPlanner?.init?.(options);
      parts.dmConsole?.init?.(options);
      parts.playerEntry?.init?.(options);
      parts.dmMagic?.install?.();
      return Promise.resolve({ ok: true, role: "test" });
    }

    if (!parts.firebaseSession?.start) {
      parts.playerSkillPlanner?.init?.(options);
      parts.playerSpellPlanner?.init?.(options);
      parts.dmConsole?.init?.(options);
      parts.playerEntry?.init?.(options);
      parts.dmMagic?.install?.();
      return Promise.resolve({ ok: true, role: "legacy" });
    }

    return parts.firebaseSession.start().then((result) => {
      if (!result?.ok) {
        emitBootstrapError(result || {});
        return result || { ok: false, reason: "FIREBASE_SESSION_FAILED" };
      }
      const scoped = { db: result.db, auth: result.auth };
      if (result.role === "player") {
        parts.playerSkillPlanner?.init?.(scoped);
        parts.playerSpellPlanner?.init?.(scoped);
      } else if (result.role === "dm") {
        initializeConfiguredDmConsole(parts.dmConsole, result);
        parts.playerEntry?.init?.(scoped);
        parts.dmMagic?.install?.();
      }
      return result;
    }).catch((error) => {
      const result = { ok: false, reason: "FIREBASE_SESSION_FAILED", error };
      emitBootstrapError(result);
      return result;
    });
  }

  function buildApi() {
    const core = global.LuminousBattleViewerRuntime073 || {};
    const firebaseSession = global.LuminousBattleViewerFirebaseSession074 || null;
    const skillLoadout = global.LuminousCombatSkillLoadout074 || null;
    const spellLoadout = global.LuminousCombatSpellLoadout074 || null;
    const spellAdapter = global.LuminousBattleViewerSpellAdapter074 || null;
    const spellRuntime = global.LuminousBattleViewerSpellRuntime074 || null;
    const ownership = global.LuminousBattleViewerOwnership074 || null;
    const playerSkillPlanner = global.LuminousBattleViewerPlayerSkillPlanner074 || null;
    const playerSpellPlanner = global.LuminousBattleViewerPlayerSpellPlanner074 || null;
    const dmConsole = global.LuminousBattleViewerDmConsole074 || null;
    const playerEntry = global.LuminousBattleViewerPlayerEntry074 || null;
    const dmMagic = global.LuminousBattleViewerDmMagic074 || null;
    const ruptureStatus = global.LuminousRuptureStatusRuntime || null;
    const skillForge = global.LuminousSkillForgeG2 || null;
    const parts = {
      firebaseSession, skillLoadout, spellLoadout, spellAdapter, spellRuntime, ownership,
      playerSkillPlanner, playerSpellPlanner, dmConsole, playerEntry, dmMagic, ruptureStatus, skillForge,
    };
    initializeSharedRuntime(parts);
    const sessionReady = initializeRoleRuntime(parts);
    const api = Object.freeze({
      ...core,
      version: VERSION,
      rulesVersion: core.version || "0.7.3",
      firebaseSession,
      sessionReady,
      skillLoadout,
      spellLoadout,
      spellAdapter,
      spellRuntime,
      ownership,
      playerSkillPlanner,
      playerSpellPlanner,
      dmConsole,
      playerEntry,
      dmMagic,
      ruptureStatus,
      skillForge,
      initializeConfiguredDmConsole,
      install,
    });
    global.LuminousBattleViewerRuntime074 = api;
    return api;
  }

  function readyForBuild() {
    return Boolean(
      global.LuminousContentRegistry
      && global.LuminousContentRegistryBootstrap
      && global.LuminousSpellcastingRuntime?.__basicRulesV1
      && global.LuminousBattleViewerFirebaseSession074
      && global.CombatSkillSchema
      && global.LuminousCombatSkillLoadout074
      && global.LuminousCombatSpellLoadout074
      && global.LuminousRuptureStatusRuntime
      && global.LuminousSkillForgeG2
      && global.LuminousBattleViewerRuntime073
      && global.LuminousBattleViewerSpellAdapter074
      && global.LuminousBattleViewerSpellRuntime074
      && global.LuminousVttActorLibrary
      && global.LuminousBattleViewerOwnership074
      && global.LuminousBattleViewerPlayerSkillPlanner074
      && global.LuminousBattleViewerPlayerSpellPlanner074
      && global.LuminousBattleViewerDmConsole074
      && global.LuminousBattleViewerPlayerEntry074
      && global.LuminousBattleViewerDmMagic074
    );
  }

  function install() {
    if (readyForBuild()) return Promise.resolve(buildApi());
    return loadDependencies().then(() => buildApi());
  }

  if (IS_COMMONJS) {
    try { if (!global.LuminousContentRegistry) require("./content-registry.js"); } catch (_) {}
    try { if (!global.LuminousContentRegistryBootstrap) require("./content-registry-bootstrap.js"); } catch (_) {}
    try { if (!global.LuminousSpellcastingRuntime) require("./spellcasting-runtime.js"); } catch (_) {}
    try { if (!global.LuminousSpellcastingRuntime?.__basicRulesV1) require("./spellcasting-basic-rules-runtime.js"); } catch (_) {}
    try { if (!global.LuminousBattleViewerFirebaseSession074) require("./battle-viewer-firebase-session-074.js"); } catch (_) {}
    try { if (!global.CombatSkillSchema) require("./combat-skill-schema.js"); } catch (_) {}
    try { if (!global.LuminousCombatSkillLoadout074) require("./combat-skill-loadout-074.js"); } catch (_) {}
    try { if (!global.LuminousCombatSpellLoadout074) require("./combat-spell-loadout-074.js"); } catch (_) {}
    try { if (!global.LuminousRuptureStatusRuntime) require("./status-rupture-runtime.js"); } catch (_) {}
    try { if (!global.LuminousSkillForgeG2) require("./skill-forge-g2.js"); } catch (_) {}
    try { if (!global.LuminousBattleViewerRuntime073) require("./battle-viewer-runtime-073.js"); } catch (_) {}
    try { if (!global.LuminousBattleViewerSpellAdapter074) require("./battle-viewer-spell-adapter-074.js"); } catch (_) {}
    try { if (!global.LuminousBattleViewerSpellRuntime074) require("./battle-viewer-spell-runtime-074.js"); } catch (_) {}
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