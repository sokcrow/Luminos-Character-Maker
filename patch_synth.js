const fs = require('fs');
let content = fs.readFileSync('hoja_personaje.js', 'utf8');

const regex = /if\s*\(\s*tag\.startsWith\('crafting_up_'\)\s*\)\s*\{\s*modifier\s*\+=\s*parseInt\(\s*tag\.split\('_'\)\[2\]\s*\)\s*\|\|\s*0;\s*\}/g;

content = content.replace(regex, `if (tag.startsWith('crafting_up_')) {
                            modifier += parseInt(tag.split('_')[2]) || 0;
                        } else if (tag.startsWith('synth_bonus_')) {
                            modifier += parseInt(tag.split('_')[2]) || 0;
                        }`);

const regex2 = /if\s*\(\s*key\.startsWith\('crafting_up_'\)\s*\)\s*\{\s*modifier\s*\+=\s*parseInt\(\s*key\.split\('_'\)\[2\]\s*\)\s*\|\|\s*0;\s*\}/g;

content = content.replace(regex2, `if (key.startsWith('crafting_up_')) {
                            modifier += parseInt(key.split('_')[2]) || 0;
                        } else if (key.startsWith('synth_bonus_')) {
                            modifier += parseInt(key.split('_')[2]) || 0;
                        }`);

fs.writeFileSync('hoja_personaje.js', content, 'utf8');
console.log('patched synth_bonus');
