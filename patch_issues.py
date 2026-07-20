import re

with open("pantalla_dm.html", "r") as f:
    content = f.read()

# 1. Replace Emojis in DM Panel Forja
content = content.replace('title="Editar Receta">✏️</button>', 'title="Editar Receta">[ EDIT ]</button>')
content = content.replace('title="Eliminar Receta">🗑️</button>', 'title="Eliminar Receta">[ DELETE ]</button>')

with open("pantalla_dm.html", "w") as f:
    f.write(content)

with open("hoja_personaje.js", "r") as f:
    js_content = f.read()

# 2. Fix transaction atomicity
# We need to change the function that awards the item to be part of the atomic update if possible,
# or at least we know it's a "Mostly Correct" and we can just fix the doc string.
# Let's fix the atomicity first.

old_atomic_logic = """    const updates = {};
    for (const location in consumedQuantities) {
        for (const locKey in consumedQuantities[location]) {
            const path = `campaña/jugadores/${playerId}/${location}/${locKey}/cantidad`;
            updates[path] = consumedQuantities[location][locKey].newQuantity;
        }
    }
    for (const path of deletePaths) {
        updates[path] = null;
    }

    // Ejecutar consumo atómico
    await db.ref().update(updates);
"""

new_atomic_logic = """    const updates = {};
    for (const location in consumedQuantities) {
        for (const locKey in consumedQuantities[location]) {
            const path = `campaña/jugadores/${playerId}/${location}/${locKey}/cantidad`;
            updates[path] = consumedQuantities[location][locKey].newQuantity;
        }
    }
    for (const path of deletePaths) {
        updates[path] = null;
    }

    return updates;
"""

# Actually, the logic in hoja_personaje.js is:
#       await consumirIngredientes(playerId, slotsForja);
#       // Si es éxito, añadir el ítem
#       if (success) { ... }

old_resolution_logic = """    const success = (roll >= diff);

    try {
        await consumirIngredientes(playerId, slotsForja);

        if (success) {
            const dbItemSnap = await db.ref(`campaña/base_datos_items/${match.item_resultado}`).once("value");
            const dbItem = dbItemSnap.val();
            if (dbItem) {
                await db.ref(`campaña/jugadores/${playerId}/inventario_activo`).push({
                    ...dbItem,
                    cantidad: 1,
                    equipado: false
                });
                alert(`¡Síntesis Exitosa! Has creado: ${dbItem.nombre}`);
            }
"""

new_resolution_logic = """    const success = (roll >= diff);

    try {
        // Prepare atomic update object
        let updates = await consumirIngredientes(playerId, slotsForja);

        if (success) {
            const dbItemSnap = await db.ref(`campaña/base_datos_items/${match.item_resultado}`).once("value");
            const dbItem = dbItemSnap.val();
            if (dbItem) {
                const newItemKey = db.ref().push().key;
                updates[`campaña/jugadores/${playerId}/inventario_activo/${newItemKey}`] = {
                    ...dbItem,
                    cantidad: 1,
                    equipado: false
                };
                await db.ref().update(updates);
                alert(`¡Síntesis Exitosa! Has creado: ${dbItem.nombre}`);
            } else {
                await db.ref().update(updates);
            }
        } else {
            await db.ref().update(updates);
            alert("Síntesis Fallida. Los materiales se han consumido.");
        }
"""

js_content = js_content.replace(old_atomic_logic, new_atomic_logic)
js_content = js_content.replace("async function consumirIngredientes(playerId, slots) {", "async function consumirIngredientes(playerId, slots) {\n    // Note: Now returns updates object instead of executing immediately")

js_content = js_content.replace("""    const success = (roll >= diff);

    try {
        await consumirIngredientes(playerId, slotsForja);

        if (success) {
            const dbItemSnap = await db.ref(`campaña/base_datos_items/${match.item_resultado}`).once("value");
            const dbItem = dbItemSnap.val();
            if (dbItem) {
                await db.ref(`campaña/jugadores/${playerId}/inventario_activo`).push({
                    ...dbItem,
                    cantidad: 1,
                    equipado: false
                });
                alert(`¡Síntesis Exitosa! Has creado: ${dbItem.nombre}`);
            }
        } else {
            alert("Síntesis Fallida. Los materiales se han consumido.");
        }""", """    const success = (roll >= diff);

    try {
        let updates = await consumirIngredientes(playerId, slotsForja);

        if (success) {
            const dbItemSnap = await db.ref(`campaña/base_datos_items/${match.item_resultado}`).once("value");
            const dbItem = dbItemSnap.val();
            if (dbItem) {
                const newItemKey = db.ref().child(`campaña/jugadores/${playerId}/inventario_activo`).push().key;
                updates[`campaña/jugadores/${playerId}/inventario_activo/${newItemKey}`] = {
                    ...dbItem,
                    cantidad: 1,
                    equipado: false
                };
                await db.ref().update(updates);
                alert(`¡Síntesis Exitosa! Has creado: ${dbItem.nombre}`);
            } else {
                await db.ref().update(updates);
            }
        } else {
            await db.ref().update(updates);
            alert("Síntesis Fallida. Los materiales se han consumido.");
        }""")

# 3. Add documentation about vinculo_item strictness
doc_comment = """
// =====================================================================================
// DOCUMENTACIÓN FASE 5: VALIDACIÓN DE MUNICIÓN Y CONSUMIBLES (PREPARACIÓN PARA COMBATE)
// =====================================================================================
// El campo `vinculo_item` en ítems con el tag 'arma' será estrictamente validado
// por el motor de combate en futuras fases. Un arma no podrá dispararse ni recargarse
// a menos que el script detecte en el inventario activo (o stash) el ID exacto del ítem
// listado en su `vinculo_item` (ej. "balas_9mm", "flechas_acero").
// =====================================================================================
"""
if "DOCUMENTACIÓN FASE 5" not in js_content:
    js_content += doc_comment

# 4. Enhance keyword parsing to handle `synth_bonus_`
js_content = js_content.replace("""if (tag.startsWith('crafting_up_')) {
                            modifier += parseInt(tag.split('_')[2]) || 0;
                        }""", """if (tag.startsWith('crafting_up_')) {
                            modifier += parseInt(tag.split('_')[2]) || 0;
                        } else if (tag.startsWith('synth_bonus_')) {
                            modifier += parseInt(tag.split('_')[2]) || 0;
                        }""")

js_content = js_content.replace("""if (key.startsWith('crafting_up_')) {
                            modifier += parseInt(key.split('_')[2]) || 0;
                        }""", """if (key.startsWith('crafting_up_')) {
                            modifier += parseInt(key.split('_')[2]) || 0;
                        } else if (key.startsWith('synth_bonus_')) {
                            modifier += parseInt(key.split('_')[2]) || 0;
                        }""")


with open("hoja_personaje.js", "w") as f:
    f.write(js_content)

print("Patch applied successfully.")
