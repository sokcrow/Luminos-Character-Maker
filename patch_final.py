import re

with open("hoja_personaje.js", "r") as f:
    content = f.read()

# Replace execution block
old_exec_block = """            consumirIngredientes(forjaSlotsData).then(() => {
                if (recetaCoincidente && rollVal >= dificultadActual) {
                    // Éxito: Generar ítem
                    const idRes = recetaCoincidente.item_resultado;
                    const itemResData = window.dbItemsCache[idRes];
                    if (itemResData) {
                        const newItem = {...itemResData, cantidad: 1, valorBase: itemResData.costo || 0};
                        db.ref(`campaña/jugadores/${currentName}/inventario_stash`).push(newItem).then(()=>{
                            alert(`¡Éxito! Has sintetizado: ${itemResData.nombre}`);
                            limpiarSlotsForja();
                        });
                    } else {
                        alert("Error: El ítem resultado no existe en la base de datos global.");
                        limpiarSlotsForja();
                    }
                } else {
                    // Fallo
                    alert("Síntesis fallida. Los materiales se han consumido.");
                    limpiarSlotsForja();
                }
            }).catch(e => alert("Error procesando materiales: " + e));"""

new_exec_block = """            const updates = consumirIngredientesLocal(forjaSlotsData);

            if (recetaCoincidente && rollVal >= dificultadActual) {
                // Éxito
                const idRes = recetaCoincidente.item_resultado;
                const itemResData = window.dbItemsCache[idRes];
                if (itemResData) {
                    const newItem = {...itemResData, cantidad: 1, valorBase: itemResData.costo || 0};
                    const newItemKey = db.ref().push().key;
                    updates[`campaña/jugadores/${currentName}/inventario_stash/${newItemKey}`] = newItem;
                    db.ref().update(updates).then(() => {
                        alert(`¡Éxito! Has sintetizado: ${itemResData.nombre}`);
                        limpiarSlotsForja();
                    }).catch(e => alert("Error procesando transacción: " + e));
                } else {
                    alert("Error: El ítem resultado no existe en la base de datos global.");
                    limpiarSlotsForja();
                }
            } else {
                // Fallo, solo consumimos
                db.ref().update(updates).then(() => {
                    alert("Síntesis fallida. Los materiales se han consumido.");
                    limpiarSlotsForja();
                }).catch(e => alert("Error procesando materiales: " + e));
            }"""

content = content.replace(old_exec_block, new_exec_block)

# Replace function block
# We have to match the old block using regex or text
old_func_pattern = re.compile(r'async function consumirIngredientes\(slotsData\).*?return db\.ref\(\)\.update\(updates\);\s*\}\s*\}', re.DOTALL)

new_func = """function consumirIngredientesLocal(slotsData) {
        const updates = {};
        const currentStock = {};

        for (let i=1; i<=5; i++) {
            const data = slotsData[i];
            if (data && data.origins) {
                let remainingToConsume = data.cantidadUsar;
                for (const origin of data.origins) {
                    if (remainingToConsume <= 0) break;

                    const stockKey = `${origin.list}/${origin.key}`;
                    if (currentStock[stockKey] === undefined) {
                        currentStock[stockKey] = origin.cant;
                    }

                    const availableInThisOrigin = currentStock[stockKey];
                    const basePath = `campaña/jugadores/${currentName}/${origin.list}/${origin.key}`;

                    if (availableInThisOrigin <= remainingToConsume) {
                        updates[basePath] = null;
                        if (updates[basePath + '/cantidad'] !== undefined) delete updates[basePath + '/cantidad'];

                        remainingToConsume -= availableInThisOrigin;
                        currentStock[stockKey] = 0;
                    } else {
                        currentStock[stockKey] = availableInThisOrigin - remainingToConsume;
                        if (updates[basePath] !== null) {
                            updates[basePath + '/cantidad'] = currentStock[stockKey];
                        }
                        remainingToConsume = 0;
                    }
                }
            }
        }
        return updates;
    }"""

content = re.sub(old_func_pattern, new_func, content)

with open("hoja_personaje.js", "w") as f:
    f.write(content)
print("Patch applied")
