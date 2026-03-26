const fs = require('fs');

let content = fs.readFileSync('pantalla_dm.html', 'utf8');

// The HTML for the burger menu already added, but we need to add the JS to toggle it
const jsToAdd = `
      document.getElementById('btn-dm-burger-menu').addEventListener('click', () => {
          document.getElementById('dm-burger-modal').style.display = 'flex';
      });
      document.getElementById('btn-cerrar-burger').addEventListener('click', () => {
          document.getElementById('dm-burger-modal').style.display = 'none';
      });
      // Cerrar al clickear en las opciones (tab buttons)
      document.querySelectorAll('#dm-burger-modal .dm-tab-btn').forEach(btn => {
          btn.addEventListener('click', () => {
              document.getElementById('dm-burger-modal').style.display = 'none';
          });
      });
`;

if (!content.includes('btn-dm-burger-menu\').addEventListener')) {
    content = content.replace('function initializeDMApp() {', 'function initializeDMApp() {\n' + jsToAdd);
    fs.writeFileSync('pantalla_dm.html', content);
    console.log("Added burger menu JS");
}
