export const SCENE_DIRTY_EVENT = 'vtt:scene-dirty';

export const SCENE_DIRTY_REASONS = Object.freeze({
  TOKEN: 'token',
  CAMERA: 'camera',
  TOPOLOGY: 'topology',
  LIGHTING: 'lighting',
  FOG: 'fog',
  CHUNK: 'chunk',
  EDIT: 'edit',
  RESIZE: 'resize',
  MEMORY: 'memory',
  UNKNOWN: 'unknown',
});

export function normalizeSceneDirty(detail = {}) {
  const source = detail && typeof detail === 'object' ? detail : {};
  return Object.freeze({
    reason: String(source.reason || SCENE_DIRTY_REASONS.UNKNOWN),
    render: source.render !== false,
    vision: source.vision === true,
    active: source.active === true,
    sourceEvent: source.sourceEvent ? String(source.sourceEvent) : null,
    tokenId: source.tokenId == null ? null : String(source.tokenId),
    meta: source.meta && typeof source.meta === 'object' ? source.meta : null,
  });
}

export function emitSceneDirty(target, detail = {}) {
  if (!target?.dispatchEvent) return false;
  const EventCtor = globalThis.CustomEvent;
  if (typeof EventCtor !== 'function') return false;
  target.dispatchEvent(new EventCtor(SCENE_DIRTY_EVENT, { detail: normalizeSceneDirty(detail) }));
  return true;
}

export function bridgeSceneDirty(target, sourceEvent, detail = {}) {
  const eventName = String(sourceEvent || '').trim();
  if (!eventName || !target?.addEventListener) return () => {};
  const handler = (event) => emitSceneDirty(target, {
    ...detail,
    sourceEvent: eventName,
    tokenId: event?.detail?.tokenId ?? detail.tokenId,
    meta: event?.detail || detail.meta || null,
  });
  target.addEventListener(eventName, handler);
  return () => target.removeEventListener?.(eventName, handler);
}

const api = Object.freeze({
  EVENT_NAME: SCENE_DIRTY_EVENT,
  REASONS: SCENE_DIRTY_REASONS,
  normalize: normalizeSceneDirty,
  emit: emitSceneDirty,
  bridge: bridgeSceneDirty,
});

if (typeof globalThis !== 'undefined') globalThis.LuminousVttSceneDirty = api;
