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
assert.ok(html.includes('js/spell-catalog-core.js'), 'Spells must use the canonical spell catalog');
assert.ok(html.includes('window.LuminousSpellCatalog'), 'Spells must resolve from the canonical spell source');
assert.ok(html.includes('data-ability="spells"'), 'Spells must be a real interactive player section');
assert.ok(html.includes('data-ability="skills"'), 'Combat Skills remain separately accessible');
assert.ok(html.includes("event==='hit'&&!viewerTargeted"), 'Only an actually hit viewer may record being hit');
assert.ok(html.includes("event==='identified'&&!current.seen&&!current.hit"), 'Identification requires prior evidence');
assert.ok(html.includes("!idsFor(unit,kind).includes"), 'Observation cannot add unrelated abilities to a creature');
assert.ok(html.includes('luminous:bestiary-combat-observation'), 'The prototype exposes a player-scoped combat event adapter');
assert.ok(html.includes('localStorage.setItem(STORAGE_KEY'), 'Prototype knowledge is retained locally');
assert.ok(!html.includes('data-debug'), 'No debug controls may appear in player UI');

assert.ok(html.includes('(orientation:landscape)'), 'Mobile landscape needs its own layout');
assert.ok(html.includes('min-height:46px'), 'Mobile touch targets need adequate height');
assert.ok(html.includes('state.skills.set('), 'Skill details must resolve from live catalogs');
assert.ok(!html.includes('id: "wraith_hound"'), 'The visual reference is not canonical monster data');
console.log('Bestiario prototype: canonical catalog references, UI structure, responsive rules and JS parsing passed.');
