(function(global) {
    "use strict";

    const db = global.firebase.database();

    const NPC_ROSTER_PATH = "campaña/base_datos_npcs";
    const THEATRE_ACTORS_PATH = "campaña/estado_mundo/escena_actual/actores";

    let npcDatabase = {};
    let liveActors = {};

    const selectNpcRoster = document.getElementById("select-npc-roster");
    const liveActorsList = document.getElementById("live-actors-list");
    const btnSpawnNpc = document.getElementById("btn-spawn-npc");

    // 1. Carga del Roster (Pre-Game NPCs)
    if (selectNpcRoster) {
        db.ref(NPC_ROSTER_PATH).on("value", snapshot => {
            npcDatabase = snapshot.val() || {};
            selectNpcRoster.innerHTML = '<option value="">Selecciona un NPC...</option>';

            Object.keys(npcDatabase).forEach(npcId => {
                const npc = npcDatabase[npcId];
                const option = document.createElement("option");
                option.value = npcId;
                option.textContent = npc.nombre || npcId;
                selectNpcRoster.appendChild(option);
            });
        });
    }

    // 2. El Disparo (Spawn)
    if (btnSpawnNpc) {
        btnSpawnNpc.addEventListener("click", () => {
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
                escala: 1,
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
                card.querySelector('.btn-move[data-dir="left"]').addEventListener("click", () => {
                    const currentX = parseInt(actorData.x) || 0;
                    db.ref(`${THEATRE_ACTORS_PATH}/${actorId}`).update({ x: currentX - 50 });
                });

                // Move Right
                card.querySelector('.btn-move[data-dir="right"]').addEventListener("click", () => {
                    const currentX = parseInt(actorData.x) || 0;
                    db.ref(`${THEATRE_ACTORS_PATH}/${actorId}`).update({ x: currentX + 50 });
                });

                // Flip (Espejo)
                card.querySelector('.btn-flip').addEventListener("click", () => {
                    const currentOrientation = actorData.orientacion === 'flip' ? 'normal' : 'flip';
                    db.ref(`${THEATRE_ACTORS_PATH}/${actorId}`).update({ orientacion: currentOrientation });
                });

                // Remove
                card.querySelector('.btn-remove').addEventListener("click", () => {
                    db.ref(`${THEATRE_ACTORS_PATH}/${actorId}`).remove();
                });

                liveActorsList.appendChild(card);
            });
        });
    }

})(window);