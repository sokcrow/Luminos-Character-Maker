(function (global) {
  "use strict";

  const INSTANCE_PATH = "campaña/estado_mundo/instancia_activa";
  const DEFAULT_THEATRE_SCENE_PATH = "campaña/estado_mundo/escena_actual";

  function normalizeInstance(instance) {
    return typeof instance === "string" && instance.trim()
      ? instance.trim()
      : "ninguno";
  }

  function applyDmInstance(instance, doc) {
    console.warn("LuminousInstanceControl.applyDmInstance is deprecated. Use applyDashboardInstance.");
    return normalizeInstance(instance);
  }

  function applyDashboardInstance(instance, doc) {
    const documentRef = doc || global.document;
    const activeInstance = instance || 'ninguno';

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
        } else if (activeInstance === "combate") {
            statusText.textContent = "SALIDA ACTUAL: COMBATE TÁCTICO";
            statusText.style.color = "#F44336";
        }
    }

    documentRef.querySelectorAll('.game-module').forEach((modulo) => {
      modulo.classList.remove('active-module');
      modulo.classList.add('hidden');
    });

    let activeModuleId = 'modulo-standby';
    if (activeInstance === 'teatro') {
        activeModuleId = 'modulo-teatro';
    } else if (activeInstance === 'combate') {
        activeModuleId = 'modulo-combate';
    }

    const activeModule = documentRef.getElementById(activeModuleId);
    if (activeModule) {
        activeModule.classList.remove('hidden');
        activeModule.classList.add('active-module');
    }

    return activeInstance;
  }

  function applyPlayerInstance(instance, doc) {
    const documentRef = doc || global.document;
    const activeInstance = normalizeInstance(instance);
    const theatreActive = activeInstance === "teatro";
    const blackoutActive = activeInstance === "ninguno";

    const theatreView = documentRef.getElementById("theatre-view-player");
    const blackout = documentRef.getElementById("player-instance-blackout");
    let combatView = documentRef.getElementById("player-instance-combat");

    if (!combatView && documentRef.body) {
      combatView = documentRef.createElement("iframe");
      combatView.id = "player-instance-combat";
      combatView.src = "Battle-viewer.html";
      combatView.title = "Combate táctico";
      combatView.setAttribute("aria-hidden", "true");
      Object.assign(combatView.style, {
        display: "none", position: "fixed", inset: "0", width: "100vw",
        height: "100vh", border: "0", zIndex: "10000", background: "#000",
      });
      documentRef.body.appendChild(combatView);
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
    if (documentRef.body) {
      documentRef.body.classList.toggle("player-instance-theatre", theatreActive);
      documentRef.body.classList.toggle("player-instance-blackout", blackoutActive);
    }

    return activeInstance;
  }

  function bindDm({ db, doc } = {}) {
    console.warn("LuminousInstanceControl.bindDm is deprecated. Use bindDashboard.");
  }

  function getTheatreScenePath() {
    return global.LuminousTheatreState?.getPaths?.().scene || DEFAULT_THEATRE_SCENE_PATH;
  }

  function ensureTheatreRollVisualizerAssets(doc) {
    const documentRef = doc || global.document;
    if (!documentRef?.head) return null;
    const hasTheatre = documentRef.getElementById("theatre-view-player") || documentRef.getElementById("modulo-teatro");
    if (!hasTheatre) return null;

    let link = documentRef.getElementById("theatre-roll-visualizer-stylesheet");
    if (!link) {
      link = documentRef.createElement("link");
      link.id = "theatre-roll-visualizer-stylesheet";
      link.rel = "stylesheet";
      link.href = "css/theatre-roll-visualizer.css";
      link.dataset.ui = "theatre-roll-visualizer";
      documentRef.head.appendChild(link);
    }

    let script = documentRef.getElementById("theatre-roll-visualizer-script");
    if (!script) {
      script = documentRef.createElement("script");
      script.id = "theatre-roll-visualizer-script";
      script.src = "js/theatre-roll-visualizer.js";
      script.async = false;
      script.dataset.ui = "theatre-roll-visualizer";
      documentRef.head.appendChild(script);
    }

    return { link, script };
  }

  function ensureTheatreCheckCoordinatorAssets(doc) {
    const documentRef = doc || global.document;
    if (!documentRef?.head) return null;
    const hasTheatre = documentRef.getElementById("theatre-view-player") || documentRef.getElementById("modulo-teatro");
    if (!hasTheatre) return null;

    let link = documentRef.getElementById("theatre-check-coordinator-stylesheet");
    if (!link) {
      link = documentRef.createElement("link");
      link.id = "theatre-check-coordinator-stylesheet";
      link.rel = "stylesheet";
      link.href = "css/theatre-check-coordinator.css";
      link.dataset.ui = "theatre-check-coordinator";
      documentRef.head.appendChild(link);
    }

    let script = documentRef.getElementById("theatre-check-coordinator-script");
    if (!script) {
      script = documentRef.createElement("script");
      script.id = "theatre-check-coordinator-script";
      script.src = "js/theatre-check-coordinator.js";
      script.async = false;
      script.dataset.ui = "theatre-check-coordinator";
      documentRef.head.appendChild(script);
    }

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

    let link = documentRef.getElementById("theatre-actor-studio-stylesheet");
    if (!link) {
      link = documentRef.createElement("link");
      link.id = "theatre-actor-studio-stylesheet";
      link.rel = "stylesheet";
      link.href = "css/theatre-actor-studio.css";
      link.dataset.ui = "theatre-actor-studio";
      documentRef.head?.appendChild(link);
    }

    let script = documentRef.getElementById("theatre-actor-studio-script");
    if (!script) {
      script = documentRef.createElement("script");
      script.id = "theatre-actor-studio-script";
      script.src = "js/theatre-actor-studio.js";
      script.async = false;
      script.dataset.ui = "theatre-actor-studio";
      documentRef.head?.appendChild(script);
    }

    return { link, script };
  }

  function bindDashboard({ db, doc } = {}) {
    const documentRef = doc || global.document;
    if (!db || !documentRef) return;
    const instanceRef = db.ref(INSTANCE_PATH);

    ensureTheatreRollVisualizerAssets(documentRef);
    ensureTheatreCheckCoordinatorAssets(documentRef);
    ensureDashboardCharacterManager({ db, doc: documentRef });
    ensureDashboardActorStudioAssets(documentRef);
    ensureDmLocationControl({ db, doc: documentRef });

    documentRef.querySelectorAll('input[name="instancia"]').forEach(radio => {
        radio.addEventListener('change', (evento) => {
            const nuevaInstancia = evento.target.value;
            instanceRef.set(nuevaInstancia).catch(error => {
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

    instanceRef.on('value', (snapshot) => {
      applyDashboardInstance(snapshot.val(), documentRef);
    });
  }

  function bindPlayer({ db, doc } = {}) {
    const documentRef = doc || global.document;
    if (!db || !documentRef) return;
    ensureTheatreRollVisualizerAssets(documentRef);
    ensureTheatreCheckCoordinatorAssets(documentRef);
    db.ref(INSTANCE_PATH).on("value", (snapshot) => {
      applyPlayerInstance(snapshot.val(), documentRef);
    });
  }

  global.LuminousInstanceControl = Object.freeze({
    INSTANCE_PATH,
    applyDmInstance,
    applyPlayerInstance,
    applyDashboardInstance,
    ensureDmLocationControl,
    ensureTheatreRollVisualizerAssets,
    ensureTheatreCheckCoordinatorAssets,
    ensureDashboardCharacterManager,
    ensureDashboardActorStudioAssets,
    bindDm,
    bindDashboard,
    bindPlayer,
  });
})(window);
