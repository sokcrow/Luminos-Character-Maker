(function (global) {
    "use strict";

    document.addEventListener('DOMContentLoaded', () => {
        global.firebase.auth().onAuthStateChanged((user) => {
            if (!user) {
                console.error("CRÍTICO: Usuario no detectado. theatre-engine no arrancará.");
                return;
            }

            const db = global.firebase.database();
            const THEATRE_ROOT = "campaña/estado_mundo/escena_actual";
            const DIALOGUE_ROOT = "campaña/estado_mundo/dialogo_activo";


    // 1. Reactividad de Escenografía (Fondo)
    db.ref(`${THEATRE_ROOT}/fondo`).on("value", (snapshot) => {
        const fondoUrl = snapshot.val();
        const moduleTeatro = document.getElementById("modulo-teatro");
        if (moduleTeatro) {
            moduleTeatro.style.backgroundImage = fondoUrl
                ? `linear-gradient(rgba(0,0,0,.15), rgba(0,0,0,.35)), url("${fondoUrl}")`
                : "none";
        }
    });

    db.ref(`${THEATRE_ROOT}/locacion`).on("value", (snapshot) => {
        const locacion = snapshot.val();
        const locationEl = document.getElementById("theatre-location");
        if (locationEl) {
            locationEl.textContent = locacion || "LOCALIZACIÓN DESCONOCIDA";
        }
    });

    // 2. Motor de Sprites (Actores en Escena)
    db.ref(`${THEATRE_ROOT}/actores`).on("value", (snapshot) => {
        const stage = document.getElementById("theatre-stage");
        if (!stage) return;

        const actoresData = snapshot.val() || {};

        // Track current actors in DOM by data-id
        const currentActors = Array.from(stage.querySelectorAll('.theatre-sprite'));
        const currentActorIds = currentActors.map(img => img.dataset.id);
        const newActorIds = Object.keys(actoresData);

        // Destrucción: Remove actors that are no longer in the JSON
        currentActors.forEach(img => {
            if (!newActorIds.includes(img.dataset.id)) {
                img.remove();
            }
        });

        // Construcción y Actualización Posicional
        newActorIds.forEach(actorId => {
            const data = actoresData[actorId];
            let img = stage.querySelector(`.theatre-sprite[data-id="${actorId}"]`);

            if (!img) {
                // Inyectar nuevo actor al DOM
                img = document.createElement("img");
                img.className = "theatre-sprite";
                img.dataset.id = actorId;
                stage.appendChild(img);
            }

            // Actualizar propiedades
            img.src = data.url || data.sprite || "";
            img.alt = data.nombre || "Actor en escena";

            // Si hay transformaciones, escala u orientación, aplicarlas.
            // Ejemplo: transform: scaleX(-1) translateX(50px)
            let transformStr = "";
            if (data.escala) transformStr += `scale(${data.escala}) `;
            if (data.orientacion === 'flip') transformStr += `scaleX(-1) `;

            // Fix parsing raw numbers to px if necessary
            let xPos = data.x !== undefined ? data.x : 0;
            let yPos = data.y !== undefined ? data.y : 0;
            if (xPos !== 0 || yPos !== 0) {
                let xStr = typeof xPos === 'number' ? `${xPos}px` : xPos;
                let yStr = typeof yPos === 'number' ? `${yPos}px` : yPos;
                transformStr += `translate(${xStr}, ${yStr}) `;
            }

            if (transformStr) {
                img.style.transform = transformStr.trim();
            } else {
                img.style.transform = "none";
            }
        });
    });

    // 3. Sincronización de Diálogos y Logs (Caja Visual Novel)
    db.ref(DIALOGUE_ROOT).on("value", (snapshot) => {
        const dialogData = snapshot.val() || {};

        const nameEl = document.getElementById("dialogue-name");
        const titleEl = document.getElementById("dialogue-title");
        const textEl = document.getElementById("dialogue-text");

        if (nameEl) nameEl.textContent = dialogData.nombre || "NARRADOR";
        if (titleEl) titleEl.textContent = dialogData.titulo || "";
        if (textEl) textEl.textContent = dialogData.mensaje || "…";
    });

        });
    });
})(window);