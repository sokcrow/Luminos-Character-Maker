const fs = require('fs');
let html = fs.readFileSync('pantalla_dm.html', 'utf8');

const recipeLogic = `

        // --- LÓGICA DE RECETAS DE FORJA ---
        let editModeRecetaKey = null;

        document.getElementById('toggle-mesa-crafteo-global').addEventListener('change', (e) => {
          db.ref("campaña/estado_mundo").update({ mesa_crafteo_activa: e.target.checked });
        });

        db.ref("campaña/estado_mundo/mesa_crafteo_activa").on("value", snap => {
            const isActive = snap.val() === true;
            document.getElementById('toggle-mesa-crafteo-global').checked = isActive;
        });

        function renderRecetasGrid(recetas) {
            const grid = document.getElementById("grid-recetas");
            grid.innerHTML = "";
            if (!recetas) {
                grid.innerHTML = '<span style="color: #888;">No hay recetas registradas.</span>';
                return;
            }

            for (const [key, receta] of Object.entries(recetas)) {
                const card = document.createElement("div");
                card.className = "card-cyber card-store";
                card.style.position = "relative";
                card.style.alignItems = "flex-start";
                card.style.textAlign = "left";

                const resultadoName = dbItemsCache[receta.item_resultado] ? dbItemsCache[receta.item_resultado].nombre : "Ítem Desconocido";

                let ingHTML = "";
                if (receta.ingredientes && receta.ingredientes.length > 0) {
                    receta.ingredientes.forEach(ing => {
                        const ingName = dbItemsCache[ing.id] ? dbItemsCache[ing.id].nombre : "Desc.";
                        ingHTML += \`<li>\${ing.cantidad}x \${ingName}</li>\`;
                    });
                }

                card.innerHTML = \`
                    <button class="btn-delete-receta" data-id="\${key}" style="position: absolute; top: 5px; right: 5px; background: transparent; border: none; cursor: pointer; font-size: 16px;" title="Eliminar Receta">🗑️</button>
                    <button class="btn-edit-receta" data-id="\${key}" style="position: absolute; top: 5px; right: 30px; background: transparent; border: none; cursor: pointer; font-size: 16px;" title="Editar Info">✏️</button>
                    <h5 style="color:#0df; margin-bottom: 5px; padding-right: 40px;">\${resultadoName}</h5>
                    <div style="font-size: 12px; color: #aaa; margin-bottom: 5px;">
                        <span>DC: <strong style="color: #fff;">\${receta.dificultad_base}</strong></span> |
                        <span>Mesa: <strong style="color: #fff;">\${receta.requiere_mesa ? 'Sí' : 'No'}</strong></span>
                    </div>
                    <ul style="font-size: 11px; color: #888; padding-left: 15px; margin: 0;">\${ingHTML}</ul>
                \`;

                card.querySelector(".btn-delete-receta").onclick = (e) => {
                    e.stopPropagation();
                    if(confirm('¿Eliminar esta receta?')) {
                        db.ref(\`campaña/forja/recetas/\${key}\`).remove();
                    }
                };

                card.querySelector(".btn-edit-receta").onclick = (e) => {
                    e.stopPropagation();
                    editModeRecetaKey = key;
                    document.getElementById("receta-item-resultado").value = receta.item_resultado;
                    document.getElementById("receta-dificultad").value = receta.dificultad_base;
                    document.getElementById("receta-requiere-mesa").checked = receta.requiere_mesa;

                    // Reset all
                    for(let i=1; i<=5; i++) {
                        document.getElementById(\`receta-ingrediente-\${i}-id\`).value = "";
                        document.getElementById(\`receta-ingrediente-\${i}-cant\`).value = i === 1 ? "1" : "";
                    }

                    if (receta.ingredientes) {
                        receta.ingredientes.forEach((ing, index) => {
                            if (index < 5) {
                                document.getElementById(\`receta-ingrediente-\${index+1}-id\`).value = ing.id;
                                document.getElementById(\`receta-ingrediente-\${index+1}-cant\`).value = ing.cantidad;
                            }
                        });
                    }

                    document.getElementById("btn-guardar-receta").innerText = "Actualizar Receta";
                    document.getElementById("btn-cancelar-receta").style.display = "block";
                };

                grid.appendChild(card);
            }
        }

        db.ref("campaña/forja/recetas").on("value", snap => {
            renderRecetasGrid(snap.val());
        });

        function resetRecetaForm() {
            editModeRecetaKey = null;
            document.getElementById("receta-item-resultado").value = "";
            document.getElementById("receta-dificultad").value = "50";
            document.getElementById("receta-requiere-mesa").checked = true;
            for(let i=1; i<=5; i++) {
                document.getElementById(\`receta-ingrediente-\${i}-id\`).value = "";
                document.getElementById(\`receta-ingrediente-\${i}-cant\`).value = i === 1 ? "1" : "";
            }
            document.getElementById("btn-guardar-receta").innerText = "Guardar Receta";
            document.getElementById("btn-cancelar-receta").style.display = "none";
        }

        document.getElementById("btn-cancelar-receta").addEventListener("click", resetRecetaForm);

        document.getElementById("btn-guardar-receta").addEventListener("click", () => {
            const itemResultado = document.getElementById("receta-item-resultado").value;
            const dificultadBase = parseInt(document.getElementById("receta-dificultad").value) || 50;
            const requiereMesa = document.getElementById("receta-requiere-mesa").checked;

            if (!itemResultado) {
                alert("Debes seleccionar un ítem de resultado.");
                return;
            }

            const ingredientes = [];
            for(let i=1; i<=5; i++) {
                const idIng = document.getElementById(\`receta-ingrediente-\${i}-id\`).value;
                const cantIng = parseInt(document.getElementById(\`receta-ingrediente-\${i}-cant\`).value) || 1;
                if (idIng && cantIng > 0) {
                    // Check for duplicates
                    const existing = ingredientes.find(ing => ing.id === idIng);
                    if (existing) {
                        existing.cantidad += cantIng;
                    } else {
                        ingredientes.push({ id: idIng, cantidad: cantIng });
                    }
                }
            }

            if (ingredientes.length === 0) {
                alert("Debes añadir al menos un ingrediente válido.");
                return;
            }

            const recetaData = {
                item_resultado: itemResultado,
                dificultad_base: dificultadBase,
                requiere_mesa: requiereMesa,
                ingredientes: ingredientes
            };

            const isEditing = editModeRecetaKey !== null;
            const refPush = isEditing ? db.ref(\`campaña/forja/recetas/\${editModeRecetaKey}\`) : db.ref("campaña/forja/recetas").push();

            refPush.set(recetaData).then(() => {
                alert(isEditing ? "Receta actualizada." : "Receta creada.");
                resetRecetaForm();
            }).catch(e => alert("Error: " + e));
        });
`;

html = html.replace('// --- LÓGICA DE TABLAS DE LOOT ---', recipeLogic + '\n        // --- LÓGICA DE TABLAS DE LOOT ---');
fs.writeFileSync('pantalla_dm.html', html);
