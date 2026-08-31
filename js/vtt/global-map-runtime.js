import '../global-map-core.js';

const Core = globalThis.LuminousGlobalMapCore;
const ROOT = 'campaña/estado_mundo/mapa_global';
const PLAYERS_ROOT = 'campaña/jugadores';
const LEGACY_DM_UID = 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';

const clean = (value) => String(value ?? '').trim();
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const uid = (prefix = 'global') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

function hostWindow() {
  try {
    if (window.parent && window.parent !== window && window.parent.document) return window.parent;
  } catch (_) {}
  return window;
}

function hostFirebase() {
  const host = hostWindow();
  return host?.firebase || window.firebase || null;
}

function hostDocument() {
  return hostWindow()?.document || document;
}

function currentUid() {
  try { return hostFirebase()?.auth?.().currentUser?.uid || null; }
  catch (_) { return null; }
}

function runtimeIsDm() {
  if (globalThis.LuminousVttRuntime?.bridge?.isDm === true) return true;
  const doc = hostDocument();
  return currentUid() === LEGACY_DM_UID || Boolean(doc?.body?.classList?.contains('on-game-dashboard') || doc?.body?.classList?.contains('dm-dashboard'));
}

function escapeHtml(value) {
  return clean(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function centroid(points = []) {
  if (!points.length) return { xKm: 0, yKm: 0 };
  const sum = points.reduce((acc, point) => ({ xKm: acc.xKm + point.xKm, yKm: acc.yKm + point.yKm }), { xKm: 0, yKm: 0 });
  return { xKm: sum.xKm / points.length, yKm: sum.yKm / points.length };
}

function injectDom(isDm) {
  if (document.getElementById('vtt-global-map-root')) return null;

  const toggle = document.createElement('button');
  toggle.id = 'vtt-global-map-toggle';
  toggle.type = 'button';
  toggle.className = 'brutalist-button vtt-global-map-toggle';
  toggle.textContent = 'WORLD MAP';
  toggle.setAttribute('aria-controls', 'vtt-global-map-root');
  toggle.setAttribute('aria-expanded', 'false');
  document.body.appendChild(toggle);

  const root = document.createElement('section');
  root.id = 'vtt-global-map-root';
  root.className = 'vtt-global-map-root';
  root.hidden = true;
  root.innerHTML = `
    <canvas id="vtt-global-map-canvas" aria-label="Mapa global"></canvas>
    <header class="vtt-global-map-topbar">
      <button type="button" id="vtt-global-map-close" class="brutalist-button">LOCAL</button>
      <strong class="vtt-global-map-title">LUMINOUS // WORLD</strong>
      <span id="vtt-global-map-scale" class="vtt-global-map-scale">WORLD</span>
      <button type="button" id="vtt-global-map-zoom-out" class="brutalist-button" aria-label="Alejar">−</button>
      <button type="button" id="vtt-global-map-zoom-in" class="brutalist-button" aria-label="Acercar">+</button>
      <button type="button" id="vtt-global-map-reset" class="brutalist-button">FIT</button>
      <input id="vtt-global-map-search" class="vtt-global-map-search" type="search" maxlength="120" placeholder="Buscar región / punto…" aria-label="Buscar en el mapa global">
      <span id="vtt-global-map-status" class="vtt-global-map-status">READ ONLY</span>
    </header>
    <aside class="vtt-global-map-layers" aria-label="Capas del mapa global">
      <strong>LAYERS</strong>
      <label><input type="checkbox" data-global-layer="district" checked> DISTRITOS</label>
      <label><input type="checkbox" data-global-layer="jurisdiction" checked> JURISDICCIÓN</label>
      <label><input type="checkbox" data-global-layer="terrain" checked> TERRENO</label>
      <label><input type="checkbox" data-global-layer="water" checked> AGUA</label>
      <label><input type="checkbox" data-global-layer="routes" checked> RUTAS</label>
      <label><input type="checkbox" data-global-layer="markers" checked> LUGARES</label>
      <label><input type="checkbox" data-global-layer="players" checked> GRUPO</label>
    </aside>
    <aside id="vtt-global-map-inspector" class="vtt-global-map-inspector">
      <strong>INSPECT</strong>
      <div id="vtt-global-map-inspector-body">Selecciona una región o marcador.</div>
    </aside>
    ${isDm ? `
    <aside id="vtt-global-map-editor" class="vtt-global-map-editor">
      <strong>WORLD AUTHORING</strong>
      <div class="vtt-global-map-toolrow">
        <button type="button" class="brutalist-button active" data-global-tool="select">SELECT</button>
        <button type="button" class="brutalist-button" data-global-tool="region">REGION</button>
        <button type="button" class="brutalist-button" data-global-tool="marker">MARKER</button>
        <button type="button" class="brutalist-button" data-global-tool="route">ROUTE</button>
      </div>
      <label>NOMBRE<input id="vtt-global-name" maxlength="120" value="Nueva región"></label>
      <label>CAPA<select id="vtt-global-region-layer">
        <option value="district">DISTRICT</option><option value="jurisdiction">JURISDICTION</option><option value="terrain">TERRAIN</option><option value="water">WATER</option><option value="special">SPECIAL</option>
      </select></label>
      <label>DISTRITO ID<input id="vtt-global-district" maxlength="120" placeholder="district_k"></label>
      <label>JURISDICCIÓN<select id="vtt-global-jurisdiction"><option value="outskirts">OUTSKIRTS</option><option value="backstreets">BACKSTREETS</option><option value="nest">NEST</option></select></label>
      <label>TERRENO<input id="vtt-global-terrain" maxlength="80" value="unknown" placeholder="forest / urban / lake"></label>
      <label>FUENTE<select id="vtt-global-source"><option value="dm">DM OVERRIDE</option><option value="campaign">CAMPAIGN</option><option value="canon">CANON LOCK</option><option value="procedural">PROCEDURAL</option></select></label>
      <label>MARKER<select id="vtt-global-marker-type"><option value="nest">NEST</option><option value="city">CITY</option><option value="town">TOWN</option><option value="villa">VILLA</option><option value="industrial">INDUSTRIAL</option><option value="checkpoint">CHECKPOINT</option><option value="poi">POI</option></select></label>
      <label>RUTA<select id="vtt-global-route-type"><option value="road">ROAD</option><option value="dirt_road">DIRT ROAD</option><option value="trail">TRAIL</option><option value="rail">RAIL</option><option value="waterway">WATERWAY</option></select></label>
      <label class="vtt-global-map-check"><input id="vtt-global-visible" type="checkbox" checked> VISIBLE A JUGADORES</label>
      <div class="vtt-global-map-toolrow">
        <button type="button" id="vtt-global-finish" class="brutalist-button" disabled>CERRAR TRAZO</button>
        <button type="button" id="vtt-global-cancel" class="brutalist-button">CANCEL</button>
      </div>
      <div class="vtt-global-map-toolrow">
        <button type="button" id="vtt-global-apply" class="brutalist-button">APLICAR</button>
        <button type="button" id="vtt-global-delete" class="brutalist-button">DELETE</button>
      </div>
      <button type="button" id="vtt-global-save" class="brutalist-button vtt-global-save">SAVE WORLD</button>
      <small id="vtt-global-help">SELECT inspecciona. REGION/ROUTE agregan puntos con click; CERRAR TRAZO finaliza. Arrastra con botón derecho/medio para mover el mapa.</small>
    </aside>` : ''}
  `;
  document.body.appendChild(root);
  return { toggle, root };
}

function start() {
  if (!Core || globalThis.LuminousGlobalMapRuntime) return globalThis.LuminousGlobalMapRuntime || null;
  const isDm = runtimeIsDm();
  const dom = injectDom(isDm);
  if (!dom) return null;

  const canvas = document.getElementById('vtt-global-map-canvas');
  const ctx = canvas.getContext('2d');
  const scaleEl = document.getElementById('vtt-global-map-scale');
  const statusEl = document.getElementById('vtt-global-map-status');
  const inspectorBody = document.getElementById('vtt-global-map-inspector-body');
  const localCanvas = document.getElementById('vtt-canvas');
  const layerState = new Set(['district', 'jurisdiction', 'terrain', 'water', 'routes', 'markers', 'players']);

  let doc = Core.blankDocument();
  let players = {};
  let open = false;
  let loaded = false;
  let dirty = false;
  let tool = 'select';
  let draftPoints = [];
  let selected = null;
  let mapRef = null;
  let playersRef = null;
  let mapListener = null;
  let playersListener = null;
  let engineWasRunning = false;
  let pan = null;
  const camera = { xKm: 0, yKm: 0, zoom: 0.1 };

  function notify(message, mode = 'info') {
    statusEl.textContent = clean(message).slice(0, 120) || (isDm ? 'DM' : 'READ ONLY');
    statusEl.dataset.mode = mode;
  }

  function resize() {
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const width = Math.max(1, window.innerWidth), height = Math.max(1, window.innerHeight);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    render();
  }

  function viewport() {
    return { width: Math.max(1, window.innerWidth), height: Math.max(1, window.innerHeight) };
  }

  function fit() {
    const view = viewport(), bounds = doc.bounds;
    camera.zoom = Math.max(0.02, Math.min(2.5, Math.min((view.width - 80) / bounds.widthKm, (view.height - 80) / bounds.heightKm)));
    camera.xKm = bounds.minXKm - Math.max(0, (view.width / camera.zoom - bounds.widthKm) / 2);
    camera.yKm = bounds.minYKm - Math.max(0, (view.height / camera.zoom - bounds.heightKm) / 2);
    render();
  }

  function screenToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return { xKm: camera.xKm + (clientX - rect.left) / camera.zoom, yKm: camera.yKm + (clientY - rect.top) / camera.zoom };
  }

  function worldToScreen(point) {
    return { x: (point.xKm - camera.xKm) * camera.zoom, y: (point.yKm - camera.yKm) * camera.zoom };
  }

  function colorForRegion(region) {
    if (region.layer === 'water') return { fill: 'rgba(32,74,100,.74)', stroke: '#70a7c3' };
    if (region.layer === 'district') return { fill: 'rgba(0,0,0,.04)', stroke: '#d2d7db' };
    if (region.layer === 'jurisdiction') {
      if (region.jurisdiction === 'nest') return { fill: 'rgba(164,61,61,.36)', stroke: '#d36a6a' };
      if (region.jurisdiction === 'backstreets') return { fill: 'rgba(172,132,59,.28)', stroke: '#c9a45e' };
      return { fill: 'rgba(81,105,75,.26)', stroke: '#849c7c' };
    }
    if (region.layer === 'terrain') return { fill: 'rgba(78,91,75,.38)', stroke: '#77856f' };
    return { fill: 'rgba(101,82,115,.28)', stroke: '#9480a3' };
  }

  function path(points, close = false) {
    if (!points.length) return false;
    const first = worldToScreen(points[0]);
    ctx.beginPath(); ctx.moveTo(first.x, first.y);
    for (let index = 1; index < points.length; index += 1) {
      const next = worldToScreen(points[index]); ctx.lineTo(next.x, next.y);
    }
    if (close) ctx.closePath();
    return true;
  }

  function drawRegion(region) {
    if (!layerState.has(region.layer) || !path(region.polygon, true)) return;
    const style = colorForRegion(region);
    ctx.fillStyle = style.fill; ctx.strokeStyle = selected?.kind === 'region' && selected.id === region.id ? '#ffffff' : style.stroke;
    ctx.lineWidth = selected?.kind === 'region' && selected.id === region.id ? 3 : region.layer === 'district' ? 2 : 1;
    ctx.fill(); ctx.stroke();
    if (region.layer === 'district' && camera.zoom >= 0.12) {
      const center = worldToScreen(centroid(region.polygon));
      ctx.fillStyle = '#e8edf0'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
      ctx.fillText(region.name, center.x, center.y);
    }
  }

  function drawRoute(route) {
    if (!layerState.has('routes') || !path(route.points, false)) return;
    ctx.strokeStyle = route.type === 'rail' ? '#d8d8d8' : route.type === 'waterway' ? '#77a8c4' : '#b28d5d';
    ctx.lineWidth = route.type === 'rail' ? 2 : 3;
    if (route.type === 'dirt_road' || route.type === 'trail') ctx.setLineDash([8, 7]);
    else ctx.setLineDash([]);
    ctx.stroke(); ctx.setLineDash([]);
  }

  function drawMarker(marker) {
    if (!layerState.has('markers')) return;
    const p = worldToScreen(marker);
    ctx.beginPath(); ctx.arc(p.x, p.y, marker.type === 'nest' ? 7 : 5, 0, Math.PI * 2);
    ctx.fillStyle = marker.type === 'nest' ? '#e25d5d' : '#e0d6b7'; ctx.fill();
    ctx.strokeStyle = selected?.kind === 'marker' && selected.id === marker.id ? '#fff' : '#111'; ctx.lineWidth = 2; ctx.stroke();
    if (camera.zoom >= 0.18) {
      ctx.fillStyle = '#eef1f3'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
      ctx.fillText(marker.name, p.x + 9, p.y + 4);
    }
  }

  function playerName(player, fallback) {
    return clean(player?.nombre || player?.name || player?.characterName || player?.character_name, fallback);
  }

  function drawPlayers() {
    if (!layerState.has('players')) return;
    for (const [playerId, player] of Object.entries(players || {})) {
      const position = Core.playerGlobalPosition(doc, player?.worldPosition || {}, isDm);
      if (!position) continue;
      const p = worldToScreen(position);
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#f0f2f4'; ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#f0f2f4'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
      ctx.fillText(playerName(player, playerId), p.x + 9, p.y + 4);
    }
  }

  function drawDraft() {
    if (!draftPoints.length) return;
    path(draftPoints, false);
    ctx.strokeStyle = '#ff5d5d'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([]);
    for (const point of draftPoints) {
      const p = worldToScreen(point); ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fillStyle = '#ff5d5d'; ctx.fill();
    }
  }

  function levelLabel() {
    if (camera.zoom < 0.14) return 'WORLD';
    if (camera.zoom < 0.55) return 'DISTRICT';
    return 'REGIONAL';
  }

  function render() {
    if (!open || !ctx) return;
    const view = viewport();
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.fillStyle = '#080a0c'; ctx.fillRect(0, 0, view.width, view.height);
    const a = worldToScreen({ xKm: doc.bounds.minXKm, yKm: doc.bounds.minYKm });
    const b = worldToScreen({ xKm: doc.bounds.minXKm + doc.bounds.widthKm, yKm: doc.bounds.minYKm + doc.bounds.heightKm });
    ctx.fillStyle = '#11161a'; ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.strokeStyle = '#37414a'; ctx.lineWidth = 1; ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);

    const visible = Core.cull(doc, camera, view, isDm);
    const orderedRegions = visible.regions.slice().sort((x, y) => {
      const rank = { water: 0, terrain: 1, jurisdiction: 2, special: 3, district: 4 };
      return (rank[x.layer] ?? 2) - (rank[y.layer] ?? 2);
    });
    orderedRegions.forEach(drawRegion);
    visible.routes.forEach(drawRoute);
    visible.markers.forEach(drawMarker);
    drawPlayers();
    drawDraft();
    scaleEl.textContent = `${levelLabel()} · ${camera.zoom.toFixed(2)} px/km`;
  }

  function setDirty(value = true) {
    dirty = Boolean(value);
    if (isDm) notify(dirty ? 'UNSAVED' : 'SAVED', dirty ? 'dirty' : 'ok');
  }

  function setTool(nextTool) {
    tool = ['select', 'region', 'marker', 'route'].includes(nextTool) ? nextTool : 'select';
    draftPoints = [];
    document.querySelectorAll('[data-global-tool]').forEach((button) => button.classList.toggle('active', button.dataset.globalTool === tool));
    const finish = document.getElementById('vtt-global-finish');
    if (finish) finish.disabled = tool !== 'region' && tool !== 'route';
    render();
  }

  function regionForm() {
    return {
      name: clean(document.getElementById('vtt-global-name')?.value, 'Nueva región'),
      layer: document.getElementById('vtt-global-region-layer')?.value || 'terrain',
      districtId: clean(document.getElementById('vtt-global-district')?.value),
      jurisdiction: document.getElementById('vtt-global-jurisdiction')?.value || 'outskirts',
      terrain: clean(document.getElementById('vtt-global-terrain')?.value, 'unknown'),
      source: document.getElementById('vtt-global-source')?.value || 'dm',
      visibleToPlayers: document.getElementById('vtt-global-visible')?.checked !== false,
    };
  }

  function finishDraft() {
    if (!isDm) return;
    const form = regionForm();
    try {
      if (tool === 'region') {
        if (draftPoints.length < 3) return notify('REGION NEEDS 3 POINTS', 'error');
        const id = uid('region');
        const center = centroid(draftPoints);
        doc = Core.upsertRegion(doc, {
          id, ...form, polygon: draftPoints,
          regionalOrigin: form.layer === 'district' ? { ...center, q: 0, r: 0, hexDistanceKm: Core.CONFIG.regionalHexDistanceKm } : null,
        });
        selected = { kind: 'region', id };
      } else if (tool === 'route') {
        if (draftPoints.length < 2) return notify('ROUTE NEEDS 2 POINTS', 'error');
        const id = uid('route');
        doc = Core.upsertRoute(doc, { id, name: form.name, districtId: form.districtId, type: document.getElementById('vtt-global-route-type')?.value || 'road', visibleToPlayers: form.visibleToPlayers, points: draftPoints });
        selected = { kind: 'route', id };
      } else return;
      draftPoints = [];
      setDirty(true); updateInspector(); render();
    } catch (error) { notify(error.message || 'INVALID DRAWING', 'error'); }
  }

  function findMarkerAt(point) {
    let best = null, bestDistance = Infinity;
    const thresholdKm = Math.max(4, 12 / camera.zoom);
    for (const marker of Core.visibleDocument(doc, isDm).markers) {
      const distance = Math.hypot(marker.xKm - point.xKm, marker.yKm - point.yKm);
      if (distance <= thresholdKm && distance < bestDistance) { best = marker; bestDistance = distance; }
    }
    return best;
  }

  function selectAt(point) {
    const marker = findMarkerAt(point);
    if (marker) selected = { kind: 'marker', id: marker.id };
    else {
      const region = Core.effectiveRegionAt(doc, point, null, isDm);
      selected = region ? { kind: 'region', id: region.id } : null;
    }
    updateInspector(); render();
  }

  function selectedItem() {
    if (!selected) return null;
    const key = selected.kind === 'region' ? 'regions' : selected.kind === 'marker' ? 'markers' : selected.kind === 'route' ? 'routes' : null;
    return key ? doc[key].find((item) => item.id === selected.id) || null : null;
  }

  function updateInspector() {
    const item = selectedItem();
    if (!item) { inspectorBody.textContent = 'Selecciona una región o marcador.'; return; }
    const lines = [item.name || item.id, `ID: ${item.id}`];
    if (selected.kind === 'region') lines.push(`CAPA: ${item.layer}`, `DISTRITO: ${item.districtId || '—'}`, `LEGAL: ${item.jurisdiction || '—'}`, `TERRENO: ${item.terrain}`, `FUENTE: ${item.source}`, `ÁREA: ${Math.round(item.areaKm2).toLocaleString()} km²`);
    if (selected.kind === 'marker') lines.push(`TIPO: ${item.type}`, `DISTRITO: ${item.districtId || '—'}`);
    if (selected.kind === 'route') lines.push(`RUTA: ${item.type}`, `DISTRITO: ${item.districtId || '—'}`);
    inspectorBody.innerHTML = lines.map((line, index) => index === 0 ? `<b>${escapeHtml(line)}</b>` : `<span>${escapeHtml(line)}</span>`).join('');
  }

  function applyFormToSelection() {
    if (!isDm) return;
    const item = selectedItem();
    if (!item) return notify('SELECT AN ITEM', 'error');
    if (item.locked) return notify('CANON ITEM LOCKED', 'error');
    const form = regionForm();
    try {
      if (selected.kind === 'region') doc = Core.upsertRegion(doc, { ...item, ...form, polygon: item.polygon, regionalOrigin: item.regionalOrigin });
      else if (selected.kind === 'marker') doc = Core.upsertMarker(doc, { ...item, name: form.name, districtId: form.districtId, type: document.getElementById('vtt-global-marker-type')?.value || item.type, visibleToPlayers: form.visibleToPlayers });
      else if (selected.kind === 'route') doc = Core.upsertRoute(doc, { ...item, name: form.name, districtId: form.districtId, type: document.getElementById('vtt-global-route-type')?.value || item.type, visibleToPlayers: form.visibleToPlayers, points: item.points });
      setDirty(true); updateInspector(); render();
    } catch (error) { notify(error.message || 'UPDATE FAILED', 'error'); }
  }

  function deleteSelection() {
    if (!isDm) return;
    const item = selectedItem();
    if (!item) return;
    if (item.locked) return notify('CANON ITEM LOCKED', 'error');
    try {
      if (selected.kind === 'region') doc = Core.removeRegion(doc, item.id);
      else if (selected.kind === 'marker') doc = Core.removeMarker(doc, item.id);
      else if (selected.kind === 'route') doc = Core.removeRoute(doc, item.id);
      selected = null; setDirty(true); updateInspector(); render();
    } catch (error) { notify(error.message || 'DELETE FAILED', 'error'); }
  }

  function onCanvasClick(event) {
    if (pan?.moved || event.button !== 0) return;
    const point = screenToWorld(event.clientX, event.clientY);
    if (!isDm || tool === 'select') return selectAt(point);
    if (tool === 'marker') {
      const form = regionForm(), id = uid('marker');
      try {
        doc = Core.upsertMarker(doc, { id, ...point, name: form.name, districtId: form.districtId, type: document.getElementById('vtt-global-marker-type')?.value || 'poi', visibleToPlayers: form.visibleToPlayers });
        selected = { kind: 'marker', id }; setDirty(true); updateInspector(); render();
      } catch (error) { notify(error.message || 'MARKER FAILED', 'error'); }
      return;
    }
    draftPoints.push(Core.normalizePoint(point, doc.bounds));
    render();
  }

  function onPointerDown(event) {
    const panAllowed = event.button === 1 || event.button === 2 || (!isDm && event.button === 0) || (tool === 'select' && event.button === 0 && event.shiftKey);
    if (!panAllowed) return;
    pan = { x: event.clientX, y: event.clientY, cameraX: camera.xKm, cameraY: camera.yKm, moved: false };
    canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (!pan) return;
    const dx = event.clientX - pan.x, dy = event.clientY - pan.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) pan.moved = true;
    camera.xKm = pan.cameraX - dx / camera.zoom;
    camera.yKm = pan.cameraY - dy / camera.zoom;
    render();
  }

  function onPointerUp() { if (pan) queueMicrotask(() => { pan = null; }); }

  function onWheel(event) {
    event.preventDefault();
    const before = screenToWorld(event.clientX, event.clientY);
    const factor = event.deltaY < 0 ? 1.18 : 1 / 1.18;
    camera.zoom = Math.max(0.02, Math.min(4, camera.zoom * factor));
    const after = screenToWorld(event.clientX, event.clientY);
    camera.xKm += before.xKm - after.xKm; camera.yKm += before.yKm - after.yKm;
    render();
  }

  function search() {
    const query = clean(document.getElementById('vtt-global-map-search')?.value).toLowerCase();
    if (!query) return;
    const visible = Core.visibleDocument(doc, isDm);
    const item = [...visible.markers, ...visible.regions].find((entry) => clean(entry.name).toLowerCase().includes(query) || clean(entry.id).toLowerCase().includes(query));
    if (!item) return notify('NOT FOUND', 'error');
    const point = item.polygon ? centroid(item.polygon) : item;
    const view = viewport();
    camera.xKm = point.xKm - view.width / camera.zoom / 2; camera.yKm = point.yKm - view.height / camera.zoom / 2;
    selected = { kind: item.polygon ? 'region' : 'marker', id: item.id };
    updateInspector(); render();
  }

  function unwatch() {
    if (mapRef && mapListener) mapRef.off('value', mapListener);
    if (playersRef && playersListener) playersRef.off('value', playersListener);
    mapRef = playersRef = mapListener = playersListener = null;
  }

  function watch() {
    const firebase = hostFirebase();
    const db = firebase?.database?.();
    if (!db) { notify('LOCAL MAP DATA', 'error'); return; }
    mapRef = db.ref(ROOT); playersRef = db.ref(PLAYERS_ROOT);
    mapListener = (snapshot) => {
      if (dirty && isDm) return;
      try { doc = snapshot.exists() ? Core.normalizeDocument(snapshot.val()) : Core.blankDocument(); loaded = true; if (!dirty) setDirty(false); render(); }
      catch (error) { console.error('[Luminous] Global map invalid:', error); notify('GLOBAL MAP INVALID', 'error'); }
    };
    playersListener = (snapshot) => { players = snapshot.val() || {}; render(); };
    mapRef.on('value', mapListener);
    playersRef.on('value', playersListener);
  }

  async function ensureLoaded() {
    if (loaded) return;
    const firebase = hostFirebase(), db = firebase?.database?.();
    if (!db) { loaded = true; return; }
    const snapshot = await db.ref(ROOT).once('value');
    doc = snapshot.exists() ? Core.normalizeDocument(snapshot.val()) : Core.blankDocument();
    loaded = true;
  }

  async function save() {
    if (!isDm) return false;
    const firebase = hostFirebase(), db = firebase?.database?.();
    if (!db) throw new Error('FIREBASE_UNAVAILABLE');
    const payload = Core.serialize({ ...Core.serialize(doc), updatedAtWorldTs: Date.now(), revision: Math.max(1, doc.revision) });
    await db.ref(ROOT).set(payload);
    doc = Core.normalizeDocument(payload);
    setDirty(false); render();
    return true;
  }

  async function openMap() {
    if (open) return;
    open = true; dom.root.hidden = false; dom.toggle.setAttribute('aria-expanded', 'true');
    engineWasRunning = globalThis.LuminousVttRuntime?.engine?.isRunning === true;
    globalThis.LuminousVttRuntime?.engine?.stop?.();
    if (localCanvas) localCanvas.hidden = true;
    resize();
    try { await ensureLoaded(); fit(); }
    catch (error) { console.error('[Luminous] Global map load failed:', error); notify('LOAD FAILED', 'error'); }
    watch(); render();
  }

  function closeMap() {
    if (!open) return;
    open = false; unwatch(); dom.root.hidden = true; dom.toggle.setAttribute('aria-expanded', 'false');
    if (localCanvas) localCanvas.hidden = false;
    if (engineWasRunning) globalThis.LuminousVttRuntime?.engine?.start?.();
  }

  dom.toggle.addEventListener('click', () => open ? closeMap() : void openMap());
  document.getElementById('vtt-global-map-close')?.addEventListener('click', closeMap);
  document.getElementById('vtt-global-map-reset')?.addEventListener('click', fit);
  document.getElementById('vtt-global-map-zoom-in')?.addEventListener('click', () => { camera.zoom = Math.min(4, camera.zoom * 1.25); render(); });
  document.getElementById('vtt-global-map-zoom-out')?.addEventListener('click', () => { camera.zoom = Math.max(0.02, camera.zoom / 1.25); render(); });
  document.getElementById('vtt-global-map-search')?.addEventListener('change', search);
  document.getElementById('vtt-global-map-search')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') search(); });
  document.querySelectorAll('[data-global-layer]').forEach((input) => input.addEventListener('change', () => { input.checked ? layerState.add(input.dataset.globalLayer) : layerState.delete(input.dataset.globalLayer); render(); }));
  document.querySelectorAll('[data-global-tool]').forEach((button) => button.addEventListener('click', () => setTool(button.dataset.globalTool)));
  document.getElementById('vtt-global-finish')?.addEventListener('click', finishDraft);
  document.getElementById('vtt-global-cancel')?.addEventListener('click', () => { draftPoints = []; setTool('select'); });
  document.getElementById('vtt-global-apply')?.addEventListener('click', applyFormToSelection);
  document.getElementById('vtt-global-delete')?.addEventListener('click', deleteSelection);
  document.getElementById('vtt-global-save')?.addEventListener('click', () => save().catch((error) => { console.error('[Luminous] Global map save failed:', error); notify('SAVE DENIED', 'error'); }));

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', (event) => {
    if (!open) return;
    if (event.key === 'Escape') { if (draftPoints.length) { draftPoints = []; render(); } else closeMap(); }
  });

  const api = Object.freeze({
    ROOT, PLAYERS_ROOT, core: Core,
    get isOpen() { return open; },
    get isDm() { return isDm; },
    get document() { return doc; },
    get camera() { return { ...camera }; },
    open: openMap,
    close: closeMap,
    fit,
    render,
    save,
    stop() { closeMap(); unwatch(); window.removeEventListener('resize', resize); dom.toggle.remove(); dom.root.remove(); },
  });
  globalThis.LuminousGlobalMapRuntime = api;
  return api;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();

export { start };
