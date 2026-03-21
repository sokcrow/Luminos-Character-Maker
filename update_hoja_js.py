import re

with open('hoja_personaje.js', 'r') as f:
    content = f.read()

# Replace auth.onAuthStateChanged
new_auth_block = """
// Route Guard and Data Init
auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.replace("index.html");
  } else {
    // Load playerId from localStorage
    let localPlayerId = localStorage.getItem("playerId");

    if (!localPlayerId || localPlayerId.trim() === "") {
        // Show Limbus Company modal to get characterName
        const modal = document.getElementById("character-name-modal");
        const input = document.getElementById("character-name-input");
        const btn = document.getElementById("btn-confirm-character-name");

        if (modal && input && btn) {
            modal.style.display = "flex";

            btn.onclick = () => {
                const name = input.value.trim();
                if (name) {
                    localStorage.setItem("playerId", name);
                    playerId = name;
                    modal.style.display = "none";
                    loadPlayerData();
                }
            };
        }
    } else {
        playerId = localPlayerId;
        loadPlayerData();
    }
  }
});

function loadPlayerData() {
    if (!playerId) return;

    // 1. Descargar datos base del jugador usando el characterName
    const playerRef = db.ref("campaña/jugadores/" + playerId);
    playerRef.on("value", (snapshot) => {
      if (snapshot.exists()) {
        window.datosJugador = snapshot.val();
        currentPlayerData = snapshot.val();
        renderCharacterSheet(window.datosJugador);
        if (typeof window.renderRecetasCrafteo === "function") {
          window.renderRecetasCrafteo();
        }
        if (typeof window.actualizarExpresionesDesdeDropdown === "function") {
          window.actualizarExpresionesDesdeDropdown();
        }
      }
    });

    // Track Realtime Presence
    const connectedRef = db.ref(".info/connected");
    connectedRef.on("value", (snap) => {
      if (snap.val() === true) {
        // When connected, set up onDisconnect behavior
        playerRef.child("online").onDisconnect().set(false);
        playerRef
          .child("ultima_conexion")
          .onDisconnect()
          .set(firebase.database.ServerValue.TIMESTAMP);

        // Set the player as online
        playerRef.update({ online: true });
      }
    });
}
"""

content = re.sub(r'// Route Guard and Data Init\nauth\.onAuthStateChanged.*?}\n\s*\}\);\n\s*\}\);', new_auth_block, content, flags=re.DOTALL)

with open('hoja_personaje.js', 'w') as f:
    f.write(content)
