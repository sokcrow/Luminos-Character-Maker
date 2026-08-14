(function (global) {
  "use strict";

  const INSTANCE_PATH = "campaña/estado_mundo/instancia_activa";

  function normalizeInstance(instance) {
    return typeof instance === "string" && instance.trim()
      ? instance.trim()
      : "ninguno";
  }

  // Obsoleted - Do not use logic from the old screen
  function applyDmInstance(instance, doc) {
    console.warn("LuminousInstanceControl.applyDmInstance is deprecated. Use applyDashboardInstance.");
    return normalizeInstance(instance);
  }

  function applyDashboardInstance(instance, doc) {
    const documentRef = doc || global.document;
    const activeInstance = instance || 'ninguno';

    const radioBtn = documentRef.querySelector(`input[name="instancia"][value="${activeInstance}"]`);
    if (radioBtn) radioBtn.checked = true;

    // Update Output Indicator text
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

  function bindDashboard({ db, doc } = {}) {
    const documentRef = doc || global.document;
    if (!db || !documentRef) return;
    const instanceRef = db.ref(INSTANCE_PATH);

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
    db.ref(INSTANCE_PATH).on("value", (snapshot) => {
      applyPlayerInstance(snapshot.val(), documentRef);
    });
  }

  global.LuminousInstanceControl = Object.freeze({
    INSTANCE_PATH,
    applyDmInstance,
    applyPlayerInstance,
    applyDashboardInstance,
    bindDm,
    bindDashboard,
    bindPlayer,
  });
})(window);