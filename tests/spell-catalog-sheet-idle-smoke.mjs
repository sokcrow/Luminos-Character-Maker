import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync('js/spell-catalog-core.js', 'utf8');
function load(definitionsOnly) {
  const scripts = [];
  const context = vm.createContext({ document: {
    currentScript: { dataset: { definitionsOnly: String(definitionsOnly) } },
    getElementById() { return null; }, createElement() { return {}; },
    head: { appendChild(script) { scripts.push(script.src); } }
  } });
  context.window = context;
  vm.runInContext(source, context);
  assert.ok(context.LuminousSpellCatalog.mage_hand, 'the sheet still receives real definitions');
  return scripts;
}
assert.deepEqual(load(true), ['js/role-spell-catalog-core.js'], 'sheet definitions cannot start Combat hook installers or permanent polling intervals');
assert.ok(load(false).includes('js/spell-batch-cantrips-runtime.js'), 'the Combat bootstrap retains its runtime modules');
const sheet = fs.readFileSync('hoja_personaje.html', 'utf8');
assert.match(sheet, /id="spell-catalog-core-script" data-definitions-only="true"/);
console.log('Spell catalog sheet idle: definitions remain available without loading Combat pollers.');
