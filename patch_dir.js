const fs = require('fs');
let content = fs.readFileSync('dm-combat-creator.html', 'utf8');

const search = `        let allGlobalSkills = {};`;

const replace = `        let allGlobalSkills = {};

        function listenToSkillDirectory() {
            db.ref('campaña/base_datos_skills/').on('value', (snap) => {
                allGlobalSkills = snap.val() || {};
                filterSkillDirectory();
            });
        }

        function filterSkillDirectory() {
            const query = (document.getElementById('skill-dir-search').value || '').toLowerCase().trim();
            const listContainer = document.getElementById('skill-directory-list');
            listContainer.innerHTML = '';

            Object.entries(allGlobalSkills).forEach(([id, skill]) => {
                const name = (skill.name || '').toLowerCase();
                const damage = (skill.tipo_dano || '').toLowerCase();
                const sin = (skill.pecado || '').toLowerCase();

                if (name.includes(query) || damage.includes(query) || sin.includes(query)) {
                    const row = document.createElement('div');
                    row.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: #222; padding: 6px; border: 1px solid #443311;";

                    const info = document.createElement('div');
                    info.style.cssText = "display: flex; flex-direction: column; cursor: pointer; flex-grow: 1;";
                    info.innerHTML = \`<strong style="color: #00FFFF; font-size: 13px;">\${skill.name}</strong><span style="color: #aaa; font-size: 10px;">\${skill.tipo_dano} | \${skill.pecado}</span>\`;
                    info.onclick = () => { renderSkillCard(skill); };

                    const actions = document.createElement('div');
                    actions.style.cssText = "display: flex; gap: 4px;";

                    const btnEdit = document.createElement('button');
                    btnEdit.innerText = "[ EDITAR ]";
                    btnEdit.style.cssText = "background: #c49a00; color: #000; border: none; font-size: 10px; font-weight: bold; cursor: pointer; padding: 2px 5px;";
                    btnEdit.onclick = () => { loadSkillIntoForm(skill); };

                    const btnDel = document.createElement('button');
                    btnDel.innerText = "[ BORRAR ]";
                    btnDel.style.cssText = "background: #8a0303; color: #fff; border: none; font-size: 10px; font-weight: bold; cursor: pointer; padding: 2px 5px;";
                    btnDel.onclick = () => {
                        if(confirm("¿Purgar " + skill.name + " de la base de datos?")) {
                            db.ref('campaña/base_datos_skills/' + id).remove();
                        }
                    };

                    actions.appendChild(btnEdit);
                    actions.appendChild(btnDel);

                    row.appendChild(info);
                    row.appendChild(actions);
                    listContainer.appendChild(row);
                }
            });
        }`;

content = content.replace(search, replace);
fs.writeFileSync('dm-combat-creator.html', content);
