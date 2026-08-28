(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttMemoryRenderer = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
  'use strict';

  const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function memoryRuntime() {
    if (browserRoot?.LuminousVttMemoryEngine) return browserRoot.LuminousVttMemoryEngine;
    if (typeof require !== 'undefined') {
      try { return require('./memory-engine.js'); } catch (_) {}
    }
    return null;
  }

  function layer(record = {}, zLayer = 0) {
    return record?.dungeon?.layers?.[String(Number(zLayer) || 0)] || { routeCells: {}, rememberedCells: {} };
  }

  function cellRect(key, mapData = {}) {
    const memory = memoryRuntime();
    const parsed = memory?.parseCellKey?.(key);
    if (!parsed) return null;
    const size = Math.max(1, num(mapData.grid?.size, 70));
    return { x: parsed.col * size, y: parsed.row * size, w: size, h: size };
  }

  function drawCells(ctx, record, zLayer, visibleCells, mapData, options = {}) {
    const data = layer(record, zLayer);
    const route = data.routeCells || {};
    const remembered = data.rememberedCells || {};
    const routeOnly = options.routeOnly === true;

    ctx.save();
    ctx.fillStyle = 'rgba(92,92,92,.42)';
    if (!routeOnly) {
      for (const key of Object.keys(remembered)) {
        if (visibleCells?.has?.(key)) continue;
        const rect = cellRect(key, mapData);
        if (rect) ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      }
    }

    ctx.fillStyle = routeOnly ? 'rgba(130,130,130,.56)' : 'rgba(150,150,150,.28)';
    const size = Math.max(1, num(mapData.grid?.size, 70));
    for (const key of Object.keys(route)) {
      if (visibleCells?.has?.(key)) continue;
      const rect = cellRect(key, mapData);
      if (!rect) continue;
      const inset = routeOnly ? size * .34 : size * .42;
      ctx.fillRect(rect.x + inset, rect.y + inset, Math.max(2, size - inset * 2), Math.max(2, size - inset * 2));
    }
    ctx.restore();
  }

  function objectOnLayer(object = {}, zLayer = 0) {
    const layers = Array.isArray(object.z) ? object.z.map(Number) : [Number(object.z) || 0];
    return layers.includes(Number(zLayer));
  }

  function objectSegment(object = {}, mapData = {}) {
    const size = Math.max(1, num(mapData.grid?.size, 70));
    return {
      x1: num(object.from?.col) * size,
      y1: num(object.from?.row) * size,
      x2: num(object.to?.col) * size,
      y2: num(object.to?.row) * size,
    };
  }

  function objectTouchesVisible(object, visibleCells, mapData) {
    const memory = memoryRuntime();
    if (!memory || !visibleCells?.size) return false;
    const s = objectSegment(object, mapData);
    const points = [
      { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 },
      { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 },
    ];
    return points.some((point) => visibleCells.has(memory.cellKeyForPoint(point, mapData)));
  }

  function drawObjects(ctx, record, zLayer, visibleCells, mapData, options = {}) {
    if (options.geometry === false) return;
    ctx.save();
    ctx.lineCap = 'square';
    for (const object of Object.values(record?.dungeon?.objects || {})) {
      if (!objectOnLayer(object, zLayer) || objectTouchesVisible(object, visibleCells, mapData)) continue;
      const s = objectSegment(object, mapData);
      const type = String(object.type || 'wall');
      ctx.lineWidth = type === 'wall' ? 4 : 3;
      ctx.strokeStyle = type === 'wall' ? 'rgba(205,205,205,.52)' : 'rgba(225,225,225,.66)';
      if (type === 'window') ctx.setLineDash([7, 5]);
      else if (type === 'curtain_window') ctx.setLineDash([3, 4]);
      else ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();

      if (type !== 'wall' && object.lastKnownState && options.objectState !== false) {
        const mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2;
        ctx.fillStyle = 'rgba(255,255,255,.78)';
        ctx.font = `${Math.max(8, num(mapData.grid?.size, 70) * .13)}px monospace`;
        const label = object.lastKnownState === 'open' ? 'O' : object.lastKnownState === 'broken' ? 'X' : 'C';
        ctx.fillText(label, mx + 4, my - 4);
      }
    }
    ctx.restore();
  }

  function drawRememberedOverlay(ctx, { record, profile, zLayer, visibleCells, mapData, camera } = {}) {
    if (!ctx || !record || !profile || profile.rank <= 0) return;
    ctx.save();
    camera?.applyTransformSimple?.(ctx);
    drawCells(ctx, record, zLayer, visibleCells, mapData, { routeOnly: !profile.capabilities?.geometry });
    if (profile.capabilities?.geometry) drawObjects(ctx, record, zLayer, visibleCells, mapData, { objectState: profile.capabilities?.objectState });
    ctx.restore();
  }

  function ensureUi({ isDm = false } = {}) {
    const doc = browserRoot?.document;
    if (!doc) return null;
    if (!doc.getElementById('vtt-memory-style')) {
      const style = doc.createElement('style');
      style.id = 'vtt-memory-style';
      style.textContent = `
        .vtt-minimap-toggle{position:fixed;right:18px;bottom:18px;z-index:30100}
        .vtt-minimap-panel{position:fixed;right:18px;bottom:62px;width:270px;z-index:30110;background:#0b0b0b;border:2px solid #fff;color:#fff;padding:10px;box-shadow:5px 5px 0 #000;font:11px monospace}
        .vtt-minimap-panel[hidden]{display:none}.vtt-minimap-panel canvas{display:block;width:250px;height:250px;background:#000;border:1px solid #555;image-rendering:pixelated}
        .vtt-minimap-meta{display:flex;justify-content:space-between;gap:8px;margin-top:7px}.vtt-memory-admin{display:grid;gap:6px;margin-top:9px;padding-top:8px;border-top:1px solid #555}.vtt-memory-admin select,.vtt-memory-admin button{font:inherit}
      `;
      doc.head.appendChild(style);
    }
    let button = doc.getElementById('vtt-minimap-toggle');
    if (!button) {
      button = doc.createElement('button');
      button.id = 'vtt-minimap-toggle';
      button.type = 'button';
      button.className = 'brutalist-button vtt-minimap-toggle';
      button.textContent = 'MINIMAP';
      doc.body.appendChild(button);
    }
    let panel = doc.getElementById('vtt-minimap-panel');
    if (!panel) {
      panel = doc.createElement('aside');
      panel.id = 'vtt-minimap-panel';
      panel.className = 'vtt-minimap-panel';
      panel.hidden = true;
      panel.innerHTML = `<canvas id="vtt-minimap-canvas" width="250" height="250"></canvas><div class="vtt-minimap-meta"><span id="vtt-minimap-rank">MEMORY</span><span id="vtt-minimap-layer">Z0</span></div>`;
      if (isDm) {
        const admin = doc.createElement('div');
        admin.className = 'vtt-memory-admin';
        admin.innerHTML = `<strong>DM MEMORY</strong><select id="vtt-memory-rank-override"><option value="auto">AUTO · INT + TRAITS</option><option value="0">NONE</option><option value="1">ROUTE</option><option value="2">GEOMETRY</option><option value="3">DETAILED</option></select><button id="vtt-memory-reveal-layer" type="button">REMEMBER LAYER</button><button id="vtt-memory-clear" type="button">CLEAR MEMORY</button>`;
        panel.appendChild(admin);
      }
      doc.body.appendChild(panel);
    }
    if (!button.dataset.bound) {
      button.dataset.bound = 'true';
      button.addEventListener('click', () => { panel.hidden = !panel.hidden; });
    }
    return { button, panel, canvas: doc.getElementById('vtt-minimap-canvas') };
  }

  function drawMinimap({ record, profile, zLayer, mapData, token = null } = {}) {
    const doc = browserRoot?.document;
    const canvas = doc?.getElementById('vtt-minimap-canvas');
    if (!canvas || !record || !profile) return;
    const ctx = canvas.getContext('2d');
    const cols = Math.max(1, num(mapData.grid?.cols, 1));
    const rows = Math.max(1, num(mapData.grid?.rows, 1));
    const sx = canvas.width / cols, sy = canvas.height / rows;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const data = layer(record, zLayer);
    const remembered = profile.capabilities?.geometry ? data.rememberedCells || {} : {};
    ctx.fillStyle = '#555';
    for (const key of Object.keys(remembered)) {
      const parsed = memoryRuntime()?.parseCellKey?.(key); if (!parsed) continue;
      ctx.fillRect(parsed.col * sx, parsed.row * sy, Math.ceil(sx), Math.ceil(sy));
    }
    ctx.fillStyle = '#aaa';
    for (const key of Object.keys(data.routeCells || {})) {
      const parsed = memoryRuntime()?.parseCellKey?.(key); if (!parsed) continue;
      ctx.fillRect((parsed.col + .35) * sx, (parsed.row + .35) * sy, Math.max(1, sx * .3), Math.max(1, sy * .3));
    }
    if (profile.capabilities?.geometry) {
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
      for (const object of Object.values(record?.dungeon?.objects || {})) {
        if (!objectOnLayer(object, zLayer)) continue;
        ctx.beginPath();
        ctx.moveTo(num(object.from?.col) * sx, num(object.from?.row) * sy);
        ctx.lineTo(num(object.to?.col) * sx, num(object.to?.row) * sy);
        ctx.stroke();
      }
    }
    if (token) {
      const size = Math.max(1, num(mapData.grid?.size, 70));
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc((num(token.x) / size) * sx, (num(token.y) / size) * sy, 3, 0, Math.PI * 2); ctx.fill();
    }
    const rank = doc?.getElementById('vtt-minimap-rank');
    const layerNode = doc?.getElementById('vtt-minimap-layer');
    if (rank) rank.textContent = `MEMORY R${profile.rank} · INT ${profile.intelligence ?? '?'}`;
    if (layerNode) layerNode.textContent = `Z${Number(zLayer) || 0}`;
  }

  return Object.freeze({ layer, cellRect, drawCells, drawObjects, drawRememberedOverlay, ensureUi, drawMinimap });
});
