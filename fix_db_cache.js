const fs = require('fs');
let js = fs.readFileSync('hoja_personaje.js', 'utf8');

// Ensure dbItemsCache is populated globally in player view too since we use it
const itemsCacheLogic = `
    // Fetch global items to cache for recipes
    db.ref("campaña/base_datos_items").on("value", snap => {
        window.dbItemsCache = snap.val() || {};
    });
`;

if (!js.includes('window.dbItemsCache = snap.val()')) {
    js += itemsCacheLogic;
    fs.writeFileSync('hoja_personaje.js', js);
    console.log('Added dbItemsCache logic');
} else {
    console.log('dbItemsCache already present');
}
