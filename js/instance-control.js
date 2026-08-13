(function (global) {
  "use strict";

  const INSTANCE_PATH = "campaña/estado_mundo/instancia_activa";

  function normalizeInstance(instance) {
    return typeof instance === "string" && instance.trim()
      ? instance.trim()
      : "ninguno";
  }

  function applyDmInstance(instance, doc) {
    const documentRef = doc || global.document;
    const activeInstance = normalizeInstance(instance);
    const theatreActive = activeInstance === "teatro";

    documentRef
      .querySelectorAll(".dm-tabs-nav, .dm-tabs-content")
      .forEach((element) => {
        element.style.display = theatreActive ? "none" : "flex";
        element.setAttribute("aria-hidden", theatreActive ? "true" : "false");
      });

    const theatreView = documentRef.getElementById("theatre-view-dm");
    if (theatreView) {
      theatreView.style.display = theatreActive ? "flex" : "none";
      theatreView.classList.toggle("theatre-active", theatreActive);
      theatreView.setAttribute("aria-hidden", theatreActive ? "false" : "true");
    }

    const targetRadio = Array.from(
      documentRef.querySelectorAll(".instance-radio"),
    ).find((radio) => radio.value === activeInstance);
    if (targetRadio) targetRadio.checked = true;

    return activeInstance;
  }

  function applyPlayerInstance(instance, doc) {
    const documentRef = doc || global.document;
    const activeInstance = normalizeInstance(instance);
    const theatreActive = activeInstance === "teatro";
    const blackoutActive = activeInstance === "ninguno";
    const theatreView = documentRef.getElementById("theatre-view-player");
    const blackout = documentRef.getElementById("player-instance-blackout");

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
      documentRef.body.classList.toggle("player-instance-blackout", blackoutActive);
    }

    return activeInstance;
  }

  function bindDm({ db, doc } = {}) {
    const documentRef = doc || global.document;
    if (!db || !documentRef) return;
    const instanceRef = db.ref(INSTANCE_PATH);

    documentRef.querySelectorAll(".instance-radio").forEach((radio) => {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        applyDmInstance(radio.value, documentRef);
        instanceRef.set(normalizeInstance(radio.value));
      });
    });

    instanceRef.on("value", (snapshot) => {
      applyDmInstance(snapshot.val(), documentRef);
    });

    documentRef.getElementById("btn-exit-theatre")?.addEventListener("click", () => {
      applyDmInstance("ninguno", documentRef);
      instanceRef.set("ninguno");
    });

    documentRef.getElementById("btn-modo-director")?.addEventListener("click", () => {
      const selected = documentRef.querySelector(".instance-radio:checked");
      if (selected?.value === "teatro") {
        applyDmInstance("teatro", documentRef);
      } else {
        global.alert?.("El Teatro no es la instancia activa. Selecciona [ SISTEMA DE LORE / TEATRO ].");
      }
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
    bindDm,
    bindPlayer,
  });
})(window);
