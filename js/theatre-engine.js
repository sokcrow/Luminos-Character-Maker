(function (global) {
    "use strict";

    const db = global.firebase.database();
    const THEATRE_ROOT = "campaña/estado_mundo/escena_actual";
    const DIALOGUE_ROOT = "campaña/estado_mundo/dialogo_activo";
    const DEFAULT_MAX_VISIBLE = 5;
    const LOCAL_SHOW_SELF_KEY = "luminous.theatre.showOwnActor";

    let currentScene = {};
    let currentDialogue = {};
    let typewriterInterval = null;
    let resizeObserver = null;

    function clampVisibleLimit(value) {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed)) return DEFAULT_MAX_VISIBLE;
        return Math.max(1, Math.min(DEFAULT_MAX_VISIBLE, parsed));
    }

    function getVisibleLimit(scene) {
        return clampVisibleLimit(
            scene && (scene.max_actores_visibles ?? scene.maxVisibleActors ?? scene.config?.maxVisibleActors)
        );
    }

    function getSafeCssColor(value, fallback) {
        const candidate = typeof value === "string" ? value.trim() : "";
        if (!candidate) return fallback;
        if (global.CSS && typeof global.CSS.supports === "function") {
            return global.CSS.supports("color", candidate) ? candidate : fallback;
        }
        return /^#[0-9a-f]{3,8}$/i.test(candidate) ? candidate : fallback;
    }

    function paintIdentityPlate(element, value) {
        if (!element) return;
        const plateColor = getSafeCssColor(value, "#4a4a4a");
        element.style.setProperty("color", "", "");
        element.style.setProperty("background-color", plateColor, "important");
        element.style.removeProperty("background");
        element.style.setProperty("border-left-color", plateColor, "important");
    }

    function normalizeIdList(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value.filter(Boolean);
        if (typeof value === "object") {
            return Object.keys(value)
                .sort((a, b) => Number(a) - Number(b))
                .map((key) => value[key])
                .filter(Boolean);
        }
        return [value].filter(Boolean);
    }

    function getAssignedActorId() {
        try {
            const actor = typeof global.getAssignedTheatreActor === "function"
                ? global.getAssignedTheatreActor()
                : null;
            return actor?.actorId || actor?.id || global.assignedActorId || null;
        } catch (error) {
            return global.assignedActorId || null;
        }
    }

    function shouldShowOwnActor() {
        try {
            return global.localStorage?.getItem(LOCAL_SHOW_SELF_KEY) === "true";
        } catch (error) {
            return false;
        }
    }

    function isDmView() {
        return Boolean(document.body?.classList.contains("on-game-dashboard"));
    }

    function isNoActorsMode(scene) {
        return scene?.modo_presentacion === "no-actors" ||
            scene?.presentationMode === "no-actors" ||
            scene?.mostrar_actores === false;
    }

    function getRenderIds(scene) {
        if (isNoActorsMode(scene)) return [];

        const actors = scene?.actores || {};
        const maxVisible = getVisibleLimit(scene);
        const explicitVisible = normalizeIdList(scene?.actores_visibles).slice(-maxVisible);

        // Firebase is authoritative. Missing/empty actores_visibles means no visible sprites;
        // never fabricate a local fallback from the actor pool.
        let ids = explicitVisible.filter((id) => {
            const actor = actors[id];
            return actor && (actor.url || actor.sprite);
        });

        if (!isDmView() && !shouldShowOwnActor()) {
            const ownId = getAssignedActorId();
            if (ownId) ids = ids.filter((id) => id !== ownId);
        }

        return ids;
    }

    function applyStageFocus(stage, dialogData) {
        if (!stage) return;

        const type = dialogData?.tipo_dialogo || "dialogo";
        const isThought = type === "pensamiento";
        const isNarrator = type === "narracion";
        const hasMessage = Boolean(dialogData?.mensaje);
        const activeActorId = dialogData?.actorId || null;
        const activeSpriteUrl = dialogData?.sprite || null;

        Array.from(stage.querySelectorAll(".theatre-sprite")).forEach((img) => {
            const isActive = !isThought && !isNarrator && hasMessage && (
                (activeActorId && img.dataset.id === activeActorId) ||
                (!activeActorId && activeSpriteUrl && img.src === activeSpriteUrl)
            );

            if (isThought || isNarrator) {
                img.classList.remove("is-speaking");
                img.classList.add("is-dimmed");
                img.style.filter = "brightness(0.4)";
                img.style.zIndex = "1";
            } else if (!hasMessage) {
                img.classList.remove("is-speaking", "is-dimmed");
                img.style.filter = "brightness(1)";
                img.style.zIndex = "5";
            } else if (isActive) {
                img.classList.add("is-speaking");
                img.classList.remove("is-dimmed");
                img.style.filter = "brightness(1)";
                img.style.zIndex = "10";
                if (activeSpriteUrl) img.src = activeSpriteUrl;
            } else {
                img.classList.add("is-dimmed");
                img.classList.remove("is-speaking");
                img.style.filter = "brightness(0.4)";
                img.style.zIndex = "1";
            }
            img.style.transition = "0.3s";
        });
    }

    function renderScene(scene) {
        currentScene = scene || {};

        const moduleTeatro = document.getElementById("modulo-teatro") || document.getElementById("theatre-view-player");
        if (moduleTeatro) {
            const fondoUrl = currentScene.fondo || "";
            moduleTeatro.style.backgroundImage = fondoUrl
                ? `linear-gradient(rgba(0,0,0,.15), rgba(0,0,0,.35)), url("${fondoUrl}")`
                : "none";
            moduleTeatro.dataset.theatreTransition = currentScene.transitioning ? "true" : "false";
        }

        const locacionEl = document.getElementById("theatre-location");
        if (locacionEl) {
            locacionEl.textContent = currentScene.locacion || "LOCALIZACIÓN DESCONOCIDA";
        }

        const stage = document.getElementById("theatre-stage");
        if (!stage) return;

        if (currentScene.transitioning) {
            stage.style.opacity = "0";
        } else {
            stage.style.opacity = "1";
        }
        stage.style.transition = "opacity .35s ease";

        const actors = currentScene.actores || {};
        const renderIds = currentScene.transitioning ? [] : getRenderIds(currentScene);
        const currentActors = Array.from(stage.querySelectorAll(".theatre-sprite"));

        currentActors.forEach((img) => {
            if (!renderIds.includes(img.dataset.id)) img.remove();
        });

        renderIds.forEach((actorId) => {
            const data = actors[actorId];
            if (!data || (!data.url && !data.sprite)) return;

            let img = stage.querySelector(`.theatre-sprite[data-id="${actorId}"]`);
            if (!img) {
                img = document.createElement("img");
                img.className = "theatre-sprite";
                img.dataset.id = actorId;
                stage.appendChild(img);
            }

            // expresionActiva/sprite are the revealed state. expresionPreparada never renders here.
            img.src = data.url || data.sprite || "";
            img.alt = data.nombre || "Actor en escena";

            let transformStr = "";
            if (data.escala) transformStr += `scale(${data.escala}) `;
            if (data.orientacion === "flip") transformStr += "scaleX(-1) ";

            const xPos = data.x !== undefined ? data.x : 0;
            const yPos = data.y !== undefined ? data.y : 0;
            if (xPos !== 0 || yPos !== 0) {
                const xStr = typeof xPos === "number" ? `${xPos}px` : xPos;
                const yStr = typeof yPos === "number" ? `${yPos}px` : yPos;
                transformStr += `translate(${xStr}, ${yStr}) `;
            }

            img.style.transform = transformStr ? transformStr.trim() : "none";
        });

        applyStageFocus(stage, currentDialogue);
    }

    function resizeFontToFit(textEl) {
        textEl.style.fontSize = "";
        let size = parseFloat(global.getComputedStyle(textEl).fontSize) || 24;
        let iters = 0;
        while (textEl.scrollHeight > textEl.clientHeight && size > 10 && iters < 15) {
            size -= 1;
            textEl.style.fontSize = `${size}px`;
            iters += 1;
        }
    }

    function formatDialogueMessage(dialogData) {
        const raw = String(dialogData?.mensaje || "");
        if (/^\/em\s+/i.test(raw)) {
            const action = raw.replace(/^\/em\s+/i, "").trim();
            const name = dialogData?.nombre || "Actor";
            return `(${name} ${action})`;
        }
        return raw;
    }

    function resolvePlateIdentity(dialogData) {
        const hasActor = Boolean(dialogData?.actorId);
        if (!hasActor || dialogData?.tipo_dialogo === "narracion") {
            return { visible: false, name: "", title: "" };
        }

        if (dialogData?.identidad_conocida === false || dialogData?.identityKnown === false) {
            return { visible: true, name: "???", title: "???" };
        }

        if (dialogData?.mostrar_identidad === false && dialogData?.tipo_dialogo !== "pensamiento") {
            return { visible: false, name: "", title: "" };
        }

        return {
            visible: true,
            name: dialogData?.nombre || "???",
            title: dialogData?.titulo || "???"
        };
    }

    function renderDialogue(dialogData) {
        currentDialogue = dialogData || {};

        const nameEl = document.getElementById("dialogue-name");
        const titleEl = document.getElementById("dialogue-title");
        const textEl = document.getElementById("dialogue-text");
        const platesContainer = document.querySelector(".theatre-plates-container");
        const identity = resolvePlateIdentity(currentDialogue);

        if (platesContainer) platesContainer.style.display = identity.visible ? "flex" : "none";
        if (nameEl) {
            nameEl.textContent = identity.name;
            paintIdentityPlate(nameEl, currentDialogue.color_nombre);
        }
        if (titleEl) {
            titleEl.textContent = identity.title;
            paintIdentityPlate(titleEl, currentDialogue.color_titulo);
        }

        if (textEl) {
            clearInterval(typewriterInterval);
            const fullText = formatDialogueMessage(currentDialogue);
            if (!fullText) {
                textEl.textContent = "…";
                textEl.style.fontSize = "";
            } else {
                const startedAt = Number(currentDialogue.startedAt) || Date.now();
                const speed = Math.max(1, Number(currentDialogue.speedMs) || 30);

                if (resizeObserver) resizeObserver.disconnect();
                const clone = textEl.cloneNode(true);
                clone.style.visibility = "hidden";
                clone.style.position = "absolute";
                clone.style.width = `${textEl.clientWidth}px`;
                clone.style.height = `${textEl.clientHeight}px`;
                clone.textContent = fullText;
                textEl.parentNode.appendChild(clone);
                resizeFontToFit(clone);
                const finalSize = clone.style.fontSize;
                clone.remove();
                textEl.style.fontSize = finalSize || "";

                const renderFrame = () => {
                    const elapsed = Date.now() - startedAt;
                    let charsToShow = Math.floor(elapsed / speed);
                    charsToShow = Math.max(0, Math.min(fullText.length, charsToShow));
                    textEl.textContent = fullText.substring(0, charsToShow);
                    if (charsToShow >= fullText.length) {
                        clearInterval(typewriterInterval);
                        // Intentionally keep the completed dialogue visible until the next valid event.
                    }
                };

                renderFrame();
                if (textEl.textContent.length < fullText.length) {
                    typewriterInterval = setInterval(renderFrame, 30);
                }
            }
        }

        applyStageFocus(document.getElementById("theatre-stage"), currentDialogue);
    }

    db.ref(THEATRE_ROOT).on("value", (snapshot) => {
        renderScene(snapshot.val() || {});
    });

    db.ref(DIALOGUE_ROOT).on("value", (snapshot) => {
        renderDialogue(snapshot.val() || {});
    });

    async function updateVisibleActors(actorId, actorData) {
        if (!actorId) return;
        if (actorData && !actorData.sprite && !actorData.url) return;

        const sceneSnap = await db.ref(THEATRE_ROOT).once("value");
        const scene = sceneSnap.val() || {};
        if (scene.transitioning) return;

        const maxVisible = getVisibleLimit(scene);
        const visRef = db.ref(`${THEATRE_ROOT}/actores_visibles`);

        await visRef.transaction((current) => {
            const visibles = normalizeIdList(current);

            // A visible actor speaking again keeps the exact same slot.
            if (visibles.includes(actorId)) return visibles;

            visibles.push(actorId);
            while (visibles.length > maxVisible) visibles.shift();
            return visibles;
        });
    }

    async function removeVisibleActor(actorId) {
        if (!actorId) return;
        const visRef = db.ref(`${THEATRE_ROOT}/actores_visibles`);
        await visRef.transaction((current) => normalizeIdList(current).filter((id) => id !== actorId));
    }

    async function setMaxVisibleActors(value) {
        const maxVisible = clampVisibleLimit(value);
        await db.ref(`${THEATRE_ROOT}/max_actores_visibles`).set(maxVisible);
        await db.ref(`${THEATRE_ROOT}/actores_visibles`).transaction((current) => {
            const visibles = normalizeIdList(current);
            return visibles.slice(-maxVisible);
        });
        return maxVisible;
    }

    async function prepareExpression(actorId, expression) {
        if (!actorId || !expression) return;
        await db.ref(`${THEATRE_ROOT}/actores/${actorId}/expresionPreparada`).set(expression);
    }

    async function revealPreparedExpression(actorId, expression, sprite) {
        if (!actorId) return;
        const updates = {};
        if (expression) updates.expresionActiva = expression;
        if (sprite) updates.sprite = sprite;
        if (expression) updates.expresionPreparada = expression;
        if (Object.keys(updates).length) {
            await db.ref(`${THEATRE_ROOT}/actores/${actorId}`).update(updates);
        }
    }

    async function clearScene() {
        await db.ref().update({
            [`${THEATRE_ROOT}/actores_visibles`]: null,
            [DIALOGUE_ROOT]: null
        });
    }

    async function changeScene(nextScene) {
        const payload = nextScene || {};
        await db.ref(`${THEATRE_ROOT}/transitioning`).set(true);
        await db.ref().update({
            [`${THEATRE_ROOT}/actores_visibles`]: null,
            [DIALOGUE_ROOT]: null
        });
        await db.ref(THEATRE_ROOT).update({
            fondo: payload.fondo || "",
            locacion: payload.locacion || "",
            escenarioId: payload.escenarioId || null,
            sub_etiquetas: payload.sub_etiquetas || null
        });
        await db.ref(`${THEATRE_ROOT}/transitioning`).set(false);
    }

    function deterministicVocabularyKnown(characterId, languageId, word, percent) {
        const knowledge = Math.max(0, Math.min(100, Number(percent) || 0));
        if (knowledge >= 100) return true;
        if (knowledge <= 0) return false;

        const key = `${characterId || ""}|${languageId || ""}|${String(word || "").toLocaleLowerCase()}`;
        let hash = 2166136261;
        for (let i = 0; i < key.length; i += 1) {
            hash ^= key.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        const bucket = (hash >>> 0) % 10000;
        return bucket < Math.round(knowledge * 100);
    }

    global.LuminousTheatreState = {
        normalizeAssignedActorIds: normalizeIdList,
        clampVisibleLimit,
        getVisibleLimit,
        updateVisibleActors,
        removeVisibleActor,
        setMaxVisibleActors,
        prepareExpression,
        revealPreparedExpression,
        clearScene,
        changeScene,
        deterministicVocabularyKnown,
        setShowOwnActor: function (show) {
            try {
                global.localStorage?.setItem(LOCAL_SHOW_SELF_KEY, show ? "true" : "false");
            } catch (error) {}
            renderScene(currentScene);
        },
        getShowOwnActor: shouldShowOwnActor,
        resolveRoomRoot: function (roomId) {
            return roomId
                ? `campaña/teatro/salas/${roomId}/escena`
                : THEATRE_ROOT;
        }
    };

})(window);