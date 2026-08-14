(function () {
  "use strict";
  document.addEventListener('DOMContentLoaded', () => {
    // 6 & 7. Autenticación y bloqueo
    const auth = window.firebase.auth();
    const db = window.firebase.database();

        // Auth Guard
    auth.onAuthStateChanged((user) => {
      const authBlocker = document.getElementById("auth-blocker");
      if (!user) {
          if (authBlocker) authBlocker.style.display = 'flex';
          return;
      }

      db.ref("campaña/config/dm_uid").once("value").then(snap => {
          const expectedUid = snap.val() || 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';
          if (user.uid !== expectedUid) {
              if (authBlocker) authBlocker.style.display = 'flex';
              return;
          }

          if (authBlocker) authBlocker.style.display = 'none';
          initializeDashboard(db);
      }).catch(err => {
          console.error("Error verificando UID:", err);
          if (authBlocker) authBlocker.style.display = 'flex';
      });
    });

    function initializeDashboard(db) {
        const SCENE_ROOT = "campaña/estado_mundo/escena_actual";
        const DIALOGUE_ROOT = "campaña/estado_mundo/dialogo_activo";

        window.LuminousInstanceControl.bindDashboard({ db });

        const status = document.getElementById("connection-status");
        if (status) {
          db.ref(".info/connected").on("value", (snapshot) => {
            const online = snapshot.val() === true;
            status.textContent = online ? "● SINCRONIZADO" : "● SIN CONEXIÓN";
            status.classList.toggle("offline", !online);
          });
        } else {
            console.warn("ADVERTENCIA: No se encontró #connection-status");
        }

        const btnUpdateScene = document.getElementById("btn-update-scene");
        if (btnUpdateScene) {
          btnUpdateScene.addEventListener("click", () => {
            const bgInput = document.getElementById("theatre-background-input");
            const locInput = document.getElementById("theatre-location-input");

            if (bgInput && locInput) {
                db.ref(SCENE_ROOT).update({
                  fondo: bgInput.value.trim(),
                  locacion: locInput.value.trim(),
                  escenarioId: null
                });
            }
          });
        }

        // --- BIBLIOTECA DE ESCENARIOS ---
        const SCENARIOS_ROOT = "campaña/escenarios";
        let scenariosDatabase = {};

        const scenarioSelect = document.getElementById("theatre-scenario-select");
        const locationFilter = document.getElementById("theatre-scenario-location-filter");
        const tagFilter = document.getElementById("theatre-scenario-tag-filter");

        const scenarioNameInput = document.getElementById("theatre-scenario-name");
        const bgInput = document.getElementById("theatre-background-input");
        const locInput = document.getElementById("theatre-location-input");
        const tagsInput = document.getElementById("theatre-scenario-tags");

        const btnSaveScenario = document.getElementById("btn-save-scenario");
        const btnUseScenario = document.getElementById("btn-use-scenario");
        const btnDeleteScenario = document.getElementById("btn-delete-scenario");

        function renderScenarioSelect() {
            if (!scenarioSelect) return;

            const currentVal = scenarioSelect.value;
            scenarioSelect.innerHTML = '<option value="">Selecciona un escenario guardado...</option>';

            const locVal = locationFilter ? locationFilter.value : "";
            const tagVal = tagFilter ? tagFilter.value.toLowerCase().trim() : "";

            const locations = new Set();

            for (const [scenarioId, data] of Object.entries(scenariosDatabase)) {
                if (data.locacion) locations.add(data.locacion);

                if (locVal && data.locacion !== locVal) continue;
                if (tagVal) {
                    const match = data.sub_etiquetas && data.sub_etiquetas.some(t => t.toLowerCase().includes(tagVal));
                    if (!match) continue;
                }

                const opt = document.createElement("option");
                opt.value = scenarioId;

                const tagStr = data.sub_etiquetas ? `[${data.sub_etiquetas.join(', ')}]` : "[]";
                opt.textContent = `${data.locacion || 'Sin loc'} · ${data.nombre || 'Sin nombre'} ${tagStr}`;
                scenarioSelect.appendChild(opt);
            }

            if (locationFilter) {
                const curLoc = locationFilter.value;
                locationFilter.innerHTML = '<option value="">Todas las localizaciones</option>';
                const sortedLocs = Array.from(locations).sort();
                for (const loc of sortedLocs) {
                    const opt = document.createElement("option");
                    opt.value = loc;
                    opt.textContent = loc;
                    locationFilter.appendChild(opt);
                }
                locationFilter.value = curLoc;
            }

            if (scenariosDatabase[currentVal]) {
                scenarioSelect.value = currentVal;
            }
        }

        db.ref(SCENARIOS_ROOT).on("value", snapshot => {
            scenariosDatabase = snapshot.val() || {};
            renderScenarioSelect();
        });

        if (locationFilter) locationFilter.addEventListener("change", renderScenarioSelect);
        if (tagFilter) tagFilter.addEventListener("keyup", renderScenarioSelect);

        if (scenarioSelect) {
            scenarioSelect.addEventListener("change", (e) => {
                const scenarioId = e.target.value;
                if (!scenarioId || !scenariosDatabase[scenarioId]) {
                    scenarioNameInput.value = "";
                    bgInput.value = "";
                    locInput.value = "";
                    tagsInput.value = "";
                    return;
                }
                const data = scenariosDatabase[scenarioId];
                scenarioNameInput.value = data.nombre || "";
                bgInput.value = data.fondo || "";
                locInput.value = data.locacion || "";
                tagsInput.value = data.sub_etiquetas ? data.sub_etiquetas.join(", ") : "";
            });
        }

        if (btnSaveScenario) {
            btnSaveScenario.addEventListener("click", () => {
                const name = scenarioNameInput.value.trim();
                const fondo = bgInput.value.trim();
                const loc = locInput.value.trim();

                if (!name || !fondo || !loc) {
                    alert("Nombre, fondo y localización son obligatorios.");
                    return;
                }

                const tagsRaw = tagsInput.value.split(",");
                const subEtiquetas = [...new Set(tagsRaw.map(t => t.trim().toLowerCase()).filter(t => t !== ""))];

                const scenarioId = scenarioSelect.value || db.ref(SCENARIOS_ROOT).push().key;

                const now = window.firebase.database.ServerValue.TIMESTAMP;
                const data = {
                    nombre: name,
                    fondo: fondo,
                    locacion: loc,
                    sub_etiquetas: subEtiquetas,
                    updatedAt: now
                };

                if (!scenarioSelect.value) {
                    data.createdAt = now;
                }

                db.ref(`${SCENARIOS_ROOT}/${scenarioId}`).update(data).then(() => {
                    alert("Escenario guardado correctamente.");
                    scenarioSelect.value = scenarioId;
                }).catch(err => alert("Error al guardar: " + err));
            });
        }

        if (btnUseScenario) {
            btnUseScenario.addEventListener("click", () => {
                const scenarioId = scenarioSelect.value;
                const fondo = bgInput.value.trim();
                const loc = locInput.value.trim();
                const tagsRaw = tagsInput.value.split(",");
                const subEtiquetas = [...new Set(tagsRaw.map(t => t.trim().toLowerCase()).filter(t => t !== ""))];

                if (!fondo || !loc) {
                    alert("Fondo y localización son obligatorios para usar.");
                    return;
                }

                db.ref(SCENE_ROOT).update({
                    escenarioId: scenarioId || null,
                    fondo: fondo,
                    locacion: loc,
                    sub_etiquetas: subEtiquetas
                }).then(() => {
                    console.log("Escenario aplicado exitosamente");
                }).catch(err => alert("Error aplicando escenario: " + err));
            });
        }

        if (btnDeleteScenario) {
            btnDeleteScenario.addEventListener("click", () => {
                const scenarioId = scenarioSelect.value;
                if (!scenarioId) return;

                if (confirm("¿Estás seguro de que quieres borrar este escenario?")) {
                    db.ref(`${SCENARIOS_ROOT}/${scenarioId}`).remove().then(() => {
                        scenarioSelect.value = "";
                        scenarioNameInput.value = "";
                        bgInput.value = "";
                        locInput.value = "";
                        tagsInput.value = "";
                        alert("Escenario borrado.");
                    }).catch(err => alert("Error al borrar: " + err));
                }
            });
        }


        // --- 4. Sistema de Cola FIFO y Secuenciador ---
        const QUEUE_ROOT = "campaña/teatro/cola";
        const LOG_ROOT = "campaña/teatro/log";

        let isProcessingQueue = false;

                function processQueue() {
            if (isProcessingQueue) return;

            // Check if theatre is active instance
            db.ref("campaña/estado_mundo/instancia_activa").once('value').then(snap => {
                if (snap.val() !== 'teatro') return; // Pause queue if not in theatre

                isProcessingQueue = true;

                // Get oldest message
                db.ref(QUEUE_ROOT).orderByChild("createdAt").limitToFirst(1).once("value").then(queueSnap => {
                    if (!queueSnap.exists()) {
                        isProcessingQueue = false;
                        return; // Empty queue
                    }

                    const msgKey = Object.keys(queueSnap.val())[0];
                    const msgData = queueSnap.val()[msgKey];

                    // Deadlock prevention: If it has been processing for more than 2 minutes, assume the previous DM crashed and claim it anyway.
                    const now = Date.now();
                    const isStuck = msgData.processing && msgData.processingStartedAt && (now - msgData.processingStartedAt > 120000);

                    // Transaction to claim it safely
                    db.ref(`${QUEUE_ROOT}/${msgKey}`).transaction(currentData => {
                        if (currentData && (!currentData.processing || isStuck)) {
                            currentData.processing = true;
                            currentData.processingStartedAt = window.firebase.database.ServerValue.TIMESTAMP;
                            return currentData;
                        }
                        return; // Abort if already processing and not stuck
                    }, (error, committed, snapshot) => {
                        if (!committed) {
                            isProcessingQueue = false;

                            // If it's stuck but transaction failed, wait and retry. Or if someone else took it.
                            setTimeout(processQueue, 1000);
                            return;
                        }

                        const actualData = snapshot.val();

                        // Calculate duration
                        const speedMs = 30; // 30 ms per char
                        const textLength = (actualData.mensaje || "").length;
                        const durationMs = (textLength * speedMs) + 3000; // Text duration + 3 sec pause
                        const startedAt = window.firebase.database.ServerValue.TIMESTAMP;

                        // Broadcast to active dialogue
                        const activePayload = {
                            messageId: msgKey,
                            nombre: actualData.nombre || "",
                            titulo: actualData.titulo || "",
                            mensaje: actualData.mensaje || "",
                            actorId: actualData.actorId || null,
                            expression: actualData.expression || "Neutral",
                            sprite: actualData.sprite || null,
                            color_nombre: actualData.color_nombre || "#ffffff",
                            color_titulo: actualData.color_titulo || "#aaaaaa",
                            startedAt: startedAt,
                            speedMs: speedMs,
                            durationMs: durationMs
                        };

                                                db.ref(DIALOGUE_ROOT).set(activePayload).then(() => {
                            // Wait exact duration
                            setTimeout(() => {
                                // Archive to Log
                                db.ref(`${LOG_ROOT}/${msgKey}`).set(activePayload).then(() => {
                                    // Remove from queue
                                    db.ref(`${QUEUE_ROOT}/${msgKey}`).remove().then(() => {
                                        isProcessingQueue = false;
                                        processQueue(); // Check for next
                                    });
                                }).catch(err => {
                                    console.error("Error archivando en log:", err);
                                    isProcessingQueue = false;
                                    processQueue();
                                });
                            }, (textLength * speedMs) + 3000); // We simulate the wait client-side for the sequencer
                        }).catch(err => {
                            console.error("Error publicando diálogo activo:", err);
                            // Desmarcar para que no se quede atascado o ignorarlo si hay un problema de permisos
                            // If we can't publish, we might want to just skip or log.
                            // Let's remove from queue so it's not a permanent blocker
                            db.ref(`${QUEUE_ROOT}/${msgKey}`).remove().finally(() => {
                                isProcessingQueue = false;
                                processQueue();
                            });
                        });
                    });
                });
            });
        }

        // Listen to queue changes to trigger processor
        db.ref(QUEUE_ROOT).on("child_added", () => {
            processQueue();
        });

        // Listen to instance changes to resume queue
        db.ref("campaña/estado_mundo/instancia_activa").on("value", (snap) => {
            if (snap.val() === 'teatro') {
                processQueue();
            }
        });

        // Modificamos el envio de diálogo del DM para que vaya a la cola
        const btnSendDialogue = document.getElementById("btn-send-dialogue");
        if (btnSendDialogue) {
          btnSendDialogue.addEventListener("click", () => {
            const dialogueInput = document.getElementById("theatre-dialogue-input");
            if (!dialogueInput) return;

            const texto = dialogueInput.value.trim();
            if (!texto) return;

            const speakerSelect = document.getElementById("theatre-speaker-select");
            const expressionSelect = document.getElementById("theatre-expression-select");

            let speakerData = {
                nombre: "NARRADOR",
                titulo: "",
                actorId: null,
                expression: "Neutral",
                sprite: null,
                color_nombre: "#ffffff",
                color_titulo: "#aaaaaa"
            };

            if (speakerSelect && speakerSelect.value !== "narrador") {
                const selectedOption = speakerSelect.options[speakerSelect.selectedIndex];
                speakerData.nombre = selectedOption.dataset.nombre || "";
                speakerData.titulo = selectedOption.dataset.titulo || "";
                speakerData.actorId = speakerSelect.value;
                speakerData.color_nombre = selectedOption.dataset.colorNombre || "#ffffff";
                speakerData.color_titulo = selectedOption.dataset.colorTitulo || "#aaaaaa";

                if (expressionSelect) {
                    speakerData.expression = expressionSelect.value;
                    const expOpt = expressionSelect.options[expressionSelect.selectedIndex];
                    speakerData.sprite = expOpt ? expOpt.dataset.sprite : null;
                }
            }

            const msgKey = db.ref(QUEUE_ROOT).push().key;
            db.ref(`${QUEUE_ROOT}/${msgKey}`).set({
              mensaje: texto,
              nombre: speakerData.nombre,
              titulo: speakerData.titulo,
              actorId: speakerData.actorId,
              expression: speakerData.expression,
              sprite: speakerData.sprite,
              color_nombre: speakerData.color_nombre,
              color_titulo: speakerData.color_titulo,
              createdAt: window.firebase.database.ServerValue.TIMESTAMP
            });
            dialogueInput.value = "";
          });
        }

        // Listen to live actors to update speaker select
        db.ref(SCENE_ROOT + "/actores").on("value", (snapshot) => {
            const speakerSelect = document.getElementById("theatre-speaker-select");
            const expressionSelect = document.getElementById("theatre-expression-select");
            if (!speakerSelect) return;

            const currentSelection = speakerSelect.value;
            speakerSelect.innerHTML = '<option value="narrador">Narrador</option>';

            const actors = snapshot.val() || {};
            for (const [actorId, actorData] of Object.entries(actors)) {
                const opt = document.createElement("option");
                opt.value = actorId;
                opt.textContent = actorData.nombre;
                opt.dataset.nombre = actorData.nombre;
                opt.dataset.titulo = actorData.titulo || "";
                opt.dataset.colorNombre = actorData.color_nombre || "#ffffff";
                opt.dataset.colorTitulo = actorData.color_titulo || "#aaaaaa";

                // Store expressions as a JSON string for easy retrieval
                opt.dataset.expresiones = JSON.stringify(actorData.expresiones || {});

                speakerSelect.appendChild(opt);
            }

            // Try to restore previous selection
            if (currentSelection && currentSelection !== "narrador" && actors[currentSelection]) {
                speakerSelect.value = currentSelection;
            } else {
                speakerSelect.value = "narrador";
            }

            // Manually trigger change to update expression select
            speakerSelect.dispatchEvent(new Event('change'));
        });

        // Update expression select when speaker changes
        const speakerSelect = document.getElementById("theatre-speaker-select");
        if (speakerSelect) {
            speakerSelect.addEventListener("change", (e) => {
                const expressionSelect = document.getElementById("theatre-expression-select");
                if (!expressionSelect) return;

                expressionSelect.innerHTML = "";

                if (e.target.value === "narrador") {
                    const opt = document.createElement("option");
                    opt.value = "Neutral";
                    opt.textContent = "Neutral";
                    expressionSelect.appendChild(opt);
                    return;
                }

                const selectedOption = e.target.options[e.target.selectedIndex];
                let expresiones = {};
                try {
                    expresiones = JSON.parse(selectedOption.dataset.expresiones || "{}");
                } catch (err) {}

                if (Object.keys(expresiones).length === 0) {
                    const opt = document.createElement("option");
                    opt.value = "Neutral";
                    opt.textContent = "Neutral";
                    expressionSelect.appendChild(opt);
                } else {
                    for (const [exp, spriteUrl] of Object.entries(expresiones)) {
                        const opt = document.createElement("option");
                        opt.value = exp;
                        opt.textContent = exp;
                        opt.dataset.sprite = spriteUrl;
                        expressionSelect.appendChild(opt);
                    }
                }
            });
        }
const btnTriggerCombat = document.getElementById("btn-trigger-combat");
        if (btnTriggerCombat) {
          btnTriggerCombat.addEventListener("click", () => {
            db.ref("campaña/estado_mundo/instancia_activa").set("combate");
            db.ref("campaña/combate").update({ estado: "COMBAT_ACTIVE", startedAt: window.firebase.database.ServerValue.TIMESTAMP });
          });
        }
    }
  });
})();