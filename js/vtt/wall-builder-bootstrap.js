import './wall-builder.js';
import { start as startWallAutoTile } from './wall-auto-tile-bootstrap.js';

const PROFILE_FIELD_ID = 'vtt-wall-builder-profile-field';
const STYLE_ID = 'vtt-wall-builder-style';

function ensureProfileUi(builder, controller) {
  const toolbar = document.getElementById('vtt-topology-toolbar');
  if (!toolbar) return null;
  let field = document.getElementById(PROFILE_FIELD_ID);
  if (field) return field;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${PROFILE_FIELD_ID}{display:grid;gap:4px;padding-top:6px;border-top:1px solid #3c4147;color:#9eabb3;font:9px monospace}
    #${PROFILE_FIELD_ID} select{width:100%;min-width:0;box-sizing:border-box;background:#090c0e;color:#e6ecef;border:1px solid #59636c;padding:5px;font:10px monospace}
    #${PROFILE_FIELD_ID} small{color:#7f8b93;line-height:1.3}
  `;
  document.head.appendChild(style);
  const catalog = builder.defaultProfileCatalog();
  field = document.createElement('label');
  field.id = PROFILE_FIELD_ID;
  field.className = 'vtt-toolbar-field';
  field.innerHTML = `<span>WALL PROFILE</span><select data-wall-profile>${Object.values(catalog).map((profile) => `<option value="${profile.id}">${profile.name.toUpperCase()} · ${profile.thicknessFt}FT</option>`).join('')}</select><small data-wall-profile-status>UNIT EDGES · AUTO-TILE READY</small>`;
  toolbar.appendChild(field);
  const syncVisibility = () => { field.hidden = controller.tool !== 'wall'; };
  toolbar.addEventListener('click', () => queueMicrotask(syncVisibility));
  syncVisibility();
  return field;
}

export function start({ runtime = window.LuminousVttRuntime, mapData = runtime?.engine?.mapData } = {}) {
  if (!runtime?.controller || !runtime?.engine || !mapData) return null;
  if (window.LuminousVttWallBuilderRuntime?.api) return window.LuminousVttWallBuilderRuntime.api;
  const builder = window.LuminousVttWallBuilder;
  if (!builder) throw new Error('WALL_BUILDER_REQUIRED');

  const controller = runtime.controller;
  const engine = runtime.engine;
  const canvas = engine.canvas;
  const renderer = engine.renderer;
  const bridge = controller.stateBridge || runtime.bridge;
  if (!bridge?.saveElement) throw new Error('TOPOLOGY_STATE_BRIDGE_REQUIRED');

  const original = {
    down: controller.handleMouseDown,
    move: controller.handleMouseMove,
    up: controller.handleMouseUp,
    topologyStyle: renderer.topologyStyle.bind(renderer),
  };

  canvas.removeEventListener('mousedown', original.down, true);
  window.removeEventListener('mousemove', original.move, true);
  window.removeEventListener('mouseup', original.up, true);

  const profileField = controller.isDm ? ensureProfileUi(builder, controller) : null;
  let profileId = profileField?.querySelector('[data-wall-profile]')?.value || 'concrete';
  let stopped = false;
  let autoTileApi = null;

  function editWallActive() {
    return Boolean(controller.isDm && controller.editActive?.() && controller.tool === 'wall');
  }

  function activeProfile() {
    return builder.profileFor(profileId);
  }

  function preview(from, to) {
    const profile = activeProfile();
    mapData.topologyPreview = {
      type: 'wall', from, to, z: [engine.activeZ], thicknessFt: profile.thicknessFt,
      wallProfileId: profile.id,
      heightFt: profile.heightFt,
      wall: { profileId:profile.id, materialId:profile.materialId, heightFt:profile.heightFt, visual:{ ...profile.visual } },
    };
  }

  function onMouseDown(event) {
    if (!editWallActive()) return original.down(event);
    if (event.button !== 0) return;
    if (engine.tokenAtEvent(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    controller.hideContextMenu?.();
    controller.drawStart = controller.topology.snapPointToVertex(controller.worldPoint(event), mapData.grid);
    preview(controller.drawStart, controller.drawStart);
  }

  function onMouseMove(event) {
    if (!editWallActive() || !controller.drawStart) return original.move(event);
    const candidate = controller.topology.snapPointToVertex(controller.worldPoint(event), mapData.grid);
    const to = controller.topology.axisAlignedVertex(controller.drawStart, candidate);
    preview(controller.drawStart, to);
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  async function saveRun(from, to) {
    const incoming = builder.createWallRun({ from, to, zLayer:engine.activeZ, profileId });
    const reconciliation = builder.reconcileRun(mapData.topology || [], incoming);
    if (!reconciliation.save.length) {
      const reason = reconciliation.skipped.some((entry) => entry.reason === 'EDGE_OCCUPIED_BY_OPENING')
        ? 'El tramo ya contiene una puerta o ventana.'
        : 'El tramo ya está cubierto por topología existente.';
      controller.notify?.(reason, 'error');
      return { saved:[], skipped:reconciliation.skipped };
    }
    const saved = await Promise.all(reconciliation.save.map((element) => bridge.saveElement(element)));
    controller.selectedId = saved[saved.length - 1]?.id || controller.selectedId;
    controller.renderEditor?.();
    const suffix = reconciliation.skipped.length ? ` · ${reconciliation.skipped.length} OMITIDOS` : '';
    controller.notify?.(`${saved.length} WALL EDGES GUARDADOS${suffix}`, 'success');
    return { saved, skipped:reconciliation.skipped };
  }

  function onMouseUp(event) {
    if (!editWallActive() || !controller.drawStart) return original.up(event);
    if (event.button !== 0) return;
    const from = controller.drawStart;
    const candidate = controller.topology.snapPointToVertex(controller.worldPoint(event), mapData.grid);
    const to = controller.topology.axisAlignedVertex(from, candidate);
    controller.drawStart = null;
    mapData.topologyPreview = null;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (controller.topology.sameVertex(from, to)) return;
    void saveRun(from, to).catch((error) => controller.notify?.(String(error.message || error), 'error'));
  }

  canvas.addEventListener('mousedown', onMouseDown, true);
  window.addEventListener('mousemove', onMouseMove, true);
  window.addEventListener('mouseup', onMouseUp, true);

  profileField?.querySelector('[data-wall-profile]')?.addEventListener('change', (event) => {
    profileId = event.target.value;
    const profile = activeProfile();
    const status = profileField.querySelector('[data-wall-profile-status]');
    if (status) status.textContent = `${profile.materialId.toUpperCase()} · ${profile.heightFt}FT HIGH · AUTO-TILE`;
  });

  renderer.topologyStyle = function wallBuilderTopologyStyle(element, isPreview = false) {
    const base = original.topologyStyle(element, isPreview);
    if (!isPreview && element?.type === 'wall') {
      const color = element.wall?.visual?.color;
      if (color) return { ...base, stroke:color };
    }
    return base;
  };

  function setProfile(nextId) {
    const profile = builder.profileFor(nextId);
    profileId = profile.id;
    const select = profileField?.querySelector('[data-wall-profile]');
    if (select) select.value = profile.id;
    return profile;
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    autoTileApi?.stop?.();
    canvas.removeEventListener('mousedown', onMouseDown, true);
    window.removeEventListener('mousemove', onMouseMove, true);
    window.removeEventListener('mouseup', onMouseUp, true);
    canvas.addEventListener('mousedown', original.down, true);
    window.addEventListener('mousemove', original.move, true);
    window.addEventListener('mouseup', original.up, true);
    renderer.topologyStyle = original.topologyStyle;
    profileField?.remove();
    document.getElementById(STYLE_ID)?.remove();
  }

  const api = Object.freeze({ builder, saveRun, setProfile, getProfile:activeProfile, getAutoTile:() => autoTileApi, stop });
  window.LuminousVttWallBuilderRuntime = Object.freeze({ api, stop });
  window.LuminousVttRuntime = Object.freeze({ ...window.LuminousVttRuntime, wallBuilder:api });
  try {
    autoTileApi = startWallAutoTile({ runtime:window.LuminousVttRuntime, mapData });
  } catch (error) {
    stop();
    throw error;
  }
  return api;
}
