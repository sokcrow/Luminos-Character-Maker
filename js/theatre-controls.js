(function (global) {
    "use strict";

    document.addEventListener("DOMContentLoaded", () => {
        const db = global.firebase.database();
        const NPC_ROSTER_PATHS = ["campaña/base_datos_npcs", "campaña/actores"];
        const DEFAULT_TITLE_COLOR = "#3b2918";

        const paths = () => global.LuminousTheatreState?.getPaths?.() || {
            scene: "campaña/estado_mundo/escena_actual",
            dialogue: "campaña/estado_mundo/dialogo_activo",
            queue: "campaña/teatro/cola"
        };

        let npcDatabaseRaw = {};
        let npcDatabaseBase = {};
        let npcDatabase = {};
        let liveActors = {};
        let visibleActors = [];
        let playerDatabase = {};
        let maxVisibleActors = 5;
        let languageSources = {};

        const selectNpcRoster = document.getElementById("select-npc-roster");
        const liveActorsList = document.getElementById("live-actors-list");
        const btnSpawnNpc = document.getElementById("btn-spawn-npc");
        const directorPanel = document.getElementById("theatre-director-panel");

        function escapeHtml(value) {
            return String(value ?? "")
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll('"', "&quot;")
                .replaceAll("'", "&#039;");
        }

        function normalizeIdList(value) {
            if (global.LuminousTheatreState?.normalizeAssignedActorIds) {
                return global.LuminousTheatreState.normalizeAssignedActorIds(value);
            }
            if (!value) return [];
            if (Array.isArray(value)) return value.filter(Boolean);
            if (typeof value === "object") return Object.keys(value).sort().map((key) => value[key]).filter(Boolean);
            return [value];
        }

        function getPlayerLabel(playerId, player) {
            return player?.characterName || player?.character_name || player?.nombre || player?.name || playerId;
        }

        function getIdentityViewerOptions() {
            return Object.entries(playerDatabase)
                .map(([playerId, player]) => `<option value="${escapeHtml(playerId)}">${escapeHtml(getPlayerLabel(playerId, player))}</option>`)
                .join("");
        }

        function refreshNpcDatabase() {
            npcDatabase = Object.assign({}, npcDatabaseRaw, npcDatabaseBase);
            updateRosterSelect();
        }

        function updateRosterSelect() {
            if (!selectNpcRoster) return;
            selectNpcRoster.innerHTML = '<option value="">Selecciona un Personaje...</option>';

            const playerGroup = document.createElement("optgroup");
            playerGroup.label = "PERSONAJES JUGADORES";
            for (const [playerId, player] of Object.entries(playerDatabase)) {
                let actorId = null;
                let actorData = null;
                if (player.actorId && npcDatabase[player.actorId]) {
                    actorId = player.actorId;
                    actorData = npcDatabase[actorId];
                } else {
                    actorId = Object.keys(npcDatabase).find((id) =>
                        npcDatabase[id]?.vinculo_jugador === playerId && npcDatabase[id]?.tipo === "Jugador"
                    );
                    if (actorId) actorData = npcDatabase[actorId];
                }
                if (!actorData) continue;
                const option = document.createElement("option");
                option.value = actorId;
                option.textContent = actorData.nombre || getPlayerLabel(playerId, player);
                option.dataset.sourceType = "player-profile";
                option.dataset.sourceId = playerId;
                playerGroup.appendChild(option);
            }
            selectNpcRoster.appendChild(playerGroup);

            const npcGroup = document.createElement("optgroup");
            npcGroup.label = "NPCs / PERSONAJES DEL DM";
            for (const [actorId, actorData] of Object.entries(npcDatabase)) {
                if (actorData?.tipo === "Jugador") continue;
                const option = document.createElement("option");
                option.value = actorId;
                option.textContent = actorData?.nombre || "Sin Nombre";
                option.dataset.sourceType = "npc";
                option.dataset.sourceId = actorId;
                npcGroup.appendChild(option);
            }
            selectNpcRoster.appendChild(npcGroup);
        }

        function loadRoster() {
            if (!selectNpcRoster) return;
            db.ref(NPC_ROSTER_PATHS[0]).on("value", (snapshot) => {
                npcDatabaseBase = snapshot.val() || {};
                refreshNpcDatabase();
            });
            db.ref(NPC_ROSTER_PATHS[1]).on("value", (snapshot) => {
                npcDatabaseRaw = snapshot.val() || {};
                refreshNpcDatabase();
            });
            db.ref("campaña/jugadores").on("value", (snapshot) => {
                playerDatabase = snapshot.val() || {};
                updateRosterSelect();
                renderLiveActors();
            });
        }

        function buildDirectorPolicyControls() {
            if (!directorPanel || document.getElementById("theatre-render-policy")) return;
            const wrapper = document.createElement("div");
            wrapper.id = "theatre-render-policy";
            wrapper.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 0 12px;border-bottom:1px solid #333;margin-bottom:12px";
            wrapper.innerHTML = `
                <label style="display:flex;gap:6px;align-items:center;">
                    Máximo visible
                    <select id="theatre-max-visible" aria-label="Máximo de sprites visibles">
                        <option value="1">1</option><option value="2">2</option><option value="3">3</option>
                        <option value="4">4</option><option value="5">5</option>
                    </select>
                </label>
                <label style="display:flex;gap:6px;align-items:center;">
                    <input id="theatre-no-actors" type="checkbox"> No Actors
                </label>
                <button id="btn-clear-theatre-scene" type="button">LIMPIAR ESCENA</button>
            `;

            const title = directorPanel.querySelector(".panel-title");
            if (title?.nextSibling) directorPanel.insertBefore(wrapper, title.nextSibling);
            else directorPanel.prepend(wrapper);

            const maxSelect = wrapper.querySelector("#theatre-max-visible");
            const noActors = wrapper.querySelector("#theatre-no-actors");
            const clearBtn = wrapper.querySelector("#btn-clear-theatre-scene");

            maxSelect.value = String(maxVisibleActors);
            maxSelect.addEventListener("change", async () => {
                maxVisibleActors = await global.LuminousTheatreState.setMaxVisibleActors(maxSelect.value);
            });
            noActors.addEventListener("change", () => {
                db.ref(`${paths().scene}/modo_presentacion`).set(noActors.checked ? "no-actors" : "actors");
            });
            clearBtn.addEventListener("click", () => global.LuminousTheatreState.clearScene());
            db.ref(`${paths().scene}/modo_presentacion`).on("value", (snapshot) => {
                noActors.checked = snapshot.val() === "no-actors";
            });
        }

        function buildLanguageSelector() {
            if (document.getElementById("theatre-language-select")) return;
            const controls = document.querySelector(".theatre-controls");
            const firstRow = controls?.querySelector("div");
            if (!firstRow) return;
            const select = document.createElement("select");
            select.id = "theatre-language-select";
            select.setAttribute("aria-label", "Idioma del diálogo");
            select.style.cssText = "flex:1;padding:9px;background:#121820;color:white;border:1px solid #53606d;";
            firstRow.appendChild(select);
            renderLanguageSelector();
        }

        function renderLanguageSelector() {
            const select = document.getElementById("theatre-language-select");
            if (!select) return;
            const selected = select.value;
            const languages = Object.assign({}, ...Object.values(languageSources));
            select.innerHTML = '<option value="">Idioma común / sin filtro</option>';
            for (const [languageId, definition] of Object.entries(languages)) {
                const option = document.createElement("option");
                option.value = languageId;
                const suffix = definition?.distortion === true || String(definition?.tipo || definition?.type || "").toLowerCase().includes("dist")
                    ? " · Distortion"
                    : "";
                option.textContent = `${definition?.nombre || definition?.name || languageId}${suffix}`;
                select.appendChild(option);
            }
            if (Array.from(select.options).some((option) => option.value === selected)) select.value = selected;
        }

        function subscribeLanguages() {
            ["campaña/idiomas", "campaña/teatro/idiomas"].forEach((root) => {
                db.ref(root).on("value", (snapshot) => {
                    languageSources[root] = snapshot.val() || {};
                    renderLanguageSelector();
                });
            });
        }

        function spawnSelectedActor() {
            if (!selectNpcRoster) return;
            const selectedId = selectNpcRoster.value;
            if (!selectedId) return;
            const npcData = npcDatabase[selectedId];
            if (!npcData) return;

            const option = selectNpcRoster.options[selectNpcRoster.selectedIndex];
            const sourceType = option.dataset.sourceType || "npc";
            const sourceId = option.dataset.sourceId || selectedId;
            const actorInstanceId = `actor_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            const now = global.firebase.database.ServerValue.TIMESTAMP;

            const expressions = npcData.expresiones || {};
            const actorPayload = {
                nombre: npcData.nombre || selectedId,
                titulo: npcData.titulo || "",
                color_nombre: npcData.color_nombre || "",
                color_titulo: npcData.color_titulo || "",
                identityId: npcData.identityId || npcData.identidadId || selectedId,
                sourceId,
                sourceType,
                sprite: npcData.sprite || npcData.url || "",
                icono: npcData.icono || npcData.icono_jugador || "",
                expresiones: expressions,
                x: 0,
                y: 0,
                escala: npcData.escala || 1,
                orientacion: "normal",
                spawnedAt: now
            };
            // Pool and HUD are separate. Cataloging never reveals a sprite or selects an expression.
            db.ref(`${paths().scene}/actores/${actorInstanceId}`).set(actorPayload)
                .catch((error) => console.error("No se pudo añadir el actor al Teatro:", error));
        }

        function renderLiveActors() {
            if (!liveActorsList) return;
            liveActorsList.innerHTML = "";
            const panelTitle = directorPanel?.querySelector(".panel-title");
            if (panelTitle) {
                panelTitle.textContent = `CONTROL DE CASTING (${Object.keys(liveActors).length} disponibles · ${visibleActors.length}/${maxVisibleActors} visibles)`;
            }

            const viewerOptions = getIdentityViewerOptions();
            for (const [actorId, actorData] of Object.entries(liveActors)) {
                const card = document.createElement("div");
                card.className = "actor-control-card";
                card.dataset.visible = visibleActors.includes(actorId) ? "true" : "false";

                let expressionsHtml = "";
                if (actorData.expresiones && Object.keys(actorData.expresiones).length) {
                    const prepared = actorData.expresionPreparada || actorData.expresionActiva;
                    const options = Object.keys(actorData.expresiones).map((expression) =>
                        `<option value="${escapeHtml(expression)}" ${prepared === expression ? "selected" : ""}>${escapeHtml(expression)}</option>`
                    ).join("");
                    expressionsHtml = `<select class="actor-expression-select" style="background:#222;color:#fff;border:1px solid #444;padding:2px;font-size:.8rem;">${options}</select>`;
                }

                card.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                        <span class="actor-name">${escapeHtml(actorData.nombre || "Actor")}</span>
                        <span style="font-size:.7rem;opacity:.7;">${visibleActors.includes(actorId) ? "VISIBLE" : "DISPONIBLE"}</span>
                        ${expressionsHtml}
                    </div>
                    <div class="actor-buttons" style="display:flex;gap:5px;flex-wrap:wrap;">
                        <button class="btn-show" type="button">MOSTRAR</button>
                        <button class="btn-hide" type="button">OCULTAR</button>
                        <button class="btn-move" data-dir="left" type="button">&lt;</button>
                        <button class="btn-move" data-dir="right" type="button">&gt;</button>
                        <button class="btn-flip" type="button">ESPEJO</button>
                        <button class="btn-remove" type="button">RETIRAR DEL CAST</button>
                    </div>
                    <div class="actor-identity-controls" style="margin-top:8px;padding-top:8px;border-top:1px dashed #444;display:grid;grid-template-columns:1fr 1fr;gap:5px;">
                        <select class="actor-viewer-select" style="grid-column:1/-1;background:#151515;color:#fff;border:1px solid #444;padding:4px;">
                            <option value="">Jugador para identidad/nameplate...</option>${viewerOptions}
                        </select>
                        <input class="actor-override-name" type="text" placeholder="Nombre temporal" style="min-width:0;background:#151515;color:#fff;border:1px solid #444;padding:4px;">
                        <input class="actor-override-title" type="text" placeholder="Título temporal" style="min-width:0;background:#151515;color:#fff;border:1px solid #444;padding:4px;">
                        <button class="btn-reveal-identity" type="button">REVELAR ID</button>
                        <button class="btn-forget-identity" type="button">OCULTAR ID</button>
                        <button class="btn-override-nameplate" type="button">PRESENTACIÓN TEMPORAL</button>
                        <button class="btn-clear-override" type="button">LIMPIAR PRESENTACIÓN</button>
                    </div>
                `;

                const expressionSelect = card.querySelector(".actor-expression-select");
                expressionSelect?.addEventListener("change", (event) => {
                    // Preparing never changes expresionActiva/sprite.
                    global.LuminousTheatreState.prepareExpression(actorId, event.target.value);
                });

                card.querySelector(".btn-show")?.addEventListener("click", () => global.LuminousTheatreState.updateVisibleActors(actorId, actorData));
                card.querySelector(".btn-hide")?.addEventListener("click", () => global.LuminousTheatreState.removeVisibleActor(actorId));
                card.querySelector('.btn-move[data-dir="left"]')?.addEventListener("click", () => {
                    db.ref(`${paths().scene}/actores/${actorId}/x`).set((Number.parseInt(actorData.x, 10) || 0) - 50);
                });
                card.querySelector('.btn-move[data-dir="right"]')?.addEventListener("click", () => {
                    db.ref(`${paths().scene}/actores/${actorId}/x`).set((Number.parseInt(actorData.x, 10) || 0) + 50);
                });
                card.querySelector(".btn-flip")?.addEventListener("click", () => {
                    db.ref(`${paths().scene}/actores/${actorId}/orientacion`).set(actorData.orientacion === "flip" ? "normal" : "flip");
                });
                card.querySelector(".btn-remove")?.addEventListener("click", async () => {
                    await global.LuminousTheatreState.removeVisibleActor(actorId);
                    await db.ref(`${paths().scene}/actores/${actorId}`).remove();
                });

                const viewerSelect = card.querySelector(".actor-viewer-select");
                const getViewer = () => viewerSelect?.value || null;
                card.querySelector(".btn-reveal-identity")?.addEventListener("click", () => {
                    const viewerId = getViewer();
                    if (viewerId) global.LuminousTheatreState.setIdentityKnown(viewerId, actorId, true);
                });
                card.querySelector(".btn-forget-identity")?.addEventListener("click", () => {
                    const viewerId = getViewer();
                    if (viewerId) global.LuminousTheatreState.setIdentityKnown(viewerId, actorId, false);
                });
                card.querySelector(".btn-override-nameplate")?.addEventListener("click", () => {
                    const viewerId = getViewer();
                    if (!viewerId) return;
                    global.LuminousTheatreState.setNameplateOverride(viewerId, actorId, {
                        nombre: card.querySelector(".actor-override-name")?.value || "",
                        titulo: card.querySelector(".actor-override-title")?.value || ""
                    });
                });
                card.querySelector(".btn-clear-override")?.addEventListener("click", () => {
                    const viewerId = getViewer();
                    if (viewerId) global.LuminousTheatreState.clearNameplateOverride(viewerId, actorId);
                });

                liveActorsList.appendChild(card);
            }
        }

        loadRoster();
        buildDirectorPolicyControls();
        buildLanguageSelector();
        subscribeLanguages();
        btnSpawnNpc?.addEventListener("click", spawnSelectedActor);

        db.ref(`${paths().scene}/max_actores_visibles`).on("value", (snapshot) => {
            maxVisibleActors = global.LuminousTheatreState.clampVisibleLimit(snapshot.val());
            const maxSelect = document.getElementById("theatre-max-visible");
            if (maxSelect) maxSelect.value = String(maxVisibleActors);
            renderLiveActors();
        });
        db.ref(`${paths().scene}/actores_visibles`).on("value", (snapshot) => {
            visibleActors = normalizeIdList(snapshot.val());
            renderLiveActors();
        });
        db.ref(`${paths().scene}/actores`).on("value", (snapshot) => {
            liveActors = snapshot.val() || {};
            renderLiveActors();
        });
    });
})(window);
