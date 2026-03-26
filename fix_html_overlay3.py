with open('hoja_personaje.html', 'r') as f:
    content = f.read()

import re

# Use exactly what we verified worked from `test_limbus.py`
overlay_html = """<!-- LIMBUS HUD OVERLAY -->
<div id="limbus-hud-overlay" class="limbus-hud-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(5,5,5,0.85); z-index: 10000; justify-content: center; align-items: center;">
    <div class="limbus-hud-container" style="display: flex; flex-direction: row; width: 80vw; height: 80vh; background: #0B0A0A; border: 6px solid #3E2723; position: relative; box-shadow: 0 0 20px rgba(0,0,0,0.8);">
        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; border: 1px solid #D32F2F; pointer-events: none; z-index: 2;"></div>
        <button id="btn-close-limbus-hud" class="btn-close-limbus" style="position: absolute; top: 10px; right: 10px; background: #D32F2F; color: #E8E4D9; border: 2px solid #3E2723; padding: 5px 15px; font-weight: bold; cursor: pointer; z-index: 10;">CERRAR</button>

        <div class="limbus-left-panel" style="flex: 1; display: flex; flex-direction: column; border-right: 2px solid #3a2515; background: linear-gradient(180deg, rgba(20,15,10,0.9) 0%, rgba(10,5,5,1) 100%);">
            <div class="limbus-splash-container" style="flex: 1; position: relative; overflow: hidden; border-bottom: 2px solid #3a2515;">
                <img id="hud-player-splash" src="Assets/imagen/default-splash.png" alt="Splash Art" style="width: 100%; height: 100%; object-fit: cover; object-position: top center; opacity: 0.9;">
            </div>
            <div class="limbus-resistances" id="hud-player-resistances-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(60px, 1fr)); gap: 10px; padding: 15px; background: rgba(0,0,0,0.6);">
            </div>
        </div>
        <div class="limbus-right-panel" style="flex: 1; padding: 20px; background: repeating-linear-gradient(0deg, rgba(62, 39, 35, 0.08), rgba(62, 39, 35, 0.08) 1px, transparent 1px, transparent 4px);">
            <h2 style="color: #FFD700; border-bottom: 1px solid #3E2723; padding-bottom: 10px; font-family: 'Courier New', Courier, monospace; text-transform: uppercase; text-align: left;">Detalles del Pecador</h2>
            <!-- Additional info can go here -->
        </div>
    </div>
</div>
</body>
</html>"""

content = re.sub(r'<!-- LIMBUS HUD OVERLAY -->.*', overlay_html, content, flags=re.DOTALL)

with open('hoja_personaje.html', 'w') as f:
    f.write(content)
print("Updated HUD HTML again.")
