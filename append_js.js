const fs = require('fs');
let js = fs.readFileSync('hoja_personaje.js', 'utf8');

const forjaLogic2 = `
    document.getElementById("btn-iniciar-sintesis").addEventListener("click", () => {
        // Recolectar ingredientes colocados
        const ingredientesColocados = {}; // key: global id (we use nombre as ID matching pattern for now, or match by nombre)

        let emptyCount = 0;
        for(let i=1; i<=5; i++) {
            if (forjaSlotsData[i]) {
                const nameKey = forjaSlotsData[i].nombre.toLowerCase().replace(/[^a-z0-9]/g, "_"); // Try to reconstruct ID, or we search recetas by name
                // Actually, recipes store ingredient IDs which are usually the sanitized name. Let's find the ID in dbItemsCache.
                let idItem = null;
                for(const [k, v] of Object.entries(window.dbItemsCache || {})) {
                    if (v.nombre === forjaSlotsData[i].nombre) {
                        idItem = k; break;
                    }
                }
                if (!idItem) idItem = nameKey; // Fallback

                if (!ingredientesColocados[idItem]) ingredientesColocados[idItem] = 0;
                ingredientesColocados[idItem] += forjaSlotsData[i].cantidadUsar;
            } else {
                emptyCount++;
            }
        }

        if (emptyCount === 5) {
            alert("Coloca al menos un ingrediente.");
            return;
        }

        // Buscar coincidencia en recetas
        let recetaCoincidente = null;
        let recetaKey = null;

        for (const [key, receta] of Object.entries(cachedRecetasGlobales)) {
            // Requerimiento de mesa
            if (receta.requiere_mesa && !mesaCrafteoActiva) continue;

            // Verificar si los ingredientes requeridos coinciden EXACTAMENTE con los colocados
            let match = true;
            const reqMap = {};
            receta.ingredientes.forEach(ing => reqMap[ing.id] = ing.cantidad);

            // Tienen que tener la misma cantidad de items distintos
            if (Object.keys(reqMap).length !== Object.keys(ingredientesColocados).length) continue;

            for (const [id, cant] of Object.entries(reqMap)) {
                if (!ingredientesColocados[id] || ingredientesColocados[id] !== cant) {
                    match = false; break;
                }
            }

            if (match) {
                recetaCoincidente = receta;
                recetaKey = key;
                break;
            }
        }

        // Calculate difficulty even if no exact match (it will just fail but consume items)
        let dificultadActual = recetaCoincidente ? recetaCoincidente.dificultad_base : 999;

        if (recetaCoincidente) {
            // Check for keywords like crafting_up_X
            const activo = window.currentInventarioActivo || {};
            for (const item of Object.values(activo)) {
                if (item.keywords && Array.isArray(item.keywords)) {
                    item.keywords.forEach(kw => {
                        if (kw.toLowerCase().startsWith('crafting_up_')) {
                            const bonus = parseInt(kw.split('_')[2]) || 0;
                            dificultadActual -= bonus;
                        }
                    });
                }
            }
        }

        document.getElementById("forja-roll-dc").innerText = recetaCoincidente ? dificultadActual : "???";
        document.getElementById("forja-roll-input").value = "";
        document.getElementById("forja-roll-modal").style.display = "flex";

        document.getElementById("btn-confirmar-roll").onclick = () => {
            const rollVal = parseInt(document.getElementById("forja-roll-input").value);
            if (isNaN(rollVal)) {
                alert("Ingresa un valor numérico.");
                return;
            }

            document.getElementById("forja-roll-modal").style.display = "none";

            // Consumir ingredientes siempre
            consumirIngredientes(forjaSlotsData).then(() => {
                if (recetaCoincidente && rollVal >= dificultadActual) {
                    // Éxito: Generar ítem
                    const idRes = recetaCoincidente.item_resultado;
                    const itemResData = window.dbItemsCache[idRes];
                    if (itemResData) {
                        const newItem = {...itemResData, cantidad: 1, valorBase: itemResData.costo || 0};
                        db.ref(\`campaña/jugadores/\${currentName}/inventario_stash\`).push(newItem).then(()=>{
                            alert(\`¡Éxito! Has sintetizado: \${itemResData.nombre}\`);
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
            }).catch(e => alert("Error procesando materiales: " + e));
        };

        document.getElementById("btn-cancelar-roll").onclick = () => {
            document.getElementById("forja-roll-modal").style.display = "none";
        };
    });

    function limpiarSlotsForja() {
        for(let i=1; i<=5; i++) {
            forjaSlotsData[i] = null;
            const slotEl = document.querySelector(\`.forja-slot[data-slot="\${i}"]\`);
            if (!slotEl.classList.contains('locked')) {
                slotEl.innerHTML = '<span style="color: #666; font-size: 24px;">+</span>';
            }
        }
    }

    async function consumirIngredientes(slotsData) {
        // origins array has {list, key, cant}
        // we need to subtract from these origins
        const updates = {};

        // Flatten required consumption
        const consumptionNeeded = {}; // {list_key: amountToSubtract}

        for (let i=1; i<=5; i++) {
            const data = slotsData[i];
            if (data && data.origins) {
                let remainingToConsume = data.cantidadUsar;
                for (const origin of data.origins) {
                    if (remainingToConsume <= 0) break;

                    const availableInThisOrigin = origin.cant;
                    const path = \`campaña/jugadores/\${currentName}/\${origin.list}/\${origin.key}\`;

                    if (availableInThisOrigin <= remainingToConsume) {
                        updates[path] = null; // Borrar ítem
                        remainingToConsume -= availableInThisOrigin;
                    } else {
                        // Quedan algunos
                        updates[path + '/cantidad'] = availableInThisOrigin - remainingToConsume;
                        remainingToConsume = 0;
                    }
                }
            }
        }

        if (Object.keys(updates).length > 0) {
            return db.ref().update(updates);
        }
    }
`;

js += forjaLogic2;
fs.writeFileSync('hoja_personaje.js', js);
