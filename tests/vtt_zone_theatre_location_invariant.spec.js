const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const Transition = require('../js/regional-local-transition-core.js');
const lazyLoader = require('../js/vtt/dm-map-lazy-loader.js');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function seededZoneState() {
  return {
    worldPosition: {
      worldId: 'luminous',
      regionId: 'K',
      zoneId: 'k_villa_interior',
      chunkCol: 1,
      chunkRow: 2,
      x: 1771,
      y: 931,
      zLayer: 2,
      elevationFt: 15,
      regionalHex: { district: 'K', q: 4, r: -2 },
      regionalGraphId: 'k_graph',
      regionalGraphRevision: 7,
      regionalGraphFingerprint: 'abc123',
      transitionId: 'entered_villa',
    },
    vttTokenState: {
      villa_map: { x: 1771, y: 931, zLayer: 2, elevationFt: 15, updatedAt: 101 },
    },
    fog: {
      villa_map: { explored: ['1:2:10:13', '1:2:11:13'], updatedAt: 102 },
    },
    zoneDelta: {
      openDoors: ['villa_front_door'],
      removedNpcIds: ['guard_2'],
    },
  };
}

test.describe('Zone ↔ Theatre physical-location invariant', () => {
  test('DM switching MAPA -> TEATRO -> MAPA preserves the same canonical Zone state and creates no regional transition', () => {
    const doc = createDmDocument();
    const canonical = seededZoneState();
    const before = clone(canonical);
    const regionalTransitionRequests = [];
    let disposeCalls = 0;

    instanceControl.applyDashboardInstance('mapa', doc);
    expect(lazyLoader.sync(doc)).toBe(true);
    expect(doc.frame.getAttribute('src')).toBe('vtt.html');

    doc.frame.contentWindow = {
      LuminousVttRuntime: {
        dispose(reason) {
          expect(reason).toBe('dm-map-deactivated');
          disposeCalls += 1;
          return true;
        },
      },
    };

    instanceControl.applyDashboardInstance('teatro', doc);
    expect(lazyLoader.sync(doc)).toBe(true);
    expect(doc.frame.getAttribute('src')).toBeNull();
    expect(doc.theatre.classList.contains('active-module')).toBe(true);

    // Theatre is a presentation mode. It must not move the party, collapse the
    // local Zone into its parent regional hex, or enqueue a physical exit.
    expect(canonical).toEqual(before);
    expect(canonical.worldPosition.zoneId).toBe('k_villa_interior');
    expect(canonical.worldPosition.regionalHex).toEqual({ district: 'K', q: 4, r: -2 });
    expect(canonical.worldPosition.zLayer).toBe(2);
    expect(canonical.worldPosition.elevationFt).toBe(15);
    expect(canonical.fog.villa_map.explored).toEqual(before.fog.villa_map.explored);
    expect(canonical.zoneDelta).toEqual(before.zoneDelta);
    expect(regionalTransitionRequests).toHaveLength(0);

    instanceControl.applyDashboardInstance('mapa', doc);
    expect(lazyLoader.sync(doc)).toBe(true);
    expect(doc.frame.getAttribute('src')).toBe('vtt.html');
    expect(canonical).toEqual(before);
    expect(disposeCalls).toBe(1);
  });

  test('view-mode code has no authority to write worldPosition or submit a regional exit', () => {
    const instanceSource = read('js/instance-control.js');
    const lazySource = read('js/vtt/dm-map-lazy-loader.js');
    const transitionRuntime = read('js/vtt/regional-local-transition-runtime.js');

    expect(instanceSource).not.toContain('vtt_regional_local_transition_requests');
    expect(instanceSource).not.toContain('/worldPosition');
    expect(lazySource).not.toContain('vtt_regional_local_transition_requests');
    expect(lazySource).not.toContain('/worldPosition');

    expect(transitionRuntime).toContain("window.addEventListener('mouseup',captureBoundary,true)");
    expect(transitionRuntime).toContain('submitBoundaryRequest({token,position,transition,requested})');
    expect(transitionRuntime).not.toContain('modulo-teatro');
    expect(transitionRuntime).not.toContain("'teatro'");
    expect(transitionRuntime).not.toContain('instancia_activa');
  });

  test('only an explicit physical Zone exit changes the regional destination', () => {
    const source = seededZoneState().worldPosition;
    const plan = Transition.createLocalExitPlan({
      worldPosition: source,
      exitSide: 'east',
      transitionId: 'explicit_zone_exit',
    });

    expect(plan.valid).toBe(true);
    expect(plan.sourceHex).toEqual({ district: 'K', q: 4, r: -2 });
    expect(plan.targetHex).toEqual({ district: 'K', q: 5, r: -2 });
    expect(plan.targetPosition.zoneId).toBe('regional_5_-2');
    expect(plan.targetPosition.transitionId).toBe('explicit_zone_exit');
    expect(plan.targetPosition.zLayer).toBe(2);
    expect(plan.targetPosition.elevationFt).toBe(15);

    // Planning an exit is pure: until the authoritative transition is committed,
    // the current Zone remains the canonical physical truth.
    expect(source.zoneId).toBe('k_villa_interior');
    expect(source.regionalHex).toEqual({ district: 'K', q: 4, r: -2 });
  });
});
