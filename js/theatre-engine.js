(function (global) {
    "use strict";

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

            // 3. Sincronización de Diálogos (Motor Typewriter Deterministico)
    let typewriterInterval = null;
    let resizeObserver = null;
    let cachedFullTextLength = 0;

    function resizeFontToFit(textEl) {
        textEl.style.fontSize = ''; // Reset to default
        let size = parseFloat(window.getComputedStyle(textEl).fontSize) || 24;
        let iters = 0;
        while (textEl.scrollHeight > textEl.clientHeight && size > 10 && iters < 15) {
            size -= 1;
            textEl.style.fontSize = size + 'px';
            iters++;
        }
    }

    db.ref(DIALOGUE_ROOT).on("value", (snapshot) => {
        const dialogData = snapshot.val() || {};

        const nameEl = document.getElementById("dialogue-name");
        const titleEl = document.getElementById("dialogue-title");
        const textEl = document.getElementById("dialogue-text");

        const platesContainer = document.querySelector(".theatre-plates-container");
        if (platesContainer) {
            if (!dialogData.nombre || dialogData.nombre.trim() === "") {
                platesContainer.style.display = "none";
            } else {
                platesContainer.style.display = "flex";
            }
        }

        if (nameEl) nameEl.textContent = dialogData.nombre || "";
        if (titleEl) titleEl.textContent = dialogData.titulo || "";

        if (textEl) {
            clearInterval(typewriterInterval);
            if (!dialogData.mensaje) {
                textEl.textContent = "…";
                textEl.style.fontSize = '';
                return;
            }

            const fullText = dialogData.mensaje;
            const startedAt = dialogData.startedAt || Date.now();
            const speed = dialogData.speedMs || 30; // 30ms per char

            if (resizeObserver) resizeObserver.disconnect();

            // Re-eval resize only once using a hidden clone to pre-calculate font size!
            // This prevents layout thrashing during the typewriter effect.
            const clone = textEl.cloneNode(true);
            clone.style.visibility = 'hidden';
            clone.style.position = 'absolute';
            clone.style.width = textEl.clientWidth + 'px';
            clone.style.height = textEl.clientHeight + 'px';
            clone.textContent = fullText;
            textEl.parentNode.appendChild(clone);

            resizeFontToFit(clone);
            const finalSize = clone.style.fontSize;
            clone.remove();

            if(finalSize) {
                textEl.style.fontSize = finalSize;
            } else {
                textEl.style.fontSize = '';
            }

            // Animation loop
            typewriterInterval = setInterval(() => {
                const now = Date.now();
                const elapsed = now - startedAt;
                let charsToShow = Math.floor(elapsed / speed);

                if (charsToShow >= fullText.length) {
                    charsToShow = fullText.length;
                    clearInterval(typewriterInterval);
                }

                if (charsToShow < 0) charsToShow = 0;

                textEl.textContent = fullText.substring(0, charsToShow);
            }, 30);
        }

        const stage = document.getElementById("theatre-stage");
        if (stage) {
            const activeSpriteUrl = dialogData.sprite;
            Array.from(stage.children).forEach((img) => {
                if (activeSpriteUrl && img.src === activeSpriteUrl) {
                    img.style.filter = "brightness(1.1) drop-shadow(0 0 15px rgba(255, 255, 255, 0.2))";
                    img.style.zIndex = "10";
                } else {
                    img.style.filter = "brightness(0.5)";
                    img.style.zIndex = "1";
                }
            });
        }
    });

})(window);