(function (global) {
    "use strict";

    const db = global.firebase.database();

    const THEATRE_ROOT = "campaña/estado_mundo/escena_actual";

    function getSafeCssColor(value, fallback) {
        const candidate = typeof value === "string" ? value.trim() : "";

        if (!candidate) {
            return fallback;
        }

        if (global.CSS && typeof global.CSS.supports === "function") {
            return global.CSS.supports("color", candidate)
                ? candidate
                : fallback;
        }

        return /^#[0-9a-f]{3,8}$/i.test(candidate)
            ? candidate
            : fallback;
    }

    function paintIdentityPlate(element, value) {
        if (!element) return;

        const plateColor = getSafeCssColor(value, "#4a4a4a");

        element.style.setProperty("color", "", ""); // Remove hardcoded white, keep default styles for text
        element.style.setProperty(
            "background-color",
            plateColor,
            "important"
        );
        element.style.removeProperty("background"); // Ensure gradient is removed so background-color works
        element.style.setProperty(
            "border-left-color",
            plateColor,
            "important"
        );
    }
    const DIALOGUE_ROOT = "campaña/estado_mundo/dialogo_activo";

        // 1. Reactividad de Escenografía (Fondo)
    db.ref(`${THEATRE_ROOT}/fondo`).on("value", (snapshot) => {
        const fondoUrl = snapshot.val();
        const moduleTeatro = document.getElementById("modulo-teatro") || document.getElementById("theatre-view-player");
        if (moduleTeatro) {
            moduleTeatro.style.backgroundImage = fondoUrl
                ? `linear-gradient(rgba(0,0,0,.15), rgba(0,0,0,.35)), url("${fondoUrl}")`
                : "none";
        }
    });

    // 1.5 Reactividad de Localización
    db.ref(`${THEATRE_ROOT}/locacion`).on("value", (snapshot) => {
        const locacionEl = document.getElementById("theatre-location");
        if (locacionEl) {
            locacionEl.textContent = snapshot.val() || "LOCALIZACIÓN DESCONOCIDA";
        }
    });

    // 2. Motor de Sprites (Actores en Escena)
    db.ref(`${THEATRE_ROOT}/actores`).on("value", (snapshot) => {
        const stage = document.getElementById("theatre-stage");
        if (!stage) return;

        const actoresData = snapshot.val() || {};

        // Enforce max 5 sprites rule
        db.ref("campaña/estado_mundo/escena_actual/actores_visibles").once("value").then(visSnap => {
            const visiblesList = visSnap.val() || [];

            const currentActors = Array.from(stage.querySelectorAll('.theatre-sprite'));

            // Collect actors that have a valid sprite URL
            let renderIds = [];

            // First respect the explicit visibles list if it exists and actors have URLs
            if (visiblesList.length > 0) {
                renderIds = visiblesList.filter(id => actoresData[id] && (actoresData[id].url || actoresData[id].sprite));
            } else {
                // Fallback locally to 5 most recently updated/spoke (but we don't have lastSpokeAt here natively unless updated)
                let validActors = [];
                Object.keys(actoresData).forEach(id => {
                    if (actoresData[id].url || actoresData[id].sprite) {
                        validActors.push({ id, data: actoresData[id] });
                    }
                });
                renderIds = validActors.slice(0, 5).map(a => a.id);
            }

            // Destrucción: Remove actors that are no longer in the renderIds
            currentActors.forEach(img => {
                if (!renderIds.includes(img.dataset.id)) {
                    img.remove();
                }
            });

            // Construcción y Actualización Posicional
            renderIds.forEach(actorId => {
                const data = actoresData[actorId];
                if (!data.url && !data.sprite) return; // double check

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
    });

            // 3. Sincronización de Diálogos (Motor Typewriter Deterministico)
    let typewriterInterval = null;
    let resizeObserver = null;
    let cachedFullTextLength = 0;

    function resizeFontToFit(textEl) {
        textEl.style.fontSize = ''; // Reset to default
        let size = parseFloat(window.getComputedStyle(textEl).fontSize) || 24;
        let iters = 0;
        // Also check if textEl is actually rendered. If it's cloned, make sure clientHeight/scrollHeight are accurate.
        // It relies on the element being in the DOM, which it is.
        while (textEl.scrollHeight > textEl.clientHeight && size > 10 && iters < 15) {
            size -= 1;
            textEl.style.fontSize = `${size}px`;
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
            if (dialogData.mostrar_identidad === false || !dialogData.actorId || !dialogData.nombre || dialogData.nombre.trim() === "") {
                platesContainer.style.display = "none";
            } else {
                platesContainer.style.display = "flex";
            }
        }

        if (nameEl) {
            nameEl.textContent = dialogData.nombre || "";
            paintIdentityPlate(nameEl, dialogData.color_nombre);
        }
        if (titleEl) {
            titleEl.textContent = dialogData.titulo || "";
            paintIdentityPlate(titleEl, dialogData.color_titulo);
        }

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
            const isThought = dialogData.tipo_dialogo === "pensamiento";
            const isNarrator = dialogData.tipo_dialogo === "narracion";
            const activeActorId = dialogData.actorId;
            const activeSpriteUrl = dialogData.sprite;

            Array.from(stage.children).forEach((img) => {
                let isActive = false;

                // Thoughts and narrator don't change the active speaker highlight
                if (!isThought && !isNarrator) {
                    if (activeActorId && img.dataset.id === activeActorId) {
                        isActive = true;
                    } else if (!activeActorId && activeSpriteUrl && img.src === activeSpriteUrl) {
                        // Fallback to old behavior for backwards compatibility if actorId is not set
                        isActive = true;
                    }
                }

                // If it is a thought or narrator, OR there is no active message (dialogData.mensaje is empty)
                // then all sprites should return to normal brightness.
                if (isThought || isNarrator || !dialogData.mensaje) {
                    img.classList.remove("is-speaking", "is-dimmed");
                    img.style.filter = "brightness(1)";
                    img.style.transition = "0.3s";
                    img.style.zIndex = "5"; // Default z-index
                } else {
                    if (isActive) {
                        img.classList.add("is-speaking");
                        img.classList.remove("is-dimmed");
                        img.style.filter = "brightness(1)";
                        img.style.transition = "0.3s";
                        img.style.zIndex = "10";
                        if (activeSpriteUrl) {
                            img.src = activeSpriteUrl;
                        }
                    } else {
                        img.classList.add("is-dimmed");
                        img.classList.remove("is-speaking");
                        img.style.filter = "brightness(0.4)";
                        img.style.transition = "0.3s";
                        img.style.zIndex = "1";
                    }
                }
            });
        }
    });


    // --- LuminousTheatreState ---
    global.LuminousTheatreState = {
        normalizeAssignedActorIds: function(assignedIds) {
            if (!assignedIds) return [];
            if (Array.isArray(assignedIds)) return assignedIds;
            if (typeof assignedIds === 'object') return Object.keys(assignedIds);
            return [assignedIds];
        },

        updateVisibleActors: async function(actorId, actorData) {
            if (!actorId) return;

            const visRef = db.ref(`${THEATRE_ROOT}/actores_visibles`);
            const snapshot = await visRef.once('value');
            let visibles = snapshot.val() || [];

            // If narrator or thoughts (no sprite), don't add to visible
            if (actorData && (!actorData.sprite && !actorData.url)) {
                return;
            }

            // Also check if we just need to reorder
            const index = visibles.indexOf(actorId);
            if (index !== -1) {
                // Remove from current position
                visibles.splice(index, 1);
            }

            // Add to end (most recent)
            visibles.push(actorId);

            // Keep only last 5
            if (visibles.length > 5) {
                // Ensure we only have the most recent 5
                visibles = visibles.slice(visibles.length - 5);
            }

            await visRef.set(visibles);
        }
    };

})(window);