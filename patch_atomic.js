const fs = require('fs');

let content = fs.readFileSync('hoja_personaje.js', 'utf8');

// 1. Fix atomicity logic
// Currently, `consumirIngredientes` calls `await db.ref().update(updates);` directly inside of it
// We need it to return `updates`, and then the caller applies it together with the new item.

content = content.replace(
    'await db.ref().update(updates);',
    'return updates;'
);

content = content.replace(
    'async function consumirIngredientes(slotsData) {',
    'async function consumirIngredientes(slotsData) { // returns updates object instead of executing directly'
);

const oldCaller = `            // Consumir ingredientes siempre
            consumirIngredientes(forjaSlotsData).then(() => {
                if (recetaCoincidente && rollVal >= dificultadActual) {
                    // Éxito: Generar ítem
                    const idRes = recetaCoincidente.item_resultado;
                    const itemResData = window.dbItemsCache[idRes];
                    if (itemResData) {
                        db.ref(\`campaña/jugadores/\${playerId}/inventario_activo\`).push({
                            ...itemResData,
                            cantidad: 1,
                            equipado: false
                        });
                        alert(\`SÍNTESIS EXITOSA. ÍTEM CREADO: \${itemResData.nombre}\`);
                    }
                } else {
                    alert(\`SÍNTESIS FALLIDA. LOS MATERIALES SE HAN CONSUMIDO.\`);
                }
                limpiarForja();
            });`;

const newCaller = `            // Transacción atómica
            consumirIngredientes(forjaSlotsData).then(updates => {
                if (recetaCoincidente && rollVal >= dificultadActual) {
                    // Éxito: Añadir el ítem resultado al objeto de updates
                    const idRes = recetaCoincidente.item_resultado;
                    const itemResData = window.dbItemsCache[idRes];
                    if (itemResData) {
                        const newItemKey = db.ref().child(\`campaña/jugadores/\${playerId}/inventario_activo\`).push().key;
                        updates[\`campaña/jugadores/\${playerId}/inventario_activo/\${newItemKey}\`] = {
                            ...itemResData,
                            cantidad: 1,
                            equipado: false
                        };
                        db.ref().update(updates).then(() => {
                            alert(\`SÍNTESIS EXITOSA. ÍTEM CREADO: \${itemResData.nombre}\`);
                            limpiarForja();
                        });
                        return;
                    }
                }

                // Si falla o no hay itemResData, actualizar solo restando ingredientes
                db.ref().update(updates).then(() => {
                    alert(\`SÍNTESIS FALLIDA. LOS MATERIALES SE HAN CONSUMIDO.\`);
                    limpiarForja();
                });
            });`;

content = content.replace(oldCaller, newCaller);

// 2. Fix synth_bonus_X parsing
content = content.replace(
    /if\s*\(\s*tag\.startsWith\('crafting_up_'\)\s*\)\s*\{\s*modifier\s*\+=\s*parseInt\(\s*tag\.split\('_'\)\[2\]\s*\)\s*\|\|\s*0;\s*\}/g,
    `if (tag.startsWith('crafting_up_')) {
                modifier += parseInt(tag.split('_')[2]) || 0;
            } else if (tag.startsWith('synth_bonus_')) {
                modifier += parseInt(tag.split('_')[2]) || 0;
            }`
);

fs.writeFileSync('hoja_personaje.js', content, 'utf8');
console.log('hoja_personaje.js patched');

// 3. Fix emojis in pantalla_dm.html
let html = fs.readFileSync('pantalla_dm.html', 'utf8');
html = html.replace(/title="Editar Receta">✏️<\/button>/g, 'title="Editar Receta">[ EDIT ]</button>');
html = html.replace(/title="Eliminar Receta">🗑️<\/button>/g, 'title="Eliminar Receta">[ DELETE ]</button>');
fs.writeFileSync('pantalla_dm.html', html, 'utf8');
console.log('pantalla_dm.html patched');
