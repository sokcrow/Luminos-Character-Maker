(function (global) {
    "use strict";

    const db = global.firebase.database();
    const DEFAULT_ROOM_ID = "default";
    const DEFAULT_MAX_VISIBLE = 5;
    const LOCAL_SHOW_SELF_KEY = "luminous.theatre.showOwnActor";
    const IDENTITY_KNOWLEDGE_ROOT = "campaña/teatro/conocimiento_identidad";
    const LANGUAGE_ROOTS = ["campaña/idiomas", "campaña/teatro/idiomas"];
    const TRANSITION_MS = 350;

    let activeRoomId = document.body?.dataset?.theatreRoomId || DEFAULT_ROOM_ID;
    let currentScene = {};
    let currentDialogue = {};
    let playerDatabase = {};
    let languageDatabase = {};
    const languageSources = {};
    let currentIdentityKnowledge = {};
    let currentViewerKey = null;
    let currentViewerProfile = null;
    let currentKnowledgeRef = null;
    let currentKnowledgeListener = null;
    let sceneRef = null;
    let dialogueRef = null;
    let sceneListener = null;
    let dialogueListener = null;
    let typewriterInterval = null;
    let resizeObserver = null;
    let transitionPromise = null;

    function clampVisibleLimit(value) {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed)) return DEFAULT_MAX_VISIBLE;
        return Math.max(1, Math.min(DEFAULT_MAX_VISIBLE, parsed));
    }

    function clampPercentage(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return 0;
        return Math.max(0, Math.min(100, parsed));
    }

    function resolveRoomPaths(roomId) {
        const normalized = roomId && roomId !== DEFAULT_ROOM_ID ? String(roomId) : DEFAULT_ROOM_ID;
        if (normalized === DEFAULT_ROOM_ID) {
            return {
                roomId: DEFAULT_ROOM_ID,
                scene: "campaña/estado_mundo/escena_actual",
                dialogue: "campaña/estado_mundo/dialogo_activo",
                queue: "campaña/teatro/cola",
                log: "campaña/teatro/log"
            };
        }

        const root = `campaña/teatro/salas/${normalized}`;
        return {
            roomId: normalized,
            scene: `${root}/escena`,
            dialogue: `${root}/dialogo_activo`,
            queue: `${root}/cola`,
            log: `${root}/log`
        };
    }

    function getPaths() {
        return resolveRoomPaths(activeRoomId);
    }

    function normalizeIdList(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value.filter(Boolean);
        if (typeof value === "object") {
            return Object.keys(value)
                .sort((a, b) => {
                    const aNum = Number(a);
                    const bNum = Number(b);
                    if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
                    return String(a).localeCompare(String(b));
                })
                .map((key) => value[key])
                .filter(Boolean);
        }
        return [value].filter(Boolean);
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

    function getValidSpriteUrl(value) {
        const candidate = typeof value === "string" ? value.trim() : "";
        if (!candidate || /^(?:javascript|vbscript):/i.test(candidate)) return "";
        try {
            const resolved = new URL(candidate, document.baseURI || global.location?.href || "https://local.invalid/");
            if (!["http:", "https:", "data:", "blob:", "file:"].includes(resolved.protocol)) return "";
            if (resolved.protocol === "data:" && !/^data:image\//i.test(candidate)) return "";
            return candidate;
        } catch (error) {
            return "";
        }
    }

    function paintIdentityPlate(element, value) {
        if (!element) return;
        const plateColor = getSafeCssColor(value, "#4a4a4a");
        element.style.setProperty("color", "#ffffff", "important");
        element.style.setProperty(
            "background",
            `linear-gradient(90deg, ${plateColor} 0%, ${plateColor} 68%, #17110b 100%)`,
            "important"
        );
        element.style.setProperty("border-left-color", plateColor, "important");
    }

    function isDmView() {
        return Boolean(document.body?.classList.contains("on-game-dashboard"));
    }

    function getAssignedTheatreActor() {
        try {
            if (typeof global.getAssignedTheatreActor === "function") {
                return global.getAssignedTheatreActor() || null;
            }
        } catch (error) {
            console.warn("No se pudo resolver el actor asignado del Theatre Engine:", error);
        }
        return null;
    }

    function getAssignedActorId() {
        const actor = getAssignedTheatreActor();
        return actor?.actorId || actor?.id || global.assignedActorId || null;
    }

    function shouldShowOwnActor() {
        try {
            return global.localStorage?.getItem(LOCAL_SHOW_SELF_KEY) === "true";
        } catch (error) {
            return false;
        }
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

        // Firebase is authoritative: an empty/missing visible list means an empty stage.
        let ids = explicitVisible.filter((id) => {
            const actor = actors[id];
            return actor && getValidSpriteUrl(actor.url || actor.sprite);
        });

        if (!isDmView() && !shouldShowOwnActor()) {
            const ownId = getAssignedActorId();
            if (ownId) ids = ids.filter((id) => id !== ownId);
        }

        return ids;
    }

    function getCurrentAuthUser() {
        try {
            return global.firebase.auth?.().currentUser || null;
        } catch (error) {
            return null;
        }
    }

    function playerMatchesAuth(playerId, player, user) {
        if (!player || !user) return false;
        return playerId === user.uid ||
            player.uid === user.uid ||
            player.userId === user.uid ||
            player.authUid === user.uid ||
            (user.email && (player.email === user.email || player.correo === user.email));
    }

    function deriveViewerContext() {
        if (isDmView()) return { key: "__dm__", profile: null };

        const user = getCurrentAuthUser();
        const assignedActorId = getAssignedActorId();
        const assignedActor = getAssignedTheatreActor();

        if (user) {
            for (const [playerId, player] of Object.entries(playerDatabase)) {
                if (playerMatchesAuth(playerId, player, user)) {
                    return { key: playerId, profile: player };
                }
            }
        }

        if (assignedActorId) {
            for (const [playerId, player] of Object.entries(playerDatabase)) {
                const actorIds = normalizeIdList(player.actorIds || player.actores || player.actorId);
                if (actorIds.includes(assignedActorId)) {
                    return { key: playerId, profile: player };
                }
            }
        }

        if (assignedActor?.sourceId && playerDatabase[assignedActor.sourceId]) {
            return { key: assignedActor.sourceId, profile: playerDatabase[assignedActor.sourceId] };
        }

        if (user?.uid) return { key: user.uid, profile: null };
        return { key: null, profile: null };
    }

    function bindIdentityKnowledge() {
        const next = deriveViewerContext();
        currentViewerKey = next.key;
        currentViewerProfile = next.profile;

        if (currentKnowledgeRef && currentKnowledgeListener) {
            currentKnowledgeRef.off("value", currentKnowledgeListener);
        }
        currentKnowledgeRef = null;
        currentKnowledgeListener = null;
        currentIdentityKnowledge = {};

        if (!currentViewerKey || currentViewerKey === "__dm__") {
            renderDialogue(currentDialogue);
            return;
        }

        currentKnowledgeRef = db.ref(`${IDENTITY_KNOWLEDGE_ROOT}/${currentViewerKey}`);
        currentKnowledgeListener = (snapshot) => {
            currentIdentityKnowledge = snapshot.val() || {};
            renderDialogue(currentDialogue);
        };
        currentKnowledgeRef.on("value", currentKnowledgeListener);
    }

    function actorIdentityKey(actorId) {
        if (!actorId) return null;
        const actor = currentScene?.actores?.[actorId] || {};
        return actor.identityId || actor.identidadId || actor.sourceId || actorId;
    }

    function isOwnActorIdentity(actorId) {
        if (!actorId) return false;
        const ownId = getAssignedActorId();
        if (ownId && ownId === actorId) return true;

        const actor = currentScene?.actores?.[actorId] || {};
        const ownActor = getAssignedTheatreActor() || {};
        const ownStableId = ownActor.identityId || ownActor.identidadId || ownActor.sourceId || ownActor.actorId || ownActor.id;
        const stableId = actor.identityId || actor.identidadId || actor.sourceId || actorId;
        return Boolean(ownStableId && stableId === ownStableId);
    }

    function isIdentityKnown(actorId) {
        if (isDmView()) return true;
        if (isOwnActorIdentity(actorId)) return true;
        const key = actorIdentityKey(actorId);
        if (!key) return false;
        const value = currentIdentityKnowledge[key];
        if (value === true) return true;
        if (value && typeof value === "object") return value.known === true || value.conocida === true;
        return false;
    }

    function getNameplateOverride(actorId) {
        if (!actorId) return null;
        const allOverrides = currentScene?.nameplate_overrides || currentScene?.nameplateOverrides || {};
        const identityKey = actorIdentityKey(actorId);
        const viewerOverrides = allOverrides[currentViewerKey] || {};
        const sharedOverrides = allOverrides.__all__ || {};
        return viewerOverrides[actorId] || viewerOverrides[identityKey] || sharedOverrides[actorId] || sharedOverrides[identityKey] || null;
    }

    function resolvePlateIdentity(dialogData) {
        const actorId = dialogData?.actorId || null;
        const type = dialogData?.tipo_dialogo || "dialogo";
        if (!actorId || type === "narracion") {
            return { visible: false, known: false, name: "", title: "" };
        }

        if (type === "pensamiento" || dialogData?.mostrar_identidad === false) {
            return { visible: false, known: false, name: "", title: "" };
        }

        const actor = currentScene?.actores?.[actorId] || {};
        const known = isIdentityKnown(actorId);
        const override = getNameplateOverride(actorId) || {};
        const realName = dialogData?.nombre || actor.nombre || "???";
        const realTitle = dialogData?.titulo || actor.titulo || "???";

        return {
            visible: true,
            known,
            name: override.nombre ?? override.name ?? (known ? realName : "???"),
            title: override.titulo ?? override.title ?? (known ? realTitle : "???")
        };
    }

    function extractLanguageKnowledge(profile, languageId) {
        if (!profile || !languageId) return 0;
        const containers = [
            profile.idiomas,
            profile.lenguajes,
            profile.languages,
            profile.conocimiento_idiomas,
            profile.languageKnowledge
        ];

        for (const container of containers) {
            if (!container || typeof container !== "object") continue;
            const value = container[languageId];
            if (value === undefined || value === null) continue;
            if (typeof value === "number" || typeof value === "string") return clampPercentage(value);
            if (typeof value === "object") {
                return clampPercentage(value.porcentaje ?? value.percent ?? value.conocimiento ?? value.knowledge ?? 0);
            }
        }
        return 0;
    }

    function understandsDistortion(profile, languageId) {
        if (!profile || !languageId) return false;
        const containers = [profile.distortion_languages, profile.distortionLanguages, profile.distortions];
        for (const container of containers) {
            const value = container?.[languageId];
            if (value === true) return true;
            if (value && typeof value === "object" && (value.understood === true || value.comprendido === true)) return true;
        }

        const languageValue = profile.idiomas?.[languageId] || profile.languages?.[languageId];
        return Boolean(languageValue && typeof languageValue === "object" && (languageValue.understood === true || languageValue.comprendido === true));
    }

    function stableHash(text) {
        const input = String(text || "");
        let hash = 2166136261;
        for (let i = 0; i < input.length; i += 1) {
            hash ^= input.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function deterministicVocabularyKnown(characterId, languageId, word, percent) {
        const knowledge = clampPercentage(percent);
        if (knowledge >= 100) return true;
        if (knowledge <= 0) return false;
        const key = `${characterId || ""}|${languageId || ""}|${String(word || "").toLocaleLowerCase()}`;
        return stableHash(key) % 100000 < Math.round(knowledge * 1000);
    }

    function runeForWord(characterId, languageId, word) {
        const glyphs = ["ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚲ", "ᚷ", "ᚹ", "ᛁ", "ᛃ", "ᛇ", "ᛈ", "ᛉ", "ᛋ", "ᛏ", "ᛒ"];
        const hash = stableHash(`${characterId || ""}|${languageId || ""}|${String(word).toLocaleLowerCase()}`);
        const count = Math.max(2, Math.min(8, String(word).length));
        let result = "";
        for (let i = 0; i < count; i += 1) result += glyphs[(hash + i * 13) % glyphs.length];
        return result;
    }

    function getLanguageDefinition(languageId) {
        return languageId ? (languageDatabase[languageId] || {}) : {};
    }

    function isDistortionDefinition(definition) {
        const type = String(definition?.tipo || definition?.type || "").toLowerCase();
        return definition?.distortion === true || type === "distortion" || type === "distorsion";
    }

    function resolveLanguageText(rawText, dialogData, profileOverride) {
        const text = String(rawText || "");
        const languageId = dialogData?.idiomaId || dialogData?.languageId || dialogData?.idioma || null;
        if (!text || !languageId || isDmView()) return text;

        const definition = getLanguageDefinition(languageId);
        const profile = profileOverride || currentViewerProfile || global.currentCharacterData || global.currentPlayerData || global.playerData || null;
        const characterId = currentViewerKey || getAssignedActorId() || "anon";

        if (isDistortionDefinition(definition)) {
            if (understandsDistortion(profile, languageId)) return text;
            return String(
                definition.texto_desconocido ||
                definition.unknownText ||
                definition.distortionText ||
                "Tik... Tok..."
            );
        }

        const knowledge = extractLanguageKnowledge(profile, languageId);
        if (knowledge >= 100) return text;
        if (knowledge <= 0) {
            return String(definition.mensaje_desconocido || definition.unknownMessage || "(Está hablando una lengua que no entiendes)");
        }

        const style = String(definition.estilo_ofuscacion || definition.obfuscationStyle || definition.estilo || "ellipsis").toLowerCase();
        return text.replace(/\p{L}[\p{L}\p{M}'’\-]*/gu, (word) => {
            if (deterministicVocabularyKnown(characterId, languageId, word, knowledge)) return word;
            if (["runas", "runes", "simbolos", "symbols", "eldritch"].includes(style)) {
                return runeForWord(characterId, languageId, word);
            }
            return "[...]";
        });
    }

    function formatDialogueMessage(dialogData) {
        const raw = String(dialogData?.mensaje || "");
        const isEmote = /^\/em(?:\s+|$)/i.test(raw);
        if (!isEmote) return resolveLanguageText(raw, dialogData);

        const action = raw.replace(/^\/em\s*/i, "").trim();
        const transformed = resolveLanguageText(action, dialogData);
        const identity = resolvePlateIdentity(dialogData);
        const actorLabel = identity.visible ? (identity.name || "???") : "???";
        return `(${actorLabel} ${transformed})`;
    }

    function applyStageFocus(stage, dialogData) {
        if (!stage) return;
        const type = dialogData?.tipo_dialogo || currentScene?.focus_mode || "dialogo";
        const isThought = type === "pensamiento";
        const isNarrator = type === "narracion";
        const hasMessage = Boolean(dialogData?.mensaje);
        const activeActorId = dialogData?.actorId || currentScene?.active_actor || null;
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
            img.style.transition = "filter .3s ease, opacity .3s ease";
        });
    }

    function ensureSelfVisibilityControl() {
        if (isDmView() || document.getElementById("theatre-self-visibility-control")) return;
        const theatre = document.getElementById("theatre-view-player");
        if (!theatre) return;

        const label = document.createElement("label");
        label.id = "theatre-self-visibility-control";
        label.style.cssText = "position:absolute;right:16px;top:16px;z-index:9005;padding:6px 9px;background:rgba(0,0,0,.72);border:1px solid rgba(255,255,255,.25);font:12px 'Share Tech Mono',monospace;color:#fff;display:flex;gap:6px;align-items:center;";
        label.innerHTML = '<input type="checkbox" id="theatre-show-own-actor"> Mostrar mi personaje en escena';
        theatre.appendChild(label);

        const checkbox = label.querySelector("#theatre-show-own-actor");
        checkbox.checked = shouldShowOwnActor();
        checkbox.addEventListener("change", () => setShowOwnActor(checkbox.checked));
    }

    function removeLegacyPrototypePanels() {
        const selectors = [
            "#player-theatre-plate-title",
            "#player-theatre-plate-name",
            "#player-theatre-dialogue-text",
            "#theatre-nameplate-preview",
            ".theatre-nameplate-prototype",
            ".theatre-prototype-panel",
            "[data-theatre-prototype]"
        ];
        selectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((element) => element.remove());
        });
    }

    function applyTransitionVisual(scene) {
        const moduleTeatro = document.getElementById("modulo-teatro") || document.getElementById("theatre-view-player");
        if (!moduleTeatro) return;
        const phase = scene?.transition_phase || "";
        moduleTeatro.dataset.theatreTransition = scene?.transitioning ? "true" : "false";
        moduleTeatro.dataset.theatreTransitionPhase = phase;
        moduleTeatro.style.transition = `opacity ${TRANSITION_MS}ms ease`;
        moduleTeatro.style.opacity = scene?.transitioning && phase === "out" ? "0" : "1";
    }

    function renderScene(scene) {
        currentScene = scene || {};
        removeLegacyPrototypePanels();
        ensureSelfVisibilityControl();

        const moduleTeatro = document.getElementById("modulo-teatro") || document.getElementById("theatre-view-player");
        if (moduleTeatro) {
            const fondoUrl = currentScene.fondo || "";
            moduleTeatro.style.backgroundImage = fondoUrl
                ? `linear-gradient(rgba(0,0,0,.15), rgba(0,0,0,.35)), url("${fondoUrl}")`
                : "none";
        }
        applyTransitionVisual(currentScene);

        const locacionEl = document.getElementById("theatre-location");
        if (locacionEl) locacionEl.textContent = currentScene.locacion || "LOCALIZACIÓN DESCONOCIDA";

        const stage = document.getElementById("theatre-stage");
        if (!stage) {
            renderDialogue(currentDialogue);
            return;
        }

        const actors = currentScene.actores || {};
        const renderIds = currentScene.transitioning ? [] : getRenderIds(currentScene);
        Array.from(stage.querySelectorAll(".theatre-sprite")).forEach((img) => {
            if (!renderIds.includes(img.dataset.id)) img.remove();
        });

        renderIds.forEach((actorId) => {
            const data = actors[actorId];
            const spriteUrl = getValidSpriteUrl(data?.url || data?.sprite);
            if (!data || !spriteUrl) return;

            let img = stage.querySelector(`.theatre-sprite[data-id="${actorId}"]`);
            if (!img) {
                img = document.createElement("img");
                img.className = "theatre-sprite";
                img.dataset.id = actorId;
                stage.appendChild(img);
            }

            // Only the revealed expression/sprite renders. expresionPreparada is never read by the renderer.
            img.src = spriteUrl;
            img.alt = isDmView() || isIdentityKnown(actorId) ? (data.nombre || "Actor en escena") : "Actor desconocido";

            let transform = "";
            if (data.escala) transform += `scale(${data.escala}) `;
            if (data.orientacion === "flip") transform += "scaleX(-1) ";
            const x = data.x ?? 0;
            const y = data.y ?? 0;
            if (x !== 0 || y !== 0) {
                transform += `translate(${typeof x === "number" ? `${x}px` : x}, ${typeof y === "number" ? `${y}px` : y}) `;
            }
            img.style.transform = transform.trim() || "none";
        });

        applyStageFocus(stage, currentDialogue);
        renderDialogue(currentDialogue);
    }

    function resizeFontToFit(textEl) {
        textEl.style.fontSize = "";
        let size = parseFloat(global.getComputedStyle(textEl).fontSize) || 24;
        let iterations = 0;
        while (textEl.scrollHeight > textEl.clientHeight && size > 10 && iterations < 15) {
            size -= 1;
            textEl.style.fontSize = `${size}px`;
            iterations += 1;
        }
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
                textEl.parentNode?.appendChild(clone);
                resizeFontToFit(clone);
                textEl.style.fontSize = clone.style.fontSize || "";
                clone.remove();

                const renderFrame = () => {
                    const elapsed = Date.now() - startedAt;
                    const count = Math.max(0, Math.min(fullText.length, Math.floor(elapsed / speed)));
                    textEl.textContent = fullText.substring(0, count);
                    if (count >= fullText.length) {
                        clearInterval(typewriterInterval);
                        // Persistent by contract: completion never clears the active dialogue.
                    }
                };

                renderFrame();
                if (textEl.textContent.length < fullText.length) typewriterInterval = setInterval(renderFrame, 30);
            }
        }

        applyStageFocus(document.getElementById("theatre-stage"), currentDialogue);
    }

    function unbindRoom() {
        if (sceneRef && sceneListener) sceneRef.off("value", sceneListener);
        if (dialogueRef && dialogueListener) dialogueRef.off("value", dialogueListener);
        sceneRef = null;
        dialogueRef = null;
        sceneListener = null;
        dialogueListener = null;
    }

    function bindRoom(roomId) {
        unbindRoom();
        activeRoomId = roomId || DEFAULT_ROOM_ID;
        const paths = getPaths();
        sceneRef = db.ref(paths.scene);
        dialogueRef = db.ref(paths.dialogue);
        sceneListener = (snapshot) => renderScene(snapshot.val() || {});
        dialogueListener = (snapshot) => renderDialogue(snapshot.val() || {});
        sceneRef.on("value", sceneListener);
        dialogueRef.on("value", dialogueListener);
    }

    async function getFreshScene() {
        const snap = await db.ref(getPaths().scene).once("value");
        return snap.val() || {};
    }

    function messageIsStaleForScene(message, scene) {
        const createdAt = Number(message?.createdAt) || 0;
        const cutAt = Number(scene?.scene_cut_at) || 0;
        return Boolean(createdAt && cutAt && createdAt <= cutAt);
    }

    async function updateVisibleActors(actorId, actorData) {
        if (!actorId) return false;
        if (!getValidSpriteUrl(actorData?.sprite || actorData?.url)) return false;
        const scene = await getFreshScene();
        if (scene.transitioning) return false;

        const maxVisible = getVisibleLimit(scene);
        const visibleRef = db.ref(`${getPaths().scene}/actores_visibles`);
        await visibleRef.transaction((current) => {
            const visibles = normalizeIdList(current);
            if (visibles.includes(actorId)) return visibles;
            visibles.push(actorId);
            while (visibles.length > maxVisible) visibles.shift();
            return visibles;
        });
        return true;
    }

    async function removeVisibleActor(actorId) {
        if (!actorId) return;
        const visibleRef = db.ref(`${getPaths().scene}/actores_visibles`);
        await visibleRef.transaction((current) => normalizeIdList(current).filter((id) => id !== actorId));
    }

    async function setMaxVisibleActors(value) {
        const maxVisible = clampVisibleLimit(value);
        const paths = getPaths();
        await db.ref(`${paths.scene}/max_actores_visibles`).set(maxVisible);
        await db.ref(`${paths.scene}/actores_visibles`).transaction((current) => normalizeIdList(current).slice(-maxVisible));
        return maxVisible;
    }

    async function prepareExpression(actorId, expression) {
        if (!actorId || !expression) return false;
        await db.ref(`${getPaths().scene}/actores/${actorId}/expresionPreparada`).set(expression);
        return true;
    }

    async function revealPreparedExpression(actorId, expression, sprite) {
        if (!actorId) return false;
        const scene = await getFreshScene();
        if (scene.transitioning) return false;

        const validSprite = getValidSpriteUrl(sprite);
        if (!validSprite) return false;

        const updates = {};
        if (expression) updates.expresionActiva = expression;
        updates.sprite = validSprite;
        if (Object.keys(updates).length) {
            await db.ref(`${getPaths().scene}/actores/${actorId}`).update(updates);
        }
        return true;
    }

    async function publishIntervention(messageId, message) {
        const paths = getPaths();
        const scene = await getFreshScene();
        if (scene.transitioning || messageIsStaleForScene(message, scene)) {
            return { published: false, reason: scene.transitioning ? "transition" : "stale" };
        }

        const type = message?.tipo_dialogo || "dialogo";
        const active = Boolean(message?.actorId && type !== "pensamiento" && type !== "narracion");
        if (active) {
            await updateVisibleActors(message.actorId, message);
            await revealPreparedExpression(message.actorId, message.expression, message.sprite);
        }

        const activePayload = {
            messageId: messageId || null,
            nombre: message?.nombre || "",
            titulo: message?.titulo || "",
            mensaje: message?.mensaje || "",
            actorId: message?.actorId || null,
            expression: message?.expression || "Neutral",
            sprite: getValidSpriteUrl(message?.sprite) || null,
            icono: message?.icono || null,
            color_nombre: message?.color_nombre || "#ffffff",
            color_titulo: message?.color_titulo || "#3b2918",
            tipo_dialogo: type,
            mostrar_identidad: message?.mostrar_identidad !== false,
            idiomaId: message?.idiomaId || message?.languageId || message?.idioma || null,
            startedAt: global.firebase.database.ServerValue.TIMESTAMP,
            speedMs: Math.max(1, Number(message?.speedMs) || 30),
            durationMs: Math.max(0, Number(message?.durationMs) || ((String(message?.mensaje || "").length * 30) + 3000))
        };

        const updates = {
            [`${paths.scene}/active_actor`]: active ? message.actorId : null,
            [`${paths.scene}/focus_mode`]: type,
            [paths.dialogue]: activePayload
        };
        await db.ref().update(updates);
        return { published: true, payload: activePayload };
    }

    async function enqueueIntervention(message) {
        const paths = getPaths();
        const scene = await getFreshScene();
        if (scene.transitioning) return { queued: false, reason: "transition" };
        const ref = db.ref(paths.queue).push();
        await ref.set(Object.assign({}, message, {
            createdAt: global.firebase.database.ServerValue.TIMESTAMP,
            roomId: paths.roomId
        }));
        return { queued: true, key: ref.key };
    }

    async function clearScene() {
        const paths = getPaths();
        await db.ref().update({
            [`${paths.scene}/actores_visibles`]: null,
            [`${paths.scene}/nameplate_overrides`]: null,
            [`${paths.scene}/active_actor`]: null,
            [`${paths.scene}/focus_mode`]: null,
            [paths.dialogue]: null
        });
    }

    function wait(ms) {
        return new Promise((resolve) => global.setTimeout(resolve, ms));
    }

    async function changeScene(nextScene) {
        if (transitionPromise) return transitionPromise;
        const payload = nextScene || {};
        const paths = getPaths();

        transitionPromise = (async () => {
            const transitionId = `scene_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
            await db.ref(paths.scene).update({
                transitioning: true,
                transition_phase: "out",
                transition_id: transitionId,
                transition_started_at: global.firebase.database.ServerValue.TIMESTAMP
            });
            await db.ref(paths.queue).remove();
            await wait(TRANSITION_MS);

            await db.ref().update({
                [`${paths.scene}/actores_visibles`]: null,
                [`${paths.scene}/nameplate_overrides`]: null,
                [`${paths.scene}/active_actor`]: null,
                [`${paths.scene}/focus_mode`]: null,
                [paths.dialogue]: null,
                [paths.queue]: null
            });

            await db.ref(paths.scene).update({
                fondo: payload.fondo || "",
                locacion: payload.locacion || "",
                escenarioId: payload.escenarioId || null,
                sub_etiquetas: payload.sub_etiquetas || null,
                region: payload.region || payload.seccion || null,
                categoria: payload.categoria || null,
                transition_phase: "in"
            });
            await wait(TRANSITION_MS);

            // Drop anything emitted during the cut, then stamp the clean-scene boundary.
            await db.ref(paths.queue).remove();
            await db.ref(paths.dialogue).remove();
            await db.ref(paths.scene).update({
                transitioning: false,
                transition_phase: null,
                transition_ended_at: global.firebase.database.ServerValue.TIMESTAMP,
                scene_cut_at: global.firebase.database.ServerValue.TIMESTAMP
            });
        })();

        try {
            await transitionPromise;
        } finally {
            transitionPromise = null;
        }
        return true;
    }

    async function setIdentityKnown(viewerId, actorIdOrIdentityId, known) {
        if (!viewerId || !actorIdOrIdentityId) return false;
        const identityId = currentScene?.actores?.[actorIdOrIdentityId]
            ? actorIdentityKey(actorIdOrIdentityId)
            : actorIdOrIdentityId;
        const ref = db.ref(`${IDENTITY_KNOWLEDGE_ROOT}/${viewerId}/${identityId}`);
        if (known === false) await ref.remove();
        else await ref.set({ known: true, revealedAt: global.firebase.database.ServerValue.TIMESTAMP });
        return true;
    }

    async function setNameplateOverride(viewerId, actorId, override) {
        if (!viewerId || !actorId) return false;
        const cleaned = {};
        const name = override?.nombre ?? override?.name;
        const title = override?.titulo ?? override?.title;
        if (typeof name === "string" && name.trim()) cleaned.nombre = name.trim();
        if (typeof title === "string" && title.trim()) cleaned.titulo = title.trim();
        const ref = db.ref(`${getPaths().scene}/nameplate_overrides/${viewerId}/${actorId}`);
        if (!Object.keys(cleaned).length) await ref.remove();
        else await ref.set(cleaned);
        return true;
    }

    async function clearNameplateOverride(viewerId, actorId) {
        if (!viewerId || !actorId) return false;
        await db.ref(`${getPaths().scene}/nameplate_overrides/${viewerId}/${actorId}`).remove();
        return true;
    }

    function setShowOwnActor(show) {
        try {
            global.localStorage?.setItem(LOCAL_SHOW_SELF_KEY, show ? "true" : "false");
        } catch (error) {}
        renderScene(currentScene);
    }

    function setRoom(roomId) {
        bindRoom(roomId || DEFAULT_ROOM_ID);
    }

    function buildTheatreInitialsIcon(name) {
        const initials = String(name || "?")
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part.charAt(0))
            .join("")
            .toUpperCase() || "?";
        const escaped = initials.replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="#111111"/><text x="40" y="48" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#ffffff">${escaped}</text></svg>`;
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    function ensurePlayerComposerControls() {
        if (isDmView()) return;
        const container = document.getElementById("contenedor-selectores-emocion");
        const expression = document.getElementById("player-expression");
        if (!container || !expression) return;

        if (!document.getElementById("player-actor-select")) {
            const actorSelect = document.createElement("select");
            actorSelect.id = "player-actor-select";
            actorSelect.className = "theatre-player-composer-select";
            actorSelect.setAttribute("aria-label", "Personaje");
            actorSelect.style.display = "none";
            container.insertBefore(actorSelect, expression);
        }

        if (!document.getElementById("player-tipo-dialogo-select")) {
            const typeSelect = document.createElement("select");
            typeSelect.id = "player-tipo-dialogo-select";
            typeSelect.className = "theatre-player-composer-select";
            typeSelect.setAttribute("aria-label", "Tipo de intervención");
            typeSelect.innerHTML = '<option value="dialogo">Diálogo</option><option value="pensamiento">Pensamiento</option>';
            container.insertBefore(typeSelect, expression);
        }

        expression.classList.add("theatre-player-composer-select");
    }

    function installPlayerComposerCompatibility() {
        if (isDmView() || global.__luminousTheatreComposerCompatibilityInstalled) return false;
        const originalGetAssigned = global.getAssignedTheatreActor;
        const originalSync = global.syncPlayerTheatreComposer;
        if (typeof originalGetAssigned !== "function" || typeof originalSync !== "function") return false;

        global.getAssignedTheatreActor = function () {
            const actor = originalGetAssigned.apply(this, arguments);
            if (!actor) return null;
            return Object.assign({}, actor, {
                color_nombre: getSafeCssColor(actor.color_nombre, "#4a4a4a"),
                color_titulo: getSafeCssColor(actor.color_titulo, "#4a4a4a")
            });
        };

        global.syncPlayerTheatreComposer = function () {
            if (global.datosJugador && !global.datosJugador.actorId && global.datosJugador.vinculo_jugador) {
                global.datosJugador.actorId = global.datosJugador.vinculo_jugador;
            }

            ensurePlayerComposerControls();
            const result = originalSync.apply(this, arguments);
            const actor = global.getAssignedTheatreActor?.();
            const actorSelect = document.getElementById("player-actor-select");
            const expressionSelect = document.getElementById("player-expression");
            const sendButton = document.getElementById("btn-enviar-teatro-modal");
            const nameEl = document.getElementById("theatre-modal-readonly-name");
            const titleEl = document.getElementById("theatre-modal-readonly-title");

            if (!actor) {
                if (actorSelect) actorSelect.style.display = "none";
                if (expressionSelect) {
                    expressionSelect.innerHTML = "";
                    expressionSelect.style.display = "none";
                }
                if (sendButton) sendButton.disabled = true;
                return result;
            }

            if (expressionSelect) expressionSelect.style.display = "block";
            paintIdentityPlate(nameEl, actor.color_nombre);
            if (titleEl && actor.titulo) paintIdentityPlate(titleEl, actor.color_titulo);
            return result;
        };

        global.__luminousTheatreComposerCompatibilityInstalled = true;
        return true;
    }

    function patchTheatreLogPortrait(img) {
        if (!img?.matches?.("#theatre-log-container .hex-portrait img")) return;
        const fallback = () => {
            img.src = buildTheatreInitialsIcon(img.alt || "?");
        };
        const src = img.getAttribute("src") || "";
        if (!src || src.includes("via.placeholder.com")) fallback();
        img.addEventListener("error", fallback, { once: true });
    }

    function observePlayerTheatreLog() {
        if (isDmView() || global.__luminousTheatreLogObserver) return;
        document
            .querySelectorAll("#theatre-log-container .hex-portrait img")
            .forEach(patchTheatreLogPortrait);

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (!(node instanceof Element)) return;
                    if (node.matches("#theatre-log-container .hex-portrait img")) patchTheatreLogPortrait(node);
                    node
                        .querySelectorAll?.("#theatre-log-container .hex-portrait img")
                        .forEach(patchTheatreLogPortrait);
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
        global.__luminousTheatreLogObserver = observer;
    }

    db.ref("campaña/jugadores").on("value", (snapshot) => {
        playerDatabase = snapshot.val() || {};
        bindIdentityKnowledge();
        renderDialogue(currentDialogue);
    });

    LANGUAGE_ROOTS.forEach((root) => {
        db.ref(root).on("value", (snapshot) => {
            languageSources[root] = snapshot.val() || {};
            languageDatabase = Object.assign({}, ...LANGUAGE_ROOTS.map((key) => languageSources[key] || {}));
            renderDialogue(currentDialogue);
        });
    });

    try {
        global.firebase.auth?.().onAuthStateChanged(() => bindIdentityKnowledge());
    } catch (error) {}

    document.addEventListener("DOMContentLoaded", () => {
        removeLegacyPrototypePanels();
        ensureSelfVisibilityControl();
        ensurePlayerComposerControls();
        installPlayerComposerCompatibility();
        observePlayerTheatreLog();
        bindIdentityKnowledge();
    });

    global.addEventListener("actoresCacheUpdated", installPlayerComposerCompatibility);
    document.addEventListener("click", (event) => {
        if (event.target?.closest?.("#btn-abrir-escritura")) installPlayerComposerCompatibility();
    }, true);

    bindRoom(activeRoomId);

    global.LuminousTheatreState = {
        normalizeAssignedActorIds: normalizeIdList,
        clampVisibleLimit,
        clampPercentage,
        getVisibleLimit,
        getRenderIds,
        getPaths,
        resolveRoomPaths,
        setRoom,
        updateVisibleActors,
        removeVisibleActor,
        setMaxVisibleActors,
        prepareExpression,
        revealPreparedExpression,
        publishIntervention,
        enqueueIntervention,
        clearScene,
        changeScene,
        setIdentityKnown,
        setNameplateOverride,
        clearNameplateOverride,
        deterministicVocabularyKnown,
        resolveLanguageText,
        messageIsStaleForScene,
        setShowOwnActor,
        getShowOwnActor: shouldShowOwnActor,
        getViewerKey: () => currentViewerKey,
        getViewerProfile: () => currentViewerProfile,
        getLanguageDefinitions: () => Object.assign({}, languageDatabase)
    };
})(window);
