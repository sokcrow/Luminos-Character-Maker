import re

with open('pantalla_dm.html', 'r') as f:
    content = f.read()

# Add Splash Art URL, Actor Select, and Resistances Grid to the combat stats modal body
new_modal_body = """            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
              <div style="flex: 1;">
                <label>Max HP:</label>
                <input type="number" id="dm-combat-hp-max" class="input-cyber" style="width: 100%;" />
              </div>
              <div style="flex: 1;">
                <label>Actual HP:</label>
                <input type="number" id="dm-combat-hp-actual" class="input-cyber" style="width: 100%;" />
              </div>
              <div style="flex: 1;">
                <label>SP:</label>
                <input type="number" id="dm-combat-sp" class="input-cyber" style="width: 100%;" />
              </div>
            </div>

            <div style="margin-bottom: 15px;">
              <label>Actor del Teatro (Vínculo):</label>
              <select id="dm-combat-actor-id" class="input-cyber" style="width: 100%;">
                <option value="">-- Sin Actor --</option>
              </select>
            </div>

            <div style="margin-bottom: 15px;">
              <label>URL del Splash Art:</label>
              <input type="text" id="dm-combat-splash-url" class="input-cyber" style="width: 100%;" placeholder="https://..." />
            </div>

            <div style="margin-bottom: 15px;">
              <label style="color:#c49a00;">Editor de Resistencias (Predeterminado: 1)</label>
              <div id="dm-combat-resistances-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px;">
                <!-- Resistances injected dynamically -->
              </div>
            </div>"""

old_modal_body = """            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
              <div style="flex: 1;">
                <label>Max HP:</label>
                <input
                  type="number"
                  id="dm-combat-hp-max"
                  class="input-cyber"
                  style="width: 100%;"
                />
              </div>
              <div style="flex: 1;">
                <label>Actual HP:</label>
                <input
                  type="number"
                  id="dm-combat-hp-actual"
                  class="input-cyber"
                  style="width: 100%;"
                />
              </div>
              <div style="flex: 1;">
                <label>SP:</label>
                <input
                  type="number"
                  id="dm-combat-sp"
                  class="input-cyber"
                  style="width: 100%;"
                />
              </div>
            </div>"""

content = content.replace(old_modal_body, new_modal_body)

# Populate Actor Options & Resistances when modal opens
js_injection = """
            const hpMax = calcHpMax || 0;
            const hpActual =
              combatStats.hp_actual !== undefined
                ? combatStats.hp_actual
                : hpMax;
            const spActual = combatStats.sp_actual || 0;

            document.getElementById("dm-combat-hp-max").value = hpMax;
            document.getElementById("dm-combat-hp-actual").value = hpActual;
            document.getElementById("dm-combat-sp").value = spActual;

            // Actor Options
            const actorSelect = document.getElementById("dm-combat-actor-id");
            actorSelect.innerHTML = '<option value="">-- Sin Actor --</option>';
            if (typeof dbActoresCache !== 'undefined') {
                for (const [aId, aData] of Object.entries(dbActoresCache)) {
                    const opt = document.createElement("option");
                    opt.value = aId;
                    opt.innerText = aData.nombre;
                    if (playerData.actorId === aId) opt.selected = true;
                    actorSelect.appendChild(opt);
                }
            }

            // Splash Art
            document.getElementById("dm-combat-splash-url").value = playerData.splash_art || "";

            // Resistances Grid
            const resGrid = document.getElementById("dm-combat-resistances-grid");
            resGrid.innerHTML = "";
            const resTypes = ["Cortante", "Perforante", "Contundente", "Fuego", "Frío", "Relámpago", "Ácido", "Veneno", "Necrótico", "Radiante", "Fuerza", "Psíquico", "Trueno"];
            const currentRes = playerData.resistencias || {};

            resTypes.forEach(rt => {
                const resVal = currentRes[rt] !== undefined ? currentRes[rt] : 1;
                resGrid.innerHTML += `
                    <div style="display:flex; flex-direction:column; background:#111; padding:5px; border:1px solid #333; border-radius:3px;">
                        <label style="font-size:10px; color:#aaa; margin-bottom:2px;">${rt}</label>
                        <input type="number" step="0.1" class="res-input input-cyber" data-res="${rt}" value="${resVal}" style="width:100%; padding:2px; font-size:12px;">
                    </div>
                `;
            });
"""
content = re.sub(r'const spActual = combatStats\.sp_actual \|\| 0;[\s\S]*?document\.getElementById\("dm-combat-sp"\)\.value = spActual;', js_injection, content)

# Save logic updates
js_save_injection = """
            const updates = {
              "combatStats/hp_actual": hpActual,
              "combatStats/sp_actual": spActual,
              "actorId": document.getElementById("dm-combat-actor-id").value,
              "splash_art": document.getElementById("dm-combat-splash-url").value.trim()
            };

            const resInputs = document.querySelectorAll(".res-input");
            const resObj = {};
            resInputs.forEach(inp => {
                resObj[inp.getAttribute("data-res")] = parseFloat(inp.value) || 1;
            });
            updates["resistencias"] = resObj;
"""
content = re.sub(r'const updates = \{[\s\S]*?"combatStats/hp_actual": hpActual,[\s\S]*?"combatStats/sp_actual": spActual,[\s\S]*?\};', js_save_injection, content)

with open('pantalla_dm.html', 'w') as f:
    f.write(content)

print("Added new fields to DM combat stats modal and save logic")
