const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const mapSwitchGuard = require('../js/vtt/map-switch-guard.js');
const dmMapLazyLoader = require('../js/vtt/dm-map-lazy-loader.js');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function fakeDmMapDom(initiallyActive = false) {
  let active = initiallyActive;
  const attributes = new Map([['data-vtt-src', 'vtt.html']]);
  const frame = {
    dataset: { vttSrc: 'vtt.html' },
    getAttribute(name) { return attributes.get(name) || null; },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    removeAttribute(name) { attributes.delete(name); },
  };
  const section = {
    classList: { contains(name) { return name === 'active-module' && active; } },
    querySelector(selector) { return selector === 'iframe[data-vtt-src]' ? frame : null; },
  };
  const documentRef = {
    getElementById(id) { return id === 'modulo-mapa' ? section : null; },
  };
  return { documentRef, frame, setActive(value) { active = Boolean(value); } };
}

test('DM VTT iframe remains unloaded until MAPA is the active module', () => {
  const dom = fakeDmMapDom(false);
  expect(dmMapLazyLoader.ensureLoaded(dom.documentRef)).toBe(false);
  expect(dom.frame.getAttribute('src')).toBeNull();

  dom.setActive(true);
  expect(dmMapLazyLoader.ensureLoaded(dom.documentRef)).toBe(true);
  expect(dom.frame.getAttribute('src')).toBe('vtt.html');
});

test('DM VTT iframe is torn down on MAPA -> TEATRO and can reload on re-entry', () => {
  const dom = fakeDmMapDom(true);

  expect(dmMapLazyLoader.sync(dom.documentRef)).toBe(true);
  expect(dom.frame.getAttribute('src')).toBe('vtt.html');

  dom.setActive(false);
  expect(dmMapLazyLoader.sync(dom.documentRef)).toBe(true);
  expect(dom.frame.getAttribute('src')).toBeNull();

  dom.setActive(true);
  expect(dmMapLazyLoader.sync(dom.documentRef)).toBe(true);
  expect(dom.frame.getAttribute('src')).toBe('vtt.html');
});

test('invalid active-map definition is blocked instead of causing a reload loop', async () => {
  let reloads = 0;
  const notices = [];
  const guard = mapSwitchGuard.createGuard({
    currentMapId: 'map_a',
    resolveActiveDefinition: async () => null,
    reload: () => { reloads += 1; },
    notify: (message, mode) => notices.push({ message, mode }),
    log: { error() {} },
  });

  const result = await guard('map_b');
  expect(result.action).toBe('blocked');
  expect(result.reason).toBe('MAP_DEFINITION_UNAVAILABLE');
  expect(reloads).toBe(0);
  expect(notices.at(-1)?.mode).toBe('error');
});

test('valid map switch reloads exactly once while navigation is pending', async () => {
  let reloads = 0;
  const guard = mapSwitchGuard.createGuard({
    currentMapId: 'map_a',
    resolveActiveDefinition: async () => ({ id: 'map_b' }),
    reload: () => { reloads += 1; },
    log: { error() {} },
  });

  const first = await guard('map_b');
  const second = await guard('map_b');
  expect(first.action).toBe('reload');
  expect(second).toEqual({ action: 'ignore', reason: 'RELOAD_PENDING' });
  expect(reloads).toBe(1);
});

test('DM dashboard uses lazy VTT source and loads the lazy bootstrap before dashboard binding', () => {
  const html = read('hoja_de_DM.html');
  expect(html).toContain('<iframe data-vtt-src="vtt.html" title="Mapa táctico D&amp;D"></iframe>');
  expect(html).not.toContain('<iframe src="vtt.html" title="Mapa táctico D&amp;D"></iframe>');
  expect(html.indexOf('js/vtt/dm-map-lazy-loader.js')).toBeGreaterThan(-1);
  expect(html.indexOf('js/vtt/dm-map-lazy-loader.js')).toBeLessThan(html.indexOf('js/on-game-dashboard.js'));
});

test('VTT main routes active-map changes through the validated switch guard', () => {
  const source = read('js/vtt/main.js');
  expect(source).toContain("import './map-switch-guard.js';");
  expect(source).toContain('LuminousVttMapSwitchGuard?.createGuard?.');
  expect(source).toContain('resolveActiveDefinition: () => mapAuthoringState?.resolveActiveDefinition?.');
  expect(source).toContain('void mapSwitchGuard(mapId);');
  expect(source).toContain('refusing blind reload');
});
