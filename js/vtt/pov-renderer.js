(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttPovRenderer = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
  'use strict';

  const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function tokenLayer(token = {}) {
    const pov = browserRoot?.LuminousVttPovEngine;
    if (pov?.layerOf) return pov.layerOf(token);
    return Number(token.zLayer ?? token.gridPosition?.z ?? token.z?.[0] ?? 0) || 0;
  }

  function tokenRadius(token = {}, mapData = {}) {
    const rules = browserRoot?.LuminousVttTokenInteraction;
    return rules?.tokenRadius?.(token, mapData.grid) || num(token.radius, num(mapData.grid?.size, 70) * 0.4);
  }

  function lookDeg(token = {}) {
    const pov = browserRoot?.LuminousVttPovEngine;
    if (pov?.lookDeg) return pov.lookDeg(token);
    return Number.isFinite(Number(token.lookDeg)) ? Number(token.lookDeg) : num(token.facingDeg, 0);
  }

  function drawLookIndicator(ctx, token = {}, radius = 20) {
    if (!ctx || !token) return;
    const angle = (lookDeg(token) * Math.PI) / 180;
    const ringRadius = radius + Math.max(2, radius * 0.08);
    const tipRadius = ringRadius + Math.max(7, radius * 0.2);
    const baseRadius = ringRadius + 1;
    const spread = Math.max(0.13, Math.min(0.24, 5 / Math.max(10, radius)));

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.78)';
    ctx.lineWidth = Math.max(1.5, radius * 0.045);
    ctx.beginPath();
    ctx.arc(token.x, token.y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    const tip = { x: token.x + Math.cos(angle) * tipRadius, y: token.y + Math.sin(angle) * tipRadius };
    const left = { x: token.x + Math.cos(angle - spread) * baseRadius, y: token.y + Math.sin(angle - spread) * baseRadius };
    const right = { x: token.x + Math.cos(angle + spread) * baseRadius, y: token.y + Math.sin(angle + spread) * baseRadius };
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawIndicators(renderer, zLayer) {
    const ctx = renderer?.ctx;
    const mapData = renderer?.mapData;
    if (!ctx || !mapData) return;
    const tokenRules = browserRoot?.LuminousVttTokenInteraction;
    for (const token of mapData.tokens || []) {
      const onLayer = tokenRules?.tokenOnLayer ? tokenRules.tokenOnLayer(token, zLayer) : tokenLayer(token) === Number(zLayer);
      if (!onLayer) continue;
      drawLookIndicator(ctx, token, tokenRadius(token, mapData));
    }
  }

  function drawLookUpAnchor(ctx, viewer = {}, mapData = {}) {
    if (!ctx || !viewer) return;
    const radius = tokenRadius(viewer, mapData);
    ctx.save();
    ctx.globalAlpha = 0.62;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, radius * 0.06);
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(viewer.x, viewer.y, radius + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    drawLookIndicator(ctx, viewer, radius);
    ctx.restore();
  }

  return Object.freeze({ tokenLayer, tokenRadius, lookDeg, drawLookIndicator, drawIndicators, drawLookUpAnchor });
});
