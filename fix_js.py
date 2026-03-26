with open('hoja_personaje.js', 'r') as f:
    content = f.read()

new_logic = """
        // -------------------------------------------------------------
        // NEW PLAYER HUD (LIMBUS OVERLAY)
        // -------------------------------------------------------------
        const btnPlayerHud = document.getElementById("btn-player-hud");
        const limbusHudOverlay = document.getElementById("limbus-hud-overlay");
        const btnCloseLimbusHud = document.getElementById("btn-close-limbus-hud");
        const hudPlayerSplash = document.getElementById("hud-player-splash");
        const hudResContainer = document.getElementById("hud-player-resistances-container");

        if (btnPlayerHud && limbusHudOverlay) {
            btnPlayerHud.addEventListener("click", () => {
                limbusHudOverlay.style.display = "flex";

                // Fetch player data on open
                db.ref(`campaña/jugadores/${playerId}`).once("value").then((snapshot) => {
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
                                <div class="res-item">
                                    <span class="res-icon">${icon}</span>
                                    <span class="res-val">x${val}</span>
                                    <span class="res-name">${rt}</span>
                                </div>
                            `;
                        }
                    }
                });
            });

            btnCloseLimbusHud.addEventListener("click", () => {
                limbusHudOverlay.style.display = "none";
            });
        }
"""

if "// Cerrar inventario si se hace click fuera" in content:
    content = content.replace("// Cerrar inventario si se hace click fuera", new_logic + "\n        // Cerrar inventario si se hace click fuera")

with open('hoja_personaje.js', 'w') as f:
    f.write(content)
print("Injected HUD sync logic into hoja_personaje.js")
