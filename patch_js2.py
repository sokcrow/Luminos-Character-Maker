import re

with open('hoja_personaje.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace renderRecetasCrafteo
new_render = """function renderRecetasCrafteo() {
    const listaRecetas = document.getElementById('lista-recetas-crafteo');
    const playerName = document.querySelector('input[name="attr_character_name"]')?.value.trim();

    if (!listaRecetas || !playerName) return;

    listaRecetas.innerHTML = '';

    if (Object.keys(recetasCache).length === 0) {
        listaRecetas.innerHTML = '<div style="color:#666; text-align:center; padding:20px; grid-column: 1 / -1;">No hay recetas disponibles.</div>';
        return;
    }

    for (const [idReceta, receta] of Object.entries(recetasCache)) {
        if (receta.acceso === 'Restringido' && (!receta.jugadores || !receta.jugadores[playerName])) {
            continue;
        }

        const globalResData = dbItemsCacheGlobal[receta.item_resultado] || {};
        const iconUrl = globalResData.icono || 'https://i.imgur.com/8QZ7XqY.png';
        const itemName = globalResData.nombre || 'Ítem Desconocido';
        const itemTier = receta.tier_resultado || 1;

        // Check if discovered
        const discoveredRecipes = window.datosJugador?.recetas_descubiertas || {};
        const isDiscovered = discoveredRecipes[idReceta];

        const btn = document.createElement('div');
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
            border-radius: 4px;
        `;

        btn.onmouseover = () => btn.style.transform = 'scale(1.05)';
        btn.onmouseout = () => btn.style.transform = 'scale(1)';

        if (isDiscovered || itemTier) {
            const tierEl = document.createElement('div');
            const romanTiers = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
            tierEl.innerText = romanTiers[itemTier - 1] || 'I';
            // Always show tier, even if undiscovered
            tierEl.style.cssText = `
                position: absolute; top: 2px; left: 2px;
                color: #ffaa00; font-weight: bold;
                font-family: "Mikodacs", sans-serif; font-size: 14px;
                text-shadow: 1px 1px 0 #000, -1px -1px 0 #000;
                filter: none; /* override parent brightness(0) on text */
            `;
            if (!isDiscovered) {
                // If the parent has brightness(0), child text will be black.
                // To fix this, we'll append the tierEl, but we must make sure the parent filter doesn't kill it.
                // Since filter applies to children, we'll just not use brightness(0) on the parent,
                // but use it on a child image or background layer.
                // Let's refactor the btn slightly:
            }
        }

        // Refactored button content for correct filtering:
        btn.style.background = 'transparent';
        btn.style.filter = 'none';
        btn.innerHTML = `
            <div style="
                position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                background: url('${iconUrl}') center/cover;
                filter: ${isDiscovered ? 'none' : 'brightness(0) drop-shadow(0 0 2px #444)'};
                border-radius: 4px;
            "></div>
            <div style="
                position: absolute; top: 2px; left: 2px;
                color: #ffaa00; font-weight: bold;
                font-family: 'Mikodacs', sans-serif; font-size: 14px;
                text-shadow: 1px 1px 0 #000, -1px -1px 0 #000;
                z-index: 2;
            ">${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][itemTier - 1] || 'I'}</div>
        `;

        btn.onclick = () => {
            Array.from(listaRecetas.children).forEach(c => {
                c.style.borderColor = c.innerHTML.includes('brightness(0)') ? '#444' : '#ffaa00';
                c.style.boxShadow = 'none';
            });
            btn.style.borderColor = '#0df';
            btn.style.boxShadow = '0 0 5px #0df';

            seleccionarReceta(idReceta, receta, isDiscovered, iconUrl, itemName, itemTier);
        };

        listaRecetas.appendChild(btn);
    }
}
"""

new_select = """function seleccionarReceta(idReceta, receta, isDiscovered, resultIconUrl, resultItemName, resultTier) {
    const detalleContainer = document.getElementById('detalle-receta-crafteo');
    const playerName = document.querySelector('input[name="attr_character_name"]')?.value.trim();
    if (!detalleContainer || !playerName) return;

    currentSelectedRecetaId = idReceta;

    // Check current stash to calculate owned vs required ratios
    // We already have a real-time listener for currentStash via window.datosJugador.inventario_stash
    // but the previous logic used db.ref().on(). We can still use the local window.datosJugador.
    const invStash = window.datosJugador && window.datosJugador.inventario_stash ? Object.values(window.datosJugador.inventario_stash) : [];

    // Clear previous
    detalleContainer.innerHTML = '';

    // Large Image at top
    const imgContainer = document.createElement('div');
    imgContainer.style.cssText = 'display: flex; justify-content: center; align-items: center; margin-bottom: 15px; position: relative; background: #000; padding: 10px; border: 1px solid #333; border-radius: 4px;';

    const largeImg = document.createElement('img');
    largeImg.src = resultIconUrl;
    largeImg.style.cssText = `max-width: 80px; max-height: 80px; filter: ${isDiscovered ? 'none' : 'brightness(0)'};`;
    imgContainer.appendChild(largeImg);

    // Tier badge on image
    const tierBadge = document.createElement('div');
    const romanTiers = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    tierBadge.innerText = romanTiers[resultTier - 1] || 'I';
    tierBadge.style.cssText = 'position: absolute; top: 5px; left: 5px; color: #ffaa00; font-family: "Mikodacs", sans-serif; font-size: 16px; text-shadow: 2px 2px 0 #000;';
    imgContainer.appendChild(tierBadge);

    detalleContainer.appendChild(imgContainer);

    // Title
    const title = document.createElement('h3');
    title.innerText = isDiscovered ? `${resultItemName} x${receta.cantidad_resultado}` : '???';
    title.style.cssText = 'color: #fff; text-align: center; margin: 0 0 5px 0; font-family: "Mikodacs", sans-serif; letter-spacing: 1px; font-size: 16px;';
    detalleContainer.appendChild(title);

    // Description (DC & Skill info)
    const desc = document.createElement('div');
    desc.style.cssText = 'color: #888; font-size: 12px; text-align: center; margin-bottom: 15px;';
    desc.innerHTML = `Skill: <span style="color:#0df;">${receta.habilidad.toUpperCase()}</span> | DC: <span style="color:#ffaa00;">${receta.dc}</span>`;
    detalleContainer.appendChild(desc);

    // Ingredients List
    const ingTitle = document.createElement('div');
    ingTitle.innerText = 'Requirements';
    ingTitle.style.cssText = 'color: #aaa; font-size: 11px; text-transform: uppercase; margin-bottom: 5px; border-bottom: 1px solid #333; padding-bottom: 2px;';
    detalleContainer.appendChild(ingTitle);

    const ingContainer = document.createElement('div');
    ingContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; flex: 1; overflow-y: auto;';

    let canCraft = true;
    let maxMultiplicador = 10;

    if (receta.ingredientes) {
        for (const ing of receta.ingredientes) {
            const globalIng = dbItemsCacheGlobal[ing.id_item] || {};
            const ingIconUrl = globalIng.icono || 'https://i.imgur.com/8QZ7XqY.png';
            const ingName = globalIng.nombre || ing.id_item;

            // Calculate owned
            let ownedQty = 0;
            const stashStacks = invStash.filter(item => {
                const itemKey = item.id || Object.keys(dbItemsCacheGlobal).find(g => dbItemsCacheGlobal[g].nombre === item.nombre);
                return itemKey === ing.id_item;
            });
            stashStacks.forEach(stack => { ownedQty += (parseInt(stack.cantidad) || 1); });

            if (ownedQty < ing.cantidad) {
                canCraft = false;
                maxMultiplicador = 0;
            } else {
                const maxForThisIng = Math.floor(ownedQty / ing.cantidad);
                if (maxForThisIng < maxMultiplicador) {
                    maxMultiplicador = maxForThisIng;
                }
            }

            const ingRow = document.createElement('div');
            ingRow.style.cssText = 'display: flex; align-items: center; background: #222; padding: 5px; border-radius: 4px;';

            ingRow.innerHTML = `
                <img src="${ingIconUrl}" style="width: 24px; height: 24px; margin-right: 10px;">
                <div style="flex: 1; color: #ccc; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ingName}</div>
                <div style="color: ${ownedQty >= ing.cantidad ? '#0df' : '#f44'}; font-family: monospace; font-size: 13px; margin-left: 5px;">${ownedQty}/${ing.cantidad}</div>
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
        <input type="number" id="crafteo-multiplicador" value="1" min="1" max="${Math.max(1, maxMultiplicador)}" style="width: 100%; background: transparent; color: #fff; border: none; text-align: center; font-family: monospace; font-size: 16px; outline: none; padding: 5px 0;">
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
        transition: opacity 0.2s;
    `;
    fuseBtn.disabled = !canCraft;
    if (!canCraft) fuseBtn.style.opacity = '0.5';

    fuseBtn.onclick = () => {
        const multInput = document.getElementById('crafteo-multiplicador');
        const multiplicador = parseInt(multInput.value, 10) || 1;

        if (multiplicador < 1 || multiplicador > maxMultiplicador) {
            alert('Multiplicador inválido.');
            return;
        }

        fuseBtn.disabled = true;
        fuseBtn.innerText = 'SINTETIZANDO...';

        const currentPlayerData = window.datosJugador || {};
        const skillMod = (currentPlayerData.modifiers && currentPlayerData.modifiers[receta.habilidad])
            ? parseInt(currentPlayerData.modifiers[receta.habilidad])
            : 0;

        const roll = Math.floor(Math.random() * 20) + 1;
        const total = roll + skillMod;
        const dc = parseInt(receta.dc);
        const currentStash = window.datosJugador.inventario_stash || {};

        if (total >= dc) {
            ejecutarSintesis(playerName, receta, multiplicador, currentStash, true, total);
        } else {
            ejecutarSintesis(playerName, receta, multiplicador, currentStash, false, total);
        }
    };

    controlsContainer.appendChild(fuseBtn);
    detalleContainer.appendChild(controlsContainer);
}
"""

content = re.sub(
    r'function renderRecetasCrafteo\(\) \{.*?\nfunction seleccionarReceta\(idReceta, receta\) \{.*?\nfunction ejecutarSintesis',
    new_render + '\n\nlet dbItemsCacheGlobal = {};\nwindow.addEventListener(\'DOMContentLoaded\', () => {\n    setTimeout(() => {\n        if (typeof db === \'undefined\') return;\n        db.ref(\'campaña/base_datos_items\').on(\'value\', snap => {\n            dbItemsCacheGlobal = snap.val() || {};\n        });\n    }, 1500);\n});\n\n' + new_select + '\n\nfunction ejecutarSintesis',
    content,
    flags=re.DOTALL
)

with open('hoja_personaje.js', 'w', encoding='utf-8') as f:
    f.write(content)
