with open('hoja_personaje.js', 'r') as f:
    content = f.read()

new_logic = """
// -------------------------------------------------------------
// NEW PLAYER HUD (LIMBUS OVERLAY)
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener("click", (e) => {
        const btnPlayerHud = e.target.closest("#btn-player-hud");
        if (btnPlayerHud) {
            const limbusHudOverlay = document.getElementById("limbus-hud-overlay");
            const hudPlayerSplash = document.getElementById("hud-player-splash");
            const hudResContainer = document.getElementById("hud-player-resistances-container");
            const playerId = localStorage.getItem('playerId');

            if (limbusHudOverlay && playerId) {
                limbusHudOverlay.style.display = "flex";

                // Fetch player data on open
                firebase.database().ref('campaña/jugadores/' + playerId).once("value").then((snapshot) => {
                    const data = snapshot.val();
                    if (data) {
                        hudPlayerSplash.src = data.splash_art || "Assets/imagen/default-splash.png";

                        const resTypes = {
                            "Cortante": "🗡️", "Perforante": "🏹", "Contundente": "🔨",
                            "Fuego": "🔥", "Frío": "❄️", "Relámpago": "⚡",
                            "Ácido": "🧪", "Veneno": "☠️", "Necrótico": "💀",
                            "Radiante": "✨", "Fuerza": "💪", "Psíquico": "🧠", "Trueno": "🔊"
                        };

                        const currentRes = data.resistencias || {};
                        hudResContainer.innerHTML = "";

                        for (const [rt, icon] of Object.entries(resTypes)) {
                            const val = currentRes[rt] !== undefined ? currentRes[rt] : 1;
                            hudResContainer.innerHTML += `
                                <div class="res-item" style="text-align: center;">
                                    <div class="res-icon" style="font-size: 24px;">${icon}</div>
                                    <div class="res-val" style="font-weight: bold; color: #d8cdb8;">x${val}</div>
                                    <div class="res-name" style="font-size: 10px; color: #a09585; text-transform: uppercase;">${rt}</div>
                                </div>
                            `;
                        }
                    }
                }).catch(err => console.error("Error loading HUD data:", err));
            }
        }

        const btnCloseLimbusHud = e.target.closest("#btn-close-limbus-hud");
        if (btnCloseLimbusHud) {
            const limbusHudOverlay = document.getElementById("limbus-hud-overlay");
            if (limbusHudOverlay) {
                limbusHudOverlay.style.display = "none";
            }
        }
    });
});
"""

if "btn-player-hud" not in content:
    with open('hoja_personaje.js', 'a') as f:
        f.write("\n" + new_logic + "\n")
    print("Injected via append.")
else:
    print("Already in file.")
