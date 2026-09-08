(function (global) {
  "use strict";

  if (global.LuminousBattleViewerRuntime074?.version === "0.7.4") {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousBattleViewerRuntime074;
    return;
  }

  const VERSION = "0.7.4";
  const scripts = [
    ["battle-viewer-runtime-073-script", "js/battle-viewer-runtime-073.js", "LuminousBattleViewerRuntime073"],
    ["battle-viewer-dm-console-074-script", "js/battle-viewer-dm-console-074.js", "LuminousBattleViewerDmConsole074"],
  ];

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
      if (global[globalName]) return resolve(global[globalName]);
      script.addEventListener("load", () => resolve(global[globalName] || null), { once: true });
      script.addEventListener("error", () => resolve(null), { once: true });
    });
  }

  function buildApi() {
    const core = global.LuminousBattleViewerRuntime073 || {};
    const dmConsole = global.LuminousBattleViewerDmConsole074 || null;
    const api = Object.freeze({
      ...core,
      version: VERSION,
      rulesVersion: core.version || "0.7.3",
      dmConsole,
      install,
    });
    global.LuminousBattleViewerRuntime074 = api;
    dmConsole?.init?.();
    return api;
  }

  function install() {
    if (global.LuminousBattleViewerRuntime073 && global.LuminousBattleViewerDmConsole074) return Promise.resolve(buildApi());
    return Promise.all(scripts.map(([id, src, name]) => loadScript(id, src, name))).then(buildApi);
  }

  if (typeof require === "function" && !global.document) {
    try { if (!global.LuminousBattleViewerRuntime073) require("./battle-viewer-runtime-073.js"); } catch (_) {}
    try { if (!global.LuminousBattleViewerDmConsole074) require("./battle-viewer-dm-console-074.js"); } catch (_) {}
    const api = buildApi();
    if (typeof module !== "undefined" && module.exports) module.exports = api;
  } else {
    install();
    global.addEventListener?.("load", install, { once: true });
  }
})(typeof window !== "undefined" ? window : globalThis);
