const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const lifecycleApi = require('../js/vtt/runtime-lifecycle.js');
const lazyLoader = require('../js/vtt/dm-map-lazy-loader.js');

function loadInstanceControl() {
  const context = { window: {}, console, setTimeout, clearTimeout };
  vm.runInNewContext(read('js/instance-control.js'), context, { filename: 'js/instance-control.js' });
  return context.window.LuminousInstanceControl;
}

const instanceControl = loadInstanceControl();

function fakeClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(...names) { names.forEach((name) => values.add(name)); },
    remove(...names) { names.forEach((name) => values.delete(name)); },
    contains(name) { return values.has(name); },
    toggle(name, force) {
      const next = force == null ? !values.has(name) : Boolean(force);
      if (next) values.add(name); else values.delete(name);
      return next;
    },
  };
}

function fakeModule(id, active = false) {
  return {
    id,
    style: {},
    classList: fakeClassList(active ? ['game-module', 'active-module'] : ['game-module', 'hidden']),
  };
}

function createDmDocument() {
  const standby = fakeModule('modulo-standby');
  const theatre = fakeModule('modulo-teatro');
  const map = fakeModule('modulo-mapa');
  const combat = fakeModule('modulo-combate');
  const attrs = new Map();
  const frame = {
    dataset: { vttSrc: 'vtt.html' },
    contentWindow: {},
    getAttribute(name) { return attrs.get(name) || null; },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    removeAttribute(name) { attrs.delete(name); },
  };
  map.querySelector = (selector) => selector === 'iframe[data-vtt-src]' ? frame : null;
  const nodes = new Map([
    [standby.id, standby], [theatre.id, theatre], [map.id, map], [combat.id, combat],
  ]);
  return {
    frame,
    map,
    theatre,
    querySelector() { return null; },
    querySelectorAll(selector) { return selector === '.game-module' ? [standby, theatre, map, combat] : []; },
    getElementById(id) { return nodes.get(id) || null; },
  };
}

function createPlayerDocument() {
  const nodes = new Map();
  const theatre = {
    id: 'theatre-view-player', style: {}, classList: fakeClassList(),
    setAttribute() {},
  };
  nodes.set(theatre.id, theatre);
  const body = {
    classList: fakeClassList(),
    appendChild(node) { node.parentNode = body; nodes.set(node.id, node); return node; },
    removeChild(node) { nodes.delete(node.id); node.parentNode = null; node.removed = true; return node; },
  };
  return {
    body,
    querySelector() { return null; },
    getElementById(id) { return nodes.get(id) || null; },
    createElement(tagName) {
      const attributes = new Map();
      return {
        tagName: String(tagName).toUpperCase(), style: {}, dataset: {}, classList: fakeClassList(),
        setAttribute(name, value) { attributes.set(name, String(value)); },
        getAttribute(name) { return attributes.get(name) || null; },
        removeAttribute(name) { attributes.delete(name); },
        addEventListener() {},
        remove() {
          if (this.parentNode) this.parentNode.removeChild(this);
          else this.removed = true;
        },
      };
    },
  };
}

test('runtime lifecycle dispose is idempotent and blocks a late bootstrap before start', async () => {
  const lifecycle = lifecycleApi.createLifecycle();
  let releaseLoad;
  let starts = 0;
  const load = new Promise((resolve) => { releaseLoad = resolve; });
  const pending = lifecycle.run('firebase-bridge', () => load, () => { starts += 1; return {}; });

  expect(lifecycle.dispose('map-to-theatre')).toBe(true);
  expect(lifecycle.dispose('duplicate-teardown')).toBe(false);
  releaseLoad({});

  const result = await pending;
  expect(result.status).toBe('skipped');
  expect(starts).toBe(0);
  expect(lifecycle.isDisposed()).toBe(true);
  expect(lifecycle.getReason()).toBe('map-to-theatre');
});

