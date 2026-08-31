const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const connectivity = require('../js/vtt/movement-connectivity.js');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

class ConnectionRef {
  constructor() { this.handlers = new Set(); this.value = false; }
  on(event, handler) { if (event === 'value') { this.handlers.add(handler); handler({ val: () => this.value }); } }
  off(event, handler) { if (event === 'value') this.handlers.delete(handler); }
  emit(value) { this.value = Boolean(value); for (const handler of [...this.handlers]) handler({ val: () => this.value }); }
}

test('realtime movement creates no remote controller and performs no update while disconnected', async () => {
  const connectionRef = new ConnectionRef();
  const instances = [];
  const base = {
    createController() {
      const state = { starts: 0, stops: 0, previews: 0, finalizes: 0 };
      instances.push(state);
      return {
        start() { state.starts += 1; return { started: true }; },
        stop() { state.stops += 1; },
        snapshot() { return { writes: state.previews }; },
        schedulePreview() { state.previews += 1; return true; },
        finalizeToken: async () => { state.finalizes += 1; return { valid: true }; },
        handleIncoming() { return true; },
        clearIncoming() { return true; },
        handleCanonicalSync() { return true; },
        reconcilePlayerSubscriptions() { return true; },
        previewRefForToken() { return { ref: {} }; },
      };
    },
  };
  const host = { LuminousVttMovementRealtime: base };
  connectivity.installRealtime(host);
  const controller = host.LuminousVttMovementRealtime.createController({ connectionRef });
  controller.start();

  expect(controller.snapshot()).toMatchObject({ connected: false, onlineOnly: true });
  expect(instances).toHaveLength(0);
  expect(controller.schedulePreview({ id: 'p1' })).toBe(false);
  await expect(controller.finalizeToken({ id: 'p1' }, async () => ({ valid: true }))).rejects.toThrow('VTT_OFFLINE_NO_UPDATE');

  connectionRef.emit(true);
  expect(instances).toHaveLength(1);
  expect(instances[0].starts).toBe(1);
  expect(controller.schedulePreview({ id: 'p1' })).toBe(true);
  expect(instances[0].previews).toBe(1);
  await expect(controller.finalizeToken({ id: 'p1' }, async () => ({ valid: true }))).resolves.toMatchObject({ valid: true });

  connectionRef.emit(false);
  expect(instances[0].stops).toBe(1);
  expect(controller.schedulePreview({ id: 'p1' })).toBe(false);
  await expect(controller.finalizeToken({ id: 'p1' }, async () => ({ valid: true }))).rejects.toThrow('VTT_OFFLINE_NO_UPDATE');

  connectionRef.emit(true);
  expect(instances).toHaveLength(2);
  expect(instances[1].starts).toBe(1);
  controller.stop();
  expect(instances[1].stops).toBe(1);
});

test('turn origin and Dash action metadata survive a canonical round-trip', () => {
  const token = {
    movementTurnStart: { x: 35, y: 35, zLayer: 0, elevationFt: 0, gridPosition: { col: 0, row: 0, z: 0 } },
    dashActionType: 'quick_action',
  };
  const stored = connectivity.turnExtras(token);
  expect(stored).toEqual({ movementTurnStart: token.movementTurnStart, dashActionType: 'quick_action' });

  const restored = {};
  connectivity.applyTurnExtras(restored, stored);
  expect(restored).toEqual(token);
  stored.movementTurnStart.x = 999;
  expect(restored.movementTurnStart.x).toBe(35);
});

test('movement bootstrap gates plans, Dash, reset, round controls and turn persistence on connectivity', () => {
  const source = read('js/vtt/movement-bootstrap.js');
  expect(source).toContain("import './movement-connectivity.js'");
  expect(source).toContain('installRealtime?.(window)');
  expect(source).toContain("reason: 'VTT_OFFLINE_NO_UPDATE'");
  expect(source).toContain('if (!movementOnline()) return offlineResult()');
  expect(source).toContain('assertMovementOnline()');
  expect(source).toContain("'position/movementTurnStart'");
  expect(source).toContain("'position/dashActionType'");
  expect(source).toContain('WORLD · OFFLINE · MOVEMENT LOCKED');
});
