const fs = require('fs');
let content = fs.readFileSync('dm-combat-creator.html', 'utf8');

const search = `        // 1. TABS LOGIC
        function switchEditorTab(tab) {
            document.getElementById('module-units').style.display = tab === 'units' ? 'block' : 'none';
            document.getElementById('module-skills').style.display = tab === 'skills' ? 'flex' : 'none';
            document.getElementById('editor-sidebar').style.width = tab === 'skills' ? '700px' : '350px';

            document.getElementById('tab-btn-units').className = tab === 'units' ? 'tab-btn active' : 'tab-btn';
            document.getElementById('tab-btn-skills').className = tab === 'skills' ? 'tab-btn active' : 'tab-btn';

            document.getElementById('tab-btn-units').style.background = tab === 'units' ? '#c49a00' : '#332211';
            document.getElementById('tab-btn-units').style.color = tab === 'units' ? '#000' : '#ccc';
            document.getElementById('tab-btn-skills').style.background = tab === 'skills' ? '#c49a00' : '#332211';
            document.getElementById('tab-btn-skills').style.color = tab === 'skills' ? '#000' : '#ccc';

            const previewLabel = document.getElementById('editor-preview');
            if (previewLabel) {
                previewLabel.innerText = tab === 'units' ? 'ENSAMBLAJE DE ENTIDADES' : 'ARCHIVO DE HABILIDADES';
            }
        }`;

const replace = `        // 1. TABS LOGIC
        function switchEditorTab(tab) {
            document.getElementById('module-units').style.display = tab === 'units' ? 'block' : 'none';
            document.getElementById('module-skills').style.display = tab === 'skills' ? 'flex' : 'none';
            document.getElementById('editor-sidebar').style.width = tab === 'skills' ? '750px' : '350px';

            document.getElementById('tab-btn-units').className = tab === 'units' ? 'tab-btn active' : 'tab-btn';
            document.getElementById('tab-btn-skills').className = tab === 'skills' ? 'tab-btn active' : 'tab-btn';

            document.getElementById('tab-btn-units').style.background = tab === 'units' ? '#c49a00' : '#332211';
            document.getElementById('tab-btn-units').style.color = tab === 'units' ? '#000' : '#ccc';
            document.getElementById('tab-btn-skills').style.background = tab === 'skills' ? '#c49a00' : '#332211';
            document.getElementById('tab-btn-skills').style.color = tab === 'skills' ? '#000' : '#ccc';

            const previewLabel = document.getElementById('editor-preview');
            if (previewLabel) {
                if (tab === 'units') {
                    renderPreview();
                } else {
                    previewLabel.innerHTML = '<span style="color: #555; font-size: 24px; font-weight: bold; font-family: \\'Bebas Neue\\', cursive; border: 2px dashed #555; padding: 20px;">[ SELECCIONA UNA HABILIDAD DEL DIRECTORIO ]</span>';
                }
            }
        }`;

content = content.replace(search, replace);
fs.writeFileSync('dm-combat-creator.html', content);
