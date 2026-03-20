import re

html = open("pantalla_dm.html").read()

# Add to modal HTML
modal_addition = """
        <div style="display: flex; flex-direction: column; grid-column: span 2;">
          <h4 style="color: #0df; font-family: 'BebasKai', sans-serif; border-bottom: 1px solid #333; padding-bottom: 5px; margin-top: 15px;">STATS Y SKILLS BASE/MOD</h4>
          <div id="dm-skills-container" style="max-height: 250px; overflow-y: auto; background: #111; padding: 10px; border: 1px solid #444; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          </div>
        </div>
"""

# Insert before btn-save-stats
html = html.replace('<div style="grid-column: span 2; display: flex; justify-content: space-between; margin-top: 15px;">', modal_addition + '<div style="grid-column: span 2; display: flex; justify-content: space-between; margin-top: 15px;">')


# Add JS to populate
js_addition = """
            // Población de Skills y Base Stats
            const skillsContainer = document.getElementById('dm-skills-container');
            skillsContainer.innerHTML = '';

            const statsAndSkills = [
                "cuerpo", "mente", "alma",
                "agilidad", "cardio", "fortaleza", "manejo", "reflejos", "sigilo", "vigor", "instinto", "presencia",
                "analisis", "ciencia", "investigacion", "lore", "memoria", "percepcion", "prudencia",
                "arcana", "carisma", "empatia", "engano", "fe", "negociacion", "perspicacia", "represion", "seduccion", "templanza", "voluntad"
            ];

            statsAndSkills.forEach(stat => {
                let bVal = 0;
                let mVal = 0;

                if (['cuerpo', 'mente', 'alma'].includes(stat)) {
                    bVal = playerData.baseStats && playerData.baseStats[stat] ? parseInt(playerData.baseStats[stat]) || 0 : 0;
                    mVal = playerData.modifiers && playerData.modifiers[stat] ? parseInt(playerData.modifiers[stat]) || 0 : 0;
                } else {
                    bVal = parseInt(playerData[`skill_${stat}_base`]) || 0;
                    mVal = parseInt(playerData[`skill_${stat}_mod`]) || 0;

                    if (playerData[`skill_${stat}_base`] === undefined && playerData.baseStats && playerData.baseStats[stat]) {
                        bVal = parseInt(playerData.baseStats[stat]) || 0;
                    }
                    if (playerData[`skill_${stat}_mod`] === undefined && playerData.modifiers) {
                        mVal = parseInt(playerData.modifiers[`skill_${stat}`]) || parseInt(playerData.modifiers[stat]) || 0;
                    }
                }

                const statName = stat.charAt(0).toUpperCase() + stat.slice(1);

                skillsContainer.innerHTML += `
                    <div style="display: flex; flex-direction: column; background: #222; padding: 8px; border-radius: 3px; border: 1px solid #333;">
                        <label style="color: #c49a00; font-size: 11px; margin-bottom: 5px; font-weight: bold;">${statName}</label>
                        <div style="display: flex; gap: 5px;">
                            <div style="flex: 1;">
                                <label style="font-size: 9px; color: #888;">Base</label>
                                <input type="number" id="dm-stat-${stat}-base" value="${bVal}" style="width: 100%; padding: 3px; background: #111; color: #fff; border: 1px solid #444; text-align: center;">
                            </div>
                            <div style="flex: 1;">
                                <label style="font-size: 9px; color: #888;">Mod</label>
                                <input type="number" id="dm-stat-${stat}-mod" value="${mVal}" style="width: 100%; padding: 3px; background: #111; color: #fff; border: 1px solid #444; text-align: center;">
                            </div>
                        </div>
                    </div>
                `;
            });
"""

# Insert JS before showing modal
html = html.replace("document.getElementById('dm-stagger').value = staggerVal;", "document.getElementById('dm-stagger').value = staggerVal;\n" + js_addition)


# Add JS to save
js_save_addition = """
        const statsAndSkillsSave = [
            "cuerpo", "mente", "alma",
            "agilidad", "cardio", "fortaleza", "manejo", "reflejos", "sigilo", "vigor", "instinto", "presencia",
            "analisis", "ciencia", "investigacion", "lore", "memoria", "percepcion", "prudencia",
            "arcana", "carisma", "empatia", "engano", "fe", "negociacion", "perspicacia", "represion", "seduccion", "templanza", "voluntad"
        ];

        // Cargar BaseStats y Modifiers existentes para no sobreescribir otros
        const currentPlayerData = window.jugadoresData && window.jugadoresData[activePlayerIdForModal] ? window.jugadoresData[activePlayerIdForModal] : {};
        const newBaseStats = Object.assign({}, currentPlayerData.baseStats || {});
        const newModifiers = Object.assign({}, currentPlayerData.modifiers || {});

        statsAndSkillsSave.forEach(stat => {
            const bInput = document.getElementById(`dm-stat-${stat}-base`);
            const mInput = document.getElementById(`dm-stat-${stat}-mod`);
            const bVal = bInput ? parseInt(bInput.value) || 0 : 0;
            const mVal = mInput ? parseInt(mInput.value) || 0 : 0;

            if (['cuerpo', 'mente', 'alma'].includes(stat)) {
                newBaseStats[stat] = bVal;
                newModifiers[stat] = mVal;
            } else {
                updates[`campaña/jugadores/${activePlayerIdForModal}/skill_${stat}_base`] = bVal;
                updates[`campaña/jugadores/${activePlayerIdForModal}/skill_${stat}_mod`] = mVal;
                // Also update the legacy structure just in case
                newBaseStats[stat] = bVal;
                newModifiers[`skill_${stat}`] = mVal;
            }
        });

        updates[`campaña/jugadores/${activePlayerIdForModal}/baseStats`] = newBaseStats;
        updates[`campaña/jugadores/${activePlayerIdForModal}/modifiers`] = newModifiers;
"""

# Insert JS before updating Firebase
html = html.replace("const hpMax = Math.floor(hpBase + ((newLevel + defLvl) * hpCoef));", js_save_addition + "\n        const hpMax = Math.floor(hpBase + ((newLevel + defLvl) * hpCoef));")

with open("pantalla_dm.html", "w") as f:
    f.write(html)
