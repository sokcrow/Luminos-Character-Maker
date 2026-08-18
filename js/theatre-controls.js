(function(global) {
    "use strict";

    document.addEventListener("DOMContentLoaded", () => {
        const db = global.firebase.database();
        const NPC_ROSTER_PATHS = ["campaña/base_datos_npcs", "campaña/actores"];
        const THEATRE_ROOT = "campaña/estado_mundo/escena_actual";
        const THEATRE_ACTORS_PATH = `${THEATRE_ROOT}/actores`;
        const VISIBLE_ACTORS_PATH = `${THEATRE_ROOT}/actores_visibles`;
        const DEFAULT_TITLE_COLOR = "#3b2918";

        let npcDatabaseRaw = {};
        let npcDatabaseBase = {};
        let npcDatabase = {};
        let liveActors = {};
        let visibleActors = [];
        let playerDatabase = {};
        let maxVisibleActors = 5;

        const selectNpcRoster = document.getElementById("select-npc-roster");
        const liveActorsList = document.getElementById("live-actors-list");
        const btnSpawnNpc = document.getElementById("btn-spawn-npc");
        const directorPanel = document.getElementById("theatre-director-panel");

        function normalizeIdList(value) {
            if (global.LuminousTheatreState?.normalizeAssignedActorIds) {
                return global.LuminousTheatreState.normalizeAssignedActorIds(value);
            }
            if (!value) return [];
            if (Array.isArray(value)) return value.filter(Boolean);
            if (typeof value === "object") return Object.keys(value).sort().map(key => value[key]).filter(Boolean);
            return [value];
        }

        function refreshNpcDatabase() {
            npcDatabase = {};
            for (const [id, data] of Object.entries(npcDatabaseRaw)) npcDatabase[id] = data;
            for (const [id, data] of Object.entries(npcDatabaseBase)) npcDatabase[id] = data;
            updateRosterSelect();
        }

        function updateRosterSelect() {
            if (!selectNpcRoster) return;
            selectNpcRoster.innerHTML = '<option value="">Selecciona un Personaje...</option>';

            const optgroupPlayers = document.createElement("optgroup");
            optgroupPlayers.label = "PERSONAJES JUGADORES";

            for (const [playerId, player] of Object.entries(playerDatabase)) {
                let actorData = null;
                let actorId = null;

                if (player.actorId && npcDatabase[player.actorId]) {
                    actorId = player.actorId;
                    actorData = npcDatabase[actorId];
                } else {
                    actorId = Object.keys(npcDatabase).find(k =>
                        npcDatabase[k].vinculo_jugador === playerId && npcDatabase[k].tipo === "Jugador"
                    );
                    if (actorId) actorData = npcDatabase[actorId];
                }

                if (actorData) {
                    const opt = document.createElement("option");
                    opt.value = actorId;
                    opt.textContent = actorData.nombre || player.characterName || player.character_name || player.nombre || playerId;
                    opt.dataset.sourceType = "player-profile";
                    opt.dataset.sourceId = playerId;
                    optgroupPlayers.appendChild(opt);
                }
            }
            selectNpcRoster.appendChild(optgroupPlayers);

            const optgroupNpcs = document.createElement("optgroup");
            optgroupNpcs.label = "NPCs / PERSONAJES DEL DM";
            for (const [actorId, actorData] of Object.entries(npcDatabase)) {
                if (actorData.tipo === "Jugador") continue;
                const opt = document.createElement("option");
                opt.value = actorId;
                opt.textContent = actorData.nombre || "Sin Nombre";
                opt.dataset.sourceType = "npc";
                opt.dataset.sourceId = actorId;
                optgroupNpcs.appendChild(opt);
            }
            selectNpcRoster.appendChild(optgroupNpcs);
        }

        function loadRoster() {
            if (!selectNpcRoster) return;
            db.ref(NPC_ROSTER_PATHS[0]).on("value", snapshot => {
                npcDatabaseBase = snapshot.val() || {};
                refreshNpcDatabase();
            });
            db.ref(NPC_ROSTER_PATHS[1]).on("value", snapshot => {
                npcDatabaseRaw = snapshot.val() || {};
                refreshNpcDatabase();
            });
            db.ref("campaña/jugadores").on("value", snapshot => {
                playerDatabase = snapshot.val() || {};
                updateRosterSelect();
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
                if (global.LuminousTheatreState?.setMaxVisibleActors) {
                    maxVisibleActors = await global.LuminousTheatreState.setMaxVisibleActors(maxSelect.value);
                }
            });

            noActors.addEventListener("change", () => {
                db.ref(`${THEATRE_ROOT}/modo_presentacion`).set(noActors.checked ? "no-actors" : "actors");
            });

            clearBtn.addEventListener("click", () => {
                if (global.LuminousTheatreState?.clearScene) {
                    global.LuminousTheatreState.clearScene();
                }
            });

            db.ref(`${THEATRE_ROOT}/modo_presentacion`).on("value", snap => {
                noActors.checked = snap.val() === "no-actors";
            });
        }

        loadRoster();
        buildDirectorPolicyControls();

        db.ref(`${THEATRE_ROOT}/max_actores_visibles`).on("value", snap => {
            maxVisibleActors = global.LuminousTheatreState?.clampVisibleLimit
                ? global.LuminousTheatreState.clampVisibleLimit(snap.val())
                : Math.max(1, Math.min(5, Number.parseInt(snap.val(), 10) || 5));
            const maxSelect = document.getElementById("theatre-max-visible");
            if (maxSelect) maxSelect.value = String(maxVisibleActors);
            renderLiveActors();
        });

        db.ref(VISIBLE_ACTORS_PATH).on("value", snap => {
            visibleActors = normalizeIdList(snap.val());
            renderLiveActors();
        });

        if (btnSpawnNpc) {
            btnSpawnNpc.addEventListener("click", () => {
                if (!selectNpcRoster) return;
                const selectedId = selectNpcRoster.value;
                if (!selectedId) return;
                const npcData = npcDatabase[selectedId];
                if (!npcData) return;

                const selectedOption = selectNpcRoster.options[selectNpcRoster.selectedIndex];
                const sourceType = selectedOption.dataset.sourceType || "npc";
                const sourceId = selectedOption.dataset.sourceId || selectedId;
                const actorInstanceId = `actor_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                const now = global.firebase.database.ServerValue.TIMESTAMP;

                let expressions = npcData.expresiones || {};
                let activeExpression = "Neutral";
                if (Object.keys(expressions).length === 0) {
                    expressions = { Neutral: npcData.sprite || npcData.icono_jugador || npcData.icono || "" };
                } else if (!expressions.Neutral) {
                    activeExpression = Object.keys(expressions)[0];
                }

                const activeSprite = expressions[activeExpression] || npcData.sprite || npcData.url || "";
                const actorPayload = {
                    nombre: npcData.nombre || selectedId,
                    titulo: npcData.titulo || "",
                    color_nombre: npcData.color_nombre || "#ffffff",
                    color_titulo: npcData.color_titulo || DEFAULT_TITLE_COLOR,
                    sourceId,
                    sourceType,
                    sprite: activeSprite,
                    icono: npcData.icono || npcData.icono_jugador || "",
                    expresiones: expressions,
                    expresionActiva: activeExpression,
                    expresionPreparada: activeExpression,
                    x: 0,
                    y: 0,
                    escala: npcData.escala || 1,
                    orientacion: "normal",
                    spawnedAt: now
                };

                // The actor pool is not the HUD. Never delete available actors to enforce the visible limit.
                db.ref(`${THEATRE_ACTORS_PATH}/${actorInstanceId}`).set(actorPayload).then(() => {
                    if (global.LuminousTheatreState?.updateVisibleActors) {
                        return global.LuminousTheatreState.updateVisibleActors(actorInstanceId, actorPayload);
                    }
                }).catch(error => console.error("No se pudo añadir el actor al Teatro:", error));
            });
        }

        function renderLiveActors() {
            if (!liveActorsList) return;
            liveActorsList.innerHTML = "";

            const panelTitle = document.querySelector(".panel-title");
            if (panelTitle) {
                panelTitle.textContent = `CONTROL DE CASTING (${Object.keys(liveActors).length} disponibles · ${visibleActors.length}/${maxVisibleActors} visibles)`;
            }

            Object.keys(liveActors).forEach(actorId => {
                const actorData = liveActors[actorId];
                const card = document.createElement("div");
                card.className = "actor-control-card";
                card.dataset.visible = visibleActors.includes(actorId) ? "true" : "false";

                let expressionsHTML = "";
                if (actorData.expresiones && Object.keys(actorData.expresiones).length > 0) {
                    const prepared = actorData.expresionPreparada || actorData.expresionActiva;
                    expressionsHTML = '<select class="actor-expression-select" style="background:#222;color:#fff;border:1px solid #444;padding:2px;font-size:.8rem;font-family:\'Share Tech Mono\',monospace">';
                    for (const exp of Object.keys(actorData.expresiones)) {
                        expressionsHTML += `<option value="${exp}" ${prepared === exp ? "selected" : ""}>${exp}</option>`;
                    }
                    expressionsHTML += "</select>";
                }

                card.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                        <span class="actor-name">${actorData.nombre || "Actor"}</span>
                        <span style="font-size:.7rem;opacity:.7;">${visibleActors.includes(actorId) ? "VISIBLE" : "DISPONIBLE"}</span>
                        ${expressionsHTML}
                    </div>
                    <div class="actor-buttons">
                        <button class="btn-show" type="button">MOSTRAR</button>
                        <button class="btn-move" data-dir="left" type="button">&lt;</button>
                        <button class="btn-move" data-dir="right" type="button">&gt;</button>
                        <button class="btn-flip" type="button">ESPEJO</button>
                        <button class="btn-remove" type="button">X</button>
                    </div>
                `;

                const expSelect = card.querySelector(".actor-expression-select");
                if (expSelect) {
                    expSelect.addEventListener("change", event => {
                        const newExpression = event.target.value;
                        // Selecting prepares an expression. It must not reveal/change the visible sprite yet.
                        if (global.LuminousTheatreState?.prepareExpression) {
                            global.LuminousTheatreState.prepareExpression(actorId, newExpression);
                        } else {
                            db.ref(`${THEATRE_ACTORS_PATH}/${actorId}/expresionPreparada`).set(newExpression);
                        }
                    });
                }

                card.querySelector(".btn-show")?.addEventListener("click", () => {
                    global.LuminousTheatreState?.updateVisibleActors(actorId, actorData);
                });

                card.querySelector('.btn-move[data-dir="left"]')?.addEventListener("click", () => {
                    const currentX = Number.parseInt(actorData.x, 10) || 0;
                    db.ref(`${THEATRE_ACTORS_PATH}/${actorId}/x`).set(currentX - 50);
                });

                card.querySelector('.btn-move[data-dir="right"]')?.addEventListener("click", () => {
                    const currentX = Number.parseInt(actorData.x, 10) || 0;
                    db.ref(`${THEATRE_ACTORS_PATH}/${actorId}/x`).set(currentX + 50);
                });

                card.querySelector(".btn-flip")?.addEventListener("click", () => {
                    const orientation = actorData.orientacion === "flip" ? "normal" : "flip";
                    db.ref(`${THEATRE_ACTORS_PATH}/${actorId}/orientacion`).set(orientation);
                });

                card.querySelector(".btn-remove")?.addEventListener("click", async () => {
                    if (global.LuminousTheatreState?.removeVisibleActor) {
                        await global.LuminousTheatreState.removeVisibleActor(actorId);
                    }
                    await db.ref(`${THEATRE_ACTORS_PATH}/${actorId}`).remove();
                });

                liveActorsList.appendChild(card);
            });
        }

        if (liveActorsList) {
            db.ref(THEATRE_ACTORS_PATH).on("value", snapshot => {
                liveActors = snapshot.val() || {};
                renderLiveActors();
            });
        }
    });

})(window);