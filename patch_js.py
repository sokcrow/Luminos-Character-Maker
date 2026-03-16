import re

with open('hoja_personaje.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace renderRecetasCrafteo
new_render_recetas = """function renderRecetasCrafteo() {
    const listaRecetas = document.getElementById('lista-recetas-crafteo');
    const playerName = document.querySelector('input[name="attr_character_name"]')?.value.trim();

    if (!listaRecetas || !playerName) return;

    listaRecetas.innerHTML = '';

    if (Object.keys(recetasCache).length === 0) {
        listaRecetas.innerHTML = '<div style="color:#666; text-align:center; padding:20px; grid-column: 1 / -1;">No hay recetas disponibles.</div>';
        return;
    }

    for (const [idReceta, receta] of Object.entries(recetasCache)) {
        // Filtrar acceso
        if (receta.acceso === 'Restringido' && (!receta.jugadores || !receta.jugadores[playerName])) {
            continue;
        }

        const btn = document.createElement('div');

        // Find icon from base items if available, else placeholder
        let iconUrl = 'https://i.imgur.com/8QZ7XqY.png'; // Fallback
        let itemName = receta.nombre;
        let itemTier = 1;

        // Check if there's a matching item in dbItemsCacheGlobal to get its icon
        if (receta.resultado && Array.isArray(receta.resultado) && receta.resultado.length > 0) {
            const resItemId = receta.resultado[0].idItem;
            if (dbItemsCacheGlobal[resItemId]) {
                iconUrl = dbItemsCacheGlobal[resItemId].icono || iconUrl;
                itemName = dbItemsCacheGlobal[resItemId].nombre || itemName;
                itemTier = dbItemsCacheGlobal[resItemId].tier || 1;
            }
        }

        // Determine if unlocked (has been crafted before)
        // Assume unlocked for now, per user's image it can be blacked out if not unlocked, but we need to track that.
        // For now, let's just render the icon.
        // If we want the silhouette effect, we can apply `.blacked-out` based on player's discovered recipes.
        // Let's assume `window.datosJugador.recetas_descubiertas` tracks it (from AGENTS.md).
        const isDiscovered = window.datosJugador && window.datosJugador.recetas_descubiertas && window.datosJugador.recetas_descubiertas[idReceta];

        btn.style.cssText = `
            width: 64px;
            height: 64px;
            background: url('${iconUrl}') center/cover;
            border: 2px solid ${isDiscovered ? '#ffaa00' : '#444'};
            cursor: pointer;
            position: relative;
            box-sizing: border-box;
            filter: ${isDiscovered ? 'none' : 'brightness(0) drop-shadow(0 0 2px #444)'};
            transition: transform 0.1s;
        `;

        // Hover effect
        btn.onmouseover = () => btn.style.transform = 'scale(1.05)';
        btn.onmouseout = () => btn.style.transform = 'scale(1)';

        // Tier Indicator (if discovered)
        if (isDiscovered) {
            const tierEl = document.createElement('div');
            const romanTiers = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
            tierEl.innerText = romanTiers[itemTier - 1] || 'I';
            tierEl.style.cssText = 'position: absolute; top: 2px; left: 2px; color: #ffaa00; font-weight: bold; font-family: "Mikodacs", sans-serif; font-size: 12px; text-shadow: 1px 1px 0 #000, -1px -1px 0 #000;';
            btn.appendChild(tierEl);
        }

        btn.onclick = () => {
            // Deseleccionar otros (remove highlight border)
            Array.from(listaRecetas.children).forEach(c => {
                c.style.borderColor = c.style.filter.includes('brightness') ? '#444' : '#ffaa00';
                c.style.boxShadow = 'none';
            });
            btn.style.borderColor = '#0df'; // Select color
            btn.style.boxShadow = '0 0 5px #0df';

            seleccionarReceta(idReceta, receta, isDiscovered, iconUrl, itemName, itemTier);
        };

        listaRecetas.appendChild(btn);
    }
}"""

content = re.sub(
    r'function renderRecetasCrafteo\(\) \{.*?\n\}\n\nlet dbItemsCacheGlobal = \{\};',
    new_render_recetas + '\n\nlet dbItemsCacheGlobal = {};',
    content,
    flags=re.DOTALL
)

# Replace seleccionarReceta
new_seleccionar = """function seleccionarReceta(idReceta, receta, isDiscovered, resultIconUrl, resultItemName, resultTier) {
    const detalleContainer = document.getElementById('detalle-receta-crafteo');

    detalleContainer.innerHTML = ''; // Clear previous
    detalleContainer.style.display = 'flex';

    // Check current stash to calculate owned vs required ratios
    const invStash = window.datosJugador && window.datosJugador.inventario_stash ? Object.values(window.datosJugador.inventario_stash) : [];

    // Large Image at top
    const imgContainer = document.createElement('div');
    imgContainer.style.cssText = 'flex: 0 0 120px; display: flex; justify-content: center; align-items: center; margin-bottom: 15px; position: relative;';

    const largeImg = document.createElement('img');
    largeImg.src = resultIconUrl;
    largeImg.style.cssText = `max-width: 100px; max-height: 100px; filter: ${isDiscovered ? 'none' : 'brightness(0)'};`;
    imgContainer.appendChild(largeImg);

    // Tier badge on image
    if (isDiscovered) {
        const tierBadge = document.createElement('div');
        const romanTiers = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
        tierBadge.innerText = romanTiers[resultTier - 1] || 'I';
        tierBadge.style.cssText = 'position: absolute; top: 10px; left: 50%; transform: translateX(-60px); color: #ffaa00; font-family: "Mikodacs", sans-serif; font-size: 20px; text-shadow: 2px 2px 0 #000;';
        imgContainer.appendChild(tierBadge);
    }

    detalleContainer.appendChild(imgContainer);

    // Title
    const title = document.createElement('h3');
    title.innerText = isDiscovered ? resultItemName : '???';
    title.style.cssText = 'color: #fff; text-align: center; margin: 0 0 5px 0; font-family: "Mikodacs", sans-serif; letter-spacing: 1px;';
    detalleContainer.appendChild(title);

    // Description (DC & Skill info too)
    const desc = document.createElement('div');
    desc.style.cssText = 'color: #888; font-size: 12px; text-align: center; margin-bottom: 15px; flex: 1;';
    desc.innerHTML = `Skill: <span style="color:#0df;">${receta.skill || 'Ninguna'}</span> | DC: <span style="color:#ffaa00;">${receta.dc || 0}</span>`;
    detalleContainer.appendChild(desc);

    // Ingredients List
    const ingTitle = document.createElement('div');
    ingTitle.innerText = 'Requirements';
    ingTitle.style.cssText = 'color: #aaa; font-size: 11px; text-transform: uppercase; margin-bottom: 5px; border-bottom: 1px solid #333; padding-bottom: 2px;';
    detalleContainer.appendChild(ingTitle);

    const ingContainer = document.createElement('div');
    ingContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; max-height: 150px; overflow-y: auto;';

    let canCraft = true;

    if (receta.ingredientes) {
        for (const ing of receta.ingredientes) {
            // Find global item info for icon/name
            const globalIng = dbItemsCacheGlobal[ing.idItem];
            const ingIconUrl = globalIng ? globalIng.icono : 'https://i.imgur.com/8QZ7XqY.png';
            const ingName = globalIng ? globalIng.nombre : ing.idItem;

            // Calculate owned
            let ownedQty = 0;
            const stashStacks = invStash.filter(item => item.idItem === ing.idItem);
            stashStacks.forEach(stack => { ownedQty += stack.cantidad; });

            if (ownedQty < ing.cantidad) canCraft = false;

            const ingRow = document.createElement('div');
            ingRow.style.cssText = 'display: flex; align-items: center; background: #222; padding: 5px; border-radius: 4px;';

            ingRow.innerHTML = `
                <img src="${ingIconUrl}" style="width: 24px; height: 24px; margin-right: 10px;">
                <div style="flex: 1; color: #ccc; font-size: 12px;">${ingName}</div>
                <div style="color: ${ownedQty >= ing.cantidad ? '#0df' : '#f44'}; font-family: monospace; font-size: 13px;">${ownedQty}/${ing.cantidad}</div>
            `;
            ingContainer.appendChild(ingRow);
        }
    }
    detalleContainer.appendChild(ingContainer);

    // Bottom Controls (Quantity & Button)
    const controlsContainer = document.createElement('div');
    controlsContainer.style.cssText = 'display: flex; gap: 10px; margin-top: auto;';

    // Multiplier
    const multDiv = document.createElement('div');
    multDiv.style.cssText = 'display: flex; flex-direction: column; flex: 0 0 60px; background: #000; border: 1px solid #444; border-radius: 4px; overflow: hidden;';
    multDiv.innerHTML = `
        <div style="text-align:center; background:#222; font-size:10px; color:#888; padding:2px;">CANT</div>
        <input type="number" id="crafteo-multiplicador" value="1" min="1" max="10" style="width: 100%; background: transparent; color: #fff; border: none; text-align: center; font-family: monospace; font-size: 16px; outline: none; padding: 5px 0;">
    `;
    controlsContainer.appendChild(multDiv);

    // Fuse Button
    const fuseBtn = document.createElement('button');
    fuseBtn.innerText = 'Sintetizar';
    fuseBtn.style.cssText = `
        flex: 1;
        background: ${canCraft ? 'linear-gradient(135deg, #0df 0%, #0055ff 100%)' : '#333'};
        color: ${canCraft ? '#000' : '#888'};
        font-family: "Mikodacs", sans-serif;
        font-size: 18px;
        text-transform: uppercase;
        border: none;
        border-radius: 4px;
        cursor: ${canCraft ? 'pointer' : 'not-allowed'};
        font-weight: bold;
    `;
    fuseBtn.disabled = !canCraft;

    fuseBtn.onclick = () => {
        const multInput = document.getElementById('crafteo-multiplicador');
        const multiplicador = parseInt(multInput.value, 10) || 1;
        sintetizar(idReceta, receta, multiplicador);
    };

    controlsContainer.appendChild(fuseBtn);
    detalleContainer.appendChild(controlsContainer);
}"""

content = re.sub(
    r'function seleccionarReceta\(idReceta, receta\) \{.*?\nfunction sintetizar',
    new_seleccionar + '\n\nfunction sintetizar',
    content,
    flags=re.DOTALL
)

with open('hoja_personaje.js', 'w', encoding='utf-8') as f:
    f.write(content)
