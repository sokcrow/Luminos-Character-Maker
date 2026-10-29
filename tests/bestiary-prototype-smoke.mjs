import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../prototipo-bestiario.html', import.meta.url), 'utf8');
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
assert.equal(inline.length, 1, 'A single UI controller is expected');
new vm.Script(inline[0], { filename: 'prototipo-bestiario.html' });

for (const [unitFile, skillFile] of [
  ['beast-cr0','beast-cr0'],
  ['kobold-tier1','kobold-tier1'],
  ['goblin','goblin-tier1'],
  ['wolf','wolf'],
  ['cave-sapphire-spiders','cave-sapphire-spiders'],
]) {
  assert.ok(html.includes(`js/unit-catalog-${unitFile}.js`), `${unitFile} must read the canonical Unit Catalog`);
  assert.ok(html.includes(`js/skill-catalog-${skillFile}.js`), `${skillFile} must read the canonical Skill Catalog`);
}
for (const concept of ['data-panel="roster"','data-panel="art"','data-panel="info"','data-panel="skills"','data-mobile-tab="roster"','data-mobile-tab="info"','role="dialog"']) {
  assert.ok(html.includes(concept), `Missing required UI affordance: ${concept}`);
}
assert.ok(html.includes('@media(max-width:900px)'), 'Mobile needs its own layout');
assert.ok(html.includes('(orientation:landscape)'), 'Mobile landscape needs its own layout');
assert.ok(html.includes('min-height:46px'), 'Mobile touch targets need adequate height');
assert.ok(html.includes('state.skills.set('), 'Skill details must resolve from live catalogs');
assert.ok(!html.includes('id: "wraith_hound"'), 'The visual reference is not canonical monster data');
console.log('Bestiario prototype: canonical catalog references, UI structure, responsive rules and JS parsing passed.');