test('runtime lifecycle late-start result is stopped exactly once if disposal wins the race', async () => {
  const lifecycle = lifecycleApi.createLifecycle();
  let releaseStart;
  let stops = 0;
  const pending = lifecycle.run('streaming', async () => ({}), async () => new Promise((resolve) => {
    releaseStart = () => resolve({ stop() { stops += 1; } });
  }));

  await Promise.resolve();
  expect(lifecycle.dispose('pagehide')).toBe(true);
  releaseStart();
  const result = await pending;

  expect(result.status).toBe('disposed');
  expect(stops).toBe(1);
});

test('DM can repeat MAPA -> TEATRO -> MAPA three times with graceful VTT disposal and fresh src reload', () => {
  const doc = createDmDocument();
  let disposeCalls = 0;

  for (let cycle = 0; cycle < 3; cycle += 1) {
    instanceControl.applyDashboardInstance('mapa', doc);
    expect(lazyLoader.sync(doc)).toBe(true);
    expect(doc.frame.getAttribute('src')).toBe('vtt.html');
    expect(doc.map.classList.contains('active-module')).toBe(true);

    let disposedThisDocument = false;
    doc.frame.contentWindow = {
      LuminousVttRuntime: {
        dispose(reason) {
          expect(reason).toBe('dm-map-deactivated');
          expect(disposedThisDocument).toBe(false);
          disposedThisDocument = true;
          disposeCalls += 1;
          return true;
        },
      },
    };

    instanceControl.applyDashboardInstance('teatro', doc);
    expect(lazyLoader.sync(doc)).toBe(true);
    expect(doc.frame.getAttribute('src')).toBeNull();
    expect(doc.theatre.classList.contains('active-module')).toBe(true);
    expect(disposedThisDocument).toBe(true);
  }

  expect(disposeCalls).toBe(3);

  instanceControl.applyDashboardInstance('mapa', doc);
  expect(lazyLoader.sync(doc)).toBe(true);
  expect(doc.frame.getAttribute('src')).toBe('vtt.html');
});

test('player can repeat MAPA -> TEATRO -> MAPA three times without reusing a destroyed iframe', () => {
  const doc = createPlayerDocument();
  const mapFrames = [];

  for (let cycle = 0; cycle < 3; cycle += 1) {
    instanceControl.applyPlayerInstance('mapa', doc);
    const frame = doc.getElementById('player-instance-map');
    expect(frame).not.toBeNull();
    expect(frame.src).toBe('vtt.html');
    mapFrames.push(frame);

    instanceControl.applyPlayerInstance('teatro', doc);
    expect(frame.removed).toBe(true);
    expect(doc.getElementById('player-instance-map')).toBeNull();
    expect(doc.getElementById('theatre-view-player').style.display).toBe('flex');
  }

  expect(new Set(mapFrames).size).toBe(3);
  instanceControl.applyPlayerInstance('mapa', doc);
  expect(doc.getElementById('player-instance-map')).not.toBeNull();
});

test('VTT main owns an explicit parent-callable teardown and page lifecycle fallback', () => {
  const source = read('js/vtt/main.js');
  expect(source).toContain("import './runtime-lifecycle.js';");
  expect(source).toContain('dispose: disposeRuntime');
  expect(source).toContain("window.addEventListener('pagehide', handlePageHide");
  expect(source).toContain("window.addEventListener('beforeunload', handleBeforeUnload");
  expect(source).toContain('const stopIfDisposed = (runtime');
  expect(source).toContain('if (lifecycle.isDisposed()) return null');
  expect(source).toContain("window.removeEventListener('mousemove', engine.handleTokenMouseMove)");
});

test('DM lazy unload requests graceful dispose before removing iframe src', () => {
  const source = read('js/vtt/dm-map-lazy-loader.js');
  const disposeIndex = source.indexOf("requestFrameDispose(frame, 'dm-map-deactivated')");
  const removeIndex = source.indexOf("frame.removeAttribute?.('src')");
  expect(disposeIndex).toBeGreaterThan(-1);
  expect(removeIndex).toBeGreaterThan(disposeIndex);
});
