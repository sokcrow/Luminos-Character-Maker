const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const sceneDirty = require('../js/vtt/scene-dirty.js');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function eventTargetStub() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
    },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    dispatchEvent(event) {
      for (const fn of listeners.get(event?.type) || []) fn(event);
      return true;
    },
    emit(name, detail = {}) { return this.dispatchEvent({ type: name, detail }); },
  };
}

test('scene dirty normalizes render and vision independently', () => {
  expect(sceneDirty.normalize({ reason: 'camera' })).toEqual({
    reason: 'camera', render: true, vision: false, active: false, sourceEvent: null, tokenId: null, meta: null,
  });
  expect(sceneDirty.normalize({ reason: 'token', vision: true, active: true, tokenId: 7 })).toMatchObject({
    reason: 'token', render: true, vision: true, active: true, tokenId: '7',
  });
});

test('legacy semantic token event becomes one canonical scene dirty event', () => {
  const canvas = eventTargetStub();
  const host = eventTargetStub();
  const seen = [];
  canvas.addEventListener(sceneDirty.EVENT_NAME, (event) => seen.push(event.detail));
  const bridge = sceneDirty.installLegacyBridge({ canvas, mapData: { dmEditMode: { active: false } }, host });

  canvas.emit('vtt:token-moved', { tokenId: 'p1' });
  expect(seen).toHaveLength(1);
  expect(seen[0]).toMatchObject({ reason: 'token', render: true, vision: true, active: false, sourceEvent: 'vtt:token-moved', tokenId: 'p1' });
  expect(bridge.snapshot().bridgedEvents).toBe(1);
  bridge.stop();
});

test('legacy adapter does not watch wheel or keyboard and limits raw pointer bridging to DM edit mode', () => {
  const canvas = eventTargetStub();
  const host = eventTargetStub();
  const mapData = { dmEditMode: { active: false } };
  const seen = [];
  canvas.addEventListener(sceneDirty.EVENT_NAME, (event) => seen.push(event.detail));
  const bridge = sceneDirty.installLegacyBridge({ canvas, mapData, host });

  expect(host.listeners.has('wheel')).toBe(false);
  expect(host.listeners.has('keydown')).toBe(false);
  expect(host.listeners.has('keyup')).toBe(false);
  expect(host.listeners.has('resize')).toBe(true);
  expect(host.listeners.has('mousemove')).toBe(true);
  expect(host.listeners.has('mouseup')).toBe(true);

  host.emit('mousemove');
  expect(seen).toHaveLength(0);
  mapData.dmEditMode.active = true;
  host.emit('mousemove');
  host.emit('mouseup');
  expect(seen).toHaveLength(2);
  expect(seen[0]).toMatchObject({ reason: 'edit', render: true, vision: false, active: true });
  expect(seen[1]).toMatchObject({ reason: 'edit', render: true, vision: true, active: false });

  bridge.stop();
  expect(host.listeners.get('mousemove')?.size || 0).toBe(0);
  expect(host.listeners.get('mouseup')?.size || 0).toBe(0);
});

test('camera owns canonical render-only invalidation instead of performance guard raw wheel/mouse observers', () => {
  const camera = read('js/vtt/camera.js');
  const guard = read('js/vtt/performance-guard.js');
  expect(camera).toContain('LuminousVttSceneDirty?.emit');
  expect(camera).toContain("reason: 'camera'");
  expect(camera).toContain('vision: false');
  expect(camera).toContain("this.notifyVisualChange('pan', true");
  expect(camera).toContain("this.notifyVisualChange('zoom', true");
  expect(guard).not.toContain("globalThis.addEventListener?.('wheel'");
  expect(guard).not.toContain("globalThis.addEventListener?.('keydown'");
  expect(guard).not.toContain("globalThis.addEventListener?.('keyup'");
  expect(guard).not.toContain("globalThis.addEventListener?.('mousemove'");
});

test('scene dirty contract loads before main runtime', () => {
  const html = read('vtt.html');
  const dirty = html.indexOf('js/vtt/scene-dirty.js');
  const main = html.indexOf('js/vtt/main.js');
  expect(dirty).toBeGreaterThan(0);
  expect(main).toBeGreaterThan(dirty);
});

test('scene dirty and camera parse cleanly', () => {
  execFileSync(process.execPath, ['--check', path.join(__dirname, '..', 'js/vtt/scene-dirty.js')], { stdio: 'pipe' });
  const tmp = path.join(os.tmpdir(), `luminous-vtt-camera-${process.pid}.mjs`);
  fs.writeFileSync(tmp, read('js/vtt/camera.js'));
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
  finally { fs.unlinkSync(tmp); }
});
