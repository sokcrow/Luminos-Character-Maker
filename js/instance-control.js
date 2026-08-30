(function (global) {
  "use strict";

  const INSTANCE_PATH = "campaña/estado_mundo/instancia_activa";
  const DEFAULT_THEATRE_SCENE_PATH = "campaña/estado_mundo/escena_actual";
  const PLAYER_MAP_Z_INDEX = "8000";
  const MAP_DIALOGUE_RETRY_MS = 250;
  const MAP_DIALOGUE_STUCK_MS = 120000;
  const COMBAT_RUNTIME_SCRIPTS = Object.freeze([
    ["combat-player-trait-runtime-script", "js/player-trait-runtime.js", "LuminousPlayerTraitRuntime"],
    ["combat-trait-standardization-runtime-script", "js/trait-standardization-runtime.js", "LuminousTraitStandardizationRuntime"],
    ["combat-universal-speed-runtime-script", "js/universal-speed-runtime.js", "LuminousUniversalSpeedRuntime"],
  ]);

  function normalizeInstance(instance) {
    return typeof instance === "string" && instance.trim() ? instance.trim() : "ninguno";
  }

  function applyDmInstance(instance, doc) {
    console.warn("LuminousInstanceControl.applyDmInstance is deprecated. Use applyDashboardInstance.");
    return normalizeInstance(instance);
  }

  function applyDashboardInstance(instance, doc) {
    const documentRef = doc || global.document;
    const activeInstance = instance || "ninguno";
    const radioBtn = documentRef.querySelector(`input[name="instancia"][value="${activeInstance}"]`);
    if (radioBtn) radioBtn.checked = true;

    const statusText = documentRef.getElementById("current-output-status");
    if (statusText) {
      if (activeInstance === "ninguno") {
        statusText.textContent = "SALIDA ACTUAL: PANTALLA NEGRA";
        statusText.style.color = "#c49a00";
      } else if (activeInstance === "teatro") {
        statusText.textContent = "SALIDA ACTUAL: TEATRO / LORE";
        statusText.style.color = "#4CAF50";
      } else if (activeInstance === "mapa") {
        statusText.textContent = "SALIDA ACTUAL: MAPA TÁCTICO";
        statusText.style.color = "#00BCD4";
      } else if (activeInstance === "combate") {
        statusText.textContent = "SALIDA ACTUAL: COMBATE TÁCTICO";
        statusText.style.color = "#F44336";
      }
    }

    documentRef.querySelectorAll(".game-module").forEach((modulo) => {
      modulo.classList.remove("active-module");
      modulo.classList.add("hidden");
    });

    let activeModuleId = "modulo-standby";
    if (activeInstance === "teatro") activeModuleId = "modulo-teatro";
    else if (activeInstance === "mapa") activeModuleId = "modulo-mapa";
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

  function teardownPlayerMapView(mapView) {
    if (!mapView) return false;
    mapView.removeAttribute?.("src");
    if (typeof mapView.remove === "function") mapView.remove();
    else mapView.parentNode?.removeChild?.(mapView);
    return true;
  }

  function applyPlayerMapUiPolicy(mapActive, doc) {
    const documentRef = doc || global.document;
    if (!documentRef) return false;

    const phoneWrapper = documentRef.querySelector?.(".sheet-phone-wrapper") || null;
    if (phoneWrapper) {
      if (mapActive) {
        if (!phoneWrapper.classList?.contains?.("phone-hidden")) {
          phoneWrapper.dataset ||= {};
          phoneWrapper.dataset.mapWasVisible = "true";
          phoneWrapper.classList?.add?.("phone-hidden");
        }
        if (phoneWrapper.style) phoneWrapper.style.zIndex = "10000";
      } else {
        if (phoneWrapper.style) phoneWrapper.style.zIndex = "";
        if (phoneWrapper.dataset?.mapWasVisible === "true") {
          phoneWrapper.classList?.remove?.("phone-hidden");
          delete phoneWrapper.dataset.mapWasVisible;
        }
      }
    }

    const logButtons = [
      documentRef.getElementById("btn-toggle-theatre-log-player"),
      documentRef.getElementById("btn-toggle-theatre-log"),
    ].filter(Boolean);

    logButtons.forEach((button) => {
      button.disabled = Boolean(mapActive);
      button.setAttribute?.("aria-disabled", mapActive ? "true" : "false");
      if (mapActive) button.setAttribute?.("aria-expanded", "false");
    });

    if (mapActive) {
      const logContainer = documentRef.getElementById("theatre-log-container");
      if (logContainer) {
        logContainer.classList?.remove?.("active");
        logContainer.classList?.remove?.("open");
        if (logContainer.style) logContainer.style.display = "none";
        logContainer.setAttribute?.("aria-hidden", "true");
      }
    }

    return Boolean(mapActive);
  }

  function applyPlayerInstance(instance, doc) {
    const documentRef = doc || global.document;
    const activeInstance = normalizeInstance(instance);
    const theatreActive = activeInstance === "teatro";
    const mapActive = activeInstance === "mapa";
    const blackoutActive = activeInstance === "ninguno";
    const theatreView = documentRef.getElementById("theatre-view-player");
    const blackout = documentRef.getElementById("player-instance-blackout");
    let combatView = documentRef.getElementById("player-instance-combat");
    let mapView = documentRef.getElementById("player-instance-map");

    applyPlayerMapUiPolicy(mapActive, documentRef);

    if (!combatView && documentRef.body) {
      combatView = documentRef.createElement("iframe");
      combatView.id = "player-instance-combat";
      combatView.title = "Combate táctico";
      combatView.setAttribute("aria-hidden", "true");
      Object.assign(combatView.style, {
        display: "none", position: "fixed", inset: "0", width: "100vw",
        height: "100vh", border: "0", zIndex: "10000", background: "#000",
      });
      combatView.addEventListener("load", () => {
        ensureCombatTraitRuntime(combatView).catch((error) => {
          console.error("No se pudo cargar el runtime universal de Traits en combate:", error);
        });
      });
      combatView.src = "Battle-viewer.html";
      documentRef.body.appendChild(combatView);
    }

    if (!mapView && documentRef.body && mapActive) {
      mapView = documentRef.createElement("iframe");
      mapView.id = "player-instance-map";
      mapView.title = "Mapa táctico";
      mapView.setAttribute("aria-hidden", "true");
      Object.assign(mapView.style, {
        display: "none", position: "fixed", inset: "0", width: "100vw",
        height: "100vh", border: "0", zIndex: PLAYER_MAP_Z_INDEX, background: "#000",
      });
      mapView.src = "vtt.html";
      documentRef.body.appendChild(mapView);
    }

    if (mapView && !mapActive) {
      teardownPlayerMapView(mapView);
      mapView = null;
    }

    if (combatView?.contentDocument?.readyState === "complete") {
      ensureCombatTraitRuntime(combatView).catch((error) => {
        console.error("No se pudo verificar el runtime universal de Traits en combate:", error);
      });
    }

    if (theatreView) {
      theatreView.style.display = theatreActive ? "flex" : "none";
      theatreView.classList.toggle("theatre-active", theatreActive);
      theatreView.setAttribute("aria-hidden", theatreActive ? "false" : "true");
    }
    if (blackout) {
      blackout.classList.toggle("active", blackoutActive);
      blackout.setAttribute("aria-hidden", blackoutActive ? "false" : "true");
    }
    if (combatView) {
      const combatActive = activeInstance === "combate";
      combatView.style.display = combatActive ? "block" : "none";
      combatView.setAttribute("aria-hidden", combatActive ? "false" : "true");
    }
    if (mapView) {
      mapView.style.display = mapActive ? "block" : "none";
      mapView.setAttribute("aria-hidden", mapActive ? "false" : "true");
    }
    if (documentRef.body) {
      documentRef.body.classList.toggle("player-instance-theatre", theatreActive);
      documentRef.body.classList.toggle("player-instance-map", mapActive);
      documentRef.body.classList.toggle("player-instance-blackout", blackoutActive);
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

  function createMapDialogueQueueProcessor({ db, theatre, setTimer } = {}) {
    const theatreState = theatre || global.LuminousTheatreState;
    const schedule = setTimer || global.setTimeout?.bind(global);
    if (!db || !theatreState?.getPaths || !theatreState?.publishIntervention || !schedule) return null;

    let processing = false;
    let stopped = false;
    let queueRef = null;
    let instanceRef = null;
    let queueListener = null;
    let instanceListener = null;

    const retry = () => {
      if (stopped) return;
      schedule(() => {
        process().catch((error) => console.error("Error procesando diálogo de Modo Mapa:", error));
      }, MAP_DIALOGUE_RETRY_MS);
    };

    const claimQueueItem = (ref) => new Promise((resolve, reject) => {
      ref.transaction((current) => {
        if (!current) return current;
        const now = Date.now();
        const stuck = current.processing && current.processingStartedAt &&
          (now - Number(current.processingStartedAt) > MAP_DIALOGUE_STUCK_MS);
        if (current.processing && !stuck) return;
        current.processing = true;
        current.processingStartedAt = now;
        return current;
      }, (error, committed, snapshot) => {
        if (error) reject(error);
        else resolve(committed ? snapshot.val() : null);
      });
    });

    async function releaseQueueItem(ref) {
      if (typeof ref.update === "function") {
        await ref.update({ processing: null, processingStartedAt: null });
      }
    }

    async function process() {
      if (stopped || processing) return false;

      const activeSnapshot = await db.ref(INSTANCE_PATH).once("value");
      if (normalizeInstance(activeSnapshot.val()) !== "mapa") return false;

      const paths = theatreState.getPaths();
      const nextSnapshot = await db.ref(paths.queue)
        .orderByChild("createdAt")
        .limitToFirst(1)
        .once("value");
      if (!nextSnapshot.exists()) return false;

      const queued = nextSnapshot.val() || {};
      const messageId = Object.keys(queued)[0];
      if (!messageId) return false;

      const messageRef = db.ref(`${paths.queue}/${messageId}`);
      processing = true;

      let claimed;
      try {
        claimed = await claimQueueItem(messageRef);
      } catch (error) {
        processing = false;
        console.error("No se pudo reclamar el diálogo de Modo Mapa:", error);
        retry();
        return false;
      }

      if (!claimed) {
        processing = false;
        retry();
        return false;
      }

      const verifySnapshot = await db.ref(INSTANCE_PATH).once("value");
      if (normalizeInstance(verifySnapshot.val()) !== "mapa") {
        await releaseQueueItem(messageRef).catch(() => {});
        processing = false;
        return false;
      }

      const textLength = String(claimed.mensaje || "").length;
      claimed.speedMs = Math.max(1, Number(claimed.speedMs) || 30);
      claimed.durationMs = Math.max(0, Number(claimed.durationMs) || ((textLength * claimed.speedMs) + 3000));

      const result = await theatreState.publishIntervention(messageId, claimed).catch((error) => {
        console.error("Error publicando diálogo de Modo Mapa:", error);
        return { published: false, reason: "error" };
      });

      if (!result?.published) {
        await messageRef.remove().catch((error) => console.error("No se pudo descartar diálogo inválido de Modo Mapa:", error));
        processing = false;
        retry();
        return false;
      }

      // Map dialogue is transient world chatter. It deliberately never writes to paths.log.
      schedule(async () => {
        try {
          await messageRef.remove();
        } catch (error) {
          console.error("No se pudo finalizar diálogo de Modo Mapa:", error);
        } finally {
          processing = false;
          process().catch((error) => console.error("Error continuando diálogo de Modo Mapa:", error));
        }
      }, claimed.durationMs);

      return true;
    }

    function start() {
      if (stopped || queueRef || instanceRef) return api;
      const paths = theatreState.getPaths();
      queueRef = db.ref(paths.queue);
      instanceRef = db.ref(INSTANCE_PATH);
      queueListener = () => {
        process().catch((error) => console.error("Error iniciando diálogo de Modo Mapa:", error));
      };
      instanceListener = (snapshot) => {
        if (normalizeInstance(snapshot.val()) === "mapa") queueListener();
      };
      queueRef.on("child_added", queueListener);
      instanceRef.on("value", instanceListener);
      return api;
    }

    function stop() {
      stopped = true;
      if (queueRef && queueListener) queueRef.off?.("child_added", queueListener);
      if (instanceRef && instanceListener) instanceRef.off?.("value", instanceListener);
      queueRef = null;
      instanceRef = null;
      queueListener = null;
      instanceListener = null;
      return true;
    }

    const api = Object.freeze({ process, start, stop });
    return api;
  }

  function bindMapDialogueQueue({ db } = {}) {
    const processor = createMapDialogueQueueProcessor({ db });
    processor?.start();
    return processor;
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
    bindMapDialogueQueue({ db });

    documentRef.querySelectorAll('input[name="instancia"]').forEach((radio) => {
      radio.addEventListener("change", (evento) => {
        const nuevaInstancia = evento.target.value;
        instanceRef.set(nuevaInstancia).catch((error) => {
          console.error("Error al transicionar instancia de juego:", error);
        });
        if (nuevaInstancia === "combate") {
          const updates = {};
          updates["campaña/combate/estado"] = "PRE_COMBAT_PLANNING";
          updates["campaña/combate/planningStartedAt"] = global.firebase.database.ServerValue.TIMESTAMP;
          updates["campaña/combate/planningDuration"] = 60;
          db.ref().update(updates);
        }
      });
    });

    instanceRef.on("value", (snapshot) => applyDashboardInstance(snapshot.val(), documentRef));
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
    applyPlayerMapUiPolicy,
    applyDashboardInstance,
    ensureCombatTraitRuntime,
    ensureDmLocationControl,
    ensureTheatreRollVisualizerAssets,
    ensureTheatreCheckCoordinatorAssets,
    ensureTheatreOpposedAssets,
    ensureDashboardCharacterManager,
    ensureDashboardActorStudioAssets,
    createMapDialogueQueueProcessor,
    bindMapDialogueQueue,
    bindDm,
    bindDashboard,
    bindPlayer,
  });
})(window);
