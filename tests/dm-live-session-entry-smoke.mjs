import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('pantalla_dm.html', 'utf8');
const script = html.match(/<script id="dm-live-session-entry">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'live navigation must initialize independently of Firebase');
assert.ok(html.indexOf(script) < html.indexOf('firebase.initializeApp(firebaseConfig)'));
assert.match(html, /<a[^>]*id="btn-modo-director"[^>]*href="hoja_de_DM\.html"[^>]*target="DirectorDashboard"/,
  'live entry must work as native navigation even without JavaScript');

function setup(open) {
  const link = { addEventListener(type, callback) { assert.equal(type, 'click'); this.click = callback; } };
  const context = vm.createContext({ window: { open }, document: { getElementById: () => link }, console: { warn() {} } });
  vm.runInContext(script, context);
  return { link, context };
}
function click(link, extra = {}) {
  const event = { prevented: false, preventDefault() { this.prevented = true; }, ...extra };
  link.click(event);
  return event;
}

let opens = 0, focuses = 0;
const visor = { closed: false, focus() { focuses++; } };
const normal = setup((url, name) => {
  assert.equal(url, 'hoja_de_DM.html');
  assert.equal(name, 'DirectorDashboard');
  opens++;
  return visor;
});
assert.equal(click(normal.link).prevented, true);
assert.equal(click(normal.link).prevented, true);
assert.equal(opens, 2, 'explicit live entry must navigate the named window on every click');
assert.equal(focuses, 2);
vm.runInContext('openLiveDirector()', normal.context);
assert.equal(opens, 2, 'Start Combat must reuse the same live window');
visor.closed = true;
click(normal.link);
assert.equal(opens, 3, 'a closed session must reopen');
for (const key of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
  assert.equal(click(normal.link, { [key]: true }).prevented, false, 'modified clicks belong to the browser');
}
assert.equal(opens, 3);

for (const blocked of [() => null, () => { throw Error('blocked'); }, () => ({ focus() { throw Error('focus failed'); } })]) {
  const fixture = setup(blocked);
  assert.equal(click(fixture.link).prevented, false, 'popup/focus failure must preserve native link navigation');
}
let attempts = 0;
const recovered = setup(() => ++attempts === 1 ? { focus() { throw Error('stale window'); } } : { focus() {} });
assert.equal(click(recovered.link).prevented, false);
assert.equal(click(recovered.link).prevented, true);
assert.equal(attempts, 2, 'a stale window handle must not strand subsequent clicks');

// Execute the actual legacy tab binding, including its pane-clearing behavior.
// This reproduced the blank Studio: the live entry has no data-tab destination.
const legacy = html.slice(html.indexOf('// --- LÓGICA DE TABS VISUALIZADOR DE JUEGO ---'), html.indexOf('// --- COMUNICACIONES DM ---'));
const liveLink = { dataset: {}, addEventListener() { throw Error('live entry must not bind as a Studio tab'); } };
const tab = { dataset: { tab: 'tab-tiempo' }, addEventListener() {} };
const selectors = [];
vm.runInNewContext(legacy, { document: { querySelectorAll(selector) {
  selectors.push(selector);
  return selector === '.dm-tab-btn[data-tab]' ? [tab] : [tab, liveLink];
} } });
assert.deepEqual(selectors, ['.dm-tab-btn[data-tab]']);

console.log('DM live entry: native fallback, popup reuse, reopen, failed focus recovery and Studio tab isolation passed.');
