const fs = require('fs');
const css = fs.readFileSync('hoja_personaje.css', 'utf8');
if (css.includes('sheet-tab-forja')) {
  console.log('CSS modified successfully');
} else {
  console.log('Failed to modify CSS');
}
