import './camera-follow.js';
import './physical-resolver.js';
import './interaction-intent.js';
import './world-object-components.js';
import './lighting-engine.js';
import './lighting-physical-patch.js';

const STYLE_ID = 'vtt-map-hud-style';
const HUD_ID = 'vtt-map-hud';

const clean = (value) => String(value ?? '').trim();
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const esc = (value) => clean(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
#${HUD_ID}{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:36500;display:grid;grid-template-columns:auto auto auto auto;gap:6px;align-items:stretch;max-width:calc(100vw - 176px);pointer-events:none;font-family:monospace;color:#dce3e8}
#${HUD_ID}[hidden]{display:none!important}.vtt-map-hud-card{pointer-events:auto;min-height:48px;padding:7px 9px;background:rgba(7,9,11,.95);border:1px solid #4b555e;box-shadow:4px 4px 0 rgba(0,0,0,.55);display:flex;align-items:center;gap:8px}.vtt-map-hud-card strong{display:block;color:#d7b151;font-size:10px;letter-spacing:.08em}.vtt-map-hud-card small{display:block;color:#98a3aa;font-size:9px;line-height:1.35}.vtt-map-hud-actions{grid-column:1/-1;display:flex;gap:5px;align-items:center;min-height:0;padding:5px 7px}.vtt-map-hud-actions[hidden]{display:none}.vtt-map-hud-actions .vtt-hud-object-label{min-width:150px;max-width:230px}.vtt-map-hud-actions button,.vtt-map-hud-card button{border:1px solid #59636c;background:#11161a;color:#dce3e8;font:700 9px monospace;padding:6px 8px;cursor:pointer}.vtt-map-hud-actions button:hover,.vtt-map-hud-card button:hover{border-color:#d7b151;color:#d7b151}.vtt-map-hud-actions button:disabled,.vtt-map-hud-card button:disabled{opacity:.4;cursor:not-allowed}.vtt-hud-status-good{color:#9fd19f!important}.vtt-hud-status-warn{color:#d7b151!important}.vtt-hud-status-danger{color:#dc8d8d!important}.vtt-hud-inline{display:flex;gap:4px;align-items:center}.vtt-hud-layer{min-width:25px!important;padding:5px!important}.vtt-hud-follow.is-following{border-color:#9fd19f!important;color:#9fd19f!important}.vtt-hud-follow.is-free{border-color:#d7b151!important;color:#d7b151!important}body.vtt-dm-edit-active #${HUD_ID}{opacity:.82;bottom:8px}body.vtt-dm-edit-active #${HUD_ID} .vtt-map-hud-actions{display:none!important}
@media(max-width:1000px){#${HUD_ID}{left:82px;right:170px;transform:none;max-width:none;grid-template-columns:1fr 1fr;bottom:8px}.vtt-map-hud-actions{overflow-x:auto}.vtt-map-hud-card{min-width:0}}
  `;
  document.head.appendChild(style);
}

function ensureHud() {
  let hud = document.getElementById(HUD_ID);
  if (hud) return hud;
  hud = document.createElement('section');
  hud.id = HUD_ID;
  hud.setAttribute('aria-label', 'Tactical map HUD');
  hud.innerHTML = `
    <div class="vtt-map-hud-card" data-hud="map"><span><strong id="vtt-hud-map-name">MAP</strong><small id="vtt-hud-map-position">Z0 · CELL —</small></span><span class="vtt-hud-inline"><button type="button" class="vtt-hud-layer" data-hud-layer="prev" title="Previous floor">Z−</button><button type="button" class="vtt-hud-layer" data-hud-layer="next" title="Next floor">Z+</button></span></div>
    <div class="vtt-map-hud-card" data-hud="camera"><span><strong>CAMERA</strong><small id="vtt-hud-camera-state">FREE</small></span><span class="vtt-hud-inline"><button type="button" class="vtt-hud-follow" data-hud-camera="toggle">FOLLOW</button><button type="button" data-hud-camera="recenter">CENTER</button></span></div>
    <div class="vtt-map-hud-card" data-hud="movement"><span><strong id="vtt-hud-token-name">NO TOKEN</strong><small id="vtt-hud-movement-state">MOVEMENT —</small></span></div>
    <div class="vtt-map-hud-card" data-hud="physical"><span><strong>PHYSICAL</strong><small id="vtt-hud-physical-state">COVER NONE · EXPOSED</small></span></div>
    <div class="vtt-map-hud-card vtt-map-hud-actions" id="vtt-hud-actions" hidden><span class="vtt-hud-object-label"><strong id="vtt-hud-object-name">OBJECT</strong><small id="vtt-hud-object-meta">—</small></span><div class="vtt-hud-inline" id="vtt-hud-action-buttons"></div><button type="button" data-hud-clear-object title="Clear object selection">×</button></div>
  `;
  document.body.appendChild(hud);
  return hud;
}

function layerList(mapData = {}, activeZ = 0) {
  const set = new Set([Number(activeZ) || 0]);
  Object.keys(mapData.zLevels || {}).forEach((key) => { if (Number.isFinite(Number(key))) set.add(Number(key)); });
  (mapData.verticalPortals || []).forEach((portal) => {
    const values = [portal.from?.z, portal.to?.z, ...(Array.isArray(portal.between) ? portal.between : [])];
    values.forEach((value) => { if (Number.isFinite(Number(value))) set.add(Number(value)); });
  });
  return [...set].sort((a, b) => a - b);
}

function cellForPoint(point = {}, mapData = {}) {
  const size = Math.max(1, finite(mapData.grid?.size, 70));
  return { col: Math.floor(finite(point.x) / size), row: Math.floor(finite(point.y) / size) };
}

function definitionFor(instance, mapData = {}) {
  return window.LuminousVttPhysicalResolver?.definitionFor?.(instance, mapData) || null;
}

function objectAt(point, mapData = {}, zLayer = 0) {
  const core = window.LuminousVttWorldObjectCore;
  if (!core) return null;
  for (let i = (mapData.worldObjects || []).length - 1; i >= 0; i -= 1) {
    const instance = mapData.worldObjects[i];
    if (core.objectLayer(instance) !== Number(zLayer) || core.isDestroyed(instance)) continue;
    const definition = definitionFor(instance, mapData);
    if (!definition) continue;
    const rect = core.footprintRect(instance, definition, mapData.grid || {});
    if (point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height) return instance;
  }
  return null;
}

function perceivedByPlayer(runtime, actor, instance, definition, mapData) {
  if (runtime?.bridge?.isDm) return true;
  if (!actor || !instance || !definition) return false;
  const perception = runtime?.lighting?.perceptionAtPoint;
  if (typeof perception !== 'function') return true;
  const physical = window.LuminousVttPhysicalResolver;
  const point = {
    x: finite(instance.position?.x),
    y: finite(instance.position?.y),
    zLayer: finite(instance.position?.zLayer),
    elevationFt: physical?.objectTopFt?.(instance, definition, mapData) ?? finite(instance.position?.elevationFt),
  };
  return perception(actor, point)?.visible === true;
}

export function start({ runtime = window.LuminousVttRuntime, mapData = runtime?.engine?.mapData } = {}) {
  if (!runtime?.engine || !mapData) return null;
  if (window.LuminousVttMapHudRuntime?.api) return window.LuminousVttMapHudRuntime.api;
  ensureStyles();
  const hud = ensureHud();
  const engine = runtime.engine;
  const canvas = engine.canvas;
  const physical = window.LuminousVttPhysicalResolver;
  const cameraApi = window.LuminousVttCameraFollow;
  const intentApi = window.LuminousVttInteractionIntent;
  const componentApi = window.LuminousVttWorldObjectComponents;
  if (!physical || !cameraApi || !intentApi || !componentApi) throw new Error('MAP_HUD_DEPENDENCY_REQUIRED');

  const cameraFollow = cameraApi.createController({ runtime, mapData });
  const componentRuntime = componentApi.start({ runtime, mapData });
  const executor = intentApi.createExecutor({ runtime, mapData, worldObjectBridge: runtime.worldObjects?.bridge });
  executor.start();
  let selectedId = null;
  let cursorPoint = null;
  let stopped = false;
  let timer = null;

  const node = (id) => document.getElementById(id);
  const actor = () => cameraFollow.target()
    || runtime?.pov?.controlledViewers?.()?.[0]
    || runtime?.lighting?.controlledViewers?.()?.[0]
    || (mapData.tokens || []).find((token) => token.viewer === true)
    || (mapData.tokens || []).find((token) => token.characterLink?.mode === 'current_player')
    || null;
  const selected = () => (mapData.worldObjects || []).find((entry) => String(entry.instanceId) === String(selectedId)) || null;

  function selectObject(instance) {
    selectedId = instance?.instanceId || null;
    sync();
    return selected();
  }

  function visibleSelected() {
    const instance = selected();
    const definition = definitionFor(instance, mapData);
    const currentActor = actor();
    if (!instance || !definition) return { instance: null, definition: null, actor: currentActor };
    if (!perceivedByPlayer(window.LuminousVttRuntime || runtime, currentActor, instance, definition, mapData)) return { instance: null, definition: null, actor: currentActor };
    return { instance, definition, actor: currentActor };
  }

  function syncMap(currentActor) {
    const label = clean(mapData.name || mapData.title || mapData.label || mapData.id || mapData.mapId || 'MAP').toUpperCase();
    const point = currentActor || cursorPoint;
    const cell = point ? cellForPoint(point, mapData) : null;
    node('vtt-hud-map-name').textContent = label;
    node('vtt-hud-map-position').textContent = `Z${Number(engine.activeZ) || 0}${cell ? ` · CELL ${cell.col},${cell.row}` : ' · CELL —'}`;
    const floors = layerList(mapData, engine.activeZ);
    const index = floors.indexOf(Number(engine.activeZ));
    const isDm = Boolean(runtime.bridge?.isDm);
    hud.querySelector('[data-hud-layer="prev"]').disabled = !isDm || index <= 0;
    hud.querySelector('[data-hud-layer="next"]').disabled = !isDm || index < 0 || index >= floors.length - 1;
  }

  function syncCamera() {
    const state = cameraFollow.state();
    const label = state.enabled ? 'FOLLOWING TOKEN' : state.hasTarget ? 'FREE PAN' : 'DM FREE';
    node('vtt-hud-camera-state').textContent = label;
    const button = hud.querySelector('[data-hud-camera="toggle"]');
    button.textContent = state.enabled ? 'FREE' : 'FOLLOW';
    button.classList.toggle('is-following', state.enabled);
    button.classList.toggle('is-free', !state.enabled);
    button.disabled = !state.hasTarget;
    hud.querySelector('[data-hud-camera="recenter"]').disabled = !state.hasTarget;
  }

  function syncMovement(currentActor) {
    if (!currentActor) {
      node('vtt-hud-token-name').textContent = runtime.bridge?.isDm ? 'DM VIEW' : 'NO TOKEN';
      node('vtt-hud-movement-state').textContent = 'MOVEMENT —';
      return;
    }
    node('vtt-hud-token-name').textContent = clean(currentActor.name || currentActor.label || currentActor.id || 'TOKEN').toUpperCase();
    const state = currentActor.movementState || {};
    const speed = finite(state.speedFt ?? currentActor.speedFt ?? currentActor.speed, 0);
    const remaining = Number.isFinite(Number(currentActor.movementRemainingFt)) ? Number(currentActor.movementRemainingFt) : (Number.isFinite(Number(state.remainingFt)) ? Number(state.remainingFt) : null);
    const mode = clean(state.mode || currentActor.activeMovementMode || 'walk').toUpperCase();
    node('vtt-hud-movement-state').textContent = `${mode} · ${remaining == null ? `${speed} FT` : `${remaining}/${speed || remaining} FT`}${state.dashed ? ' · DASH' : ''}${state.prone ? ' · PRONE' : ''}`;
  }

  function syncPhysical(currentActor) {
    if (!currentActor) { node('vtt-hud-physical-state').textContent = 'COVER — · HIDE —'; return; }
    const state = physical.physicalState(currentActor, mapData);
    const coverActive = currentActor.coverState?.active === true;
    const coverText = coverActive ? `COVER ${String(state.cover.level || 'none').toUpperCase()}` : state.cover.rank > 0 ? `NEAR ${String(state.cover.level).toUpperCase()} COVER` : 'COVER NONE';
    const hiddenText = state.hidden ? `HIDDEN · ${String(state.hiding?.concealment || 'full').toUpperCase()}` : 'EXPOSED';
    const target = node('vtt-hud-physical-state');
    target.textContent = `${coverText} · ${hiddenText} · EYE ${state.eyeHeightFt.toFixed(1)}FT`;
    target.className = state.hidden ? 'vtt-hud-status-good' : coverActive ? 'vtt-hud-status-warn' : '';
    if (state.hidden?.instanceId && !selectedId) selectedId = state.hidden.instanceId;
  }

  function syncActions(currentActor) {
    const actionsCard = node('vtt-hud-actions');
    const buttons = node('vtt-hud-action-buttons');
    const { instance, definition } = visibleSelected();
    if (!currentActor || !instance || !definition || mapData.dmEditMode?.active) {
      actionsCard.hidden = true;
      buttons.replaceChildren();
      return;
    }
    const distanceFt = physical.distanceToObjectFt(currentActor, instance, definition, mapData);
    const actions = executor.availableActions(currentActor, instance);
    node('vtt-hud-object-name').textContent = clean(definition.name || instance.instanceId).toUpperCase();
    node('vtt-hud-object-meta').textContent = `${distanceFt.toFixed(1)} FT · ${definition.physical?.heightFt || 0}FT HIGH${actions.length ? '' : ' · OUT OF RANGE / NO ACTION'}`;
    buttons.replaceChildren();
    actions.forEach((action) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.hudAction = action;
      button.textContent = action.replaceAll('_', ' ').toUpperCase();
      buttons.appendChild(button);
    });
    actionsCard.hidden = false;
  }

  function sync() {
    if (stopped) return;
    const currentActor = actor();
    if (currentActor?.stealthState?.hiddenInObjectId && !selectedId) selectedId = currentActor.stealthState.hiddenInObjectId;
    syncMap(currentActor);
    syncCamera();
    syncMovement(currentActor);
    syncPhysical(currentActor);
    syncActions(currentActor);
  }

  async function handleAction(action) {
    const currentActor = actor();
    const instance = selected();
    if (!currentActor || !instance) return;
    const result = await executor.execute({ source: runtime.bridge?.isDm ? 'dm' : 'player', actorTokenId: currentActor.id, targetId: instance.instanceId, action });
    if (!result?.valid) runtime.controller?.notify?.(result?.reason || 'Interaction unavailable.', 'error');
    sync();
  }

  const onCanvasMove = (event) => {
    const rect = canvas.getBoundingClientRect();
    cursorPoint = engine.camera.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
  };
  const onCanvasClick = (event) => {
    if (mapData.dmEditMode?.active || event.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const point = engine.camera.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
    const hit = objectAt(point, mapData, engine.activeZ);
    if (!hit) return;
    const definition = definitionFor(hit, mapData);
    const currentActor = actor();
    if (!perceivedByPlayer(window.LuminousVttRuntime || runtime, currentActor, hit, definition, mapData)) return;
    selectObject(hit);
  };
  const onResolved = () => sync();
  const onKey = (event) => { if (event.key === 'Escape' && selectedId) { selectedId = null; sync(); } };

  canvas.addEventListener('mousemove', onCanvasMove);
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('vtt:camera-follow-changed', onResolved);
  canvas.addEventListener('vtt:interaction-resolved', onResolved);
  canvas.addEventListener('vtt:world-object-changed', onResolved);
  window.addEventListener('keydown', onKey);
  hud.addEventListener('click', (event) => {
    const cameraAction = event.target.closest?.('[data-hud-camera]')?.dataset?.hudCamera;
    if (cameraAction === 'toggle') cameraFollow.toggle();
    else if (cameraAction === 'recenter') cameraFollow.recenter();
    const layerDirection = event.target.closest?.('[data-hud-layer]')?.dataset?.hudLayer;
    if (layerDirection && runtime.bridge?.isDm) {
      const floors = layerList(mapData, engine.activeZ), index = floors.indexOf(Number(engine.activeZ));
      const next = layerDirection === 'prev' ? floors[index - 1] : floors[index + 1];
      if (Number.isFinite(Number(next))) runtime.setLayer?.(Number(next));
    }
    const action = event.target.closest?.('[data-hud-action]')?.dataset?.hudAction;
    if (action) void handleAction(action);
    if (event.target.closest?.('[data-hud-clear-object]')) { selectedId = null; sync(); }
  });

  timer = window.setInterval(sync, 250);
  sync();

  function publish() {
    const current = window.LuminousVttRuntime || runtime;
    if (current?.mapHud === api) return;
    window.LuminousVttRuntime = Object.freeze({ ...current, mapHud: api, cameraFollow, physical, interactionExecutor: executor, worldComponents: componentRuntime });
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    if (timer != null) window.clearInterval(timer);
    canvas.removeEventListener('mousemove', onCanvasMove);
    canvas.removeEventListener('click', onCanvasClick);
    canvas.removeEventListener('vtt:camera-follow-changed', onResolved);
    canvas.removeEventListener('vtt:interaction-resolved', onResolved);
    canvas.removeEventListener('vtt:world-object-changed', onResolved);
    window.removeEventListener('keydown', onKey);
    cameraFollow.stop();
    executor.stop();
    componentRuntime?.stop?.();
    hud.remove();
    document.getElementById(STYLE_ID)?.remove();
  }

  const api = Object.freeze({ sync, stop, selectObject, selected, actor, cameraFollow, physical, executor, componentRuntime });
  window.LuminousVttMapHudRuntime = Object.freeze({ api, stop });
  publish();
  window.setTimeout(publish, 500);
  window.addEventListener('beforeunload', stop, { once: true });
  return api;
}
