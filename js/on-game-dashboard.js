(function () {
  "use strict";
  const db = window.firebase.database();
  const theatreRef = db.ref("campaña/teatro");

  window.LuminousInstanceControl.bindDashboard({ db });

  const status = document.getElementById("connection-status");
  db.ref(".info/connected").on("value", (snapshot) => {
    const online = snapshot.val() === true;
    status.textContent = online ? "● SINCRONIZADO" : "● SIN CONEXIÓN";
    status.classList.toggle("offline", !online);
  });

  function renderScene(state) {
    state = state || {};
    const module = document.getElementById("modulo-teatro");
    module.style.backgroundImage = state.fondo ? `linear-gradient(rgba(0,0,0,.15), rgba(0,0,0,.35)), url("${state.fondo}")` : "none";
    document.getElementById("theatre-location").textContent = state.locacion || "LOCALIZACIÓN DESCONOCIDA";
    document.getElementById("dialogue-name").textContent = state.nombre || "NARRADOR";
    document.getElementById("dialogue-title").textContent = state.titulo || "";
    document.getElementById("dialogue-text").textContent = state.mensaje || "…";
    const stage = document.getElementById("theatre-stage");
    stage.replaceChildren();
    const sprites = state.sprites || (state.sprite ? [{
      url: state.sprite,
      nombre: state.nombre,
    }] : []);
    Object.values(sprites).forEach((sprite) => {
      const img = document.createElement("img");
      img.className = "theatre-sprite";
      img.src = sprite.url || sprite.sprite || "";
      img.alt = sprite.nombre || "Actor en escena";
      if (img.src) stage.appendChild(img);
    });
  }

  theatreRef.child("estado_actual").on("value", (snapshot) => renderScene(snapshot.val()));
  theatreRef.child("locacion").on("value", (snapshot) => {
    document.getElementById("theatre-location").textContent = snapshot.val() || "LOCALIZACIÓN DESCONOCIDA";
  });
  theatreRef.child("fondo").on("value", (snapshot) => {
    const value = snapshot.val();
    if (value) document.getElementById("modulo-teatro").style.backgroundImage = `url("${value}")`;
  });

  document.getElementById("btn-update-scene").addEventListener("click", () => {
    theatreRef.update({
      fondo: document.getElementById("theatre-background-input").value.trim(),
      locacion: document.getElementById("theatre-location-input").value.trim(),
    });
  });
  document.getElementById("btn-send-dialogue").addEventListener("click", () => {
    const texto = document.getElementById("theatre-dialogue-input").value.trim();
    if (!texto) return;
    theatreRef.child("estado_actual").update({ mensaje: texto, timestamp: window.firebase.database.ServerValue.TIMESTAMP });
    document.getElementById("theatre-dialogue-input").value = "";
  });
  document.getElementById("btn-trigger-combat").addEventListener("click", () => {
    db.ref("campaña/combate").update({ estado: "COMBAT_ACTIVE", startedAt: window.firebase.database.ServerValue.TIMESTAMP });
  });
})();
