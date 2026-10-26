(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc?.body?.classList?.contains("on-game-dashboard")) return;
  if (global.LuminousTheatreDirectorMenuGuard) return;

  const ACTOR_STUDIO_SCRIPT_ID = "theatre-actor-studio-script";
  const ACTOR_STUDIO_SRC = "js/theatre-actor-studio.js";
  const LOADER_ID = "theatre-actor-studio-loader";
  const SLOT_ID = "theatre-actor-studio-slot";

  let actorStudioLoading = false;
  let actorStudioLoaded = Boolean(global.LuminousTheatreActorStudio);

  function installContainmentStyle() {
    if (doc.getElementById("theatre-director-menu-guard-style")) return;
    const style = doc.createElement("style");
    style.id = "theatre-director-menu-guard-style";
    style.textContent = `
      .on-game-dashboard #theatre-director-panel > * {
        content-visibility: auto;
        contain-intrinsic-size: auto 160px;
      }
      .on-game-dashboard #live-actors-list {
        contain: layout style;
        content-visibility: auto;
        contain-intrinsic-size: auto 220px;
      }
      .on-game-dashboard #${LOADER_ID} {
        margin: 0 0 14px;
        border: 1px solid #554426;
        background: #090b0e;
        content-visibility: auto;
        contain-intrinsic-size: auto 56px;
      }
      .on-game-dashboard #${LOADER_ID} > summary {
        padding: 10px 12px;
        cursor: pointer;
        color: #d5aa58;
        font: 700 12px "Share Tech Mono", monospace;
        letter-spacing: .05em;
        list-style: none;
      }
      .on-game-dashboard #${LOADER_ID} > summary::-webkit-details-marker { display: none; }
      .on-game-dashboard #${LOADER_ID}[open] > summary { border-bottom: 1px solid #332a1b; }
      .on-game-dashboard #${SLOT_ID} { padding: 10px 0 0; }
      .on-game-dashboard #${SLOT_ID} > #theatre-actor-master-panel {
        content-visibility: auto;
        contain-intrinsic-size: auto 900px;
      }
      .on-game-dashboard #${LOADER_ID}[data-state="loading"] > summary::after {
        content: " · CARGANDO…";
        color: #aaa;
      }
    `;
    doc.head?.appendChild(style);
  }

  function installActorStudioBlocker() {
    if (global.LuminousTheatreActorStudio || doc.getElementById(ACTOR_STUDIO_SCRIPT_ID)) return;
    const blocker = doc.createElement("script");
    blocker.id = ACTOR_STUDIO_SCRIPT_ID;
    blocker.type = "application/x-luminous-deferred";
    blocker.dataset.deferredBy = "theatre-director-menu-guard";
    doc.head?.appendChild(blocker);
  }

  function moveStudioIntoSlot() {
    const slot = doc.getElementById(SLOT_ID);
    const studio = doc.getElementById("theatre-actor-master-panel");
    if (slot && studio && studio.parentElement !== slot) slot.appendChild(studio);
  }

  function loadActorStudio() {
    if (actorStudioLoaded || global.LuminousTheatreActorStudio) {
      actorStudioLoaded = true;
      moveStudioIntoSlot();
      return Promise.resolve(true);
    }
    if (actorStudioLoading) return Promise.resolve(false);
    actorStudioLoading = true;

    const loader = doc.getElementById(LOADER_ID);
    if (loader) loader.dataset.state = "loading";

    const existing = doc.getElementById(ACTOR_STUDIO_SCRIPT_ID);
    if (existing?.dataset?.deferredBy === "theatre-director-menu-guard") existing.remove();

    return new Promise((resolve) => {
      const script = doc.createElement("script");
      script.id = ACTOR_STUDIO_SCRIPT_ID;
      script.src = ACTOR_STUDIO_SRC;
      script.async = false;
      script.dataset.ui = "theatre-actor-studio";
      script.addEventListener("load", () => {
        actorStudioLoading = false;
        actorStudioLoaded = true;
        if (loader) loader.dataset.state = "ready";
        moveStudioIntoSlot();
        resolve(true);
      }, { once: true });
      script.addEventListener("error", () => {
        actorStudioLoading = false;
        if (loader) loader.dataset.state = "error";
        console.error("No se pudo cargar Actor Studio bajo demanda.");
        resolve(false);
      }, { once: true });
      doc.head?.appendChild(script);
    });
  }

  function installLoader() {
    const director = doc.getElementById("theatre-director-panel");
    if (!director || doc.getElementById(LOADER_ID)) return;

    const loader = doc.createElement("details");
    loader.id = LOADER_ID;
    loader.dataset.state = actorStudioLoaded ? "ready" : "idle";

    const summary = doc.createElement("summary");
    summary.textContent = "CONTROL MAESTRO DE ACTORES · CARGAR BAJO DEMANDA";

    const slot = doc.createElement("div");
    slot.id = SLOT_ID;

    loader.append(summary, slot);
    const quickCast = director.querySelector(".npc-spawner-section");
    if (quickCast) director.insertBefore(loader, quickCast);
    else director.appendChild(loader);

    loader.addEventListener("toggle", () => {
      if (!loader.open) return;
      global.requestAnimationFrame?.(() => loadActorStudio());
      if (!global.requestAnimationFrame) loadActorStudio();
    });

    moveStudioIntoSlot();
  }

  function installMenuGuard() {
    installContainmentStyle();
    installActorStudioBlocker();
    installLoader();

    const menu = doc.querySelector("#modulo-teatro > .theatre-dm-menu");
    const panel = doc.getElementById("theatre-director-panel");
    if (!menu || !panel || menu.dataset.guardBound === "true") return;
    menu.dataset.guardBound = "true";

    menu.addEventListener("toggle", () => {
      panel.dataset.menuOpen = menu.open ? "true" : "false";
      if (menu.open) {
        // Give Chrome one paint with the lightweight shell before any optional editor is loaded.
        global.requestAnimationFrame?.(() => {
          panel.scrollTop = Math.max(0, panel.scrollTop || 0);
        });
      }
    });
  }

  installActorStudioBlocker();
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", installMenuGuard, { once: true });
  else installMenuGuard();

  global.LuminousTheatreDirectorMenuGuard = Object.freeze({
    loadActorStudio,
    isActorStudioLoaded: () => actorStudioLoaded || Boolean(global.LuminousTheatreActorStudio),
  });
})(window);
