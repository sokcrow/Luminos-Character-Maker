with open('hoja_personaje.html', 'r') as f:
    content = f.read()

old_container = """    <div class="hud-right-container" style="position: fixed; right: 20px; bottom: 20px; z-index: 9999; flex-direction: column-reverse; align-items: flex-end;">
        <button id="btn-abrir-escritura" class="control-btn" title="Actuar en el Teatro">
            <svg viewBox="0 0 24 24" fill="none" stroke="#e0e0e0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 60%; height: 60%; filter: drop-shadow(0 0 5px rgba(255, 157, 0, 0.8));">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
        </button>
    <button class="btn-global-inventory btn-icon-base size-36" id="btn-global-inventory" title="Inventario Global" aria-label="Inventario Global"><img src="Assets/Images/Buttons/Inventory.svg" class="svg-icon" alt="Inventory" /><img id="tienda-fisica-badge" src="" style="display: none" /></button>

    </div>"""

new_container = """    <div class="hud-right-container">
        <!-- BASE DE LA TORRE: Botón Escribir (será empujado hacia abajo por column-reverse) -->
        <button id="btn-abrir-escritura" class="control-btn" title="Actuar en el Teatro">
            <svg viewBox="0 0 24 24" fill="none" stroke="#e0e0e0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 60%; height: 60%; filter: drop-shadow(0 0 5px rgba(255, 157, 0, 0.8));">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
        </button>

        <!-- SEGUNDO PISO: Botón Player HUD -->
        <button id="btn-player-hud" class="control-btn" title="HUD de Jugador">
            <svg viewBox="0 0 24 24" fill="none" stroke="#e0e0e0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 60%; height: 60%; filter: drop-shadow(0 0 5px rgba(255, 157, 0, 0.8));">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>
        </button>

        <!-- TERCER PISO: Inventario -->
        <button class="btn-global-inventory btn-icon-base size-36" id="btn-global-inventory" title="Inventario Global" aria-label="Inventario Global"><img src="Assets/Images/Buttons/Inventory.svg" class="svg-icon" alt="Inventory" /><img id="tienda-fisica-badge" src="" style="display: none" /></button>
    </div>"""

if old_container in content:
    content = content.replace(old_container, new_container)
    with open('hoja_personaje.html', 'w') as f:
        f.write(content)
    print("Replaced successfully")
else:
    print("Not found")
