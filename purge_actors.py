with open('pantalla_dm.html', 'r') as f:
    content = f.read()

# 1. Remove Jugador radio buttons from actor form
actor_tipo_html = """              <div class="radio-group">
                <label
                  ><input
                    type="radio"
                    name="actor-tipo"
                    id="actor-tipo-npc"
                    value="NPC"
                    checked
                  />
                  NPC</label
                >
                <label
                  ><input
                    type="radio"
                    name="actor-tipo"
                    id="actor-tipo-jugador"
                    value="Jugador"
                  />
                  Jugador</label
                >
              </div>"""

if actor_tipo_html in content:
    content = content.replace(actor_tipo_html, """              <div class="radio-group">
                <label>
                  <input type="radio" name="actor-tipo" id="actor-tipo-npc" value="NPC" checked style="display:none;" />
                  <span style="color:#888;">Este gestor ahora es exclusivo para NPCs/Monstruos.</span>
                </label>
              </div>""")

# 2. Remove Actor Assignment from actors tab
actor_assign_html = """          <div class="dashboard-card" style="margin-top: 20px;">
            <h3>🎭 Asignación de Actores a Jugadores</h3>
            <p style="color: #888; font-size: 12px; margin-bottom: 10px;">Víncula un jugador con su actor correspondiente para el Teatro.</p>
            <div id="actor-asignacion-lista" style="display: flex; flex-direction: column; gap: 10px;">
                <!-- Lista inyectada por JS -->
            </div>
          </div>"""
if actor_assign_html in content:
    content = content.replace(actor_assign_html, "")

with open('pantalla_dm.html', 'w') as f:
    f.write(content)
print("Purged actor type radio and actor assignment HTML from pantalla_dm.html")
