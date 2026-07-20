const fs = require('fs');
const content = fs.readFileSync('pantalla_dm.html', 'utf8');
const lines = content.split('\n');
console.log(lines.slice(7950, 8000).join('\n'));
