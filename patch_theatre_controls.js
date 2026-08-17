const fs = require('fs');
let code = fs.readFileSync('js/theatre-controls.js', 'utf8');
code = code.replace(/expresionActiva: expActiva,/g, '');
code = code.replace(/let expActiva = "Neutral";/g, '');
code = code.replace(/} else if \(!expresionesObj\["Neutral"\]\) {[\s\S]*?expActiva = Object.keys\(expresionesObj\)\[0\];\s*}/g, '');
fs.writeFileSync('js/theatre-controls.js', code);
