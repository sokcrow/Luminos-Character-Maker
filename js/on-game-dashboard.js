(function () {
  "use strict";
  const db = window.firebase.database();
  const SCENE_ROOT = "campaña/estado_mundo/escena_actual";
  const DIALOGUE_ROOT = "campaña/estado_mundo/dialogo_activo";

  window.LuminousInstanceControl.bindDashboard({ db });

  const status = document.getElementById("connection-status");
  db.ref(".info/connected").on("value", (snapshot) => {
    const online = snapshot.val() === true;
    status.textContent = online ? "● SINCRONIZADO" : "● SIN CONEXIÓN";
    status.classList.toggle("offline", !online);
  });

  document.getElementById("btn-update-scene").addEventListener("click", () => {
    db.ref(SCENE_ROOT).update({
      fondo: document.getElementById("theatre-background-input").value.trim(),
      locacion: document.getElementById("theatre-location-input").value.trim(),
    });
  });

  document.getElementById("btn-send-dialogue").addEventListener("click", () => {
    const texto = document.getElementById("theatre-dialogue-input").value.trim();
    if (!texto) return;
    db.ref(DIALOGUE_ROOT).update({
      mensaje: texto,
      nombre: "NARRADOR", // Se puede expandir en el futuro
      timestamp: window.firebase.database.ServerValue.TIMESTAMP
    });
    document.getElementById("theatre-dialogue-input").value = "";
  });

  document.getElementById("btn-trigger-combat").addEventListener("click", () => {
    db.ref("campaña/combate").update({ estado: "COMBAT_ACTIVE", startedAt: window.firebase.database.ServerValue.TIMESTAMP });
  });
})();
