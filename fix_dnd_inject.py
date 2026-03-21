import re

with open("hoja_personaje.js", "r", encoding="utf-8") as f:
    js = f.read()

search_dnd = r"// Set up Drop Zones for Equipment Panel[\s\S]*?\}\);\n    \}\n\}\);"

replace_dnd = '''// Set up Drop Zones for Equipment Panel (PC Drag & Drop + Mobile Touch)
document.addEventListener('DOMContentLoaded', () => {
    const activeInvGrid = document.getElementById('inv-active-grid');

    // Configuración para el arrastre y validaciones
    const allowedTypes = {
        'armadura': ['armadura'],
        'arma_principal': ['arma', 'escudo'],
        'arma_secundaria': ['arma', 'escudo'],
        'municion': ['municion', 'consumible'],
        'accesorio_1': ['accesorio', 'gadget'],
        'accesorio_2': ['accesorio', 'gadget'],
        'accesorio_3': ['accesorio', 'gadget'],
        'accesorio_4': ['accesorio', 'gadget']
    };

    const handleEquipItem = async (itemKey, slotId) => {
        const playerId = localStorage.getItem('playerId');
        if (!playerId) return;

        const invRef = db.ref(`campaña/jugadores/${playerId}/inventario_activo`);
        const snap = await invRef.once('value');
        const items = snap.val() || {};
        const draggingItem = items[itemKey];

        if (!draggingItem) return;

        // Validación de tipos
        let itemTags = draggingItem.tags ? (Array.isArray(draggingItem.tags) ? draggingItem.tags : draggingItem.tags.split(',')) : [];
        let itemTypes = [draggingItem.tipo, ...itemTags].filter(Boolean).map(t => t.trim().toLowerCase());

        let allowed = allowedTypes[slotId] || [];
        let isTypeValid = allowed.some(a => itemTypes.some(t => t.includes(a))) || itemTypes.length === 0;

        if (slotId.includes('accesorio') && (itemTypes.includes('arma') || itemTypes.includes('armadura'))) {
             isTypeValid = false; // No armas ni armaduras en accesorios
        }

        if (!isTypeValid) {
            alert(`No puedes equipar esto aquí. Slot: ${slotId}. Requiere: ${allowed.join(', ')}`);
            return;
        }

        const updates = {};
        for (const [key, item] of Object.entries(items)) {
            if (item.equipped_slot === slotId && key !== itemKey) {
                updates[`${key}/equipped_slot`] = null;
            }
        }

        if (slotId.includes('arma_') && itemTypes.some(t => t.includes('fuego'))) {
            console.log("Arma de fuego detectada. Asegúrate de tener balas en el slot de Munición.");
        }

        updates[`${itemKey}/equipped_slot`] = slotId;
        await invRef.update(updates);
    };

    const bindDesktopEvents = () => {
        const equipSlots = document.querySelectorAll('.equip-slot');
        equipSlots.forEach(slot => {
             slot.addEventListener('dragover', (e) => {
                 e.preventDefault();
                 slot.style.borderColor = '#00ff00';
             });
             slot.addEventListener('dragleave', (e) => {
                 slot.style.borderColor = '';
             });
             slot.addEventListener('drop', async (e) => {
                 e.preventDefault();
                 slot.style.borderColor = '';
                 const itemKey = e.dataTransfer.getData('text/plain');
                 const slotId = slot.getAttribute('data-slot-id');
                 if (!itemKey || !slotId) return;
                 await handleEquipItem(itemKey, slotId);
             });
        });

        if (activeInvGrid) {
             activeInvGrid.addEventListener('dragover', (e) => {
                 e.preventDefault();
             });
             activeInvGrid.addEventListener('drop', async (e) => {
                 e.preventDefault();
                 const itemKey = e.dataTransfer.getData('text/plain');
                 if (!itemKey) return;

                 const playerId = localStorage.getItem('playerId');
                 if (playerId) {
                     await db.ref(`campaña/jugadores/${playerId}/inventario_activo/${itemKey}/equipped_slot`).remove();
                 }
             });
        }
    };
    bindDesktopEvents();

    let draggedItemKey = null;

    document.body.addEventListener('touchstart', (e) => {
        const slot = e.target.closest('.inv-item-slot, .equip-slot');
        if (!slot) return;

        const isGridItem = slot.classList.contains('inv-item-slot');
        const isEquippedItem = slot.classList.contains('equip-slot') && slot.dataset.equippedItemKey;

        if (isGridItem || isEquippedItem) {
             draggedItemKey = slot.dataset.equippedItemKey || slot.dataset.key || null;
        }
    }, {passive: true});

    document.body.addEventListener('touchend', async (e) => {
        if (!draggedItemKey) return;

        const touch = e.changedTouches[0] || e.touches[0];
        const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);

        if (elemBelow) {
            const targetSlot = elemBelow.closest('.equip-slot');
            if (targetSlot) {
                const slotId = targetSlot.getAttribute('data-slot-id');
                await handleEquipItem(draggedItemKey, slotId);
            } else if (elemBelow.closest('#inv-active-grid')) {
                const playerId = localStorage.getItem('playerId');
                if (playerId) {
                    await db.ref(`campaña/jugadores/${playerId}/inventario_activo/${draggedItemKey}/equipped_slot`).remove();
                }
            }
        }
        draggedItemKey = null;
    });

});'''

if re.search(search_dnd, js):
    js_patched = re.sub(search_dnd, replace_dnd, js)
    with open("hoja_personaje.js", "w", encoding="utf-8") as f:
        f.write(js_patched)
    print("Injected handleEquipItem and touch logic")
else:
    print("Could not find dnd replacement block")
