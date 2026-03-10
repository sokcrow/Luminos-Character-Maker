const fs = require('fs');
let html = fs.readFileSync('hoja_personaje.html', 'utf8');

// Make sure stats tab has a header
if(!html.includes('<h2>Stats</h2>')) {
    html = html.replace('<div class="sheet-tab-content sheet-tab-stats">',
                        '<div class="sheet-tab-content sheet-tab-stats">\n<div class="sheet-app-header"><h2>Stats</h2></div>\n<div class="sheet-app-body-scroll">');
    // Also we need to close the sheet-app-body-scroll
    html = html.replace('<!-- Equipo Tab -->', '</div>\n        <!-- Equipo Tab -->');
}

fs.writeFileSync('hoja_personaje.html', html);
