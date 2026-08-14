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
                });
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
                            sprite: actualData.sprite || null,
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
                                });
                            }, (textLength * speedMs) + 3000); // We simulate the wait client-side for the sequencer
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

            const msgKey = db.ref(QUEUE_ROOT).push().key;
            db.ref(`${QUEUE_ROOT}/${msgKey}`).set({
              mensaje: texto,
              nombre: "NARRADOR",
              createdAt: window.firebase.database.ServerValue.TIMESTAMP
            });
            dialogueInput.value = "";
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