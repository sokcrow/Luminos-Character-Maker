(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttSurfaceRenderer = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const imageCache = new Map();
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function coreRuntime() {
    if (root?.LuminousVttSurfaceCore) return root.LuminousVttSurfaceCore;
    if (typeof require !== 'undefined') {
      try { return require('./surface-core.js'); } catch (_) {}
    }
    return null;
  }

  function imageFor(url) {
    if (!url || typeof Image === 'undefined') return null;
    let entry = imageCache.get(url);
    if (!entry) {
      const image = new Image();
      entry = { image, ready:false, failed:false };
      image.decoding = 'async';
      image.onload = () => { entry.ready = true; };
      image.onerror = () => { entry.failed = true; };
      image.src = url;
      imageCache.set(url, entry);
    }
    return entry.ready && !entry.failed ? entry.image : null;
  }

  function drawCell(ctx, mapData, cell) {
    const core = coreRuntime();
    if (!core || !ctx || !cell) return false;
    const material = core.materialFor(mapData, cell.materialId);
    if (!material) return false;
    const size = Math.max(1, finite(mapData.grid?.size, 70));
    const x = cell.col * size, y = cell.row * size;
    const visual = material.visual || {};
    const opacity = Math.max(0, Math.min(1, finite(visual.opacity, 1)));
    ctx.save();
    ctx.globalAlpha *= opacity;
    const image = imageFor(visual.image);
    if (image) {
      const scale = Math.max(0.05, finite(visual.scale, 1));
      const dw = size * scale, dh = size * scale;
      const dx = x + ((size - dw) / 2), dy = y + ((size - dh) / 2);
      ctx.drawImage(image, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = visual.color || '#444444';
      ctx.fillRect(x, y, size, size);
    }
    ctx.restore();
    return true;
  }

  function drawSurfaceLayer(ctx, mapData = {}, zLayer = 0) {
    const core = coreRuntime();
    if (!core || !ctx) return 0;
    core.ensureMapState(mapData);
    let count = 0;
    for (const cell of core.cellsOnLayer(mapData, zLayer)) if (drawCell(ctx, mapData, cell)) count += 1;
    return count;
  }

  function drawGridOverlay(ctx, mapData = {}, isExporting = false) {
    if (!ctx || !mapData.grid) return false;
    const cols = Math.max(1, Math.trunc(finite(mapData.grid.cols, 1)));
    const rows = Math.max(1, Math.trunc(finite(mapData.grid.rows, 1)));
    const size = Math.max(1, finite(mapData.grid.size, 70));
    const width = cols * size, height = rows * size;
    ctx.save();
    ctx.strokeStyle = isExporting ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= cols; x += 1) { ctx.moveTo(x * size, 0); ctx.lineTo(x * size, height); }
    for (let y = 0; y <= rows; y += 1) { ctx.moveTo(0, y * size); ctx.lineTo(width, y * size); }
    ctx.stroke();
    ctx.restore();
    return true;
  }

  return Object.freeze({ imageFor, drawCell, drawSurfaceLayer, drawGridOverlay });
});
