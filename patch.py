import re

with open('pantalla_dm.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace innerHTML clears and add fragments
search_start = """
        db.ref("campaña/jugadores/").on("value", (snapshot) => {
          bancoContainer.innerHTML = "";
          const jugadores = snapshot.val();
          window.jugadoresData = jugadores; // Guarda para el modal

          const pendingContainer = document.getElementById(
            "grid-reclutas-pendientes",
          );
          if (pendingContainer) pendingContainer.innerHTML = "";
"""

replace_start = """
        db.ref("campaña/jugadores/").on("value", (snapshot) => {
          bancoContainer.innerHTML = "";
          const jugadores = snapshot.val();
          window.jugadoresData = jugadores; // Guarda para el modal

          const pendingContainer = document.getElementById(
            "grid-reclutas-pendientes",
          );
          if (pendingContainer) pendingContainer.innerHTML = "";

          // ⚡ Bolt Optimization: Use DocumentFragment to batch DOM insertions.
          // 💡 What: Replaced direct container appends with DocumentFragments inside the 'campaña/jugadores/' listener loop.
          // 🎯 Why: Appending directly to the DOM in a loop causes O(n) layout reflows and repaints.
          // 📊 Impact: Reduces DOM reflows from O(n) to O(1) per update, improving DM screen performance when player data syncs.
          const fragPending = document.createDocumentFragment();
          const fragJugadores = document.createDocumentFragment();
          const fragBanco = document.createDocumentFragment();
          const fragComms = document.createDocumentFragment();
          const fragLoot = document.createDocumentFragment();
          const fragReceta = document.createDocumentFragment();
          const fragTienda = document.createDocumentFragment();
"""

content = content.replace(search_start, replace_start)

# Replace the specific appends
# 1. pendingContainer.appendChild(pendingCard); -> fragPending.appendChild(pendingCard);
content = content.replace("pendingContainer.appendChild(pendingCard);", "fragPending.appendChild(pendingCard);")

# 2. jugadoresContainer.appendChild(pCard); -> fragJugadores.appendChild(pCard);
content = content.replace("jugadoresContainer.appendChild(pCard);", "fragJugadores.appendChild(pCard);")

# 3. bancoContainer.appendChild(tarjeta); -> fragBanco.appendChild(tarjeta);
content = content.replace("bancoContainer.appendChild(tarjeta);", "fragBanco.appendChild(tarjeta);")

# Replace comms select options and loop
search_comms = """            // --- Populate Terminal de Comunicaciones Select ---
            const commsJugadorSelect = document.getElementById("comms-jugador");
            if (commsJugadorSelect) {
              commsJugadorSelect.innerHTML =
                '<option value="">Selecciona Jugador...</option>';
              for (const nombre of Object.keys(jugadores)) {
                const option = document.createElement("option");
                option.value = nombre;
                option.textContent = nombre;
                commsJugadorSelect.appendChild(option);
              }
            }"""

replace_comms = """            // --- Populate Terminal de Comunicaciones Select ---
            const commsJugadorSelect = document.getElementById("comms-jugador");
            if (commsJugadorSelect) {
              commsJugadorSelect.innerHTML =
                '<option value="">Selecciona Jugador...</option>';
              for (const nombre of Object.keys(jugadores)) {
                const option = document.createElement("option");
                option.value = nombre;
                option.textContent = nombre;
                fragComms.appendChild(option);
              }
            }"""

content = content.replace(search_comms, replace_comms)


# Replace loot select options and loop
search_loot = """            // --- Populate Generador de Botín Jugador Select ---
            const lootJugadorSelect = document.getElementById(
              "loot-select-jugador",
            );
            if (lootJugadorSelect) {
              lootJugadorSelect.innerHTML =
                '<option value="">Selecciona Jugador...</option>';
              for (const nombre of Object.keys(jugadores)) {
                const option = document.createElement("option");
                option.value = nombre;
                option.textContent = nombre;
                lootJugadorSelect.appendChild(option);
              }
            }"""

replace_loot = """            // --- Populate Generador de Botín Jugador Select ---
            const lootJugadorSelect = document.getElementById(
              "loot-select-jugador",
            );
            if (lootJugadorSelect) {
              lootJugadorSelect.innerHTML =
                '<option value="">Selecciona Jugador...</option>';
              for (const nombre of Object.keys(jugadores)) {
                const option = document.createElement("option");
                option.value = nombre;
                option.textContent = nombre;
                fragLoot.appendChild(option);
              }
            }"""

content = content.replace(search_loot, replace_loot)

# Replace receta check
search_receta = """            // --- Populate Recetas Checkboxes ---
            const recetaJugadores = document.getElementById(
              "lista-check-jugadores",
            );
            if (recetaJugadores) {
              recetaJugadores.innerHTML = "";
              for (const nombre of Object.keys(jugadores)) {
                const lbl = document.createElement("label");
                lbl.style.cssText =
                  "color:#fff; font-size:12px; display:flex; align-items:center; gap:3px; background:#111; padding:3px 6px; border-radius:3px; border:1px solid #333; cursor:pointer;";
                lbl.innerHTML = `<input type="checkbox" value="${nombre}" class="check-jugador-receta" /> ${nombre}`;
                recetaJugadores.appendChild(lbl);
              }
            }"""

replace_receta = """            // --- Populate Recetas Checkboxes ---
            const recetaJugadores = document.getElementById(
              "lista-check-jugadores",
            );
            if (recetaJugadores) {
              recetaJugadores.innerHTML = "";
              for (const nombre of Object.keys(jugadores)) {
                const lbl = document.createElement("label");
                lbl.style.cssText =
                  "color:#fff; font-size:12px; display:flex; align-items:center; gap:3px; background:#111; padding:3px 6px; border-radius:3px; border:1px solid #333; cursor:pointer;";
                lbl.innerHTML = `<input type="checkbox" value="${nombre}" class="check-jugador-receta" /> ${nombre}`;
                fragReceta.appendChild(lbl);
              }
            }"""

content = content.replace(search_receta, replace_receta)


# Replace tienda check
search_tienda = """            // --- Populate Tienda Jugadores Presentes Checkboxes ---
            const tiendaJugadoresPresentes = document.getElementById(
              "tienda-jugadores-presentes",
            );
            if (tiendaJugadoresPresentes) {
              tiendaJugadoresPresentes.innerHTML = "";
              for (const nombre of Object.keys(jugadores)) {
                const lbl = document.createElement("label");
                lbl.style.cssText =
                  "color:#fff; font-size:12px; display:flex; align-items:center; gap:3px; background:#111; padding:3px 6px; border-radius:3px; border:1px solid #333; cursor:pointer;";
                lbl.innerHTML = `<input type="checkbox" value="${nombre}" class="tienda-jugador-cb" /> ${nombre}`;
                tiendaJugadoresPresentes.appendChild(lbl);
              }
            }
          } else {"""

replace_tienda = """            // --- Populate Tienda Jugadores Presentes Checkboxes ---
            const tiendaJugadoresPresentes = document.getElementById(
              "tienda-jugadores-presentes",
            );
            if (tiendaJugadoresPresentes) {
              tiendaJugadoresPresentes.innerHTML = "";
              for (const nombre of Object.keys(jugadores)) {
                const lbl = document.createElement("label");
                lbl.style.cssText =
                  "color:#fff; font-size:12px; display:flex; align-items:center; gap:3px; background:#111; padding:3px 6px; border-radius:3px; border:1px solid #333; cursor:pointer;";
                lbl.innerHTML = `<input type="checkbox" value="${nombre}" class="tienda-jugador-cb" /> ${nombre}`;
                fragTienda.appendChild(lbl);
              }
            }

            // ⚡ Append fragments to containers
            if (pendingContainer) pendingContainer.appendChild(fragPending);
            if (jugadoresContainer) jugadoresContainer.appendChild(fragJugadores);
            if (bancoContainer) bancoContainer.appendChild(fragBanco);
            if (commsJugadorSelect) commsJugadorSelect.appendChild(fragComms);
            if (lootJugadorSelect) lootJugadorSelect.appendChild(fragLoot);
            if (recetaJugadores) recetaJugadores.appendChild(fragReceta);
            if (tiendaJugadoresPresentes) tiendaJugadoresPresentes.appendChild(fragTienda);

          } else {"""

content = content.replace(search_tienda, replace_tienda)

with open('pantalla_dm.html', 'w', encoding='utf-8') as f:
    f.write(content)
