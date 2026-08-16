(function(global) {
    "use strict";

    document.addEventListener('DOMContentLoaded', () => {
        const db = global.firebase.database();

        const NPC_ROSTER_PATHS = ["campaña/base_datos_npcs", "campaña/actores"];
        const THEATRE_ACTORS_PATH = "campaña/estado_mundo/escena_actual/actores";
        const MAX_ACTORS = 5;
        const DEFAULT_TITLE_COLOR = "#4a4a4a";

        let npcDatabaseRaw = {};
        let npcDatabaseBase = {};
        let npcDatabase = {};
        let liveActors = {};
        let playerDatabase = {};

        function refreshNpcDatabase() {
            npcDatabase = {};
            // Load legacy path first
            for (const [id, data] of Object.entries(npcDatabaseRaw)) {
                npcDatabase[id] = data;
            }
            // Load modern path second (overwrites if collision)
            for (const [id, data] of Object.entries(npcDatabaseBase)) {
                npcDatabase[id] = data;
            }
            updateRosterSelect();
        }

        const selectNpcRoster = document.getElementById("select-npc-roster");
        const liveActorsList = document.getElementById("live-actors-list");
        const btnSpawnNpc = document.getElementById("btn-spawn-npc");

        function updateRosterSelect() {
            if (!selectNpcRoster) return;
            selectNpcRoster.innerHTML = '<option value="">Selecciona un Personaje...</option>';

            // Personajes Jugadores
            const optgroupPlayers = document.createElement('optgroup');
            optgroupPlayers.label = "PERSONAJES JUGADORES";

            const processedPlayerActors = new Set();

            for (const [playerId, player] of Object.entries(playerDatabase)) {
                let actorData = null;
                let actorId = null;

                if (player.actorId && npcDatabase[player.actorId]) {
                    actorId = player.actorId;
                    actorData = npcDatabase[actorId];
                } else {
                    actorId = Object.keys(npcDatabase).find(k => npcDatabase[k].vinculo_jugador === playerId && npcDatabase[k].tipo === 'Jugador');
                    if (actorId) actorData = npcDatabase[actorId];
                }

                if (actorData) {
                    const opt = document.createElement('option');
                    opt.value = actorId;
                    opt.textContent = actorData.nombre || player.characterName || player.character_name || player.nombre || playerId;
                    opt.dataset.sourceType = 'player-profile';
                    opt.dataset.sourceId = playerId;
                    optgroupPlayers.appendChild(opt);
                    processedPlayerActors.add(actorId);
                }
            }
            selectNpcRoster.appendChild(optgroupPlayers);

            // NPCs / Personajes del DM
            const optgroupNpcs = document.createElement('optgroup');
            optgroupNpcs.label = "NPCs / PERSONAJES DEL DM";

            for (const [actorId, actorData] of Object.entries(npcDatabase)) {
                if (actorData.tipo === 'Jugador') continue;

                const opt = document.createElement('option');
                opt.value = actorId;
                opt.textContent = actorData.nombre || 'Sin Nombre';
                opt.dataset.sourceType = 'npc';
                opt.dataset.sourceId = actorId;
                optgroupNpcs.appendChild(opt);
            }
            selectNpcRoster.appendChild(optgroupNpcs);
        }

        function cargarRosterNPCs() {
            if (!selectNpcRoster) {
                console.error("CRÍTICO: No se encontró el #select-npc-roster en el DOM.");
                return;
            }

            db.ref(NPC_ROSTER_PATHS[0]).on('value', (snapshot) => {
                npcDatabaseBase = snapshot.val() || {};
                refreshNpcDatabase();
            });

            db.ref(NPC_ROSTER_PATHS[1]).on('value', (snapshot) => {
                npcDatabaseRaw = snapshot.val() || {};
                refreshNpcDatabase();
            });

            db.ref("campaña/jugadores").on('value', (snapshot) => {
                playerDatabase = snapshot.val() || {};
                updateRosterSelect();
            });
        }

        // 1. Carga del Roster (Pre-Game NPCs)
        cargarRosterNPCs();

        // 2. El Disparo (Spawn) - Adds to Scene Config (No longer directly to visibles)
        if (btnSpawnNpc) {
            btnSpawnNpc.addEventListener("click", () => {
                if (!selectNpcRoster) return;

                const selectedId = selectNpcRoster.value;
                if (!selectedId) return;

                const npcData = npcDatabase[selectedId];
                if (!npcData) return;

                const now = window.firebase.database.ServerValue.TIMESTAMP;
                const actorInstanceId = selectedId; // We want to maintain original ID to track speaking
                const selectedOption = selectNpcRoster.options[selectNpcRoster.selectedIndex];
                const sourceType = selectedOption.dataset.sourceType || 'npc';
                const sourceId = selectedOption.dataset.sourceId || selectedId;

                let expresionesObj = npcData.expresiones || {};
                let expActiva = "Neutral";
                if (Object.keys(expresionesObj).length === 0) {
                    expresionesObj = {
                        "Neutral": npcData.sprite || npcData.icono_jugador || npcData.icono || ""
                    };
                } else if (!expresionesObj["Neutral"]) {
                    expActiva = Object.keys(expresionesObj)[0];
                }

                // Push to the scene's background actors list (not immediately visible)
                db.ref(THEATRE_ACTORS_PATH + "/" + actorInstanceId).set({
                    nombre: npcData.nombre || selectedId,
                    titulo: npcData.titulo || "",
                    color_nombre: npcData.color_nombre || "#4a4a4a",
                    color_titulo: npcData.color_titulo || "#4a4a4a",
                    sourceId: sourceId,
                    sourceType: sourceType,
                    sprite: npcData.sprite || npcData.url || "",
                    icono: npcData.icono || npcData.icono_jugador || "",
                    expresiones: expresionesObj,
                    expresionActiva: expActiva,
                    x: 0,
                    y: 0,
                    escala: npcData.escala || 1,
                    orientacion: 'normal',
                    spawnedAt: now
                });

            });
        }

        // 3. Manipulación en Vivo (Live Control Cards)
        if (liveActorsList) {
            db.ref("campaña/teatro/actores_visibles").on("value", snapshot => {
                liveActors = snapshot.val() || {};
                liveActorsList.innerHTML = '';

                // Actualizar contador en la UI si existe (opcional)
                const panelTitle = document.querySelector(".panel-title");
                if (panelTitle) {
                    panelTitle.textContent = `CONTROL DE CASTING (${Object.keys(liveActors).length}/${MAX_ACTORS})`;
                }

                Object.keys(liveActors).forEach(actorId => {
                    const actorData = liveActors[actorId];

                    const card = document.createElement("div");
                    card.className = "actor-control-card";
                    let expresionesHTML = '';
                    if (actorData.expresiones && Object.keys(actorData.expresiones).length > 0) {
                        expresionesHTML = '<select class="actor-expression-select" style="background:#222; color:#fff; border:1px solid #444; padding:2px; font-size:0.8rem; font-family:\'Share Tech Mono\', monospace;">';
                        for (const exp in actorData.expresiones) {
                            const isSelected = actorData.expresionActiva === exp ? 'selected' : '';
                            expresionesHTML += `<option value="${exp}" ${isSelected}>${exp}</option>`;
                        }
                        expresionesHTML += '</select>';
                    }

                    card.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span class="actor-name">${actorData.nombre} (ID: ${actorId.split('_')[1]})</span>
                            ${expresionesHTML}
                        </div>
                        <div class="actor-buttons">
                            <button class="btn-move" data-dir="left"><</button>
                            <button class="btn-move" data-dir="right">></button>
                            <button class="btn-flip">ESPEJO</button>
                            <button class="btn-remove">X</button>
                        </div>
                    `;

                    // Expression change
                    const expSelect = card.querySelector('.actor-expression-select');
                    if (expSelect) {
                        expSelect.addEventListener('change', (e) => {
                            const newExp = e.target.value;
                            const newSprite = actorData.expresiones[newExp] || actorData.sprite;
                            db.ref(`campaña/teatro/actores_visibles/${actorId}`).update({
                                expresionActiva: newExp,
                                sprite: newSprite
                            });
                        });
                    }

                    // Move Left
                    const btnLeft = card.querySelector('.btn-move[data-dir="left"]');
                    if (btnLeft) {
                        btnLeft.addEventListener("click", () => {
                            const currentX = parseInt(actorData.x) || 0;
                            db.ref(`campaña/teatro/actores_visibles/${actorId}`).update({ x: currentX - 50 });
                        });
                    }

                    // Move Right
                    const btnRight = card.querySelector('.btn-move[data-dir="right"]');
                    if (btnRight) {
                        btnRight.addEventListener("click", () => {
                            const currentX = parseInt(actorData.x) || 0;
                            db.ref(`campaña/teatro/actores_visibles/${actorId}`).update({ x: currentX + 50 });
                        });
                    }

                    // Flip (Espejo)
                    const btnFlip = card.querySelector('.btn-flip');
                    if (btnFlip) {
                        btnFlip.addEventListener("click", () => {
                            const currentOrientation = actorData.orientacion === 'flip' ? 'normal' : 'flip';
                            db.ref(`campaña/teatro/actores_visibles/${actorId}`).update({ orientacion: currentOrientation });
                        });
                    }

                    // Remove
                    const btnRemove = card.querySelector('.btn-remove');
                    if (btnRemove) {
                        btnRemove.addEventListener("click", () => {
                            db.ref(`campaña/teatro/actores_visibles/${actorId}`).remove();
                        });
                    }

                    liveActorsList.appendChild(card);
                });
            });
        }
    });

})(window);