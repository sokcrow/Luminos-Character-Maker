const fs = require('fs');
let html = fs.readFileSync('hoja_personaje.html', 'utf8');

const forjaBtn = `              <button type="action" name="act_tab_forja" class="sheet-app-btn">
                <div class="sheet-app-icon" style="display: flex; justify-content: center; align-items: center; width: 100%; height: 100%;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 24px; height: 24px;">
                        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                        <polyline points="2 17 12 22 22 17"></polyline>
                        <polyline points="2 12 12 17 22 12"></polyline>
                    </svg>
                </div>
                <span>Síntesis</span>
              </button>
`;

html = html.replace('              <button type="action" name="act_tab_notas" class="sheet-app-btn">', forjaBtn + '              <button type="action" name="act_tab_notas" class="sheet-app-btn">');

const forjaTab = `
          <!-- Forja Tab -->
          <div class="sheet-tab-content sheet-tab-forja">
            <div class="sheet-app-header"><h2>Forja / Síntesis</h2></div>
            <div class="sheet-app-body" style="padding: 20px;">
                <div style="background: var(--panel-metal); border: 2px solid var(--panel-oxidado); padding: 20px; border-radius: 4px;">
                    <h3 style="color: var(--cyan-tech); text-align: center; margin-top: 0; font-family: 'BebasKai'; letter-spacing: 2px;">NÚCLEO DE SÍNTESIS</h3>

                    <div style="display: flex; flex-wrap: wrap; gap: 15px; justify-content: center; margin-top: 20px; margin-bottom: 20px;" id="forja-slots-container">
                        <!-- Slot 1 -->
                        <div class="forja-slot" data-slot="1" style="width: 80px; height: 80px; background: #000; border: 2px dashed #444; border-radius: 4px; display: flex; flex-direction: column; justify-content: center; align-items: center; cursor: pointer; position: relative;">
                            <span style="color: #666; font-size: 24px;">+</span>
                        </div>
                        <!-- Slot 2 -->
                        <div class="forja-slot" data-slot="2" style="width: 80px; height: 80px; background: #000; border: 2px dashed #444; border-radius: 4px; display: flex; flex-direction: column; justify-content: center; align-items: center; cursor: pointer; position: relative;">
                            <span style="color: #666; font-size: 24px;">+</span>
                        </div>
                        <!-- Slot 3 -->
                        <div class="forja-slot" data-slot="3" style="width: 80px; height: 80px; background: #000; border: 2px dashed #444; border-radius: 4px; display: flex; flex-direction: column; justify-content: center; align-items: center; cursor: pointer; position: relative;">
                            <span style="color: #666; font-size: 24px;">+</span>
                        </div>
                        <!-- Slot 4 (Bloqueado) -->
                        <div class="forja-slot locked" data-slot="4" style="width: 80px; height: 80px; background: #000; border: 2px solid #555; border-radius: 4px; display: flex; justify-content: center; align-items: center; position: relative; overflow: hidden; cursor: not-allowed;">
                            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: repeating-linear-gradient(45deg, #000, #000 10px, #ffaa00 10px, #ffaa00 20px); opacity: 0.3;"></div>
                            <svg viewBox="0 0 24 24" fill="none" stroke="#ffaa00" stroke-width="2" style="width: 30px; height: 30px; position: relative; z-index: 2;">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </div>
                        <!-- Slot 5 (Bloqueado) -->
                        <div class="forja-slot locked" data-slot="5" style="width: 80px; height: 80px; background: #000; border: 2px solid #555; border-radius: 4px; display: flex; justify-content: center; align-items: center; position: relative; overflow: hidden; cursor: not-allowed;">
                            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: repeating-linear-gradient(45deg, #000, #000 10px, #ffaa00 10px, #ffaa00 20px); opacity: 0.3;"></div>
                            <svg viewBox="0 0 24 24" fill="none" stroke="#ffaa00" stroke-width="2" style="width: 30px; height: 30px; position: relative; z-index: 2;">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </div>
                    </div>

                    <div style="text-align: center; margin-top: 30px;">
                        <button id="btn-iniciar-sintesis" style="background: #111; color: var(--cyan-tech); border: 2px solid var(--cyan-tech); padding: 15px 30px; font-family: 'Share Tech Mono'; font-size: 18px; font-weight: bold; cursor: pointer; text-transform: uppercase; transition: all 0.2s; box-shadow: 0 0 10px rgba(0,221,255,0.2);">INICIAR SÍNTESIS</button>
                    </div>
                </div>
            </div>

            <!-- Modal Selección Ingrediente -->
            <div id="forja-select-modal" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 200; flex-direction: column; justify-content: center; align-items: center;">
                <div style="background: #111; border: 2px solid var(--cyan-tech); padding: 20px; width: 90%; max-width: 400px; max-height: 80vh; display: flex; flex-direction: column; border-radius: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 15px;">
                        <h3 style="color: var(--cyan-tech); margin: 0; font-family: 'BebasKai';">Seleccionar Ingrediente</h3>
                        <button id="btn-cerrar-forja-modal" style="background: none; border: none; color: #ff4444; font-size: 20px; cursor: pointer;">&times;</button>
                    </div>

                    <input type="text" id="forja-search-input" placeholder="Buscar..." style="padding: 10px; background: #000; border: 1px solid #444; color: #fff; margin-bottom: 10px; font-family: 'Share Tech Mono'; width: 100%; box-sizing: border-box;">

                    <div id="forja-inventory-list" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 5px;">
                        <!-- Items inyectados -->
                    </div>
                </div>
            </div>

            <!-- Modal de Tirada -->
            <div id="forja-roll-modal" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 300; flex-direction: column; justify-content: center; align-items: center;">
                <div style="background: #111; border: 2px solid #c49a00; padding: 25px; width: 90%; max-width: 400px; display: flex; flex-direction: column; align-items: center; border-radius: 4px; box-shadow: 0 0 20px rgba(196,154,0,0.4);">
                    <h3 style="color: #c49a00; margin: 0 0 10px 0; font-family: 'BebasKai'; font-size: 24px; text-transform: uppercase;">PROCESO DE FORJA INICIADO</h3>
                    <p style="color: #aaa; text-align: center; margin-bottom: 20px;">Dificultad Actual: <span id="forja-roll-dc" style="color: #fff; font-weight: bold; font-size: 1.2em;">--</span></p>

                    <input type="number" id="forja-roll-input" placeholder="Ingresa el resultado de tu tirada..." style="padding: 15px; background: #000; border: 1px solid #c49a00; color: #fff; text-align: center; font-size: 18px; width: 100%; box-sizing: border-box; margin-bottom: 20px;">

                    <div style="display: flex; gap: 10px; width: 100%;">
                        <button id="btn-cancelar-roll" style="flex: 1; padding: 12px; background: #333; color: #fff; border: none; cursor: pointer; font-family: 'Share Tech Mono';">CANCELAR</button>
                        <button id="btn-confirmar-roll" style="flex: 2; padding: 12px; background: #c49a00; color: #000; border: none; font-weight: bold; cursor: pointer; font-family: 'Share Tech Mono';">PROCESAR SÍNTESIS</button>
                    </div>
                </div>
            </div>

          </div>
`;

html = html.replace('          <!-- Mapa Tab -->', forjaTab + '\n          <!-- Mapa Tab -->');
fs.writeFileSync('hoja_personaje.html', html);

// Modify hoja_personaje.css to support new tab
let css = fs.readFileSync('hoja_personaje.css', 'utf8');
css = css.replace('.sheet-limbus-main input[name="attr_tab"][value="settings"] ~ .sheet-main-content .sheet-tab-settings,', '.sheet-limbus-main input[name="attr_tab"][value="settings"] ~ .sheet-main-content .sheet-tab-settings,\n.sheet-limbus-main input[name="attr_tab"][value="forja"] ~ .sheet-main-content .sheet-tab-forja,');
css = css.replace('input[name="attr_tab"][value="settings"] ~ .sheet-phone-screen .sheet-tab-settings,', 'input[name="attr_tab"][value="settings"] ~ .sheet-phone-screen .sheet-tab-settings,\ninput[name="attr_tab"][value="forja"] ~ .sheet-phone-screen .sheet-tab-forja,');

fs.writeFileSync('hoja_personaje.css', css);
