import re

with open('hoja_personaje.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace old shop tab button with crafteo button
content = re.sub(
    r'<button type="action" name="act_tab_shop" class="sheet-app-btn" id="btn-app-shop" style="display: none;"><div class="sheet-app-icon">🛒</div><span>Tienda Local</span></button>\n\s*<button type="action" name="act_tab_crafteo" class="sheet-app-btn"><div class="sheet-app-icon">🛠️</div><span>Mesa de Trabajo</span></button>',
    '<button type="action" name="act_tab_crafteo" class="sheet-app-btn"><div class="sheet-app-icon">🛠️</div><span>Mesa de Trabajo</span></button>',
    content
)

# Replace the content of the crafteo-app tab
new_crafteo_html = """<div class="sheet-tab-content sheet-tab-crafteo" id="crafteo-app">
    <div class="sheet-app-header"><h2>Mesa de Trabajo</h2></div>
    <div class="sheet-app-body crafteo-container" style="padding: 0; display: flex; height: calc(100% - 40px); background-color: #1a1a1a;">
        <!-- Left Column: Recipe Grid -->
        <div class="crafteo-grid-zone" style="flex: 0 0 60%; max-width: 60%; padding: 10px; overflow-y: auto; background-color: #222; border-right: 2px solid #333;">
            <div id="lista-recetas-crafteo" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 10px; align-content: start;">
                <!-- Recetas inyectadas por JS (iconos) -->
            </div>
        </div>
        <!-- Right Column: Detail Panel -->
        <div class="crafteo-detail-zone" id="detalle-receta-crafteo" style="flex: 0 0 40%; max-width: 40%; padding: 10px; display: flex; flex-direction: column; background-color: #111; position: relative;">
            <div style="text-align: center; color: #888; margin-top: 50%;">Selecciona una receta</div>
        </div>
    </div>
 </div>"""

content = re.sub(
    r'<div class="sheet-tab-content sheet-tab-crafteo" id="crafteo-app">.*?</button>\n\s*</div>\n\s*</div>\n\s*</div>\n\s*</div>\n\s*</div>\n\s*</div>\n\s*</div>',
    new_crafteo_html,
    content,
    flags=re.DOTALL
)

with open('hoja_personaje.html', 'w', encoding='utf-8') as f:
    f.write(content)
