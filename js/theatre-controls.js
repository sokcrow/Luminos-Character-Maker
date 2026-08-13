(function(global) {
    "use strict";

    document.addEventListener('DOMContentLoaded', () => {
        global.firebase.auth().onAuthStateChanged((user) => {
            if (!user) {
                console.error("CRÍTICO: Usuario no detectado. theatre-controls no arrancará.");
                return;
            }
            const db = global.firebase.database();

        const NPC_ROSTER_PATH = "campaña/actores";
        const THEATRE_ACTORS_PATH = "campaña/estado_mundo/escena_actual/actores";

        let npcDatabase = {};
        let liveActors = {};

        const selectNpcRoster = document.getElementById("select-npc-roster");
        const liveActorsList = document.getElementById("live-actors-list");
        const btnSpawnNpc = document.getElementById("btn-spawn-npc");

        function cargarRosterNPCs() {
            const npcRef = db.ref(NPC_ROSTER_PATH);

            if (!selectNpcRoster) {
                console.error("CRÍTICO: No se encontró el #select-npc-roster en el DOM.");
                return;
            }

            npcRef.on('value', (snapshot) => {
                selectNpcRoster.innerHTML = '<option value="">Selecciona un Actor...</option>'; // Limpiar
                if (!snapshot.exists()) {
                    console.warn("ADVERTENCIA: La base de datos de NPCs está vacía o la ruta es incorrecta.");
                    return;
                }

                npcDatabase = snapshot.val() || {};

                snapshot.forEach((hijo) => {
                    const npc = hijo.val();
                    const npcId = hijo.key;
                    // Ajusta 'npc.nombre' a como tengas guardado el nombre en tu JSON
                    selectNpcRoster.innerHTML += `<option value="${npcId}">${npc.nombre || 'Sin Nombre'}</option>`;
                });
                console.log("Roster de NPCs cargado con éxito.");
            });
        }

        // 1. Carga del Roster (Pre-Game NPCs)
        cargarRosterNPCs();

        // 2. El Disparo (Spawn)
        if (btnSpawnNpc) {
            btnSpawnNpc.addEventListener("click", () => {
                if (!selectNpcRoster) return;

                const selectedId = selectNpcRoster.value;
                if (!selectedId) return;

                const npcData = npcDatabase[selectedId];
                if (!npcData) return;

                // Generate a unique ID for this instance on stage
                const actorInstanceId = `actor_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

                const spawnPayload = {
                    nombre: npcData.nombre || selectedId,
                    sprite: npcData.sprite || npcData.url || "",
                    x: 0,
                    y: 0,
                    escala: npcData.escala || 1,
                    orientacion: 'normal'
                };

                db.ref(`${THEATRE_ACTORS_PATH}/${actorInstanceId}`).set(spawnPayload)
                  .catch(err => console.error("Error inyectando NPC al teatro:", err));
            });
        }

        // 3. Manipulación en Vivo (Live Control Cards)
        if (liveActorsList) {
            db.ref(THEATRE_ACTORS_PATH).on("value", snapshot => {
                liveActors = snapshot.val() || {};
                liveActorsList.innerHTML = '';

                Object.keys(liveActors).forEach(actorId => {
                    const actorData = liveActors[actorId];

                    const card = document.createElement("div");
                    card.className = "actor-control-card";
                    card.innerHTML = `
                        <span class="actor-name">${actorData.nombre} (ID: ${actorId.split('_')[1]})</span>
                        <div class="actor-buttons">
                            <button class="btn-move" data-dir="left"><</button>
                            <button class="btn-move" data-dir="right">></button>
                            <button class="btn-flip">ESPEJO</button>
                            <button class="btn-remove">X</button>
                        </div>
                    `;

                    // Move Left
                    const btnLeft = card.querySelector('.btn-move[data-dir="left"]');
                    if (btnLeft) {
                        btnLeft.addEventListener("click", () => {
                            const currentX = parseInt(actorData.x) || 0;
                            db.ref(`${THEATRE_ACTORS_PATH}/${actorId}`).update({ x: currentX - 50 });
                        });
                    }

                    // Move Right
                    const btnRight = card.querySelector('.btn-move[data-dir="right"]');
                    if (btnRight) {
                        btnRight.addEventListener("click", () => {
                            const currentX = parseInt(actorData.x) || 0;
                            db.ref(`${THEATRE_ACTORS_PATH}/${actorId}`).update({ x: currentX + 50 });
                        });
                    }

                    // Flip (Espejo)
                    const btnFlip = card.querySelector('.btn-flip');
                    if (btnFlip) {
                        btnFlip.addEventListener("click", () => {
                            const currentOrientation = actorData.orientacion === 'flip' ? 'normal' : 'flip';
                            db.ref(`${THEATRE_ACTORS_PATH}/${actorId}`).update({ orientacion: currentOrientation });
                        });
                    }

                    // Remove
                    const btnRemove = card.querySelector('.btn-remove');
                    if (btnRemove) {
                        btnRemove.addEventListener("click", () => {
                            db.ref(`${THEATRE_ACTORS_PATH}/${actorId}`).remove();
                        });
                    }

                    liveActorsList.appendChild(card);
                });
            });
        }
        });
    });

})(window);
