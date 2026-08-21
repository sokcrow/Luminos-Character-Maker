(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc) return;

  const HOST_ID = "dashboard-actores";
  const STUDIO_ID = "character-manager-studio";
  const READY_POLL_MS = 200;
  const MAX_POLLS = 100;

  function ensureStyle(id, href) {
    let link = doc.getElementById(id);
    if (link) return link;
    link = doc.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.ui = "npc-stats";
    doc.head?.appendChild(link);
    return link;
  }

  function ensureScript(id, src) {
    let script = doc.getElementById(id);
    if (script) return script;
    script = doc.createElement("script");
    script.id = id;
    script.src = src;
    script.async = false;
    script.dataset.ui = "npc-stats";
    doc.head?.appendChild(script);
    return script;
  }

  function ensureNpcStatsAssets() {
    ensureStyle("character-manager-npc-stats-stylesheet", "css/character-manager-npc-stats.css");
    ensureScript("npc-stats-engine-script", "js/npc-stats-engine.js");
    ensureScript("character-manager-npc-stats-script", "js/character-manager-npc-stats.js");
  }

  function legacyDmInitializationCompleted() {
    // pantalla_dm.html publica esta caché desde su primer snapshot de jugadores.
    // Ese callback solo puede ejecutarse después de que initializeDMApp haya
    // terminado de registrar los handlers legacy, por lo que es un punto seguro
    // para retirar el DOM anterior sin romper el resto del Panel de DM.
    return typeof global.dbJugadoresCache !== "undefined";
  }

  function takeAuthority() {
    const host = doc.getElementById(HOST_ID);
    const panel = doc.getElementById(STUDIO_ID);
    if (!host || !panel) return false;

    if (host.children.length !== 1 || host.firstElementChild !== panel) {
      host.replaceChildren(panel);
    }

    ensureNpcStatsAssets();
    host.dataset.characterManagerAuthority = "engine";
    if (doc.documentElement) {
      doc.documentElement.dataset.characterManagerAuthority = "engine";
    }

    if (!host.dataset.characterManagerTakeoverAnnounced) {
      host.dataset.characterManagerTakeoverAnnounced = "true";
      global.dispatchEvent?.(new CustomEvent("luminous:character-manager-takeover", {
        detail: { hostId: HOST_ID, studioId: STUDIO_ID },
      }));
    }

    return true;
  }

  function startTakeoverWatch() {
    let polls = 0;

    const attempt = () => {
      polls += 1;
      if (legacyDmInitializationCompleted() && takeAuthority()) return true;
      return false;
    };

    if (attempt()) return;

    const timer = global.setInterval(() => {
      if (attempt() || polls >= MAX_POLLS) {
        global.clearInterval(timer);
      }
    }, READY_POLL_MS);
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", startTakeoverWatch, { once: true });
  } else {
    startTakeoverWatch();
  }
})(window);
