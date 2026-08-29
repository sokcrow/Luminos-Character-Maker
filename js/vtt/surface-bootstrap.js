import './surface-core.js';
import './surface-renderer.js';

const TOOLBAR_ID = 'vtt-surface-toolbar';
const STYLE_ID = 'vtt-surface-style';
const clean = (value) => String(value ?? '').trim();

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${TOOLBAR_ID}{border-color:#476b55!important}
    #${TOOLBAR_ID} .vtt-surface-material{display:grid;gap:4px;padding-top:6px;border-top:1px solid #3c4147;color:#9eabb3;font:9px monospace}
    #${TOOLBAR_ID} .vtt-surface-material select{width:100%;min-width:0;box-sizing:border-box;background:#090c0e;color:#e6ecef;border:1px solid #59636c;padding:5px;font:10px monospace}
    #${TOOLBAR_ID} .vtt-surface-status{padding:5px;border:1px solid #38434a;background:#0b0e11;color:#9eabb3;font:9px monospace;line-height:1.35}
    #${TOOLBAR_ID} button.is-active{border-color:#82c696!important;color:#82c696!important}
  `;
  document.head.appendChild(style);
}

function ensureToolbar(core, mapData) {
  let toolbar = document.getElementById(TOOLBAR_ID);
  if (toolbar) return toolbar;
  ensureStyles();
  toolbar = document.createElement('div');
  toolbar.id = TOOLBAR_ID;
  toolbar.className = 'vtt-toolbar vtt-surface-toolbar';
  toolbar.setAttribute('aria-label', 'Surface painter');
  const materials = Object.values(mapData.surfaceMaterials || core.defaultMaterialCatalog());
  toolbar.innerHTML = `
    <span class="vtt-toolbar-title">SURFACES</span>
    <button type="button" class="brutalist-button" data-surface-tool="select">SELECT</button>
    <button type="button" class="brutalist-button" data-surface-tool="brush">BRUSH</button>
    <button type="button" class="brutalist-button" data-surface-tool="rect">RECTANGLE</button>
    <button type="button" class="brutalist-button" data-surface-tool="erase">ERASE</button>
    <label class="vtt-surface-material"><span>MATERIAL</span><select data-surface-material>${materials.map((material) => `<option value="${material.id}">${material.name.toUpperCase()} · ×${Number(material.movement?.costMultiplier || 1).toFixed(2)}</option>`).join('')}</select></label>
    <div class="vtt-surface-status" data-surface-status>READY</div>
  `;
  const host = document.getElementById('vtt-edit-sidebar') || document.getElementById('vtt-ui-container') || document.body;
  host.appendChild(toolbar);
  return toolbar;
}

export function start({ runtime = window.LuminousVttRuntime, mapData = runtime?.engine?.mapData } = {}) {
  if (!runtime?.engine || !mapData) return null;
  if (window.LuminousVttSurfaceRuntime?.api) return window.LuminousVttSurfaceRuntime.api;
  const core = window.LuminousVttSurfaceCore;
  const surfaceRenderer = window.LuminousVttSurfaceRenderer;
  if (!core || !surfaceRenderer) throw new Error('SURFACE_RUNTIME_REQUIRED');
  core.ensureMapState(mapData);

  const engine = runtime.engine;
  const canvas = engine.canvas;
  const renderer = engine.renderer;
  const isDm = Boolean(runtime.bridge?.isDm);
  let stopped = false;
  let tool = isDm ? 'brush' : 'select';
  let materialId = Object.keys(mapData.surfaceMaterials || {})[0] || 'concrete';
  let painting = false;
  let rectStart = null;
  let lastCellKey = null;
  let saveTimer = null;
  let saveInFlight = Promise.resolve();
  const toolbar = isDm ? ensureToolbar(core, mapData) : null;

  const currentRuntime = () => window.LuminousVttRuntime || runtime;
  const activeZ = () => Number(engine.activeZ) || 0;
  const renderZ = () => Number(currentRuntime()?.pov?.controller?.viewLayer?.(engine.activeZ) ?? engine.activeZ) || 0;
  const painterEnabled = () => isDm && mapData.dmEditMode?.active === true && tool !== 'select';

  const originalDrawGrid = renderer.drawGrid.bind(renderer);
  const surfaceDrawGrid = function surfaceDrawGrid(...args) {
    const result = originalDrawGrid(...args);
    surfaceRenderer.drawSurfaceLayer(renderer.ctx, mapData, renderZ());
    surfaceRenderer.drawGridOverlay(renderer.ctx, mapData, Boolean(args[0]));
    return result;
  };
  renderer.drawGrid = surfaceDrawGrid;

  function cellAtEvent(event) {
    const rect = canvas.getBoundingClientRect();
    const point = engine.camera.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
    const size = Math.max(1, Number(mapData.grid?.size) || 70);
    const cols = Math.max(1, Number(mapData.grid?.cols) || 1);
    const rows = Math.max(1, Number(mapData.grid?.rows) || 1);
    const col = Math.floor(point.x / size), row = Math.floor(point.y / size);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
    return { col, row };
  }

  function statusText() {
    const material = core.materialFor(mapData, materialId);
    const count = core.cellsOnLayer(mapData, activeZ()).length;
    return `${tool.toUpperCase()} · ${clean(material?.name || materialId).toUpperCase()} · Z${activeZ()} · ${count} CELLS`;
  }

  function syncUi() {
    if (!toolbar) return;
    toolbar.querySelectorAll('[data-surface-tool]').forEach((button) => button.classList.toggle('is-active', button.dataset.surfaceTool === tool));
    const select = toolbar.querySelector('[data-surface-material]');
    if (select && select.value !== materialId && [...select.options].some((option) => option.value === materialId)) select.value = materialId;
    const status = toolbar.querySelector('[data-surface-status]');
    if (status) status.textContent = statusText();
  }

  function emit(reason, cells = []) {
    canvas.dispatchEvent(new CustomEvent('vtt:surface-changed', {
      detail: { reason, zLayer: activeZ(), materialId, cells },
    }));
    syncUi();
  }

  function paintCell(cell) {
    if (!cell) return false;
    const key = core.cellKey(cell.col, cell.row);
    if (painting && key === lastCellKey) return false;
    lastCellKey = key;
    if (tool === 'erase') {
      const changed = core.eraseCell(mapData, activeZ(), cell.col, cell.row);
      if (changed) emit('erase', [cell]);
      return changed;
    }
    const changed = Boolean(core.setCell(mapData, activeZ(), cell.col, cell.row, materialId));
    if (changed) emit('paint', [cell]);
    return changed;
  }

  async function persistNow() {
    if (!isDm || stopped) return false;
    const authoring = window.LuminousVttMapAuthoring;
    const bridge = currentRuntime()?.mapAuthoring?.bridge;
    if (!authoring?.definitionFromMapData || !bridge?.saveDefinition) return false;
    const definition = authoring.definitionFromMapData(mapData);
    await bridge.saveDefinition(definition);
    return true;
  }

  function schedulePersist(delay = 180) {
    if (!isDm) return;
    if (saveTimer != null) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      saveInFlight = saveInFlight.then(() => persistNow()).catch((error) => {
        console.error('VTT surface persistence failed:', error);
        currentRuntime()?.controller?.notify?.('No se pudo guardar la superficie del mapa.', 'error');
      });
    }, Math.max(0, Number(delay) || 0));
  }

  function finishStroke(event = null) {
    if (!painting && !rectStart) return;
    if (tool === 'rect' && rectStart && event) {
      const end = cellAtEvent(event);
      if (end) {
        const changed = core.paintRect(mapData, activeZ(), rectStart, end, materialId);
        if (changed) emit('paint-rect', [rectStart, end]);
      }
    }
    painting = false;
    rectStart = null;
    lastCellKey = null;
    schedulePersist();
  }

  function setTool(nextTool) {
    const next = ['select','brush','rect','erase'].includes(nextTool) ? nextTool : 'select';
    tool = next;
    painting = false;
    rectStart = null;
    lastCellKey = null;
    if (next !== 'select') {
      currentRuntime()?.controller?.setTool?.('select');
      currentRuntime()?.verticalController?.setTool?.('select', false);
    }
    syncUi();
    return tool;
  }

  function setMaterial(nextId) {
    if (!core.materialFor(mapData, nextId)) throw new Error('SURFACE_MATERIAL_NOT_FOUND');
    materialId = nextId;
    syncUi();
    return materialId;
  }

  const onPointerDown = (event) => {
    if (!painterEnabled() || event.button !== 0) return;
    const cell = cellAtEvent(event);
    if (!cell) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    painting = true;
    lastCellKey = null;
    if (tool === 'rect') rectStart = cell;
    else paintCell(cell);
  };

  const onPointerMove = (event) => {
    if (!painting || !painterEnabled() || tool === 'rect') return;
    const cell = cellAtEvent(event);
    if (!cell) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    paintCell(cell);
  };

  const onPointerUp = (event) => {
    if ((!painting && !rectStart) || event.button !== 0) return;
    if (painterEnabled()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    finishStroke(event);
  };

  const onExternalTool = (event) => {
    const target = event.target?.closest?.('[data-vtt-tool],[data-vtt-vertical-tool],[data-light-tool]');
    if (target) setTool('select');
  };

  canvas.addEventListener('mousedown', onPointerDown, true);
  window.addEventListener('mousemove', onPointerMove, true);
  window.addEventListener('mouseup', onPointerUp, true);
  document.addEventListener('click', onExternalTool, true);

  if (toolbar) {
    toolbar.addEventListener('click', (event) => {
      const nextTool = event.target.closest?.('[data-surface-tool]')?.dataset?.surfaceTool;
      if (nextTool) setTool(nextTool);
    });
    toolbar.querySelector('[data-surface-material]')?.addEventListener('change', (event) => setMaterial(event.target.value));
  }

  const uiTimer = window.setInterval(syncUi, 300);
  syncUi();

  function stop() {
    if (stopped) return;
    stopped = true;
    if (saveTimer != null) window.clearTimeout(saveTimer);
    window.clearInterval(uiTimer);
    canvas.removeEventListener('mousedown', onPointerDown, true);
    window.removeEventListener('mousemove', onPointerMove, true);
    window.removeEventListener('mouseup', onPointerUp, true);
    document.removeEventListener('click', onExternalTool, true);
    if (renderer.drawGrid === surfaceDrawGrid) renderer.drawGrid = originalDrawGrid;
    toolbar?.remove();
    document.getElementById(STYLE_ID)?.remove();
  }

  const api = Object.freeze({ core, setTool, setMaterial, getTool: () => tool, getMaterialId: () => materialId, persistNow, syncUi, stop });
  window.LuminousVttSurfaceRuntime = Object.freeze({ api, stop });
  const current = currentRuntime();
  window.LuminousVttRuntime = Object.freeze({ ...current, surfaces: api });
  return api;
}
