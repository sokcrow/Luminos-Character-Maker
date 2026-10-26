const fs = require('fs');
const jsCode = fs.readFileSync('js/statusManager.js', 'utf8');

let STATUS_REGISTRY;
let StatusManager;

const window = {
  set STATUS_REGISTRY(val) { STATUS_REGISTRY = val; },
  set StatusManager(val) { StatusManager = val; }
};

eval(jsCode);

const missing = [];
for (const [key, value] of Object.entries(STATUS_REGISTRY)) {
    if (!value.icon) {
        missing.push(key);
    }
}
console.log(missing.join('\n'));
