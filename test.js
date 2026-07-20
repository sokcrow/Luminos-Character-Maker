const fs = require('fs');
const js = fs.readFileSync('hoja_personaje.js', 'utf8');
if (js.includes('mesa_crafteo_activa')) {
    console.log('Includes mesa_crafteo_activa');
}
