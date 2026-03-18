with open('hoja_personaje.js', 'r') as f:
    js = f.read()

search_js = """        } else if (typeof db !== 'undefined') {
            // Guardar directamente en la raiz
            db.ref('campaña/jugadores/' + playerId).update({ [attrName]: val });
        }"""

replace_js = """        } else if (typeof db !== 'undefined') {
            // Guardar directamente en la raiz
            db.ref('campaña/jugadores/' + playerId).update({ [attrName]: val });

            // Auto-calculate max HP if related fields change
            if (['hp_base', 'hp_coefficient', 'level'].includes(attrName)) {
                const base = attrName === 'hp_base' ? parseFloat(val) || 0 : parseFloat(currentPlayerData.hp_base) || 0;
                const coef = attrName === 'hp_coefficient' ? parseFloat(val) || 0 : parseFloat(currentPlayerData.hp_coefficient) || 0;
                const lvl = attrName === 'level' ? parseInt(val) || 1 : parseInt(currentPlayerData.level) || 1;

                const calculatedMaxHP = Math.floor(base + (coef * lvl));

                db.ref('campaña/jugadores/' + playerId).update({ hp_max: calculatedMaxHP });
                db.ref('campaña/jugadores/' + playerId + '/combatStats').update({ hp_max: calculatedMaxHP });
            }
        }"""

if search_js in js:
    js = js.replace(search_js, replace_js, 1)
    with open('hoja_personaje.js', 'w') as f:
        f.write(js)
    print("Patched js")
else:
    print("Could not find js logic")
