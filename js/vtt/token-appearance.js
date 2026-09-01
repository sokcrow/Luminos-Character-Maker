(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttTokenAppearance = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
  'use strict';

  const cache = new Map();
  const installed = new WeakMap();
  const clean = (value) => String(value ?? '').trim();

  // Tactical image authority is the assigned Actor's `icono`, copied onto the
  // token by actor-library. Player-record image aliases and Theatre sprites are
  // deliberately ignored here.
  function imageSource(token = {}) {
    return clean(token?.icono || '');
  }

  function coverRect(imageWidth, imageHeight, centerX, centerY, diameter) {
    const width = Number(imageWidth);
    const height = Number(imageHeight);
    const size = Math.max(0, Number(diameter) || 0);
    if (!(width > 0) || !(height > 0) || !(size > 0)) return null;
    const scale = Math.max(size / width, size / height);
    const drawWidth = width * scale;
    const drawHeight = height * scale;
    return {
      x: Number(centerX) - (drawWidth / 2),
      y: Number(centerY) - (drawHeight / 2),
      width: drawWidth,
      height: drawHeight,
    };
  }

  function imageEntry(url, root = browserRoot) {
    if (!url || typeof root?.Image !== 'function') return null;
    let entry = cache.get(url);
    if (entry) return entry;
    const image = new root.Image();
    entry = { image, ready: false, failed: false };
    image.onload = () => { entry.ready = true; };
    image.onerror = () => { entry.failed = true; };
    image.src = url;
    cache.set(url, entry);
    return entry;
  }

  function drawTokenImage(renderer, token, radius, root = browserRoot) {
    const url = imageSource(token);
    const entry = imageEntry(url, root);
    if (!entry || !entry.ready || entry.failed) return false;
    const image = entry.image;
    const naturalWidth = Number(image.naturalWidth || image.width);
    const naturalHeight = Number(image.naturalHeight || image.height);
    const clipRadius = Math.max(1, Number(radius) * 0.92);
    const rect = coverRect(naturalWidth, naturalHeight, token.x, token.y, clipRadius * 2);
    if (!rect || !renderer?.ctx) return false;

    const ctx = renderer.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.arc(token.x, token.y, clipRadius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
    return true;
  }

  function installRenderer(renderer, root = browserRoot) {
    if (!renderer || typeof renderer.drawPersonIcon !== 'function') return false;
    let state = installed.get(renderer);
    if (!state) {
      state = { fallback: renderer.drawPersonIcon.bind(renderer) };
      installed.set(renderer, state);
    }
    renderer.drawPersonIcon = function drawActorFicha(token, radius) {
      if (!drawTokenImage(renderer, token, radius, root)) state.fallback(token, radius);
    };
    return true;
  }

  function clearCache() { cache.clear(); }

  return Object.freeze({ imageSource, coverRect, drawTokenImage, installRenderer, clearCache });
});
