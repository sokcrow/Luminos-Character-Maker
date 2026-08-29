(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttWallAutoTileRenderer = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function topologyRuntime() {
    if (root?.LuminousVttTopology) return root.LuminousVttTopology;
    if (typeof require !== 'undefined') {
      try { return require('./topology.js'); } catch (_) {}
    }
    return null;
  }

  function tileRuntime() {
    if (root?.LuminousVttWallAutoTile) return root.LuminousVttWallAutoTile;
    if (typeof require !== 'undefined') {
      try { return require('./wall-auto-tile.js'); } catch (_) {}
    }
    return null;
  }

  function shade(hex, amount = -28) {
    const value = String(hex || '#8b8f93').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(value)) return '#303438';
    const rgb = [0,2,4].map((index) => Math.max(0, Math.min(255, parseInt(value.slice(index, index + 2), 16) + amount)));
    return `#${rgb.map((part) => part.toString(16).padStart(2, '0')).join('')}`;
  }

  function pointForVertex(vertex, mapData = {}) {
    const size = Math.max(1, finite(mapData.grid?.size, 70));
    return { x:finite(vertex?.col) * size, y:finite(vertex?.row) * size };
  }

  function widthFor(element, mapData = {}) {
    const topology = topologyRuntime();
    const line = topology?.segment?.(element, mapData.grid || {});
    return Math.max(4, finite(line?.thicknessPx, 4));
  }

  function drawJunction(ctx, point, junction, width, color, onion = false) {
    if (!junction || !ctx) return;
    const shape = junction.shape || 'end';
    const radius = Math.max(width * 0.52, shape === 't' || shape === 'cross' ? width * 0.68 : width * 0.56);
    ctx.save();
    ctx.globalAlpha *= onion ? 0.55 : 1;
    ctx.fillStyle = color;
    ctx.strokeStyle = shade(color, -34);
    ctx.lineWidth = Math.max(1, width * 0.16);

    if (shape === 'end') {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (shape === 'straight') {
      ctx.fillRect(point.x - radius * 0.72, point.y - radius * 0.72, radius * 1.44, radius * 1.44);
    } else {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWallTile(ctx, mapData = {}, rawElement = {}, tile = null, options = {}) {
    const topology = topologyRuntime();
    const autoTile = tileRuntime();
    if (!ctx || !topology || !autoTile) return false;
    const element = topology.normalizeElement(rawElement);
    const descriptor = tile || autoTile.tileForEdge(rawElement, mapData);
    if (!descriptor) return false;
    const line = topology.segment(element, mapData.grid || {});
    const width = widthFor(element, mapData);
    const color = options.onion ? '#666666' : descriptor.color || rawElement.wall?.visual?.color || '#8b8f93';
    const outline = options.onion ? '#4d4d4d' : shade(color, -38);

    ctx.save();
    ctx.globalAlpha = options.onion ? 0.3 : 1;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);

    ctx.strokeStyle = outline;
    ctx.lineWidth = width + Math.max(2, width * 0.24);
    ctx.beginPath();
    ctx.moveTo(line.x1, line.y1);
    ctx.lineTo(line.x2, line.y2);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(line.x1, line.y1);
    ctx.lineTo(line.x2, line.y2);
    ctx.stroke();

    drawJunction(ctx, pointForVertex(element.from, mapData), descriptor.from, width, color, options.onion);
    drawJunction(ctx, pointForVertex(element.to, mapData), descriptor.to, width, color, options.onion);
    ctx.restore();
    return true;
  }

  return Object.freeze({ shade, pointForVertex, widthFor, drawJunction, drawWallTile });
});
