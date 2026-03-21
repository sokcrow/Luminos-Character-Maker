with open('hoja_personaje.html', 'r') as f:
    content = f.read()

# Check if modal already exists
if 'character-name-modal' not in content:
    # Insert before </body>
    modal_html = """
    <!-- Identity Verification Modal -->
    <div id="character-name-modal" class="sheet-modal-container" style="display: none; z-index: 9999; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); justify-content: center; align-items: center; backdrop-filter: blur(5px);">
        <div class="sheet-modal" style="display: flex; flex-direction: column; width: 450px; background: #0B0A0A; border: 6px solid #3E2723; padding: 30px; position: relative; box-shadow: 0 0 20px rgba(211, 47, 47, 0.4); border-radius: 0;">
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: repeating-linear-gradient(0deg, rgba(62, 39, 35, 0.08), rgba(62, 39, 35, 0.08) 1px, transparent 1px, transparent 4px); pointer-events: none;"></div>
            <div style="position: absolute; top: 6px; left: 6px; right: 6px; bottom: 6px; border: 1px solid #D32F2F; pointer-events: none;"></div>

            <h2 style="color: #FFD700; font-family: 'Oswald', sans-serif; text-transform: uppercase; margin: 0 0 15px 0; border-bottom: 2px solid #D32F2F; padding-bottom: 10px; text-align: center; font-size: 1.8rem; z-index: 1;">VERIFICACIÓN DE IDENTIDAD</h2>

            <p style="color: #E8E4D9; font-family: 'Share Tech Mono', monospace; font-size: 0.95rem; text-align: center; margin-bottom: 25px; z-index: 1;">Ingrese el identificador oficial (Nombre de Personaje) para acceder al registro del archivo.</p>

            <input type="text" id="character-name-input" placeholder="Nombre exacto del personaje..." style="background: #111; border: 2px solid #3E2723; color: #FFD700; padding: 12px; font-family: 'Share Tech Mono', monospace; font-size: 1.2rem; outline: none; margin-bottom: 20px; text-align: center; z-index: 1;">

            <button id="btn-confirm-character-name" style="background: #E8E4D9; color: #3E2723; border: 1px solid #3E2723; padding: 12px; font-family: 'Oswald', sans-serif; font-size: 1.2rem; font-weight: bold; text-transform: uppercase; cursor: pointer; transition: all 0.2s; z-index: 1; border-radius: 0;">CONFIRMAR IDENTIDAD</button>
        </div>
    </div>
"""
    content = content.replace('</body>', f'{modal_html}\n</body>')

with open('hoja_personaje.html', 'w') as f:
    f.write(content)
