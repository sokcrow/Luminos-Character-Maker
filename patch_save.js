const fs = require('fs');
let content = fs.readFileSync('dm-combat-creator.html', 'utf8');

const search = `        // 4. SAVE DB LOGIC
        function saveSkillToDB() {
            const name = document.getElementById('sb-name').value;
            if(!name) { alert('[!] El nombre de la Habilidad es requerido para guardar.'); return; }

            const skillObj = generateSkillObject();
            const uuid = Date.now().toString() + "_" + Math.random().toString(36).substring(2, 7);
            const id = document.getElementById("sb-id").value || "db_skill_" + uuid;
            skillObj.id = id;
            skillObj.name = name;

            db.ref('campaña/base_datos_skills/' + id).set(skillObj).then(() => {
                // Visual confirmation
                const container = document.getElementById('skill-builder-container');
                const originalBorder = container.style.border;
                container.style.border = '2px solid #c49a00';
                setTimeout(() => container.style.border = originalBorder, 500);

                // Reset form
                document.getElementById('sb-name').value = '';
                document.querySelectorAll('.sin-radio').forEach(el => el.checked = false);
                document.getElementById('sb-base').value = '4';
                document.getElementById('sb-coin-power').value = '4';
                document.getElementById('sb-coin-count').value = '1';
                document.getElementById('sb-coin-count').dispatchEvent(new Event('input'));

                // Hide builder and show start button again
                container.style.display = 'none';
                document.getElementById('btn-start-skill-builder').style.display = 'block';
            });
        }`;

const replace = `        // 4. SAVE DB LOGIC
        function saveSkillToDB() {
            const name = document.getElementById('sb-name').value;
            if(!name) { alert('[!] El nombre de la Habilidad es requerido para guardar.'); return; }

            const skillObj = generateSkillObject();
            const currentId = document.getElementById("sb-current-id").value;
            const uuid = Date.now().toString() + "_" + Math.random().toString(36).substring(2, 7);
            const id = currentId || document.getElementById("sb-id").value || "db_skill_" + uuid;
            skillObj.id = id;
            skillObj.name = name;

            db.ref('campaña/base_datos_skills/' + id).set(skillObj).then(() => {
                // Visual confirmation
                const container = document.getElementById('skill-builder-container');
                const originalBorder = container.style.border;
                container.style.border = '2px solid #c49a00';
                setTimeout(() => container.style.border = originalBorder, 500);

                // Reset form
                document.getElementById('sb-name').value = '';
                document.getElementById('sb-id').value = '';
                document.getElementById('sb-current-id').value = '';
                document.querySelectorAll('.sin-radio').forEach(el => el.checked = false);
                const wrathRadio = document.getElementById('sin-wrath');
                if(wrathRadio) wrathRadio.checked = true;

                document.getElementById('sb-base').value = '4';
                document.getElementById('sb-coin-power').value = '4';
                document.getElementById('sb-coin-count').value = '1';
                document.getElementById('sb-coin-count').dispatchEvent(new Event('input'));

                document.getElementById('sb-global-effects-container').innerHTML = '';

                // Hide builder and show start button again
                container.style.display = 'none';
                document.getElementById('btn-start-skill-builder').style.display = 'block';
            });
        }

        function loadSkillIntoForm(skill) {
            document.getElementById('btn-start-skill-builder').style.display = 'none';
            document.getElementById('skill-builder-container').style.display = 'block';

            document.getElementById('sb-current-id').value = skill.id || '';
            document.getElementById('sb-id').value = skill.id || '';
            document.getElementById('sb-name').value = skill.name || '';
            document.getElementById('sb-base').value = skill.basePower || 0;
            document.getElementById('sb-coin-power').value = skill.coinPower || 0;
            document.getElementById('sb-coin-count').value = skill.coinAmount || 1;
            document.getElementById('sb-weight').value = skill.weight || 1;
            document.getElementById('sb-tier').value = skill.tier || 1;
            document.getElementById('sb-is-item-skill').checked = !!skill.isItemSkill;

            // Stats
            const statRadio = document.querySelector(\`input[name="sb-scaling-stat"][value="\${skill.scaling_stat || 'Fuerza'}"]\`);
            if (statRadio) statRadio.checked = true;

            // Damage
            const dmgRadio = document.querySelector(\`input[name="sb-damage-radio"][value="\${skill.tipo_dano || 'contundente'}"]\`);
            if (dmgRadio) dmgRadio.checked = true;

            // Sin
            const sinRadio = document.querySelector(\`input[name="sb-sin-radio"][value="\${skill.pecado || 'sinless'}"]\`);
            if (sinRadio) sinRadio.checked = true;

            // Defense
            const isDefense = !!skill.isDefense;
            document.getElementById('sb-is-defense').checked = isDefense;
            document.getElementById('sb-is-defense').dispatchEvent(new Event('change'));
            if (isDefense) {
                document.getElementById('sb-defense-subtype').value = skill.defenseSubtype || 'Guard';
                document.getElementById('sb-defense-requires-unlock').checked = !!skill.requiresUnlock;
            }

            // Global Effects
            const globalContainer = document.getElementById('sb-global-effects-container');
            globalContainer.innerHTML = '';
            if (skill.effects && Array.isArray(skill.effects)) {
                skill.effects.forEach(eff => {
                    globalContainer.insertAdjacentHTML('beforeend', createEffectEditorHtml(false));
                    const row = globalContainer.lastElementChild;
                    row.querySelector('.eff-trigger').value = eff.trigger || '[On Use]';
                    row.querySelector('.eff-target').value = eff.target || 'self';
                    row.querySelector('.eff-potency').value = eff.potency || 0;
                    row.querySelector('.eff-count').value = eff.count || 0;
                    row.querySelector('.eff-status').value = eff.status || '';
                });
            }

            // Trigger coin regeneration
            document.getElementById('sb-coin-count').dispatchEvent(new Event('input'));

            // Wait a tick for DOM to update
            setTimeout(() => {
                const coinContainers = document.querySelectorAll('.sb-coin-block');
                if (skill.coins && Array.isArray(skill.coins)) {
                    skill.coins.forEach((coin, i) => {
                        if (coinContainers[i] && coin.effects && Array.isArray(coin.effects)) {
                            const effContainer = coinContainers[i].querySelector('.coin-effects-container');
                            effContainer.innerHTML = '';
                            coin.effects.forEach(eff => {
                                effContainer.insertAdjacentHTML('beforeend', createEffectEditorHtml(true));
                                const row = effContainer.lastElementChild;
                                row.querySelector('.eff-trigger').value = eff.trigger || '[On Hit]';
                                row.querySelector('.eff-target').value = eff.target || 'target';
                                row.querySelector('.eff-potency').value = eff.potency || 0;
                                row.querySelector('.eff-count').value = eff.count || 0;
                                row.querySelector('.eff-status').value = eff.status || '';
                            });
                        }
                    });
                }
            }, 50);
        }`;

content = content.replace(search, replace);
fs.writeFileSync('dm-combat-creator.html', content);
