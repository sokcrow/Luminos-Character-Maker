(function () {
  "use strict";
  document.addEventListener('DOMContentLoaded', () => {
    const db = window.firebase.database();
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

    const btnSendDialogue = document.getElementById("btn-send-dialogue");
    if (btnSendDialogue) {
      btnSendDialogue.addEventListener("click", () => {
        const dialogueInput = document.getElementById("theatre-dialogue-input");
        if (!dialogueInput) return;

        const texto = dialogueInput.value.trim();
        if (!texto) return;
        db.ref(DIALOGUE_ROOT).update({
          mensaje: texto,
          nombre: "NARRADOR", // Se puede expandir en el futuro
          timestamp: window.firebase.database.ServerValue.TIMESTAMP
        });
        dialogueInput.value = "";
      });
    }

    const btnTriggerCombat = document.getElementById("btn-trigger-combat");
    if (btnTriggerCombat) {
      btnTriggerCombat.addEventListener("click", () => {
        db.ref("campaña/combate").update({ estado: "COMBAT_ACTIVE", startedAt: window.firebase.database.ServerValue.TIMESTAMP });
      });
    }
  });
})();
