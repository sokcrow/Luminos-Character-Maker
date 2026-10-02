(function (global) {
  "use strict";

  const INSTANCE_PATH = "campaña/estado_mundo/instancia_activa";
  const DEFAULT_THEATRE_SCENE_PATH = "campaña/estado_mundo/escena_actual";
  const COMBAT_RUNTIME_SCRIPTS = Object.freeze([
    ["combat-player-trait-runtime-script", "js/player-trait-runtime.js", "LuminousPlayerTraitRuntime"],
    ["combat-trait-standardization-runtime-script", "js/trait-standardization-runtime.js", "LuminousTraitStandardizationRuntime"],
    ["combat-universal-speed-runtime-script", "js/universal-speed-runtime.js", "LuminousUniversalSpeedRuntime"],
  ]);

  function normalizeInstance(instance) {
    const normalized = typeof instance === "string" && instance.trim() ? instance.trim() : "ninguno";
    return normalized === "mapa" ? "ninguno" : normalized;
  }

  function applyDmInstance(instance, doc) {
    console.warn("LuminousInstanceControl.applyDmInstance is deprecated. Use applyDashboardInstance.");
    return applyDashboardInstance(instance, doc);
  }

  function applyDashboardInstance(instance, doc) {
    const documentRef = doc || global.document;
    if (!documentRef) return "ninguno";
    const activeInstance = normalizeInstance(instance);
    const radioBtn = documentRef.querySelector(`input[name="instancia"][value="${activeInstance}"]`);
    if (radioBtn) radioBtn.checked = true;

    const statusText = documentRef.getElementById("current-output-status");
    if (statusText) {
      if (activeInstance === "teatro") {
        statusText.textContent = "SALIDA ACTUAL: TEATRO / LORE";
        statusText.style.color = "#4CAF50";
      } else if (activeInstance === "combate") {
        statusText.textContent = "SALIDA ACTUAL: COMBATE TÁCTICO";
        statusText.style.color = "#F44336";
      } else {
        statusText.textContent = "SALIDA ACTUAL: PANTALLA NEGRA";
        statusText.style.color = "#c49a00";
      }
    }

    documentRef.querySelectorAll(".game-module").forEach((modulo) => {
      modulo.classList.remove("active-module");
      modulo.classList.add("hidden");
    });

    let activeModuleId = "modulo-standby";
    if (activeInstance === "teatro") activeModuleId = "modulo-teatro";
    else if (activeInstance === "combate") activeModuleId = "modulo-combate";

    const activeModule = documentRef.getElementById(activeModuleId);
    if (activeModule) {
      activeModule.classList.remove("hidden");
      activeModule.classList.add("active-module");
    }
    return activeInstance;
  }

  function ensureCombatFrameScript(combatView, id, src, globalName) {
    return new Promise((resolve, reject) => {
      let frameWindow;
      let frameDocument;
      try {
        frameWindow = combatView?.contentWindow;
        frameDocument = combatView?.contentDocument || frameWindow?.document;
      } catch (error) {
        reject(error);
        return;
      }
      if (!frameWindow || !frameDocument?.head) {
        reject(new Error("Combat iframe document is not ready."));
        return;
      }
      if (globalName && frameWindow[globalName]) {
        resolve(frameWindow[globalName]);
        return;
      }
      let script = frameDocument.getElementById(id);
      if (script) {
        const complete = () => resolve(globalName ? frameWindow[globalName] : script);
        if (globalName && frameWindow[globalName]) complete();
        else {
          script.addEventListener("load", complete, { once: true });
          script.addEventListener("error", reject, { once: true });
        }
        return;
      }
      script = frameDocument.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      script.dataset.ui = "combat-trait-runtime";
      script.addEventListener("load", () => resolve(globalName ? frameWindow[globalName] : script), { once: true });
      script.addEventListener("error", reject, { once: true });
      frameDocument.head.appendChild(script);
    });
  }

  function ensureCombatTraitRuntime(combatView) {
    if (!combatView) return Promise.resolve(false);
    let chain = Promise.resolve();
    COMBAT_RUNTIME_SCRIPTS.forEach(([id, src, globalName]) => {
      chain = chain.then(() => ensureCombatFrameScript(combatView, id, src, globalName));
    });
    return chain.then(() => true);
  }

  function cleanupLegacyPlayerMapArtifacts(documentRef) {
    const staleMapView = documentRef.getElementById("player-instance-map");
    if (staleMapView) {
      staleMapView.removeAttribute?.("src");
      staleMapView.remove?.();
    }

    const phoneWrapper = documentRef.querySelector?.(".sheet-phone-wrapper") || null;
    if (phoneWrapper?.dataset?.mapWasVisible === "true") {
      phoneWrapper.classList?.remove?.("phone-hidden");
      delete phoneWrapper.dataset.mapWasVisible;
    }
    if (phoneWrapper?.style) phoneWrapper.style.zIndex = "";

    [
      documentRef.getElementById("btn-toggle-theatre-log-player"),
      documentRef.getElementById("btn-toggle-theatre-log"),
    ].filter(Boolean).forEach((button) => {
      button.disabled = false;
      button.setAttribute?.("aria-disabled", "false");
    });

    documentRef.body?.classList.remove("player-instance-map");
  }

  function createPlayerCombatView(documentRef) {
    if (!documentRef?.body) return null;
    let combatView = documentRef.getElementById("player-instance-combat");
    if (combatView) return combatView;

    combatView = documentRef.createElement("iframe");
    combatView.id = "player-instance-combat";
    combatView.title = "Combate táctico";
    combatView.dataset.battleSrc = "Battle-viewer.html";
    combatView.setAttribute("aria-hidden", "false");
    Object.assign(combatView.style, {
      display: "block", position: "fixed", inset: "0", width: "100vw",
      height: "100vh", border: "0", zIndex: "10000", background: "#000",
    });
    combatView.addEventListener("load", () => {
      const current = String(combatView.getAttribute("src") || "");
      if (!current || current === "about:blank") return;
      ensureCombatTraitRuntime(combatView).catch((error) => {
        console.error("No se pudo cargar el runtime universal de Traits en combate:", error);
      });
    });
    combatView.src = combatView.dataset.battleSrc;
    documentRef.body.appendChild(combatView);
    return combatView;
  }

  function syncPlayerCombatOcclusion(documentRef) {
    const combatView = documentRef?.getElementById?.("player-instance-combat");
    if (!combatView) return false;

    const phoneWrapper = documentRef.querySelector?.(".sheet-phone-wrapper") || null;
    const terminalOpen = Boolean(phoneWrapper && !phoneWrapper.classList?.contains?.("phone-hidden"));
    const combatActive = Boolean(documentRef.body?.classList?.contains?.("player-instance-combat"));
    const shouldShow = combatActive && !terminalOpen && !documentRef.hidden;

    combatView.style.visibility = shouldShow ? "visible" : "hidden";
    combatView.style.pointerEvents = shouldShow ? "auto" : "none";
    combatView.setAttribute("aria-hidden", shouldShow ? "false" : "true");
    combatView.dataset.occludedByTerminal = terminalOpen ? "true" : "false";
    return shouldShow;
  }

  function stopPlayerCombatRuntime(combatView) {
    if (!combatView) return false;
    try {
      const child = combatView.contentWindow;
      child?.LuminousWebGL2Renderer?.setEnabled?.(false);
      child?.LuminousCombatRuntimeHotfix073?.syncLifecycle?.("player-instance-exit");
      child?.LuminousCombatSpeedAuthority073?.stop?.();
      child?.LuminousCombatRemoteIntents073?.stop?.();
      child?.LuminousCombatAuthority073?.stop?.();
      child?.LuminousCombatLiveAdapter073?.stop?.();
    } catch (_) {}
    return true;
  }

  function destroyPlayerCombatView(documentRef) {
    const combatView = documentRef?.getElementById?.("player-instance-combat");
    if (!combatView) return false;
    stopPlayerCombatRuntime(combatView);
    combatView.setAttribute("aria-hidden", "true");
    combatView.style.display = "none";
    try { combatView.src = "about:blank"; } catch (_) {}
    combatView.remove();
    return true;
  }

  function applyPlayerInstance(instance, doc) {
    const documentRef = doc || global.document;
    if (!documentRef) return "ninguno";
    const activeInstance = normalizeInstance(instance);
    const theatreActive = activeInstance === "teatro";
    const combatActive = activeInstance === "combate";
    const blackoutActive = activeInstance === "ninguno";
    const theatreView = documentRef.getElementById("theatre-view-player");
    const blackout = documentRef.getElementById("player-instance-blackout");

    cleanupLegacyPlayerMapArtifacts(documentRef);

    let combatView = documentRef.getElementById("player-instance-combat");
    if (combatActive) {
      combatView = createPlayerCombatView(documentRef);
      if (combatView?.contentDocument?.readyState === "complete") {
        ensureCombatTraitRuntime(combatView).catch((error) => {
          console.error("No se pudo verificar el runtime universal de Traits en combate:", error);
        });
      }
    }
    if (combatView) combatView.style.display = combatActive ? "block" : "none";
    if (!combatActive) destroyPlayerCombatView(documentRef);

    if (theatreView) {
      theatreView.style.display = theatreActive ? "flex" : "none";
      theatreView.classList.toggle("theatre-active", theatreActive);
      theatreView.setAttribute("aria-hidden", theatreActive ? "false" : "true");
    }
    if (blackout) {
      blackout.classList.toggle("active", blackoutActive);
      blackout.setAttribute("aria-hidden", blackoutActive ? "false" : "true");
    }
    if (documentRef.body) {
      documentRef.body.classList.toggle("player-instance-theatre", theatreActive);
      documentRef.body.classList.toggle("player-instance-combat", combatActive);
      documentRef.body.classList.toggle("player-instance-blackout", blackoutActive);
    }
    if (combatActive) syncPlayerCombatOcclusion(documentRef);
    if (global.dispatchEvent && typeof global.CustomEvent === "function") {
      global.dispatchEvent(new global.CustomEvent("luminous:player-instance-changed", {
        detail: { instance: activeInstance, theatreActive, combatActive, blackoutActive },
      }));
    }
    return activeInstance;
  }

  function bindDm() {
    console.warn("LuminousInstanceControl.bindDm is deprecated. Use bindDashboard.");
  }

  function getTheatreScenePath() {
    return global.LuminousTheatreState?.getPaths?.().scene || DEFAULT_THEATRE_SCENE_PATH;
  }

  function hasTheatre(documentRef) {
    return Boolean(documentRef?.getElementById("theatre-view-player") || documentRef?.getElementById("modulo-teatro"));
  }

  function ensureStyle(documentRef, id, href, ui) {
    let link = documentRef.getElementById(id);
    if (!link) {
      link = documentRef.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.ui = ui;
      documentRef.head.appendChild(link);
    }
    return link;
  }

  function ensureScript(documentRef, id, src, ui) {
    let script = documentRef.getElementById(id);
    if (!script) {
      script = documentRef.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      script.dataset.ui = ui;
      documentRef.head.appendChild(script);
    }
    return script;
  }

  function ensureTheatreRollVisualizerAssets(doc) {
    const documentRef = doc || global.document;
    if (!documentRef?.head || !hasTheatre(documentRef)) return null;
    const link = ensureStyle(documentRef, "theatre-roll-visualizer-stylesheet", "css/theatre-roll-visualizer.css", "theatre-roll-visualizer");
    const script = ensureScript(documentRef, "theatre-roll-visualizer-script", "js/theatre-roll-visualizer.js", "theatre-roll-visualizer");
    return { link, script };
  }

  function ensureTheatreCheckCoordinatorAssets(doc) {
    const documentRef = doc || global.document;
    if (!documentRef?.head || !hasTheatre(documentRef)) return null;
    const link = ensureStyle(documentRef, "theatre-check-coordinator-stylesheet", "css/theatre-check-coordinator.css", "theatre-check-coordinator");
    const script = ensureScript(documentRef, "theatre-check-coordinator-script", "js/theatre-check-coordinator.js", "theatre-check-coordinator");
    const retry = ensureScript(documentRef, "theatre-check-retry-watchdog-script", "js/theatre-check-retry-watchdog.js", "theatre-check-coordinator");
    return { link, script, retry };
  }

  function ensureTheatreOpposedAssets(doc) {
    const documentRef = doc || global.document;
    if (!documentRef?.head || !hasTheatre(documentRef)) return null;
    const link = ensureStyle(documentRef, "theatre-opposed-checks-stylesheet", "css/theatre-opposed-checks.css", "theatre-opposed-checks");
    const script = ensureScript(documentRef, "theatre-opposed-checks-script", "js/theatre-opposed-checks.js", "theatre-opposed-checks");
    return { link, script };
  }

  function ensureDmLocationControl({ db, doc } = {}) {
    const documentRef = doc || global.document;
    if (!db || !documentRef?.body?.classList.contains("on-game-dashboard")) return null;
    const locationInput = documentRef.getElementById("theatre-location-input");
    if (!locationInput) return null;
    let button = documentRef.getElementById("btn-update-theatre-location");
    if (button) return button;

    button = documentRef.createElement("button");
    button.id = "btn-update-theatre-location";
    button.type = "button";
    button.className = "btn-action theatre-location-only-btn";
    button.textContent = "ACTUALIZAR LOCALIZACIÓN";
    button.title = "Cambia solo el cartel de localización sin hacer transición ni modificar el fondo";
    button.style.cssText = "padding:8px;background:#1a222c;color:#a37c35;border:1px solid #a37c35;cursor:pointer;width:100%;box-sizing:border-box;";
    locationInput.insertAdjacentElement("afterend", button);

    const updateLocation = async () => {
      const locationName = String(locationInput.value || "").trim();
      if (!locationName) {
        global.alert?.("Escribe una localización antes de actualizarla.");
        return;
      }
      const previousText = button.textContent;
      button.disabled = true;
      button.textContent = "ACTUALIZANDO...";
      try {
        await db.ref(`${getTheatreScenePath()}/locacion`).set(locationName);
        button.textContent = "LOCALIZACIÓN ACTUALIZADA";
        global.setTimeout(() => {
          if (button.isConnected) button.textContent = previousText;
        }, 1200);
      } catch (error) {
        console.error("No se pudo actualizar la localización del Theatre:", error);
        button.textContent = previousText;
        global.alert?.("No se pudo actualizar la localización.");
      } finally {
        button.disabled = false;
      }
    };

    button.addEventListener("click", updateLocation);
    locationInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        updateLocation();
      }
    });
    return button;
  }

  function ensureDashboardCharacterManager({ db, doc } = {}) {
    const documentRef = doc || global.document;
    if (!db || !documentRef?.body?.classList.contains("on-game-dashboard")) return null;
    const initialize = () => {
      try {
        global.LuminousCharacterManager?.init?.({ db });
      } catch (error) {
        console.error("No se pudo inicializar Character Manager en ON GAME:", error);
      }
    };
    let script = documentRef.getElementById("character-manager-engine-script");
    if (script) {
      if (global.LuminousCharacterManager) initialize();
      else script.addEventListener("load", initialize, { once: true });
      return script;
    }
    script = documentRef.createElement("script");
    script.id = "character-manager-engine-script";
    script.src = "js/character-manager-engine.js";
    script.async = false;
    script.dataset.engine = "character-manager";
    script.addEventListener("load", initialize, { once: true });
    documentRef.head?.appendChild(script);
    return script;
  }

  function ensureDashboardActorStudioAssets(doc) {
    const documentRef = doc || global.document;
    if (!documentRef?.body?.classList.contains("on-game-dashboard")) return null;
    const link = ensureStyle(documentRef, "theatre-actor-studio-stylesheet", "css/theatre-actor-studio.css", "theatre-actor-studio");
    const script = ensureScript(documentRef, "theatre-actor-studio-script", "js/theatre-actor-studio.js", "theatre-actor-studio");
    return { link, script };
  }

  function bindDashboard({ db, doc } = {}) {
    const documentRef = doc || global.document;
    if (!db || !documentRef) return;
    const instanceRef = db.ref(INSTANCE_PATH);

    ensureTheatreRollVisualizerAssets(documentRef);
    ensureTheatreCheckCoordinatorAssets(documentRef);
    ensureTheatreOpposedAssets(documentRef);
    ensureDashboardCharacterManager({ db, doc: documentRef });
    ensureDashboardActorStudioAssets(documentRef);
    ensureDmLocationControl({ db, doc: documentRef });

    documentRef.querySelectorAll('input[name="instancia"]').forEach((radio) => {
      radio.addEventListener("change", (evento) => {
        const nuevaInstancia = normalizeInstance(evento.target.value);
        instanceRef.set(nuevaInstancia).catch((error) => {
          console.error("Error al transicionar instancia de juego:", error);
        });
        if (nuevaInstancia === "combate") {
          const stateRef = db.ref("campaña/combate/estado");
          stateRef.once("value").then((snapshot) => {
            if (snapshot.exists()) return;
            return stateRef.set({
              phase: "PRE_COMBAT_PLANNING",
              round: 1,
              updatedAt: global.firebase.database.ServerValue.TIMESTAMP
            }).then(() => db.ref("campaña/combate").update({
              planningStartedAt: global.firebase.database.ServerValue.TIMESTAMP,
              planningDuration: 60
            }));
          }).catch((error) => {
            console.error("No se pudo inicializar el estado de Combat:", error);
          });
        }
      });
    });

    instanceRef.on("value", (snapshot) => {
      const rawInstance = snapshot.val();
      const activeInstance = normalizeInstance(rawInstance);
      applyDashboardInstance(activeInstance, documentRef);
      if (rawInstance === "mapa") {
        instanceRef.set("ninguno").catch((error) => {
          console.error("No se pudo migrar la instancia legacy de mapa táctico:", error);
        });
      }
    });
  }

  function bindPlayer({ db, doc } = {}) {
    const documentRef = doc || global.document;
    if (!db || !documentRef) return;
    ensureTheatreRollVisualizerAssets(documentRef);
    ensureTheatreCheckCoordinatorAssets(documentRef);
    ensureTheatreOpposedAssets(documentRef);
    db.ref(INSTANCE_PATH).on("value", (snapshot) => applyPlayerInstance(snapshot.val(), documentRef));
  }

  global.LuminousInstanceControl = Object.freeze({
    INSTANCE_PATH,
    applyDmInstance,
    applyPlayerInstance,
    applyDashboardInstance,
    createPlayerCombatView,
    syncPlayerCombatOcclusion,
    stopPlayerCombatRuntime,
    destroyPlayerCombatView,
    ensureCombatTraitRuntime,
    ensureDmLocationControl,
    ensureTheatreRollVisualizerAssets,
    ensureTheatreCheckCoordinatorAssets,
    ensureTheatreOpposedAssets,
    ensureDashboardCharacterManager,
    ensureDashboardActorStudioAssets,
    bindDm,
    bindDashboard,
    bindPlayer,
  });
})(window);
