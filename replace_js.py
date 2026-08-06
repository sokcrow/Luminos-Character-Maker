import re

with open('dm-combat-creator.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace block around generateSkillObject
search_block_generate = """            const skillObj = {
                id: document.getElementById('sb-id').value || "new_skill",
                name: document.getElementById('sb-name').value || "New Skill",
                pecado: sinType,
                tipo_dano: damageType,
                scaling_stat: isDefense ? null : scalingStat,
                tier: parseInt(document.getElementById('sb-tier').value) || 1,
                isItemSkill: document.getElementById('sb-is-item-skill').checked,
                basePower: isDefense ? 0 : (isNaN(basePowerVal) ? 0 : basePowerVal),
                coinPower: isDefense ? 0 : (isNaN(coinPowerVal) ? 0 : coinPowerVal),
                coinAmount: parseInt(document.getElementById('sb-coin-count').value) || 1,
                weight: parseInt(document.getElementById('sb-weight').value) || 1,"""

replace_block_generate = """            const skillObj = {
                id: document.getElementById('sb-id').value || "new_skill",
                name: document.getElementById('sb-name').value || "New Skill",
                pecado: sinType,
                tipo_dano: damageType,
                scaling_stat: isDefense ? null : scalingStat,
                tier: parseInt(document.getElementById('sb-tier').value) || 1,
                isItemSkill: document.getElementById('sb-is-item-skill').checked,
                basePower: isDefense ? 0 : (isNaN(basePowerVal) ? 0 : basePowerVal),
                coinPower: isDefense ? 0 : (isNaN(coinPowerVal) ? 0 : coinPowerVal),
                coinAmount: parseInt(document.getElementById('sb-coin-count').value) || 1,
                weight: parseInt(document.getElementById('sb-weight').value) || 1,
                skillRange: parseInt(document.getElementById('sb-range').value) || 1,
                targeting_type: document.getElementById('sb-targeting-type').value || 'Focused Attack',
                aoe_pattern: document.getElementById('sb-targeting-type').value === 'AoE' ? document.getElementById('sb-aoe-pattern').value : null,"""

content = content.replace(search_block_generate, replace_block_generate)


# Replace block around loadSkillIntoForm
search_block_load = """            document.getElementById('sb-base').value = skill.basePower || 0;
            document.getElementById('sb-coin-power').value = skill.coinPower || 0;
            document.getElementById('sb-coin-count').value = skill.coinAmount || 1;
            document.getElementById('sb-weight').value = skill.weight || 1;
            document.getElementById('sb-tier').value = skill.tier || 1;
            document.getElementById('sb-is-item-skill').checked = !!skill.isItemSkill;"""

replace_block_load = """            document.getElementById('sb-base').value = skill.basePower || 0;
            document.getElementById('sb-coin-power').value = skill.coinPower || 0;
            document.getElementById('sb-coin-count').value = skill.coinAmount || 1;
            document.getElementById('sb-weight').value = skill.weight || 1;
            document.getElementById('sb-range').value = skill.skillRange || 1;
            document.getElementById('sb-targeting-type').value = skill.targeting_type || 'Focused Attack';
            document.getElementById('sb-targeting-type').dispatchEvent(new Event('change'));
            if (skill.targeting_type === 'AoE') {
                document.getElementById('sb-aoe-pattern').value = skill.aoe_pattern || 'Self';
            }
            document.getElementById('sb-tier').value = skill.tier || 1;
            document.getElementById('sb-is-item-skill').checked = !!skill.isItemSkill;"""

content = content.replace(search_block_load, replace_block_load)

# Replace block around saveSkillToDB resetting form
search_block_reset = """                document.getElementById('sb-base').value = '4';
                document.getElementById('sb-coin-power').value = '4';
                document.getElementById('sb-coin-count').value = '1';
                document.getElementById('sb-coin-count').dispatchEvent(new Event('input'));"""

replace_block_reset = """                document.getElementById('sb-base').value = '4';
                document.getElementById('sb-coin-power').value = '4';
                document.getElementById('sb-coin-count').value = '1';
                document.getElementById('sb-weight').value = '1';
                document.getElementById('sb-range').value = '1';
                document.getElementById('sb-targeting-type').value = 'Focused Attack';
                document.getElementById('sb-targeting-type').dispatchEvent(new Event('change'));
                document.getElementById('sb-aoe-pattern').value = 'Self';
                document.getElementById('sb-coin-count').dispatchEvent(new Event('input'));"""

content = content.replace(search_block_reset, replace_block_reset)


# Replace block around renderPreview
search_block_preview = """                        <!-- Nombre de Habilidad con delineado negro -->
                        <div class="skill-name-banner" style="background-color: ${sinData.color}; padding: 4px 25px 4px 10px; font-weight: 900; font-size: 1.5rem; clip-path: polygon(0 0, 100% 0, 85% 100%, 0% 100%); letter-spacing: 1px; color: #FFF; -webkit-text-stroke: 1px #000; text-shadow: 1px 1px 0 #000;">
                            ${skill.name || 'Unnamed Skill'}
                        </div>

                        <!-- Nivel y Peso (Sin Emojis) -->
                        <div class="skill-stats" style="display: flex; gap: 15px; font-size: 1rem; color: #ccc;">
                            <span>Lv. + Mod. (${skill.scaling_stat || 'Fuerza'})</span>
                            <span style="color: #FFD700;">Atk Weight ${skill.weight || 1}</span>
                        </div>"""

replace_block_preview = """                        <!-- Nombre de Habilidad con delineado negro -->
                        <div class="skill-name-banner" style="background-color: ${sinData.color}; padding: 4px 25px 4px 10px; font-weight: 900; font-size: 1.5rem; clip-path: polygon(0 0, 100% 0, 85% 100%, 0% 100%); letter-spacing: 1px; color: #FFF; -webkit-text-stroke: 1px #000; text-shadow: 1px 1px 0 #000;">
                            ${(skill.targeting_type && skill.targeting_type !== 'Focused Attack') ? `[${skill.targeting_type}${skill.targeting_type === 'AoE' && skill.aoe_pattern ? ' - ' + skill.aoe_pattern : ''}] ` : ''}${skill.name || 'Unnamed Skill'}
                        </div>

                        <!-- Nivel y Peso (Sin Emojis) -->
                        <div class="skill-stats" style="display: flex; gap: 15px; font-size: 1rem; color: #ccc;">
                            <span>Lv. + Mod. (${skill.scaling_stat || 'Fuerza'})</span>
                            <span style="color: #FFD700;">Atk Weight ${skill.weight || 1}</span>
                            <span style="color: #44ddff;">Range ${skill.skillRange || 1}</span>
                        </div>"""

content = content.replace(search_block_preview, replace_block_preview)

with open('dm-combat-creator.html', 'w', encoding='utf-8') as f:
    f.write(content)
