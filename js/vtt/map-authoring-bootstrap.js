export function start({ runtime = window.LuminousVttRuntime, mapData = runtime?.engine?.mapData } = {}) {
  if (!runtime?.engine || !mapData) return null;
  const authoring = window.LuminousVttMapAuthoring;
  const stateApi = window.LuminousVttMapAuthoringState;
  if (!authoring || !stateApi) return null;

  const engine = runtime.engine;
  const renderer = engine.renderer;
  const isDm = Boolean(runtime.bridge?.isDm);
  const imageCache = new Map();
  mapData.mapAuthoring ||= { ghostPrevious: false };

  function floorFor(zLayer) {
    return authoring.floor(authoring.definitionFromMapData(mapData), zLayer);
  }

  function imageFor(url) {
    if (!url || typeof Image === 'undefined') return null;
    let entry = imageCache.get(url);
    if (!entry) {
      const image = new Image();
      image.decoding = 'async';
      entry = { image, ready: false, failed: false };
      image.onload = () => { entry.ready = true; };
      image.onerror = () => { entry.failed = true; };
      image.src = url;
      imageCache.set(url, entry);
    }
    return entry.ready ? entry.image : null;
  }

  function drawImageForFloor(ctx, zLayer, opacityOverride = null) {
    const floor = floorFor(zLayer);
    const bg = floor?.background;
    const image = imageFor(bg?.url);
    if (!image) return;
    const width = (mapData.grid?.cols || 1) * (mapData.grid?.size || 70);
    const height = (mapData.grid?.rows || 1) * (mapData.grid?.size || 70);
    const fit = bg.fit || 'stretch';
    let dx = 0, dy = 0, dw = width, dh = height;
    if (fit !== 'stretch' && image.naturalWidth && image.naturalHeight) {
      const scale = fit === 'cover'
        ? Math.max(width / image.naturalWidth, height / image.naturalHeight)
        : Math.min(width / image.naturalWidth, height / image.naturalHeight);
      dw = image.naturalWidth * scale;
      dh = image.naturalHeight * scale;
      dx = (width - dw) / 2;
      dy = (height - dh) / 2;
    }
    ctx.save();
    ctx.globalAlpha = opacityOverride == null ? Math.max(0, Math.min(1, Number(bg.opacity ?? 1))) : opacityOverride;
    ctx.drawImage(image, dx, dy, dw, dh);
    ctx.restore();
  }

  function renderZ() {
    return Number(runtime.pov?.controller?.viewLayer?.(engine.activeZ) ?? engine.activeZ) || 0;
  }

  const originalDrawGrid = renderer.drawGrid.bind(renderer);
  renderer.drawGrid = function mapFloorDrawGrid(...args) {
    const z = renderZ();
    if (isDm && mapData.dmEditMode?.active && mapData.mapAuthoring?.ghostPrevious) {
      const lower = authoring.levelEntries(mapData.zLevels).filter((level) => level.zLayer < z).pop();
      if (lower) drawImageForFloor(renderer.ctx, lower.zLayer, 0.18);
    }
    drawImageForFloor(renderer.ctx, z);
    return originalDrawGrid(...args);
  };

  if (!isDm) {
    return Object.freeze({ stop() { renderer.drawGrid = originalDrawGrid; }, drawImageForFloor });
  }

  const bridge = stateApi.createBridge({
    mapData,
    onMapsChanged: () => renderUi(),
    onActiveChanged: () => renderUi(),
  });
  let selectedMapId = String(mapData.id || mapData.mapId || 'default');
  let noticeTimer = null;

  function notify(message, mode = 'info') {
    runtime.controller?.notify?.(message, mode);
    const local = document.getElementById('vtt-map-authoring-notice');
    if (!local) return;
    local.textContent = message;
    local.dataset.mode = mode;
    local.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { local.hidden = true; }, 3000);
  }

  function injectUi() {
    if (document.getElementById('vtt-map-library-toggle')) return;
    const style = document.createElement('style');
    style.id = 'vtt-map-authoring-style';
    style.textContent = `
      .vtt-map-library-toggle{position:fixed;left:18px;top:18px;z-index:33000}.vtt-map-library{position:fixed;left:18px;top:62px;z-index:32990;width:340px;max-height:calc(100vh - 82px);overflow:auto;background:#101010;color:#fff;border:2px solid #fff;padding:12px;font:12px monospace;box-shadow:6px 6px 0 #000}.vtt-map-library[hidden]{display:none}.vtt-map-library header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.vtt-map-library label{display:grid;gap:4px;margin:7px 0}.vtt-map-library input,.vtt-map-library select{background:#070707;color:#fff;border:1px solid #777;padding:6px}.vtt-map-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.vtt-map-actions{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.vtt-map-floor-card{border-top:1px solid #666;margin-top:10px;padding-top:8px}.vtt-map-library small{color:#aaa}.vtt-map-notice{margin-top:8px;border:1px solid #777;padding:6px}.vtt-map-notice[data-mode="error"]{border-color:#ff6b6b}.vtt-map-notice[data-mode="success"]{border-color:#73f29a}
    `;
    document.head.appendChild(style);
    const toggle = document.createElement('button');
    toggle.id = 'vtt-map-library-toggle';
    toggle.className = 'brutalist-button vtt-map-library-toggle';
    toggle.textContent = 'MAPS';
    document.body.appendChild(toggle);
    const panel = document.createElement('aside');
    panel.id = 'vtt-map-library-panel';
    panel.className = 'vtt-map-library';
    panel.hidden = true;
    panel.innerHTML = '<header><strong>MAP LIBRARY / FLOORS</strong><button type="button" class="brutalist-button" data-map-close>×</button></header><div id="vtt-map-authoring-body"></div><div id="vtt-map-authoring-notice" class="vtt-map-notice" hidden></div>';
    document.body.appendChild(panel);
    toggle.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) renderUi(); });
    panel.querySelector('[data-map-close]')?.addEventListener('click', () => { panel.hidden = true; });
  }

  function selectedDefinition() {
    return bridge.get(selectedMapId) || (selectedMapId === String(mapData.id) ? authoring.definitionFromMapData(mapData) : null);
  }

  async function ensureCurrentSeed() {
    if (bridge.get(mapData.id)) return;
    try { await bridge.saveDefinition(authoring.definitionFromMapData(mapData)); }
    catch (error) { console.warn('VTT map seed skipped:', error); }
  }

  function renderUi() {
    const body = document.getElementById('vtt-map-authoring-body');
    if (!body) return;
    const maps = bridge.list();
    const definition = selectedDefinition() || maps[0] || authoring.definitionFromMapData(mapData);
    if (!selectedMapId || !maps.some((entry) => entry.id === selectedMapId)) selectedMapId = definition.id;
    const selected = bridge.get(selectedMapId) || definition;
    const activeId = bridge.activeMapId() || String(mapData.id);
    const floors = authoring.levelEntries(selected.zLevels);
    const preferredFloor = floors.some((floor) => floor.zLayer === Number(engine.activeZ)) ? Number(engine.activeZ) : floors[0].zLayer;
    const floor = selected.zLevels[String(preferredFloor)] || floors[0];
    body.innerHTML = `
      <label>MAP<select data-map-select>${maps.map((entry) => `<option value="${entry.id}" ${entry.id === selected.id ? 'selected' : ''}>${entry.name}${entry.id === activeId ? ' · ACTIVE' : ''}</option>`).join('')}</select></label>
      <div class="vtt-map-actions"><button type="button" class="brutalist-button" data-map-new>NEW MAP</button><button type="button" class="brutalist-button" data-map-activate ${selected.id === activeId ? 'disabled' : ''}>ACTIVATE</button></div>
      <label>NAME<input data-map-name value="${selected.name}"></label>
      <label>TAGS<input data-map-tags value="${selected.environmentTags.join(', ')}"></label>
      <div class="vtt-map-grid"><label>COLS<input type="number" min="1" data-map-cols value="${selected.grid.cols}"></label><label>ROWS<input type="number" min="1" data-map-rows value="${selected.grid.rows}"></label><label>GRID PX<input type="number" min="8" data-map-size value="${selected.grid.size}"></label><label>FT / CELL<input type="number" min="0.1" step="0.1" data-map-ft value="${selected.grid.distancePerCell}"></label></div>
      <label>Z STEP DEFAULT<input type="number" min="1" data-map-zstep value="${selected.defaultZStepFt}"></label>
      <div class="vtt-map-actions"><button type="button" class="brutalist-button" data-map-save>SAVE MAP</button><label style="display:flex;align-items:center;gap:6px"><input type="checkbox" data-map-ghost ${mapData.mapAuthoring?.ghostPrevious ? 'checked' : ''}> GHOST LOWER FLOOR</label></div>
      <section class="vtt-map-floor-card"><strong>FLOORS</strong><label>LEVEL<select data-floor-select>${floors.map((entry) => `<option value="${entry.zLayer}" ${entry.zLayer === preferredFloor ? 'selected' : ''}>${entry.label} · Z${entry.zLayer} · ${entry.elevationFt}ft</option>`).join('')}</select></label>
      <div class="vtt-map-actions"><button type="button" class="brutalist-button" data-floor-above>+ ABOVE</button><button type="button" class="brutalist-button" data-floor-below>+ BELOW</button><button type="button" class="vtt-danger-button" data-floor-delete>DELETE</button></div>
      <label>LABEL<input data-floor-label value="${floor.label}"></label><label>ELEVATION FT<input type="number" step="1" data-floor-elevation value="${floor.elevationFt}"></label>
      <label>BACKGROUND URL<input data-floor-url value="${floor.background?.url || ''}" placeholder="https://..."></label><div class="vtt-map-grid"><label>FIT<select data-floor-fit><option value="stretch" ${floor.background?.fit === 'stretch' ? 'selected' : ''}>STRETCH</option><option value="contain" ${floor.background?.fit === 'contain' ? 'selected' : ''}>CONTAIN</option><option value="cover" ${floor.background?.fit === 'cover' ? 'selected' : ''}>COVER</option></select></label><label>OPACITY<input type="number" min="0" max="1" step="0.05" data-floor-opacity value="${floor.background?.opacity ?? 1}"></label></div>
      <label>UPLOAD IMAGE<input type="file" accept="image/*" data-floor-upload></label><button type="button" class="brutalist-button" data-floor-save>SAVE FLOOR</button><small>Roof is only a label; floors may extend upward or downward with positive or negative Z.</small></section>`;

    body.querySelector('[data-map-select]')?.addEventListener('change', (event) => { selectedMapId = event.target.value; renderUi(); });
    body.querySelector('[data-map-new]')?.addEventListener('click', async () => {
      const name = window.prompt('Map name', 'New Map');
      if (!name) return;
      const id = authoring.firebaseKey(`${name}_${Date.now().toString(36)}`);
      const created = authoring.createDefinition({ id, name, grid: selected.grid, environmentTags: selected.environmentTags, defaultZStepFt: selected.defaultZStepFt });
      await bridge.saveDefinition(created); selectedMapId = created.id; renderUi(); notify('Map created.', 'success');
    });
    body.querySelector('[data-map-activate]')?.addEventListener('click', async () => {
      try { await bridge.activate(selected.id); notify(`Activating ${selected.name}…`, 'success'); }
      catch (error) { notify(String(error.message || error), 'error'); }
    });
    body.querySelector('[data-map-save]')?.addEventListener('click', async () => {
      try {
        const next = authoring.normalizeDefinition({
          ...selected,
          name: body.querySelector('[data-map-name]').value,
          environmentTags: body.querySelector('[data-map-tags]').value.split(',').map((value) => value.trim()).filter(Boolean),
          grid: { ...selected.grid, cols: Number(body.querySelector('[data-map-cols]').value), rows: Number(body.querySelector('[data-map-rows]').value), size: Number(body.querySelector('[data-map-size]').value), distancePerCell: Number(body.querySelector('[data-map-ft]').value) },
          defaultZStepFt: Number(body.querySelector('[data-map-zstep]').value),
        });
        const saved = await bridge.saveDefinition(next);
        if (saved.id === String(mapData.id)) authoring.applyDefinition(mapData, saved, { keepSceneState: true });
        notify('Map saved.', 'success');
      } catch (error) { notify(String(error.message || error), 'error'); }
    });
    body.querySelector('[data-map-ghost]')?.addEventListener('change', (event) => { mapData.mapAuthoring.ghostPrevious = Boolean(event.target.checked); });
    body.querySelector('[data-floor-select]')?.addEventListener('change', (event) => {
      const z = Number(event.target.value);
      if (selected.id === String(mapData.id)) runtime.setLayer?.(z);
      renderUi();
    });
    const mutateFloor = async (direction) => {
      const z = Number(body.querySelector('[data-floor-select]').value);
      const next = authoring.addLevel(selected, z, direction);
      const createdZ = authoring.nextLayer(selected.zLevels, z, direction);
      const saved = await bridge.saveDefinition(next);
      if (saved.id === String(mapData.id)) { authoring.applyDefinition(mapData, saved, { keepSceneState: true }); runtime.setLayer?.(createdZ); }
      renderUi(); notify(direction > 0 ? 'Floor above created.' : 'Floor below created.', 'success');
    };
    body.querySelector('[data-floor-above]')?.addEventListener('click', () => mutateFloor(1).catch((error) => notify(String(error.message || error), 'error')));
    body.querySelector('[data-floor-below]')?.addEventListener('click', () => mutateFloor(-1).catch((error) => notify(String(error.message || error), 'error')));
    body.querySelector('[data-floor-delete]')?.addEventListener('click', async () => {
      const z = Number(body.querySelector('[data-floor-select]').value);
      if (selected.id === String(mapData.id)) {
        const gate = authoring.canDeleteLevel(mapData, z);
        if (!gate.valid) return notify(gate.reason === 'LAST_FLOOR' ? 'Cannot delete the last floor.' : 'Floor still contains geometry, portals, tokens, roofs or lights.', 'error');
      }
      try {
        const next = authoring.removeLevel(selected, z);
        const saved = await bridge.saveDefinition(next);
        if (saved.id === String(mapData.id)) { authoring.applyDefinition(mapData, saved, { keepSceneState: true }); runtime.setLayer?.(authoring.levelEntries(saved.zLevels)[0].zLayer); }
        renderUi(); notify('Floor deleted.', 'success');
      } catch (error) { notify(String(error.message || error), 'error'); }
    });
    body.querySelector('[data-floor-save]')?.addEventListener('click', async () => {
      const z = Number(body.querySelector('[data-floor-select]').value);
      try {
        const next = authoring.updateLevel(selected, z, {
          label: body.querySelector('[data-floor-label]').value,
          elevationFt: Number(body.querySelector('[data-floor-elevation]').value),
          background: { url: body.querySelector('[data-floor-url]').value, fit: body.querySelector('[data-floor-fit]').value, opacity: Number(body.querySelector('[data-floor-opacity]').value) },
        });
        const saved = await bridge.saveDefinition(next);
        if (saved.id === String(mapData.id)) authoring.applyDefinition(mapData, saved, { keepSceneState: true });
        renderUi(); notify('Floor saved.', 'success');
      } catch (error) { notify(String(error.message || error), 'error'); }
    });
    body.querySelector('[data-floor-upload]')?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0]; if (!file) return;
      const z = Number(body.querySelector('[data-floor-select]').value);
      try {
        notify('Uploading floor image…');
        const background = await bridge.uploadFloorImage(selected.id, z, file);
        const next = authoring.updateLevel(selected, z, { background });
        const saved = await bridge.saveDefinition(next);
        if (saved.id === String(mapData.id)) authoring.applyDefinition(mapData, saved, { keepSceneState: true });
        renderUi(); notify('Floor image uploaded.', 'success');
      } catch (error) { notify(`${String(error.message || error)} · URL remains available as fallback.`, 'error'); }
    });
  }

  injectUi();
  bridge.start();
  ensureCurrentSeed().then(renderUi);

  const api = Object.freeze({
    bridge,
    drawImageForFloor,
    stop() {
      clearTimeout(noticeTimer);
      bridge.stop();
      renderer.drawGrid = originalDrawGrid;
      document.getElementById('vtt-map-library-toggle')?.remove();
      document.getElementById('vtt-map-library-panel')?.remove();
      document.getElementById('vtt-map-authoring-style')?.remove();
    },
  });
  window.LuminousVttRuntime = Object.freeze({ ...window.LuminousVttRuntime, mapAuthoring: api });
  return api;
}