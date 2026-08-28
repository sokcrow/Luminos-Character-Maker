import '../environment-engine.js';
import './lighting-engine.js';
import './environment-light-bridge.js';
import './lighting-state.js';
import './lighting-controller.js';

const ready = (fn) => {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => queueMicrotask(fn), { once: true });
  else queueMicrotask(fn);
};

ready(() => {
  const runtime = window.LuminousVttRuntime;
  if (!runtime?.engine || !runtime?.bridge) {
    console.error('Dynamic Lighting: VTT runtime is unavailable.');
    return;
  }

  const { engine, bridge } = runtime;
  const canvas = engine.canvas;
  const renderer = engine.renderer;
  const camera = engine.camera;
  const mapData = engine.mapData;
  const light = window.LuminousVttLightingEngine;
  const stateApi = window.LuminousVttLightingState;
  const envApi = window.LuminousVttEnvironmentLightBridge;
  const controllerApi = window.LuminousVttLightingController;
  if (!light || !stateApi || !envApi || !controllerApi) {
    console.error('Dynamic Lighting: one or more runtimes are unavailable.');
    return;
  }

  mapData.lighting ||= {};
  mapData.lighting.daylightHours ||= { start: 6, end: 18 };
  mapData.lighting.visionSamplingFt ||= 2.5;
  mapData.tokens?.forEach((token) => {
    if (!Number.isFinite(Number(token.facingDeg))) token.facingDeg = 0;
    if (!Number.isFinite(Number(token.visionConeDeg))) token.visionConeDeg = light.DEFAULT_VISION_CONE_DEG;
  });

  let lightingController = null;
  const lightingStateBridge = stateApi.createBridge({
    mapData,
    isDm: bridge.isDm,
    notify: (message, mode) => runtime.controller?.notify?.(message, mode),
    onChanged: () => lightingController?.handleSceneChanged?.(),
  });
  const environmentLightBridge = envApi.createBridge({ mapData, onChanged: () => { perceptionCache.key = ''; } });
  lightingController = controllerApi.createController({
    canvas,
    engine,
    mapData,
    bridge: lightingStateBridge,
    isDm: bridge.isDm,
    notify: (message, mode) => runtime.controller?.notify?.(message, mode),
  });
  lightingStateBridge.start();
  environmentLightBridge.start();

  const originalRender = renderer.render.bind(renderer);
  const perceptionCache = { key: '', tiles: [] };

  function controlledViewers() {
    if (bridge.isDm) {
      const previewId = mapData.lighting?.dmPreviewTokenId;
      if (!previewId) return [];
      const token = (mapData.tokens || []).find((entry) => String(entry.id) === String(previewId));
      return token ? [token] : [];
    }
    const tokenControl = window.LuminousVttTokenControl;
    const identity = tokenControl?.identity?.() || lightingStateBridge.identity || {};
    const controlled = (mapData.tokens || []).filter((token) => token.viewer === true || tokenControl?.canPlayerControl?.(token, identity));
    if (controlled.length) return controlled;
    const fallback = (mapData.tokens || []).find((token) => token.characterLink?.mode === 'current_player');
    return fallback ? [fallback] : [];
  }

  function scene() { return mapData.lighting?.scene || { sources: [], interiors: [], transformers: [], switches: [] }; }
  function environment() { return mapData.lighting?.environment || { state: { light: mapData.ambientLight?.level || 'bright' } }; }

  function mapFingerprint(viewers, activeZ, now) {
    const tokens = (mapData.tokens || []).map((token) => [token.id, Number(token.x)||0, Number(token.y)||0, light.layerOf(token), light.elevationFt(token, mapData), Number(token.facingDeg)||0]);
    const moving = (scene().sources || []).some((source) => source.motion && !light.interpolateMotion(source.motion, now).complete);
    return JSON.stringify({
      z: activeZ,
      viewers: viewers.map((viewer) => [viewer.id, viewer.x, viewer.y, light.layerOf(viewer), light.elevationFt(viewer, mapData), viewer.facingDeg, viewer.visionConeDeg, viewer.senses?.darkvisionFt]),
      tokens,
      scene: scene(),
      env: environment()?.state,
      motionTick: moving ? Math.floor(now / 50) : 0,
    });
  }

  function bestPerception(viewers, point, now) {
    let darkvision = null;
    let dim = null;
    for (const viewer of viewers) {
      const result = light.perceptionAtPoint(viewer, point, scene(), mapData, environment(), now);
      if (!result.visible) continue;
      if (!result.monochrome && result.level === 'bright') return result;
      if (!result.monochrome) dim ||= result;
      else darkvision ||= result;
    }
    return dim || darkvision || null;
  }

  function computeTiles(viewers, activeZ, now) {
    if (!viewers.length) return [];
    const stepFt = Math.max(1, Number(mapData.lighting?.visionSamplingFt) || 2.5);
    const step = light.feetToPixels(stepFt, mapData);
    const width = (mapData.grid?.cols || 1) * (mapData.grid?.size || 70);
    const height = (mapData.grid?.rows || 1) * (mapData.grid?.size || 70);
    const elevationFt = light.elevationForLayer(mapData, activeZ);
    const tiles = [];
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const w = Math.min(step, width - x), h = Math.min(step, height - y);
        const point = { x: x + w / 2, y: y + h / 2, zLayer: activeZ, elevationFt };
        const perception = bestPerception(viewers, point, now);
        if (!perception) continue;
        tiles.push({ x, y, w, h, perception });
      }
    }
    return tiles;
  }

  function perceptionTiles(viewers, activeZ, now) {
    const key = mapFingerprint(viewers, activeZ, now);
    if (key !== perceptionCache.key) {
      perceptionCache.key = key;
      perceptionCache.tiles = computeTiles(viewers, activeZ, now);
    }
    return perceptionCache.tiles;
  }

  function withRendererContext(targetCanvas, targetCtx, fn) {
    const prevCanvas = renderer.canvas, prevCtx = renderer.ctx;
    renderer.canvas = targetCanvas; renderer.ctx = targetCtx;
    try { fn(); } finally { renderer.canvas = prevCanvas; renderer.ctx = prevCtx; }
  }

  function drawLightEffects(ctx, activeZ, now, subtle = false) {
    const s = scene();
    const targetElevation = light.elevationForLayer(mapData, activeZ);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const raw of s.sources || []) {
      const source = light.sourcePosition(raw, mapData, now);
      if (!light.sourcePowered(source, s).powered) continue;
      const totalFt = Number(source.brightFt || 0) + Number(source.dimAdditionalFt || 0);
      const vertical = Math.abs(Number(source.elevationFt || 0) - targetElevation);
      if (vertical >= totalFt || totalFt <= 0) continue;
      const targetAtSource = { x: source.x, y: source.y, zLayer: activeZ, elevationFt: targetElevation };
      if (!light.canTraverseLayers(source, targetAtSource, s, mapData, 'light')) continue;
      const horizontalFt = Math.sqrt(Math.max(0, totalFt * totalFt - vertical * vertical));
      const radius = light.feetToPixels(horizontalFt, mapData) * light.lightVisualIntensity(source, now);
      if (radius <= 0) continue;
      ctx.save();
      if (source.shape === 'cone') {
        const angle = (Number(source.directionDeg || 0) * Math.PI) / 180;
        const half = ((Number(source.coneDeg || 90) / 2) * Math.PI) / 180;
        ctx.beginPath(); ctx.moveTo(source.x, source.y); ctx.arc(source.x, source.y, radius, angle - half, angle + half); ctx.closePath(); ctx.clip();
      }
      const gradient = ctx.createRadialGradient(source.x, source.y, 0, source.x, source.y, radius);
      const alpha = subtle ? 0.08 : 0.18;
      gradient.addColorStop(0, `${source.color || '#ffd27a'}${Math.round(alpha * 255).toString(16).padStart(2,'0')}`);
      gradient.addColorStop(0.55, `${source.color || '#ffd27a'}${Math.round(alpha * 0.65 * 255).toString(16).padStart(2,'0')}`);
      gradient.addColorStop(1, `${source.color || '#ffd27a'}00`);
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(source.x, source.y, radius, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawBaseScene(targetCanvas, targetCtx, activeZ, now, includeGuides = false) {
    withRendererContext(targetCanvas, targetCtx, () => {
      renderer.clear(false);
      targetCtx.save();
      camera.applyTransformSimple(targetCtx);
      targetCtx.fillStyle = '#111';
      targetCtx.fillRect(0, 0, (mapData.grid?.cols || 1) * (mapData.grid?.size || 70), (mapData.grid?.rows || 1) * (mapData.grid?.size || 70));
      renderer.drawGrid();
      renderer.drawWalls(activeZ, false);
      renderer.drawTopology(activeZ, false);
      renderer.drawTokens(activeZ);
      drawLightEffects(targetCtx, activeZ, now, bridge.isDm && !mapData.lighting?.dmPreviewTokenId);
      if (includeGuides) lightingController.renderEditorGuides(targetCtx);
      targetCtx.restore();
    });
  }

  function renderFullMap(activeZ, now) {
    drawBaseScene(canvas, renderer.ctx, activeZ, now, true);
  }

  function sourceForPerception(perception) {
    if (!perception?.light?.sourceId) return null;
    return (scene().sources || []).find((source) => String(source.id) === String(perception.light.sourceId)) || null;
  }

  function renderTokenVision(activeZ, viewers, now) {
    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width; offscreen.height = canvas.height;
    const offctx = offscreen.getContext('2d');
    drawBaseScene(offscreen, offctx, activeZ, now, false);

    renderer.ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderer.ctx.fillStyle = '#000'; renderer.ctx.fillRect(0, 0, canvas.width, canvas.height);
    const tiles = perceptionTiles(viewers, activeZ, now);
    const zoom = camera.zoom;
    for (const tile of tiles) {
      const sx = (tile.x + camera.x) * zoom;
      const sy = (tile.y + camera.y) * zoom;
      const sw = tile.w * zoom + 1;
      const sh = tile.h * zoom + 1;
      if (sx + sw < 0 || sy + sh < 0 || sx > canvas.width || sy > canvas.height) continue;
      const mode = tile.perception.mode;
      renderer.ctx.save();
      if (tile.perception.monochrome) renderer.ctx.filter = 'grayscale(1) brightness(.58)';
      else if (mode === 'normal_dim') renderer.ctx.filter = 'brightness(.68) contrast(.92)';
      else if (mode === 'near_dim') renderer.ctx.filter = 'brightness(.45) contrast(.88)';
      else renderer.ctx.filter = 'none';
      renderer.ctx.drawImage(offscreen, sx, sy, sw, sh, sx, sy, sw, sh);
      const source = sourceForPerception(tile.perception);
      if (source && !tile.perception.monochrome) {
        renderer.ctx.globalCompositeOperation = 'screen'; renderer.ctx.globalAlpha = tile.perception.level === 'bright' ? 0.10 : 0.06;
        renderer.ctx.fillStyle = source.color || '#ffd27a'; renderer.ctx.fillRect(sx, sy, sw, sh);
      }
      renderer.ctx.restore();
    }
  }

  renderer.render = function dynamicLightingRender(activeCamera, activeZ, renderData, isExporting = false) {
    if (isExporting) return originalRender(activeCamera, activeZ, renderData, true);
    const now = Date.now();
    const viewers = controlledViewers();
    if (bridge.isDm && !mapData.lighting?.dmPreviewTokenId) renderFullMap(activeZ, now);
    else renderTokenVision(activeZ, viewers, now);
  };
  engine.calculateVision = () => ({ dynamicLighting: true });

  function tokenFromMoveEvent(event) {
    const id = event.detail?.tokenId;
    return (mapData.tokens || []).find((token) => String(token.id) === String(id)) || null;
  }

  function updateFacingFromMove(event) {
    const token = tokenFromMoveEvent(event);
    const from = event.detail?.from || {}, to = event.detail?.to || {};
    if (!token || !Number.isFinite(Number(from.x)) || !Number.isFinite(Number(to.x))) return;
    const dx = Number(to.x) - Number(from.x), dy = Number(to.y) - Number(from.y);
    if (Math.hypot(dx, dy) < 1) return;
    token.facingDeg = light.normalizeAngleDeg((Math.atan2(dy, dx) * 180) / Math.PI);
    perceptionCache.key = '';
    lightingStateBridge.saveFacing(token).catch((error) => console.error('VTT facing persistence failed:', error));
  }
  canvas.addEventListener('vtt:token-moved', updateFacingFromMove);

  function rotatableToken() {
    if (bridge.isDm && mapData.lighting?.dmPreviewTokenId) return (mapData.tokens || []).find((token) => String(token.id) === String(mapData.lighting.dmPreviewTokenId)) || null;
    return controlledViewers()[0] || null;
  }
  const keyHandler = (event) => {
    if (!['[', ']'].includes(event.key) || event.ctrlKey || event.metaKey || event.altKey) return;
    const token = rotatableToken();
    if (!token) return;
    token.facingDeg = light.normalizeAngleDeg(Number(token.facingDeg || 0) + (event.key === '[' ? -15 : 15));
    perceptionCache.key = '';
    lightingStateBridge.saveFacing(token).catch((error) => console.error('VTT facing persistence failed:', error));
    event.preventDefault();
  };
  window.addEventListener('keydown', keyHandler);

  const previousRuntime = window.LuminousVttRuntime;
  window.LuminousVttRuntime = Object.freeze({
    ...previousRuntime,
    lighting: Object.freeze({
      engine: light,
      stateBridge: lightingStateBridge,
      environmentBridge: environmentLightBridge,
      controller: lightingController,
      controlledViewers,
      perceptionAtPoint: (viewer, point) => light.perceptionAtPoint(viewer, point, scene(), mapData, environment()),
    }),
  });

  window.addEventListener('beforeunload', () => {
    canvas.removeEventListener('vtt:token-moved', updateFacingFromMove);
    window.removeEventListener('keydown', keyHandler);
    lightingController.stop();
    environmentLightBridge.stop();
    lightingStateBridge.stop();
    renderer.render = originalRender;
  }, { once: true });
});