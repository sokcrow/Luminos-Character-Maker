import re

with open("hoja_personaje.html", "r", encoding="utf-8") as f:
    html = f.read()

# Replace the entire old <div class="equipment-grid"> block with the new layout
search_str = r'<div class="equipment-grid">[\s\S]*?</div>\s*</div>\s*</div>\s*<div class="inventory-tab-content" id="inv-stash">'

replacement_str = '''<div class="equipamiento-layout">
            <div class="fila-principal">
                <!-- Arma Principal -->
                <div class="equip-slot slot-mano" data-slot-id="arma_principal">
                    <span class="tier"></span>
                    <span class="slot-label">Arma Principal</span>
                    <div class="item-display">
                        <div class="item-icon"></div>
                        <span class="item-name">Vacío</span>
                    </div>
                    <div class="keyword-slots-container">
                        <div class="keyword-node empty"></div>
                        <div class="keyword-node empty"></div>
                        <div class="keyword-node empty"></div>
                    </div>
                    <span class="slot-stat">OFF LVL: +0</span>
                </div>

                <!-- Armadura -->
                <div class="equip-slot slot-cuerpo" data-slot-id="armadura">
                    <span class="tier"></span>
                    <span class="slot-label">Armadura</span>
                    <div class="item-display">
                        <div class="item-icon"></div>
                        <span class="item-name">Vacío</span>
                    </div>
                    <div class="keyword-slots-container">
                        <div class="keyword-node empty"></div>
                        <div class="keyword-node empty"></div>
                        <div class="keyword-node empty"></div>
                    </div>
                    <span class="slot-stat">DEF LVL: +0</span>
                </div>

                <!-- Arma Secundaria / Escudo -->
                <div class="equip-slot slot-mano" data-slot-id="arma_secundaria">
                    <span class="tier"></span>
                    <span class="slot-label">Arma Sec. / Escudo</span>
                    <div class="item-display">
                        <div class="item-icon"></div>
                        <span class="item-name">Vacío</span>
                    </div>
                    <div class="keyword-slots-container">
                        <div class="keyword-node empty"></div>
                        <div class="keyword-node empty"></div>
                        <div class="keyword-node empty"></div>
                    </div>
                    <span class="slot-stat">OFF LVL: +0</span>
                </div>
            </div>

            <div class="fila-accesorios">
                <!-- Munición / Carcaj -->
                <div class="equip-slot slot-acc" data-slot-id="municion">
                    <span class="tier"></span>
                    <span class="slot-label">Munición / Carcaj</span>
                    <div class="item-display">
                        <div class="item-icon"></div>
                        <span class="item-name">Vacío</span>
                    </div>
                    <div class="keyword-slots-container">
                        <div class="keyword-node empty"></div>
                        <div class="keyword-node empty"></div>
                        <div class="keyword-node empty"></div>
                    </div>
                    <span class="slot-stat">OFF LVL: +0</span>
                </div>

                <!-- Accesorio 1 -->
                <div class="equip-slot slot-acc" data-slot-id="accesorio_1">
                    <span class="tier"></span>
                    <span class="slot-label">Accesorio 1</span>
                    <div class="item-display">
                        <div class="item-icon"></div>
                        <span class="item-name">Vacío</span>
                    </div>
                    <div class="keyword-slots-container">
                        <div class="keyword-node empty"></div>
                        <div class="keyword-node empty"></div>
                        <div class="keyword-node empty"></div>
                    </div>
                </div>

                <!-- Accesorio 2 -->
                <div class="equip-slot slot-acc" data-slot-id="accesorio_2">
                    <span class="tier"></span>
                    <span class="slot-label">Accesorio 2</span>
                    <div class="item-display">
                        <div class="item-icon"></div>
                        <span class="item-name">Vacío</span>
                    </div>
                    <div class="keyword-slots-container">
                        <div class="keyword-node empty"></div>
                        <div class="keyword-node empty"></div>
                        <div class="keyword-node empty"></div>
                    </div>
                </div>

                <!-- Accesorio 3 -->
                <div class="equip-slot slot-acc" data-slot-id="accesorio_3">
                    <span class="tier"></span>
                    <span class="slot-label">Accesorio 3</span>
                    <div class="item-display">
                        <div class="item-icon"></div>
                        <span class="item-name">Vacío</span>
                    </div>
                    <div class="keyword-slots-container">
                        <div class="keyword-node empty"></div>
                        <div class="keyword-node empty"></div>
                        <div class="keyword-node empty"></div>
                    </div>
                </div>

                <!-- Accesorio 4 -->
                <div class="equip-slot slot-acc" data-slot-id="accesorio_4">
                    <span class="tier"></span>
                    <span class="slot-label">Accesorio 4</span>
                    <div class="item-display">
                        <div class="item-icon"></div>
                        <span class="item-name">Vacío</span>
                    </div>
                    <div class="keyword-slots-container">
                        <div class="keyword-node empty"></div>
                        <div class="keyword-node empty"></div>
                        <div class="keyword-node empty"></div>
                    </div>
                </div>
            </div>
        </div>
</div>

                <div class="inventory-tab-content" id="inv-stash">'''

html_patched = re.sub(search_str, replacement_str, html, flags=re.DOTALL)

with open("hoja_personaje.html", "w", encoding="utf-8") as f:
    f.write(html_patched)

print("Applied HTML layout fix.")
