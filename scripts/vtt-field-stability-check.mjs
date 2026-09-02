import assert from 'node:assert/strict';
import { installFieldStabilityHotfix } from '../js/vtt/field-stability-hotfix.js';

class Host extends EventTarget {
  constructor() {
    super();
    this.parent = this;
    this.CustomEvent = globalThis.CustomEvent;
    this.performance = globalThis.performance;
    this.setInterval = setInterval;
    this.clearInterval = clearInterval;
    this.queueMicrotask = queueMicrotask;
    this.actorValueHandler = null;
    this.firebase = {
      database: () => ({
        ref: (path) => ({
          on: (event, handler) => {
            if (path === 'campaña/actores' && event === 'value') {
              this.actorValueHandler = handler;
              handler({ val: () => ({ actor_a: { id: 'actor_a', icono: 'actor-a.png' } }) });
            }
          },
          off: () => {},
        }),
      }),
    };
  }
}

const host = new Host();
const canvas = new EventTarget();
let rawVisionCalls = 0;
let rawCameraDirty = 0;
const dirtyEvents = [];
const syncCalls = [];

host.LuminousVttSceneDirty = {
  emit(target, detail) {
    dirtyEvents.push(detail);
    target.dispatchEvent(new CustomEvent('vtt:scene-dirty', { detail }));
    return true;
  },
};

const engine = {
  canvas,
  mapData: {
    tokens: [{
      id: 'player:p1',
      actorId: 'actor_a',
      canonicalScope: 'player',
      x: 10,
      y: 20,
      zLayer: 0,
    }],
  },
  activeZ: 0,
  cameraFollowActive: true,
  tokenDrag: null,
  tokenMotion: null,
  renderer: {
    syncTokenView(id) { syncCalls.push(id); return true; },
  },
  camera: {
    notifyVisualChange() { rawCameraDirty += 1; },
  },
  emitSemanticEvent(type, detail = {}, dirty = null) {
    if (dirty) host.LuminousVttSceneDirty.emit(canvas, { ...dirty, sourceEvent: type, tokenId: detail.tokenId || null, meta: detail });
  },
  calculateVision() {
    rawVisionCalls += 1;
    return { version: rawVisionCalls };
  },
  setZLayer(z) {
    this.activeZ = Number(z) || 0;
  },
};

host.LuminousVttRuntime = { engine };
const hotfix = installFieldStabilityHotfix(host);
hotfix.ensure();
await Promise.resolve();
await Promise.resolve();

// FOV is cached during render-only frames.
const firstVision = engine.calculateVision();
for (let index = 0; index < 100; index += 1) assert.equal(engine.calculateVision(), firstVision);
assert.equal(rawVisionCalls, 1, 'FOV should be computed once while vision is clean');

host.LuminousVttSceneDirty.emit(canvas, { reason: 'token', render: true, vision: false, tokenId: 'player:p1' });
engine.calculateVision();
assert.equal(rawVisionCalls, 1, 'render-only token dirty must not recompute FOV');

host.LuminousVttSceneDirty.emit(canvas, { reason: 'token', render: true, vision: true, tokenId: 'player:p1' });
engine.calculateVision();
assert.equal(rawVisionCalls, 2, 'vision dirty must recompute FOV exactly once');

// Traversal preview is visual-only; final token-moved remains allowed to invalidate vision.
dirtyEvents.length = 0;
engine.emitSemanticEvent('vtt:token-preview-moved', { tokenId: 'player:p1', traversing: true }, { reason: 'token', render: true, vision: true, active: true });
assert.equal(dirtyEvents.at(-1)?.vision, false, 'traversal frame must not request FOV');
engine.emitSemanticEvent('vtt:token-moved', { tokenId: 'player:p1' }, { reason: 'token', render: true, vision: true, active: false });
assert.equal(dirtyEvents.at(-1)?.vision, true, 'final token move must request FOV');

// Camera center dirty is suppressed only while traversal is already producing token frames.
engine.tokenMotion = { tokenId: 'player:p1' };
engine.camera.notifyVisualChange('center', false, {});
assert.equal(rawCameraDirty, 0, 'camera center during traversal must not emit duplicate dirty');
engine.tokenMotion = null;
engine.camera.notifyVisualChange('center', false, {});
assert.equal(rawCameraDirty, 1, 'normal camera center must still notify');

// Raw drag suspends only the camera-follow performance hint and restores it on mouseup.
engine.tokenDrag = { token: engine.mapData.tokens[0] };
host.dispatchEvent(new Event('mousedown'));
await Promise.resolve();
assert.equal(engine.cameraFollowActive, false, 'raw drag must suspend camera follow');
host.dispatchEvent(new Event('mouseup'));
assert.equal(engine.cameraFollowActive, true, 'mouseup must restore camera follow');
engine.tokenDrag = null;

// Player tactical image comes only from assigned Actor.icono.
await Promise.resolve();
assert.equal(engine.mapData.tokens[0].icono, 'actor-a.png');
assert.equal(engine.mapData.tokens[0].tokenImage, 'actor-a.png');
assert.equal(engine.mapData.tokens[0].portrait, 'actor-a.png');
assert.ok(syncCalls.includes('player:p1'));

const snapshot = hotfix.snapshot();
assert.ok(snapshot.visionCacheHits >= 100);
assert.ok(snapshot.traversalVisionSuppressions >= 1);
assert.ok(snapshot.traversalCameraDirtySuppressions >= 1);
assert.ok(snapshot.playerIconsHydrated >= 1);

hotfix.stop();
console.log('VTT field stability hotfix: PASS');
