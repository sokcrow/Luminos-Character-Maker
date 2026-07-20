const fs = require('fs');

let content = fs.readFileSync('hoja_personaje.js', 'utf8');

const doc_comment = `
// =====================================================================================
// DOCUMENTACIÓN FASE 5: VALIDACIÓN DE MUNICIÓN Y CONSUMIBLES (PREPARACIÓN PARA COMBATE)
// =====================================================================================
// El campo \`vinculo_item\` en ítems con el tag 'arma' será estrictamente validado
// por el motor de combate en futuras fases. Un arma no podrá dispararse ni recargarse
// a menos que el script detecte en el inventario activo (o stash) el ID exacto del ítem
// listado en su \`vinculo_item\` (ej. "balas_9mm", "flechas_acero").
// =====================================================================================
`;

content = doc_comment + '\n' + content;
fs.writeFileSync('hoja_personaje.js', content, 'utf8');
console.log('Docs added');
