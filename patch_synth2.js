const fs = require('fs');
let content = fs.readFileSync('hoja_personaje.js', 'utf8');

const regex = /if\s*\(\s*kw\.toLowerCase\(\)\.startsWith\('crafting_up_'\)\s*\)\s*\{\s*const\s+bonus\s*=\s*parseInt\(\s*kw\.split\('_'\)\[2\]\s*\)\s*\|\|\s*0;\s*dificultadActual\s*-=\s*bonus;\s*\}/g;

content = content.replace(regex, `if (kw.toLowerCase().startsWith('crafting_up_')) {
                            const bonus = parseInt(kw.split('_')[2]) || 0;
                            dificultadActual -= bonus;
                        } else if (kw.toLowerCase().startsWith('synth_bonus_')) {
                            const bonus = parseInt(kw.split('_')[2]) || 0;
                            dificultadActual -= bonus;
                        }`);

fs.writeFileSync('hoja_personaje.js', content, 'utf8');
console.log('patched synth_bonus');
