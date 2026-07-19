const fs = require('fs');
const js = fs.readFileSync('js/combatEngine.js', 'utf8');

let hasUnilateral = js.includes('resolveUnilateralAttack');
console.log('Has resolveUnilateralAttack:', hasUnilateral);

let applyDamageCount = js.match(/applyDamage\(/g).length;
console.log('Number of applyDamage calls (including definition):', applyDamageCount);
